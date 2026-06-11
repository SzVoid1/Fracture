# Fracture Discord Bot - Sürüm Bilgisi

## Mevcut Sürüm: 1.2.0 (Kararlı)

### Özet
Zaman bazlı rol etiketleme botu. Belirli bir zaman, başlık, açıklama ve rol alarak duyuru oluşturur.
Süre %50'sinde kanal pingi, %75'inde DM bildirimi gönderir. Ayrıca hata report, öneri ve bot durumu komutları içerir.

**Dil:** TypeScript · **Kütüphane:** Discord.js v14 · **Veri:** JSON (`data/`) · **Test:** Jest + ts-jest

### Özellikler
- `/time` - Modal ile duyuru oluşturma (başlık, açıklama, zaman, kanal, rol)
- `/timestop <id>` - Devam eden duyuruyu iptal (embed kırmızıya döner, storage'dan silinir)
- `/add` - `/time` komutunu kullanma izni verilen rol ekleme
- `/unadd` - Dropdown ile yetkili rol kaldırma
- `/report` - Hata reportu (modal → owner DM, 15dk kişisel cooldown)
- `/ss` - İstek/öneri (modal → owner DM)
- `/up` - Bot durumu (uptime, API/bot gecikmesi, d.js + Node sürümleri)
- ⏰ Zaman formatı: `5d` (5dk), `2day` (2gün), `1h 30d`, `1s`, `YYYY-MM-DD HH:MM`
- 🆔 Kanal/Rol: ID, `#kanal`/`@rol` isim veya `<#id>`/`<@&id>` mention
- 👁️ Görüldü butonu (tıklayan %75 DM'den muaf)
- 📜 Liste butonu (ephemeral, sadece tıklayana - gören kullanıcı listesi)
- ⚡ Sürenin %50'si geçince kanal bildirimi + ping (embed ⏰ turuncu)
- 🔔 Sürenin %75'i geçince DM bildirimi (embed 🔔 koyu turuncu)
- 🚫 Süre dolunca embed kırmızı + kanala "süre doldu" pingi
- ⚠️ Gecikmeli bildirimlerde (>90s) otomatik özür mesajı
- 📡 Yayıncı modu tespiti ve DM ile ping onayı (✅/❌ buton)
- 🔄 Bot restartında kaçırılan bildirimleri anında tetikleme
- ✅ Varolan duyuru embed'ini güncelleme (yeni mesaj atmaz, embed güncellenir + kısa ping)
- ✅ Embed durum renkleri: ✅ mavi → ⏰ turuncu (%50) → 🔔 koyu turuncu (%75) → 🚫 kırmızı (süre doldu)

### Komutlar
| Komut | Açıklama | Yetki |
|-------|----------|-------|
| `/time` | Duyuru oluşturma modalı | Admin veya `/add` ile eklenen roller |
| `/timestop <id>` | Duyuru iptal | Admin |
| `/add` | Rol ekleme | Admin |
| `/unadd` | Dropdown ile rol kaldırma | Admin |
| `/report` | Hata bildirimi | Herkes (15dk cooldown) |
| `/ss` | İstek/öneri | Herkes |
| `/up` | Bot durumu | Herkes |

### Bildirim Zamanlaması
1. **Duyuru oluşturulur** → kanalda embed + 👁️📜 butonları
2. **Sürenin %50'si geçince** → embed güncellenir (⏰ turuncu) + kanalda ayrı ping
3. **Sürenin %75'i geçince** → embed güncellenir (🔔 koyu turuncu) + görmeyenlere DM
4. **Süre dolar** → embed kırmızıya döner (🚫) + kanalda "süre doldu" pingi → storage'dan silinir
5. **Yayıncı (streamer)** → DM ile ✅/❌ onay sorusu (otomatik ping atılmaz)
6. **Gecikme** → Bot restartı kaynaklı gecikmelerde (>90s) embed'e ⚠️ özür mesajı

### Veri Saklama (JSON, `data/` klasörü)
- `announcements.json` - Duyuru kayıtları (id, başlık, açıklama, kanal, rol, zaman, totalMs, seenBy, bildirim durumu)
- `settings.json` - Sunucu ayarları (izinli roller)
- `cooldowns.json` - Kullanıcı cooldown takibi (report için 15dk, expired entry otomatik temizlenir)

### Önemli Detaylar
- **Scheduler:** 30 saniyede bir kontrol eder; gecikme eşiği 90s (3 cycle)
- **totalMs:** Her duyuruda saklanır, %50 ve %75 threshold hesaplamasında kullanılır
- **dotenv:** `import 'dotenv/config'` ile en başta yüklenir (token hatasını önler)
- **GUILD_ID:** `.env`'de tanımlıysa komutlar anında o sunucuya kaydedilir; tanımlı değilse global (1 saate kadar cache)
- **Owner ID:** `1068171016603443202` (hardcoded, report ve ss DM'leri)
- **guild.members.fetch():** `role.members` iterasyonundan önce çağrılır (cache dolu garantisi)
- **d kısaltması:** dakika (Türkçe kısaltma), `day` = gün
- **Modal dispatch:** `handleTimeModal` dynamic require ile `index.ts` ve `interactionCreate.ts`'de kullanılır (circular import önlenir)

### Test
```bash
npm test            # 24 test çalışır (14 timeParser + 9 storage)
npm run test:watch  # Watch modu
```

### Kod Yapısı
```
src/
├── commands/
│   ├── time.ts        # /time (modal + handler), /add, /timestop, /unadd
│   ├── report.ts      # /report (modal + owner DM + cooldown)
│   ├── ss.ts          # /ss (modal + owner DM)
│   └── up.ts          # /up (uptime + latency embed)
├── events/
│   ├── ready.ts       # Bot başlangıcı + scheduler start
│   └── interactionCreate.ts  # 👁️📜 buton, unadd select, yayıncı DM
├── utils/
│   ├── scheduler.ts   # 30s loop, %50 kanal ping, %75 DM, süre doldu
│   ├── storage.ts     # JSON CRUD (announcements, settings, cooldowns)
│   └── timeParser.ts  # Zaman ayrıştırma + formatDuration
└── index.ts           # Ana giriş, 7 komut kaydı, modal dispatch
```

### Kurulum
```bash
npm install
cp .env.example .env
# .env dosyasını düzenleyin (DISCORD_TOKEN, CLIENT_ID, opsiyonel GUILD_ID)
npm run build
npm start
```
