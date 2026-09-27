#!/usr/bin/env python3
"""Elle yapılan ürün gözlemlerini denetler ve doğrulama raporu üretir.

Otomatik takip DEĞİLDİR. Sayfayı bir insan tarayıcıda açar, gördüğünü
manual_observations.csv dosyasına yazar (şablon: manual_observations.example.csv).
Bu script:
  - eksik zorunlu alanları işaretler (değer tahmin etmez),
  - satıcı ile göndericiyi ayrı alanlar olarak tutar,
  - normal fiyat ile kuponlu fiyatı ayırır; kupon koşulları doğrulanmamışsa
    INCELEME_GEREKLI der,
  - amazon_probe_result.json verilirse Amazon satırlarını API sonucuyla karşılaştırır.

Kullanım:
  python3 manual_check.py manual_observations.csv [amazon_probe_result.json]
Çıktı: verification_report.md
"""
import csv
import json
import re
import sys

from amazon_probe import extract_asin

REQUIRED = ["site", "url", "observed_at", "product_name", "seller",
            "regular_price", "stock_text", "evidence"]
TARGET_SELLER = {"amazon": ("Amazon.com.tr",), "hepsiburada": ("Hepsiburada",)}
YES = {"evet", "e", "yes", "y", "true", "1"}


def parse_tl(text):
    """'1.299,90 TL' -> 1299.9. Çözülemezse None."""
    if not text or not text.strip():
        return None
    t = re.sub(r"[^\d,\.]", "", text)
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    elif t.count(".") > 1 or re.search(r"\.\d{3}$", t):
        t = t.replace(".", "")
    try:
        return float(t)
    except ValueError:
        return None


def check_row(row):
    """Tek gözlem satırını denetler. (durum, notlar, kayıt) döndürür."""
    row = {k: (v or "").strip() for k, v in row.items()}
    notes, status = [], "TAMAM"
    missing = [k for k in REQUIRED if not row.get(k)]
    if missing:
        status = "EKSIK"
        notes.append("Eksik zorunlu alan: " + ", ".join(missing))

    site = row.get("site", "").lower()
    if site not in TARGET_SELLER:
        status = "EKSIK"
        notes.append(f"Bilinmeyen site: {site!r} (amazon | hepsiburada)")
    seller = row.get("seller", "")
    seller_ok = None
    if site in TARGET_SELLER and seller:
        seller_ok = seller.casefold() in (s.casefold() for s in TARGET_SELLER[site])
        if not seller_ok:
            notes.append(f"Satıcı hedef dışı: {seller!r}. Takip kapsamına alınmamalı.")
    if not row.get("shipper"):
        notes.append("Gönderici kaydedilmedi (satıcıdan ayrı alan; boş bırakıldı).")
    if not row.get("variant"):
        notes.append("Varyant kaydedilmedi. Ürünün varyantı yoksa 'yok' yazın.")

    regular = parse_tl(row.get("regular_price"))
    if row.get("regular_price") and regular is None:
        status = "EKSIK"
        notes.append(f"Normal fiyat okunamadı: {row['regular_price']!r}")

    coupon_text = row.get("coupon_text", "")
    coupon_price = parse_tl(row.get("coupon_price"))
    verified = row.get("coupon_conditions_verified", "").lower() in YES
    coupon_state = "YOK"
    if coupon_text or row.get("coupon_price"):
        coupon_state = "DOGRULANDI" if verified else "INCELEME_GEREKLI"
        if not coupon_text:
            coupon_state = "INCELEME_GEREKLI"
            notes.append("Kuponlu fiyat var ama kupon metni/koşulu yok.")
        if coupon_price is None:
            coupon_state = "INCELEME_GEREKLI"
            notes.append("Kupon var ama kuponlu fiyat girilmedi ya da okunamadı.")
        elif regular is not None and coupon_price >= regular:
            coupon_state = "INCELEME_GEREKLI"
            notes.append("Kuponlu fiyat normal fiyattan düşük değil.")
        if not verified:
            notes.append("Kupon koşulları (min. sepet, üyelik, tarih, adet) doğrulanmadı.")
        if coupon_state == "INCELEME_GEREKLI" and status == "TAMAM":
            status = "INCELEME_GEREKLI"

    rec = {
        "site": site, "url": row.get("url"), "asin": extract_asin(row.get("url", "")) if site == "amazon" else None,
        "observed_at": row.get("observed_at"), "product_name": row.get("product_name"),
        "variant": row.get("variant") or None, "seller": seller or None, "seller_is_target": seller_ok,
        "shipper": row.get("shipper") or None, "regular_price": regular,
        "coupon_text": coupon_text or None, "coupon_price": coupon_price,
        "coupon_state": coupon_state, "stock_text": row.get("stock_text") or None,
        "evidence": row.get("evidence") or None,
    }
    return status, notes, rec


def compare_with_api(rec, api_by_asin):
    """Aynı ASIN için elle gözlem ile API sonucunu karşılaştırır."""
    api = api_by_asin.get(rec["asin"])
    if not api:
        return ["API sonucunda bu ASIN yok."]
    diffs = []
    if api.get("seller_name") and rec["seller"] and api["seller_name"].casefold() != rec["seller"].casefold():
        diffs.append(f"Satıcı farklı: sayfa={rec['seller']!r}, API={api['seller_name']!r}")
    if api.get("regular_price") is not None and rec["regular_price"] is not None \
            and abs(api["regular_price"] - rec["regular_price"]) > 0.009:
        diffs.append(f"Normal fiyat farklı: sayfa={rec['regular_price']}, API={api['regular_price']} "
                     f"(zaman farkı olabilir: sayfa {rec['observed_at']}, API {api.get('checked_at')})")
    if rec["coupon_price"] is not None:
        diffs.append("Sayfada kupon görüldü; API kupon bilgisi vermediği için otomatik takipte görünmeyecek.")
    return diffs or ["API ile uyumlu (satıcı ve normal fiyat)."]


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    with open(argv[0], encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    api_by_asin = {}
    if len(argv) > 1:
        with open(argv[1], encoding="utf-8") as f:
            api_by_asin = {r["asin"]: r for r in json.load(f).get("records", [])}

    lines = ["# Ürün doğrulama raporu", "",
             "Kaynak: **elle gözlem** (tarayıcıda insan kontrolü)"
             + (" + Amazon Creators API karşılaştırması" if api_by_asin else "")
             + ". Bu rapor otomatik takip sonucu değildir.", "",
             "| # | Site | Ürün | Varyant | Satıcı | Gönderici | Normal fiyat | Kupon | Kuponlu fiyat | Stok | Gözlem zamanı | Durum |",
             "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    details, counts = [], {}
    for i, row in enumerate(rows, 1):
        status, notes, r = check_row(row)
        if api_by_asin and r["site"] == "amazon" and r["asin"]:
            notes += compare_with_api(r, api_by_asin)
        counts[status] = counts.get(status, 0) + 1
        fmt = lambda v: "—" if v in (None, "") else str(v).replace("|", "/")
        lines.append(f"| {i} | {fmt(r['site'])} | {fmt(r['product_name'])} | {fmt(r['variant'])} | "
                     f"{fmt(r['seller'])} | {fmt(r['shipper'])} | {fmt(r['regular_price'])} | "
                     f"{r['coupon_state']} | {fmt(r['coupon_price'])} | {fmt(r['stock_text'])} | "
                     f"{fmt(r['observed_at'])} | **{status}** |")
        if notes:
            details.append(f"- **#{i}** " + "; ".join(notes))
    lines += ["", "Özet: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())), ""]
    if details:
        lines += ["## Notlar", ""] + details + [""]
    with open("verification_report.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("\n".join(lines))
    return 0 if counts.get("EKSIK", 0) == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
