// Eylem kataloğu: kurallara bağlanabilen tüm eylemler ve parametreleri.
// type: 'good' (araca yardım), 'bad' (sabotaj), 'fun' (görsel/nötr)
// exclusive: aynı anda yalnızca bir tane çalışır (uçuş, patlama, araç/harita değişimi)
// stack: aynı eylem art arda gelirse tek iş olarak birleştirilebilir
import { VEHICLES } from './vehicles.js';
import { MAPS } from './maps.js';

const vehicleOptions = () => [['random', 'Rastgele'], ['next', 'Sıradaki'], ...Object.entries(VEHICLES).map(([k, v]) => [k, v.name])];
const mapOptions = () => [['random', 'Rastgele'], ['next', 'Sıradaki'], ...Object.entries(MAPS).map(([k, v]) => [k, v.name])];

export const ACTIONS = {
  // --- Yardım ---
  boost: { name: 'Boost', icon: '🔥', type: 'good', stack: true, params: { power: 1, seconds: 3 } },
  nitro: { name: 'Nitro', icon: '⚡', type: 'good', stack: true, params: { seconds: 1.5 } },
  jump: { name: 'Zıplat', icon: '🦘', type: 'good', params: { power: 1 } },
  superJump: { name: 'Süper Zıplama', icon: '🚀', type: 'good', params: { power: 2.2 } },
  rocket: { name: 'Roketle İleri Fırlat', icon: '🛸', type: 'good', exclusive: true, stack: true, params: { meters: 30 } },
  teleport: { name: 'Işınla (İleri)', icon: '🌀', type: 'good', exclusive: true, stack: true, params: { meters: 20 } },
  refuel: { name: 'Benzin Ver', icon: '⛽', type: 'good', any: true, stack: true, params: { percent: 20 } },
  repair: { name: 'Tekerlek Tamiri', icon: '🔧', type: 'good', params: {} },
  shield: { name: 'Kalkan', icon: '🛡️', type: 'good', any: true, params: { hits: 1, seconds: 30 } },
  ramp: { name: 'Rampa Koy', icon: '📐', type: 'good', params: {} },
  lowGravity: { name: 'Düşük Yerçekimi', icon: '🪐', type: 'good', params: { seconds: 6 } },
  tailwind: { name: 'Arkadan Rüzgar', icon: '🌬️', type: 'good', stack: true, params: { seconds: 5 } },
  giant: { name: 'Dev Araba', icon: '🦖', type: 'good', exclusive: true, stack: true, params: { seconds: 12 } },
  magnetFuel: { name: 'Benzin Yağmuru', icon: '🛢️', type: 'good', params: { count: 4 } },

  // --- Sabotaj ---
  bomb: { name: 'Bomba (Geri Fırlat)', icon: '💣', type: 'bad', exclusive: true, stack: true, params: { meters: 15 } },
  missile: { name: 'Füze (Büyük Geri)', icon: '🎯', type: 'bad', exclusive: true, stack: true, params: { meters: 40 } },
  explode: { name: 'Arabayı Patlat', icon: '💥', type: 'bad', exclusive: true, stack: true, params: { penalty: 0 } },
  popTire: {
    name: 'Teker Patlat', icon: '🛞', type: 'bad',
    params: { wheel: 'random' },
    options: { wheel: [['random', 'Rastgele'], ['front', 'Ön'], ['rear', 'Arka'], ['all', 'Hepsi']] },
  },
  spikes: { name: 'Dikenli Tel Koy', icon: '🌵', type: 'bad', params: {} },
  mine: { name: 'Mayın Koy', icon: '🧨', type: 'bad', params: {} },
  oil: { name: 'Yağ Birikintisi', icon: '🛢️', type: 'bad', params: {} },
  barrier: { name: 'Kaya / Engel', icon: '🪨', type: 'bad', params: {} },
  meteor: { name: 'Meteor Yağmuru', icon: '☄️', type: 'bad', params: { count: 5 } },
  tornado: { name: 'Hortum', icon: '🌪️', type: 'bad', exclusive: true, stack: true, params: { meters: 10 } },
  reverseGravity: { name: 'Yerçekimini Ters Çevir', icon: '🙃', type: 'bad', params: { seconds: 2 } },
  heavyGravity: { name: 'Ağır Yerçekimi', icon: '🏋️', type: 'bad', params: { seconds: 6 } },
  headwind: { name: 'Karşı Rüzgar', icon: '🌪️', type: 'bad', stack: true, params: { seconds: 5 } },
  freeze: { name: 'Dondur', icon: '🧊', type: 'bad', params: { seconds: 3 } },
  reverse: { name: 'Geri Vites', icon: '⏪', type: 'bad', params: { seconds: 3 } },
  drainFuel: { name: 'Benzin Çal', icon: '🕳️', type: 'bad', any: true, params: { percent: 15 } },
  earthquake: { name: 'Deprem', icon: '🌋', type: 'bad', params: { seconds: 3 } },
  mini: { name: 'Mini Araba', icon: '🐜', type: 'bad', exclusive: true, stack: true, params: { seconds: 12 } },
  flip: { name: 'Takla Attır', icon: '🤸', type: 'fun', exclusive: true, stack: true, params: {} },

  // --- Değişim / Eğlence ---
  changeVehicle: {
    name: 'Araç Değiştir', icon: '🚙', type: 'fun', exclusive: true, stack: true,
    params: { vehicle: 'random' }, options: { vehicle: vehicleOptions },
  },
  changeMap: {
    name: 'Harita Değiştir', icon: '🗺️', type: 'fun', exclusive: true, stack: true,
    params: { map: 'random' }, options: { map: mapOptions },
  },
  emojiRain: { name: 'Emoji Yağmuru', icon: '🌧️', type: 'fun', instant: true, any: true, params: { emoji: '❤️', count: 40 } },
  confetti: { name: 'Konfeti', icon: '🎉', type: 'fun', instant: true, any: true, params: {} },
  fireworks: { name: 'Havai Fişek', icon: '🎆', type: 'fun', instant: true, any: true, params: { bursts: 5 } },
  slowMotion: { name: 'Ağır Çekim', icon: '🐌', type: 'fun', params: { seconds: 4 } },
  paint: { name: 'Araba Rengini Değiştir', icon: '🎨', type: 'fun', instant: true, params: {} },
};

export const PARAM_LABELS = {
  power: 'Güç', seconds: 'Süre (sn)', meters: 'Metre', percent: 'Yüzde (%)', hits: 'Darbe sayısı',
  count: 'Adet', penalty: 'Ceza (m geri)', wheel: 'Tekerlek', vehicle: 'Araç', map: 'Harita',
  emoji: 'Emoji', bursts: 'Patlama sayısı',
};

export const TRIGGERS = {
  gift: 'Hediye',
  like: 'Beğeni (her N)',
  follow: 'Takip',
  share: 'Paylaşım',
  subscribe: 'Abonelik',
  member: 'Yayına katılma',
  chat: 'Sohbet komutu',
};

export const DEFAULT_SETTINGS = {
  controlMode: 'keyboard', // 'keyboard' (yayıncı sürer) | 'auto' (araç kendi gider)
  targetMeters: 1000, // +hedef: kazanma, -hedef: kaybetme sınırı
  winCountdown: 15,
  loseCountdown: 15,
  flipRecoverSeconds: 3,
  passengerMinDiamonds: 99,
  passengerSeconds: 30,
  liveSource: 'tikfinity',
  tikfinityUrl: 'ws://localhost:21213/',
  fuelRangeMeters: 300,
  emptySpeedPercent: 10,
  cruiseSpeed: 8,
  difficulty: 1,
  startVehicle: 'jeep',
  startMap: 'meadow',
  autoMapEvery: 0,
  fuelCanEvery: 120,
  fuelCanPercent: 25,
  randomHazards: true,
  hazardEvery: 90,
  respawnSeconds: 2.5,
  explodePenalty: 0,
  tireRepairSeconds: 25,
  antiStuck: true,
  airControl: true,
  viewerTagSeconds: 5,
  showAvatars: true,
  exclusiveGap: 1.0,
  maxQueue: 80,
  maxRepeat: 10,
  autoRestartSeconds: 15,
  volume: 0.6,
  sound: true,
  showQueue: true,
  showLeaderboard: true,
  showFeed: true,
  progressMarkers: true,
  tiktokUsername: '',
  zoom: 1,
};

let ruleId = 0;
const r = (trigger, action, params = {}, extra = {}) => ({
  id: `r${++ruleId}`,
  enabled: true,
  trigger,
  action,
  params: { ...ACTIONS[action].params, ...params },
  priority: 1,
  cooldown: 0,
  ...extra,
});

export function defaultRules() {
  ruleId = 0;
  return [
    r({ type: 'gift', gift: 'Rose' }, 'boost', { seconds: 2 }),
    r({ type: 'gift', gift: 'TikTok' }, 'jump'),
    r({ type: 'gift', gift: 'Finger Heart' }, 'refuel', { percent: 10 }),
    r({ type: 'gift', gift: 'GG' }, 'nitro'),
    r({ type: 'gift', gift: 'Ice Cream Cone' }, 'popTire', { wheel: 'random' }),
    r({ type: 'gift', gift: 'Doughnut' }, 'bomb', { meters: 15 }),
    r({ type: 'gift', gift: 'Perfume' }, 'rocket', { meters: 40 }),
    r({ type: 'gift', gift: 'Hand Hearts' }, 'shield'),
    r({ type: 'gift', gift: 'Confetti' }, 'changeVehicle', { vehicle: 'random' }),
    r({ type: 'gift', gift: 'Corgi' }, 'changeMap', { map: 'random' }),
    r({ type: 'gift', gift: 'Money Gun' }, 'explode'),
    r({ type: 'gift', gift: 'Galaxy' }, 'missile', { meters: 60 }),
    r({ type: 'like', every: 100 }, 'boost', { seconds: 1 }),
    r({ type: 'like', every: 500 }, 'refuel', { percent: 5 }),
    r({ type: 'follow' }, 'refuel', { percent: 5 }, { oncePerUser: true }),
    r({ type: 'follow' }, 'confetti', {}, { oncePerUser: true }),
    r({ type: 'share' }, 'emojiRain', { emoji: '🚗', count: 30 }),
    r({ type: 'subscribe' }, 'fireworks'),
    r({ type: 'chat', keyword: '!zıpla' }, 'jump', {}, { enabled: false, userCooldown: 30 }),
  ];
}

export function defaultConfig() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    rules: defaultRules(),
    maps: {}, // { meadow: { background: url, ground: url, groundMode: 'strip'|'pattern', groundMeters: 4 } }
    customVehicles: {}, // { "dosya.png": { name, enabled, width, openTop, ... } }
  };
}

export function mergeConfig(saved) {
  const def = defaultConfig();
  if (!saved || typeof saved !== 'object') return def;
  return {
    ...def,
    ...saved,
    settings: { ...def.settings, ...(saved.settings || {}) },
    rules: Array.isArray(saved.rules) ? saved.rules : def.rules,
    maps: saved.maps || {},
    customVehicles: saved.customVehicles || {},
  };
}

export async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    return mergeConfig(await res.json());
  } catch {
    return defaultConfig();
  }
}

export async function saveConfig(cfg) {
  await fetch('/api/config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg),
  });
}

export const normalizeName = (s) => String(s || '').toLocaleLowerCase('tr').replace(/[\s_\-.]+/g, '');
