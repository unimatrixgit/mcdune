package com.example.duneess;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Belgian-style OGM for fictional Dunemarks Exchange receipts; not a real bank identifier. */
final class StructuredCommunication {
    private static final Pattern PATTERN = Pattern.compile("^\\+\\+\\+(\\d{3})/(\\d{4})/(\\d{5})\\+\\+\\+$");
    private StructuredCommunication() {}

    static String forExchangeSale(long saleId) {
        if (saleId < 1 || saleId > 9_999_999_999L)
            throw new IllegalArgumentException("Exchange sale ID exceeds the OGM namespace");
        return format(saleId);
    }

    static String format(long base) {
        if (base < 0 || base > 9_999_999_999L)
            throw new IllegalArgumentException("OGM base out of range");
        String value = String.format(java.util.Locale.ROOT, "%010d%02d", base, base % 97 == 0 ? 97 : base % 97);
        return "+++" + value.substring(0, 3) + "/" + value.substring(3, 7) + "/" + value.substring(7) + "+++";
    }

    static long parse(String value) {
        if (value == null) throw new IllegalArgumentException("Invalid OGM");
        Matcher matcher = PATTERN.matcher(value);
        if (!matcher.matches()) throw new IllegalArgumentException("Invalid OGM format");
        String digits = matcher.group(1) + matcher.group(2) + matcher.group(3);
        long base = Long.parseLong(digits.substring(0, 10));
        int check = Integer.parseInt(digits.substring(10));
        if (check != (base % 97 == 0 ? 97 : base % 97))
            throw new IllegalArgumentException("Invalid OGM checksum");
        return base;
    }
}
