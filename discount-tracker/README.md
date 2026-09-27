# İndirim takip botu — Aşama 0: veri erişimi doğrulaması

**Durum (2026-09-28): Hiçbir sitede gerçek ürün doğrulanmadı.** Testler yalnızca sentetik
veriyle çalışıyor ve çalışan bir ürün takibi değildir. Kurulum ve doğrulama adımları için bkz. [SETUP.md](SETUP.md).
Önceki not (2026-09-27): Gerçek ürün verisi çekilmedi.
Engeller: hesap/erişim bilgileri gelmedi, ayrıca bu geliştirme ortamının ağ politikası
`amazon.com.tr`, `hepsiburada.com`, `creatorsapi.amazon` ve `api.telegram.org`
adreslerini engelliyor (proxy `403`). Bu tabloda hiçbir fiyat, stok ya da satıcı değeri
uydurulmamıştır.

## 1. Resmî erişim seçenekleri

### Amazon.com.tr → Amazon Creators API (tek uygun resmî yol)
| Konu | Bilgi |
|---|---|
| Durum | PA-API 5.0 kullanımdan kaldırıldı (30 Nis 2026 deprecation, 15 May 2026 kapanış). Yerine **Creators API** geldi. |
| Gerekli hesap | Onaylı **Amazon.com.tr Associates (Gelir Ortaklığı)** hesabı + Associates Central'da Creators API kimlik bilgisi (Client ID/Secret, credential version). ⚠️ Bir arama kaynağına göre TR programı şu an **yalnızca davetle** üye alıyor; bu ortamdan doğrulanamadı. |
| Uygunluk şartı | Son 30 günde o pazaryerinde **en az 10 nitelikli satış**. Altına düşülürse erişim askıya alınır. **En büyük risk budur.** |
| Kimlik doğrulama | OAuth2 client_credentials. v3.x (LwA) kimlik bilgileri; v2.x (Cognito) Eylül 2026'dan itibaren çalışmıyor. |
| Uç nokta | `POST https://creatorsapi.amazon/catalog/v1/getItems`, başlık `x-marketplace: www.amazon.com.tr` |
| Limit | Başlangıçta ~1 istek/sn; istek başına en fazla 10 ASIN. Günlük kotanın satışlarla ölçeklendiği belirtiliyor, ama TR için kesin sayı doğrulanmadı. |
| Dönen alanlar | Başlık, görsel, `offersV2.listings`: fiyat, referans/üstü çizili fiyat (`savingBasis`: LIST_PRICE/WAS_PRICE/LOWEST_PRICE), indirim %, fırsat rozeti (`dealDetails`), `availability.type/message`, `merchantInfo.id/name` (satıcı), `isBuyBoxWinner`. |
| **Dönmeyenler** | **Kupon bilgisi yok** (SDK şemasında kupon alanı bulunmuyor). Stok **adedi** yok (yalnızca durum: stokta/yok vb.). **Gönderici (FBA/kargo) bilgisi yok.** Yalnızca "satıcı" alanı var. Amazon Buy Box'ta değilse Amazon'un kendi teklifi dönmeyebilir. Varyant özniteliği `getItems` yanıtında gelmeyebilir; gerekirse `getVariations` kullanılır. |

SP-API (satıcı API'si) yalnızca satıcı hesabı sahiplerine yöneliktir. Amazon'un
perakende tekliflerini izlemek için doğru araç değildir.

### Hepsiburada → izin verilen otomatik yol bulunamadı
| Seçenek | Sonuç |
|---|---|
| Merchant/Marketplace API (satıcı paneli, OAuth2) | **Uygun değil.** Yalnızca satıcının **kendi** ilanlarını yönetir. |
| Gelir Ortaklığı / "Link Gelir" (hepsiburada.com/link-gelir, partner programı) | Link + komisyon programı. **Ürün/fiyat feed'i veya API sunduğuna dair kamuya açık kaynak bulunamadı.** Üye olunursa panelde ne sunulduğu görülebilir. |
| Affiliate ağları (Admitad, Awin vb.) | Hepsiburada'nın bu ağlarda ürün feed'i yayınladığı **doğrulanamadı.** |
| Fiyat karşılaştırma siteleri (Akakçe, Cimri) | Bu siteler **satıcılardan** feed alır. Üçüncü taraflara Hepsiburada verisi satan **resmî/yetkili** bir API'leri bulunamadı. Bulunan "Akakçe/Cimri API"leri kişisel kazıma projeleri; yetkili değil. |
| Ticari kazıma hizmetleri (Apify vb.) | **Yetkili sağlayıcı değil.** Hepsiburada adına veri sağlamıyorlar; kazımayı başkasına yaptırmak anlamına gelir. Kullanılmayacak. |
| Otomatik sayfa takibi (robots.txt) | `robots.txt` dosyası `/api/`, `/m/` gibi yolları kapatıyor. **GPTBot'a yalnızca `/llms.txt` izni veriyor**; bu, otomatik ve yapay zekâ erişimine kısıtlayıcı bir tutum. robots.txt ürün sayfalarını genel tarayıcılara kapatmasa bile bu, ticari fiyat takibi için **izin sayılmaz**. Kullanım koşullarındaki bot/veri toplama maddesi bu ortamdan okunamadı (site engelli). |

**Sonuç: Hepsiburada için şu an uygun bir otomatik veri yolu yok.** Seçenekler:
1. Hepsiburada'dan **yazılı izin veya veri erişimi** istemek (Gelir Ortaklığı ekibi ya da
   kurumsal iş birliği; kurumsal.hepsiburada.com "İş Ortaklarımız İçin").
2. İzin gelene kadar yalnızca **elle gözlem** (`manual_check.py`): ürünü bir insan
   tarayıcıda kontrol eder, bot yalnızca kaydı denetler.

### Telegram (sonraki aşama)
Bot API ücretsizdir (BotFather'dan token alınır). Pratik limitler: tek sohbete ~1 mesaj/sn,
gruba ~20 mesaj/dk. WhatsApp'a otomatik paylaşım yapılmayacak.

## 2. Prototip

`manual_check.py`: elle gözlem denetimi ve API karşılaştırması. Kullanımı [SETUP.md](SETUP.md) §4'te.

### `amazon_probe.py`
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
python3 -m unittest                    # 11 test, SENTETİK veriyle (gerçek doğrulama değildir)
```
Credential version için Associates Central'ın gösterdiği değeri kullanın. TR'nin 3.2 (EU)
grubunda olması bekleniyor ama bu doğrulanmadı.

## 2b. Kupon ve indirim ayrımı
- **Normal fiyat** (`regular_price`): teklifin API'deki ya da sayfada kupon uygulanmadan
  görünen fiyatı. Paylaşımda "fiyat" olarak **yalnızca bu** kullanılır.
- **Referans fiyat** (`reference_price` + türü): üstü çizili fiyat. Türü (WAS_PRICE vb.)
  kaydedilir, "indirim" iddiası buna göre kurulur.
- **Kuponlu fiyat** (`coupon_price`): Amazon API'si kupon vermediği için **hiçbir zaman
  hesaplanmaz**. Yalnızca elle gözlemde, kupon metniyle birlikte girilir. Koşulları
  (min. sepet, üyelik, tarih, hesaba özel olup olmadığı) doğrulanmamışsa
  `INCELEME_GEREKLI` olarak işaretlenir ve otomatik paylaşılmaz.

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
