# Memory Bank - Fracture Discord Bot

## Proje Bilgisi
**Bot Adı:** Fracture  
**Sürüm:** 1.0.0  
**Dil:** TypeScript  
**Kütüphane:** Discord.js v14  
**Test:** Jest + ts-jest  
**Veri Saklama:** JSON dosyaları (`data/` klasörü)  

## Dosya Yapısı
```
fracture/
├── src/
│   ├── commands/
│   │   ├── time.ts              # /Time komutu & /add komutu
│   │   ├── kick.ts              # /kick komutu (Kick duyuru entegrasyonu)
│   │   ├── report.ts
│   │   ├── ss.ts
│   │   ├── up.ts
│   │   ├── help.ts
│   │   └── update.ts
│   ├── events/
│   │   ├── ready.ts              # Bot başlangıcı
│   │   └── interactionCreate.ts  # Buton/Modal yönetimi
│   ├── utils/
│   │   ├── timeParser.ts         # Zaman formatı çözümleme
│   │   ├── scheduler.ts          # Zamanlayıcı motor
│   │   ├── storage.ts            # JSON veri yönetimi
│   │   ├── announcementEmbed.ts  # Duyuru embed'i
│   │   ├── kickApi.ts            # Kick API istemcisi (resmi + public-v2)
│   │   ├── kickText.ts           # Duyuru mesajı + placeholder render
│   │   ├── kickEmbed.ts          # Kick live/ended embed + buton
│   │   ├── kickImages.ts         # assets/kick görsel çözümleme
│   │   ├── kickState.ts          # Aktif Kick yayın state'i
│   │   └── kickMonitor.ts        # Kick yayın takip motoru
│   └── index.ts                  # Ana giriş noktası
├── assets/
│   └── kick/                     # Kullanıcının start.png / finish.png dosyaları
├── test/
│   ├── timeParser.test.ts        # Zaman çözümleme testleri
│   ├── storage.test.ts           # Veri saklama testleri
│   ├── scheduler.test.ts
│   ├── announcementEmbed.test.ts
│   ├── kickApi.test.ts           # Kick API + token cache testleri
│   ├── kickText.test.ts          # Placeholder testleri
│   ├── kickEmbed.test.ts         # Kick embed testleri
│   ├── kickImages.test.ts        # Görsel çözümleme testleri
│   └── kickMonitor.test.ts       # resolveKickAction testleri
├── memory-bank/
│   ├── MEMORY.md                 # Proje bilgisi
│   ├── VERSION.md                # Sürüm notları
│   └── CHANGELOG.md              # Değişiklik kaydı
├── .env.example                  # Çevre değişken şablonu
├── .gitignore
├── jest.config.js
├── package.json
└── tsconfig.json
```

## Komutlar

### /time (Modal)
| Alan | Açıklama | Format |
|------|----------|--------|
| Başlık | Duyuru başlığı | Kısa metin (max 100) |
| Açıklama | Duyuru içeriği | Uzun metin (max 1000) |
| Zaman | Bitiş zamanı | `1h 30m` veya `2024-12-31 23:59` |
| Kanal | Duyuru kanalı | ID, `#kanal-ismi` veya `<#id>` |
| Rol | Hedef rol | ID, `@rol-ismi` veya `<@&id>` |

### /add
- `/add rol:@rol` ile `/time` komutunu kullanabilecek roller eklenir
- Adminler her zaman kullanabilir

### /kick (Kick yayın duyurusu)
Kick kanalını 30sn'de bir kontrol eder. Yayın **başlayınca yeni mesaj** atar,
yayın **bitince aynı mesajı günceller**. Aynı yayın asla iki kez duyurulmaz.

| Subcommand | Açıklama |
|------------|----------|
| `/kick slug <kanal>` | Kick kanalı (`xqc` veya `https://kick.com/xqc`) |
| `/kick kanal <#kanal>` | Discord duyuru kanalı |
| `/kick ping mod:rol\|herkes\|kaldir [rol]` | Ping davranışı |
| `/kick mesaj canli\|bitti [mesaj]` | Altındaki **ek mesajı** değiştirir |
| `/kick test` | Anlık kontrol + yayındaysa duyuruyu gönder |
| `/kick durum` | Ayarlar + anlık Kick durumu |
| `/kick kaldir` | Tüm Kick ayarlarını siler |

**Mesaj yapısı:** Embed açıklaması her zaman **başlık + boş satır + ek mesaj** şeklindedir.
Başlık üstte otomatik gelir, `/kick mesaj` yalnızca altındaki ek metni değiştirir.
`/kick mesaj tur:bitti` (mesaj boş bırakılırsa) **varsayılana döndürür**.

**Placeholder'lar:** `{baslik}` (veya kısaltması **`b`**) `{kategori}` `{slug}` `{link}`
`{baslangic}` `{sunucu}` — bittiğinde ayrıca `{bitis}` `{sure}` `{izleyici}`
Türkçe karakterli halleri de çalışır: `{başlık}` = `{baslik}`. `b` yalnızca **bağımsız
kelime** olduğunda genişler (`baba`, `bize` bozulmaz).

**Varsayılan ek mesajlar:** `src/utils/kickText.ts` → `DEFAULT_LIVE_MESSAGE`,
`DEFAULT_ENDED_MESSAGE` sabitleri.

### Görseller — `assets/kick/`

| Dosya | Ne zaman |
|------|----------|
| `assets/kick/start.png` | Yayın **başlarken** embed görseli |
| `assets/kick/finish.png` | Yayın **bitince** embed görseli |

- Klasör bot ilk açılışta otomatik oluşturulur (`.gitignore`'da değil, yani görseller commit edilebilir).
- Dosya yoksa **Kick'in yayın karesi** kullanılır; boş (0 bayt) veya okunamayan dosyalar da yok sayılır.
- Yerel dosya seçilirse Discord `attachment://start.png` referansı üretilir ve dosya
  mesaja `files` ile **attach edilir** (yerel yol doğrudan embed URL'i olamaz).
- Görsel kaynağı duyuru anında `KickState.imageSource` ile sabitlenir. Başlık değişince
  (`update`) aynı kaynağa referans verilir; `start.png` mesajda zaten yüklü olduğu için
  tekrar gönderilmez (aksi halde görsel kaybolurdu).
- `/kick durum` → "🖼️ Özel Görseller" alanında görünür. Restart gerekmez.

**Çevre değişkenleri:**
| Değişken | Açıklama |
|----------|----------|
| `KICK_CLIENT_ID` | dev.kick.com uygulama client id |
| `KICK_CLIENT_SECRET` | dev.kick.com uygulama client secret |
| `KICK_API_MODE` | Boş = otomatik. `official` veya `public-v2` |

## Butonlar
| Buton | İşlev |
|-------|-------|
| 👁️ | Duyuruyu gördü olarak işaretler (DM'den muaf) |
| 📜 | Görenlerin listesini gösterir (ephemeral) |

## Zamanlayıcı Akışı
1. **Duyuru Oluşturulur** → Kanalda ping + 👁️📜 butonları
2. **1 saat kala** → Kanalda tekrar ping + 👁️📜 butonları
3. **30 dakika kala** → Görmeyenlere DM
4. **Yayında ise** → DM ile ping onay butonu
5. **Süre biter** → Duyuru otomatik silinir

## Veri Yapıları

### Announcement
```typescript
interface Announcement {
  id: string;              // ann_{timestamp}_{random}
  guildId: string;
  channelId: string;
  messageId: string;
  roleId: string;
  title: string;
  description: string;
  createdAt: number;
  expiresAt: number;
  seenBy: string[];        // User ID'leri
  oneHourNotified: boolean;
  thirtyMinNotified: boolean;
}
```

### Settings
```typescript
interface Settings {
  guildId: string;
  announcementChannelId: string;
  allowedRoles: string[];  // /time kullanabilecek roller
  // Kick (hepsi opsiyonel — mevcut kayıtlarla uyumlu)
  kickSlug?: string;            // ör: "xqc"
  kickChannelId?: string;       // Discord duyuru kanalı
  kickPingType?: 'none' | 'role' | 'everyone';
  kickPingRoleId?: string;
  kickLiveText?: string;        // yayın başlarken ALTINDAKİ ek mesaj
  kickEndedText?: string;       // yayın bitince ALTINDAKİ ek mesaj
}
```

### KickState (`data/kickState.json`)
```typescript
interface KickState {
  guildId: string;
  sessionKey: string;   // tekrar duyurmayı engelleyen anahtar
  messageId: string;    // güncellenecek Discord mesajı
  slug: string; title: string; category: string; thumbnail: string;
  imageSource: 'asset' | 'kick' | '';  // görsel nereden geldi
  startedAt: number; lastViewers: number; lastCheckedAt: number;
}
```

## Kick Entegrasyonu Detayları

**API modu** — `kickApi.ts` iki kaynağı tek tipe indirger:
| Mod | Ne zaman | Endpoint | `sessionKey` |
|-----|----------|----------|--------------|
| `official` | `KICK_CLIENT_ID` + `KICK_CLIENT_SECRET` varsa | `api.kick.com/public/v1/channels?slug=` | `stream.start_time` |
| `public-v2` | credentials yoksa (yedek) | `kick.com/api/v2/channels/{slug}` | `livestream.id` |

> Resmi API `stream` objesinde livestream **id** vermiyor (swagger `endpoints.Stream`
> yalnızca `is_live/viewer_count/start_time/thumbnail/language` içeriyor) — bu yüzden
> resmi modda tekillik `start_time` üzerinden sağlanır.

**Token yönetimi:** OAuth2 Client Credentials (App Access Token). `expires_in`
son 60 saniyede yenilenir; yenileme başarısızsa **son geçerli token ile devam** edilir.
401/403 alınırsa token düşürülüp bir kez yeniden denenir.

**Tarih formatları:** Resmi API ISO-8601 (`2026-10-01T22:00:00Z`), v2 ise
**ISO olmayan** `2026-04-06 05:03:57` döndürür. `parseKickDate()` ikisini de çözer.

**Karar mantığı** — `resolveKickAction()` saf fonksiyondur (Discord bağımsız, test edilebilir):
```typescript
if (isLive && prev?.sessionKey !== info.sessionKey) return 'announce';
if (!isLive && prev?.sessionKey)                 return 'end';
if (isLive && prev && prev.title !== info.title)  return 'update';
return 'none';
```

**Hata tipleri:** `KickAuthError` (401/403) · `KickNotFoundError` (404) ·
`KickRateLimitError` (429) · `KickNetworkError` — monitör hepsini yakalar,
state'i bozmadan atlar ve loglar.

## Bilinen Çözümler
- **`npm run dev` ayrı tsconfig kullanır:** Ana `tsconfig.json` içindeki
  `rewriteRelativeImportExtensions: true`, import'ları emit sırasında `.js`'e çevirir.
  ts-node bellekte çalıştığı için bu yollar diskte bulunmaz → `MODULE_NOT_FOUND`.
  `tsconfig.dev.json` bu özelliği kapatır (`npm run dev --project tsconfig.dev.json`),
  ts-node da `.ts` uzantılarını `require.extensions` ile çözümler.
  Üretim derlemesi (`npm run build` → `dist`) ana tsconfig ile çalışmaya devam eder.
- **Modal'da kanal/rol isim çözümlemesi:** Önce ID/mention dene, bulunamazsa cache'den isim ara
- **Bot yeniden başlatma:** Zaman penceresi olmadan doğrudan kontrol (kaçırılan bildirimler tetiklenir)
- **Yayıncı tespiti:** `ActivityType.Streaming` kontrolü
- **Türkçe placeholder normalizasyonu:** `foldKey()` önce `ı→i` eşlemesi yapar,
  sonra NFD uygular — çünkü NFD noktasız `ı` (U+0131) harfini ayrıştırmaz.
  Regex de `\w` yerine `[^{}\s]+` kullanmalı, yoksa `{başlık}` eşleşmez.
- **Kicker thumbnail'ı boş olabilir:** v2'de `livestream.thumbnail` gelmeyebilir,
  bu durumda kanal banner'ı fallback olarak kullanılır.
- **`updateKickSettings` alan silme:** Patch değeri `null`/`undefined` ise alan **silinir**
  (`delete`). Önceden `undefined` sessizce atlanıyordu; bu yüzden "varsayılana dön"
  işlemi eski özel metni silemiyordu ve kullanıcı eskisine dönemiyordu.
- **`renderKickMessage` işlem sırası:** Önce baştaki **literal** `{başlık}` temizlenir
  (eski kayıt uyumluluğu), **sonra** `b` kısaltması genişletilir. Sıra ters olursa
  kullanıcının yazdığı "b konusunda yayındayız" sessizce "konusunda yayındayız" olur.

## Gelecek Planlar
- [ ] Veritabanı geçişi (isteğe bağlı MongoDB/SQLite)
- [ ] Çoklu dil desteği
- [ ] Web panel
- [ ] Duyuru önizleme
- [ ] Zamanlanmış tekrarlı duyurular
- [ ] Kick izleyici sayacının canlı güncellenmesi (embed düzenleme aralığı)
