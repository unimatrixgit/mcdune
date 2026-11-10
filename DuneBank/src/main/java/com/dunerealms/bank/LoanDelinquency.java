package com.dunerealms.bank;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Pure policy calculation for fictional Dunemarks loan arrears; no balance writes. */
public final class LoanDelinquency {
    public enum State { CURRENT, GRACE, BLACKLISTED, INSOLVENT }
    public record Assessment(State state, BigDecimal unpaidInstallment,
                             BigDecimal oneTimeLateFee, BigDecimal collectibleArrears) {}
    private static final BigDecimal FEE_RATE = new BigDecimal("0.40");
    private LoanDelinquency() {}

    /**
     * The fee is calculated ONLY once by the posting service, with a unique
     * (loanId, installmentId, feeType) idempotency key. This function never posts it.
     * Insolvency is a separate review state, not automatic asset seizure.
     */
    public static Assessment assess(BigDecimal unpaid, boolean graceExpired,
                                    boolean feeAlreadyCharged, boolean insolvencyApproved) {
        if (unpaid == null || unpaid.scale() > 2 || unpaid.signum() < 0)
            throw new IllegalArgumentException("Invalid overdue amount");
        unpaid=unpaid.setScale(2, RoundingMode.UNNECESSARY);
        if (unpaid.signum() == 0)
            return new Assessment(State.CURRENT, unpaid, BigDecimal.ZERO.setScale(2), unpaid);
        BigDecimal fee=graceExpired && !feeAlreadyCharged
            ? unpaid.multiply(FEE_RATE).setScale(2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO.setScale(2);
        State state=insolvencyApproved?State.INSOLVENT:graceExpired?State.BLACKLISTED:State.GRACE;
        return new Assessment(state,unpaid,fee,unpaid.add(fee));
    }

    /** Recovery can never exceed actual available incoming personal funds or arrears. */
    public static BigDecimal recovery(BigDecimal incoming, BigDecimal arrears) {
        if (incoming==null||arrears==null||incoming.signum()<0||arrears.signum()<0||
            incoming.scale()>2||arrears.scale()>2)
            throw new IllegalArgumentException("Invalid recovery values");
        return incoming.min(arrears).setScale(2,RoundingMode.UNNECESSARY);
    }
}
