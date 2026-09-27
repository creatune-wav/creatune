# Kendi bilgisayarında kurulum ve doğrulama

Bu rehber iki doğrulama yolunu anlatıyor:

- **A. Amazon API testi** (`amazon_probe.py`): Creators API erişimi gerektirir.
- **B. Elle gözlem** (`manual_check.py`): Her iki site için de hesap gerektirmez. Ürün
  sayfasını sen tarayıcıda açarsın, script kayıtlarını denetler.

Gizli anahtarlar yalnızca kendi bilgisayarındaki `.env` dosyasında durur. Sohbete,
commit'e veya ekran görüntüsüne koyma.

## 0. Gereksinimler
- Python 3.9 veya üstü (`python3 --version`). Ek paket gerekmez.
- Git.

```bash
git clone https://github.com/creatune-wav/creatune.git
cd creatune
git checkout claude/friendly-carson-qb0xiw
cd discount-tracker
python3 -m unittest        # 11 test; hepsi SENTETİK veriyle, gerçek ürün doğrulaması değildir
```

## 1. Gerekli hesap erişimleri

| # | Erişim | Kimde olmalı | Ne için | Durum |
|---|---|---|---|---|
| 1 | **Amazon.com.tr Gelir Ortaklığı (Associates) hesabı**: [gelirortakligi.amazon.com.tr](https://gelirortakligi.amazon.com.tr/) | Müşteri (hesap sahibi) | Creators API'nin ön şartı | ⚠️ Bir kaynağa göre TR programı şu an **yalnızca davetle** üye alıyor. Bunu buradan doğrulayamadım; sayfayı kontrol et. |
| 2 | **Son 30 günde ≥10 nitelikli satış** (amazon.com.tr, bu hesabın takip kodlarıyla) | Aynı hesap | Creators API uygunluğu | Sağlanmazsa API `AssociateNotEligible` benzeri bir hata döner |
| 3 | **Creators API kimlik bilgisi** (Associates Central → Tools/Araçlar → Creators API): Client ID, Client Secret, Credential Version | Hesap sahibi oluşturur | Token almak | v3.x (LwA) olmalı. v2.x (Cognito) artık çalışmıyor. |
| 4 | **Takip kimliği (Partner Tag)**, örn. `xxxx-21` | Aynı hesap | `getItems` isteği | Associates Central → Takip Kimliği Yönetimi |
| 5 | Hepsiburada veri erişimi | — | — | **Yok.** Ayrıntı README §1'de. Şimdilik yalnızca B yolu kullanılabilir. |
| 6 | Telegram bot token'ı | — | — | Sonraki aşamada gerekecek, şimdi değil. |

## 2. Gizli bilgileri yerel olarak tanımla
```bash
cp .env.example .env
chmod 600 .env          # yalnızca sen okuyabil
# .env dosyasını editörde aç ve değerleri doldur. .env, .gitignore'da; commit'lenmez.
```
Terminale yükle:
- macOS/Linux: `set -a; source .env; set +a`
- Windows PowerShell:
  `Get-Content .env | ? { $_ -match '^\s*[^#].*=' } | % { $k,$v = $_ -split '=',2; Set-Item "env:$k" $v }`

## 3. A. Amazon API testi
1. `products.example.txt` dosyasını `products.txt` olarak kopyala. Her satıra bir
   amazon.com.tr ürün linki ya da ASIN yaz (5–10 ürün).
2. `python3 amazon_probe.py products.txt`
3. Çıktı `amazon_probe_result.json` dosyasına yazılır ve commit'lenmez.
4. **Amazon'un satıcı kimliğini doğrula:** Sayfasında "Satıcı: Amazon.com.tr" yazan bir
   ürünün sonuçtaki `seller_id` değerini `.env` içindeki `AMAZON_TR_MERCHANT_ID` alanına
   yaz ve testi tekrar çalıştır. Bu yapılmadan `seller_is_amazon` alanı `null` kalır.

Sık görülen hatalar:
| Hata | Anlamı |
|---|---|
| Token isteğinde 400/401 | Client ID/Secret ya da credential version yanlış |
| `AssociateNotEligible` / 403 | Hesap uygun değil: 10 satış şartı sağlanmıyor ya da TR hesabı yok |
| `InvalidPartnerTag` | Takip kimliği bu hesaba veya bu pazaryerine ait değil |
| Ürün sonuçta yok, `errors` altında | ASIN bu pazaryerinde erişilebilir değil |

## 4. B. Elle gözlem (her iki site)
1. `manual_observations.example.csv` dosyasını `manual_observations.csv` olarak kopyala.
2. Her ürün için sayfayı normal tarayıcıda aç ve bir satır doldur:
   - `site`: `amazon` ya da `hepsiburada`
   - `observed_at`: `2026-09-28T14:05+03:00` biçiminde gözlem zamanı
   - `variant`: seçili varyant (renk/beden/kapasite). Varyant yoksa `yok` yaz.
   - `seller`: **"Satıcı"** satırında yazan ad. Amazon'da "Satıcı" (Sold by), Hepsiburada'da
     satıcı mağaza adı.
   - `shipper`: **"Gönderici"/"Kargoya veren"** satırı. Satıcıyla aynı alana yazılmaz.
   - `regular_price`: kupon uygulanmamış, sayfada görünen fiyat.
   - `coupon_text`: kupon ya da "sepette indirim" metni, kelimesi kelimesine.
   - `coupon_price`: kupon uygulanınca oluşan fiyat. Sayfa bunu göstermiyorsa boş bırak.
   - `coupon_conditions_verified`: kupon koşullarını (min. sepet, üyelik, tarih, adet
     sınırı, hesaba özel olup olmadığı) **gördüysen** `evet`, aksi halde boş bırak.
   - `stock_text`: sayfadaki stok ifadesi, örn. "Stokta", "Son 3 ürün".
   - `evidence`: ekran görüntüsünün dosya adı. Görüntüde fiyat, satıcı ve saat görünsün.
   - `notes`: oturum açık mıydı? Kuponlar hesaba göre değişebilir.
3. `python3 manual_check.py manual_observations.csv amazon_probe_result.json`
   (API sonucu yoksa ikinci argümanı verme.)
4. `verification_report.md` oluşur. Durumlar:
   - `TAMAM`: zorunlu alanlar tam, kupon yok ya da koşulları doğrulanmış.
   - `INCELEME_GEREKLI`: kupon var ama koşulları doğrulanmamış veya tutarsız.
   - `EKSIK`: zorunlu alan eksik ya da fiyat okunamadı.

Bu rapor **elle yapılan bir doğrulamadır**; çalışan otomatik takip değildir.
