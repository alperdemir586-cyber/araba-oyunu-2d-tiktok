// Parçacık ve görsel efekt sistemi. Dünya koordinatları (metre, y yukarı)
// veya ekran koordinatları (px) ile çalışan iki ayrı katman tutar.
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export class Effects {
  constructor() {
    this.world = []; // dünya uzayındaki parçacıklar
    this.screen = []; // ekran uzayındaki parçacıklar (emoji yağmuru, konfeti)
    this.texts = []; // dünyada yükselen yazılar
    this.rings = []; // şok dalgaları
    this.flashAlpha = 0;
    this.flashColor = '#fff';
    this.shakeTime = 0;
    this.shakePower = 0;
    this.maxParticles = 2500;
  }

  add(list, p) {
    if (this.world.length + this.screen.length > this.maxParticles) return;
    list.push(p);
  }

  shake(power, time = 0.4) {
    this.shakePower = Math.max(this.shakePower, power);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  flash(color = '#fff', alpha = 0.7) {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  text(x, y, str, color = '#fff', size = 0.9) {
    this.texts.push({ x, y, str, color, size, life: 1.8, max: 1.8, vy: 1.6 });
  }

  ring(x, y, color = '#fff', maxR = 6, life = 0.5) {
    this.rings.push({ x, y, color, maxR, life, max: life });
  }

  explosion(x, y, scale = 1) {
    this.flash('#fff3c4', 0.8 * Math.min(1, scale));
    this.shake(0.8 * scale, 0.6);
    this.ring(x, y, '#ffdd88', 7 * scale, 0.45);
    this.ring(x, y, '#ffffff', 4 * scale, 0.3);
    // çekirdek parlama
    this.add(this.world, { x, y, vx: 0, vy: 0, g: 0, drag: 0, life: 0.25, max: 0.25, size: 2.2 * scale, color: '#fff6c8', type: 'fire', grow: 4 });
    for (let i = 0; i < 55 * scale; i++) {
      const a = rand(0, Math.PI * 2), s = rand(3, 13) * scale;
      this.add(this.world, {
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 3, g: -4, drag: 3,
        life: rand(0.3, 0.8), max: 0.8, size: rand(0.18, 0.45) * scale,
        color: pick(['#fff6a8', '#ffcf3f', '#ff8a1f', '#ff4d1a', '#d62f12']), type: 'fire', grow: 0.5,
      });
    }
    for (let i = 0; i < 18 * scale; i++) {
      const a = rand(0, Math.PI * 2), s = rand(1, 4) * scale;
      this.add(this.world, {
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 1.5, g: 1.5, drag: 1.4,
        life: rand(1.0, 1.9), max: 1.9, size: rand(0.35, 0.7) * scale,
        color: pick(['#3b3b3b', '#4a4a4a', '#5e5e5e']), type: 'smoke', grow: 0.7,
      });
    }
    for (let i = 0; i < 24 * scale; i++) {
      const a = rand(0.2, Math.PI - 0.2), s = rand(8, 20) * scale;
      this.add(this.world, {
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: -20, drag: 0.3,
        life: rand(0.8, 1.6), max: 1.6, size: rand(0.06, 0.14),
        color: '#ffe9a0', type: 'spark',
      });
    }
  }

  debris(x, y, colors, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = rand(0.3, Math.PI - 0.3), s = rand(6, 15);
      this.add(this.world, {
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: -22, drag: 0.2,
        life: rand(1.5, 2.6), max: 2.6, size: rand(0.2, 0.55), rot: rand(0, 6), vr: rand(-12, 12),
        color: pick(colors), type: 'chunk',
      });
    }
  }

  smokePuff(x, y, color = 'rgba(80,80,80,0.6)', size = 0.5, grow = 1.8) {
    this.add(this.world, {
      x, y, vx: rand(-0.6, 0.2), vy: rand(0.5, 1.4), g: 0, drag: 1,
      life: rand(0.6, 1.1), max: 1.1, size: size * rand(0.7, 1.2), color, type: 'smoke', grow,
    });
  }

  boostFlame(x, y, dirX, dirY, strong = false) {
    const n = strong ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const s = rand(6, 11);
      this.add(this.world, {
        x, y, vx: dirX * s + rand(-1, 1), vy: dirY * s + rand(-1, 1), g: 0, drag: 3,
        life: rand(0.15, 0.32), max: 0.32, size: rand(0.22, 0.4) * (strong ? 1.1 : 1),
        color: strong ? pick(['#9be8ff', '#4fc3ff', '#ffffff', '#7c6cff']) : pick(['#fff3a0', '#ffb22e', '#ff6a1a']),
        type: 'fire', grow: -0.6,
      });
    }
  }

  dust(x, y, color = 'rgba(150,120,90,0.5)') {
    this.add(this.world, {
      x, y, vx: rand(-2.5, -0.5), vy: rand(0.4, 1.6), g: -1, drag: 2,
      life: rand(0.4, 0.8), max: 0.8, size: rand(0.15, 0.35), color, type: 'smoke', grow: 1,
    });
  }

  sparkle(x, y, color = '#fff59d', count = 20) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), s = rand(1, 6);
      this.add(this.world, {
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: -2, drag: 1.5,
        life: rand(0.5, 1.1), max: 1.1, size: rand(0.08, 0.2), color, type: 'star', rot: rand(0, 6), vr: rand(-6, 6),
      });
    }
  }

  // --- Ekran katmanı efektleri ---
  emojiRain(w, h, emoji = '❤️', count = 50) {
    for (let i = 0; i < count; i++) {
      this.add(this.screen, {
        x: rand(0, w), y: rand(-h * 0.6, -20), vx: rand(-30, 30), vy: rand(150, 380), g: 120, drag: 0,
        life: 5, max: 5, size: rand(26, 54), rot: rand(-0.5, 0.5), vr: rand(-2, 2), emoji, type: 'emoji',
      });
    }
  }

  confetti(w, h, count = 140) {
    const colors = ['#ff3b6b', '#ffd23f', '#3bceac', '#4d8cff', '#b45cff', '#ff8a3d'];
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      this.add(this.screen, {
        x: fromLeft ? -10 : w + 10, y: rand(h * 0.4, h * 0.9),
        vx: (fromLeft ? 1 : -1) * rand(250, 750), vy: rand(-900, -350), g: 650, drag: 1.1,
        life: rand(2.5, 4), max: 4, size: rand(7, 14), rot: rand(0, 6), vr: rand(-10, 10),
        color: colors[i % colors.length], type: 'confetti',
      });
    }
  }

  fireworks(w, h, bursts = 5) {
    const colors = ['#ff3b6b', '#ffd23f', '#3bceac', '#4d8cff', '#b45cff', '#ffffff'];
    for (let b = 0; b < bursts; b++) {
      const cx = rand(w * 0.15, w * 0.85), cy = rand(h * 0.12, h * 0.45), c = pick(colors);
      const delay = b * 0.25;
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, s = rand(120, 320);
        this.add(this.screen, {
          x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 140, drag: 1.4, delay,
          life: rand(1.1, 1.8), max: 1.8, size: rand(2.5, 4.5), color: c, type: 'dot',
        });
      }
    }
  }

  update(dt) {
    const step = (list) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.life -= dt;
        if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); continue; }
        const d = Math.max(0, 1 - (p.drag || 0) * dt);
        p.vx *= d; p.vy *= d;
        p.vy += (p.g || 0) * dt * (list === this.screen ? 1 : 1);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
        if (p.grow) p.size = Math.max(0.01, p.size + p.grow * dt);
      }
    };
    step(this.world);
    step(this.screen);
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= 0.97;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.2);
    if (this.shakeTime > 0) this.shakeTime -= dt; else this.shakePower *= 0.85;
  }

  shakeOffset() {
    if (this.shakeTime <= 0 && this.shakePower < 0.02) return [0, 0];
    const p = this.shakePower * Math.min(1, this.shakeTime * 3 + 0.2);
    return [rand(-p, p), rand(-p, p)];
  }

  // cam: { toScreen(x,y) -> [sx,sy], ppm }
  drawWorld(ctx, cam) {
    const ppm = cam.ppm;
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const [sx, sy] = cam.toScreen(r.x, r.y);
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(2, (1 - t) * 0.5 * ppm);
      ctx.beginPath();
      ctx.arc(sx, sy, t * r.maxR * ppm, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.world) {
      if (p.delay > 0) continue;
      const [sx, sy] = cam.toScreen(p.x, p.y);
      const a = Math.max(0, p.life / p.max);
      const s = p.size * ppm;
      if (p.type === 'fire') {
        ctx.globalAlpha = Math.min(1, a * 1.3);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sx, sy, s, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sx, sy, s, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'spark') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1.5, s);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - p.vx * 0.02 * ppm, sy + p.vy * 0.02 * ppm); ctx.stroke();
      } else if (p.type === 'chunk') {
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-s / 2, -s / 3, s, s * 0.66);
        ctx.restore();
      } else if (p.type === 'star') {
        ctx.globalAlpha = a;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot);
        drawStar(ctx, 0, 0, s, s * 0.45, p.color);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const [sx, sy] = cam.toScreen(t.x, t.y);
      const a = Math.min(1, t.life / 0.5);
      ctx.globalAlpha = a;
      const base = Math.min(cam.w, cam.h) * 0.07;
      const fs = Math.round(t.size * base * Math.min(1, (t.max - t.life) * 6 + 0.3));
      ctx.font = `900 ${fs}px "Baloo 2", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(3, fs * 0.16);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(t.str, sx, sy);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  drawScreen(ctx, w, h) {
    for (const p of this.screen) {
      if (p.delay > 0) continue;
      const a = Math.max(0, Math.min(1, p.life / p.max * 2));
      ctx.globalAlpha = a;
      if (p.type === 'emoji') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.font = `${p.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
        ctx.restore();
      } else if (p.type === 'confetti') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * Math.abs(Math.sin(p.rot * 2)) + 1);
        ctx.restore();
      } else if (p.type === 'dot') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1;
    if (this.flashAlpha > 0) {
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }
}

export function drawStar(ctx, x, y, r1, r2, color, points = 5) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}
