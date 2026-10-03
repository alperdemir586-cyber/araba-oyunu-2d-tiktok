// Yayıncı paneli: TikTok bağlantısı, kural editörü, test/stres, ayarlar ve görsel atamaları.
import {
  ACTIONS, PARAM_LABELS, TRIGGERS, DEFAULT_SETTINGS, defaultConfig, defaultRules, loadConfig, saveConfig, mergeConfig,
} from './catalog.js';
import { VEHICLES, makeCustomVehicle } from './vehicles.js';
import { MAPS } from './maps.js';
import { Driver } from './driver.js';
import { Net } from './net.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

let config = defaultConfig();
let assets = { cars: [], backgrounds: [], ground: [], gifts: [], sounds: [] };
let gifts = { folder: [], live: [] };

const net = new Net((msg) => {
  if (msg.type === 'status') renderStatus(msg.tiktok);
  if (msg.type === 'state') renderState(msg.state);
});

// ---------------- Kaydetme ----------------
let saveTimer = null;
function save() {
  $('#save-state').textContent = 'Kaydediliyor…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveConfig(config);
      $('#save-state').textContent = 'Kaydedildi ✓';
    } catch {
      $('#save-state').textContent = 'Kaydedilemedi ✕';
    }
  }, 400);
}

// ---------------- Sekmeler ----------------
$$('#tabs button').forEach((b) => b.addEventListener('click', () => {
  $$('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab));
}));
if (new URLSearchParams(location.search).has('embedded')) {
  $('#close-panel').hidden = false;
  $('#close-panel').addEventListener('click', () => { window.frameElement.hidden = true; });
}

// ---------------- Kontrol ----------------
function renderStatus(st) {
  const el = $('#tt-status');
  const src = st.source === 'tiktok' ? 'TikTok' : 'TikFinity';
  el.textContent = st.connected ? `● ${src} bağlı${st.username ? ': @' + st.username : ''}` : `${src}: ${st.error || 'Bağlı değil'}`;
  el.className = st.connected ? 'ok' : 'muted';
}

function updateSourceUi() {
  const tf = $('#live-source').value === 'tikfinity';
  $('#tf-url').hidden = !tf;
  $('#tt-user').hidden = tf;
}
$('#live-source').addEventListener('change', updateSourceUi);
$('#hook-url').textContent = `${location.origin}/api/trigger?action=nitro&user={nickname}`;

const ACTION_NAME = (a) => `${ACTIONS[a]?.icon || ''} ${ACTIONS[a]?.name || a}`;
function renderState(s) {
  const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  $('#state').innerHTML = `
    <div><b>${Math.floor(s.distance)}</b> / ${s.target} m</div>
    <div>⛽ %${Math.ceil(s.fuel)}</div>
    <div>${s.paused ? '⏸ Duraklatıldı' : { drive: '🚗 Sürüyor', flight: '🛫 Uçuşta', dead: '💥 Patladı', win: '🏁 Kazanıldı' }[s.mode] || s.mode}</div>
    <div>🚙 ${esc(VEHICLES[s.vehicle]?.name || s.vehicle)}</div>
    <div>🗺️ ${esc(MAPS[s.map]?.name || s.map)}</div>
    <div>⏱ ${fmt(s.elapsed)} · Tur ${s.round}</div>
    <div>📋 Kuyruk: ${s.queueLength}${s.dropped ? ` (düşen: ${s.dropped})` : ''}</div>
    <div>🛡️ ${s.shield}</div>
    <div>🏆 ${s.score?.wins ?? 0} · 💀 ${s.score?.losses ?? 0}</div>
    ${s.countdown ? `<div>${s.countdown.type === 'win' ? '🏁 Kazanmaya' : '💀 Kaybetmeye'} ${Math.ceil(s.countdown.t)} sn</div>` : ''}
    ${s.passenger ? `<div>💺 ${esc(s.passenger)}</div>` : ''}`;
  $('#queue-list').innerHTML = s.queue.map((q) => `<li>${ACTION_NAME(q.action)}${q.count > 1 ? ' x' + q.count : ''} <span class="muted">${esc(q.user)}</span></li>`).join('') || '<li class="muted">Boş</li>';
}

$('#tt-connect').addEventListener('click', () => {
  const source = $('#live-source').value;
  const url = $('#tf-url').value.trim() || 'ws://localhost:21213/';
  const username = $('#tt-user').value.trim();
  if (source === 'tiktok' && !username) return;
  Object.assign(config.settings, { liveSource: source, tikfinityUrl: url, tiktokUsername: username });
  save();
  net.send({ type: 'live-connect', source, url, username });
});
$('#tt-disconnect').addEventListener('click', () => net.send({ type: 'live-disconnect' }));
$('#reset-score').addEventListener('click', () => {
  if (confirm('Kazanma/kaybetme skoru sıfırlansın mı?')) net.send({ type: 'cmd', cmd: 'resetScore' });
});
$$('[data-cmd]').forEach((b) => b.addEventListener('click', () => net.send({ type: 'cmd', cmd: b.dataset.cmd })));
$('#fill-fuel').addEventListener('click', () => net.send({ type: 'cmd', cmd: 'fuel', value: 100 }));

// ---------------- Kurallar ----------------
function actionOptions(selected) {
  const groups = { good: 'Yardım', bad: 'Sabotaj', fun: 'Değişim / Eğlence' };
  return Object.entries(groups).map(([type, label]) => `<optgroup label="${label}">${
    Object.entries(ACTIONS).filter(([, a]) => a.type === type)
      .map(([k, a]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')
  }</optgroup>`).join('');
}

function paramInputs(rule) {
  const meta = ACTIONS[rule.action];
  return Object.keys(meta.params).map((k) => {
    const val = rule.params?.[k] ?? meta.params[k];
    const label = PARAM_LABELS[k] || k;
    let opts = meta.options?.[k];
    if (typeof opts === 'function') opts = opts();
    if (opts) {
      return `<label>${label}<select data-param="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
    }
    const type = typeof meta.params[k] === 'number' ? 'number' : 'text';
    return `<label>${label}<input data-param="${k}" type="${type}" step="any" value="${esc(val)}" style="width:${type === 'number' ? '5em' : '4em'}"></label>`;
  }).join('');
}

function triggerInput(rule) {
  const t = rule.trigger;
  if (t.type === 'gift') {
    return `<input data-t="gift" list="gift-names" placeholder="Hediye adı veya ID" value="${esc(t.gift || '')}">
      <label title="Bu adetten az gelirse tetiklenmez">min<input data-t="minCount" type="number" min="0" value="${esc(t.minCount || '')}" style="width:4em"></label>`;
  }
  if (t.type === 'like') return `<label>her<input data-t="every" type="number" min="1" value="${esc(t.every || 50)}" style="width:5em">beğenide</label>`;
  if (t.type === 'chat') return `<input data-t="keyword" placeholder="!komut" value="${esc(t.keyword || '')}" style="width:8em">`;
  return '';
}

function giftThumb(name) {
  const n = String(name || '').toLowerCase();
  const g = [...gifts.live, ...gifts.folder].find((x) => String(x.name).toLowerCase() === n || String(x.id) === n);
  return g?.image ? `<img class="thumb" src="${esc(g.image)}" alt="" referrerpolicy="no-referrer">` : '';
}

function renderRules() {
  const box = $('#rules');
  box.innerHTML = '';
  config.rules.forEach((rule, idx) => {
    const meta = ACTIONS[rule.action] || ACTIONS.boost;
    const el = h(`
      <div class="rule ${meta.type} ${rule.enabled ? '' : 'off'}">
        <div class="line">
          <input type="checkbox" data-k="enabled" ${rule.enabled ? 'checked' : ''} title="Aktif">
          ${rule.trigger.type === 'gift' ? giftThumb(rule.trigger.gift) : ''}
          <select data-k="type">${Object.entries(TRIGGERS).map(([k, n]) => `<option value="${k}" ${k === rule.trigger.type ? 'selected' : ''}>${n}</option>`).join('')}</select>
          ${triggerInput(rule)}
          <span class="arrow">→</span>
          <select data-k="action">${actionOptions(rule.action)}</select>
          ${paramInputs(rule)}
        </div>
        <div class="line small">
          <label title="Yüksek öncelikli işler kuyrukta öne geçer">Öncelik<select data-k="priority">${[0, 1, 2, 3].map((p) => `<option ${Number(rule.priority) === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
          <label title="Kuralın genel bekleme süresi">Bekleme<input data-k="cooldown" type="number" min="0" step="any" value="${rule.cooldown || 0}" style="width:4em">sn</label>
          <label title="Aynı kişi için bekleme">Kişi başı<input data-k="userCooldown" type="number" min="0" step="any" value="${rule.userCooldown || 0}" style="width:4em">sn</label>
          <label title="Kombo/çoklu hediyede kaç kez tekrar">Maks. tekrar<input data-k="maxRepeat" type="number" min="1" value="${rule.maxRepeat || ''}" placeholder="${config.settings.maxRepeat}" style="width:4em"></label>
          <label><input type="checkbox" data-k="repeatOnce" ${rule.repeat === 'once' ? 'checked' : ''}>Adetten bağımsız 1 kez</label>
          <label><input type="checkbox" data-k="oncePerUser" ${rule.oncePerUser ? 'checked' : ''}>Kişi başı bir kez</label>
          <span class="spacer"></span>
          <button data-act="test" class="ghost small" title="Bu eylemi dene">▶</button>
          <button data-act="up" class="ghost small" title="Yukarı">↑</button>
          <button data-act="del" class="ghost small danger" title="Sil">🗑</button>
        </div>
      </div>`);
    el.addEventListener('change', (e) => {
      const t = e.target;
      let rerender = false;
      if (t.dataset.k === 'enabled') rule.enabled = t.checked;
      else if (t.dataset.k === 'type') { rule.trigger = { type: t.value }; if (t.value === 'like') rule.trigger.every = 50; rerender = true; }
      else if (t.dataset.k === 'action') { rule.action = t.value; rule.params = { ...ACTIONS[t.value].params }; rerender = true; }
      else if (t.dataset.k === 'priority') rule.priority = Number(t.value);
      else if (t.dataset.k === 'cooldown') rule.cooldown = Number(t.value) || 0;
      else if (t.dataset.k === 'userCooldown') rule.userCooldown = Number(t.value) || 0;
      else if (t.dataset.k === 'maxRepeat') rule.maxRepeat = Number(t.value) || undefined;
      else if (t.dataset.k === 'repeatOnce') rule.repeat = t.checked ? 'once' : undefined;
      else if (t.dataset.k === 'oncePerUser') rule.oncePerUser = t.checked;
      else if (t.dataset.t) {
        const v = t.type === 'number' ? Number(t.value) || 0 : t.value.trim();
        rule.trigger[t.dataset.t] = v;
        if (t.dataset.t === 'gift') rerender = true;
      } else if (t.dataset.param) {
        const def = ACTIONS[rule.action].params[t.dataset.param];
        rule.params = { ...rule.params, [t.dataset.param]: typeof def === 'number' ? Number(t.value) : t.value };
      }
      save();
      if (rerender) renderRules();
      else el.classList.toggle('off', !rule.enabled);
    });
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'del') { config.rules.splice(idx, 1); save(); renderRules(); }
      if (act === 'up' && idx > 0) { [config.rules[idx - 1], config.rules[idx]] = [config.rules[idx], config.rules[idx - 1]]; save(); renderRules(); }
      if (act === 'test') net.send({ type: 'cmd', cmd: 'action', action: rule.action, params: rule.params });
    });
    box.appendChild(el);
  });
}

$('#add-rule').addEventListener('click', () => {
  config.rules.unshift({
    id: 'r' + Date.now().toString(36), enabled: true, trigger: { type: 'gift', gift: '' },
    action: 'boost', params: { ...ACTIONS.boost.params }, priority: 1, cooldown: 0,
  });
  save(); renderRules();
});
$('#reset-rules').addEventListener('click', () => {
  if (!confirm('Tüm kurallar varsayılanlara dönsün mü?')) return;
  config.rules = defaultRules();
  save(); renderRules();
});

function renderGifts() {
  const all = [...gifts.live, ...gifts.folder];
  const names = [...new Set(all.map((g) => g.name))];
  $('#gift-names').innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');
  $('#gift-grid').innerHTML = all.length
    ? all.map((g) => `<button class="gift" data-name="${esc(g.name)}" title="${esc(g.name)}${g.diamonds ? ' · ' + g.diamonds + '💎' : ''} (${g.source})">
        ${g.image ? `<img src="${esc(g.image)}" alt="" referrerpolicy="no-referrer">` : '🎁'}<span>${esc(g.name)}</span>${g.diamonds ? `<i>${g.diamonds}💎</i>` : ''}</button>`).join('')
    : '<p class="muted">Hediye bulunamadı. Hediye görsellerini <code>assets/gifts</code> klasörüne koyun ya da TikTok\'a bağlanın.</p>';
}
$('#gift-grid').addEventListener('click', (e) => {
  const b = e.target.closest('.gift');
  if (!b) return;
  config.rules.unshift({
    id: 'r' + Date.now().toString(36), enabled: true, trigger: { type: 'gift', gift: b.dataset.name },
    action: 'boost', params: { ...ACTIONS.boost.params }, priority: 1, cooldown: 0,
  });
  save(); renderRules();
  $('#rules').scrollIntoView({ behavior: 'smooth' });
});

// ---------------- Test ----------------
let simSeq = 0;
const simUser = (name) => ({ id: 'sim-' + name, uniqueId: name, nickname: name, avatar: '' });
const sendEvent = (event) => net.send({ type: 'cmd', cmd: 'event', event: { ts: Date.now(), ...event } });
const giftEvent = (name, count, user) => {
  const g = [...gifts.live, ...gifts.folder].find((x) => String(x.name).toLowerCase() === String(name).toLowerCase());
  return { kind: 'gift', user: simUser(user), count, gift: { id: g?.id ?? name, name, diamonds: g?.diamonds || 1, image: g?.image || '' } };
};

$('#sim-send').addEventListener('click', () => {
  sendEvent(giftEvent($('#sim-gift').value.trim() || 'Rose', Math.max(1, Number($('#sim-count').value) || 1), $('#sim-user').value.trim() || 'izleyici'));
});
$$('[data-sim]').forEach((b) => b.addEventListener('click', () => {
  const user = simUser($('#sim-user').value.trim() || 'izleyici' + (++simSeq));
  const kind = b.dataset.sim;
  if (kind === 'like') sendEvent({ kind, user, count: 15 });
  else if (kind === 'chat') sendEvent({ kind, user, count: 1, comment: '!zıpla' });
  else sendEvent({ kind, user: kind === 'follow' ? simUser('takipci' + (++simSeq)) : user, count: 1 });
}));

$$('[data-stress]').forEach((b) => b.addEventListener('click', () => {
  const kind = b.dataset.stress;
  const giftRules = config.rules.filter((r) => r.enabled && r.trigger.type === 'gift' && r.trigger.gift);
  if (kind === 'likes') for (let i = 0; i < 50; i++) sendEvent({ kind: 'like', user: simUser('begenen' + i), count: 1 + Math.floor(Math.random() * 15) });
  if (kind === 'explode') for (let i = 0; i < 10; i++) net.send({ type: 'cmd', cmd: 'action', action: 'explode', user: simUser('patlatici' + i) });
  if (kind === 'mixed') {
    for (let i = 0; i < 100; i++) {
      const r = giftRules[Math.floor(Math.random() * giftRules.length)];
      if (r) setTimeout(() => sendEvent(giftEvent(r.trigger.gift, 1 + Math.floor(Math.random() * 3), 'kisi' + (i % 25))), i * 30);
    }
  }
  if (kind === 'crowd') {
    for (let i = 0; i < 20; i++) {
      const r = giftRules[i % Math.max(1, giftRules.length)];
      if (r) sendEvent(giftEvent(r.trigger.gift, 1, 'kalabalik' + i));
    }
  }
  if (kind === 'bad') {
    Object.entries(ACTIONS).filter(([, a]) => a.type === 'bad').forEach(([k], i) =>
      net.send({ type: 'cmd', cmd: 'action', action: k, user: simUser('sabotajci' + i) }));
  }
}));

function renderActionButtons() {
  const groups = { good: 'Yardım', bad: 'Sabotaj', fun: 'Değişim / Eğlence' };
  $('#action-buttons').innerHTML = Object.entries(groups).map(([type, label]) => `
    <h4>${label}</h4><div class="row wrap">${Object.entries(ACTIONS).filter(([, a]) => a.type === type)
      .map(([k, a]) => `<button class="act ${type}" data-action="${k}">${a.icon} ${esc(a.name)}</button>`).join('')}</div>`).join('');
}
$('#action-buttons').addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (b) net.send({ type: 'cmd', cmd: 'action', action: b.dataset.action });
});

// ---------------- Ayarlar ----------------
const vehicleOpts = () => [...Object.entries(VEHICLES).map(([k, v]) => [k, v.name]),
  ...Object.entries(config.customVehicles).filter(([, c]) => c.enabled).map(([k, c]) => ['custom:' + k, '📷 ' + (c.name || k)])];
const mapOpts = () => Object.entries(MAPS).map(([k, m]) => [k, m.name]);

const SETTING_DEFS = [
  ['Sürüş'],
  ['controlMode', 'Araç kontrolü', 'select', [['keyboard', 'Klavye (yayıncı sürer)'], ['auto', 'Otomatik (araç kendi gider)']]],
  ['flipRecoverSeconds', 'Ters kalınca kendiliğinden düzelme (sn)', 'number', { min: 0.5, step: 0.5 }],
  ['Hedef ve ilerleme'],
  ['targetMeters', 'Kazanma mesafesi (m) — geride aynı mesafe kaybetme sınırı', 'number', { min: 50, step: 50 }],
  ['winCountdown', 'Kazanma geri sayımı (sn)', 'number', { min: 1 }],
  ['loseCountdown', 'Kaybetme geri sayımı (sn)', 'number', { min: 1 }],
  ['cruiseSpeed', 'Normal hız (m/sn)', 'number', { min: 1, max: 30, step: 0.5 }],
  ['difficulty', 'Yokuş zorluğu (0–3)', 'number', { min: 0, max: 3, step: 0.1 }],
  ['startVehicle', 'Başlangıç aracı', 'select', vehicleOpts],
  ['startMap', 'Başlangıç haritası', 'select', mapOpts],
  ['autoMapEvery', 'Her N metrede harita değişsin (0 = kapalı)', 'number', { min: 0, step: 50 }],
  ['autoRestartSeconds', 'Tur bitince yeni tur (sn, 0 = elle)', 'number', { min: 0 }],
  ['Yolcu koltuğu'],
  ['passengerMinDiamonds', 'Yolcu olmak için en az elmas', 'number', { min: 1 }],
  ['passengerSeconds', 'Yolcu koltuğunda kalma süresi (sn, 0 = kapalı)', 'number', { min: 0 }],
  ['Benzin'],
  ['fuelRangeMeters', 'Dolu depo kaç metre gider', 'number', { min: 10, step: 10 }],
  ['emptySpeedPercent', 'Benzin bitince hız (% normal)', 'number', { min: 0, max: 100 }],
  ['fuelCanEvery', 'Yolda benzin bidonu aralığı (m, 0 = yok)', 'number', { min: 0, step: 10 }],
  ['fuelCanPercent', 'Bidon başına benzin (%)', 'number', { min: 1, max: 100 }],
  ['Engeller ve fizik'],
  ['randomHazards', 'Yolda rastgele engeller olsun', 'checkbox'],
  ['hazardEvery', 'Rastgele engel aralığı (m)', 'number', { min: 10, step: 10 }],
  ['respawnSeconds', 'Patlayınca yeniden doğma süresi (sn)', 'number', { min: 0.5, step: 0.5 }],
  ['explodePenalty', 'Patlamada varsayılan geri ceza (m)', 'number', { min: 0 }],
  ['tireRepairSeconds', 'Patlak teker kendiliğinden tamir (sn, 0 = asla)', 'number', { min: 0 }],
  ['antiStuck', 'Takılınca hafifçe it (yalnızca otomatik sürüşte)', 'checkbox'],
  ['airControl', 'Havada denge yardımı (az takla)', 'checkbox'],
  ['Kuyruk'],
  ['exclusiveGap', 'Özel eylemler arası bekleme (sn)', 'number', { min: 0, step: 0.1 }],
  ['maxQueue', 'Maksimum kuyruk uzunluğu', 'number', { min: 5 }],
  ['maxRepeat', 'Bir hediye/komboda maks. tekrar', 'number', { min: 1 }],
  ['Görünüm ve ses'],
  ['viewerTagSeconds', 'İzleyici adı/fotoğrafı süresi (sn, 0 = kapalı)', 'number', { min: 0, step: 0.5 }],
  ['showAvatars', 'Profil fotoğraflarını göster', 'checkbox'],
  ['showQueue', 'Kuyruğu göster', 'checkbox'],
  ['showLeaderboard', 'Liderlik tablosunu göster', 'checkbox'],
  ['showFeed', 'Olay akışını göster', 'checkbox'],
  ['progressMarkers', 'Hedef barında hediye işaretleri', 'checkbox'],
  ['zoom', 'Kamera yakınlığı', 'number', { min: 0.4, max: 2.5, step: 0.1 }],
  ['sound', 'Ses efektleri', 'checkbox'],
  ['volume', 'Ses seviyesi', 'range', { min: 0, max: 1, step: 0.05 }],
];

function renderSettings() {
  const s = config.settings;
  $('#settings').innerHTML = SETTING_DEFS.map(([key, label, type, o = {}]) => {
    if (!label) return `<h3>${key}</h3>`;
    const v = s[key] ?? DEFAULT_SETTINGS[key];
    if (type === 'checkbox') return `<label class="f chk"><input type="checkbox" data-s="${key}" ${v ? 'checked' : ''}><span>${label}</span></label>`;
    if (type === 'select') {
      const opts = typeof o === 'function' ? o() : o;
      return `<label class="f"><span>${label}</span><select data-s="${key}">${opts.map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
    }
    const attrs = Object.entries(o).map(([a, b]) => `${a}="${b}"`).join(' ');
    return `<label class="f"><span>${label}</span><input type="${type}" data-s="${key}" value="${esc(v)}" ${attrs}></label>`;
  }).join('');
}
$('#settings').addEventListener('change', (e) => {
  const t = e.target, k = t.dataset.s;
  if (!k) return;
  config.settings[k] = t.type === 'checkbox' ? t.checked : (t.type === 'number' || t.type === 'range') ? Number(t.value) : t.value;
  save();
});

$('#export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }));
  a.download = 'araba-oyunu-ayarlar.json';
  a.click();
});
$('#import').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    config = mergeConfig(JSON.parse(await f.text()));
    save(); renderAll();
  } catch { alert('Dosya okunamadı'); }
});
$('#factory').addEventListener('click', () => {
  if (!confirm('Tüm ayarlar, kurallar ve görsel atamaları sıfırlansın mı?')) return;
  config = defaultConfig();
  save(); renderAll();
});

// ---------------- Görseller ----------------
function renderMapVisuals() {
  const opt = (list, cur) => `<option value="">(çizilmiş varsayılan)</option>` +
    list.map((f) => `<option value="${esc(f.url)}" ${f.url === cur ? 'selected' : ''}>${esc(f.file)}</option>`).join('');
  $('#map-visuals').innerHTML = Object.entries(MAPS).map(([id, m]) => {
    const c = config.maps[id] || {};
    return `<div class="mapvis" data-map="${id}">
      <b>${esc(m.name)}</b>
      <label>Arka plan<select data-m="background">${opt(assets.backgrounds, c.background)}</select></label>
      <label>Zemin<select data-m="ground">${opt(assets.ground, c.ground)}</select></label>
      <label title="Şerit: görselin üst kenarı yokuşu takip eder (çim/toprak şeridi). Desen: görsel tekrar eden doku olarak döşenir.">Mod
        <select data-m="groundMode"><option value="strip" ${c.groundMode !== 'pattern' ? 'selected' : ''}>Şerit</option><option value="pattern" ${c.groundMode === 'pattern' ? 'selected' : ''}>Desen</option></select></label>
      <label title="Zemin görselinin genişliği kaç metreye karşılık gelsin">Genişlik (m)<input data-m="groundMeters" type="number" min="0.5" step="0.5" value="${c.groundMeters || 4}" style="width:4em"></label>
    </div>`;
  }).join('');
}
$('#map-visuals').addEventListener('change', (e) => {
  const row = e.target.closest('[data-map]');
  const id = row.dataset.map, k = e.target.dataset.m;
  config.maps[id] = { ...(config.maps[id] || {}), [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value };
  save();
});

const CAR_FIELDS = [
  ['name', 'Ad', 'text'], ['width', 'Uzunluk (m)', 'number', 0.5], ['openTop', 'Üstü/camı açık (sürücü görünsün)', 'checkbox'],
  ['rearX', 'Arka teker X (0–1)', 'number', 0.01], ['frontX', 'Ön teker X (0–1)', 'number', 0.01],
  ['wheelY', 'Teker yüksekliği (0–1)', 'number', 0.01], ['wheelRadius', 'Teker yarıçapı (m, 0 = otomatik)', 'number', 0.05],
  ['seatX', 'Koltuk X (0–1)', 'number', 0.01], ['seatY', 'Koltuk Y (0–1)', 'number', 0.01], ['driverScale', 'Sürücü boyutu', 'number', 0.05],
  ['torque', 'Motor gücü (0.5–1.5)', 'number', 0.05], ['speed', 'Hız çarpanı', 'number', 0.05], ['suspension', 'Süspansiyon sertliği (Hz)', 'number', 0.1],
  ['hideWheels', 'Tekerleri çizme (görselde var)', 'checkbox'], ['wheelFile', 'Teker görseli', 'wheel'],
];
const CAR_DEFAULT = { enabled: false, width: 4, openTop: false, rearX: 0.2, frontX: 0.8, wheelY: 0.18, wheelRadius: 0, seatX: 0.45, seatY: 0.45, driverScale: 1, torque: 1, speed: 1, suspension: 4, hideWheels: false, wheelFile: '' };

const images = new Map();
function img(url, onload) {
  let i = images.get(url);
  if (!i) { i = new Image(); i.src = url; images.set(url, i); }
  if (!i.complete) i.addEventListener('load', onload, { once: true });
  return i;
}

function renderCustomCars() {
  const box = $('#custom-cars');
  if (!assets.cars.length) { box.innerHTML = '<p class="muted">Klasörde araç görseli yok. <code>assets/cars</code> içine PNG koyup sayfayı yenileyin.</p>'; return; }
  box.innerHTML = '';
  for (const f of assets.cars) {
    const c = { ...CAR_DEFAULT, name: f.name, ...(config.customVehicles[f.file] || {}), file: f.file };
    const el = h(`<div class="car ${c.enabled ? '' : 'off'}">
      <div class="car-head"><label class="chk"><input type="checkbox" data-c="enabled" ${c.enabled ? 'checked' : ''}> <b>${esc(f.file)}</b></label>
      <button class="ghost small" data-try>▶ Oyunda dene</button></div>
      <canvas width="460" height="230"></canvas>
      <div class="car-fields">${CAR_FIELDS.map(([k, label, type, step]) => {
        if (type === 'checkbox') return `<label class="chk"><input type="checkbox" data-c="${k}" ${c[k] ? 'checked' : ''}>${label}</label>`;
        if (type === 'wheel') return `<label>${label}<select data-c="${k}"><option value="">(çizilmiş)</option>${assets.cars.map((w) => `<option ${w.file === c[k] ? 'selected' : ''}>${esc(w.file)}</option>`).join('')}</select></label>`;
        return `<label>${label}<input data-c="${k}" type="${type}" ${step ? `step="${step}"` : ''} value="${esc(c[k])}"></label>`;
      }).join('')}</div></div>`);
    const canvas = $('canvas', el);
    const draw = () => drawCarPreview(canvas, c, f.url);
    el.addEventListener('input', (e) => {
      const t = e.target, k = t.dataset.c;
      if (!k) return;
      c[k] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value;
      config.customVehicles[f.file] = { ...c };
      el.classList.toggle('off', !c.enabled);
      draw();
      save();
    });
    $('[data-try]', el).addEventListener('click', () => {
      config.customVehicles[f.file] = { ...c, enabled: true };
      $('[data-c="enabled"]', el).checked = true;
      el.classList.remove('off');
      saveConfig(config).then(() => setTimeout(() => net.send({ type: 'cmd', cmd: 'action', action: 'changeVehicle', params: { vehicle: 'custom:' + f.file } }), 300));
    });
    box.appendChild(el);
    draw();
  }
}

const previewDriver = new Driver();
function drawCarPreview(canvas, c, url) {
  const ctx = canvas.getContext('2d');
  const image = img(url, () => drawCarPreview(canvas, c, url));
  const wheelEntry = assets.cars.find((x) => x.file === c.wheelFile);
  const wheelImage = wheelEntry ? img(wheelEntry.url, () => drawCarPreview(canvas, c, url)) : null;
  const def = makeCustomVehicle(c.file, c, image, wheelImage);
  const ppm = Math.min(canvas.width / (c.width + 1.5), 90);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1b2036'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const groundY = canvas.height - 30;
  const wheelBottom = Math.min(...def.wheels.map((w) => w.y - w.r));
  ctx.fillStyle = '#3c8f22'; ctx.fillRect(0, groundY, canvas.width, 30);
  ctx.save();
  ctx.translate(canvas.width / 2, groundY + wheelBottom * ppm);
  ctx.scale(ppm, -ppm);
  def.back(ctx);
  if (def.openTop) previewDriver.draw(ctx, def, performance.now() / 1000);
  def.front(ctx);
  if (!def.hideWheels) {
    for (const w of def.wheels) {
      if (wheelImage?.naturalWidth) {
        ctx.save(); ctx.translate(w.x, w.y); ctx.scale(1, -1);
        ctx.drawImage(wheelImage, -w.r, -w.r, w.r * 2, w.r * 2); ctx.restore();
      } else {
        ctx.fillStyle = '#1d1d1f'; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.arc(w.x, w.y, w.r * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // fizik gövdesi (yardımcı çizgi)
  ctx.strokeStyle = 'rgba(255,80,80,0.7)'; ctx.lineWidth = 0.02; ctx.setLineDash([0.08, 0.06]);
  ctx.beginPath(); def.chassis.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
  ctx.restore();
}

// ---------------- Başlat ----------------
function renderAll() {
  $('#tt-user').value = config.settings.tiktokUsername || '';
  $('#live-source').value = config.settings.liveSource || 'tikfinity';
  $('#tf-url').value = config.settings.tikfinityUrl || 'ws://localhost:21213/';
  updateSourceUi();
  renderRules();
  renderGifts();
  renderSettings();
  renderMapVisuals();
  renderCustomCars();
}

(async () => {
  renderActionButtons();
  config = await loadConfig();
  assets = await fetch('/api/assets').then((r) => r.json()).catch(() => assets);
  renderAll();
  $('#save-state').textContent = 'Hazır';
  gifts = await fetch('/api/gifts').then((r) => r.json()).catch(() => gifts);
  renderGifts();
  renderRules();
})();
