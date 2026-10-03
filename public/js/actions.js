// Her eylemin oyun içindeki etkisi. job: { action, params, count, user }
import { ACTIONS } from './catalog.js';
import { VEHICLE_IDS } from './vehicles.js';
import { MAP_IDS } from './maps.js';

const pickOther = (list, cur) => {
  const others = list.filter((x) => x !== cur);
  return others[Math.floor(Math.random() * others.length)] || cur;
};
const nextOf = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function runAction(g, job) {
  const meta = ACTIONS[job.action];
  const p = job.params || {};
  const n = Math.max(1, job.count || 1);
  const v = g.vehicle;
  const pos = v.pos;
  const fx = g.effects;
  const who = job.user?.nickname || '';

  // Sabotajlar kalkana takılabilir (mermiler kendi çarpışmasında kontrol eder)
  const projectile = ['bomb', 'missile', 'meteor'].includes(job.action);
  if (meta.type === 'bad' && !projectile && g.mode === 'drive' && g.consumeShield(pos.x, pos.y + 1)) return;

  switch (job.action) {
    case 'boost': {
      const sec = Math.min(20, num(p.seconds, 3) * n);
      g.timers.boost = Math.min(25, g.timers.boost + sec);
      g.timers.boostPower = Math.max(g.timers.boostPower || 0, num(p.power, 1));
      g.sound.play('boost');
      g.driver.setMood('happy', 2);
      fx.text(pos.x, pos.y + 2.5, `🔥 BOOST${n > 1 ? ' x' + n : ''}`, '#ffb22e');
      break;
    }
    case 'nitro': {
      g.timers.nitro = Math.min(15, g.timers.nitro + num(p.seconds, 1.5) * n);
      g.sound.play('nitro');
      g.driver.setMood('happy', 2);
      fx.flash('#9be8ff', 0.25);
      fx.text(pos.x, pos.y + 2.5, `⚡ NİTRO${n > 1 ? ' x' + n : ''}`, '#7fdcff');
      break;
    }
    case 'jump':
    case 'superJump': {
      const power = num(p.power, job.action === 'jump' ? 1 : 2.2) * Math.sqrt(Math.min(n, 4));
      v.applyImpulse(v.mass * 1.5 * power, v.mass * 7 * power);
      g.sound.play('jump');
      for (const w of v.wheels) { const wp = w.body.getPosition(); for (let i = 0; i < 6; i++) fx.dust(wp.x, wp.y - w.radius); }
      fx.text(pos.x, pos.y + 2.5, job.action === 'jump' ? '🦘 ZIPLA!' : '🚀 SÜPER ZIPLAMA!', '#a0ff8a');
      break;
    }
    case 'rocket': {
      const m = num(p.meters, 30) * Math.min(n, 5);
      g.sound.play('rocket');
      g.announce(`🛸 ${who} roketle fırlattı! +${m}m`, '#7cf29a', job);
      g.mark(m, job);
      g.startFlight({ dx: m, height: 6 + m * 0.12, dur: 1.3 + Math.sqrt(m) * 0.18, spins: m > 50 ? 1 : 0, kind: 'rocket' });
      break;
    }
    case 'teleport': {
      const m = num(p.meters, 20) * Math.min(n, 5);
      g.sound.play('teleport');
      g.announce(`🌀 ${who} ışınladı! +${m}m`, '#c89bff', job);
      g.mark(m, job);
      fx.ring(pos.x, pos.y, '#c89bff', 4, 0.6);
      fx.sparkle(pos.x, pos.y, '#c89bff', 40);
      g.startFlight({ dx: m, height: 0, dur: 0.7, spins: 0, kind: 'teleport' });
      break;
    }
    case 'refuel':
      g.addFuel(num(p.percent, 20) * n, job, pos.x, pos.y + 2);
      break;
    case 'magnetFuel': {
      const c = Math.min(12, num(p.count, 4) * n);
      for (let i = 0; i < c; i++) g.hazards.spawn('fuel', pos.x + 12 + i * 5, { drop: 0.8 + i * 0.15 });
      fx.text(pos.x, pos.y + 2.5, `🛢️ x${c} bidon!`, '#ffe066');
      g.sound.play('fuel');
      break;
    }
    case 'repair':
      if (v.repair()) {
        g.sound.play('repair');
        fx.sparkle(pos.x, pos.y, '#9dffb0', 30);
        fx.text(pos.x, pos.y + 2.5, '🔧 Tamir!', '#9dffb0');
      } else {
        fx.text(pos.x, pos.y + 2.5, '🔧 Tekerler sağlam', '#ccc');
      }
      break;
    case 'shield':
      g.shield.hits = Math.min(10, g.shield.hits + num(p.hits, 1) * n);
      g.shield.time = Math.max(g.shield.time, num(p.seconds, 30));
      g.sound.play('shield');
      fx.ring(pos.x, pos.y, '#7fdcff', 4, 0.5);
      fx.text(pos.x, pos.y + 2.5, `🛡️ Kalkan (${g.shield.hits})`, '#7fdcff');
      break;
    case 'ramp':
      g.hazards.spawn('ramp', pos.x + 16 + v.vel.x * 0.6);
      fx.text(pos.x, pos.y + 2.5, '📐 Rampa!', '#ffd23f');
      g.sound.play('gift');
      break;
    case 'lowGravity':
      g.setGravityMod('low', num(p.seconds, 6) * n);
      fx.text(pos.x, pos.y + 2.5, '🪐 Düşük yerçekimi', '#d0b3ff');
      g.sound.play('change');
      break;
    case 'tailwind':
      g.timers.wind = Math.min(20, Math.max(0, g.timers.windDir > 0 ? g.timers.wind : 0) + num(p.seconds, 5) * n);
      g.timers.windDir = 1;
      g.sound.play('wind');
      fx.text(pos.x, pos.y + 2.5, '🌬️ Arkadan rüzgar', '#bdf4ff');
      break;
    case 'giant':
      g.resizeVehicle(1.6, Math.min(60, num(p.seconds, 12) * n));
      fx.text(pos.x, pos.y + 4, '🦖 DEV ARABA!', '#a0ff8a');
      break;

    case 'bomb':
    case 'missile': {
      const m = num(p.meters, job.action === 'bomb' ? 15 : 40) * Math.min(n, 5);
      g.announce(`${meta.icon} ${who} ${job.action === 'bomb' ? 'bomba attı' : 'füze gönderdi'}${n > 1 ? ' x' + Math.min(n, 5) : ''}! -${m}m`, '#ff6b6b', job);
      g.busy++;
      g.driver.setMood('scared', 3);
      g.hazards.fire(job.action, (hx, hy) => {
        g.busy--;
        if (g.mode !== 'drive') return;
        if (g.consumeShield(hx, hy)) { fx.explosion(hx, hy, 0.5); return; }
        fx.explosion(hx, hy, job.action === 'bomb' ? 1 : 1.4);
        g.sound.play('bomb');
        g.mark(-m, job);
        g.startFlight({ dx: -m, height: Math.min(14, 4 + m * 0.1), dur: 1.1 + Math.sqrt(m) * 0.15, spins: Math.min(4, (job.action === 'bomb' ? 1 : 2) + Math.min(n, 5) - 1), kind: 'knock' });
      });
      break;
    }
    case 'explode':
      g.announce(`💥 ${who} arabayı patlattı!`, '#ff4d4d', job);
      g.explode(num(p.penalty, g.settings.explodePenalty), job);
      break;
    case 'popTire': {
      const which = p.wheel || 'random';
      const idx = v.wheels.map((_, i) => i);
      const front = idx[idx.length - 1], rear = idx[0];
      let targets;
      if (which === 'front') targets = [front];
      else if (which === 'rear') targets = [rear];
      else if (which === 'all') targets = idx;
      else {
        const healthy = idx.filter((i) => !v.wheels[i].popped).sort(() => Math.random() - 0.5);
        targets = healthy.slice(0, Math.min(n, healthy.length));
      }
      let any = false;
      for (const i of targets) any = g.popWheel(i, null) || any;
      if (any) g.announce(`🛞 ${who} teker patlattı!`, '#ff9f43', job, true);
      break;
    }
    case 'spikes':
    case 'mine':
    case 'oil':
    case 'barrier': {
      const dir = v.vel.x < -1 ? -1 : 1; // aracın gittiği yönün önüne koy
      const x = pos.x + dir * (14 + Math.abs(v.vel.x) * 0.9 + Math.random() * 4);
      const c = Math.min(n, 4);
      for (let i = 0; i < c; i++) g.hazards.spawn(job.action, x + dir * i * 6, { drop: 1.2 + i * 0.2 });
      g.announce(`${meta.icon} ${who}: ${meta.name}${c > 1 ? ' x' + c : ''}!`, '#ff9f43', job, true);
      break;
    }
    case 'meteor': {
      const c = Math.min(20, num(p.count, 5) * n);
      g.announce(`☄️ ${who} meteor yağdırıyor!`, '#ff7a1a', job, true);
      for (let i = 0; i < c; i++) {
        g.later(i * 0.32, () => {
          const vp = g.vehicle.pos;
          const tx = vp.x + (Math.random() - 0.3) * 14 + g.vehicle.vel.x * 1.1;
          g.hazards.meteorAt(tx, (hx, hy) => {
            fx.explosion(hx, hy, 0.7);
            g.sound.play('meteor');
            const cv = g.vehicle, cp = cv.pos;
            const d = Math.hypot(cp.x - hx, cp.y - hy);
            if (g.mode === 'drive' && d < 4 * cv.scale) {
              if (g.consumeShield(hx, hy)) return;
              const dir = Math.sign(cp.x - hx) || 1;
              cv.applyImpulse(dir * cv.mass * 4, cv.mass * 6);
              cv.chassis.applyAngularImpulse(-dir * cv.chassis.getInertia() * 2.5, true);
              g.driver.setMood('scared', 1.5);
            }
          });
        });
      }
      break;
    }
    case 'tornado': {
      const m = num(p.meters, 10) * Math.min(n, 5);
      g.sound.play('wind');
      g.announce(`🌪️ ${who} hortum çıkardı! -${m}m`, '#c0c0c0', job);
      g.mark(-m, job);
      g.startFlight({ dx: -m, height: 7 + m * 0.1, dur: 2.2, spins: 3, kind: 'tornado' });
      break;
    }
    case 'reverseGravity':
      g.setGravityMod('reverse', Math.min(3, num(p.seconds, 2)));
      g.announce(`🙃 ${who} yerçekimini ters çevirdi!`, '#d0b3ff', job, true);
      g.sound.play('change');
      break;
    case 'heavyGravity':
      g.setGravityMod('heavy', num(p.seconds, 6) * n);
      fx.text(pos.x, pos.y + 2.5, '🏋️ Ağır yerçekimi', '#ff9f43');
      g.sound.play('bad');
      break;
    case 'headwind':
      g.timers.wind = Math.min(20, Math.max(0, g.timers.windDir < 0 ? g.timers.wind : 0) + num(p.seconds, 5) * n);
      g.timers.windDir = -1;
      g.sound.play('wind');
      fx.text(pos.x, pos.y + 2.5, '🌪️ Karşı rüzgar', '#bdf4ff');
      break;
    case 'freeze':
      g.timers.freeze = Math.min(10, g.timers.freeze + num(p.seconds, 3) * n);
      g.sound.play('block');
      fx.flash('#bfefff', 0.4);
      fx.text(pos.x, pos.y + 2.5, '🧊 DONDU!', '#bfefff');
      break;
    case 'reverse':
      g.timers.reverse = Math.min(10, g.timers.reverse + num(p.seconds, 3) * n);
      g.sound.play('bad');
      fx.text(pos.x, pos.y + 2.5, '⏪ Geri vites!', '#ff9f43');
      g.driver.setMood('angry', 3);
      break;
    case 'drainFuel':
      g.fuel = Math.max(0, g.fuel - num(p.percent, 15) * n);
      g.sound.play('bad');
      fx.text(pos.x, pos.y + 2.5, `🕳️ -%${num(p.percent, 15) * n} benzin`, '#ff6b6b');
      break;
    case 'earthquake':
      g.timers.quake = Math.min(10, g.timers.quake + num(p.seconds, 3) * n);
      g.sound.play('bomb');
      fx.text(pos.x, pos.y + 2.5, '🌋 DEPREM!', '#ff9f43');
      break;
    case 'mini':
      g.resizeVehicle(0.6, Math.min(60, num(p.seconds, 12) * n));
      fx.text(pos.x, pos.y + 2.5, '🐜 Mini araba!', '#ff9f43');
      break;
    case 'flip':
      g.sound.play('jump');
      g.startFlight({ dx: 3, height: 3.5 + Math.min(n, 3), dur: 1.1 + Math.min(n, 3) * 0.3, spins: Math.min(n, 3), kind: 'flip' });
      fx.text(pos.x, pos.y + 2.5, '🤸 TAKLA!', '#ffd23f');
      break;

    case 'changeVehicle': {
      const cur = g.vehicleId;
      const ids = g.vehicleIds();
      let id = p.vehicle || 'random';
      if (id === 'random') id = pickOther(ids, cur);
      else if (id === 'next') id = nextOf(ids, cur);
      if (!ids.includes(id)) id = pickOther(ids, cur);
      g.setVehicle(id);
      g.announce(`🚙 ${who}: Yeni araç → ${g.vehicle.def.name}`, '#7fdcff', job, true);
      break;
    }
    case 'changeMap': {
      const cur = g.terrain.mapAt(pos.x + 30);
      let id = p.map || 'random';
      if (id === 'random') id = pickOther(MAP_IDS, cur);
      else if (id === 'next') id = nextOf(MAP_IDS, cur);
      if (!MAP_IDS.includes(id)) id = pickOther(MAP_IDS, cur);
      g.setMap(id, job);
      break;
    }
    case 'emojiRain':
      fx.emojiRain(g.cam.w, g.cam.h, p.emoji || '❤️', Math.min(200, num(p.count, 40) * Math.min(n, 4)));
      g.sound.play('gift');
      break;
    case 'confetti':
      fx.confetti(g.cam.w, g.cam.h, Math.min(400, 140 * n));
      g.sound.play('gift');
      break;
    case 'fireworks':
      fx.fireworks(g.cam.w, g.cam.h, Math.min(12, num(p.bursts, 5) * n));
      g.sound.play('win');
      break;
    case 'slowMotion':
      g.timers.slowmo = Math.min(12, g.timers.slowmo + num(p.seconds, 4) * n);
      fx.text(pos.x, pos.y + 2.5, '🐌 Ağır çekim', '#d0b3ff');
      break;
    case 'paint': {
      const hue = Math.floor(Math.random() * 360);
      v.color = `hsl(${hue},80%,55%)`;
      v.dark = `hsl(${hue},75%,35%)`;
      fx.sparkle(pos.x, pos.y, v.color, 30);
      break;
    }
  }
}

export { VEHICLE_IDS };
