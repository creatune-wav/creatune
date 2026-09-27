"""Ayrıştırıcı testleri. Fixture SENTETİKTİR (SDK şemasına göre elle yazıldı),
gerçek ürün verisi değildir ve doğrulama sonucu olarak kullanılamaz."""
import unittest

from amazon_probe import extract_asin, normalize_item

SYNTHETIC_ITEM = {
    "asin": "B000TEST01",
    "detailPageURL": "https://www.amazon.com.tr/dp/B000TEST01?tag=test-21",
    "itemInfo": {"title": {"displayValue": "SENTETIK Ürün"}},
    "offersV2": {"listings": [
        {"isBuyBoxWinner": False, "merchantInfo": {"id": "OTHER", "name": "Başka Satıcı"},
         "price": {"money": {"amount": 90, "currency": "TRY", "displayAmount": "90,00 TL"}}},
        {"isBuyBoxWinner": True, "merchantInfo": {"id": "AMZ", "name": "Amazon.com.tr"},
         "price": {"money": {"amount": 100, "currency": "TRY", "displayAmount": "100,00 TL"}},
         "availability": {"type": "IN_STOCK", "message": "Stokta var"}},
    ]},
}


class ProbeTest(unittest.TestCase):
    def test_extract_asin(self):
        self.assertEqual(extract_asin("https://www.amazon.com.tr/Urun-Adi/dp/B0ABCDEF12/ref=x"), "B0ABCDEF12")
        self.assertEqual(extract_asin("B0ABCDEF12"), "B0ABCDEF12")
        self.assertIsNone(extract_asin("https://www.hepsiburada.com/urun-p-HBC00000"))

    def test_uses_buybox_listing_and_matches_merchant_id(self):
        r = normalize_item(SYNTHETIC_ITEM, "2026-01-01T00:00:00+03:00", amazon_merchant_id="AMZ")
        self.assertEqual((r["seller_id"], r["price"], r["availability_type"]), ("AMZ", 100, "IN_STOCK"))
        self.assertTrue(r["seller_is_amazon"])
        self.assertIsNone(r["shipper"])
        self.assertIsNone(r["variant"])

    def test_no_merchant_id_leaves_seller_unverified(self):
        r = normalize_item(SYNTHETIC_ITEM, "t")
        self.assertIsNone(r["seller_is_amazon"])

    def test_missing_offers_are_not_invented(self):
        r = normalize_item({"asin": "B000TEST02"}, "t")
        self.assertIsNone(r["price"])
        self.assertIsNone(r["availability_type"])
        self.assertTrue(r["notes"])


if __name__ == "__main__":
    unittest.main()
