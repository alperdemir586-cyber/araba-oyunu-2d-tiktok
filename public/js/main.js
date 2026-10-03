// Oyunu başlatır; sunucu mesajlarını, panel komutlarını ve klavye kısayollarını bağlar.
import { Game } from './game.js';
import { Hud } from './hud.js';
import { Assets } from './assets.js';
import { Sound } from './audio.js';
import { Net } from './net.js';
import { loadConfig, ACTIONS } from './catalog.js';

const TEST_USER = { id: 'test', uniqueId: 'test', nickname: 'Test', avatar: '' };

async function boot() {
  const assets = new Assets();
  await assets.refresh();
  const config = await loadConfig();
  const sound = new Sound();
  sound.setCustomSounds(assets.list.sounds);
  const hud = new Hud();
  const game = new Game({ canvas: document.getElementById('game'), config, assets, sound, hud });
  game.setConfig(config);
  applyDisplay(config);
  window.game = game; // hata ayıklama için

  const net = new Net(async (msg) => {
    switch (msg.type) {
      case 'tiktok':
        game.handleEvent(msg.event);
        break;
      case 'status':
        hud.setConnection(msg.tiktok);
        break;
      case 'config-updated': {
        await assets.refresh();
        sound.setCustomSounds(assets.list.sounds);
        const cfg = await loadConfig();
        game.setConfig(cfg);
        applyDisplay(cfg);
        break;
      }
      case 'cmd':
        handleCommand(game, msg);
        break;
    }
  });

  // Panele durum bilgisi gönder
  setInterval(() => net.send({ type: 'state', state: game.snapshot() }), 500);

  // Ana döngü
  let last = performance.now();
  const loop = (now) => {
    game.frame((now - last) / 1000);
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Tarayıcılar sesi ilk etkileşime kadar engeller
  const unlock = () => { sound.ensure(); sound.ctx?.resume(); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // Klavye kısayolları (yayıncı testleri)
  const keys = {
    Digit1: 'boost', Digit2: 'nitro', Digit3: 'jump', Digit4: 'rocket', Digit5: 'bomb',
    Digit6: 'popTire', Digit7: 'explode', Digit8: 'changeVehicle', Digit9: 'changeMap', Digit0: 'refuel',
    KeyM: 'missile', KeyK: 'shield', KeyT: 'tornado', KeyE: 'meteor', KeyQ: 'teleport',
  };
  // Sürüş tuşları: → / D gaz, ← / A geri, ↑ / W geriye eğil, ↓ / S öne eğil
  const drive = {
    ArrowRight: 'right', KeyD: 'right', ArrowLeft: 'left', KeyA: 'left',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  };
  window.addEventListener('keyup', (e) => {
    const k = drive[e.code];
    if (k) game.input[k] = false;
  });
  window.addEventListener('blur', () => { for (const k in game.input) game.input[k] = false; });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select')) return;
    const k = drive[e.code];
    if (k) { game.input[k] = true; e.preventDefault(); return; }
    if (e.repeat) return;
    if (e.code === 'KeyP') { game.paused = !game.paused; e.preventDefault(); return; }
    if (e.code === 'KeyR' && e.shiftKey) { game.restart(); return; }
    if (e.code === 'F2' || e.code === 'Tab') { togglePanel(); e.preventDefault(); return; }
    if (e.code === 'KeyH') { document.body.classList.toggle('hide-ui'); return; }
    const action = keys[e.code];
    if (action) queueTest(game, action);
  });
  document.getElementById('panel-btn').addEventListener('click', togglePanel);
}

function togglePanel() {
  const f = document.getElementById('panel-frame');
  if (!f.src) f.src = 'panel.html?embedded=1';
  f.hidden = !f.hidden;
}

function applyDisplay(cfg) {
  document.body.dataset.showFeed = String(cfg.settings.showFeed);
  document.getElementById('feed').style.display = cfg.settings.showFeed ? '' : 'none';
}

let testSeq = 0;
function queueTest(game, action, params = {}, count = 1, user = TEST_USER) {
  game.queue.push({
    id: 't' + ++testSeq, action, params: { ...ACTIONS[action].params, ...params },
    count, priority: 1, user, ts: performance.now() / 1000,
  });
}

function handleCommand(game, msg) {
  switch (msg.cmd) {
    case 'action':
      if (ACTIONS[msg.action]) queueTest(game, msg.action, msg.params, msg.count || 1, msg.user || TEST_USER);
      break;
    case 'event':
      game.handleEvent(msg.event);
      break;
    case 'pause': game.paused = true; break;
    case 'resume': game.paused = false; break;
    case 'togglePause': game.paused = !game.paused; break;
    case 'restart': game.restart(); break;
    case 'resetScore': game.resetScore(); break;
    case 'clearQueue': game.queue.clear(); break;
    case 'fuel': game.fuel = Math.max(0, Math.min(100, Number(msg.value))); break;
  }
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;top:0;left:0;color:#fff;background:#900;padding:12px;z-index:99">${String(err?.stack || err)}</pre>`);
});
