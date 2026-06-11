# Changelog - Fracture Discord Bot

## [1.0.0] - 2026-06-09

### Eklenenler
- `/time` komutu ile modal tabanlı duyuru oluşturma
- Zaman formatı desteği: `1h 30d` (kısa yol) ve `YYYY-MM-DD HH:MM` (tarih)
- Kanal ve rol seçimi: ID, `#kanal`, `@rol` isim veya mention formatı
- 👁️ Görüldü butonu - tıklayan kullanıcı duyuruyu görmüş sayılır
- 📜 Liste butonu - sadece tıklayan kişiye özel gören listesi
- Yarı süre otomatik hatırlatma (kanalda ping)
- Son dilim DM bildirimi (görmeyenlere, 15dk/1dk)
- Yayıncı modu tespiti ve DM ile ping onayı
- `/add` komutu ile özel rol ekleme
- JSON dosya tabanlı veri saklama
- `dotenv` ile `.env` desteği

### Düzeltilenler
- `.env` dosyası yüklenmemesi sorunu → `dotenv` eklendi

## [1.1.0] - 2026-06-10

### Eklenenler
- `/timestop [id]` komutu - Devam eden bir duyuruyu iptal etme
- `d` kısaltması artık **dakika** anlamında (`5d` = 5 dakika)
- `day` kısaltması **gün** anlamında (`2day` = 2 gün)
- Yeni bildirim zamanlaması:
  - ⚡ Yarı süre dolunca kanalda ping (sürenin %50'si geçince)
  - 🔔 Son dilimde DM bildirimi (1 saat+ sürelerde son 15dk, daha kısada son 1dk)
- `totalMs` alanı ile duyuru toplam süresi veritabanında saklanıyor
- Bot yeniden başlayınca kaçırılan bildirimler otomatik tetikleniyor

### Düzeltilenler
- Bildirim zaman penceresi kaldırıldı, bot restartında kaçırılan bildirimler çalışır
- Yayıncı DM yanıtında duyuru içeriği gönderiliyor
- **Gecikme tespiti düzeltildi**: Artık threshold bazlı (`threshold + 90s`)
- **Süre dolunca bildirim**: Kanala "süre doldu" mesajı + ping + embed güncellemesi
- **%50 ve %75 bildirimleri**: Varolan duyuru mesajı güncelleniyor, ayrıca kısa ping mesajı atılıyor (yeni duyuru değil)
- **Embed durum güncellemesi**: %50'de ⏰ turuncu, %75'te 🔔 koyu turuncu, süre dolunca 🚫 kırmızı

## [1.2.0] - 2026-06-10

### Eklenenler
- `/report` komutu - Hata reportu (modal → owner DM + 15dk kişisel cooldown + fotoğraf URL)
- `/ss` komutu - İstek/öneri gönderme (modal → owner DM)
- `/up` komutu - Bot durumu (uptime, API gecikmesi, bot gecikmesi, sürüm bilgisi)
- `data/cooldowns.json` - Cooldown takip sistemi
- Owner DM entegrasyonu (ID: 1068171016603443202)
