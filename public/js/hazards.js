// Yoldaki engeller, toplanabilir benzin bidonları ve uçan mermiler (bomba/füze/meteor).
import { hash } from './maps.js';

export class Hazards {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.projectiles = [];
    this.usedNatural = new Set(); // doğal spawn anahtarları (tekrar üretmemek için)
  }

  reset() {
    for (const it of this.items) if (it.body) this.game.world.destroyBody(it.body);
    this.items = [];
    this.projectiles = [];
    this.usedNatural.clear();
  }

  // type: spikes | mine | oil | barrier | ramp | fuel
  spawn(type, x, opts = {}) {
    const t = this.game.terrain;
    t.ensure(x);
    const y = t.heightAt(x);
    const it = { type, x, y, t: 0, drop: opts.drop ?? 1.2, done: false, natural: !!opts.natural, ...opts };
    const world = this.game.world;
    if (type === 'barrier') {
      const r = 0.38 + Math.random() * 0.17;
      it.r = r;
      it.body = world.createBody({ type: 'static', position: planck.Vec2(x, y + r * 0.3) });
      it.body.createFixture(new planck.Circle(r), { friction: 0.8 });
      it.body.setUserData({ kind: 'ground' });
    } else if (type === 'ramp') {
      const len = 4.5, hgt = 1.4;
      const slope = t.slopeAt(x);
      const pts = [planck.Vec2(-len / 2, -0.4), planck.Vec2(len / 2, slope * len - 0.4), planck.Vec2(len / 2, slope * len + hgt), planck.Vec2(len / 2 - 0.3, slope * len + hgt)];
      it.len = len; it.hgt = hgt; it.slope = slope;
      it.body = world.createBody({ type: 'static', position: planck.Vec2(x, y - (slope * len) / 2 + 0.05) });
      it.body.createFixture(new planck.Polygon(pts), { friction: 0.95 });
      it.body.setUserData({ kind: 'ground' });
    }
    this.items.push(it);
    return it;
  }

  // Doğal (yol üstünde kendiliğinden) bidon ve engelleri yerleştir
  spawnNatural(fromX, toX) {
    const s = this.game.settings;
    if (s.fuelCanEvery > 0) {
      for (let k = Math.ceil(fromX / s.fuelCanEvery); k * s.fuelCanEvery < toX; k++) {
        if (k === 0) continue;
        const key = 'f' + k;
        if (this.usedNatural.has(key)) continue;
        this.usedNatural.add(key);
        this.spawn('fuel', k * s.fuelCanEvery, { natural: true, drop: 0 });
      }
    }
    if (s.randomHazards && s.hazardEvery > 0) {
      for (let k = Math.ceil(fromX / s.hazardEvery); k * s.hazardEvery < toX; k++) {
        if (k === 0) continue;
        const key = 'h' + k;
        if (this.usedNatural.has(key)) continue;
        this.usedNatural.add(key);
        const x = k * s.hazardEvery + (hash(k * 3.3) - 0.5) * s.hazardEvery * 0.4;
        if (s.fuelCanEvery > 0 && Math.abs(x - Math.round(x / s.fuelCanEvery) * s.fuelCanEvery) < 6) continue;
        const types = ['spikes', 'oil', 'barrier', 'mine', 'ramp', 'barrier'];
        this.spawn(types[Math.floor(hash(k * 7.7) * types.length)], x, { natural: true, drop: 0 });
      }
    }
  }

  // Mermi: hedef araca doğru uçar, çarpınca onHit çağrılır
  fire(kind, onHit) {
    const g = this.game, p = g.vehicle.pos, v = g.vehicle.vel;
    let x, y, dur;
    if (kind === 'bomb') { x = p.x - 14; y = p.y + 14; dur = 1.1; }
    else if (kind === 'missile') { x = p.x + 30; y = p.y + 4; dur = 1.0; }
    else { x = p.x + 4 + Math.random() * 12; y = p.y + 22 + Math.random() * 6; dur = 1.2; } // meteor
    this.projectiles.push({ kind, x0: x, y0: y, x, y, t: 0, dur, onHit, leadVx: v.x, target: null, trail: 0, rot: 0 });
  }

  meteorAt(tx, onHit) {
    const ty = this.game.terrain.heightAt(tx);
    this.projectiles.push({ kind: 'meteor', x0: tx + 8, y0: ty + 26, x: tx + 8, y: ty + 26, t: 0, dur: 1.1, onHit, target: { x: tx, y: ty }, trail: 0, rot: 0 });
  }

  update(dt) {
    const g = this.game, fx = g.effects;
    // mermiler
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.t += dt;
      const u = Math.min(1, pr.t / pr.dur);
      const tgt = pr.target || { x: g.vehicle.pos.x, y: g.vehicle.pos.y };
      const prevX = pr.x, prevY = pr.y;
      if (pr.kind === 'bomb') {
        pr.x = pr.x0 + (tgt.x - pr.x0) * u;
        pr.y = pr.y0 + (tgt.y - pr.y0) * u + Math.sin(u * Math.PI) * 5;
        pr.rot += dt * 8;
        fx.add(fx.world, { x: pr.x - 0.3, y: pr.y + 0.5, vx: 0, vy: 0.5, g: 0, drag: 1, life: 0.3, max: 0.3, size: 0.12, color: '#ffcc33', type: 'fire', grow: -0.2 });
      } else if (pr.kind === 'missile') {
        pr.x = pr.x0 + (tgt.x - pr.x0) * u * u;
        pr.y = pr.y0 + (tgt.y + 0.3 - pr.y0) * u;
        fx.smokePuff(pr.x + 0.8, pr.y, 'rgba(200,200,200,0.7)', 0.35);
        fx.boostFlame(pr.x + 0.8, pr.y, 1, 0, false);
      } else {
        pr.x = pr.x0 + (tgt.x - pr.x0) * u;
        pr.y = pr.y0 + (tgt.y - pr.y0) * u;
        fx.boostFlame(pr.x + 0.3, pr.y + 0.6, 0.6, 1, false);
        fx.smokePuff(pr.x + 0.4, pr.y + 0.8, 'rgba(90,60,50,0.6)', 0.5);
      }
      pr.angle = Math.atan2(pr.y - prevY, pr.x - prevX);
      if (u >= 1) {
        this.projectiles.splice(i, 1);
        pr.onHit?.(pr.x, pr.y);
      }
    }

    // yol üstü nesneler
    const v = g.vehicle;
    if (!v) return;
    const alive = g.mode === 'drive';
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (Math.abs(it.x - v.pos.x) > 90 || it.done) {
        if (it.body) g.world.destroyBody(it.body);
        this.items.splice(i, 1);
        continue;
      }
      if (!alive || it.t < it.drop) continue;
      const near = Math.abs(v.pos.x - it.x);
      if (near > 4 * v.scale) continue;
      switch (it.type) {
        case 'fuel':
          if (near < 1.3 * v.scale + 0.5 && Math.abs(v.pos.y - it.y) < 3) {
            it.done = true;
            g.addFuel(g.settings.fuelCanPercent, null, it.x, it.y + 1);
          }
          break;
        case 'spikes':
          for (let wi = 0; wi < v.wheels.length; wi++) {
            const w = v.wheels[wi], wp = w.body.getPosition();
            if (Math.abs(wp.x - it.x) < 1.0 && wp.y - w.radius - it.y < 0.35) {
              it.done = true;
              fx.debris(it.x, it.y + 0.2, ['#777', '#999', '#5a3a1a'], 8);
              g.damage(() => g.popWheel(wi, '🌵 Dikenli tel!'), it.x, it.y);
              break;
            }
          }
          break;
        case 'mine':
          if (near < 0.9 * v.scale + 0.3) {
            it.done = true;
            fx.explosion(it.x, it.y + 0.3, 0.8);
            g.sound.play('mine');
            g.damage(() => {
              v.applyImpulse(-v.mass * 3, v.mass * 9);
              v.chassis.applyAngularImpulse(v.chassis.getInertia() * 3, true);
              if (Math.random() < 0.5) g.popWheel(Math.floor(Math.random() * v.wheels.length), null);
              g.driver.setMood('scared', 2);
            }, it.x, it.y);
          }
          break;
        case 'oil':
          for (const w of v.wheels) {
            const wp = w.body.getPosition();
            if (Math.abs(wp.x - it.x) < 1.6 && wp.y - w.radius - it.y < 0.3) {
              if (!it.hit) {
                it.hit = true;
                g.damage(() => { g.timers.oil = 2.5; g.effects.text(it.x, it.y + 2, '🛢️ Kaygan!', '#ffe066'); }, it.x, it.y);
              }
            }
          }
          break;
      }
    }
  }

  draw(ctx, cam, time) {
    const ppm = cam.ppm;
    for (const it of this.items) {
      const dropK = it.drop > 0 ? Math.max(0, 1 - it.t / it.drop) : 0;
      const yOff = dropK * dropK * 12;
      let [sx, sy] = cam.toScreen(it.x, it.y + yOff);
      if (sx < -200 || sx > cam.w + 200) continue;
      ctx.save();
      ctx.translate(sx, sy);
      if (dropK > 0) {
        // paraşüt
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -0.5 * ppm); ctx.lineTo(-0.9 * ppm, -2.2 * ppm); ctx.moveTo(0, -0.5 * ppm); ctx.lineTo(0.9 * ppm, -2.2 * ppm); ctx.stroke();
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath(); ctx.arc(0, -2.2 * ppm, 1 * ppm, Math.PI, 0); ctx.fill();
      }
      switch (it.type) {
        case 'fuel': {
          const bob = Math.sin(time * 3 + it.x) * 0.15 * ppm;
          ctx.translate(0, -0.9 * ppm + bob);
          const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.2 * ppm);
          glow.addColorStop(0, 'rgba(255,240,120,0.6)'); glow.addColorStop(1, 'rgba(255,240,120,0)');
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 1.2 * ppm, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e8262c'; ctx.strokeStyle = '#5a0a0a'; ctx.lineWidth = 0.05 * ppm;
          roundRect(ctx, -0.38 * ppm, -0.5 * ppm, 0.76 * ppm, 1.0 * ppm, 0.1 * ppm); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#222'; ctx.fillRect(0.05 * ppm, -0.7 * ppm, 0.22 * ppm, 0.22 * ppm);
          ctx.fillStyle = '#ffd23f';
          ctx.font = `900 ${0.45 * ppm}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('⛽', 0, 0.05 * ppm);
          break;
        }
        case 'spikes':
          ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-1.1 * ppm, -0.15 * ppm, 2.2 * ppm, 0.15 * ppm);
          ctx.fillStyle = '#c9ced6'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
          for (let k = -4; k <= 4; k++) {
            ctx.beginPath(); ctx.moveTo(k * 0.24 * ppm - 0.1 * ppm, -0.12 * ppm); ctx.lineTo(k * 0.24 * ppm, -0.55 * ppm); ctx.lineTo(k * 0.24 * ppm + 0.1 * ppm, -0.12 * ppm); ctx.fill(); ctx.stroke();
          }
          ctx.strokeStyle = '#888'; ctx.lineWidth = 0.04 * ppm;
          ctx.beginPath();
          for (let k = -10; k <= 10; k++) ctx.lineTo(k * 0.1 * ppm, -0.35 * ppm + (k % 2 ? 0.08 : -0.08) * ppm);
          ctx.stroke();
          break;
        case 'mine': {
          const blink = Math.sin(time * 10) > 0;
          ctx.fillStyle = '#3a3f2a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 0.04 * ppm;
          ctx.beginPath(); ctx.ellipse(0, -0.12 * ppm, 0.5 * ppm, 0.2 * ppm, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
          ctx.fillStyle = blink ? '#ff2020' : '#661010';
          ctx.beginPath(); ctx.arc(0, -0.3 * ppm, 0.08 * ppm, 0, Math.PI * 2); ctx.fill();
          if (blink) {
            ctx.fillStyle = 'rgba(255,40,40,0.3)';
            ctx.beginPath(); ctx.arc(0, -0.3 * ppm, 0.3 * ppm, 0, Math.PI * 2); ctx.fill();
          }
          break;
        }
        case 'oil':
          ctx.fillStyle = 'rgba(15,10,25,0.92)';
          ctx.beginPath(); ctx.ellipse(0, 0, 1.8 * ppm, 0.16 * ppm, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(160,120,255,0.35)';
          ctx.beginPath(); ctx.ellipse(-0.4 * ppm, -0.03 * ppm, 0.6 * ppm, 0.05 * ppm, 0, 0, Math.PI * 2); ctx.fill();
          break;
        case 'barrier': {
          if (it.body) {
            const bp = it.body.getPosition();
            const [bx, by] = cam.toScreen(bp.x, bp.y);
            ctx.setTransform(1, 0, 0, 1, bx, by);
          }
          const r = it.r * ppm;
          ctx.fillStyle = '#7d7468'; ctx.strokeStyle = '#3a342c'; ctx.lineWidth = 0.05 * ppm;
          ctx.beginPath();
          for (let k = 0; k < 9; k++) {
            const a = (k / 9) * Math.PI * 2, rr = r * (0.88 + hash(k + it.x) * 0.2);
            ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'ramp': {
          if (it.body) {
            const bp = it.body.getPosition();
            const [bx, by] = cam.toScreen(bp.x, bp.y);
            ctx.setTransform(1, 0, 0, 1, bx, by);
          }
          const L = it.len, H = it.hgt, sl = it.slope;
          ctx.fillStyle = '#c98b3e'; ctx.strokeStyle = '#5e3a1a'; ctx.lineWidth = 0.06 * ppm;
          ctx.beginPath();
          ctx.moveTo(-L / 2 * ppm, 0.4 * ppm);
          ctx.lineTo(L / 2 * ppm, -(sl * L + H) * ppm);
          ctx.lineTo(L / 2 * ppm, -(sl * L - 0.4) * ppm);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 0.08 * ppm;
          ctx.beginPath(); ctx.moveTo(-L / 2 * ppm, 0.35 * ppm); ctx.lineTo(L / 2 * ppm, -(sl * L + H - 0.05) * ppm); ctx.stroke();
          break;
        }
      }
      ctx.restore();
    }
    // mermiler
    for (const pr of this.projectiles) {
      const [sx, sy] = cam.toScreen(pr.x, pr.y);
      ctx.save();
      ctx.translate(sx, sy);
      if (pr.kind === 'bomb') {
        ctx.rotate(pr.rot);
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(0, 0, 0.45 * ppm, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(-0.15 * ppm, -0.15 * ppm, 0.12 * ppm, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#555'; ctx.fillRect(-0.1 * ppm, -0.6 * ppm, 0.2 * ppm, 0.2 * ppm);
      } else if (pr.kind === 'missile') {
        ctx.rotate(-pr.angle);
        ctx.fillStyle = '#d9dde3'; ctx.strokeStyle = '#333'; ctx.lineWidth = 0.04 * ppm;
        ctx.beginPath(); ctx.ellipse(0, 0, 0.9 * ppm, 0.2 * ppm, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8262c';
        ctx.beginPath(); ctx.moveTo(0.9 * ppm, 0); ctx.lineTo(0.55 * ppm, -0.2 * ppm); ctx.lineTo(0.55 * ppm, 0.2 * ppm); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-0.9 * ppm, 0); ctx.lineTo(-0.5 * ppm, 0); ctx.lineTo(-0.9 * ppm, -0.45 * ppm); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-0.9 * ppm, 0); ctx.lineTo(-0.5 * ppm, 0); ctx.lineTo(-0.9 * ppm, 0.45 * ppm); ctx.fill();
      } else {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.9 * ppm);
        g.addColorStop(0, '#fff3a0'); g.addColorStop(0.4, '#ff7a1a'); g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 0.9 * ppm, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a2a1a'; ctx.beginPath(); ctx.arc(0, 0, 0.42 * ppm, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
