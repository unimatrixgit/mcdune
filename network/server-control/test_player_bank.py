import unittest
from unittest.mock import MagicMock
from decimal import Decimal
import player_bank
class PlayerBankTest(unittest.TestCase):
 def fixture(self):
  con=MagicMock();cur=con.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value;cur.fetchone.side_effect=[{'balance':Decimal('100.10')},{'balance':Decimal('150.15')}];cur.fetchall.return_value=[{'id':'entry','player_uuid':'00000000-0000-0000-0009-000000000001','action':'deposit','delta':Decimal('100.10'),'balance_after':Decimal('100.10'),'created_at':1}];return con,cur
 def test_player_exact_uuid_cents_and_select_only(self):
  con,c=self.fixture();uid='00000000-0000-0000-0009-000000000001';r=player_bank.read_player(con,uid);self.assertEqual(r['playerUuid'],uid);self.assertEqual(r['balanceDunemarks'],'100.10');self.assertEqual(r['walletDunemarks'],'150.15');self.assertNotIn('actorUuid',r['ledger'][0]);self.assertEqual(r['ledger'][0]['amountDunemarks'],'100.10');self.assertTrue(all(x.args[0].startswith('SELECT ') for x in c.execute.call_args_list));self.assertTrue(all(x.args[1]==(uid,) for x in c.execute.call_args_list))
 def test_staff_projects_verified_actor_uuid_and_server_contract(self):
  con,c=self.fixture();r=player_bank.read_staff(con);self.assertEqual(r['account'],'server');self.assertNotIn('playerUuid',r);self.assertEqual(r['ledger'][0]['actorUuid'],'00000000-0000-0000-0009-000000000001');self.assertIn('player_uuid',c.execute.call_args_list[-1].args[0])
 def test_invalid_uuid_never_connects(self):
  for v in [None,'bad',"' OR 1=1",'00000000-0000-0000-0009-00000000000A']:
   con=MagicMock()
   with self.assertRaises(ValueError):player_bank.read_player(con,v)
   con.assert_not_called()
 def test_invalid_money_rejected(self):
  for v in ['-1','NaN','Infinity','1.001','not-a-number',None,True,False,1.1,object()]:
   with self.subTest(value=repr(v)):
    with self.assertRaises(RuntimeError):player_bank.money(v)
 def test_exact_money_boundaries(self):
  self.assertEqual(player_bank.money(Decimal('0.01')),'0.01')
  self.assertEqual(player_bank.money(Decimal('1000000000000.00')),'1000000000000.00')
  self.assertEqual(player_bank.money(Decimal('-0.01'),True),'-0.01')
  for v in ['1000000000000.01','-1000000000000.01']:
   with self.assertRaises(RuntimeError):player_bank.money(v,True)

 def test_debtor_wallet_is_projected_without_allowing_negative_bank(self):
  con,c=self.fixture();c.fetchone.side_effect=[{'balance':Decimal('20.00')},{'balance':Decimal('-15.25')}]
  r=player_bank.read_player(con,'00000000-0000-0000-0009-000000000001');self.assertEqual(r['walletDunemarks'],'-15.25');self.assertEqual(r['balanceDunemarks'],'20.00')
  con,c=self.fixture();c.fetchone.side_effect=[{'balance':Decimal('-0.01')}]
  with self.assertRaises(RuntimeError):player_bank.read_player(con,'00000000-0000-0000-0009-000000000001')

 def test_faction_is_derived_from_actual_uuid_and_remains_read_only(self):
  con,c=self.fixture();c.fetchone.side_effect=[{'faction':'Atreides'},{'balance':Decimal('15.25')}]
  r=player_bank.read_faction(con,'00000000-0000-0000-0009-000000000001');self.assertEqual(r['factionId'],'atreides');self.assertEqual(r['balanceDunemarks'],'15.25');self.assertNotIn('actorUuid',r['ledger'][0]);self.assertEqual(c.execute.call_args_list[0].args[1],('00000000-0000-0000-0009-000000000001',));self.assertTrue(all(call.args[0].startswith('SELECT ') for call in c.execute.call_args_list));self.assertTrue(all(call.args[1]==('atreides',) for call in c.execute.call_args_list[1:]))
 def test_unassigned_faction_is_not_inferred(self):
  con,c=self.fixture();c.fetchone.side_effect=[{'faction':'Aerdrecht'}]
  with self.assertRaises(ValueError):player_bank.read_faction(con,'00000000-0000-0000-0009-000000000001')
  self.assertEqual(c.execute.call_count,1)
