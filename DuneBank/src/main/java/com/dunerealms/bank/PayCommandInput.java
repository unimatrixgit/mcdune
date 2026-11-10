package com.dunerealms.bank;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.Arrays;

/** Strict /pay input parsing. Transfer execution must use the authoritative fenced bank transaction. */
public final class PayCommandInput {
 private PayCommandInput(){}
 public record Payment(String recipient,BigDecimal amount,String reference){}
 public static Payment parse(String[] args)throws SQLException{
  if(args==null||args.length<3)throw new SQLException("Usage: /pay <player> <amount> <reference>");
  String recipient=args[0];
  if(!recipient.matches("[A-Za-z0-9_]{3,16}"))throw new SQLException("Use a valid Minecraft username.");
  if(!args[1].matches("[0-9]{1,7}(?:\\.[0-9]{1,2})?"))throw new SQLException("Use a positive amount with up to two decimals.");
  BigDecimal amount=BankStore.amount(new BigDecimal(args[1]));
  String reference=String.join(" ",Arrays.copyOfRange(args,2,args.length)).trim();
  if(reference.length()<2||reference.length()>100||!reference.matches("[\\p{L}\\p{N} _.,#-]+"))throw new SQLException("Reference must be 2-100 plain-text characters.");
  return new Payment(recipient,amount,reference);
 }
}
