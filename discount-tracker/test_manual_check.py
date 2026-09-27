"""manual_check denetim kuralları. Satırlar SENTETİKTİR, gerçek gözlem değildir."""
import unittest

from manual_check import check_row, compare_with_api, parse_tl

BASE = {"site": "hepsiburada", "url": "https://www.hepsiburada.com/x-p-TEST", "observed_at": "2026-01-01T10:00+03:00",
        "product_name": "SENTETIK", "variant": "yok", "seller": "Hepsiburada", "shipper": "Hepsiburada",
        "regular_price": "1.299,90 TL", "stock_text": "Stokta", "evidence": "shot.png"}


class ManualCheckTest(unittest.TestCase):
    def test_parse_tl(self):
        self.assertEqual(parse_tl("1.299,90 TL"), 1299.9)
        self.assertEqual(parse_tl("₺12.499"), 12499.0)
        self.assertEqual(parse_tl("349,5"), 349.5)
        self.assertIsNone(parse_tl(""))

    def test_clean_row(self):
        status, _, r = check_row(BASE)
        self.assertEqual((status, r["regular_price"], r["coupon_state"], r["seller_is_target"]),
                         ("TAMAM", 1299.9, "YOK", True))

    def test_unverified_coupon_needs_review_and_keeps_regular_price(self):
        status, _, r = check_row({**BASE, "coupon_text": "Sepette 100 TL kupon", "coupon_price": "1.199,90"})
        self.assertEqual((status, r["coupon_state"]), ("INCELEME_GEREKLI", "INCELEME_GEREKLI"))
        self.assertEqual((r["regular_price"], r["coupon_price"]), (1299.9, 1199.9))

    def test_verified_coupon(self):
        status, _, r = check_row({**BASE, "coupon_text": "x", "coupon_price": "1199,90",
                                  "coupon_conditions_verified": "evet"})
        self.assertEqual((status, r["coupon_state"]), ("TAMAM", "DOGRULANDI"))

    def test_coupon_price_without_text_needs_review(self):
        _, _, r = check_row({**BASE, "coupon_price": "1199,90", "coupon_conditions_verified": "evet"})
        self.assertEqual(r["coupon_state"], "INCELEME_GEREKLI")

    def test_missing_fields_and_foreign_seller(self):
        status, notes, r = check_row({**BASE, "seller": "Başka Mağaza", "evidence": "", "shipper": ""})
        self.assertEqual(status, "EKSIK")
        self.assertFalse(r["seller_is_target"])
        self.assertIsNone(r["shipper"])

    def test_compare_with_api(self):
        _, _, r = check_row({**BASE, "site": "amazon", "url": "https://www.amazon.com.tr/dp/B000TEST01",
                             "seller": "Amazon.com.tr"})
        diffs = compare_with_api(r, {"B000TEST01": {"seller_name": "Amazon.com.tr", "regular_price": 1399.9}})
        self.assertTrue(any("Normal fiyat farklı" in d for d in diffs))


if __name__ == "__main__":
    unittest.main()
