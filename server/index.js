// Oyun sunucusu: statik dosyalar, ayar kaydı, varlık (asset) listesi,
// TikTok LIVE bağlantısı ve oyun <-> panel arasındaki WebSocket köprüsü.
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { TikTokBridge } from './tiktok.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Varlık klasörleri. Masaüstündeki klasörleri kopyalamak yerine ortam
// değişkeniyle doğrudan gösterebilirsiniz (README'ye bakın).
const ASSET_DIRS = {
  cars: process.env.CARS_DIR || path.join(ROOT, 'assets', 'cars'),
  backgrounds: process.env.BACKGROUNDS_DIR || path.join(ROOT, 'assets', 'backgrounds'),
  ground: process.env.GROUND_DIR || path.join(ROOT, 'assets', 'ground'),
  gifts: process.env.GIFTS_DIR || path.join(ROOT, 'assets', 'gifts'),
  sounds: process.env.SOUNDS_DIR || path.join(ROOT, 'assets', 'sounds'),
};
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const SOUND_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a']);

fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/vendor/planck.min.js', (req, res) =>
  res.sendFile(path.join(ROOT, 'node_modules', 'planck', 'dist', 'planck.min.js')));
for (const [name, dir] of Object.entries(ASSET_DIRS)) {
  fs.mkdirSync(dir, { recursive: true });
  app.use(`/assets/${name}`, express.static(dir));
}

function listFiles(dir, exts, prefix = '') {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(path.join(dir, prefix), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(dir, exts, rel));
    else if (exts.has(path.extname(e.name).toLowerCase())) out.push(rel);
  }
  return out.sort((a, b) => a.localeCompare(b, 'tr'));
}

app.get('/api/assets', (req, res) => {
  const result = {};
  for (const [name, dir] of Object.entries(ASSET_DIRS)) {
    const exts = name === 'sounds' ? SOUND_EXT : IMAGE_EXT;
    result[name] = listFiles(dir, exts).map((f) => ({
      file: f,
      url: `/assets/${name}/${f.split('/').map(encodeURIComponent).join('/')}`,
      name: path.basename(f, path.extname(f)),
    }));
  }
  res.json(result);
});

app.get('/api/config', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))); }
  catch { res.json(null); }
});

app.post('/api/config', (req, res) => {
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(req.body, null, 2));
  fs.renameSync(tmp, CONFIG_FILE);
  broadcast({ type: 'config-updated' });
  res.json({ ok: true });
});

// Hediye listesi: klasördeki görseller + (bağlıysa) TikTok'un oda hediye listesi.
app.get('/api/gifts', async (req, res) => {
  const folder = listFiles(ASSET_DIRS.gifts, IMAGE_EXT).map((f) => ({
    name: path.basename(f, path.extname(f)),
    image: `/assets/gifts/${f.split('/').map(encodeURIComponent).join('/')}`,
    source: 'klasör',
  }));
  const live = await tiktok.getAvailableGifts().catch(() => []);
  res.json({ folder, live });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(msg, except) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client !== except && client.readyState === 1) client.send(data);
  }
}

const tiktok = new TikTokBridge({
  onEvent: (event) => broadcast({ type: 'tiktok', event }),
  onStatus: (status) => broadcast({ type: 'status', tiktok: status }),
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', tiktok: tiktok.status }));
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.type) {
      case 'tiktok-connect':
        tiktok.connect(msg.username);
        break;
      case 'tiktok-disconnect':
        tiktok.disconnect();
        break;
      default:
        // Panel komutları ve oyun durum bilgisi diğer istemcilere aktarılır.
        broadcast(msg, ws);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n  Oyun:  http://localhost:${PORT}/`);
  console.log(`  Panel: http://localhost:${PORT}/panel.html\n`);
  const user = process.env.TIKTOK_USERNAME;
  if (user) tiktok.connect(user);
});
