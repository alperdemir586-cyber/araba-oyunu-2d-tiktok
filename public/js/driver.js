// 2D sürücü karakteri. Araç yerel koordinatlarında (metre, y yukarı) çizilir.
// Kafa ve gövde yay-sönümleyici ile aracın ivmesine tepki verir (sarsıntı, zıplama, fren).

const SKIN = '#f2c39b', SKIN_DARK = '#d99e74';

export class Driver {
  constructor(style = {}) {
    this.style = {
      helmet: '#ff3b5c', stripe: '#ffffff', jacket: '#2a6df4', jacketDark: '#1a4bb0',
      scarf: '#ffcf33', hair: '#4a2b1a', glove: '#222', ...style,
    };
    // yay durumları (araç yerel ekseninde)
    this.ox = 0; this.oy = 0; this.vx = 0; this.vy = 0;
    this.lean = 0; this.leanV = 0;
    this.blink = 0; this.nextBlink = 2;
    this.mood = 'normal';
    this.moodTime = 0;
    this.scarfPhase = 0;
    this.speed = 0;
    this.airborne = false;
    this.prevV = null;
  }

  setMood(mood, time = 1.5) {
    this.mood = mood;
    this.moodTime = time;
  }

  // vel: dünya hızı {x,y}, angle: araç açısı, dt
  update(dt, vel, angle, airborne, extra = {}) {
    if (dt <= 0) return;
    let ax = 0, ay = 0;
    if (this.prevV) {
      const dvx = (vel.x - this.prevV.x) / dt, dvy = (vel.y - this.prevV.y) / dt;
      // dünya ivmesini araç eksenine çevir (yerçekimini de hisset)
      const gx = dvx, gy = dvy + 10;
      const c = Math.cos(-angle), s = Math.sin(-angle);
      ax = gx * c - gy * s;
      ay = gx * s + gy * c - 10;
    }
    this.prevV = { x: vel.x, y: vel.y };
    ax = Math.max(-80, Math.min(80, ax));
    ay = Math.max(-80, Math.min(80, ay));
    // Kafa: atalet ile ivmenin tersine kayar
    const k = 160, c = 12;
    this.vx += (-k * this.ox - c * this.vx - ax * 0.35) * dt;
    this.vy += (-k * this.oy - c * this.vy - ay * 0.25) * dt;
    this.ox += this.vx * dt; this.oy += this.vy * dt;
    this.ox = Math.max(-0.14, Math.min(0.14, this.ox));
    this.oy = Math.max(-0.1, Math.min(0.1, this.oy));
    // Gövde eğilmesi
    const kl = 60, cl = 9;
    this.leanV += (-kl * this.lean - cl * this.leanV - ax * 0.02) * dt;
    this.lean += this.leanV * dt;
    this.lean = Math.max(-0.35, Math.min(0.35, this.lean));

    this.speed = Math.hypot(vel.x, vel.y);
    this.airborne = airborne;
    this.scarfPhase += dt * (4 + this.speed * 0.8);
    this.blink -= dt;
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blink = 0.13; this.nextBlink = 2 + Math.random() * 3; }
    if (this.moodTime > 0) {
      this.moodTime -= dt;
      if (this.moodTime <= 0) this.mood = 'normal';
    }
    this.auto = extra.fuelEmpty ? 'sleepy' : airborne && this.speed > 4 ? 'scared' : null;
  }

  currentMood() {
    if (this.moodTime > 0) return this.mood;
    return this.auto || 'normal';
  }

  draw(ctx, def, time) {
    const st = this.style;
    const sc = def.driverScale || 1;
    const [seatX, seatY] = def.seat;
    const [steerX, steerY] = def.steer;
    ctx.save();
    ctx.translate(seatX, seatY);
    ctx.scale(sc, sc);
    const lean = this.lean - 0.12; // hafif arkaya yaslanma
    const shoulder = [Math.sin(-lean) * 0.5 + this.ox * 0.4, Math.cos(lean) * 0.5 + this.oy * 0.3];
    const head = [shoulder[0] + this.ox * 0.6 + 0.03, shoulder[1] + 0.24 + this.oy * 0.5];
    const headTilt = this.ox * 1.8 + this.vx * 0.04;

    // atkı (gövdenin arkasında dalgalanır)
    const flow = Math.min(1, this.speed / 12);
    ctx.strokeStyle = st.scarf;
    ctx.lineWidth = 0.09;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulder[0], shoulder[1] + 0.06);
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      ctx.lineTo(
        shoulder[0] - t * (0.25 + flow * 0.45),
        shoulder[1] + 0.06 - t * (0.35 - flow * 0.3) + Math.sin(this.scarfPhase - i * 1.1) * 0.05 * t * (0.4 + flow),
      );
    }
    ctx.stroke();

    // gövde (ceket)
    ctx.save();
    ctx.rotate(-lean * 0.6);
    ctx.fillStyle = st.jacket;
    ctx.strokeStyle = 'rgba(20,16,24,0.9)';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(-0.17, -0.02);
    ctx.quadraticCurveTo(-0.2, 0.3, -0.13, 0.52);
    ctx.quadraticCurveTo(0.0, 0.6, 0.14, 0.5);
    ctx.quadraticCurveTo(0.2, 0.25, 0.17, -0.02);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = st.jacketDark;
    ctx.beginPath(); ctx.moveTo(0.02, 0.5); ctx.lineTo(0.14, 0.5); ctx.quadraticCurveTo(0.2, 0.25, 0.17, -0.02); ctx.lineTo(0.06, -0.02); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.015;
    ctx.beginPath(); ctx.moveTo(0.04, 0.48); ctx.lineTo(0.05, 0.0); ctx.stroke();
    // emniyet kemeri
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.moveTo(-0.12, 0.48); ctx.lineTo(0.14, 0.02); ctx.stroke();
    ctx.restore();

    // boyun
    ctx.strokeStyle = SKIN_DARK; ctx.lineWidth = 0.09;
    ctx.beginPath(); ctx.moveTo(shoulder[0], shoulder[1]); ctx.lineTo(head[0] - 0.01, head[1] - 0.12); ctx.stroke();

    // direksiyon
    const sx = (steerX - seatX) / sc, sy = (steerY - seatY) / sc;
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.moveTo(sx + 0.12, sy - 0.25); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(0.35);
    ctx.strokeStyle = '#1f1f1f'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.05, 0.17, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // kol (2 parçalı IK) — omuzdan direksiyona
    const hand = [sx + Math.sin(time * 9) * 0.008 * Math.min(1, this.speed / 5), sy + 0.1];
    this.drawArm(ctx, shoulder, hand, st);

    // kafa
    ctx.save();
    ctx.translate(head[0], head[1]);
    ctx.rotate(-headTilt);
    this.drawHead(ctx, st, time);
    ctx.restore();

    ctx.restore();
  }

  drawArm(ctx, s, h, st) {
    const L1 = 0.27, L2 = 0.27;
    let dx = h[0] - s[0], dy = h[1] - s[1];
    let d = Math.hypot(dx, dy);
    const maxD = L1 + L2 - 0.001;
    if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
    const a = Math.atan2(dy, dx);
    const cosB = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
    const b = Math.acos(Math.max(-1, Math.min(1, cosB)));
    const elbow = [s[0] + Math.cos(a - b) * L1, s[1] + Math.sin(a - b) * L1];
    const hand = [s[0] + dx, s[1] + dy];
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(20,16,24,0.9)'; ctx.lineWidth = 0.11;
    ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(elbow[0], elbow[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
    ctx.strokeStyle = st.jacket; ctx.lineWidth = 0.08;
    ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(elbow[0], elbow[1]); ctx.lineTo(hand[0], hand[1]); ctx.stroke();
    ctx.fillStyle = st.glove;
    ctx.beginPath(); ctx.arc(hand[0], hand[1], 0.055, 0, Math.PI * 2); ctx.fill();
  }

  drawHead(ctx, st, time) {
    const mood = this.currentMood();
    const R = 0.19;
    // saç (kaskın altından arkaya uçuşur)
    const flow = Math.min(1, this.speed / 12);
    ctx.fillStyle = st.hair;
    ctx.beginPath();
    ctx.moveTo(-0.12, -0.02);
    for (let i = 0; i < 3; i++) {
      const y = -0.03 - i * 0.05;
      ctx.lineTo(-0.2 - flow * 0.12 - Math.sin(this.scarfPhase * 1.3 + i) * 0.025, y - 0.02);
      ctx.lineTo(-0.15, y - 0.04);
    }
    ctx.lineTo(-0.1, -0.12);
    ctx.closePath(); ctx.fill();

    // yüz
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = 'rgba(20,16,24,0.9)'; ctx.lineWidth = 0.025;
    ctx.beginPath(); ctx.ellipse(0.01, 0, R * 0.95, R, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // kulak
    ctx.fillStyle = SKIN_DARK;
    ctx.beginPath(); ctx.ellipse(-0.06, -0.01, 0.035, 0.05, 0, 0, Math.PI * 2); ctx.fill();
    // yanak
    ctx.fillStyle = 'rgba(255,110,110,0.35)';
    ctx.beginPath(); ctx.ellipse(0.12, -0.07, 0.04, 0.025, 0, 0, Math.PI * 2); ctx.fill();
    // burun
    ctx.fillStyle = SKIN_DARK;
    ctx.beginPath(); ctx.moveTo(0.17, 0.0); ctx.quadraticCurveTo(0.23, -0.04, 0.17, -0.06); ctx.fill();

    // göz
    const ex = 0.11, ey = 0.03;
    if (mood === 'dizzy') {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 0.015;
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const a = i * 0.7 + time * 8, r = 0.003 * i;
        ctx.lineTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
      }
      ctx.stroke();
    } else {
      const open = this.blink > 0 ? 0.15 : mood === 'sleepy' ? 0.35 : mood === 'scared' ? 1.25 : mood === 'happy' ? 0.85 : 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(ex, ey, 0.04, 0.05 * open, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 0.012; ctx.stroke();
      if (open > 0.3) {
        ctx.fillStyle = '#1b1b1b';
        const look = mood === 'scared' ? 0.0 : 0.012;
        ctx.beginPath(); ctx.arc(ex + look, ey - 0.003, 0.022 * Math.min(1, open), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex + look + 0.008, ey + 0.01, 0.007, 0, Math.PI * 2); ctx.fill();
      }
    }
    // kaş
    ctx.strokeStyle = st.hair; ctx.lineWidth = 0.022; ctx.lineCap = 'round';
    const brow = mood === 'angry' || mood === 'determined' ? -0.03 : mood === 'scared' ? 0.03 : 0;
    ctx.beginPath(); ctx.moveTo(ex - 0.04, ey + 0.07 + brow * 0.3); ctx.lineTo(ex + 0.05, ey + 0.07 - brow); ctx.stroke();

    // ağız
    ctx.strokeStyle = '#5a1e1e'; ctx.fillStyle = '#5a1e1e'; ctx.lineWidth = 0.018;
    const mx = 0.12, my = -0.1;
    if (mood === 'scared' || mood === 'dizzy') {
      ctx.beginPath(); ctx.ellipse(mx, my, 0.03, 0.04, 0, 0, Math.PI * 2); ctx.fill();
    } else if (mood === 'happy') {
      ctx.beginPath(); ctx.moveTo(mx - 0.05, my + 0.015); ctx.quadraticCurveTo(mx, my - 0.06, mx + 0.06, my + 0.02); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(mx - 0.03, my - 0.005, 0.06, 0.015);
    } else if (mood === 'sleepy' || mood === 'angry') {
      ctx.beginPath(); ctx.moveTo(mx - 0.04, my - 0.01); ctx.quadraticCurveTo(mx, my + 0.015, mx + 0.04, my - 0.01); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(mx - 0.04, my + 0.01); ctx.quadraticCurveTo(mx + 0.005, my - 0.025, mx + 0.05, my + 0.015); ctx.stroke();
    }

    // kask
    ctx.fillStyle = st.helmet;
    ctx.strokeStyle = 'rgba(20,16,24,0.9)'; ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(-0.2, -0.02);
    ctx.bezierCurveTo(-0.22, 0.22, 0.02, 0.3, 0.16, 0.2);
    ctx.quadraticCurveTo(0.23, 0.14, 0.22, 0.08);
    ctx.lineTo(0.05, 0.1);
    ctx.quadraticCurveTo(-0.05, 0.06, -0.08, -0.04);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // şerit
    ctx.strokeStyle = st.stripe; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.moveTo(-0.17, 0.12); ctx.quadraticCurveTo(-0.02, 0.27, 0.15, 0.2); ctx.stroke();
    // gözlük (alnın üstünde)
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.ellipse(0.12, 0.13, 0.065, 0.04, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,200,255,0.85)';
    ctx.beginPath(); ctx.ellipse(0.125, 0.13, 0.045, 0.026, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(0.11, 0.14, 0.01, 0, Math.PI * 2); ctx.fill();
  }
}

// Yolcu: büyük hediye gönderen izleyici. Yüzü izleyicinin profil fotoğrafıdır.
// p = { user, img, t, max }  — sürücünün yay hareketini (sarsıntı) biraz gecikmeli paylaşır.
export function drawPassenger(ctx, def, p, driver, time) {
  const sc = (def.driverScale || 1) * 0.95;
  const [px, py] = def.passenger || [def.seat[0] - 0.55, def.seat[1]];
  const fadeIn = Math.min(1, (p.max - p.t) / 0.4);
  const ending = p.t < 3 ? 0.55 + 0.45 * Math.abs(Math.sin(time * 6)) : 1; // bitmeden önce yanıp söner
  ctx.save();
  ctx.globalAlpha *= fadeIn * ending;
  ctx.translate(px, py);
  ctx.scale(sc, sc);
  const ox = driver.ox * 1.25 + Math.sin(time * 3.1) * 0.006, oy = driver.oy * 1.2;
  const shoulder = [0.07 + ox * 0.4, 0.6 + oy * 0.3]; // arka koltukta biraz yüksekte
  const head = [shoulder[0] + ox * 0.7 + 0.03, shoulder[1] + 0.27 + oy * 0.5];

  // gövde (kapüşonlu)
  ctx.fillStyle = '#ff4f8b';
  ctx.strokeStyle = 'rgba(20,16,24,0.9)';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.moveTo(-0.17, -0.02);
  ctx.quadraticCurveTo(-0.2, 0.3, -0.12, 0.53);
  ctx.quadraticCurveTo(0.02, 0.62, 0.15, 0.5);
  ctx.quadraticCurveTo(0.2, 0.25, 0.17, -0.02);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d63a72';
  ctx.beginPath(); ctx.ellipse(0.0, 0.25, 0.08, 0.05, 0, 0, Math.PI * 2); ctx.fill();

  // sallanan el (selam veriyor)
  const wave = Math.sin(time * 7) * 0.12;
  const hand = [shoulder[0] + 0.3, shoulder[1] + 0.32 + wave * 0.3];
  const elbow = [shoulder[0] + 0.22, shoulder[1] + 0.05];
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(20,16,24,0.9)'; ctx.lineWidth = 0.11;
  ctx.beginPath(); ctx.moveTo(...shoulder); ctx.lineTo(...elbow); ctx.lineTo(hand[0] + wave * 0.2, hand[1]); ctx.stroke();
  ctx.strokeStyle = '#ff4f8b'; ctx.lineWidth = 0.08;
  ctx.beginPath(); ctx.moveTo(...shoulder); ctx.lineTo(...elbow); ctx.lineTo(hand[0] + wave * 0.2, hand[1]); ctx.stroke();
  ctx.fillStyle = '#f2c39b';
  ctx.beginPath(); ctx.arc(hand[0] + wave * 0.2, hand[1], 0.055, 0, Math.PI * 2); ctx.fill();

  // boyun
  ctx.strokeStyle = '#d99e74'; ctx.lineWidth = 0.09;
  ctx.beginPath(); ctx.moveTo(...shoulder); ctx.lineTo(head[0], head[1] - 0.14); ctx.stroke();

  // kafa = profil fotoğrafı
  const R = 0.23;
  ctx.save();
  ctx.translate(head[0], head[1]);
  ctx.rotate(-(ox * 1.6));
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(0, 0, R + 0.035, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
  const img = p.img;
  if (img && img.complete && img.naturalWidth) {
    ctx.scale(1, -1);
    ctx.drawImage(img, -R, -R, R * 2, R * 2);
  } else {
    const name = p.user.nickname || '?';
    let hsh = 0;
    for (let i = 0; i < name.length; i++) hsh = (hsh * 31 + name.charCodeAt(i)) | 0;
    ctx.fillStyle = `hsl(${Math.abs(hsh) % 360},70%,55%)`;
    ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.scale(R / 20, -R / 20);
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText((name[0] || '?').toUpperCase(), 0, 2);
  }
  ctx.restore();
  ctx.restore();
}
