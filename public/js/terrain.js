// Prosedürel yokuşlu zemin. Yükseklik x'in deterministik bir fonksiyonudur,
// böylece silinen parçalar (geri fırlatmalarda) aynen yeniden üretilebilir.
import { MAPS, hash, noise1, drawDeco } from './maps.js';

const CHUNK = 20; // metre
const STEP = 0.5; // metre aralıklarla nokta
const BLEND = 40; // harita geçişinde yumuşatma mesafesi

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export class Terrain {
  constructor(world, opts) {
    this.world = world;
    this.seed = opts.seed ?? Math.floor(Math.random() * 10000);
    this.growth = opts.difficulty ?? 1;
    this.target = opts.target ?? 1000;
    this.changes = [{ x: -1e9, map: opts.map || 'meadow' }];
    this.chunks = new Map();
    this.extraBodies = []; // rampa vb. sonradan eklenen statik gövdeler
    this.groundImages = {};
    // Başlangıç duvarı
    const wall = world.createBody({ type: 'static' });
    wall.createFixture(new planck.Edge(planck.Vec2(-6, -200), planck.Vec2(-6, 300)), { friction: 0.2 });
    wall.setUserData({ kind: 'ground' });
  }

  mapAt(x) {
    let m = this.changes[0].map;
    for (const c of this.changes) if (c.x <= x) m = c.map; else break;
    return m;
  }

  params(x) {
    let idx = 0;
    for (let i = 0; i < this.changes.length; i++) if (this.changes[i].x <= x) idx = i;
    const cur = MAPS[this.changes[idx].map];
    if (idx === 0) return { amp: cur.amp, rough: cur.rough };
    const prev = MAPS[this.changes[idx - 1].map];
    const t = smooth((x - this.changes[idx].x) / BLEND);
    return { amp: prev.amp + (cur.amp - prev.amp) * t, rough: prev.rough + (cur.rough - prev.rough) * t };
  }

  heightAt(x) {
    const flat = smooth((x - 12) / 45);
    if (flat <= 0) return 0;
    const p = this.params(x);
    const diff = 1 + Math.min(1, Math.max(0, x) / Math.max(200, this.target)) * 0.6 * this.growth;
    const s = this.seed;
    const h = noise1(x / 48, s) * 8.5
      + noise1(x / 19, s + 1) * 3.2 * p.rough
      + noise1(x / 7, s + 2) * 0.7 * p.rough
      + noise1(x / 160, s + 3) * 6;
    return h * p.amp * diff * flat;
  }

  slopeAt(x) {
    return (this.heightAt(x + 0.25) - this.heightAt(x - 0.25)) / 0.5;
  }

  // Haritayı x'ten itibaren değiştir; ilerideki parçalar yeniden üretilir.
  changeMap(map, fromX) {
    const ci = Math.floor(fromX / CHUNK) + 1;
    const x = ci * CHUNK;
    this.changes = this.changes.filter((c) => c.x < x);
    this.changes.push({ x, map });
    for (const [i, ch] of this.chunks) {
      if (i >= ci) { this.world.destroyBody(ch.body); this.chunks.delete(i); }
    }
    return x;
  }

  buildChunk(i) {
    const x0 = i * CHUNK;
    const pts = [];
    for (let x = x0; x <= x0 + CHUNK + 1e-6; x += STEP) pts.push({ x, y: this.heightAt(x) });
    const body = this.world.createBody({ type: 'static' });
    const verts = pts.map((p) => planck.Vec2(p.x, p.y));
    const map = MAPS[this.mapAt(x0 + CHUNK / 2)];
    body.createFixture(new planck.Chain(verts, false), { friction: map.friction, restitution: 0 });
    body.setUserData({ kind: 'ground' });
    // dekorlar
    const decos = [];
    for (let k = Math.ceil(x0 / 3); k < (x0 + CHUNK) / 3; k++) {
      const dx = k * 3 + hash(k * 1.7 + this.seed) * 2;
      const m = MAPS[this.mapAt(dx)];
      if (dx < 8 || hash(k * 9.1 + this.seed) > m.decoDensity) continue;
      const type = m.deco[Math.floor(hash(k * 4.3) * m.deco.length)];
      decos.push({ x: dx, y: this.heightAt(dx), type, v: hash(k * 2.9) });
    }
    this.chunks.set(i, { body, pts, decos });
  }

  update(minX, maxX) {
    const a = Math.floor(minX / CHUNK), b = Math.floor(maxX / CHUNK);
    for (let i = Math.max(-1, a); i <= b; i++) if (!this.chunks.has(i)) this.buildChunk(i);
    for (const [i, ch] of this.chunks) {
      if (i < a - 3 || i > b + 3) { this.world.destroyBody(ch.body); this.chunks.delete(i); }
    }
  }

  ensure(x) {
    this.update(x - 30, x + 60);
  }

  // custom: { image, mode: 'strip' | 'pattern', meters } harita başına özel zemin
  draw(ctx, cam, time, customGround) {
    const { w, h, ppm } = cam;
    const left = cam.x - w / 2 / ppm - 1, right = cam.x + w / 2 / ppm + 1;
    const keys = [...this.chunks.keys()].sort((a, b) => a - b);
    // görünen noktaları biyoma göre gruplara ayır
    const runs = [];
    let run = null;
    for (const k of keys) {
      const ch = this.chunks.get(k);
      for (let j = 0; j < ch.pts.length; j++) {
        const p = ch.pts[j];
        if (p.x < left - STEP || p.x > right + STEP) continue;
        const m = this.mapAt(p.x);
        if (!run || run.map !== m) {
          if (run) run.pts.push(p);
          run = { map: m, pts: [] };
          runs.push(run);
        }
        if (run.pts.length && Math.abs(run.pts[run.pts.length - 1].x - p.x) < 1e-6) continue;
        run.pts.push(p);
      }
    }
    for (const r of runs) {
      if (r.pts.length < 2) continue;
      const map = MAPS[r.map];
      const cg = customGround?.(r.map);
      const scr = r.pts.map((p) => cam.toScreen(p.x, p.y));
      if (cg && cg.image?.complete && cg.image.naturalWidth) {
        this.drawCustom(ctx, cam, r.pts, scr, cg);
        continue;
      }
      // dolgu
      ctx.beginPath();
      ctx.moveTo(scr[0][0], h + 10);
      for (const [sx, sy] of scr) ctx.lineTo(sx, sy);
      ctx.lineTo(scr[scr.length - 1][0], h + 10);
      ctx.closePath();
      const minY = Math.min(...scr.map((s) => s[1]));
      const g = ctx.createLinearGradient(0, minY, 0, minY + 6 * ppm);
      g.addColorStop(0, map.ground.fill);
      g.addColorStop(1, map.ground.fillDark);
      ctx.fillStyle = g;
      ctx.fill();
      // taş benekleri
      ctx.save();
      ctx.clip();
      ctx.fillStyle = map.ground.stones;
      ctx.globalAlpha = 0.45;
      for (let k = Math.floor(r.pts[0].x); k < r.pts[r.pts.length - 1].x; k++) {
        for (let d = 0; d < 3; d++) {
          const hv = hash(k * 13.1 + d * 7.7);
          const yy = this.heightAt(k) - 0.9 - d * 1.4 - hv * 0.8;
          const [sx, sy] = cam.toScreen(k + hv, yy);
          ctx.beginPath(); ctx.ellipse(sx, sy, 0.16 * ppm * (0.6 + hv), 0.1 * ppm * (0.6 + hv), 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      // üst katman (çim/kar/asfalt)
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = map.ground.topDark;
      ctx.lineWidth = 0.55 * ppm;
      ctx.beginPath();
      scr.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy + 0.12 * ppm) : ctx.moveTo(sx, sy + 0.12 * ppm)));
      ctx.stroke();
      ctx.strokeStyle = map.ground.top;
      ctx.lineWidth = 0.32 * ppm;
      ctx.beginPath();
      scr.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)));
      ctx.stroke();
      if (r.map === 'city') {
        ctx.setLineDash([0.8 * ppm, 0.8 * ppm]);
        ctx.strokeStyle = '#ffd84a';
        ctx.lineWidth = 0.06 * ppm;
        ctx.beginPath();
        scr.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy + 0.05 * ppm) : ctx.moveTo(sx, sy + 0.05 * ppm)));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (r.map === 'volcano') {
        ctx.strokeStyle = `rgba(255,${100 + Math.sin(time * 2) * 40},30,0.5)`;
        ctx.lineWidth = 0.08 * ppm;
        ctx.beginPath();
        scr.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy + 0.25 * ppm) : ctx.moveTo(sx, sy + 0.25 * ppm)));
        ctx.stroke();
      }
    }
  }

  drawCustom(ctx, cam, pts, scr, cg) {
    const { h, ppm } = cam;
    const img = cg.image;
    const tileM = cg.meters || 4; // görselin genişliği kaç metreye karşılık geliyor
    const pxPerM = img.naturalWidth / tileM;
    const stripH = img.naturalHeight / pxPerM; // metre
    if (cg.mode === 'pattern') {
      ctx.beginPath();
      ctx.moveTo(scr[0][0], h + 10);
      for (const [sx, sy] of scr) ctx.lineTo(sx, sy);
      ctx.lineTo(scr[scr.length - 1][0], h + 10);
      ctx.closePath();
      if (!cg.pattern) cg.pattern = ctx.createPattern(img, 'repeat');
      const [ox, oy] = cam.toScreen(0, 0);
      const s = ppm / pxPerM;
      cg.pattern.setTransform(new DOMMatrix([s, 0, 0, s, ox, oy]));
      ctx.fillStyle = cg.pattern;
      ctx.fill();
      return;
    }
    // 'strip': görselin üst kenarı yüzeyi takip eder (eğimli dilimler)
    if (!cg.bottomColor) cg.bottomColor = sampleBottomColor(img);
    ctx.beginPath();
    ctx.moveTo(scr[0][0], h + 10);
    for (const [sx, sy] of scr) ctx.lineTo(sx, sy + stripH * ppm - 2);
    ctx.lineTo(scr[scr.length - 1][0], h + 10);
    ctx.closePath();
    ctx.fillStyle = cg.bottomColor;
    ctx.fill();
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = scr[i], [x1, y1] = scr[i + 1];
      const segW = x1 - x0;
      if (segW <= 0) continue;
      const srcX = ((pts[i].x % tileM) + tileM) % tileM * pxPerM;
      const srcW = Math.min(img.naturalWidth - srcX, (pts[i + 1].x - pts[i].x) * pxPerM);
      ctx.save();
      ctx.setTransform(1, (y1 - y0) / segW, 0, 1, x0, y0);
      ctx.drawImage(img, srcX, 0, Math.max(1, srcW), img.naturalHeight, 0, 0, segW + 0.8, stripH * ppm);
      ctx.restore();
    }
  }

  drawDecos(ctx, cam, time) {
    const { w, ppm } = cam;
    const left = cam.x - w / 2 / ppm - 4, right = cam.x + w / 2 / ppm + 4;
    for (const ch of this.chunks.values()) {
      for (const d of ch.decos) {
        if (d.x < left || d.x > right) continue;
        const [sx, sy] = cam.toScreen(d.x, d.y - 0.15);
        drawDeco(ctx, d.type, sx, sy, ppm, d.v, time);
      }
    }
  }
}

function sampleBottomColor(img) {
  try {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 1;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, img.naturalHeight - 2, img.naturalWidth, 1, 0, 0, 8, 1);
    const d = cx.getImageData(0, 0, 8, 1).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < 8; i++) { r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; }
    return `rgb(${r / 8 | 0},${g / 8 | 0},${b / 8 | 0})`;
  } catch {
    return '#4a3020';
  }
}
