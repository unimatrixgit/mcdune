package com.dunerealms.bank;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

class LoanDelinquencyTest {
    @Test void graceThenBlacklistWithOneTimeFortyPercentFee() {
        var grace=LoanDelinquency.assess(new BigDecimal("1000.00"),false,false,false);
        assertEquals(LoanDelinquency.State.GRACE,grace.state());
        assertEquals(new BigDecimal("0.00"),grace.oneTimeLateFee());
        var overdue=LoanDelinquency.assess(new BigDecimal("1000.00"),true,false,false);
        assertEquals(LoanDelinquency.State.BLACKLISTED,overdue.state());
        assertEquals(new BigDecimal("400.00"),overdue.oneTimeLateFee());
        assertEquals(new BigDecimal("1400.00"),overdue.collectibleArrears());
        assertEquals(new BigDecimal("0.00"),LoanDelinquency.assess(new BigDecimal("1000.00"),true,true,false).oneTimeLateFee());
    }
    @Test void recoveryIsCappedAtIncomingFundsAndArrears() {
        assertEquals(new BigDecimal("200.00"),LoanDelinquency.recovery(new BigDecimal("200.00"),new BigDecimal("500.00")));
        assertEquals(new BigDecimal("500.00"),LoanDelinquency.recovery(new BigDecimal("900.00"),new BigDecimal("500.00")));
    }
    @Test void paidUpAndInsolventStates() {
        assertEquals(LoanDelinquency.State.CURRENT,LoanDelinquency.assess(new BigDecimal("0.00"),true,true,false).state());
        assertEquals(LoanDelinquency.State.INSOLVENT,LoanDelinquency.assess(new BigDecimal("10.00"),true,true,true).state());
    }
    @Test void rejectsInvalidAmounts() {
        assertThrows(IllegalArgumentException.class,()->LoanDelinquency.assess(new BigDecimal("-1"),true,false,false));
        assertThrows(IllegalArgumentException.class,()->LoanDelinquency.recovery(new BigDecimal("-1"),new BigDecimal("10")));
    }
}
