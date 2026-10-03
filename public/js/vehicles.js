// Araç tanımları (fizik + çizim). Tüm ölçüler metre, y yukarı, orijin şasi merkezi.
// openTop: true olan araçlarda sürücü tamamen görünür; kapalı araçlarda cam arkasından.

const OUT = 'rgba(20,16,24,0.9)';

function poly(ctx, pts, fill, stroke = OUT, lw = 0.05) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}

function rrect(ctx, x, y, w, h, r, fill, stroke = OUT, lw = 0.05) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function light(ctx, x, y, r, color = '#fff6b0') {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 0.03; ctx.stroke();
}

function shine(ctx, pts) {
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fill();
}

const GLASS = 'rgba(150,215,255,0.38)';

// Metre ölçekli bağlamda yazı (tarayıcılar 1px altı fontları düzgün çizmez).
function textM(ctx, str, x, y, size, color = '#111') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 40, -size / 40);
  ctx.font = '900 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

// Pencere boşluklu gövde: sürücü pencereden görünsün diye "evenodd" ile doldurulur.
function bodyWithHole(ctx, outer, hole, fill, glass = GLASS) {
  ctx.beginPath();
  outer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  hole.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
  ctx.strokeStyle = OUT; ctx.lineWidth = 0.05; ctx.lineJoin = 'round';
  ctx.stroke();
  poly(ctx, hole, glass, '#222', 0.04);
  // cam yansıması
  ctx.save();
  ctx.beginPath(); hole.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
  const xs = hole.map((q) => q[0]), ys = hole.map((q) => q[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.moveTo(x0 + 0.2, y0); ctx.lineTo(x0 + 0.45, y0); ctx.lineTo(x0 + 0.75, y1); ctx.lineTo(x0 + 0.5, y1); ctx.fill();
  ctx.restore();
}

export const VEHICLES = {
  jeep: {
    name: 'Jeep', openTop: true, color: '#e8452c', dark: '#a52a17',
    chassis: [[-1.75, -0.32], [1.75, -0.32], [1.8, 0.2], [0.75, 0.32], [-1.75, 0.38]],
    density: 1.1,
    wheels: [{ x: -1.15, y: -0.6, r: 0.5, drive: true }, { x: 1.2, y: -0.6, r: 0.5, drive: true }],
    hz: 4.2, damping: 0.7, torque: 0.9, speed: 1, seat: [-0.35, 0.28], steer: [0.2, 0.7], driverScale: 1,
    back(ctx, v) {
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.09; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-1.35, 0.35); ctx.lineTo(-1.15, 1.35); ctx.lineTo(-0.55, 1.35); ctx.lineTo(-0.45, 0.35); ctx.stroke();
      rrect(ctx, -0.85, 0.25, 0.32, 0.75, 0.08, '#4a3a2e');
      // yedek lastik
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-1.88, 0.15, 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(-1.88, 0.15, 0.18, 0, Math.PI * 2); ctx.fill();
    },
    front(ctx, v) {
      poly(ctx, [[-1.8, -0.3], [1.82, -0.3], [1.85, 0.18], [0.8, 0.3], [0.35, 0.36], [-1.8, 0.4]], v.color);
      poly(ctx, [[0.35, 0.36], [0.8, 0.3], [1.85, 0.18], [1.85, 0.08], [0.4, 0.2]], v.dark, null);
      shine(ctx, [[-1.6, 0.3], [0.2, 0.28], [0.2, 0.2], [-1.6, 0.22]]);
      // ön cam çerçevesi
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 0.07;
      ctx.beginPath(); ctx.moveTo(0.4, 0.36); ctx.lineTo(0.12, 1.05); ctx.stroke();
      poly(ctx, [[0.42, 0.37], [0.15, 1.02], [0.28, 1.02], [0.52, 0.37]], GLASS, null);
      // kapı çizgisi ve tutamak
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.035;
      ctx.beginPath(); ctx.moveTo(-0.95, 0.35); ctx.lineTo(-0.95, -0.25); ctx.moveTo(0.3, 0.35); ctx.lineTo(0.3, -0.25); ctx.stroke();
      rrect(ctx, -0.15, 0.12, 0.28, 0.07, 0.03, '#333', null);
      light(ctx, 1.78, 0.02, 0.1);
      rrect(ctx, -1.86, -0.05, 0.1, 0.2, 0.03, '#ff3030');
      rrect(ctx, -1.9, -0.36, 3.8, 0.12, 0.05, '#2b2b2b', null);
    },
  },

  sport: {
    name: 'Spor Araba', openTop: false, color: '#ffcc00', dark: '#c79a00',
    chassis: [[-2.0, -0.25], [2.05, -0.25], [2.1, 0.05], [0.9, 0.3], [-0.1, 0.65], [-1.3, 0.6], [-2.0, 0.25]],
    density: 0.9,
    wheels: [{ x: -1.3, y: -0.38, r: 0.4, drive: true }, { x: 1.35, y: -0.38, r: 0.4, drive: false }],
    hz: 5, damping: 0.75, torque: 0.75, speed: 1.35, seat: [-0.5, -0.17], steer: [-0.02, 0.2], driverScale: 0.8,
    back(ctx) {
      poly(ctx, [[-1.3, 0.3], [0.85, 0.3], [-0.12, 0.66], [-1.25, 0.62]], 'rgba(20,24,40,0.85)', null);
    },
    front(ctx, v) {
      bodyWithHole(ctx, [[-2.05, -0.28], [2.1, -0.28], [2.15, 0.02], [1.6, 0.18], [0.9, 0.3], [-0.05, 0.7], [-1.35, 0.66], [-2.05, 0.3]],
        [[-1.2, 0.32], [0.78, 0.32], [-0.1, 0.6], [-1.15, 0.57]], v.color);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(-0.95, 0.32); ctx.lineTo(-0.92, 0.58); ctx.stroke();
      shine(ctx, [[-1.8, 0.2], [1.6, 0.1], [1.6, 0.05], [-1.8, 0.14]]);
      ctx.fillStyle = '#111';
      poly(ctx, [[-2.15, 0.28], [-1.75, 0.3], [-1.7, 0.4], [-2.2, 0.42]], '#111');
      light(ctx, 2.02, -0.02, 0.08);
      rrect(ctx, -2.1, 0.0, 0.1, 0.15, 0.03, '#ff2020');
      textM(ctx, 'GT', 0.5, 0.0, 0.28);
    },
  },

  monster: {
    name: 'Canavar Kamyon', openTop: false, color: '#2f6fe0', dark: '#1d4aa0',
    chassis: [[-1.7, -0.2], [1.7, -0.2], [1.75, 0.45], [0.55, 0.5], [0.3, 1.25], [-0.9, 1.25], [-1.0, 0.5], [-1.7, 0.5]],
    density: 0.9,
    wheels: [{ x: -1.25, y: -0.75, r: 0.88, drive: true }, { x: 1.25, y: -0.75, r: 0.88, drive: true }],
    hz: 2.8, damping: 0.55, torque: 1.0, speed: 0.95, seat: [-0.35, 0.23], steer: [0.1, 0.58], driverScale: 1,
    back(ctx) {
      ctx.strokeStyle = '#555'; ctx.lineWidth = 0.1;
      ctx.beginPath(); ctx.moveTo(-1.2, -0.2); ctx.lineTo(-1.25, -0.75); ctx.moveTo(1.2, -0.2); ctx.lineTo(1.25, -0.75); ctx.stroke();
      rrect(ctx, -0.95, 0.5, 1.3, 0.75, 0.1, 'rgba(20,24,40,0.85)', null);
    },
    front(ctx, v) {
      rrect(ctx, -1.6, -0.35, 3.2, 0.3, 0.08, '#333', null);
      bodyWithHole(ctx, [[-1.75, -0.12], [1.78, -0.12], [1.8, 0.48], [0.6, 0.52], [0.35, 1.3], [-0.95, 1.3], [-1.05, 0.52], [-1.75, 0.52]],
        [[-0.85, 0.6], [0.42, 0.6], [0.25, 1.2], [-0.85, 1.2]], v.color);
      // alevler
      ctx.fillStyle = '#ff8a1f';
      ctx.beginPath(); ctx.moveTo(1.7, 0.0); ctx.quadraticCurveTo(1.1, 0.35, 0.5, 0.05); ctx.quadraticCurveTo(0.9, 0.2, 0.7, 0.35);
      ctx.quadraticCurveTo(1.2, 0.3, 1.75, 0.35); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.moveTo(1.7, 0.08); ctx.quadraticCurveTo(1.25, 0.28, 0.9, 0.12); ctx.quadraticCurveTo(1.25, 0.32, 1.72, 0.28); ctx.closePath(); ctx.fill();
      shine(ctx, [[-1.6, 0.42], [-1.1, 0.42], [-1.1, 0.35], [-1.6, 0.35]]);
      light(ctx, 1.72, 0.25, 0.1);
      for (let i = 0; i < 4; i++) light(ctx, -0.65 + i * 0.25, 1.38, 0.07, '#ffe680');
      rrect(ctx, -1.82, 0.1, 0.1, 0.25, 0.03, '#ff2020');
    },
  },

  buggy: {
    name: 'Buggy', openTop: true, color: '#20b26b', dark: '#137447',
    chassis: [[-1.35, -0.2], [1.4, -0.2], [1.45, 0.15], [-1.35, 0.25]],
    density: 0.75,
    wheels: [{ x: -1.0, y: -0.55, r: 0.52, drive: true }, { x: 1.05, y: -0.55, r: 0.48, drive: true }],
    hz: 3.2, damping: 0.45, torque: 0.85, speed: 1.15, seat: [-0.3, 0.2], steer: [0.2, 0.55], driverScale: 1,
    back(ctx) {
      ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 0.08; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-1.1, 0.2); ctx.lineTo(-0.85, 1.3); ctx.lineTo(0.15, 1.3); ctx.lineTo(0.8, 0.2); ctx.stroke();
      rrect(ctx, -0.75, 0.15, 0.28, 0.7, 0.08, '#222');
    },
    front(ctx, v) {
      poly(ctx, [[-1.4, -0.22], [1.45, -0.22], [1.5, 0.12], [0.6, 0.22], [0.2, 0.18], [-0.2, 0.18], [-1.4, 0.28]], v.color);
      ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 0.08; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-0.85, 1.3); ctx.lineTo(-0.2, 0.2); ctx.moveTo(0.15, 1.3); ctx.lineTo(1.2, 0.12); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-0.75, 0.02, 0.15, 0, Math.PI * 2); ctx.fill();
      textM(ctx, '7', -0.75, 0.02, 0.24);
      light(ctx, 1.42, 0.0, 0.08);
      // egzoz
      rrect(ctx, -1.6, 0.05, 0.3, 0.1, 0.04, '#888');
    },
  },

  tractor: {
    name: 'Traktör', openTop: true, color: '#d93a2b', dark: '#8f2016',
    chassis: [[-1.2, -0.2], [1.6, -0.2], [1.6, 0.45], [0.3, 0.5], [-1.2, 0.5]],
    density: 3,
    wheels: [{ x: -0.8, y: -0.35, r: 0.88, drive: true }, { x: 1.25, y: -0.65, r: 0.46, drive: true }],
    hz: 4, damping: 0.7, torque: 1.1, speed: 0.75, seat: [-0.65, 0.55], steer: [-0.15, 0.95], driverScale: 1,
    back(ctx) {
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.07;
      ctx.beginPath(); ctx.moveTo(-1.15, 0.5); ctx.lineTo(-1.15, 1.85); ctx.moveTo(0.1, 0.5); ctx.lineTo(0.1, 1.85); ctx.stroke();
      rrect(ctx, -1.0, 0.45, 0.32, 0.6, 0.08, '#222');
    },
    front(ctx, v) {
      poly(ctx, [[-0.2, -0.2], [1.65, -0.2], [1.7, 0.5], [-0.2, 0.55]], v.color);
      for (let i = 0; i < 4; i++) rrect(ctx, 1.62, -0.1 + i * 0.13, 0.1, 0.07, 0.02, '#333', null);
      poly(ctx, [[-1.25, 0.1], [-0.2, 0.1], [-0.2, 0.55], [-0.35, 0.6], [-1.25, 0.55]], v.dark);
      rrect(ctx, -1.3, 1.82, 1.55, 0.14, 0.05, '#ffcc00');
      rrect(ctx, 0.9, 0.5, 0.12, 0.6, 0.04, '#555');
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(0.96, 1.12, 0.1, 0.05, 0, 0, Math.PI * 2); ctx.fill();
      light(ctx, 1.6, 0.35, 0.09);
      shine(ctx, [[0.0, 0.45], [1.5, 0.42], [1.5, 0.36], [0.0, 0.39]]);
    },
    smoke: [0.96, 1.15],
  },

  truck: {
    name: 'Kamyon', openTop: false, color: '#f07c1b', dark: '#b65506',
    chassis: [[-2.6, -0.3], [2.3, -0.3], [2.35, 0.6], [1.1, 1.35], [0.2, 1.35], [0.2, 0.8], [-2.6, 0.8]],
    density: 1.0,
    wheels: [
      { x: -2.0, y: -0.6, r: 0.5, drive: true }, { x: -0.95, y: -0.6, r: 0.5, drive: true },
      { x: 1.65, y: -0.6, r: 0.5, drive: false },
    ],
    hz: 4.5, damping: 0.8, torque: 0.8, speed: 0.85, seat: [0.7, 0.27], steer: [1.1, 0.58], driverScale: 0.95,
    back(ctx) {
      rrect(ctx, 0.3, 0.6, 1.4, 0.7, 0.08, 'rgba(20,24,40,0.85)', null);
    },
    front(ctx, v) {
      rrect(ctx, -2.65, 0.65, 2.75, 1.2, 0.08, '#e9e9ef');
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.04;
      for (let x = -2.4; x < 0; x += 0.35) { ctx.beginPath(); ctx.moveTo(x, 0.7); ctx.lineTo(x, 1.8); ctx.stroke(); }
      textM(ctx, 'KARGO', -1.27, 1.25, 0.42, '#f07c1b');
      rrect(ctx, -2.7, -0.35, 5.05, 0.3, 0.06, '#333', null);
      bodyWithHole(ctx, [[0.15, -0.1], [2.38, -0.1], [2.4, 0.62], [1.15, 1.4], [0.15, 1.4]],
        [[0.35, 0.65], [1.75, 0.65], [1.12, 1.25], [0.35, 1.25]], v.color);
      light(ctx, 2.3, 0.3, 0.11);
      rrect(ctx, 2.2, -0.15, 0.25, 0.2, 0.04, '#bbb');
    },
  },

  kart: {
    name: 'Go-Kart', openTop: true, color: '#b14cff', dark: '#7322b5',
    chassis: [[-1.0, -0.12], [1.05, -0.12], [1.1, 0.08], [-1.0, 0.12]],
    density: 3.2,
    wheels: [{ x: -0.75, y: -0.28, r: 0.32, drive: true }, { x: 0.8, y: -0.3, r: 0.3, drive: false }],
    hz: 6, damping: 0.8, torque: 0.8, speed: 1.4, seat: [-0.3, 0.02], steer: [0.2, 0.35], driverScale: 0.95,
    back(ctx) {
      rrect(ctx, -0.7, -0.05, 0.25, 0.6, 0.08, '#222');
    },
    front(ctx, v) {
      poly(ctx, [[-1.05, -0.15], [1.1, -0.15], [1.18, 0.05], [0.6, 0.18], [-0.15, 0.1], [-1.05, 0.12]], v.color);
      rrect(ctx, 0.95, -0.05, 0.3, 0.25, 0.06, v.dark);
      rrect(ctx, -1.2, -0.05, 0.3, 0.2, 0.05, '#666');
      shine(ctx, [[-0.9, 0.08], [0.5, 0.1], [0.5, 0.04], [-0.9, 0.02]]);
    },
  },
};

export const VEHICLE_IDS = Object.keys(VEHICLES);

// Özel (görsel dosyalı) araç tanımı oluştur.
export function makeCustomVehicle(id, c, image, wheelImage) {
  const w = c.width || 4;
  const ar = image && image.naturalWidth ? image.naturalHeight / image.naturalWidth : 0.45;
  const h = w * ar;
  const r = c.wheelRadius || w * 0.12;
  const wy = -h / 2 + (c.wheelY ?? 0.18) * h;
  return {
    name: c.name || id, openTop: !!c.openTop, custom: true, color: '#888', dark: '#555',
    chassis: [[-w / 2, -h * 0.25], [w / 2, -h * 0.25], [w / 2, h * 0.15], [-w / 2, h * 0.15]],
    density: c.density || 1,
    wheels: [
      { x: -w / 2 + (c.rearX ?? 0.2) * w, y: wy, r, drive: true },
      { x: -w / 2 + (c.frontX ?? 0.8) * w, y: wy, r, drive: c.awd !== false },
    ],
    hz: c.suspension || 4, damping: 0.7, torque: c.torque || 1, speed: c.speed || 1,
    seat: [-w / 2 + (c.seatX ?? 0.45) * w, -h / 2 + (c.seatY ?? 0.45) * h],
    steer: [-w / 2 + (c.seatX ?? 0.45) * w + 0.6, -h / 2 + (c.seatY ?? 0.45) * h + 0.4],
    driverScale: c.driverScale || 1,
    hideWheels: !!c.hideWheels,
    wheelImage,
    back() {},
    front(ctx) {
      if (!image || !image.naturalWidth) return;
      ctx.save();
      ctx.scale(1, -1);
      ctx.drawImage(image, -w / 2 + (c.offsetX || 0), -h / 2 - (c.offsetY || 0), w, h);
      ctx.restore();
    },
  };
}

// Fiziksel araç örneği
export class Vehicle {
  constructor(world, def, x, y, scale = 1) {
    this.world = world;
    this.def = def;
    this.scale = scale;
    this.color = def.color;
    this.dark = def.dark;
    this.wheels = [];
    this.build(x, y, 0);
  }

  build(x, y, angle) {
    const d = this.def, s = this.scale;
    const chassis = this.world.createBody({
      type: 'dynamic', position: planck.Vec2(x, y), angle, angularDamping: 0.6,
    });
    chassis.createFixture(new planck.Polygon(d.chassis.map(([px, py]) => planck.Vec2(px * s, py * s))), {
      density: d.density * 1.0, friction: 0.5, filterGroupIndex: -1,
    });
    chassis.setUserData({ kind: 'car' });
    this.chassis = chassis;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    this.wheels = d.wheels.map((wd, i) => {
      const lx = wd.x * s, ly = wd.y * s;
      const pos = planck.Vec2(x + lx * cos - ly * sin, y + lx * sin + ly * cos);
      const body = this.world.createBody({ type: 'dynamic', position: pos, angle, angularDamping: 0.2 });
      const radius = wd.r * s;
      const fixture = body.createFixture(new planck.Circle(radius), {
        density: 1.2, friction: 0.95, restitution: 0.05, filterGroupIndex: -1,
      });
      body.setUserData({ kind: 'wheel', index: i });
      const joint = this.world.createJoint(new planck.WheelJoint({
        enableMotor: true, motorSpeed: 0, maxMotorTorque: 0,
        frequencyHz: d.hz, dampingRatio: d.damping,
      }, chassis, body, pos, planck.Vec2(-sin, cos)));
      return { body, fixture, joint, def: wd, radius, baseRadius: radius, popped: false, grounded: false };
    });
    this.nDrive = Math.max(1, this.wheels.filter((w) => w.def.drive).length);
  }

  destroy() {
    for (const w of this.wheels) this.world.destroyBody(w.body);
    this.world.destroyBody(this.chassis);
    this.wheels = [];
  }

  get pos() { return this.chassis.getPosition(); }
  get angle() { return this.chassis.getAngle(); }
  get vel() { return this.chassis.getLinearVelocity(); }

  // speed: hedef hız (m/s), torqueMul: tork çarpanı.
  // Tork, aracın kütlesi × yerçekimi × teker yarıçapı ile ölçeklenir; böylece her araç
  // ve her yerçekiminde (Ay dahil) yokuş çıkabilir ama motor tepkisiyle şaha kalkmaz.
  drive(speed, torqueMul = 1) {
    const g = Math.max(3, Math.abs(this.world.getGravity().y));
    const base = (this.def.torque * this.mass * g) / this.nDrive;
    for (const w of this.wheels) {
      const popMul = w.popped ? 0.45 : 1;
      w.joint.setMotorSpeed(-(speed / w.radius));
      w.joint.setMaxMotorTorque(w.def.drive ? base * w.radius * torqueMul * popMul : 0);
    }
  }

  // Denge yardımı: havadayken aracı yataya çeker, yerdeyken aşırı şaha kalkmayı sınırlar.
  stabilize(terrain) {
    const c = this.chassis, I = c.getInertia(), w = c.getAngularVelocity();
    const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    if (!this.wheels.some((wh) => wh.grounded)) {
      c.applyTorque((-norm(this.angle) * 6 - w * 1.5) * I, true);
      return;
    }
    const rel = norm(this.angle - Math.atan(terrain.slopeAt(this.pos.x)));
    if (Math.abs(rel) > 0.55) c.applyTorque((-(rel - Math.sign(rel) * 0.55) * 30 - w * 3) * I, true);
  }

  popTire(i) {
    const w = this.wheels[i];
    if (!w || w.popped) return false;
    w.popped = true;
    w.body.destroyFixture(w.fixture);
    w.radius = w.baseRadius * 0.74;
    w.fixture = w.body.createFixture(new planck.Circle(w.radius), {
      density: 1.2, friction: 0.55, restitution: 0, filterGroupIndex: -1,
    });
    w.popTime = 0;
    return true;
  }

  repairWheel(i) {
    const w = this.wheels[i];
    if (!w || !w.popped) return false;
    w.popped = false;
    w.body.destroyFixture(w.fixture);
    w.radius = w.baseRadius;
    w.fixture = w.body.createFixture(new planck.Circle(w.radius), {
      density: 1.2, friction: 0.95, restitution: 0.05, filterGroupIndex: -1,
    });
    // tekerlek yeniden şiştiğinde zemine gömülmesin
    const p = w.body.getPosition();
    w.body.setTransform(planck.Vec2(p.x, p.y + (w.baseRadius * 0.26)), w.body.getAngle());
    return true;
  }

  repair() {
    let any = false;
    for (let i = 0; i < this.wheels.length; i++) any = this.repairWheel(i) || any;
    return any;
  }

  // Şasi merkezinden tekerlek altına mesafe (zemine yerleştirmek için)
  get clearance() {
    return Math.max(...this.def.wheels.map((w) => -(w.y - w.r))) * this.scale + 0.1;
  }

  setFriction(mul) {
    for (const w of this.wheels) w.fixture.setFriction((w.popped ? 0.55 : 0.95) * mul);
  }

  setEnabled(on) {
    this.chassis.setActive(on);
    for (const w of this.wheels) w.body.setActive(on);
  }

  // Tüm aracı (tekerleklerle birlikte) belirli konum/açıya taşı
  setTransform(x, y, angle) {
    const s = this.scale, cos = Math.cos(angle), sin = Math.sin(angle);
    this.chassis.setTransform(planck.Vec2(x, y), angle);
    for (const w of this.wheels) {
      const t = w.joint.getJointTranslation ? w.joint.getJointTranslation() : 0;
      const lx = w.def.x * s, ly = w.def.y * s + t * 0;
      w.body.setTransform(planck.Vec2(x + lx * cos - ly * sin, y + lx * sin + ly * cos), w.body.getAngle());
    }
  }

  setVelocity(vx, vy, av = 0) {
    this.chassis.setLinearVelocity(planck.Vec2(vx, vy));
    this.chassis.setAngularVelocity(av);
    for (const w of this.wheels) {
      w.body.setLinearVelocity(planck.Vec2(vx, vy));
    }
  }

  applyForce(fx, fy) {
    this.chassis.applyForceToCenter(planck.Vec2(fx, fy), true);
  }

  applyImpulse(ix, iy) {
    this.chassis.applyLinearImpulse(planck.Vec2(ix, iy), this.chassis.getWorldCenter(), true);
  }

  get mass() {
    return this.chassis.getMass() + this.wheels.reduce((a, w) => a + w.body.getMass(), 0);
  }

  // Yerel noktayı dünya koordinatına çevir
  local(lx, ly) {
    const p = this.pos, a = this.angle, s = this.scale;
    const cos = Math.cos(a), sin = Math.sin(a);
    return [p.x + (lx * cos - ly * sin) * s, p.y + (lx * sin + ly * cos) * s];
  }

  updateGrounded(terrain) {
    let n = 0;
    for (const w of this.wheels) {
      const p = w.body.getPosition();
      w.grounded = p.y - w.radius - terrain.heightAt(p.x) < 0.15;
      if (w.grounded) n++;
    }
    return n;
  }

  // Çizim: cam = kamera, driver = Driver örneği
  draw(ctx, cam, driver, time, opts = {}) {
    const p = this.pos, a = this.angle, s = this.scale;
    const [sx, sy] = cam.toScreen(p.x, p.y);
    const d = this.def;
    const v = { color: this.color, dark: this.dark };

    // gölge
    const gy = cam.toScreen(p.x, opts.groundY ?? p.y - 1)[1];
    const dist = Math.max(0, (sy - gy) / -cam.ppm);
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0, 0.25 - dist * 0.03)})`;
    ctx.beginPath(); ctx.ellipse(sx, gy, 2 * cam.ppm * s, 0.18 * cam.ppm * s, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-a);
    ctx.scale(cam.ppm * s, -cam.ppm * s);
    // Katman düzeni: arka parçalar -> sürücü -> gövde -> (tekerlekler ayrıca)
    d.back(ctx, v, time);
    if (driver && !(d.custom && !d.openTop)) driver.draw(ctx, d, time, opts);
    if (opts.shieldFlash) ctx.globalAlpha = 0.7;
    d.front(ctx, v, time);
    ctx.globalAlpha = 1;
    ctx.restore();

    if (!d.hideWheels) for (const w of this.wheels) this.drawWheel(ctx, cam, w, time);
  }

  drawWheel(ctx, cam, w, time) {
    const p = w.body.getPosition(), a = w.body.getAngle();
    const [sx, sy] = cam.toScreen(p.x, p.y);
    const r = w.baseRadius * cam.ppm;
    ctx.save();
    ctx.translate(sx, sy);
    if (w.popped) {
      // patlak lastik: alttan basık
      const squash = 0.74;
      ctx.fillStyle = '#1b1b1b';
      ctx.beginPath();
      ctx.ellipse(0, r * (1 - squash) * 0.5, r * 1.08, r * squash, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(-a);
      ctx.fillStyle = '#9aa0a8';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#555'; ctx.lineWidth = r * 0.08;
      for (let k = 0; k < 5; k++) {
        const an = (k / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * r * 0.42, Math.sin(an) * r * 0.42); ctx.stroke();
      }
      ctx.restore();
      return;
    }
    ctx.rotate(-a);
    if (this.def.wheelImage?.naturalWidth) {
      ctx.drawImage(this.def.wheelImage, -r, -r, r * 2, r * 2);
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#1d1d1f';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // diş izleri
    ctx.fillStyle = '#2e2e32';
    const teeth = Math.max(10, Math.round(r / 4));
    for (let k = 0; k < teeth; k++) {
      const an = (k / teeth) * Math.PI * 2;
      ctx.save(); ctx.rotate(an);
      ctx.fillRect(r * 0.86, -r * 0.08, r * 0.16, r * 0.16);
      ctx.restore();
    }
    ctx.fillStyle = '#2a2a2e';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2); ctx.fill();
    const rg = ctx.createRadialGradient(-r * 0.15, -r * 0.15, r * 0.05, 0, 0, r * 0.55);
    rg.addColorStop(0, '#f2f4f7'); rg.addColorStop(1, '#8d95a1');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5b626d'; ctx.lineWidth = Math.max(1, r * 0.09);
    for (let k = 0; k < 5; k++) {
      const an = (k / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * 0.12, Math.sin(an) * r * 0.12);
      ctx.lineTo(Math.cos(an) * r * 0.5, Math.sin(an) * r * 0.5); ctx.stroke();
    }
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
