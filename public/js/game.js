// Oyun çekirdeği: fizik dünyası, araç, arazi, kamera, yakıt, eylemlerin yürütülmesi.
import { Terrain } from './terrain.js';
import { MAPS, MAP_IDS, drawBackground } from './maps.js';
import { VEHICLES, VEHICLE_IDS, Vehicle, makeCustomVehicle } from './vehicles.js';
import { Driver } from './driver.js';
import { Effects } from './effects.js';
import { Hazards } from './hazards.js';
import { RuleEngine, ActionQueue } from './rules.js';
import { runAction } from './actions.js';
import { ACTIONS } from './catalog.js';

const FIXED = 1 / 60;
const TAU = Math.PI * 2;
const normAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class Game {
  constructor({ canvas, config, assets, sound, hud }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;
    this.assets = assets;
    this.sound = sound;
    this.hud = hud;
    this.effects = new Effects();
    this.rules = new RuleEngine(() => this.config);
    this.queue = new ActionQueue(this);
    this.cam = { x: 0, y: 0, ppm: 50, w: 800, h: 600, toScreen: (x, y) => this.toScreen(x, y) };
    this.time = 0;
    this.paused = false;
    this.scheduled = [];
    this.viewerTags = [];
    this.portals = [];
    this.markers = [];
    this.leaders = new Map();
    this.round = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.restart();
  }

  get settings() { return this.config.settings; }

  setConfig(config) {
    this.config = config;
    this.sound.setVolume(config.settings.volume);
    this.sound.enabled = config.settings.sound;
  }

  // ---------------- Kurulum ----------------
  restart() {
    if (this.world) {
      this.hazards?.reset();
      if (this.vehicle) this.vehicle.destroy();
    }
    const s = this.settings;
    this.world = new planck.World({ gravity: planck.Vec2(0, -10) });
    this.terrain = new Terrain(this.world, { map: MAPS[s.startMap] ? s.startMap : 'meadow', difficulty: s.difficulty, target: s.targetMeters });
    this.hazards = new Hazards(this);
    this.fuel = 100;
    this.mode = 'drive';
    this.busy = 0;
    this.flight = null;
    this.deadT = 0;
    this.winT = 0;
    this.elapsed = 0;
    this.maxX = 0;
    this.lastX = 0;
    this.stuckT = 0;
    this.upsideT = 0;
    this.quakeT = 0;
    this.gravityMod = null;
    this.shield = { hits: 0, time: 0 };
    this.timers = { boost: 0, boostPower: 1, nitro: 0, wind: 0, windDir: 1, freeze: 0, reverse: 0, slowmo: 0, oil: 0, quake: 0, size: 0, invuln: 0 };
    this.portals = [];
    this.markers = [];
    this.scheduled = [];
    this.nextAutoMap = s.autoMapEvery > 0 ? s.autoMapEvery : Infinity;
    this.queue.clear();
    this.driver = new Driver();
    this.vehicleId = this.vehicleIds().includes(s.startVehicle) ? s.startVehicle : 'jeep';
    this.terrain.ensure(0);
    const def = this.getDef(this.vehicleId);
    this.vehicle = new Vehicle(this.world, def, 2, 0, 1);
    this.placeOnGround(this.vehicle, 2);
    this.round++;
    this.cam.x = 4; this.cam.y = 2;
    this.hud?.onRestart?.(this);
  }

  vehicleIds() {
    const custom = Object.entries(this.config.customVehicles || {})
      .filter(([, c]) => c.enabled && this.assets.carImage(c.file))
      .map(([k]) => 'custom:' + k);
    return [...VEHICLE_IDS, ...custom];
  }

  getDef(id) {
    if (id.startsWith('custom:')) {
      const key = id.slice(7);
      const c = this.config.customVehicles[key];
      if (c) return makeCustomVehicle(key, c, this.assets.carImage(c.file), c.wheelFile ? this.assets.carImage(c.wheelFile) : null);
    }
    return VEHICLES[id] || VEHICLES.jeep;
  }

  placeOnGround(v, x, angle) {
    this.terrain.ensure(x);
    const a = angle ?? Math.atan(this.terrain.slopeAt(x));
    const y = Math.max(this.terrain.heightAt(x - 1.5), this.terrain.heightAt(x), this.terrain.heightAt(x + 1.5)) + v.clearance + 0.25;
    v.setTransform(x, y, a);
    v.setVelocity(0, 0, 0);
  }

  rebuildVehicle(def, scale) {
    const old = this.vehicle;
    const p = old.pos, vel = old.vel;
    const x = p.x;
    const color = def === old.def ? old.color : def.color;
    const dark = def === old.def ? old.dark : def.dark;
    old.destroy();
    const v = new Vehicle(this.world, def, x, p.y, scale);
    v.color = color; v.dark = dark;
    this.vehicle = v;
    this.placeOnGround(v, x);
    v.setVelocity(Math.max(0, vel.x) * 0.5, 0);
    this.lastX = x;
  }

  setVehicle(id) {
    const def = this.getDef(id);
    this.vehicleId = id;
    const p = this.vehicle.pos;
    this.effects.smokePuff(p.x, p.y, 'rgba(255,255,255,0.9)', 2);
    for (let i = 0; i < 12; i++) this.effects.smokePuff(p.x + (Math.random() - 0.5) * 4, p.y + Math.random() * 2, 'rgba(255,255,255,0.85)', 1.2);
    this.effects.sparkle(p.x, p.y + 1, '#fff59d', 40);
    this.effects.flash('#ffffff', 0.35);
    this.sound.play('change');
    this.rebuildVehicle(def, this.timers.size > 0 ? this.vehicle.scale : 1);
    this.driver.setMood('happy', 2);
  }

  resizeVehicle(scale, seconds) {
    this.timers.size = seconds;
    this.sound.play('change');
    const p = this.vehicle.pos;
    this.effects.sparkle(p.x, p.y, '#a0ff8a', 30);
    this.rebuildVehicle(this.vehicle.def, scale);
  }

  setMap(id, job) {
    const p = this.vehicle.pos;
    const x = this.terrain.changeMap(id, p.x + 8);
    // geçiş noktasından sonraki nesneleri yeni zemine uydur
    for (const it of [...this.hazards.items]) {
      if (it.x < x) continue;
      if (it.body) {
        this.world.destroyBody(it.body);
        this.hazards.items.splice(this.hazards.items.indexOf(it), 1);
        this.hazards.spawn(it.type, it.x, { natural: it.natural, drop: 0 });
      } else {
        it.y = this.terrain.heightAt(it.x);
      }
    }
    this.portals = this.portals.filter((q) => q.x < x);
    this.portals.push({ x, map: id });
    this.sound.play('change');
    this.effects.flash('#ffffff', 0.3);
    this.announce(`🗺️ ${job?.user?.nickname ? job.user.nickname + ': ' : ''}Harita → ${MAPS[id].name}`, '#7fdcff', job, true);
  }

  // ---------------- Yardımcılar ----------------
  later(sec, fn) { this.scheduled.push({ t: sec, fn }); }

  isAlive() { return this.mode === 'drive' || this.mode === 'flight'; }

  canRunExclusive() { return this.mode === 'drive' && this.busy <= 0 && !this.flight; }

  consumeShield(x, y) {
    if (this.timers.invuln > 0) return true;
    if (this.shield.hits > 0 && this.shield.time > 0) {
      this.shield.hits--;
      this.effects.ring(x, y, '#7fdcff', 5, 0.5);
      this.effects.sparkle(x, y, '#7fdcff', 25);
      this.effects.text(x, y + 2, '🛡️ ENGELLENDİ!', '#7fdcff');
      this.sound.play('block');
      return true;
    }
    return false;
  }

  damage(fn, x, y) {
    if (!this.consumeShield(x, y)) fn();
  }

  popWheel(i, msg) {
    const v = this.vehicle;
    if (!v.popTire(i)) return false;
    const wp = v.wheels[i].body.getPosition();
    this.effects.debris(wp.x, wp.y, ['#111', '#222', '#333'], 10);
    for (let k = 0; k < 8; k++) this.effects.smokePuff(wp.x, wp.y, 'rgba(230,230,230,0.8)', 0.4);
    this.effects.ring(wp.x, wp.y, '#ffffff', 2, 0.3);
    this.effects.shake(0.3, 0.3);
    this.effects.text(wp.x, wp.y + 2, msg || '🛞 PATLADI!', '#ff9f43');
    this.sound.play('pop');
    this.driver.setMood('angry', 2);
    return true;
  }

  addFuel(percent, job, x, y) {
    this.fuel = Math.min(100, this.fuel + percent);
    this.sound.play('fuel');
    this.effects.text(x, y, `⛽ +%${Math.round(percent)}`, '#ffe066');
    this.effects.sparkle(x, y - 1, '#ffe066', 16);
  }

  setGravityMod(type, seconds) {
    this.gravityMod = { type, t: seconds };
  }

  announce(text, color, job, small = false) {
    this.hud?.announce(text, color, job?.user, small);
  }

  mark(delta, job) {
    if (!this.settings.progressMarkers) return;
    this.markers.push({ x: this.vehicle.pos.x, delta, icon: ACTIONS[job.action]?.icon || '•', user: job.user?.nickname || '', t: 0 });
    if (this.markers.length > 12) this.markers.shift();
    if (job.user) {
      const l = this.leader(job.user);
      l.meters += delta;
    }
  }

  leader(user) {
    let l = this.leaders.get(user.id);
    if (!l) this.leaders.set(user.id, (l = { user, coins: 0, meters: 0, actions: 0 }));
    l.user = user;
    return l;
  }

  // ---------------- Olaylar ----------------
  handleEvent(ev) {
    if (ev.kind === 'gift' && ev.user) {
      const l = this.leader(ev.user);
      l.coins += (ev.gift?.diamonds || 1) * (ev.count || 1);
    }
    const jobs = this.rules.handle(ev);
    this.hud?.feed(ev, jobs);
    for (const j of jobs) this.queue.push(j);
  }

  runJob(job) {
    if (!this.vehicle) return;
    try {
      runAction(this, job);
    } catch (err) {
      console.error('Eylem hatası', job.action, err);
    }
    if (job.user) {
      this.leader(job.user).actions++;
      this.showViewer(job.user, ACTIONS[job.action]);
    }
  }

  showViewer(user, meta) {
    const s = this.settings;
    if (!s.viewerTagSeconds) return;
    const existing = this.viewerTags.find((t) => t.user.id === user.id);
    const img = s.showAvatars && user.avatar ? this.assets.avatar(user.avatar) : null;
    if (existing) {
      existing.t = s.viewerTagSeconds;
      existing.icon = meta?.icon || '';
      existing.label = meta?.name || '';
      return;
    }
    this.viewerTags.unshift({ user, img, t: s.viewerTagSeconds, max: s.viewerTagSeconds, icon: meta?.icon || '', label: meta?.name || '' });
    if (this.viewerTags.length > 3) this.viewerTags.length = 3;
  }

  // ---------------- Uçuş (takla atarak ileri/geri fırlatma) ----------------
  startFlight({ dx, height, dur, spins, kind }) {
    const v = this.vehicle, p = v.pos;
    const x1 = Math.max(0, p.x + dx);
    this.terrain.ensure(x1);
    const slope = this.terrain.slopeAt(x1);
    const aEnd = Math.atan(slope);
    const dir = x1 < p.x ? 1 : -1;
    v.setEnabled(false);
    this.mode = 'flight';
    this.flight = {
      x0: p.x, y0: p.y, a0: normAngle(v.angle),
      x1, y1: Math.max(this.terrain.heightAt(x1 - 1), this.terrain.heightAt(x1), this.terrain.heightAt(x1 + 1)) + v.clearance + 0.2,
      a1: aEnd + dir * spins * TAU, t: 0, dur, height, kind, dx,
    };
    if (kind === 'teleport') this.effects.ring(p.x, p.y, '#c89bff', 3, 0.4);
  }

  updateFlight(dt) {
    const f = this.flight, v = this.vehicle;
    f.t += dt;
    const u = Math.min(1, f.t / f.dur);
    const e = f.kind === 'rocket' ? ease(u) : u;
    let x = f.x0 + (f.x1 - f.x0) * e;
    const base = f.y0 + (f.y1 - f.y0) * e;
    const ground = this.terrain.heightAt(x) + v.clearance;
    let y = Math.max(ground, base + 4 * f.height * u * (1 - u));
    if (f.kind === 'tornado') x += Math.sin(u * 20) * 0.8 * Math.sin(u * Math.PI);
    const a = f.a0 + (f.a1 - f.a0) * ease(u);
    if (f.kind === 'teleport') {
      x = u < 0.5 ? f.x0 : f.x1;
      y = u < 0.5 ? f.y0 : f.y1;
      if (!f.arrived && u >= 0.5) {
        f.arrived = true;
        this.effects.ring(f.x1, f.y1, '#c89bff', 4, 0.5);
        this.effects.sparkle(f.x1, f.y1, '#c89bff', 40);
      }
    }
    this.terrain.ensure(x);
    v.setTransform(x, y, f.kind === 'teleport' ? f.a1 : a);
    for (const w of v.wheels) w.body.setTransform(w.body.getPosition(), w.body.getAngle() - dt * 12 * Math.sign(f.dx || 1));
    // efektler
    if (f.kind === 'rocket') this.effects.boostFlame(...v.local(-2, 0), -Math.cos(a), -Math.sin(a), true);
    if (f.kind === 'knock' || f.kind === 'tornado') this.effects.smokePuff(x, y, 'rgba(60,60,60,0.5)', 0.6);
    if (f.kind === 'tornado') {
      for (let i = 0; i < 3; i++) {
        const ang = this.time * 8 + i * 2;
        this.effects.dust(x + Math.cos(ang) * 2.5, y - 1 + Math.sin(ang * 0.5) * 2, 'rgba(180,180,180,0.5)');
      }
    }
    if (u >= 1) {
      this.flight = null;
      this.mode = 'drive';
      v.setEnabled(true);
      v.setVelocity(f.dx > 0 ? 5 : 1.5, -1);
      this.lastX = v.pos.x;
      this.effects.shake(0.25, 0.25);
      this.sound.play('land');
      for (const w of v.wheels) {
        const wp = w.body.getPosition();
        for (let i = 0; i < 8; i++) this.effects.dust(wp.x, wp.y - w.radius);
      }
      if (f.kind === 'knock' || f.kind === 'tornado') this.driver.setMood('dizzy', 2.5);
    }
  }

  explode(penalty, job) {
    if (this.mode !== 'drive') return;
    const v = this.vehicle, p = v.pos;
    this.effects.explosion(p.x, p.y, 1.6);
    this.effects.debris(p.x, p.y, [v.color, v.dark, '#222', '#555', '#888'], 26);
    this.sound.play('explode');
    v.setEnabled(false);
    this.mode = 'dead';
    this.deadT = this.settings.respawnSeconds;
    this.respawnX = Math.max(0, p.x - (penalty || 0));
    if (penalty && job) this.mark(-penalty, job);
    // yanan kalıntı dumanı
    for (let i = 0; i < 10; i++) this.later(i * 0.2, () => this.effects.smokePuff(p.x + (Math.random() - 0.5), p.y, 'rgba(40,40,40,0.7)', 1));
  }

  respawn() {
    const v = this.vehicle;
    v.repair();
    v.setEnabled(true);
    this.placeOnGround(v, this.respawnX);
    this.mode = 'drive';
    this.lastX = this.respawnX;
    this.timers.invuln = 2;
    const p = v.pos;
    this.effects.ring(p.x, p.y, '#ffffff', 4, 0.5);
    this.effects.sparkle(p.x, p.y + 1, '#fff59d', 40);
    this.driver.setMood('dizzy', 3);
    this.sound.play('repair');
  }

  win() {
    this.mode = 'win';
    this.winT = this.settings.autoRestartSeconds;
    this.sound.play('win');
    const { w, h } = this.cam;
    this.effects.fireworks(w, h, 8);
    this.effects.confetti(w, h, 200);
    this.later(1.5, () => this.effects.fireworks(w, h, 6));
    this.later(3, () => this.effects.fireworks(w, h, 6));
    this.hud?.showWin(this);
  }

  // ---------------- Döngü ----------------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
    this.canvas.width = w;
    this.canvas.height = h;
    this.cam.w = w; this.cam.h = h;
    this.basePpm = Math.min(w, h * 0.8) / 13;
  }

  toScreen(x, y) {
    const c = this.cam;
    return [c.w / 2 + (x - c.x) * c.ppm + c.sx, c.h / 2 - (y - c.y) * c.ppm + c.sy];
  }

  frame(dt) {
    dt = Math.min(dt, 0.1);
    if (!this.paused) this.update(dt);
    this.render();
  }

  update(dt) {
    this.time += dt;
    const T = this.timers;
    const simDt = dt * (T.slowmo > 0 ? 0.4 : 1);
    for (const k of ['boost', 'nitro', 'wind', 'freeze', 'reverse', 'slowmo', 'oil', 'quake', 'invuln']) T[k] = Math.max(0, T[k] - simDt);
    if (this.shield.time > 0) { this.shield.time -= simDt; if (this.shield.time <= 0) this.shield.hits = 0; }
    if (this.gravityMod) { this.gravityMod.t -= simDt; if (this.gravityMod.t <= 0) this.gravityMod = null; }
    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      const s = this.scheduled[i];
      s.t -= simDt;
      if (s.t <= 0) { this.scheduled.splice(i, 1); s.fn(); }
    }

    this.queue.update(dt);
    const v = this.vehicle;
    const s = this.settings;

    if (this.mode === 'drive' || this.mode === 'win') this.controlVehicle(simDt);
    else if (this.mode === 'flight') this.updateFlight(simDt);
    else if (this.mode === 'dead') {
      this.deadT -= simDt;
      if (this.deadT <= 0) this.respawn();
    }
    if (this.mode === 'win') {
      this.winT -= dt;
      if (this.winT <= 0 && s.autoRestartSeconds > 0) { this.restart(); return; }
    }

    // boyut efekti bitişi
    if (T.size > 0) {
      T.size -= simDt;
      if (T.size <= 0) {
        if (this.mode === 'drive') this.rebuildVehicle(v.def, 1);
        else T.size = 0.1;
      }
    }

    // fizik
    this.applyGravity();
    this.acc = (this.acc || 0) + simDt;
    let steps = 0;
    while (this.acc >= FIXED && steps < 5) {
      this.world.step(FIXED, 8, 3);
      this.acc -= FIXED;
      steps++;
    }
    if (steps === 5) this.acc = 0;

    const vv = this.vehicle;
    const p = vv.pos;
    // ilerleme ve yakıt
    if (this.mode === 'drive') {
      const dx = p.x - this.lastX;
      if (dx > 0) this.fuel = Math.max(0, this.fuel - (dx / Math.max(1, s.fuelRangeMeters)) * 100);
      this.lastX = p.x;
      if (p.y < this.terrain.heightAt(p.x) - 6) this.placeOnGround(vv, p.x);
      if (p.x >= s.targetMeters) this.win();
      if (p.x >= this.nextAutoMap) {
        this.nextAutoMap += s.autoMapEvery;
        const cur = this.terrain.mapAt(p.x);
        this.setMap(MAP_IDS[(MAP_IDS.indexOf(cur) + 1) % MAP_IDS.length]);
      }
    }
    this.maxX = Math.max(this.maxX, p.x);
    if (this.mode !== 'win' && this.mode !== 'dead') this.elapsed += dt;

    // otomatik teker tamiri
    if (s.tireRepairSeconds > 0) {
      vv.wheels.forEach((w, i) => {
        if (!w.popped) return;
        w.popTime = (w.popTime || 0) + simDt;
        if (w.popTime >= s.tireRepairSeconds && vv.repairWheel(i)) {
          const wp = w.body.getPosition();
          this.effects.sparkle(wp.x, wp.y, '#9dffb0', 15);
          this.effects.text(wp.x, wp.y + 1.5, '🔧', '#9dffb0');
        }
      });
    }

    this.terrain.update(this.cam.x - 40, Math.max(p.x, this.cam.x) + 70);
    this.hazards.spawnNatural(p.x + 25, p.x + 70);
    this.hazards.update(simDt);
    this.effects.update(dt);
    for (const m of this.markers) m.t += dt;
    for (let i = this.viewerTags.length - 1; i >= 0; i--) {
      this.viewerTags[i].t -= dt;
      if (this.viewerTags[i].t <= 0) this.viewerTags.splice(i, 1);
    }
    const grounded = vv.updateGrounded(this.terrain) > 0;
    this.driver.update(simDt, vv.vel, vv.angle, !grounded && this.mode !== 'dead', { fuelEmpty: this.fuel <= 0 });
    this.updateCamera(dt);
    this.sound.updateEngine(vv.vel.x, T.boost > 0 || T.nitro > 0 ? 1 : 0.4, this.mode === 'drive' && !this.paused);
  }

  controlVehicle(dt) {
    const v = this.vehicle, s = this.settings, T = this.timers;
    const mass = v.mass;
    const fuelEmpty = this.fuel <= 0;
    let speed = s.cruiseSpeed * (v.def.speed || 1) * (fuelEmpty ? s.emptySpeedPercent / 100 : 1);
    let torque = 1;
    const a = v.angle, fwdX = Math.cos(a), fwdY = Math.sin(a);
    const grounded = v.wheels.some((w) => w.grounded);
    if (T.boost > 0) {
      speed *= 1.5 + 0.25 * (T.boostPower - 1);
      torque *= 1.8;
      if (grounded) v.applyForce(fwdX * mass * 6 * T.boostPower, fwdY * mass * 6 * T.boostPower);
      const [ex, ey] = v.local(v.def.chassis[0][0] - 0.1, 0);
      this.effects.boostFlame(ex, ey, -fwdX, -fwdY, false);
    }
    if (T.nitro > 0) {
      speed *= 2.4;
      torque *= 2.5;
      v.applyForce(fwdX * mass * 16, fwdY * mass * 16);
      const [ex, ey] = v.local(v.def.chassis[0][0] - 0.1, 0);
      this.effects.boostFlame(ex, ey, -fwdX, -fwdY, true);
    }
    if (T.reverse > 0) speed = -Math.abs(speed) * 0.8;
    if (T.freeze > 0 || this.mode === 'win') { speed = 0; torque = 8; }
    v.drive(speed, torque);
    v.setFriction(T.oil > 0 ? 0.12 : 1);
    if (T.wind > 0) v.applyForce(T.windDir * mass * 7, 0);
    if (T.quake > 0) {
      this.quakeT -= dt;
      this.effects.shake(0.35, 0.2);
      if (this.quakeT <= 0) {
        this.quakeT = 0.18;
        v.applyImpulse((Math.random() - 0.5) * mass * 2, mass * (1 + Math.random() * 2.5));
      }
    }
    // havada denge ve şaha kalkma sınırlayıcı (çok fazla ters dönmeyi engeller)
    if (s.airControl) v.stabilize(this.terrain);
    // ters yerçekiminde sonsuza uçmayı engelle
    const p = v.pos;
    const hAbove = p.y - this.terrain.heightAt(p.x);
    if (hAbove > 18) v.applyForce(0, -mass * (hAbove - 18) * 4);

    // takılma / ters dönme kurtarma
    if (this.mode !== 'drive') return;
    const upside = Math.cos(a) < -0.15;
    this.upsideT = upside ? this.upsideT + dt : 0;
    if (this.upsideT > 2.2) {
      this.upsideT = 0;
      this.startFlight({ dx: 1, height: 2.2, dur: 0.9, spins: 0, kind: 'recover' });
      this.effects.text(p.x, p.y + 2, '🔄', '#fff');
      return;
    }
    const slow = Math.abs(v.vel.x) < 0.35 && T.freeze <= 0;
    this.stuckT = slow ? this.stuckT + dt : 0;
    if (s.antiStuck && this.stuckT > 6 && !fuelEmpty) {
      this.stuckT = 0;
      v.applyImpulse(mass * 3, mass * 5);
    }
  }

  applyGravity() {
    const map = MAPS[this.terrain.mapAt(this.vehicle.pos.x)];
    let gy = map.gravity;
    const gm = this.gravityMod;
    if (gm?.type === 'low') gy *= 0.35;
    else if (gm?.type === 'heavy') gy *= 2;
    else if (gm?.type === 'reverse') gy = 5;
    const cur = this.world.getGravity();
    if (Math.abs(cur.y - gy) > 1e-3) this.world.setGravity(planck.Vec2(0, gy));
  }

  updateCamera(dt) {
    const v = this.vehicle, p = v.pos, c = this.cam;
    const speed = Math.abs(v.vel.x);
    const nitroZoom = this.timers.nitro > 0 ? 0.85 : 1;
    const targetPpm = (this.basePpm * (this.settings.zoom || 1) * nitroZoom) / Math.sqrt(v.scale) * (1 - Math.min(speed, 25) / 25 * 0.12);
    c.ppm += (targetPpm - c.ppm) * Math.min(1, dt * 2);
    const viewW = c.w / c.ppm;
    const look = Math.max(-0.12 * viewW, Math.min(0.22 * viewW, v.vel.x * 0.45)) + viewW * 0.08;
    const tx = p.x + look, ty = p.y + (c.h / c.ppm) * 0.06;
    const k = this.mode === 'flight' ? 6 : 3.5;
    c.x += (tx - c.x) * Math.min(1, dt * k);
    c.y += (ty - c.y) * Math.min(1, dt * k * 0.8);
  }

  // ---------------- Çizim ----------------
  render() {
    const ctx = this.ctx, c = this.cam;
    const [sx, sy] = this.effects.shakeOffset();
    c.sx = sx * c.ppm; c.sy = sy * c.ppm;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // arka plan (harita geçişinde yumuşak geçiş)
    const mapHere = this.terrain.mapAt(c.x);
    const portal = this.portals.find((q) => Math.abs(q.x - c.x) < 15);
    this.drawMapBackground(ctx, mapHere, 1);
    if (portal) {
      const before = this.terrain.mapAt(portal.x - 1);
      const after = portal.map;
      const t = Math.max(0, Math.min(1, (c.x - (portal.x - 15)) / 30));
      if (before !== after) {
        this.drawMapBackground(ctx, before, 1);
        this.drawMapBackground(ctx, after, t);
      }
    }
    // kar / kum / kor parçacıkları
    this.drawWeather(ctx, MAPS[mapHere]);

    this.terrain.drawDecos(ctx, c, this.time);
    this.drawPortals(ctx);
    this.terrain.draw(ctx, c, this.time, (m) => this.customGround(m));
    this.hazards.draw(ctx, c, this.time);

    const v = this.vehicle;
    const hideCar = this.mode === 'dead' || (this.flight?.kind === 'teleport' && Math.abs(this.flight.t / this.flight.dur - 0.5) < 0.35);
    if (!hideCar) {
      v.draw(ctx, c, this.driver, this.time, { groundY: this.terrain.heightAt(v.pos.x) });
      this.drawCarOverlays(ctx);
    }
    this.effects.drawWorld(ctx, c);
    this.drawViewerTags(ctx);
    if (this.timers.nitro > 0) this.drawSpeedLines(ctx);
    if (this.timers.freeze > 0) {
      ctx.fillStyle = 'rgba(180,230,255,0.12)';
      ctx.fillRect(0, 0, c.w, c.h);
    }
    if (this.gravityMod?.type === 'reverse') {
      ctx.fillStyle = 'rgba(160,100,255,0.1)';
      ctx.fillRect(0, 0, c.w, c.h);
    }
    this.effects.drawScreen(ctx, c.w, c.h);
    this.hud?.update(this);
  }

  drawMapBackground(ctx, mapId, alpha) {
    if (alpha <= 0) return;
    const c = this.cam;
    const mc = this.config.maps?.[mapId];
    const img = mc?.background ? this.assets.image(mc.background) : null;
    ctx.globalAlpha = alpha;
    drawBackground(ctx, c.w, c.h, MAPS[mapId], c.x, c.y, this.time, img);
    ctx.globalAlpha = 1;
  }

  customGround(mapId) {
    const mc = this.config.maps?.[mapId];
    if (!mc?.ground) return null;
    const key = `${mc.ground}|${mc.groundMode}|${mc.groundMeters}`;
    this._groundCache = this._groundCache || new Map();
    let g = this._groundCache.get(key);
    if (!g) {
      g = { image: this.assets.image(mc.ground), mode: mc.groundMode || 'strip', meters: Number(mc.groundMeters) || 4 };
      this._groundCache.set(key, g);
    }
    return g;
  }

  drawWeather(ctx, map) {
    if (!map.particles) return;
    const c = this.cam, n = 70;
    for (let i = 0; i < n; i++) {
      const seed = i * 97.13;
      const speed = map.particles === 'snow' ? 60 : map.particles === 'ember' ? -40 : 30;
      const xx = ((Math.sin(seed) * 0.5 + 0.5) * c.w * 1.2 - (c.x * c.ppm * 0.3) - this.time * (map.particles === 'sand' ? 200 : 20)) % (c.w * 1.2);
      const x = (xx + c.w * 1.2) % (c.w * 1.2) - c.w * 0.1;
      const yy = ((Math.cos(seed * 1.3) * 0.5 + 0.5) * c.h + this.time * speed * (1 + (i % 3) * 0.3)) % c.h;
      const y = (yy + c.h) % c.h;
      if (map.particles === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x + Math.sin(this.time + i) * 10, y, 2 + (i % 3), 0, TAU); ctx.fill(); }
      else if (map.particles === 'ember') { ctx.fillStyle = `rgba(255,${120 + (i % 5) * 20},40,0.8)`; ctx.fillRect(x, c.h - y, 3, 3); }
      else { ctx.fillStyle = 'rgba(230,190,120,0.35)'; ctx.fillRect(x, y, 6, 1.5); }
    }
  }

  drawPortals(ctx) {
    const c = this.cam;
    for (const q of this.portals) {
      const y = this.terrain.heightAt(q.x);
      const [sx, sy] = this.toScreen(q.x, y);
      if (sx < -300 || sx > c.w + 300) continue;
      const h = 6 * c.ppm, w = 2.2 * c.ppm;
      ctx.save();
      ctx.translate(sx, sy - h / 2);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, h / 2);
      const hue = (this.time * 90) % 360;
      g.addColorStop(0, `hsla(${hue},100%,85%,0.9)`);
      g.addColorStop(0.6, `hsla(${hue + 60},100%,60%,0.45)`);
      g.addColorStop(1, `hsla(${hue + 120},100%,50%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, w, h / 2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `hsla(${hue},100%,70%,0.9)`;
      ctx.lineWidth = 0.15 * c.ppm;
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.8, h * 0.45, 0, 0, TAU); ctx.stroke();
      ctx.font = `900 ${0.6 * c.ppm}px system-ui`; ctx.textAlign = 'center';
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4;
      ctx.strokeText(MAPS[q.map].name, 0, -h / 2 - 0.3 * c.ppm);
      ctx.fillText(MAPS[q.map].name, 0, -h / 2 - 0.3 * c.ppm);
      ctx.restore();
    }
  }

  drawCarOverlays(ctx) {
    const v = this.vehicle, c = this.cam, p = v.pos;
    const [sx, sy] = this.toScreen(p.x, p.y + 0.4 * v.scale);
    if (this.shield.hits > 0 || this.timers.invuln > 0) {
      const r = 2.6 * v.scale * c.ppm;
      const pulse = 1 + Math.sin(this.time * 6) * 0.04;
      const g = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * pulse);
      g.addColorStop(0, 'rgba(120,220,255,0)');
      g.addColorStop(0.85, 'rgba(120,220,255,0.25)');
      g.addColorStop(1, 'rgba(200,245,255,0.75)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, r * pulse, 0, TAU); ctx.fill();
    }
    if (this.timers.freeze > 0) {
      ctx.fillStyle = 'rgba(190,240,255,0.45)';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(-v.angle);
      const w = 4.2 * v.scale * c.ppm, h = 2.4 * v.scale * c.ppm;
      ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (this.fuel <= 0 && this.mode === 'drive') {
      ctx.font = `900 ${0.7 * c.ppm}px system-ui`; ctx.textAlign = 'center';
      ctx.globalAlpha = 0.6 + Math.sin(this.time * 6) * 0.4;
      ctx.fillStyle = '#ff4d4d';
      ctx.fillText('⛽ BENZİN BİTTİ!', sx, sy - 3 * c.ppm * v.scale);
      ctx.globalAlpha = 1;
    }
    // traktör/egzoz dumanı
    if (v.def.smoke && Math.random() < 0.3) {
      const [ex, ey] = v.local(...v.def.smoke);
      this.effects.smokePuff(ex, ey, 'rgba(70,70,70,0.45)', 0.15, 0.5);
    }
  }

  drawViewerTags(ctx) {
    if (!this.viewerTags.length) return;
    const v = this.vehicle, c = this.cam, p = v.pos;
    const [sx, sy0] = this.toScreen(p.x, p.y + 2.3 * v.scale);
    const size = Math.max(30, Math.min(c.w, c.h) * 0.065);
    let sy = sy0 - size * 0.6;
    for (const tag of this.viewerTags) {
      const a = Math.min(1, tag.t / 0.5, (tag.max - tag.t) / 0.2 + 0.2);
      ctx.globalAlpha = Math.max(0, a);
      const name = tag.user.nickname || tag.user.uniqueId;
      ctx.font = `800 ${size * 0.42}px "Baloo 2", system-ui, sans-serif`;
      const text = `${tag.icon} ${name}`;
      const tw = ctx.measureText(text).width;
      const w = tw + size * 1.4, h = size * 0.9;
      const x = sx - w / 2, y = sy - h / 2;
      ctx.fillStyle = 'rgba(15,15,30,0.78)';
      ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      // avatar
      const ax = x + h / 2, ay = sy, ar = h * 0.42;
      ctx.save();
      ctx.beginPath(); ctx.arc(ax, ay, ar, 0, TAU); ctx.clip();
      if (tag.img && tag.img.complete && tag.img.naturalWidth) ctx.drawImage(tag.img, ax - ar, ay - ar, ar * 2, ar * 2);
      else {
        ctx.fillStyle = `hsl(${(hashStr(name) % 360)},70%,55%)`; ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
        ctx.fillStyle = '#fff'; ctx.font = `900 ${ar}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((name[0] || '?').toUpperCase(), ax, ay + 1);
      }
      ctx.restore();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${size * 0.42}px "Baloo 2", system-ui, sans-serif`;
      ctx.fillText(text, x + h * 1.05, sy + 1);
      sy -= h * 1.15;
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  drawSpeedLines(ctx) {
    const c = this.cam;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 25; i++) {
      const y = Math.random() * c.h, x = Math.random() * c.w, l = 80 + Math.random() * 200;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - l, y); ctx.stroke();
    }
  }

  // Panel için özet durum
  snapshot() {
    const v = this.vehicle;
    return {
      distance: Math.max(0, v.pos.x),
      target: this.settings.targetMeters,
      fuel: this.fuel,
      mode: this.mode,
      paused: this.paused,
      vehicle: this.vehicleId,
      map: this.terrain.mapAt(v.pos.x),
      queue: this.queue.items.slice(0, 20).map((j) => ({ action: j.action, count: j.count, user: j.user?.nickname || '' })),
      queueLength: this.queue.items.length,
      dropped: this.queue.dropped,
      round: this.round,
      elapsed: this.elapsed,
      shield: this.shield.hits,
    };
  }
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
