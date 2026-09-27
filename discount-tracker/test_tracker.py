"""tracker karar/tekrar kuralları. Veriler SENTETİKTİR; canlı test değildir."""
import os
import tempfile
import unittest
from datetime import datetime

from amazon_probe import TR_TZ
from tracker import build_caption, decide, open_db, recently_sent

REC = {"asin": "B000TEST01", "title": "SENTETIK", "regular_price": 900.0, "regular_price_display": "900,00 TL",
       "seller_name": "Amazon.com.tr", "seller_id": "AMZ", "availability_type": "IN_STOCK",
       "reference_price": 1200.0, "reference_price_label": None, "deal_badge": None,
       "url": "https://www.amazon.com.tr/dp/B000TEST01?tag=x-21"}


class TrackerTest(unittest.TestCase):
    def test_drop_triggers(self):
        self.assertIn("1000 → 900", decide(REC, 1000.0))

    def test_small_drop_ignored(self):
        self.assertIsNone(decide({**REC, "regular_price": 990.0}, 1000.0))

    def test_non_amazon_seller_ignored(self):
        self.assertIsNone(decide({**REC, "seller_name": "Başka Mağaza"}, 1000.0))
        self.assertIsNone(decide(REC, 1000.0, merchant_id="OTHER"))

    def test_out_of_stock_ignored(self):
        self.assertIsNone(decide({**REC, "availability_type": "OUT_OF_STOCK"}, 1000.0))

    def test_first_seen_uses_reference_discount(self):
        self.assertIn("%25", decide(REC, None))
        self.assertIsNone(decide({**REC, "reference_price": 950.0}, None))

    def test_dedupe(self):
        with tempfile.TemporaryDirectory() as d:
            db = open_db(os.path.join(d, "t.db"))
            now = datetime.now(TR_TZ)
            db.execute("INSERT INTO sent VALUES (?,?,?)", ("B000TEST01", 900.0, now.isoformat()))
            self.assertTrue(recently_sent(db, "B000TEST01", 900.0, 72, now))
            self.assertFalse(recently_sent(db, "B000TEST01", 850.0, 72, now))
            db.close()

    def test_caption(self):
        c = build_caption(REC)
        self.assertIn("900,00 TL", c)
        self.assertIn("Satıcı Amazon", c)
        self.assertIn("tag=x-21", c)


if __name__ == "__main__":
    unittest.main()
