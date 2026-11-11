"""Read-only personal/staff Dunemarks projections for the authenticated private gateway."""
import re
import uuid
from decimal import Decimal

def money(value,signed=False):
 # Database DECIMAL values must be exact; never accept binary floats or booleans.
 if isinstance(value,(float,bool)) or value is None: raise RuntimeError('Invalid Dunemarks amount')
 try:
  value=Decimal(value)
  if not value.is_finite() or abs(value)>Decimal('1000000000000') or (not signed and value<0) or value!=value.quantize(Decimal('0.01')): raise RuntimeError('Invalid Dunemarks amount')
 except (ArithmeticError,ValueError,TypeError):
  raise RuntimeError('Invalid Dunemarks amount') from None
 return format(value,'.2f')
def identity(value):
 if not isinstance(value,str) or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',value) or str(uuid.UUID(value))!=value: raise ValueError('Invalid player UUID')
 return value

def _ledger(cursor,staff=False):
 result=[]
 for row in cursor.fetchall():
  if type(row['created_at']) is not int or not isinstance(row['id'],str) or not isinstance(row['action'],str):raise RuntimeError('Invalid bank ledger')
  entry={'id':row['id'],'action':row['action'],'amountDunemarks':money(row['delta'],True),'balanceDunemarks':money(row['balance_after']),'createdAt':row['created_at']}
  if staff: entry['actorUuid']=identity(row['player_uuid'])
  result.append(entry)
 return result

def read_player(connect,player_uuid):
 player_uuid=identity(player_uuid)
 with connect() as con:
  with con.cursor() as cursor:
   cursor.execute('SELECT balance FROM dune_player_banks WHERE player_uuid=%s',(player_uuid,));row=cursor.fetchone();balance=money(row['balance'] if row else 0)
   cursor.execute('SELECT balance FROM dune_economy_balances WHERE uuid=%s',(player_uuid,));row=cursor.fetchone();wallet=money(row['balance'] if row else 0,True)
   cursor.execute('SELECT id,action,delta,balance_after,created_at FROM dune_player_bank_ledger WHERE player_uuid=%s ORDER BY created_at DESC,id DESC LIMIT 50',(player_uuid,));ledger=_ledger(cursor)
 return {'playerUuid':player_uuid,'currency':'dunemarks','balanceDunemarks':balance,'walletDunemarks':wallet,'ledger':ledger}

def read_staff(connect):
 with connect() as con:
  with con.cursor() as cursor:
   cursor.execute("SELECT balance FROM dune_staff_bank_wallet WHERE account_key='network'");row=cursor.fetchone();balance=money(row['balance'] if row else 0)
   cursor.execute('SELECT id,player_uuid,action,delta,balance_after,created_at FROM dune_staff_bank_ledger ORDER BY created_at DESC,id DESC LIMIT 50');ledger=_ledger(cursor,True)
 return {'account':'server','currency':'dunemarks','balanceDunemarks':balance,'ledger':ledger}

def read_faction(connect,player_uuid):
 player_uuid=identity(player_uuid)
 with connect() as con:
  with con.cursor() as cursor:
   cursor.execute('SELECT faction FROM dune_players WHERE uuid=%s',(player_uuid,));row=cursor.fetchone()
   if not row or not isinstance(row.get('faction'),str):raise ValueError('Choose a faction first')
   faction=row['faction'].lower()
   if faction not in {'fremen','atreides','harkonnen','corrino','ordos'}:raise ValueError('Invalid faction')
   cursor.execute('SELECT balance FROM dune_faction_bank_wallet WHERE faction_id=%s',(faction,));row=cursor.fetchone();balance=money(row['balance'] if row else 0)
   cursor.execute('SELECT id,action,delta,balance_after,created_at FROM dune_faction_bank_ledger WHERE faction_id=%s ORDER BY created_at DESC,id DESC LIMIT 50',(faction,));ledger=_ledger(cursor)
 return {'playerUuid':player_uuid,'factionId':faction,'currency':'dunemarks','balanceDunemarks':balance,'ledger':ledger}
