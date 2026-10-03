// Ekran üstü arayüz (DOM): hedef barı, benzin, aktif efektler, kuyruk, olay akışı, liderlik.
import { ACTIONS } from './catalog.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function avatarHtml(user, cls = 'av') {
  const name = user?.nickname || user?.uniqueId || '?';
  const img = user?.avatar ? `<img src="${esc(user.avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
  return `<span class="${cls} ph">${esc((name[0] || '?').toUpperCase())}${img}</span>`;
}

const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Hud {
  constructor() {
    this.el = {
      fill: $('#progress .fill'),
      car: $('#progress .car'),
      markers: $('#progress .markers'),
      dist: $('#dist'),
      target: $('#target'),
      fuelFill: $('#fuel .fill'),
      fuelText: $('#fuel .pct'),
      fuel: $('#fuel'),
      status: $('#status-icons'),
      queue: $('#queue'),
      queueList: $('#queue ul'),
      feed: $('#feed'),
      leaders: $('#leaders'),
      announce: $('#announce'),
      pause: $('#pause'),
      win: $('#win'),
      conn: $('#conn'),
      timer: $('#timer'),
      loseLabel: $('#lose-label'),
      scoreW: $('#score .w'),
      scoreL: $('#score .l'),
      cd: $('#countdown'),
      cdLbl: $('#countdown .lbl'),
      cdNum: $('#countdown .num'),
    };
    this.lastCd = '';
    this.acc = 0;
    this.lastQueueKey = '';
    this.lastLeadersKey = '';
    this.lastMarkersKey = '';
  }

  onRestart() {
    this.el.win.classList.remove('show');
    this.el.feed.innerHTML = '';
    this.lastMarkersKey = '';
  }

  setConnection(status) {
    const c = this.el.conn;
    const src = status.source === 'tiktok' ? 'TikTok' : 'TikFinity';
    if (status.connected) {
      c.textContent = `● ${src} bağlı${status.username ? ': @' + status.username : ''}`;
      c.className = 'ok';
    } else {
      c.textContent = `○ ${src}: ${status.error || 'bağlı değil'}`;
      c.className = 'off';
    }
  }

  update(g) {
    const s = g.settings;
    // Bar: solda -hedef (kaybetme), ortada 0, sağda +hedef (kazanma)
    const target = Math.max(1, s.targetMeters);
    const d = g.mode === 'dead' ? g.respawnX : g.vehicle.pos.x;
    const pct = Math.min(1, Math.max(0, (d + target) / (2 * target)));
    this.el.fill.style.left = `${Math.min(pct, 0.5) * 100}%`;
    this.el.fill.style.width = `${Math.abs(pct - 0.5) * 100}%`;
    this.el.fill.classList.toggle('neg', d < 0);
    this.el.car.style.left = `${pct * 100}%`;
    // geri sayım
    const cd = g.countdown;
    const cdKey = cd ? cd.type + Math.ceil(cd.t) : '';
    if (cdKey !== this.lastCd) {
      this.lastCd = cdKey;
      this.el.cd.className = cd ? 'show ' + cd.type : '';
      if (cd) {
        this.el.cdLbl.textContent = cd.type === 'win' ? '🏁 KAZANMAYA' : '💀 KAYBETMEYE';
        this.el.cdNum.textContent = Math.max(0, Math.ceil(cd.t));
        this.el.cdNum.classList.remove('pulse');
        void this.el.cdNum.offsetWidth;
        this.el.cdNum.classList.add('pulse');
      }
    }
    this.el.fuelFill.style.width = `${g.fuel}%`;
    this.el.fuelFill.style.background = g.fuel > 50 ? '#3ddc84' : g.fuel > 20 ? '#ffc93c' : '#ff4d4d';
    this.el.fuel.classList.toggle('empty', g.fuel <= 0);
    this.el.pause.classList.toggle('show', g.paused);

    this.acc++;
    if (this.acc % 6) return; // DOM metinlerini ~10Hz güncelle
    this.el.dist.textContent = `${d < 0 ? '−' : ''}${Math.abs(Math.trunc(d))} m`;
    this.el.target.textContent = `+${target} 🏁`;
    this.el.loseLabel.textContent = `💀 −${target}`;
    this.el.scoreW.textContent = `🏆 ${g.score.wins}`;
    this.el.scoreL.textContent = `💀 ${g.score.losses}`;
    this.el.fuelText.textContent = `%${Math.ceil(g.fuel)}`;
    this.el.timer.textContent = `⏱ ${fmtTime(g.elapsed)}  ·  Tur ${g.round}`;

    // aktif efekt ikonları
    const T = g.timers, icons = [];
    if (g.shield.hits > 0) icons.push(['🛡️', `${g.shield.hits}`]);
    if (T.boost > 0) icons.push(['🔥', T.boost]);
    if (T.nitro > 0) icons.push(['⚡', T.nitro]);
    if (T.wind > 0) icons.push([T.windDir > 0 ? '🌬️' : '🌪️', T.wind]);
    if (T.freeze > 0) icons.push(['🧊', T.freeze]);
    if (T.reverse > 0) icons.push(['⏪', T.reverse]);
    if (T.slowmo > 0) icons.push(['🐌', T.slowmo]);
    if (T.oil > 0) icons.push(['🛢️', T.oil]);
    if (T.quake > 0) icons.push(['🌋', T.quake]);
    if (T.size > 0) icons.push([g.vehicle.scale > 1 ? '🦖' : '🐜', T.size]);
    if (g.gravityMod) icons.push([{ low: '🪐', heavy: '🏋️', reverse: '🙃' }[g.gravityMod.type], g.gravityMod.t]);
    const popped = g.vehicle.wheels.filter((w) => w.popped).length;
    if (popped) icons.push(['🛞', `${popped} patlak`]);
    this.el.status.innerHTML = icons.filter(([, t]) => typeof t !== 'number' || t > 0.05).map(([i, t]) =>
      `<span class="chip">${i}<b>${typeof t === 'number' ? t.toFixed(1) + 's' : esc(t)}</b></span>`).join('');

    // kuyruk
    this.el.queue.style.display = s.showQueue ? '' : 'none';
    if (s.showQueue) {
      const items = g.queue.items.slice(0, 6);
      const key = items.map((j) => j.id + ':' + j.count).join(',') + '|' + g.queue.items.length;
      if (key !== this.lastQueueKey) {
        this.lastQueueKey = key;
        const more = g.queue.items.length - items.length;
        this.el.queueList.innerHTML = items.map((j) => {
          const m = ACTIONS[j.action];
          return `<li class="${m.type}">${avatarHtml(j.user)}<span class="ic">${m.icon}</span><span class="nm">${esc(m.name)}${j.count > 1 ? ` x${j.count}` : ''}</span></li>`;
        }).join('') + (more > 0 ? `<li class="more">+${more} daha</li>` : '');
        this.el.queue.classList.toggle('empty', !items.length);
      }
    }

    // liderlik
    this.el.leaders.style.display = s.showLeaderboard ? '' : 'none';
    if (s.showLeaderboard) {
      const top = [...g.leaders.values()].filter((l) => l.coins > 0 || l.actions > 0)
        .sort((a, b) => b.coins - a.coins || b.actions - a.actions).slice(0, 3);
      const key = top.map((l) => l.user.id + ':' + l.coins + ':' + l.actions).join(',');
      if (key !== this.lastLeadersKey) {
        this.lastLeadersKey = key;
        const medals = ['🥇', '🥈', '🥉'];
        this.el.leaders.innerHTML = top.length
          ? `<h4>En çok destek</h4>` + top.map((l, i) => `<div class="row">${medals[i]} ${avatarHtml(l.user)}<span class="nm">${esc(l.user.nickname)}</span><b>${l.coins ? l.coins + '💎' : l.actions + '×'}</b></div>`).join('')
          : '';
      }
    }

    // hedef barı üzerindeki işaretler
    if (s.progressMarkers) {
      const key = g.markers.map((m) => m.x.toFixed(0) + m.delta).join(',') + target;
      if (key !== this.lastMarkersKey) {
        this.lastMarkersKey = key;
        this.el.markers.innerHTML = g.markers.slice(-8).map((m) => {
          const left = Math.min(100, Math.max(0, ((m.x + target) / (2 * target)) * 100));
          return `<span class="mk ${m.delta >= 0 ? 'up' : 'down'}" style="left:${left}%">${m.icon}<i>${m.delta > 0 ? '+' : ''}${Math.round(m.delta)}</i></span>`;
        }).join('');
      }
    } else if (this.lastMarkersKey) {
      this.el.markers.innerHTML = '';
      this.lastMarkersKey = '';
    }
  }

  feed(ev, jobs) {
    if (document.body.dataset.showFeed === 'false') return;
    if (ev.kind === 'like' && !jobs.length) return;
    if (ev.kind === 'member' && !jobs.length) return;
    if (ev.kind === 'chat' && !jobs.length) return;
    const what = ev.kind === 'gift'
      ? `${ev.gift?.image ? `<img class="gift" src="${esc(ev.gift.image)}" referrerpolicy="no-referrer" alt="">` : '🎁'} ${esc(ev.gift?.name)}${ev.count > 1 ? ` <b>x${ev.count}</b>` : ''}`
      : { like: '❤️ beğendi', follow: '➕ takip etti', share: '🔗 paylaştı', subscribe: '⭐ abone oldu', member: '👋 katıldı', chat: `💬 ${esc(ev.comment)}` }[ev.kind] || ev.kind;
    const acts = jobs.map((j) => ACTIONS[j.action].icon).join(' ');
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `${avatarHtml(ev.user)}<span class="nm">${esc(ev.user?.nickname || '')}</span><span class="wh">${what}</span>${acts ? `<span class="ac">→ ${acts}</span>` : ''}`;
    this.el.feed.prepend(div);
    while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove();
    setTimeout(() => div.classList.add('fade'), 9000);
    setTimeout(() => div.remove(), 10000);
  }

  announce(text, color, user, small) {
    const div = document.createElement('div');
    div.className = 'ann' + (small ? ' small' : '');
    div.style.setProperty('--c', color || '#fff');
    div.innerHTML = `${user ? avatarHtml(user, 'av big') : ''}<span>${esc(text)}</span>`;
    this.el.announce.appendChild(div);
    while (this.el.announce.children.length > 3) this.el.announce.firstChild.remove();
    setTimeout(() => div.remove(), small ? 2400 : 3200);
  }

  showEnd(g, type) {
    const top = [...g.leaders.values()].sort((a, b) => b.coins - a.coins || b.actions - a.actions).slice(0, 5);
    const win = type === 'win';
    this.el.win.innerHTML = `
      <div class="box ${win ? 'win' : 'lose'}">
        <div class="t">${win ? '🏆 KAZANDIN!' : '💀 KAYBETTİN!'}</div>
        <div class="s">${win ? '+' : '−'}${g.settings.targetMeters} m · ${fmtTime(g.elapsed)}</div>
        <div class="s">🏆 Kazanma: <b>${g.score.wins}</b> · 💀 Kaybetme: <b>${g.score.losses}</b></div>
        ${top.length ? `<div class="list">${top.map((l, i) => `<div class="row">${['🥇', '🥈', '🥉', '4.', '5.'][i]} ${avatarHtml(l.user)} <span class="nm">${esc(l.user.nickname)}</span><b>${l.coins}💎</b></div>`).join('')}</div>` : ''}
        ${g.settings.autoRestartSeconds > 0 ? `<div class="s small">${g.settings.autoRestartSeconds} sn sonra yeni tur…</div>` : ''}
      </div>`;
    this.el.win.classList.add('show');
  }
}
