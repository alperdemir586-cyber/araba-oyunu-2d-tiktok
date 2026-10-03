// Harita (biyom) tanımları ve prosedürel arka plan / dekor çizimleri.
// Her harita için ayarlardan özel arka plan ve zemin görseli atanabilir.
export const MAPS = {
  meadow: {
    name: 'Yeşil Tepeler', amp: 1, rough: 1, friction: 0.95, gravity: -10,
    sky: ['#4fb3ff', '#bfe9ff'], sun: '#fff6c2',
    far: '#9cc9a4', near: '#6fae73',
    ground: { top: '#58c23a', topDark: '#3c8f22', fill: '#8a5a2e', fillDark: '#4f3017', stones: '#a87a4c' },
    deco: ['tree', 'tree', 'bush', 'flower', 'flower'], decoDensity: 0.22, particles: null,
  },
  desert: {
    name: 'Kızgın Çöl', amp: 1.15, rough: 0.8, friction: 0.78, gravity: -10,
    sky: ['#ff9f4a', '#ffe0a3'], sun: '#fff1b0',
    far: '#e6a964', near: '#d48d47',
    ground: { top: '#f2c46d', topDark: '#d39a42', fill: '#c98b3e', fillDark: '#7f4f1d', stones: '#e0ad62' },
    deco: ['cactus', 'cactus', 'rock', 'skull'], decoDensity: 0.12, particles: 'sand',
  },
  snow: {
    name: 'Karlı Dağlar', amp: 1.25, rough: 1.1, friction: 0.5, gravity: -10,
    sky: ['#9fc4e8', '#eaf4ff'], sun: '#ffffff',
    far: '#c8d9ea', near: '#a6bfd8',
    ground: { top: '#ffffff', topDark: '#cfe2f3', fill: '#7d8fa3', fillDark: '#46546a', stones: '#9fb2c6' },
    deco: ['pine', 'pine', 'snowman', 'rock'], decoDensity: 0.2, particles: 'snow',
  },
  moon: {
    name: 'Ay Yüzeyi', amp: 1.2, rough: 1.3, friction: 0.85, gravity: -3.8,
    sky: ['#05060f', '#1b1f3a'], sun: '#dfe6ff', stars: true, planet: true,
    far: '#2c3050', near: '#3d4266',
    ground: { top: '#c9cbd6', topDark: '#9a9cab', fill: '#77798a', fillDark: '#3e4050', stones: '#5e6072' },
    deco: ['crater', 'crater', 'flag', 'rock'], decoDensity: 0.15, particles: null,
  },
  volcano: {
    name: 'Volkan', amp: 1.35, rough: 1.2, friction: 0.9, gravity: -10,
    sky: ['#2a0b0b', '#a3341a'], sun: '#ffb070', glow: '#ff5a1f',
    far: '#4a1a14', near: '#2e100c',
    ground: { top: '#3a2a26', topDark: '#ff5a1f', fill: '#2a1b18', fillDark: '#120a08', stones: '#ff7a2f' },
    deco: ['lavarock', 'deadtree', 'lavarock'], decoDensity: 0.14, particles: 'ember',
  },
  city: {
    name: 'Gece Şehri', amp: 0.55, rough: 0.6, friction: 0.98, gravity: -10,
    sky: ['#0d1033', '#3a2c6b'], sun: '#fff5d6', stars: true, buildings: true,
    far: '#1d1f45', near: '#272a5a',
    ground: { top: '#3d3f4a', topDark: '#ffd84a', fill: '#4a4c57', fillDark: '#25262d', stones: '#5c5f6b' },
    deco: ['lamp', 'lamp', 'cone', 'sign'], decoDensity: 0.13, particles: null,
  },
};

export const MAP_IDS = Object.keys(MAPS);

// Deterministik sözde rastgele (hash) 0..1
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function noise1(x, seed) {
  const i = Math.floor(x), f = x - i;
  const a = hash(i + seed * 1013), b = hash(i + 1 + seed * 1013);
  const u = f * f * (3 - 2 * f);
  return (a + (b - a) * u) * 2 - 1;
}

// Arka plan (gökyüzü + parallaks katmanlar). customImg verilirse onu kullanır.
export function drawBackground(ctx, w, h, map, camX, camY, time, customImg) {
  if (customImg && customImg.complete && customImg.naturalWidth) {
    const scale = h / customImg.naturalHeight;
    const iw = customImg.naturalWidth * scale;
    let off = -((camX * 6) % iw);
    if (off > 0) off -= iw;
    for (let x = off; x < w; x += iw) ctx.drawImage(customImg, x, 0, iw + 1, h);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, map.sky[0]);
  g.addColorStop(1, map.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (map.stars) {
    for (let i = 0; i < 140; i++) {
      const sx = ((hash(i) * w * 1.5 - camX * 2) % (w * 1.5) + w * 1.5) % (w * 1.5);
      const sy = hash(i + 50) * h * 0.65;
      const tw = 0.5 + 0.5 * Math.sin(time * 2 + i);
      ctx.globalAlpha = 0.3 + tw * 0.7;
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx, sy, hash(i + 9) > 0.85 ? 3 : 2, hash(i + 9) > 0.85 ? 3 : 2);
    }
    ctx.globalAlpha = 1;
  }

  // Güneş / ay
  const sunX = w * 0.78, sunY = h * 0.18, sr = Math.min(w, h) * 0.07;
  const sg = ctx.createRadialGradient(sunX, sunY, sr * 0.3, sunX, sunY, sr * 3);
  sg.addColorStop(0, map.sun);
  sg.addColorStop(0.3, map.sun + '88');
  sg.addColorStop(1, map.sun + '00');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sunX, sunY, sr * 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = map.sun;
  ctx.beginPath(); ctx.arc(sunX, sunY, sr, 0, Math.PI * 2); ctx.fill();
  if (map.planet) {
    ctx.fillStyle = '#3d7bd9';
    ctx.beginPath(); ctx.arc(w * 0.22, h * 0.2, sr * 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5fbf6a';
    ctx.beginPath(); ctx.ellipse(w * 0.2, h * 0.19, sr * 0.6, sr * 0.4, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(w * 0.22 + sr * 0.5, h * 0.2, sr * 1.4, -Math.PI / 2, Math.PI / 2); ctx.fill();
  }

  // Bulutlar
  if (!map.stars) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 6; i++) {
      const span = w + 400;
      const cx = ((hash(i * 3) * span - camX * 3 - time * 8 * (1 + i * 0.2)) % span + span) % span - 200;
      const cy = h * (0.08 + hash(i * 7) * 0.25);
      const s = 30 + hash(i * 11) * 40;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(cx + k * s * 0.7, cy + Math.sin(k * 2) * s * 0.2, s, s * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (map.glow) {
    const lg = ctx.createLinearGradient(0, h * 0.5, 0, h);
    lg.addColorStop(0, 'rgba(255,90,31,0)');
    lg.addColorStop(1, 'rgba(255,90,31,0.35)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
  }

  const baseY = h * 0.62 - camY * 2;
  if (map.buildings) {
    drawSkyline(ctx, w, h, camX * 4, baseY - h * 0.05, map.far, 1, time, 0.55);
    drawSkyline(ctx, w, h, camX * 9, baseY + h * 0.08, map.near, 2, time, 0.8);
  } else {
    drawRidge(ctx, w, h, camX * 4, baseY, map.far, 0.22, 1);
    drawRidge(ctx, w, h, camX * 10, baseY + h * 0.1, map.near, 0.14, 2);
  }
}

function drawRidge(ctx, w, h, off, baseY, color, ampK, seed) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 10; x += 10) {
    const wx = (x + off) / 260;
    const y = baseY - (noise1(wx, seed) * 0.6 + noise1(wx * 2.3, seed + 5) * 0.4 + 0.6) * h * ampK;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawSkyline(ctx, w, h, off, baseY, color, seed, time, lit) {
  const bw = 70;
  const start = Math.floor(off / bw);
  for (let i = start; i < start + Math.ceil(w / bw) + 2; i++) {
    const x = i * bw - off;
    const bh = (0.12 + hash(i * 3.1 + seed) * 0.28) * h;
    const width = bw * (0.7 + hash(i + seed * 9) * 0.3);
    ctx.fillStyle = color;
    ctx.fillRect(x, baseY - bh, width, h - baseY + bh);
    // pencereler
    for (let wy = baseY - bh + 10; wy < baseY - 6; wy += 14) {
      for (let wx = x + 6; wx < x + width - 8; wx += 12) {
        const on = hash(wx * 0.37 + wy * 1.7 + seed) > 0.55;
        if (!on) continue;
        ctx.fillStyle = `rgba(255,220,120,${lit * (0.6 + 0.4 * Math.sin(time + wx))})`;
        ctx.fillRect(wx, wy, 5, 7);
      }
    }
  }
}

// Dekor çizimi: (sx, sy) zemin noktası, s = 1 metrenin piksel karşılığı
export function drawDeco(ctx, type, sx, sy, s, v, time) {
  ctx.save();
  ctx.translate(sx, sy);
  switch (type) {
    case 'tree': {
      const th = (2.2 + v * 1.6) * s;
      ctx.fillStyle = '#6b4325';
      ctx.fillRect(-0.15 * s, -th, 0.3 * s, th);
      const sway = Math.sin(time * 1.5 + v * 10) * 0.05 * s;
      ctx.fillStyle = '#2f8f3a';
      ctx.beginPath(); ctx.arc(sway, -th, 1.1 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3fae4a';
      ctx.beginPath(); ctx.arc(-0.5 * s + sway, -th + 0.3 * s, 0.8 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0.6 * s + sway, -th + 0.2 * s, 0.75 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5cc966';
      ctx.beginPath(); ctx.arc(-0.2 * s + sway, -th - 0.4 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'pine': {
      const th = (2.5 + v * 2) * s;
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(-0.12 * s, -0.8 * s, 0.24 * s, 0.8 * s);
      for (let k = 0; k < 3; k++) {
        const y0 = -0.6 * s - k * th * 0.28, wd = (1.2 - k * 0.3) * s;
        ctx.fillStyle = '#2d6b4f';
        ctx.beginPath(); ctx.moveTo(-wd, y0); ctx.lineTo(0, y0 - th * 0.45); ctx.lineTo(wd, y0); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(-wd * 0.5, y0 - th * 0.22); ctx.lineTo(0, y0 - th * 0.45); ctx.lineTo(wd * 0.5, y0 - th * 0.22); ctx.fill();
      }
      break;
    }
    case 'bush':
      ctx.fillStyle = '#3d9a44';
      ctx.beginPath(); ctx.arc(-0.4 * s, -0.3 * s, 0.5 * s, 0, Math.PI * 2); ctx.arc(0.3 * s, -0.35 * s, 0.6 * s, 0, Math.PI * 2); ctx.fill();
      break;
    case 'flower': {
      ctx.strokeStyle = '#2d7a2d'; ctx.lineWidth = 0.06 * s;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -0.5 * s); ctx.stroke();
      ctx.fillStyle = ['#ff5c8a', '#ffd23f', '#ffffff', '#b45cff'][Math.floor(v * 4)];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 0.12 * s, -0.5 * s + Math.sin(a) * 0.12 * s, 0.09 * s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffb300';
      ctx.beginPath(); ctx.arc(0, -0.5 * s, 0.07 * s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'cactus': {
      const hgt = (1.5 + v * 1.2) * s;
      ctx.fillStyle = '#3f9a4f';
      roundRect(ctx, -0.22 * s, -hgt, 0.44 * s, hgt, 0.22 * s); ctx.fill();
      roundRect(ctx, -0.75 * s, -hgt * 0.7, 0.3 * s, hgt * 0.35, 0.15 * s); ctx.fill();
      ctx.fillRect(-0.6 * s, -hgt * 0.45, 0.4 * s, 0.22 * s);
      roundRect(ctx, 0.45 * s, -hgt * 0.85, 0.3 * s, hgt * 0.4, 0.15 * s); ctx.fill();
      ctx.fillRect(0.2 * s, -hgt * 0.55, 0.4 * s, 0.22 * s);
      break;
    }
    case 'rock':
      ctx.fillStyle = '#8a8580';
      ctx.beginPath(); ctx.ellipse(0, -0.2 * s, (0.5 + v * 0.4) * s, (0.35 + v * 0.2) * s, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.ellipse(-0.15 * s, -0.35 * s, 0.2 * s, 0.1 * s, -0.3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'skull':
      ctx.fillStyle = '#f3ead6';
      ctx.beginPath(); ctx.arc(0, -0.25 * s, 0.22 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.fillRect(-0.12 * s, -0.3 * s, 0.07 * s, 0.07 * s); ctx.fillRect(0.05 * s, -0.3 * s, 0.07 * s, 0.07 * s);
      break;
    case 'snowman':
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, -0.45 * s, 0.45 * s, 0, Math.PI * 2); ctx.arc(0, -1.15 * s, 0.32 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath(); ctx.moveTo(0, -1.15 * s); ctx.lineTo(0.35 * s, -1.1 * s); ctx.lineTo(0, -1.05 * s); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillRect(-0.25 * s, -1.6 * s, 0.5 * s, 0.12 * s); ctx.fillRect(-0.16 * s, -1.95 * s, 0.32 * s, 0.36 * s);
      break;
    case 'crater':
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(0, 0.05 * s, (0.6 + v * 0.8) * s, 0.15 * s, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'flag':
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.06 * s;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -1.8 * s); ctx.stroke();
      ctx.fillStyle = '#e30a17';
      ctx.fillRect(0, -1.8 * s, 0.9 * s, 0.6 * s);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0.35 * s, -1.5 * s, 0.17 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e30a17';
      ctx.beginPath(); ctx.arc(0.4 * s, -1.5 * s, 0.14 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0.6 * s, -1.5 * s, 0.05 * s, 0, Math.PI * 2); ctx.fill();
      break;
    case 'lavarock': {
      ctx.fillStyle = '#2a1714';
      ctx.beginPath(); ctx.moveTo(-0.7 * s, 0); ctx.lineTo(-0.3 * s, -0.9 * s); ctx.lineTo(0.4 * s, -0.7 * s); ctx.lineTo(0.8 * s, 0); ctx.fill();
      ctx.strokeStyle = `rgba(255,${120 + Math.sin(time * 3 + v * 9) * 60},30,0.9)`;
      ctx.lineWidth = 0.06 * s;
      ctx.beginPath(); ctx.moveTo(-0.3 * s, -0.8 * s); ctx.lineTo(-0.1 * s, -0.4 * s); ctx.lineTo(0.2 * s, -0.3 * s); ctx.stroke();
      break;
    }
    case 'deadtree':
      ctx.strokeStyle = '#1a0f0c'; ctx.lineWidth = 0.15 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -2 * s); ctx.moveTo(0, -1.2 * s); ctx.lineTo(0.6 * s, -1.8 * s);
      ctx.moveTo(0, -1.5 * s); ctx.lineTo(-0.5 * s, -2.1 * s); ctx.stroke();
      break;
    case 'lamp': {
      ctx.strokeStyle = '#555a66'; ctx.lineWidth = 0.1 * s;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -3.5 * s); ctx.lineTo(0.6 * s, -3.6 * s); ctx.stroke();
      const lg = ctx.createRadialGradient(0.6 * s, -3.4 * s, 0, 0.6 * s, -3.4 * s, 2.5 * s);
      lg.addColorStop(0, 'rgba(255,230,150,0.55)'); lg.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(0.6 * s, -3.5 * s); ctx.lineTo(-1 * s, 0); ctx.lineTo(2.2 * s, 0); ctx.fill();
      ctx.fillStyle = '#ffe9a6';
      ctx.beginPath(); ctx.arc(0.6 * s, -3.5 * s, 0.15 * s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'cone':
      ctx.fillStyle = '#ff6a1a';
      ctx.beginPath(); ctx.moveTo(-0.25 * s, 0); ctx.lineTo(0, -0.7 * s); ctx.lineTo(0.25 * s, 0); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-0.13 * s, -0.4 * s, 0.26 * s, 0.1 * s);
      break;
    case 'sign':
      ctx.fillStyle = '#777'; ctx.fillRect(-0.04 * s, -1.6 * s, 0.08 * s, 1.6 * s);
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.moveTo(0, -2.2 * s); ctx.lineTo(0.45 * s, -1.75 * s); ctx.lineTo(0, -1.3 * s); ctx.lineTo(-0.45 * s, -1.75 * s); ctx.fill();
      ctx.fillStyle = '#222'; ctx.font = `900 ${0.4 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, -1.75 * s);
      break;
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export { noise1 };
