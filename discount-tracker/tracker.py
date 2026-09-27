#!/usr/bin/env python3
"""Amazon.com.tr indirim takibi: fiyatı çek, geçmişe yaz, düşüşte Telegram'a taslak gönder.

Cron ile periyodik çalıştırılır (örn. her 30 dk). Her çalıştırmada:
  1. products.txt içindeki ASIN'leri Creators API'den çeker (10'arlı).
  2. Her kontrolü SQLite'a (tracker.db) yazar.
  3. Satıcı Amazon, ürün stokta ve fiyat düşmüşse paylaşım taslağı hazırlar.
  4. Aynı ürün aynı ya da daha yüksek fiyatla DEDUPE_HOURS içinde tekrar gönderilmez.
  5. Taslak, görseliyle birlikte müşterinin Telegram sohbetine gider. WhatsApp'a otomatik
     paylaşım yapılmaz; müşteri kontrol edip kendisi paylaşır.

Ortam değişkenleri: amazon_probe.py'dekiler +
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
  MIN_DROP_PCT      (varsayılan 5)  son kayıtlı fiyata göre en az bu kadar düşüş
  MIN_DISCOUNT_PCT  (varsayılan 15) ilk görülen üründe referans fiyata göre en az bu indirim
  DEDUPE_HOURS      (varsayılan 72)

Kullanım:
  python3 tracker.py products.txt            # gönderir
  python3 tracker.py products.txt --dry-run  # Telegram yerine ekrana yazar
"""
import json
import os
import sqlite3
import sys
import urllib.request
from datetime import datetime, timedelta

from amazon_probe import TR_TZ, extract_asin, get_items, get_token, normalize_item

DB_PATH = os.environ.get("TRACKER_DB", "tracker.db")
AMAZON_SELLER_NAMES = {"amazon.com.tr", "amazon"}


def env_float(name, default):
    return float(os.environ.get(name) or default)


def open_db(path=DB_PATH):
    db = sqlite3.connect(path)
    db.executescript("""
        CREATE TABLE IF NOT EXISTS checks (
            asin TEXT, checked_at TEXT, price REAL, currency TEXT,
            seller_id TEXT, seller_name TEXT, availability TEXT,
            reference_price REAL, reference_type TEXT, raw TEXT);
        CREATE INDEX IF NOT EXISTS checks_asin ON checks(asin, checked_at);
        CREATE TABLE IF NOT EXISTS sent (asin TEXT, price REAL, sent_at TEXT);
    """)
    return db


def is_amazon_seller(rec, merchant_id=None):
    if merchant_id and rec.get("seller_id"):
        return rec["seller_id"] == merchant_id
    return (rec.get("seller_name") or "").strip().casefold() in AMAZON_SELLER_NAMES


def last_price(db, asin):
    row = db.execute("SELECT price FROM checks WHERE asin=? AND price IS NOT NULL "
                     "ORDER BY checked_at DESC LIMIT 1", (asin,)).fetchone()
    return row[0] if row else None


def recently_sent(db, asin, price, hours, now):
    since = (now - timedelta(hours=hours)).isoformat()
    row = db.execute("SELECT MIN(price) FROM sent WHERE asin=? AND sent_at>=?", (asin, since)).fetchone()
    return row[0] is not None and price >= row[0]


def decide(rec, prev_price, merchant_id=None, min_drop=5.0, min_discount=15.0):
    """Paylaşım gerekçesini döndürür; gerekmiyorsa None."""
    price = rec.get("regular_price")
    if price is None or not is_amazon_seller(rec, merchant_id):
        return None
    if (rec.get("availability_type") or "").upper() in ("OUT_OF_STOCK", "UNKNOWN"):
        return None
    if prev_price and price <= prev_price * (1 - min_drop / 100):
        return f"fiyat {prev_price:g} → {price:g} TL"
    ref = rec.get("reference_price")
    if prev_price is None and ref and price <= ref * (1 - min_discount / 100):
        return f"referans fiyata göre %{round((1 - price / ref) * 100)} indirim"
    return None


def build_caption(rec):
    lines = [rec.get("title") or rec["asin"], ""]
    price = rec.get("regular_price_display") or f"{rec['regular_price']:g} TL"
    lines.append(f"⭐ {price}")
    if rec.get("reference_price") and rec["reference_price"] > rec["regular_price"]:
        label = rec.get("reference_price_label") or "Önceki fiyat"
        lines.append(f"🏷 {label}: {rec['reference_price']:g} TL")
    if rec.get("deal_badge"):
        lines.append(f"⚡ {rec['deal_badge']}")
    lines.append("💬 Satıcı Amazon")
    lines.append(f"🔗 {rec.get('url')}")
    return "\n".join(lines)


def send_telegram(token, chat_id, caption, image_url=None):
    method, body = ("sendPhoto", {"chat_id": chat_id, "photo": image_url, "caption": caption}) \
        if image_url else ("sendMessage", {"chat_id": chat_id, "text": caption})
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    if not data.get("ok"):
        raise RuntimeError(f"Telegram hatası: {data}")


def run(asins, dry_run=False):
    db = open_db()
    merchant_id = os.environ.get("AMAZON_TR_MERCHANT_ID")
    version = os.environ["CREATORS_CREDENTIAL_VERSION"]
    token = get_token(os.environ["CREATORS_CLIENT_ID"], os.environ["CREATORS_CLIENT_SECRET"], version)
    min_drop, min_disc = env_float("MIN_DROP_PCT", 5), env_float("MIN_DISCOUNT_PCT", 15)
    dedupe = env_float("DEDUPE_HOURS", 72)
    sent = 0
    for i in range(0, len(asins), 10):
        batch = asins[i:i + 10]
        now = datetime.now(TR_TZ)
        status, data = get_items(token, version, os.environ["CREATORS_PARTNER_TAG"], batch)
        if status != 200:
            print(f"API hatası HTTP {status}: {data}", file=sys.stderr)
            continue
        for err in data.get("errors") or []:
            print(f"Ürün hatası: {err}", file=sys.stderr)
        for item in (data.get("itemsResult") or {}).get("items") or []:
            rec = normalize_item(item, now.isoformat(timespec="seconds"), merchant_id)
            prev = last_price(db, rec["asin"])
            db.execute("INSERT INTO checks VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec["asin"], rec["checked_at"], rec["regular_price"], rec["currency"],
                rec["seller_id"], rec["seller_name"], rec["availability_type"],
                rec["reference_price"], rec["reference_price_type"], json.dumps(item, ensure_ascii=False)))
            reason = decide(rec, prev, merchant_id, min_drop, min_disc)
            print(f"{rec['asin']} {rec['regular_price']} satıcı={rec['seller_name']} "
                  f"stok={rec['availability_type']} önceki={prev} → {reason or 'paylaşım yok'}")
            if not reason or recently_sent(db, rec["asin"], rec["regular_price"], dedupe, now):
                continue
            caption = build_caption(rec)
            if dry_run:
                print(f"--- TASLAK ({reason}) ---\n{caption}\n[görsel] {rec.get('image')}\n")
            else:
                send_telegram(os.environ["TELEGRAM_BOT_TOKEN"], os.environ["TELEGRAM_CHAT_ID"],
                              caption, rec.get("image"))
            db.execute("INSERT INTO sent VALUES (?,?,?)", (rec["asin"], rec["regular_price"], now.isoformat()))
            sent += 1
        db.commit()
    db.close()
    return sent


def main(argv):
    dry_run = "--dry-run" in argv
    files = [a for a in argv if a != "--dry-run"]
    if not files:
        print(__doc__)
        return 2
    with open(files[0], encoding="utf-8") as f:
        asins = [a for a in (extract_asin(l) for l in f if l.strip() and not l.startswith("#")) if a]
    print(f"{run(asins, dry_run)} taslak {'hazırlandı' if dry_run else 'gönderildi'}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
