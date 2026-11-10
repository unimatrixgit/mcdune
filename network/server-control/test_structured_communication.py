import unittest
from structured_communication import format_ogm, parse_ogm, receipt_ogm

class StructuredCommunicationTest(unittest.TestCase):
    def test_example(self):
        self.assertEqual(format_ogm(1234567890), '+++123/4567/89002+++')
        self.assertEqual(parse_ogm('+++123/4567/89002+++'), 1234567890)

    def test_zero_and_mod97(self):
        self.assertEqual(format_ogm(0), '+++000/0000/00097+++')
        self.assertEqual(parse_ogm(format_ogm(97)), 97)

    def test_invalid(self):
        for value in ('+++123/4567/89001+++', '123/4567/89002', '+++123/4567/89002+++ ', '+++123/4567/89002+++\n'):
            with self.assertRaises(ValueError):
                parse_ogm(value)

    def test_receipt_is_stable_and_namespaced(self):
        first=receipt_ogm('kit','abc')
        self.assertEqual(first,receipt_ogm('kit','abc'))
        self.assertNotEqual(first,receipt_ogm('exchange','abc'))
        parse_ogm(first)

if __name__ == '__main__':
    unittest.main()
