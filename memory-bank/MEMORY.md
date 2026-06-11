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
│   │   └── time.ts              # /Time komutu & /add komutu
│   ├── events/
│   │   ├── ready.ts              # Bot başlangıcı
│   │   └── interactionCreate.ts  # Buton/Modal yönetimi
│   ├── utils/
│   │   ├── timeParser.ts         # Zaman formatı çözümleme
│   │   ├── scheduler.ts          # Zamanlayıcı motor
│   │   └── storage.ts            # JSON veri yönetimi
│   └── index.ts                  # Ana giriş noktası
├── test/
│   ├── timeParser.test.ts        # Zaman çözümleme testleri
│   └── storage.test.ts           # Veri saklama testleri
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
}
```

## Bilinen Çözümler
- **Modal'da kanal/rol isim çözümlemesi:** Önce ID/mention dene, bulunamazsa cache'den isim ara
- **Bot yeniden başlatma:** Zaman penceresi olmadan doğrudan kontrol (kaçırılan bildirimler tetiklenir)
- **Yayıncı tespiti:** `ActivityType.Streaming` kontrolü

## Gelecek Planlar
- [ ] Veritabanı geçişi (isteğe bağlı MongoDB/SQLite)
- [ ] Çoklu dil desteği
- [ ] Web panel
- [ ] Duyuru önizleme
- [ ] Zamanlanmış tekrarlı duyurular
