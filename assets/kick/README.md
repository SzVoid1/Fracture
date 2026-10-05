# Kick Duyuru Görselleri

Bu klasöre kendi görsellerini koyarsan Kick duyuru embed'lerinde **Kick'in karesi yerine**
bunlar kullanılır.

| Dosya | Ne zaman kullanılır |
|------|---------------------|
| `start.png` | Yayın **başlarken** gönderilen duyuru |
| `finish.png` | Yayın **bitince** güncellenen duyuru |

## Kurallar

- Dosya adı tam olarak `start.png` ve `finish.png` olmalı (küçük harf).
- Klasörde olmayan dosya için Kick'in yayın karesi kullanılır — ikisini de koymak zorunda değilsin.
- Boş (0 bayt) veya okunamayan dosyalar yok sayılır, Kick karesine düşülür.
- Dosyayı koyduktan sonra **botu yeniden başlatman gerekmez**, `/kick durum` ile kontrol edebilirsin.
  (Bir sonraki duyuru gönderiminde geçerli olur.)

## Önerilen ölçü

- **Oran:** 16:9 (yatay)
- **Genişlik:** 800–1200 px arası ideal
- **Discord sınırı:** 25 MB altı (dosya adı `.png` olduğu için 8 MB sert sınır)

## Discord davranışı notu

Yerel dosyalar Discord'a `attachment://start.png` şeklinde yüklenir. Yayın başlarken
yüklenen `start.png`, yayın bitince `finish.png` ile **değiştirilmez** — mesajın ekinde
iki dosya birden kalır ama embed yalnızca ilgili olanı gösterir.