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

## [1.3.0] - 2026-07-28

### Değişenler
- Node.js sürümü 20 → 26 olarak güncellendi
- `@types/node` `^20.10.6` → `^26.0.0`
- TypeScript hedefi ES2022 → ES2024
- `.nvmrc` dosyası eklendi (`26`)
- `package.json`'a `engines: { node: ">=26.0.0" }` tanımı eklendi

> Bu sürümün tek odağı Node.js altyapı güncellemesidir. Yeni bir özellik eklenmemiştir.

## [1.4.0] - 2026-10-01

### Eklenenler
- **`/kick mesaj`** komutu (eski `/kick metin`) — embed'in **altındaki ek mesajı**
  değiştirir. Yayın başlığı artık her zaman en üstte otomatik gösterilir, mesaj
  komutu yalnızca altındaki metni yönetir.
- **`b` kısaltması** — ek mesajda `b` veya `{b}` = başlık. Yalnızca bağımsız kelime
  olduğunda genişler (`baba`, `bize` bozulmaz).
- **"Varsayılana dön" artık çalışıyor** — `/kick mesaj tur:canli|bitti` (mesaj boş
  bırakılırsa) özel metni siler, varsayılanı geri getirir.
- **Kick entegrasyonu** — Kick kanalı 30 saniyede bir kontrol edilir, yayın başlayınca
  Discord'a yeni duyuru mesajı atılır, yayın bitince **aynı mesaj güncellenir**
- `/kick` komutu (7 subcommand, sadece Admin):
  - `slug` — Kick kanalı ayarı (`xqc` veya `https://kick.com/xqc`)
  - `kanal` — Discord duyuru kanalı ayarı (bot yetkileri kontrol edilir)
  - `ping` — rol / `@everyone` / ping yok seçimi
  - `metin` — yayın başlangıç ve bitiş metinlerinin özelleştirilmesi
  - `test` — anlık kontrol + yayındaysa duyuruyu gönderme
  - `durum` — ayarlar ve anlık Kick durumu
  - `kaldir` — tüm Kick ayarlarını silme
- **Resmi Kick Public API** (`api.kick.com`, OAuth2 Client Credentials / App Access Token)
  - Token önbelleği, süre dolmadan 60sn önce yenileme
  - Yenileme başarısızsa son geçerli token ile devam (ağ dalgalanması duyuruyu kesmez)
  - 401/403'te token düşürülüp bir kez yeniden denenir
- **`public-v2` yedek modu** — `KICK_CLIENT_ID`/`KICK_CLIENT_SECRET` yoksa auth'suz
  `kick.com/api/v2/channels/{slug}` endpoint'ine düşer (dev.kick.com onayı gelene kadar test için)
- **Özelleştirilebilir duyuru metni** — `{baslik}` `{kategori}` `{slug}` `{link}`
  `{baslangic}` `{sunucu}` ve bittiğinde `{bitis}` `{sure}` `{izleyici}` placeholder'ları
- **Tekrar duyurma koruması** — `sessionKey` (resmi API'de `start_time`, v2'de livestream id)
  karşılaştırılır; bot restart olsa bile aynı yayın tekrar duyurulmaz
- `data/kickState.json` — aktif yayın state'i (mesaj id, başlık, thumbnail, izleyici)
- Ayrıntılı hata tipleri: `KickAuthError` / `KickNotFoundError` / `KickRateLimitError` / `KickNetworkError`
- **Özel görseller (`assets/kick/`)** — kullanıcı `start.png` ve/veya `finish.png` koyarsa
  Kick'in yayın karesi yerine onlar kullanılır. Klasör ilk açılışta otomatik oluşturulur.
  Dosya yoksa Kick karesine düşülür (boş/okunamayan dosyalar da yok sayılır).
  Yerel dosya Discord'a `attachment://start.png` olarak yüklenir.
  `/kick durum` altında "🖼️ Özel Görseller" bilgisi gösterilir.
- Yeni çevre değişkenleri: `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`, `KICK_API_MODE`

### Düzeltilenler (test sırasında bulunanlar)
- **Yayın sırasında başlık değişince embed görseli kayboluyordu:** `update` yolu görseli
  geçirmediği için özel görsel (`attachment://start.png`) düşüyordu. Görsel kaynağı artık
  `KickState.imageSource` ile duyuru anında sabitleniyor ve her düzenlemede aynısına
  referans veriliyor.
- **"Varsayılana dön" sessizce hiçbir şey yapmıyordu:** `updateKickSettings` patch'teki
  `undefined` değerleri sessizce atlıyordu, dolayısıyla `kickLiveText`/`kickEndedText`
  alanları **silinmiyordu** — kullanıcı yanlışlıkla değiştirdiği metne geri dönemiyordu.
  Artık `null`/`undefined` alanı siliyor (`delete`).
- **Ping modu değişince eski rol ID'si kalıyordu:** `/kick ping mod:herkes` sonrası
  `kickPingRoleId` diskte bayat kalıyordu. Artık mod "rol" değilse siliniyor.
- **`b` kısaltması mesajın başında kullanılınca kayboluyordu:** `b` önce `{başlık}`'a
  genişletilip sonra "baştaki başlık" kuralıyla siliniyordu → "b konusunda yayındayız"
  bozuk biçimde "konusunda yayındayız" oluyordu. İşlem sırası ters çevrildi: önce
  literal `{başlık}` temizleniyor, sonra `b` genişletiliyor.
- **`npm run dev` çalışmıyordu:** script `src/index.ts` yolunu gösteriyordu, ancak
  gerçek giriş noktası kökte `index.ts`. Script düzeltildi.
- **`npm run dev` sonrası `Cannot find module './src/commands/time.js'`:** ana `tsconfig.json`
  içindeki `rewriteRelativeImportExtensions` (TS 5.7+), import'ları emit edilen `.js`
  yollarına çeviriyor — ts-node ise bellekte çalıştığı için bu dosyalar diskte yok.
  `tsconfig.dev.json` eklendi (`rewriteRelativeImportExtensions: false`, `noEmit: true`);
  `dev` script'i artık `--project tsconfig.dev.json` kullanıyor. **Üretim (`tsc` → `dist`)
  etkilenmedi**, orada `.js` çıktısı doğru şekilde üretiliyor.
- **`\w` regex'i ASCII-only olduğu için `{başlık}` gibi Türkçe placeholder'lar hiç
  eşleşmiyordu** — varsayılan metin `{başlık}` placeholder'ı literal olarak görünüyordu.
  Regex `[^{}\s]+` ile unicode kapsamına alındı.
- **`foldKey()` noktasız `ı` harfini normalize etmiyordu** — NFD, U+0131'i ayrıştırmadığı
  için `başlık` → `baslık` oluyor ve `baslik` ile eşleşmiyordu. Açık `ı→i` eşlemesi eklendi.
- **v2 `livestream.id` sayı (number) olarak döndüğü için** `sessionKey` boş kalıyordu.
  `str()` artık number değerleri de kabul ediyor.
- v2'de `livestream.thumbnail` boş geldiğinde kanal banner'ı görsel olarak kullanılıyor
  (kırık embed görseli yerine).