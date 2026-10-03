// Ses efektleri. Varsayılan olarak WebAudio ile sentezlenir; assets/sounds
// klasörüne eylem adıyla (ör. "explode.mp3", "boost.wav") dosya koyarsanız o çalınır.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.6;
    this.enabled = true;
    this.custom = new Map(); // ad -> url
    this.buffers = new Map();
    this.engine = null;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  setCustomSounds(list) {
    this.custom.clear();
    for (const s of list || []) this.custom.set(s.name.toLowerCase(), s.url);
  }

  async playCustom(name) {
    const url = this.custom.get(name.toLowerCase());
    if (!url) return false;
    const ctx = this.ensure();
    if (!ctx) return false;
    try {
      let buf = this.buffers.get(url);
      if (!buf) {
        const data = await fetch(url).then((r) => r.arrayBuffer());
        buf = await ctx.decodeAudioData(data);
        this.buffers.set(url, buf);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.master);
      src.start();
      return true;
    } catch {
      return false;
    }
  }

  noise(duration) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  tone({ type = 'sine', from = 440, to = from, dur = 0.2, gain = 0.3, delay = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  boom(dur = 1.2, gain = 0.9, cutoff = 900) {
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noise(dur), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(60, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    this.tone({ type: 'sine', from: 120, to: 30, dur: dur * 0.8, gain: gain * 0.8 });
  }

  whoosh(dur = 0.6, gain = 0.4, up = true) {
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this.noise(dur), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(up ? 300 : 2500, t);
    f.frequency.exponentialRampToValueAtTime(up ? 3000 : 250, t + dur);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
  }

  play(name) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (this.custom.has(name.toLowerCase())) { this.playCustom(name); return; }
    switch (name) {
      case 'explode': this.boom(1.4, 1, 1200); break;
      case 'bomb': case 'mine': case 'meteor': this.boom(0.9, 0.8, 900); break;
      case 'pop':
        this.boom(0.25, 0.7, 4000);
        this.whoosh(0.5, 0.25, false);
        break;
      case 'boost': this.whoosh(0.7, 0.5, true); this.tone({ type: 'sawtooth', from: 120, to: 420, dur: 0.6, gain: 0.08 }); break;
      case 'nitro': this.whoosh(0.9, 0.6, true); this.tone({ type: 'square', from: 200, to: 900, dur: 0.8, gain: 0.07 }); break;
      case 'jump': this.tone({ type: 'square', from: 220, to: 660, dur: 0.25, gain: 0.12 }); break;
      case 'rocket': this.whoosh(1.4, 0.6, true); this.tone({ type: 'sawtooth', from: 80, to: 600, dur: 1.2, gain: 0.08 }); break;
      case 'teleport':
        for (let i = 0; i < 6; i++) this.tone({ type: 'sine', from: 400 + i * 150, to: 1200 + i * 200, dur: 0.15, gain: 0.08, delay: i * 0.05 });
        break;
      case 'fuel':
        this.tone({ type: 'sine', from: 520, dur: 0.1, gain: 0.15 });
        this.tone({ type: 'sine', from: 780, dur: 0.18, gain: 0.15, delay: 0.09 });
        break;
      case 'repair': case 'shield':
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ type: 'triangle', from: f, dur: 0.18, gain: 0.12, delay: i * 0.07 }));
        break;
      case 'block': this.tone({ type: 'triangle', from: 1500, to: 600, dur: 0.3, gain: 0.15 }); break;
      case 'change': this.whoosh(0.8, 0.4, true); this.tone({ type: 'sine', from: 300, to: 1200, dur: 0.5, gain: 0.08 }); break;
      case 'win':
        [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone({ type: 'square', from: f, dur: 0.22, gain: 0.08, delay: i * 0.13 }));
        break;
      case 'bad': this.tone({ type: 'sawtooth', from: 300, to: 90, dur: 0.5, gain: 0.12 }); break;
      case 'gift': this.tone({ type: 'sine', from: 880, to: 1320, dur: 0.12, gain: 0.08 }); break;
      case 'wind': this.whoosh(2, 0.25, true); break;
      case 'land': this.boom(0.3, 0.5, 300); break;
      default: this.tone({ type: 'sine', from: 660, dur: 0.12, gain: 0.08 });
    }
  }

  tick(urgent) {
    if (!this.enabled || !this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.custom.has('tick')) { this.playCustom('tick'); return; }
    this.tone({ type: 'square', from: urgent ? 1320 : 880, dur: 0.09, gain: urgent ? 0.14 : 0.09 });
  }

  // Basit sürekli motor sesi; hıza göre perde değişir.
  updateEngine(speed, throttle, active) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    if (!this.engine) {
      const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
      const f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'square';
      f.type = 'lowpass'; f.frequency.value = 500;
      g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g).connect(this.master);
      o.start(); o2.start();
      this.engine = { o, o2, g, f };
    }
    const e = this.engine, t = this.ctx.currentTime;
    const base = 45 + Math.min(Math.abs(speed), 25) * 5 * (0.6 + throttle * 0.4);
    e.o.frequency.setTargetAtTime(base, t, 0.1);
    e.o2.frequency.setTargetAtTime(base * 0.5, t, 0.1);
    e.g.gain.setTargetAtTime(active ? 0.035 + throttle * 0.02 : 0, t, 0.15);
  }
}
