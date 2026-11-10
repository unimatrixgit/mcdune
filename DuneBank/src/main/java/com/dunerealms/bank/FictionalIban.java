package com.dunerealms.bank;

import java.math.BigInteger;
import java.util.Locale;
import java.util.Set;

/**
 * Fictional DuneRealms account identifiers. DR is NOT an ISO IBAN country code.
 * Format DRkk + 3-digit category + 13-digit sequence (20 characters).
 * Check digits use IBAN MOD-97 for typo detection only, not real bank routing.
 */
public final class FictionalIban {
    public enum Type {
        PERSONAL("101"), SAVINGS("201"), JOINT("301"),
        CLAN("401"), COMPANY("501"), OFFICIAL("979");
        private final String code;
        Type(String code) { this.code = code; }
        public String code() { return code; }
    }
    private static final BigInteger NINETY_SEVEN = BigInteger.valueOf(97);
    private static final BigInteger MAX_SEQUENCE = new BigInteger("9999999999999");
    private FictionalIban() {}

    public static String create(Type type, long sequence) {
        if (type == null || sequence < 1 || BigInteger.valueOf(sequence).compareTo(MAX_SEQUENCE) > 0)
            throw new IllegalArgumentException("Invalid account type or sequence");
        String bban = type.code + String.format(Locale.ROOT, "%013d", sequence);
        // DR = 13 27 in the conventional A=10..Z=35 conversion.
        int remainder = new BigInteger(bban + "132700").mod(NINETY_SEVEN).intValue();
        String check = String.format(Locale.ROOT, "%02d", 98 - remainder);
        return "DR" + check + bban;
    }

    public static String normalize(String formatted) {
        if (formatted == null) throw new IllegalArgumentException("Missing account number");
        String raw = formatted.replace(" ", "").toUpperCase(Locale.ROOT);
        if (!raw.matches("DR[0-9]{18}")) throw new IllegalArgumentException("Invalid fictional IBAN format");
        return raw;
    }

    public static boolean valid(String formatted) {
        try {
            String raw = normalize(formatted);
            if (!Set.of("101", "201", "301", "401", "501", "979").contains(raw.substring(4, 7)))
                return false;
            if (new BigInteger(raw.substring(7)).signum() == 0) return false;
            return new BigInteger(raw.substring(4) + "1327" + raw.substring(2, 4))
                .mod(NINETY_SEVEN).intValue() == 1;
        } catch (IllegalArgumentException e) { return false; }
    }

    public static String display(String iban) {
        String raw = normalize(iban);
        if (!valid(raw)) throw new IllegalArgumentException("Invalid fictional IBAN checksum");
        return raw.replaceAll("(.{4})(?=.)", "$1 ").trim();
    }
}
