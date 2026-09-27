#!/usr/bin/env python3
"""Amazon.com.tr veri erişimi probe'u (resmî Amazon Creators API).

Yalnızca erişimin çalıştığını kanıtlamak içindir: verilen ASIN/linkler için
ürün adı, varyant, satıcı, fiyat, stok durumu ve kontrol zamanını çeker ve
API'nin döndürmediği alanları boş bırakır (tahmin etmez).

Gerekli ortam değişkenleri (Associates Central > Tools > Creators API):
  CREATORS_CLIENT_ID, CREATORS_CLIENT_SECRET,
  CREATORS_CREDENTIAL_VERSION  (Associates Central'ın gösterdiği sürüm, örn. 3.2)
  CREATORS_PARTNER_TAG         (amazon.com.tr mağaza/takip kimliği, örn. xxx-21)
İsteğe bağlı:
  AMAZON_TR_MERCHANT_ID        Amazon.com.tr'nin satıcı kimliği. Verilirse satıcı
                               eşleşmesi kimlikle yapılır; yoksa "doğrulanmadı".

Kullanım:
  python3 amazon_probe.py products.txt            # her satırda ASIN veya link
  python3 amazon_probe.py B0XXXXXXXX B0YYYYYYYY
  python3 amazon_probe.py --feeds                 # erişilebilir resmî feed'leri listeler
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

API_HOST = "https://creatorsapi.amazon"
MARKETPLACE = "www.amazon.com.tr"
TOKEN_ENDPOINTS = {
    "2.1": "https://creatorsapi.auth.us-east-1.amazoncognito.com/oauth2/token",
    "2.2": "https://creatorsapi.auth.eu-south-2.amazoncognito.com/oauth2/token",
    "2.3": "https://creatorsapi.auth.us-west-2.amazoncognito.com/oauth2/token",
    "3.1": "https://api.amazon.com/auth/o2/token",
    "3.2": "https://api.amazon.co.uk/auth/o2/token",
    "3.3": "https://api.amazon.co.jp/auth/o2/token",
}
RESOURCES = [
    "itemInfo.title",
    "images.primary.large",
    "offersV2.listings.price",
    "offersV2.listings.availability",
    "offersV2.listings.merchantInfo",
    "offersV2.listings.isBuyBoxWinner",
    "offersV2.listings.condition",
    "offersV2.listings.type",
    "offersV2.listings.dealDetails",
]
TR_TZ = timezone(timedelta(hours=3))
ASIN_RE = re.compile(r"(?:/dp/|/gp/product/|/product/|^)([A-Z0-9]{10})(?:[/?#]|$)")


def extract_asin(text):
    m = ASIN_RE.search(text.strip())
    return m.group(1) if m else None


def _post_json(url, body, headers):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", **headers},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, {"raw": raw.decode(errors="replace")}


def _post_form(url, fields):
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, json.loads(resp.read())


def get_token(client_id, client_secret, version):
    endpoint = TOKEN_ENDPOINTS[version]
    if version.startswith("3."):
        status, data = _post_json(endpoint, {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "creatorsapi::default",
        }, {})
    else:
        status, data = _post_form(endpoint, {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "creatorsapi/default",
        })
    if status != 200 or "access_token" not in data:
        raise RuntimeError(f"Token alınamadı (HTTP {status}): {data}")
    return data["access_token"]


def get_items(token, version, partner_tag, asins):
    auth = f"Bearer {token}" if version.startswith("3.") else f"Bearer {token}, Version {version}"
    return _post_json(f"{API_HOST}/catalog/v1/getItems", {
        "partnerTag": partner_tag,
        "itemIds": asins,
        "condition": "New",
        "languagesOfPreference": ["tr_TR"],
        "resources": RESOURCES,
    }, {"Authorization": auth, "x-marketplace": MARKETPLACE})


def list_feeds(token, version):
    """Hesabın erişebildiği resmî feed'leri listeler (PRODUCT_FEEDS / DEALS_FEEDS)."""
    auth = f"Bearer {token}" if version.startswith("3.") else f"Bearer {token}, Version {version}"
    return _post_json(f"{API_HOST}/catalog/v1/listFeeds", {},
                      {"Authorization": auth, "x-marketplace": MARKETPLACE})


def normalize_item(item, checked_at, amazon_merchant_id=None):
    """API yanıtındaki bir ürünü düz kayda çevirir. Olmayan alan None kalır."""
    listings = (item.get("offersV2") or {}).get("listings") or []
    buybox = next((l for l in listings if l.get("isBuyBoxWinner")), None)
    listing = buybox or (listings[0] if listings else None)
    rec = {
        "asin": item.get("asin"),
        "url": item.get("detailPageURL"),
        "title": ((item.get("itemInfo") or {}).get("title") or {}).get("displayValue"),
        # getItems varyant özniteliği döndürmeyebilir; dönmezse boş bırakılır.
        "variant": ", ".join(
            f"{v.get('name')}: {v.get('value')}" for v in item.get("variationAttributes") or []
        ) or None,
        "image": (((item.get("images") or {}).get("primary") or {}).get("large") or {}).get("url"),
        "seller_name": None,
        "seller_id": None,
        "seller_is_amazon": None,
        # Creators API gönderici/kargo (FBA) bilgisi vermez; satıcıyla karıştırılmaz.
        "shipper": None,
        "is_buybox": None,
        # Normal fiyat = teklifin API'deki fiyatı. Kupon bu fiyata dahil değildir.
        "regular_price": None,
        "currency": None,
        "regular_price_display": None,
        # Referans (üstü çizili) fiyat ve türü: LIST_PRICE / WAS_PRICE / LOWEST_PRICE...
        "reference_price": None,
        "reference_price_type": None,
        "reference_price_label": None,
        "savings_percent": None,
        "deal_badge": None,
        "offer_type": None,
        # Creators API kupon bilgisi döndürmez. Kuponlu fiyat yalnızca elle,
        # kaynağıyla birlikte girilir (manual_check.py); burada hiçbir zaman hesaplanmaz.
        "coupon_price": None,
        "coupon_status": "API_KUPON_VERMIYOR",
        "availability_type": None,
        "availability_message": None,
        "listing_count": len(listings),
        "checked_at": checked_at,
        "notes": [],
    }
    if not listing:
        rec["notes"].append("Teklif (offer) dönmedi: fiyat/stok/satıcı doğrulanamadı.")
        return rec
    merchant = listing.get("merchantInfo") or {}
    price = listing.get("price") or {}
    money = price.get("money") or {}
    basis = price.get("savingBasis") or {}
    deal = listing.get("dealDetails") or {}
    avail = listing.get("availability") or {}
    rec.update({
        "seller_name": merchant.get("name"),
        "seller_id": merchant.get("id"),
        "is_buybox": listing.get("isBuyBoxWinner"),
        "regular_price": money.get("amount"),
        "currency": money.get("currency"),
        "regular_price_display": money.get("displayAmount"),
        "reference_price": (basis.get("money") or {}).get("amount"),
        "reference_price_type": basis.get("savingBasisType"),
        "reference_price_label": basis.get("savingBasisTypeLabel"),
        "savings_percent": (price.get("savings") or {}).get("percentage"),
        "deal_badge": deal.get("badge"),
        "offer_type": listing.get("type"),
        "availability_type": avail.get("type"),
        "availability_message": avail.get("message"),
    })
    if amazon_merchant_id and rec["seller_id"]:
        rec["seller_is_amazon"] = rec["seller_id"] == amazon_merchant_id
    else:
        rec["notes"].append("Satıcının Amazon olduğu kimlikle doğrulanmadı (AMAZON_TR_MERCHANT_ID yok).")
    if not buybox:
        rec["notes"].append("Buy Box sahibi işaretli değil; ilk teklif kullanıldı.")
    return rec


def main(argv):
    list_feeds_only = "--feeds" in argv
    argv = [a for a in argv if a != "--feeds"]
    if not argv and not list_feeds_only:
        print(__doc__)
        return 2
    inputs = []
    for arg in argv:
        if os.path.isfile(arg):
            with open(arg, encoding="utf-8") as f:
                inputs += [l for l in f.read().splitlines() if l.strip() and not l.startswith("#")]
        else:
            inputs.append(arg)
    asins, bad = [], []
    for raw in inputs:
        a = extract_asin(raw)
        (asins if a else bad).append(a or raw)
    for raw in bad:
        print(f"ASIN çıkarılamadı, atlandı: {raw}", file=sys.stderr)

    missing = [k for k in ("CREATORS_CLIENT_ID", "CREATORS_CLIENT_SECRET",
                           "CREATORS_CREDENTIAL_VERSION", "CREATORS_PARTNER_TAG")
               if not os.environ.get(k)]
    if missing:
        print("Eksik ortam değişkeni: " + ", ".join(missing), file=sys.stderr)
        return 2
    version = os.environ["CREATORS_CREDENTIAL_VERSION"]
    if version not in TOKEN_ENDPOINTS:
        print(f"Bilinmeyen credential sürümü: {version}", file=sys.stderr)
        return 2

    token = get_token(os.environ["CREATORS_CLIENT_ID"], os.environ["CREATORS_CLIENT_SECRET"], version)
    if list_feeds_only:
        status, data = list_feeds(token, version)
        print(f"HTTP {status}\n{json.dumps(data, ensure_ascii=False, indent=2)}")
        return 0 if status == 200 else 1
    records, errors = [], []
    for i in range(0, len(asins), 10):  # getItems en fazla 10 ASIN alır
        batch = asins[i:i + 10]
        checked_at = datetime.now(TR_TZ).isoformat(timespec="seconds")
        status, data = get_items(token, version, os.environ["CREATORS_PARTNER_TAG"], batch)
        if status != 200:
            errors.append({"asins": batch, "http": status, "body": data})
            continue
        for item in (data.get("itemsResult") or {}).get("items") or []:
            records.append(normalize_item(item, checked_at, os.environ.get("AMAZON_TR_MERCHANT_ID")))
        for err in data.get("errors") or []:
            errors.append({"asins": batch, "error": err})

    out = {"marketplace": MARKETPLACE, "records": records, "errors": errors}
    with open("amazon_probe_result.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    for r in records:
        print(f"{r['checked_at']}  {r['asin']}  {r['regular_price_display'] or '-'}  "
              f"{r['availability_type'] or '-'}  satıcı={r['seller_name'] or '-'}  {r['title'] or '-'}")
    for e in errors:
        print(f"HATA: {json.dumps(e, ensure_ascii=False)}", file=sys.stderr)
    print("Tam çıktı: amazon_probe_result.json")
    return 0 if records and not errors else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
