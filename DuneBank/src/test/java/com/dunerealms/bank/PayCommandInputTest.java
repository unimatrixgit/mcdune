package com.dunerealms.bank;
import org.junit.jupiter.api.Test;
import java.sql.SQLException;
import static org.junit.jupiter.api.Assertions.*;
class PayCommandInputTest {
 @Test void acceptsReferenceWithSpaces()throws Exception{
  var pay=PayCommandInput.parse(new String[]{"unimatrix999","2500.50","Spice","delivery"});
  assertEquals("unimatrix999",pay.recipient());
  assertEquals("2500.50",pay.amount().toPlainString());
  assertEquals("Spice delivery",pay.reference());
 }
 @Test void rejectsInvalidPayments(){
  assertThrows(SQLException.class,()->PayCommandInput.parse(new String[]{"user","0","test"}));
  assertThrows(SQLException.class,()->PayCommandInput.parse(new String[]{"user","1.234","test"}));
  assertThrows(SQLException.class,()->PayCommandInput.parse(new String[]{"user","2"}));
  assertThrows(SQLException.class,()->PayCommandInput.parse(new String[]{"user","2","\nmalicious"}));
  assertThrows(SQLException.class,()->PayCommandInput.parse(new String[]{"user","1000001","test"}));
 }
}
