// Canlı yayın olay kaynakları: TikFinity (yerel WebSocket API) veya doğrudan TikTok.
// Her iki kaynaktan gelen olaylar oyunun anlayacağı tek bir biçime çevrilir.
import WebSocket from 'ws';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const firstUrl = (img) =>
  img?.urlList?.[0] || img?.url_list?.[0] || img?.url?.[0] || img?.urls?.[0] || (typeof img === 'string' ? img : undefined);

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

// Ham olayı (TikTok-Live-Connector'ın hem yeni hem eski/düz biçimi) sadeleştirir.
// Seri (streak) hediyelerde her olayda toplam sayı gelir; yalnızca fark işlenir.
export class EventNormalizer {
  constructor() {
    this.streaks = new Map();
  }

  reset() { this.streaks.clear(); }

  process(type, data = {}) {
    const user = normalizeUser(data.user || data);
    switch (type) {
      case 'gift': {
        const d = data.giftDetails || data.gift_details || data;
        const giftId = data.giftId ?? d.id ?? data.gift?.gift_id;
        const giftType = d.giftType ?? data.giftType ?? data.gift?.gift_type;
        const repeat = Number(data.repeatCount ?? data.gift?.repeat_count ?? 1) || 1;
        const repeatEnd = !!(data.repeatEnd ?? data.gift?.repeat_end);
        const key = `${user.id}:${giftId}`;
        let count = repeat;
        if (giftType === 1) {
          const prev = this.streaks.get(key) || 0;
          count = Math.max(0, repeat - prev);
          if (repeatEnd) this.streaks.delete(key);
          else this.streaks.set(key, repeat);
        }
        if (count <= 0) return null;
        return {
          kind: 'gift', user, count,
          gift: {
            id: giftId,
            name: d.giftName || data.giftName || d.name || `Hediye ${giftId}`,
            diamonds: Number(d.diamondCount ?? data.diamondCount ?? d.diamond_count ?? 0),
            image: firstUrl(d.giftImage) || firstUrl(d.icon) || data.giftPictureUrl || '',
          },
        };
      }
      case 'like':
        return { kind: 'like', user, count: Number(data.likeCount || 1), total: Number(data.totalLikeCount || 0) };
      case 'follow':
      case 'share':
      case 'member':
      case 'subscribe':
        return { kind: type, user, count: 1 };
      case 'chat':
        return { kind: 'chat', user, count: 1, comment: String(data.comment || '') };
      default:
        return null;
    }
  }
}

// TikFinity: bilgisayarda açık olan TikFinity uygulamasının yerel WebSocket API'sine bağlanır.
// Mesaj biçimi: { "event": "gift", "data": { ... } }
export class TikFinityBridge {
  constructor({ onEvent, onStatus }) {
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.norm = new EventNormalizer();
    this.ws = null;
    this.url = '';
    this.active = false;
    this.retry = null;
  }

  connect(url) {
    this.disconnect(true);
    this.url = url || 'ws://localhost:21213/';
    this.active = true;
    this.open();
  }

  open() {
    if (!this.active) return;
    this.onStatus({ source: 'tikfinity', connected: false, url: this.url, error: 'TikFinity\'ye bağlanılıyor…' });
    let ws;
    try { ws = new WebSocket(this.url); } catch (err) {
      this.onStatus({ source: 'tikfinity', connected: false, url: this.url, error: `Geçersiz adres: ${err.message}` });
      return;
    }
    this.ws = ws;
    ws.on('open', () => {
      this.norm.reset();
      this.onStatus({ source: 'tikfinity', connected: true, url: this.url, error: '' });
    });
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      const type = msg.event || msg.type;
      // 'social' olayı follow/share olarak ayrıca da geldiği için yok sayılır (çift sayılmasın)
      const ev = this.norm.process(type, msg.data || {});
      if (ev) this.onEvent({ ts: Date.now(), ...ev });
    });
    ws.on('error', () => { /* close olayı yeniden bağlanmayı yönetir */ });
    ws.on('close', () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.active) return;
      this.onStatus({ source: 'tikfinity', connected: false, url: this.url,
        error: 'TikFinity bekleniyor (uygulama açık mı?)' });
      this.retry = setTimeout(() => this.open(), 3000);
    });
  }

  disconnect(silent) {
    this.active = false;
    clearTimeout(this.retry);
    const ws = this.ws;
    this.ws = null;
    if (ws) try { ws.close(); } catch { /* yoksay */ }
    if (!silent) this.onStatus({ source: 'tikfinity', connected: false, url: this.url, error: '' });
  }
}

// Doğrudan TikTok bağlantısı (TikFinity olmadan, yedek seçenek)
export class TikTokBridge {
  constructor({ onEvent, onStatus }) {
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.norm = new EventNormalizer();
    this.connection = null;
    this.giftCache = null;
    this.username = '';
  }

  async connect(username) {
    username = String(username || '').trim().replace(/^@/, '');
    if (!username) return;
    this.disconnect(true);
    this.username = username;
    this.onStatus({ source: 'tiktok', connected: false, username, error: 'Bağlanıyor…' });
    const conn = new TikTokLiveConnection(username, { enableExtendedGiftInfo: true });
    this.connection = conn;
    const emit = (type) => (data) => {
      const ev = this.norm.process(type, data);
      if (ev) this.onEvent({ ts: Date.now(), ...ev });
    };
    conn.on(WebcastEvent.GIFT, emit('gift'));
    conn.on(WebcastEvent.LIKE, emit('like'));
    conn.on(WebcastEvent.FOLLOW, emit('follow'));
    conn.on(WebcastEvent.SHARE, emit('share'));
    conn.on(WebcastEvent.MEMBER, emit('member'));
    conn.on(WebcastEvent.CHAT, emit('chat'));
    if (WebcastEvent.SUB_NOTIFY) conn.on(WebcastEvent.SUB_NOTIFY, emit('subscribe'));
    conn.on(WebcastEvent.STREAM_END, () => this.onStatus({ source: 'tiktok', connected: false, username, error: 'Yayın sona erdi' }));
    conn.on(ControlEvent.DISCONNECTED, () => {
      if (this.connection === conn) this.onStatus({ source: 'tiktok', connected: false, username, error: 'Bağlantı koptu' });
    });
    conn.on(ControlEvent.ERROR, (err) => console.warn('[tiktok]', err?.info || err?.message || err));
    try {
      await conn.connect();
      if (this.connection !== conn) return;
      this.norm.reset();
      this.onStatus({ source: 'tiktok', connected: true, username, error: '' });
      if (conn.availableGifts) this.giftCache = conn.availableGifts;
    } catch (err) {
      if (this.connection !== conn) return;
      this.onStatus({ source: 'tiktok', connected: false, username, error: `Bağlantı hatası: ${err?.message || err}` });
    }
  }

  disconnect(silent) {
    const conn = this.connection;
    this.connection = null;
    if (conn) try { conn.disconnect(); } catch { /* yoksay */ }
    if (!silent) this.onStatus({ source: 'tiktok', connected: false, username: this.username, error: '' });
  }

  async getAvailableGifts() {
    if (!this.giftCache && this.connection) this.giftCache = await this.connection.fetchAvailableGifts();
    const list = Array.isArray(this.giftCache) ? this.giftCache : this.giftCache?.gifts || [];
    return list.map((g) => ({
      id: g.id, name: g.name, diamonds: g.diamond_count ?? g.diamondCount ?? 0,
      image: firstUrl(g.image) || firstUrl(g.icon) || '', source: 'tiktok',
    }));
  }
}
