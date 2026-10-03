# 🚙 Hediye Rallisi — TikTok etkileşimli 2D araba oyunu

Aracı yayıncı **klavyeyle** sürer; TikTok canlı yayınındaki izleyicilerin gönderdiği
**hediye, beğeni, takip, paylaşım ve sohbet komutları** (TikFinity üzerinden) araca etki eder:
boost, roketle ileri fırlatma, bomba ile takla attırarak geri gönderme, teker patlatma,
araç/harita değiştirme ve daha fazlası.

## Kurallar

- Araç **0** noktasından başlar. Hedef ayarlanabilir (varsayılan **1000**).
- **+1000**'i geçince **15 sn kazanma geri sayımı** başlar. Bu sürede izleyiciler seni
  +1000'in gerisine atamazsa otomatik **kazanırsın**, kazanma puanı (🏆) bir artar.
- Geriye de gidilebilir; **−1000 ve ötesi sınırsız**. **−1000'in gerisine** düşersen
  **15 sn kaybetme geri sayımı** başlar. Bu sürede −999'a geri dönemezsen **kaybedersin** (💀 +1).
- Patlama oyunu bitirmez; araç birkaç saniye sonra yeniden doğar.
- Benzin bitince araç durmaz, çok yavaşlar. Benzin yalnızca gaza basarken harcanır.
- Araç **3 sn** ters kalırsa kendiliğinden düzelir.
- **Büyük hediye** (varsayılan ≥ 99 elmas) gönderenin profil fotoğrafı **30 sn** yolcu koltuğunda oturur.
- Aynı türden gelen eylemler birleşir (ör. üst üste 5 Nitro → tek, uzun bir Nitro).
  **Yüksek elmaslı hediyeler kuyruğun önüne geçer.**

Süreler, mesafeler ve elmas sınırı panelin **Ayarlar** sekmesinden değiştirilebilir.

Proje planı ve fikirler için: **[PLAN.md](PLAN.md)**

## Kurulum

Gereken: [Node.js](https://nodejs.org) 18 veya üstü.

```bash
npm install
npm start
```

- Oyun ekranı: <http://localhost:3456/>
- Yayıncı paneli: <http://localhost:3456/panel.html> (oyun ekranında **F2** ile de açılır)

### TikTok Live Studio / OBS'e ekleme

Aracı klavyeyle süreceğiniz için oyunu **normal bir tarayıcı penceresinde** (Chrome/Edge)
açın ve Live Studio/OBS'te **pencere yakalama** ile yayına ekleyin; klavye tuşları
odaklanmış pencereye gider. Dikey yayın için pencereyi dikey boyutlandırın.
Paneli ayrı bir pencerede/ikinci ekranda açın; paneldeki her değişiklik oyuna anında yansır.

Port 3456 doluysa başka bir port seçin: PowerShell'de `$env:PORT=3460; npm start` (cmd'de `set PORT=3460`).

### Canlı bağlantı: TikFinity

1. [TikFinity](https://tikfinity.zerody.one) uygulamasını açın ve yayınınıza bağlayın.
2. Oyunu başlatın (`npm start`). Oyun TikFinity'nin yerel WebSocket API'sine
   (`ws://localhost:21213/`) **otomatik bağlanır**. Sağ alttaki yazı **● TikFinity bağlı** olmalı.
   TikFinity sonradan açılırsa oyun kendiliğinden yeniden dener.
3. Adres farklıysa: Panel → **Kontrol** → *Canlı yayın bağlantısı* bölümünden değiştirin.

Alternatif olarak TikFinity'nin "Actions & Events" bölümünde Webhook ile doğrudan eylem
tetikleyebilirsiniz: `http://localhost:3456/api/trigger?action=nitro&user={nickname}`
(`action` = eylem adı: `boost`, `nitro`, `bomb`, `rocket`, `explode`, `popTire` …).

TikFinity olmadan doğrudan TikTok'a bağlanmak da mümkün: panelde kaynağı **Doğrudan TikTok**
yapıp kullanıcı adınızı girin (resmi olmayan `tiktok-live-connector` kütüphanesi kullanılır).

## Masaüstündeki klasörleri kullanma

Görselleri `assets/` altındaki klasörlere kopyalayabilir **ya da** sunucuyu doğrudan
masaüstündeki klasörleri gösterecek şekilde başlatabilirsiniz:

```powershell
# Windows PowerShell örneği
$env:GIFTS_DIR="$HOME\Desktop\tiktok-hediye"
$env:CARS_DIR="$HOME\Desktop\dosyalar 2d"
npm start
```

| Klasör | Ortam değişkeni | İçerik |
|---|---|---|
| `assets/gifts` | `GIFTS_DIR` | Hediye görselleri (dosya adı = hediye adı) |
| `assets/cars` | `CARS_DIR` | Araç PNG'leri (panelden araç olarak açılır) |
| `assets/backgrounds` | `BACKGROUNDS_DIR` | Arka plan görselleri |
| `assets/ground` | `GROUND_DIR` | Zemin dokuları |
| `assets/sounds` | `SOUNDS_DIR` | İsteğe bağlı özel sesler |

Her klasördeki `README.md` ayrıntıları anlatır. Görsel atanmayan her şey oyunun kendi
çizimleriyle çalışır; yani oyun hiçbir görsel olmadan da oynanabilir.

## Panel

- **Kontrol:** TikTok bağlantısı, canlı durum (mesafe, benzin, kuyruk), durdur/devam,
  yeniden başlat, kuyruğu temizle.
- **Kurallar:** Tetik (hediye / her N beğeni / takip / paylaşım / abonelik / katılım /
  sohbet komutu) → eylem + parametreler. Öncelik, bekleme süresi, kişi başı bekleme,
  maksimum tekrar, "kişi başı bir kez" seçenekleri. Hediye listesinden tıklayarak kural eklenir.
- **Test:** Hediye/beğeni/takip simülasyonu, stres testleri (50 beğeni, 10 patlatma,
  100 karışık hediye, 20 kişi aynı anda), her eylemi tek tek deneme.
- **Ayarlar:** Hedef mesafe, hız, yokuş zorluğu, **dolu deponun kaç metre gittiği**, benzin
  bitince hız, bidon aralığı, rastgele engeller, kuyruk ayarları, görünüm, ses…
- **Görseller:** Haritalara arka plan/zemin atama; özel araçların teker, koltuk ve
  sürücü konumlarını önizlemeyle ayarlama.

Ayarlar `data/config.json` dosyasına kaydedilir; panelden JSON olarak yedeklenip geri yüklenebilir.

## Klavye kısayolları (oyun ekranı)

| Tuş | İşlev |
|---|---|
| → / D | Gaz (ileri) |
| ← / A | Geri |
| ↑ / W | Geriye eğil (havada geri takla) |
| ↓ / S | Öne eğil (havada ön takla) |
| P | Durdur / devam |
| Shift+R | Yeniden başlat |
| F2 / Tab | Paneli aç/kapat |
| H | Arayüzü gizle |
| 1–9, 0 | Boost, Nitro, Zıpla, Roket, Bomba, Teker, Patlat, Araç, Harita, Benzin |
| M, K, T, E, Q | Füze, Kalkan, Hortum, Meteor, Işınla |

Araç kontrolü panelden **Otomatik** yapılırsa araç kendi kendine ilerler.

## Fizik testi

```bash
npm run check
```

Her araç her haritada 40 sn kendi kendine sürülür; ilerleme, ters dönme ve takılma
ölçülür. `ASSIST=0 npm run check` denge yardımı kapalıyken test eder.

## Proje yapısı

```
server/index.js      Express + WebSocket sunucusu, ayar kaydı, varlık listesi
server/tiktok.js     TikFinity ve doğrudan TikTok bağlantısı, olay sadeleştirme, hediye serisi (streak) hesabı
public/index.html    Oyun ekranı
public/panel.html    Yayıncı paneli
public/js/
  game.js            Oyun döngüsü, kamera, benzin, uçuş/takla, patlama, kazanma
  vehicles.js        Araç tanımları, fizik (süspansiyon, motor, teker patlatma), çizim
  driver.js          Sarsıntıya tepki veren 2D sürücü karakteri
  terrain.js         Prosedürel yokuşlu zemin
  maps.js            Haritalar (biyomlar), arka planlar, dekorlar
  hazards.js         Engeller, benzin bidonları, bomba/füze/meteor
  actions.js         Eylemlerin etkileri
  catalog.js         Eylem kataloğu, varsayılan ayarlar ve kurallar
  rules.js           Kural motoru ve eylem kuyruğu
  effects.js         Parçacık efektleri
  audio.js           Ses efektleri (sentez + özel dosyalar)
  hud.js             Ekran arayüzü
  panel.js           Panel arayüzü
scripts/check.js     Tarayıcısız fizik testi
```
