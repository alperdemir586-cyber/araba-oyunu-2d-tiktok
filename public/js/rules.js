// Kural motoru (TikTok olayı -> eylem işleri) ve eylem kuyruğu.
import { ACTIONS, normalizeName } from './catalog.js';

let jobSeq = 0;

export class RuleEngine {
  constructor(getConfig) {
    this.getConfig = getConfig;
    this.likeCounters = new Map(); // rule.id -> birikmiş beğeni
    this.seenUsers = new Map(); // rule.id -> Set(userId)  (oncePerUser)
    this.lastFire = new Map(); // rule.id -> zaman
    this.userFire = new Map(); // rule.id:user -> zaman
  }

  reset() {
    this.likeCounters.clear();
    this.seenUsers.clear();
    this.lastFire.clear();
    this.userFire.clear();
  }

  matches(rule, ev) {
    const t = rule.trigger || {};
    if (t.type !== ev.kind) return false;
    if (ev.kind === 'gift') {
      if (!t.gift) return true; // boş = tüm hediyeler
      const g = ev.gift || {};
      if (String(t.gift) === String(g.id)) return true;
      return normalizeName(t.gift) === normalizeName(g.name);
    }
    if (ev.kind === 'chat') {
      const kw = String(t.keyword || '').trim().toLocaleLowerCase('tr');
      return !!kw && String(ev.comment || '').trim().toLocaleLowerCase('tr').startsWith(kw);
    }
    return true;
  }

  // Olayı işle -> iş listesi
  handle(ev) {
    const cfg = this.getConfig();
    const jobs = [];
    const now = performance.now() / 1000;
    for (const rule of cfg.rules) {
      if (!rule.enabled || !ACTIONS[rule.action] || !this.matches(rule, ev)) continue;
      let n = Math.max(1, ev.count | 0);
      if (ev.kind === 'gift' && rule.trigger.minCount && n < rule.trigger.minCount) continue;
      if (ev.kind === 'like') {
        const every = Math.max(1, Number(rule.trigger.every) || 1);
        const acc = (this.likeCounters.get(rule.id) || 0) + n;
        n = Math.floor(acc / every);
        this.likeCounters.set(rule.id, acc % every);
        if (n <= 0) continue;
      } else if (ev.kind !== 'gift') {
        n = 1;
      }
      if (rule.oncePerUser && ev.user) {
        let set = this.seenUsers.get(rule.id);
        if (!set) this.seenUsers.set(rule.id, (set = new Set()));
        if (set.has(ev.user.id)) continue;
        set.add(ev.user.id);
      }
      if (rule.cooldown > 0) {
        if (now - (this.lastFire.get(rule.id) ?? -1e9) < rule.cooldown) continue;
        this.lastFire.set(rule.id, now);
      }
      if (rule.userCooldown > 0 && ev.user) {
        const key = `${rule.id}:${ev.user.id}`;
        if (now - (this.userFire.get(key) ?? -1e9) < rule.userCooldown) continue;
        this.userFire.set(key, now);
      }
      if (rule.repeat === 'once') n = 1;
      const max = Number(rule.maxRepeat || cfg.settings.maxRepeat || 10);
      n = Math.min(n, max);
      jobs.push({
        id: ++jobSeq,
        action: rule.action,
        params: { ...ACTIONS[rule.action].params, ...(rule.params || {}) },
        count: n,
        priority: Number(rule.priority ?? 1),
        user: ev.user,
        source: ev,
        ts: now,
      });
    }
    return jobs;
  }
}

export class ActionQueue {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.gap = 0;
    this.budget = 0;
    this.dropped = 0;
  }

  clear() { this.items = []; }

  push(job) {
    const meta = ACTIONS[job.action];
    if (!meta) return;
    if (meta.instant) { this.game.runJob(job); return; }
    const max = this.game.settings.maxQueue;
    if (meta.stack) {
      // Aynı eylem + aynı parametre bekliyorsa birleştir (ör. 5 Boost -> 1 uzun Boost)
      const key = JSON.stringify(job.params);
      const same = this.items.find((j) => j.action === job.action && JSON.stringify(j.params) === key);
      if (same) {
        same.count = Math.min(same.count + job.count, 30);
        same.merged = (same.merged || 1) + 1;
        if (job.user) same.user = job.user;
        return;
      }
      this.items.push(job);
    } else {
      for (let i = 0; i < job.count; i++) this.items.push({ ...job, id: i ? job.id + '_' + i : job.id, count: 1 });
    }
    this.items.sort((a, b) => b.priority - a.priority || a.ts - b.ts);
    while (this.items.length > max) {
      // en düşük öncelikli en yeni işi düşür
      let idx = this.items.length - 1;
      this.items.splice(idx, 1);
      this.dropped++;
    }
  }

  update(dt) {
    const g = this.game;
    this.gap = Math.max(0, this.gap - dt);
    this.budget = Math.min(3, this.budget + dt * 6); // saniyede ~6 normal eylem
    for (let i = 0; i < this.items.length; i++) {
      const job = this.items[i];
      const meta = ACTIONS[job.action];
      if (meta.exclusive) {
        if (this.gap > 0 || !g.canRunExclusive()) continue;
        this.items.splice(i, 1); i--;
        g.runJob(job);
        this.gap = g.settings.exclusiveGap;
        continue;
      }
      if (this.budget < 1) continue;
      if (!meta.any && !g.isAlive()) continue;
      this.items.splice(i, 1); i--;
      this.budget -= 1;
      g.runJob(job);
    }
  }
}
