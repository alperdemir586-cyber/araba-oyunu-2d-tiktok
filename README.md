# 🚙 Hediye Rallisi — TikTok etkileşimli 2D araba oyunu

TikTok canlı yayınında izleyicilerin gönderdiği **hediye, beğeni, takip, paylaşım ve
sohbet komutları** oyundaki araca etki eder: boost, roketle ileri fırlatma, bomba ile
takla attırarak geri gönderme, teker patlatma, araç/harita değiştirme ve daha fazlası.
Hedef, aracı **0'dan ayarlanan mesafeye** (varsayılan 1000 m) ulaştırmak.

Proje planı ve fikirler için: **[PLAN.md](PLAN.md)**

## Kurulum

Gereken: [Node.js](https://nodejs.org) 18 veya üstü.

```bash
npm install
npm start
```

- Oyun ekranı: <http://localhost:3000/>
- Yayıncı paneli: <http://localhost:3000/panel.html> (oyun ekranında **F2** ile de açılır)

### TikTok Live Studio / OBS'e ekleme

Oyun ekranını (`http://localhost:3000/`) **Tarayıcı kaynağı** olarak ekleyin
(dikey yayın için 1080×1920 önerilir). Paneli ayrı bir pencerede/ikinci ekranda açın;
paneldeki her değişiklik oyuna anında yansır.

### TikTok'a bağlanma

Panel → **Kontrol** → kullanıcı adınızı girip **Bağlan**'a basın (yayının açık olması gerekir).
Ya da başlatırken: `TIKTOK_USERNAME=kullaniciadi npm start`.

> Bağlantı resmi olmayan [`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector)
> kütüphanesiyle yapılır. TikTok tarafındaki değişiklikler bağlantıyı zaman zaman bozabilir;
> bu durumda `npm update tiktok-live-connector` deneyin.

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
| P / Boşluk | Durdur / devam |
| Shift+R | Yeniden başlat |
| F2 / Tab | Paneli aç/kapat |
| H | Arayüzü gizle |
| 1–9, 0 | Boost, Nitro, Zıpla, Roket, Bomba, Teker, Patlat, Araç, Harita, Benzin |
| M, S, T, E, Q | Füze, Kalkan, Hortum, Meteor, Işınla |

## Fizik testi

```bash
npm run check
```

Her araç her haritada 40 sn kendi kendine sürülür; ilerleme, ters dönme ve takılma
ölçülür. `ASSIST=0 npm run check` denge yardımı kapalıyken test eder.

## Proje yapısı

```
server/index.js      Express + WebSocket sunucusu, ayar kaydı, varlık listesi
server/tiktok.js     TikTok LIVE bağlantısı, olayları sadeleştirme, hediye serisi (streak) hesabı
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
