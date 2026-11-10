#!/usr/bin/env python3
"""Pre-launch DuneRealms economy reset planner. READ ONLY. No DB writes.

Usage: python3 tools/economy-reset-plan.py < schema_snapshot.tsv
Input: tab-separated table_name, column_name, data_type from INFORMATION_SCHEMA.
Prints coverage and blocks on unknown money-bearing columns.
"""
import sys
import re
TABLES = {
 'dune_economy_balances':'balance',
 'dune_player_banks':'balance',
 'dune_staff_bank_wallet':'balance',
 'dune_faction_bank_wallet':'balance',
 'dune_clan_wallets':'balance',
}
MONEY = re.compile(r'(balance|treasury|wallet|fund|cash|credit|solari|dunemark)',re.I)
EXCLUDED = re.compile(r'(ledger|history|audit|sale|order|payment|transfer|report|snapshot|metric|tax|invoice|receipt)',re.I)

def inspect(rows):
    present={}
    for line in rows:
        parts=line.rstrip('\n').split('\t')
        if len(parts)!=3:continue
        table,col,typ=parts
        present.setdefault(table,{})[col]=typ
    print('READ-ONLY RESET COVERAGE')
    for table,col in TABLES.items():
        print(('FOUND' if col in present.get(table,{}) else 'MISSING')+' '+table+'.'+col)
    unknown=[]
    for table,cols in sorted(present.items()):
        if EXCLUDED.search(table):continue
        for col,typ in cols.items():
            if MONEY.search(col) and (table not in TABLES or col!=TABLES[table]) and any(x in typ.lower() for x in ('decimal','numeric','int','float','double')):
                unknown.append(table+'.'+col)
    print('UNREVIEWED MONEY FIELDS: '+(', '.join(unknown) if unknown else 'none'))
    print('NO DATABASE WRITES PERFORMED. Maintenance lock, verified backup, explicit reviewed reset, IBAN migration, and reconciliation required.')

if __name__=='__main__':
    inspect(sys.stdin)
