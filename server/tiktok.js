// TikTok LIVE olaylarını oyunun anlayacağı sade bir biçime çevirir.
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const firstUrl = (img) =>
  img?.urlList?.[0] || img?.url?.[0] || img?.urls?.[0] || (typeof img === 'string' ? img : undefined);

export function normalizeUser(u = {}) {
  const uniqueId = u.uniqueId || u.displayId || u.username || '';
  return {
    id: String(u.userId ?? u.idStr ?? u.id ?? uniqueId),
    uniqueId,
    nickname: u.nickname || uniqueId || 'izleyici',
    avatar: u.profilePictureUrl || firstUrl(u.avatarThumb) || firstUrl(u.avatarMedium)
      || firstUrl(u.avatarLarge) || firstUrl(u.profilePicture) || '',
  };
}

export class TikTokBridge {
  constructor({ onEvent, onStatus }) {
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.connection = null;
    this.status = { connected: false, username: '', error: '' };
    this.streaks = new Map(); // `${userId}:${giftId}` -> son repeatCount
    this.giftCache = null;
  }

  setStatus(patch) {
    this.status = { ...this.status, ...patch };
    this.onStatus(this.status);
  }

  async connect(username) {
    username = String(username || '').trim().replace(/^@/, '');
    if (!username) return;
    this.disconnect();
    this.setStatus({ connected: false, username, error: 'Bağlanıyor…' });
    const conn = new TikTokLiveConnection(username, { enableExtendedGiftInfo: true });
    this.connection = conn;
    this.attach(conn);
    try {
      const state = await conn.connect();
      if (this.connection !== conn) return;
      this.setStatus({ connected: true, error: '', roomId: state?.roomId });
      if (conn.availableGifts) this.giftCache = conn.availableGifts;
    } catch (err) {
      if (this.connection !== conn) return;
      this.setStatus({ connected: false, error: `Bağlantı hatası: ${err?.message || err}` });
    }
  }

  disconnect() {
    const conn = this.connection;
    this.connection = null;
    this.streaks.clear();
    if (conn) {
      try { conn.disconnect(); } catch { /* yoksay */ }
      this.setStatus({ connected: false, error: '' });
    }
  }

  async getAvailableGifts() {
    if (!this.giftCache && this.connection) {
      this.giftCache = await this.connection.fetchAvailableGifts();
    }
    const list = Array.isArray(this.giftCache) ? this.giftCache : this.giftCache?.gifts || [];
    return list.map((g) => ({
      id: g.id,
      name: g.name,
      diamonds: g.diamond_count ?? g.diamondCount ?? 0,
      image: firstUrl(g.image) || firstUrl(g.icon) || '',
      source: 'tiktok',
    }));
  }

  attach(conn) {
    const emit = (event) => this.onEvent({ ts: Date.now(), ...event });

    conn.on(WebcastEvent.GIFT, (data) => {
      const d = data.giftDetails || {};
      const user = normalizeUser(data.user || data);
      const giftId = data.giftId ?? d.id;
      const key = `${user.id}:${giftId}`;
      const repeat = Number(data.repeatCount || 1);
      let count = repeat;
      // Seri (streak) hediyelerde her olayda toplam sayı gelir; sadece farkı işle.
      if (d.giftType === 1) {
        const prev = this.streaks.get(key) || 0;
        count = Math.max(0, repeat - prev);
        if (data.repeatEnd) this.streaks.delete(key);
        else this.streaks.set(key, repeat);
      }
      if (count <= 0) return;
      emit({
        kind: 'gift',
        user,
        count,
        gift: {
          id: giftId,
          name: d.giftName || data.giftName || `Hediye ${giftId}`,
          diamonds: d.diamondCount ?? data.diamondCount ?? 0,
          image: firstUrl(d.giftImage) || firstUrl(d.icon) || data.giftPictureUrl || '',
        },
      });
    });

    conn.on(WebcastEvent.LIKE, (data) => emit({
      kind: 'like', user: normalizeUser(data.user || data),
      count: Number(data.likeCount || 1), total: Number(data.totalLikeCount || 0),
    }));
    conn.on(WebcastEvent.FOLLOW, (data) => emit({ kind: 'follow', user: normalizeUser(data.user || data), count: 1 }));
    conn.on(WebcastEvent.SHARE, (data) => emit({ kind: 'share', user: normalizeUser(data.user || data), count: 1 }));
    conn.on(WebcastEvent.MEMBER, (data) => emit({ kind: 'member', user: normalizeUser(data.user || data), count: 1 }));
    conn.on(WebcastEvent.CHAT, (data) => emit({
      kind: 'chat', user: normalizeUser(data.user || data), count: 1, comment: String(data.comment || ''),
    }));
    if (WebcastEvent.SUB_NOTIFY) {
      conn.on(WebcastEvent.SUB_NOTIFY, (data) => emit({ kind: 'subscribe', user: normalizeUser(data.user || data), count: 1 }));
    }
    conn.on(WebcastEvent.STREAM_END, () => this.setStatus({ connected: false, error: 'Yayın sona erdi' }));
    conn.on(ControlEvent.DISCONNECTED, () => {
      if (this.connection === conn) this.setStatus({ connected: false, error: 'Bağlantı koptu' });
    });
    conn.on(ControlEvent.ERROR, (err) => {
      console.warn('[tiktok]', err?.info || err?.message || err);
    });
  }
}
