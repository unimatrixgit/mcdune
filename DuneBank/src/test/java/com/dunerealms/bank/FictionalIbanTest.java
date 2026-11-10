package com.dunerealms.bank;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class FictionalIbanTest {
    @Test void eachTypeGetsValidDistinctAccountNumber() {
        for (FictionalIban.Type type : FictionalIban.Type.values()) {
            String iban=FictionalIban.create(type,1);
            assertEquals(20,iban.length());
            assertTrue(FictionalIban.valid(iban));
            assertEquals(type.code(),iban.substring(4,7));
            assertEquals(iban,FictionalIban.normalize(FictionalIban.display(iban)));
            assertNotEquals(iban,FictionalIban.create(type,2));
        }
    }
    @Test void officialUses979AndChecksumRejectsTypos() {
        String iban=FictionalIban.create(FictionalIban.Type.OFFICIAL,12345);
        assertEquals("979",iban.substring(4,7));
        String tampered=iban.substring(0,19)+(iban.charAt(19)=='1'?'2':'1');
        assertFalse(FictionalIban.valid(tampered));
        assertFalse(FictionalIban.valid("BE"+iban.substring(2)));
    }
    @Test void rejectsInvalidSequenceAndUnrecognizedCode() {
        assertThrows(IllegalArgumentException.class,()->FictionalIban.create(FictionalIban.Type.PERSONAL,0));
        assertThrows(IllegalArgumentException.class,()->FictionalIban.create(null,1));
        String valid=FictionalIban.create(FictionalIban.Type.PERSONAL,1);
        assertFalse(FictionalIban.valid(valid.substring(0,4)+"999"+valid.substring(7)));
    }
}
