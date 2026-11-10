"""Belgian-style structured communication (OGM) for fictional Dunemarks receipts.

A reference is a payment label, NOT an idempotency key or proof of payment.
The source identifier remains authoritative; numeric labels can collide and
must be checked against a UNIQUE registry before they are issued as unique.
"""
import hashlib
import re

_PATTERN = re.compile(r'^\+\+\+(\d{3})/(\d{4})/(\d{5})\+\+\+$')

def format_ogm(base):
    if type(base) is not int or not 0 <= base <= 9_999_999_999:
        raise ValueError('OGM base must contain ten decimal digits')
    digits = f'{base:010d}'
    checksum = base % 97 or 97
    value = digits + f'{checksum:02d}'
    return f'+++{value[:3]}/{value[3:7]}/{value[7:]}+++'

def parse_ogm(value):
    if not isinstance(value, str):
        raise ValueError('Invalid structured communication')
    match = _PATTERN.fullmatch(value)
    if not match:
        raise ValueError('Expected +++123/4567/89002+++')
    digits = ''.join(match.groups())
    base = int(digits[:10])
    if int(digits[10:]) != (base % 97 or 97):
        raise ValueError('Invalid MOD-97 check digits')
    return base

def receipt_ogm(namespace, identifier):
    """Stable display reference; collisions possible, so never use as a primary key."""
    if namespace not in {'kit', 'exchange'} or not isinstance(identifier, str) or not identifier:
        raise ValueError('Invalid receipt source')
    digest = hashlib.sha256((namespace + ':' + identifier).encode('utf-8')).digest()
    return format_ogm(int.from_bytes(digest[:8], 'big') % 10_000_000_000)
