# Proje Planı — Hediye Rallisi

TikTok canlı yayınında izleyici etkileşimlerinin (hediye, beğeni, takip, paylaşım, sohbet)
oyundaki araca eylem olarak bağlandığı, hedefin aracı ayarlanan mesafeye (ör. 0 → 1000 m)
ulaştırmak olduğu 2D, fizik tabanlı bir yayın oyunu.

## 1. Mimari

```
TikTok LIVE ──► server/tiktok.js ──► WebSocket ──► Oyun (tarayıcı)
                     (olay sadeleştirme,              │  Kural motoru → Kuyruk → Eylemler
                      streak farkı)                    │  Fizik (planck.js / Box2D)
                                                       │
            Yayıncı paneli ◄──── WebSocket ────────────┘  (komut, test, canlı durum)
            (ayarlar → data/config.json)
```

- **Sunucu (Node.js):** statik dosyalar, ayar kaydı, `assets` klasörlerinin listesi,
  TikTok bağlantısı ve panel ↔ oyun köprüsü.
- **Oyun (HTML5 Canvas + planck.js):** OBS / TikTok Live Studio'ya tarayıcı kaynağı
  olarak eklenir. Kurulum gerektirmez, her çözünürlükte (dikey/yatay) çalışır.
- **Panel:** ayrı sayfa; ikinci ekranda ya da oyun üzerinde (F2) açılır.

## 2. İstenen özellikler ve durumu

| İstek | Durum | Not |
|---|---|---|
| Hediyelere eylem bağlama, kural editörü | ✅ | Hediye adı veya ID ile; klasördeki hediye görsellerinden tıklayarak kural |
| Takip, beğeni, paylaşım vb. için kural | ✅ | Beğeni "her N beğenide" birikir; takip "kişi başı bir kez" olabilir |
| Hedef mesafe ayardan | ✅ | Ekranda 0 → hedef ilerleme barı ve hediye işaretleri |
| Araç değiştirme | ✅ | 7 çizilmiş araç + klasördeki PNG'lerden özel araçlar |
| Harita değiştirme | ✅ | 6 harita; geçiş noktasında portal, arka plan yumuşak geçiş |
| Ayrı ayrı teker patlatma | ✅ | Ön / arka / rastgele / hepsi; patlak teker basık çizilir, araç sürünür |
| Boost, patlatma | ✅ | Boost, Nitro; patlama → enkaz, yeniden doğma (oyun bitmez) |
| Rastgele yokuşlu harita | ✅ | Deterministik gürültü; mesafe arttıkça zorlaşır |
| Benzin, menzil ayardan | ✅ | "Dolu depo kaç metre gider"; bitince araç çok yavaşlar (ayarlanabilir %) |
| İzleyici adı + fotoğrafı aracın üstünde, süreyle kaybolur | ✅ | Aynı anda en fazla 3 etiket |
| Kuyruk ve çakışma yönetimi | ✅ | Öncelik, birleştirme, özel eylemler sırayla, düşürme sayacı |
| Ses ve görsel efektler | ✅ | Parçacıklar, ekran sarsıntısı, flaş, emoji yağmuru; sesler sentez veya dosya |
| Sabotaj / tuzak modu | ✅ | Dikenli tel, mayın, yağ, kaya, meteor, ters yerçekimi, karşı rüzgar… |
| Geri fırlatma (bomba, takla ile X m) | ✅ | Bomba/füze/hortum: tam ayarlanan mesafe kadar, takla atarak |
| Yayıncı paneli: durdurma, kural değiştirme, test | ✅ | |
| Stres testi | ✅ | Panelde hazır senaryolar; 150+ olayda 60 FPS ölçüldü |
| Fizik hatalarının giderilmesi | ✅ | Ters dönünce otomatik düzelme, takılınca itme, havada denge, `npm run check` |
| Kaliteli 2D sürücü, açık araçlarda görünür, sarsıntıya tepki | ✅ | Yay-sönümleyici kafa/gövde, göz kırpma, ruh hali ifadeleri, dalgalanan atkı |

## 3. Eklediğim fikirler

**Oyun içi (yapıldı)**
- **Kalkan:** belirli sayıda sabotajı engeller (izleyiciler arası "savunma vs saldırı" rekabeti).
- **Yol üstü benzin bidonları** ve "benzin yağmuru" hediyesi; "benzin çal" sabotajı.
- **Işınlanma, roket, süper zıplama, rampa, düşük yerçekimi, arkadan rüzgar, dev araba.**
- **Dondur, geri vites, deprem, mini araba, ağır yerçekimi, hortum** gibi sabotajlar.
- **Ağır çekim, konfeti, havai fişek, araba boyama** gibi eğlence eylemleri.
- **Liderlik tablosu** (en çok elmas gönderenler) ve hedefe ulaşınca **tebrik ekranı**.
- **Tur sayacı ve süre:** her tur bitince otomatik yeni tur; rekor süre kovalamaca.
- **Otomatik harita değişimi** (her N metrede) — yayın tekdüzeleşmesin.
- **Birleştirme:** art arda gelen aynı hediyeler tek, daha güçlü eyleme dönüşür
  (5 Boost → uzun boost; 3 bomba → 3 kat mesafe ve daha çok takla).

**Sonraki adımlar için öneriler**
1. **İki takım modu:** "Yardımcılar vs Sabotajcılar" — iki hediye grubu, ekranda takım skoru.
2. **Bölüm hedefleri / kilometre taşları:** 250 m, 500 m'de ödül animasyonu ve sesli kutlama.
3. **Rekor tablosu:** en hızlı tur süreleri ve en çok katkı yapanlar kalıcı kayıt.
4. **Sesli okuma (TTS):** büyük hediyelerde izleyici adının sesli okunması.
5. **Oylama:** sohbet komutlarıyla sonraki haritayı/aracı seçtirme (`!harita kar`).
6. **TikTok hedef (Goal) entegrasyonu:** yayın hedef çubuğu ile oyun hedefini eşleme.
7. **Mobil kontrollü yayıncı paneli:** telefondan durdur/test.
8. **Euler Stream API anahtarı desteği:** resmi olmayan bağlantı kütüphanesinin
   kısıtlamalarına karşı daha kararlı bağlantı (kütüphane destekliyor).

## 4. Aşamalar

| Aşama | İçerik | Durum |
|---|---|---|
| 1. Altyapı | Sunucu, TikTok bağlantısı, WebSocket, ayar kaydı | ✅ |
| 2. Fizik ve hareket | Süspansiyonlu araç, prosedürel zemin, benzin, kamera | ✅ |
| 3. Kural motoru ve kuyruk | Tetik → eylem, öncelik/bekleme/birleştirme | ✅ |
| 4. Eylemler ve efektler | 40 eylem, parçacıklar, sesler, mermiler, engeller | ✅ |
| 5. Arayüz | Hedef barı, benzin, kuyruk, akış, liderlik, izleyici etiketleri | ✅ |
| 6. Panel | Kurallar, test/stres, ayarlar, görsel ve araç editörü | ✅ |
| 7. Görsel entegrasyonu | Masaüstündeki görsellerin atanması ve ince ayarı | ⏳ Görseller eklenince |
| 8. Canlı test | Gerçek yayında deneme, hediye adlarının doğrulanması, denge ayarları | ⏳ |
| 9. Öneriler | Yukarıdaki "sonraki adımlar" listesinden seçilenler | ⏳ |

## 5. Riskler

- **TikTok bağlantısı resmi değil:** TikTok değişiklik yaptığında kütüphane güncellemesi
  gerekebilir. Oyun bağlantıdan bağımsız çalışır; panelden test olaylarıyla oynanabilir.
- **Hediye adları:** TikTok olaylarında hediye adları İngilizce gelir. Klasördeki dosya
  adları farklıysa kurala hediye ID'si yazılabilir (bağlıyken panelde gerçek liste görünür).
- **Yoğun hediye yağmuru:** kuyruk uzunluğu sınırlı (ayarlanabilir); aşan düşük öncelikli
  işler düşürülür ve panelde sayılır.
