# İndirim takip botu — Aşama 0: veri erişimi doğrulaması

**Durum (2026-09-27): Doğrulama henüz yapılmadı.** Gerçek ürün verisi çekilmedi.
Engeller: hesap/erişim bilgileri gelmedi, ayrıca bu geliştirme ortamının ağ politikası
`amazon.com.tr`, `hepsiburada.com`, `creatorsapi.amazon` ve `api.telegram.org`
adreslerini engelliyor (proxy `403`). Bu tabloda hiçbir fiyat, stok ya da satıcı değeri
uydurulmamıştır.

## 1. Resmî erişim seçenekleri

### Amazon.com.tr → Amazon Creators API (tek uygun resmî yol)
| Konu | Bilgi |
|---|---|
| Durum | PA-API 5.0 kullanımdan kaldırıldı (30 Nis 2026 deprecation, 15 May 2026 kapanış). Yerine **Creators API** geldi. |
| Gerekli hesap | Onaylı **Amazon.com.tr Associates (Gelir Ortaklığı)** hesabı + Associates Central'da Creators API kimlik bilgisi (Client ID/Secret, credential version). |
| Uygunluk şartı | Son 30 günde o pazaryerinde **en az 10 nitelikli satış**. Altına düşülürse erişim askıya alınır. **En büyük risk budur.** |
| Kimlik doğrulama | OAuth2 client_credentials. v3.x (LwA) kimlik bilgileri; v2.x (Cognito) Eylül 2026'dan itibaren çalışmıyor. |
| Uç nokta | `POST https://creatorsapi.amazon/catalog/v1/getItems`, başlık `x-marketplace: www.amazon.com.tr` |
| Limit | Başlangıçta ~1 istek/sn; istek başına en fazla 10 ASIN. Günlük kotanın satışlarla ölçeklendiği belirtiliyor, ama TR için kesin sayı doğrulanmadı. |
| Dönen alanlar | Başlık, görsel, `offersV2.listings`: fiyat, `availability.type/message`, `merchantInfo.id/name` (satıcı), `isBuyBoxWinner`. |
| **Dönmeyenler** | Stok **adedi** yok (yalnızca durum: stokta/yok vb.). **Gönderici (FBA/kargo) bilgisi yok.** Yalnızca "satıcı" alanı var. Amazon Buy Box'ta değilse Amazon'un kendi teklifi dönmeyebilir. Varyant özniteliği `getItems` yanıtında gelmeyebilir; gerekirse `getVariations` kullanılır. |

SP-API (satıcı API'si) yalnızca satıcı hesabı sahiplerine yöneliktir. Amazon'un
perakende tekliflerini izlemek için doğru araç değildir.

### Hepsiburada → üçüncü taraf için resmî ürün/fiyat API'si bulunamadı
| Seçenek | Uygun mu? |
|---|---|
| Hepsiburada Merchant/Marketplace API (OAuth2, satıcı panelinden) | **Hayır.** Yalnızca satıcının **kendi** ilanlarını yönetir. "Satıcısı Hepsiburada" olan ürünlerin fiyatını vermez. |
| Hepsiburada Gelir Ortaklığı / Affiliate (partner.hepsiburada.com, ağlar) | **Belirsiz.** Link ve komisyon programı var. Ürün/fiyat feed'i ya da API verip vermediği kamuya açık kaynaklarda doğrulanamadı. Başvurup programın sunduğu veri erişimini görmek gerekiyor. |
| Sayfa kazıma (scraping) | **Yapılmayacak.** Resmî erişim değil ve engelleri aşmak kapsam dışı. |

→ Hepsiburada için yazılı ve resmî bir veri erişimi (affiliate feed/API ya da
Hepsiburada ile doğrudan anlaşma) sağlanana kadar bu kanal **başlatılamaz**.

### Telegram (sonraki aşama)
Bot API ücretsizdir (BotFather'dan token alınır). Pratik limitler: tek sohbete ~1 mesaj/sn,
gruba ~20 mesaj/dk. WhatsApp'a otomatik paylaşım yapılmayacak.

## 2. Prototip: `amazon_probe.py`
Bağımlılık gerektirmez (Python 3 stdlib). Verilen ASIN veya linkler için şu alanları
`amazon_probe_result.json` dosyasına yazar: ürün adı, varyant, satıcı adı/kimliği, satıcı
Amazon mu, Buy Box, fiyat, stok durumu ve kontrol zamanı (TR saati).
- Gönderici alanı her zaman `null` kalır, çünkü API bu bilgiyi vermez. Satıcı ile karıştırılmaz.
- "Satıcı Amazon" kararı yalnızca `AMAZON_TR_MERCHANT_ID` ile kimlik eşleşmesiyle verilir. Aksi halde `null` olur ve bir not eklenir.
- Teklif dönmezse fiyat/stok/satıcı `null` kalır ve bir not eklenir.

```bash
export CREATORS_CLIENT_ID=... CREATORS_CLIENT_SECRET=... \
       CREATORS_CREDENTIAL_VERSION=3.2 CREATORS_PARTNER_TAG=xxxx-21
python3 amazon_probe.py products.txt   # her satıra bir ASIN veya amazon.com.tr linki
python3 -m unittest                    # ayrıştırıcı testleri (sentetik fixture)
```
Credential version için Associates Central'ın gösterdiği değeri kullanın. TR'nin 3.2 (EU)
grubunda olması bekleniyor ama bu doğrulanmadı.

## 3. Tahmini işletim maliyeti (erişim doğrulanınca kesinleşir)
| Kalem | Tahmin |
|---|---|
| Creators API | Ücretsiz. Koşul: ayda ≥10 nitelikli satış. |
| Hepsiburada | Bilinmiyor (resmî erişim yolu yok). |
| Telegram Bot API | Ücretsiz |
| Sunucu (cron + SQLite) | Küçük VPS ~€4–6/ay ya da mevcut bir sunucu |
| Görsel üretimi | Sunucuda yerel (Pillow). Ek maliyet yok. |
| Kapasite | 1 istek/sn × 10 ASIN ile 1.000 ürün ~100 sn'de taranır. Saatlik tarama bile limitin çok altında kalır. |

## 4. Bu aşama geçilmeden yapılmayacaklar
Panel, fiyat geçmişi, bildirim tekrar engelleme ve Telegram gönderimi bu aşamada
yapılmayacak. Geçmiş veri birikmeden "365 günün en düşük fiyatı" gibi ifadeler
kullanılmayacak.
