"""Private Dunemarks kit commerce; paid orders become bound, one-use deliveries."""
import base64
import hashlib
import hmac
import json
from pathlib import Path
from functools import lru_cache
from decimal import Decimal
from player_bank import identity
from structured_communication import receipt_ogm

TIERS = ('common', 'uncommon', 'rare', 'very_rare', 'legendary')
KINDS = ('personal_sale', 'official_sale', 'faction_sale', 'server_sale')
FACTIONS = {'fremen': 'Fremen', 'atreides': 'Atreides', 'harkonnen': 'Harkonnen', 'corrino': 'Corrino', 'ordos': 'Ordos'}
MINIMUM_CENTS = (10000, 20000, 40000, 80000, 160000)
TARGETS = (3, 5, 10, 15, 25)
REWARDS_CENTS = (1000, 2500, 5000, 10000, 20000)
TITLES = ('A Stitch in the Sand', 'Colours of the Caravan', "The Caravan’s Trust", 'Patterns of Influence', 'A Legacy in Gold')

@lru_cache(maxsize=1)
def arc_definition():
    path=Path(__file__).with_name('kit-quest-arc-v1.json')
    if not path.is_file():
        path=Path(__file__).resolve().parents[2]/'website'/'content'/'kit-quest-arc-v1.json'
    data=json.loads(path.read_text(encoding='utf-8'))
    if len(data.get('chapters',[]))!=5:raise RuntimeError('Invalid canonical quest arc')
    for i,row in enumerate(data['chapters']):
        if (row['index'],row['quality'],row['targetSales'],row['minimumPriceDunemarks']*100,row['rewardDunemarks']*100)!=(i,TIERS[i],TARGETS[i],MINIMUM_CENTS[i],REWARDS_CENTS[i]):
            raise RuntimeError('Quest economy differs from the canonical arc')
    return data

class Conflict(Exception):
    pass

class InsufficientFunds(Exception):
    pass

def allocation_cents(gross, kind='personal_sale'):
    if type(gross) is not int or not 1 <= gross <= 100000000:
        raise ValueError('Invalid kit price')
    if kind not in KINDS:
        raise ValueError('Invalid kit commerce kind')
    faction = gross * 25 // 100 if kind == 'faction_sale' else 0
    server = gross if kind == 'server_sale' else gross * (15 if kind == 'faction_sale' else 20 if kind == 'official_sale' else 25) // 100
    return faction, server, gross - faction - server


def split_cents(gross, kind='personal_sale'):
    faction, server, seller = allocation_cents(gross, kind)
    if kind == 'faction_sale':
        raise ValueError('Faction sales require the three-way allocation')
    return server, seller

def receipt_code(key, line_id):
    identity(line_id)
    if not isinstance(key, bytes) or len(key) < 32:
        raise RuntimeError('Private item-code key unavailable')
    digest = hmac.new(key, b'dunerealms-kit-v1:' + line_id.encode('ascii'), hashlib.sha256).digest()[:20]
    return 'DRK-' + base64.b32encode(digest).decode('ascii').rstrip('=')

def code_hash(code):
    if not isinstance(code, str) or len(code) != 36 or not code.startswith('DRK-') or any(c not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567' for c in code[4:]):
        raise ValueError('Invalid item code')
    return hashlib.sha256(code.encode('ascii')).hexdigest()

def initialize(cur):
    cur.execute('''CREATE TABLE IF NOT EXISTS dune_kit_carts (
      id VARCHAR(36) PRIMARY KEY,buyer_uuid VARCHAR(36) NOT NULL,payload_hash CHAR(64) NOT NULL,
      lines_json TEXT NOT NULL,paid_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')
    cur.execute('''CREATE TABLE IF NOT EXISTS dune_kit_sales (
      id VARCHAR(36) PRIMARY KEY,buyer_uuid VARCHAR(36) NOT NULL,seller_uuid VARCHAR(36) NOT NULL,
      kit_id VARCHAR(36) NOT NULL,kit_version BIGINT NOT NULL,listing_id VARCHAR(36) NOT NULL,
      listing_version BIGINT NOT NULL,rarity VARCHAR(16) NOT NULL,shop_type VARCHAR(8) NOT NULL,
      commerce_kind VARCHAR(16) NOT NULL DEFAULT 'personal_sale',
      quantity INT NOT NULL,gross_cents BIGINT NOT NULL,server_tax_cents BIGINT NOT NULL,
      faction_tax_cents BIGINT NOT NULL DEFAULT 0,seller_net_cents BIGINT NOT NULL,
      snapshot_json TEXT NOT NULL,code_hash CHAR(64) NOT NULL UNIQUE,
      completed_at BIGINT NOT NULL,redeem_requested_at BIGINT NULL,delivered_at BIGINT NULL,
      INDEX dune_kit_sales_progress(seller_uuid,rarity,delivered_at),
      INDEX dune_kit_sales_pending(buyer_uuid,redeem_requested_at,delivered_at),
      CHECK(quantity=1),CHECK(gross_cents>0),CHECK(server_tax_cents>=0),
      CONSTRAINT dune_kit_sales_faction_nonnegative CHECK(faction_tax_cents>=0),CHECK(seller_net_cents>=0),
      CONSTRAINT dune_kit_sales_conservation CHECK(gross_cents=server_tax_cents+faction_tax_cents+seller_net_cents),
      CONSTRAINT dune_kit_sales_kind CHECK(commerce_kind IN ('personal_sale','official_sale','faction_sale','server_sale'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')
    cur.execute('''CREATE TABLE IF NOT EXISTS dune_kit_arc_claims (
      player_uuid VARCHAR(36) NOT NULL,stage_index INT NOT NULL,
      reward_cents BIGINT NOT NULL,claimed_at BIGINT NOT NULL,
      PRIMARY KEY(player_uuid,stage_index),CHECK(stage_index BETWEEN 0 AND 4),CHECK(reward_cents>0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')


def sales_constraint_migration(cur):
    """Return one atomic MySQL8 ALTER; caller must stop checkout and back up before applying it."""
    import re
    cur.execute('''SELECT tc.CONSTRAINT_NAME AS name,cc.CHECK_CLAUSE AS clause
        FROM information_schema.TABLE_CONSTRAINTS tc
        JOIN information_schema.CHECK_CONSTRAINTS cc
          ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME
        WHERE tc.TABLE_SCHEMA=DATABASE() AND tc.TABLE_NAME='dune_kit_sales' AND tc.CONSTRAINT_TYPE='CHECK' ''')
    checks = cur.fetchall()
    def normalize(value):
        # MySQL's metadata adds character-set introducers to string CHECK literals.
        value = value.replace("\\'", "'")
        value = re.sub(r'_(?:utf8mb4|utf8mb3|utf8|ascii|latin1|binary)(?=\')', '', value, flags=re.I)
        return re.sub(r'[\s`()]+', '', value).lower()
    legacy = {'faction_tax_cents=0', 'gross_cents=server_tax_cents+seller_net_cents'}
    desired = {'faction_tax_cents>=0': ('dune_kit_sales_faction_nonnegative', 'faction_tax_cents>=0'),
        'gross_cents=server_tax_cents+faction_tax_cents+seller_net_cents':
            ('dune_kit_sales_conservation', 'gross_cents=server_tax_cents+faction_tax_cents+seller_net_cents'),
        "commerce_kindin'personal_sale','official_sale','faction_sale','server_sale'":
            ('dune_kit_sales_kind', "commerce_kind IN ('personal_sale','official_sale','faction_sale','server_sale')")}
    clauses = {normalize(row['clause']) for row in checks}
    changes = []
    cur.execute("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='dune_kit_sales' AND COLUMN_NAME='commerce_kind'")
    count = cur.fetchone()
    if not count or type(count['n']) is not int or count['n'] not in (0, 1):
        raise RuntimeError('Kit classification schema unavailable')
    if count['n'] == 0:
        changes.append("ADD COLUMN commerce_kind VARCHAR(16) NOT NULL DEFAULT 'personal_sale' AFTER shop_type")
    for row in checks:
        if normalize(row['clause']) in legacy:
            if not re.fullmatch(r'[A-Za-z0-9_]{1,64}', row['name']):
                raise RuntimeError('Unexpected kit constraint identity')
            changes.append('DROP CHECK `' + row['name'] + '`')
    names = {row['name'] for row in checks if normalize(row['clause']) not in legacy}
    for normalized, (name, expression) in desired.items():
        if normalized not in clauses:
            if name in names:
                raise RuntimeError('Conflicting kit constraint identity')
            changes.append('ADD CONSTRAINT `' + name + '` CHECK(' + expression + ')')
    return 'ALTER TABLE dune_kit_sales ' + ', '.join(changes) if changes else None

def listing_context(cur, buyer, listing):
    cur.execute('CALL dune_kit_listing_lock(%s,%s)', (buyer,listing))
    rows = cur.fetchall()
    while cur.nextset():
        pass
    if len(rows) != 1:
        raise PermissionError('Published kit listing unavailable')
    return rows[0]

def listing_snapshot(row):
    import re
    def plain(value, limit):
        if not isinstance(value,str) or not 1 <= len(value.strip()) <= limit or re.search(r'[\x00-\x1f\x7f<>§]',value):
            raise ValueError('Invalid kit cosmetic text')
        return value.strip()
    quality = str(row.get('quality','')).lower()
    kind = row.get('commerce_kind')
    if quality not in TIERS or kind not in KINDS or row.get('shop_type') not in ('player','clan','official','faction','server'):
        raise ValueError('Invalid listing type or quality')
    shop_types = {'personal_sale': ('player','clan'), 'official_sale': ('official',), 'faction_sale': ('faction',), 'server_sale': ('server',)}
    if row['shop_type'] not in shop_types[kind]:
        raise ValueError('The listing category does not match its authoritative commerce kind')
    color = row.get('kit_color')
    if not isinstance(color,str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',color):
        raise ValueError('Invalid kit colour')
    lore = json.loads(row.get('kit_lore_json',''))
    if not isinstance(lore,list) or len(lore)>6:
        raise ValueError('Invalid kit lore')
    for field in ('listing_version','blueprint_version','price_cents'):
        if type(row.get(field)) is not int or row[field]<1:
            raise ValueError('Invalid listing revision or price')
    if kind == 'personal_sale' and row['price_cents'] < MINIMUM_CENTS[TIERS.index(quality)]:
        raise ValueError('Listing is below the tier minimum')
    allocation_cents(row['price_cents'], kind)
    seller = identity(row['seller_uuid'])
    import uuid
    if uuid.UUID(seller).int == 0:
        raise ValueError('A real verified designer or publisher is required')
    item = {'listingId':identity(row['listing_id']),'listingVersion':row['listing_version'],
        'blueprintId':identity(row['blueprint_id']),'blueprintVersion':row['blueprint_version'],
        'sellerUuid':seller,'clanId':identity(row['clan_id']) if row.get('clan_id') else None,
        'shopType':row['shop_type'],'commerceKind':kind,'quality':quality,
        'priceCents':row['price_cents'],'name':plain(row['kit_name'],64),'color':color.upper(),
        'lore':[plain(line,120) for line in lore]}
    override = row.get('seller_tier_override', 0)
    if type(override) is not int or override not in (0, 1) or (kind != 'personal_sale' and override != 0):
        raise ValueError('Invalid authoritative designer tier override')
    item['sellerTierOverride'] = override
    if kind in ('official_sale', 'faction_sale'):
        office, term = row.get('office_key'), row.get('office_term')
        if not isinstance(office, str) or not re.fullmatch(r'emperor|(?:house-leader|water-steward|spice-steward):(Fremen|Atreides|Harkonnen|Corrino|Ordos)', office):
            raise ValueError('Canonical elected office required')
        if not isinstance(term, str) or not 1 <= len(term) <= 190 or not re.fullmatch(r'[A-Za-z0-9:._-]+',term):
            raise ValueError('Canonical elected term required')
        item.update(officeKey=office, officeTerm=term)
    if kind == 'faction_sale':
        faction = row.get('faction_id')
        if faction not in FACTIONS or item['officeKey'] != 'house-leader:' + FACTIONS[faction]:
            raise ValueError('The owning faction and leader office must match')
        item['factionId'] = faction
    if kind == 'server_sale' and (type(row.get('server_authorized')) is not int or row['server_authorized'] != 1):
        raise PermissionError('Current protected publisher authority required')
    return item


def current_listing_authority(cur, item, locking=True, cache=None):
    if item['commerceKind'] in ('official_sale', 'faction_sale'):
        from player_kits import authority
        owner = item['sellerUuid']
        if cache is None:
            offices = authority(cur, owner, locking=locking)
        else:
            if owner not in cache:
                cache[owner] = authority(cur, owner, locking=locking)
            offices = cache[owner]
        if offices.get(item['officeKey']) != item['officeTerm']:
            raise PermissionError('The listing belongs to an expired elected term')


def credit_sale_bank(cur, kind, owner, amount, actor, stamp, reference):
    """Fixed destinations only. Uses the enclosing checkout transaction and unique sale reference."""
    import uuid
    if amount == 0:
        return
    if kind == 'personal':
        table, key, ledger = 'dune_player_banks', 'player_uuid', 'dune_player_bank_ledger'
    elif kind == 'faction' and owner in FACTIONS:
        table, key, ledger = 'dune_faction_bank_wallet', 'faction_id', 'dune_faction_bank_ledger'
    else:
        raise ValueError('Invalid sale bank destination')
    cur.execute('INSERT INTO '+table+'('+key+',balance,updated_at) VALUES(%s,0,%s) ON DUPLICATE KEY UPDATE '+key+'='+key,(owner,stamp))
    cur.execute('SELECT balance FROM '+table+' WHERE '+key+'=%s FOR UPDATE',(owner,))
    row=cur.fetchone()
    if row is None:
        raise RuntimeError('Sale bank unavailable')
    before=Decimal(row['balance']);after=before+amount
    if before<0 or after>Decimal('1000000000000'):
        raise ValueError('A sale bank limit was reached')
    cur.execute('UPDATE '+table+' SET balance=%s,updated_at=%s WHERE '+key+'=%s',(after,stamp,owner))
    if kind == 'personal':
        cur.execute('INSERT INTO '+ledger+'(id,player_uuid,action,delta,balance_after,created_at,reference) VALUES(%s,%s,%s,%s,%s,%s,%s)',(str(uuid.uuid4()),owner,'faction-kit-sale',amount,after,stamp,reference))
    else:
        cur.execute('INSERT INTO '+ledger+'(id,faction_id,player_uuid,action,delta,balance_after,created_at,reference) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)',(str(uuid.uuid4()),owner,actor,'faction-kit-sale',amount,after,stamp,reference))

def checkout(connect, key, payload, context=listing_context):
    fields={'buyerUuid','listingId','orderLineId','listingVersion','blueprintVersion','priceCents'}
    if not isinstance(payload,dict) or set(payload)!=fields:
        raise ValueError('Invalid checkout fields')
    buyer=identity(payload['buyerUuid']);listing=identity(payload['listingId']);line=identity(payload['orderLineId'])
    for field in ('listingVersion','blueprintVersion','priceCents'):
        if type(payload[field]) is not int or payload[field]<1:
            raise ValueError('Review the current listing before purchasing')
    code=receipt_code(key,line);digest=code_hash(code)
    with connect() as con:
        try:
            con.begin()
            with con.cursor() as cur:
                cur.execute('SELECT buyer_uuid,listing_id,listing_version,kit_version,gross_cents,code_hash FROM dune_kit_sales WHERE id=%s FOR UPDATE',(line,))
                old=cur.fetchone()
                if old:
                    if (old['buyer_uuid'],old['listing_id'],old['listing_version'],old['kit_version'],old['gross_cents']) != (buyer,listing,payload['listingVersion'],payload['blueprintVersion'],payload['priceCents']):
                        raise Conflict('Order line already belongs to a different purchase')
                    if not hmac.compare_digest(old['code_hash'],digest):
                        raise RuntimeError('Item-code key differs from the original receipt')
                    con.rollback()
                    return {'ok':True,'alreadyPaid':True,'orderLineId':line,'structuredCommunication':receipt_ogm('kit',line),'code':code,'delivery':'redeem-code'}
                authority=context(cur,buyer,listing)
                if authority.get('buyer_uuid') != buyer or authority.get('commerce_kind') not in KINDS:
                    raise PermissionError('Current verified buyer and supported listing required')
                item=listing_snapshot(authority)
                current_listing_authority(cur,item)
                if (item['listingId'],item['listingVersion'],item['blueprintVersion'],item['priceCents']) != (listing,payload['listingVersion'],payload['blueprintVersion'],payload['priceCents']):
                    raise Conflict('The listing changed; review its current price and design')
                seller=item['sellerUuid'];tier=TIERS.index(item['quality'])
                kind=item['commerceKind']
                if kind == 'personal_sale' and not item['sellerTierOverride'] and tier > len(claimed(cur,seller)):
                    raise PermissionError('Designer has not unlocked this kit tier')
                wallets={}
                for player in sorted({buyer,seller} if kind in ('personal_sale','official_sale') else {buyer}):
                    cur.execute('SELECT balance FROM dune_economy_balances WHERE uuid=%s FOR UPDATE',(player,))
                    row=cur.fetchone()
                    if row is None:
                        raise PermissionError('Existing buyer and designer Minecraft wallets are required')
                    wallets[player]=Decimal(row['balance'])
                gross=Decimal(item['priceCents'])/100
                if wallets[buyer]<gross:
                    raise InsufficientFunds('Insufficient Dunemarks')
                faction_cents,tax_cents,net_cents=allocation_cents(item['priceCents'],kind);tax=Decimal(tax_cents)/100
                cur.execute("INSERT INTO dune_staff_bank_wallet(account_key,balance,updated_at) VALUES('network',0,0) ON DUPLICATE KEY UPDATE account_key=account_key")
                cur.execute("SELECT balance FROM dune_staff_bank_wallet WHERE account_key='network' FOR UPDATE")
                treasury=Decimal(cur.fetchone()['balance'])+tax
                wallets[buyer]-=gross
                if kind in ('personal_sale','official_sale'):
                    wallets[seller]+=Decimal(net_cents)/100
                if treasury>Decimal('1000000000000') or any(v>Decimal('1000000000000') for v in wallets.values()):
                    raise ValueError('A wallet or treasury limit was reached')
                stamp=now(cur)
                if kind == 'faction_sale':
                    credit_sale_bank(cur,'personal',seller,Decimal(net_cents)/100,buyer,stamp,'kit-sale:'+line)
                    credit_sale_bank(cur,'faction',item['factionId'],Decimal(faction_cents)/100,buyer,stamp,'kit-sale:'+line)
                cur.execute('''INSERT INTO dune_kit_sales(id,buyer_uuid,seller_uuid,kit_id,kit_version,listing_id,listing_version,rarity,shop_type,commerce_kind,quantity,gross_cents,server_tax_cents,faction_tax_cents,seller_net_cents,snapshot_json,code_hash,completed_at)
                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,1,%s,%s,%s,%s,%s,%s,%s)''',
                    (line,buyer,seller,item['blueprintId'],item['blueprintVersion'],listing,item['listingVersion'],item['quality'],item['shopType'],kind,item['priceCents'],tax_cents,faction_cents,net_cents,json.dumps(item),digest,stamp))
                for player,balance in wallets.items():
                    cur.execute('UPDATE dune_economy_balances SET balance=%s WHERE uuid=%s',(balance,player))
                cur.execute("UPDATE dune_staff_bank_wallet SET balance=%s,updated_at=%s WHERE account_key='network'",(treasury,stamp))
                import uuid
                cur.execute('INSERT INTO dune_staff_bank_ledger(id,player_uuid,action,delta,balance_after,created_at,reference) VALUES(%s,%s,%s,%s,%s,%s,%s)',(str(uuid.uuid4()),buyer,'kit-sale-tax',tax,treasury,stamp,'kit-sale:'+line))
            con.commit()
            return {'ok':True,'alreadyPaid':False,'orderLineId':line,'structuredCommunication':receipt_ogm('kit',line),'code':code,'delivery':'redeem-code'}
        except Exception:
            con.rollback();raise

def now(cur):
    cur.execute('SELECT CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000 AS SIGNED) AS now')
    return int(cur.fetchone()['now'])

def cart_input(payload):
    if not isinstance(payload,dict) or set(payload)!={'buyerUuid','cartId','lines'}:
        raise ValueError('Invalid cart fields')
    buyer=identity(payload['buyerUuid']);cart=identity(payload['cartId'])
    if not isinstance(payload['lines'],list) or not 1<=len(payload['lines'])<=20:
        raise ValueError('A cart must contain one to twenty kit lines')
    lines=[]
    for row in payload['lines']:
        if not isinstance(row,dict) or set(row)!={'listingId','orderLineId','listingVersion','blueprintVersion','priceCents'}:
            raise ValueError('Invalid cart line')
        for field in ('listingVersion','blueprintVersion','priceCents'):
            if type(row[field]) is not int or row[field]<1:raise ValueError('Invalid cart revision or price')
        split_cents(row['priceCents'])
        lines.append({**row,'buyerUuid':buyer,'listingId':identity(row['listingId']),'orderLineId':identity(row['orderLineId'])})
    if len({row['orderLineId'] for row in lines})!=len(lines):raise ValueError('Duplicate order line')
    lines.sort(key=lambda row:row['orderLineId'])
    canonical=json.dumps({'buyerUuid':buyer,'cartId':cart,'lines':lines},sort_keys=True,separators=(',',':'))
    return buyer,cart,lines,hashlib.sha256(canonical.encode()).hexdigest()

def checkout_cart(connect,key,payload,context=listing_context):
    buyer,cart,lines,fingerprint=cart_input(payload)
    with connect() as con:
        # Reuse the single-line engine inside ONE outer transaction. Inner boundaries cannot commit partial carts.
        class SharedTransaction:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def cursor(self):return con.cursor()
            def begin(self):pass
            def commit(self):pass
            def rollback(self):pass
        def shared():return SharedTransaction()
        try:
            con.begin()
            with con.cursor() as cur:
                cur.execute('SELECT buyer_uuid,payload_hash FROM dune_kit_carts WHERE id=%s FOR UPDATE',(cart,))
                old=cur.fetchone()
                if old:
                    if old['buyer_uuid']!=buyer or not hmac.compare_digest(old['payload_hash'],fingerprint):
                        raise Conflict('This cart was already paid with different contents')
                    result=[checkout(shared,key,line,context) for line in lines]
                    if not all(row['alreadyPaid'] for row in result):
                        raise RuntimeError('Paid cart has an incomplete order receipt')
                    con.rollback()
                    return {'ok':True,'alreadyPaid':True,'cartId':cart,'lines':result,'delivery':'redeem-code'}
                for line in lines:
                    cur.execute('SELECT id FROM dune_kit_sales WHERE id=%s FOR UPDATE',(line['orderLineId'],))
                    if cur.fetchone():raise Conflict('An order line already belongs to another purchase')
                authorities={}
                for listing in sorted({line['listingId'] for line in lines}):
                    row=context(cur,buyer,listing)
                    if row.get('buyer_uuid')!=buyer or row.get('commerce_kind') not in KINDS:
                        raise PermissionError('Current verified buyer required')
                    authorities[listing]=row
                sellers=set();total=Decimal(0)
                for line in lines:
                    item=listing_snapshot(authorities[line['listingId']])
                    current_listing_authority(cur,item)
                    if (item['listingId'],item['listingVersion'],item['blueprintVersion'],item['priceCents']) != (line['listingId'],line['listingVersion'],line['blueprintVersion'],line['priceCents']):
                        raise Conflict('A cart listing changed; review the entire cart')
                    if item['commerceKind']=='personal_sale' and not item['sellerTierOverride'] and TIERS.index(item['quality'])>len(claimed(cur,item['sellerUuid'])):
                        raise PermissionError('Designer has not unlocked this kit tier')
                    if item['commerceKind'] in ('personal_sale','official_sale'):
                        sellers.add(item['sellerUuid'])
                    total+=Decimal(item['priceCents'])/100
                # Lock every participant in a stable global order before any line is charged.
                balance=None
                for player in sorted(sellers|{buyer}):
                    cur.execute('SELECT balance FROM dune_economy_balances WHERE uuid=%s FOR UPDATE',(player,))
                    row=cur.fetchone()
                    if not row:raise PermissionError('Existing Minecraft wallets required')
                    if player==buyer:balance=Decimal(row['balance'])
                if balance is None or balance<total:raise InsufficientFunds('Insufficient Dunemarks for the entire cart')
                result=[checkout(shared,key,line,lambda cursor,owner,listing:authorities[listing]) for line in lines]
                cur.execute('INSERT INTO dune_kit_carts(id,buyer_uuid,payload_hash,lines_json,paid_at) VALUES(%s,%s,%s,%s,%s)',(cart,buyer,fingerprint,json.dumps(lines),now(cur)))
            con.commit()
            return {'ok':True,'alreadyPaid':False,'cartId':cart,'lines':result,'delivery':'redeem-code'}
        except Exception:
            con.rollback();raise

def stage(value):
    if type(value) is not int or value not in range(5):
        raise ValueError('Invalid kit tier')
    return value

def claimed(cur, player):
    cur.execute('SELECT stage_index FROM dune_kit_arc_claims WHERE player_uuid=%s ORDER BY stage_index', (player,))
    stages = [int(row['stage_index']) for row in cur.fetchall()]
    if stages != list(range(len(stages))) or len(stages) > 5:
        raise RuntimeError('Invalid quest claim sequence')
    return stages

def progress(cur, player, index):
    # One buyer/tier/UTC delivery day. Quantity, self-sales and unpaid/unredeemed codes cannot inflate progress.
    cur.execute('''SELECT COUNT(*) AS n FROM (
       SELECT buyer_uuid,FLOOR(delivered_at/86400000) AS utc_day FROM dune_kit_sales
       WHERE seller_uuid=%s AND rarity=%s AND buyer_uuid<>seller_uuid AND commerce_kind='personal_sale'
       AND delivered_at IS NOT NULL AND quantity=1 AND gross_cents>=%s
       GROUP BY buyer_uuid,FLOOR(delivered_at/86400000)
    ) AS qualifying''', (player, TIERS[index], MINIMUM_CENTS[index]))
    return int(cur.fetchone()['n'])

def read_arc(connect, player):
    player = identity(player)
    definition=arc_definition()
    with connect() as con:
        with con.cursor() as cur:
            done = claimed(cur, player)
            chapters = []
            for index in range(5):
                count = progress(cur, player, index)
                story=definition['chapters'][index]
                chapters.append({'index': index, 'key': story['key'], 'quality':TIERS[index], 'title': story['title'],
                    'description':story['description'],'kitTemplate':story['kitTemplate'],'sales': count,
                    'target': TARGETS[index], 'minimumPriceDunemarks': format(Decimal(MINIMUM_CENTS[index])/100, '.2f'),
                    'rewardDunemarks': format(Decimal(REWARDS_CENTS[index])/100, '.2f'),
                    'claimed': index in done, 'unlocked': index <= len(done),
                    'canClaim': index == len(done) and count >= TARGETS[index]})
    return {'playerUuid': player, 'title': 'The Loom of the Desert', 'chapters': chapters,
        'rewardSource': 'server-bank', 'salesRule': 'Paid, delivered sales of your own designs; one external buyer per tier per UTC day.'}

def read_orders(connect, key, player):
    player=identity(player)
    with connect() as con:
        with con.cursor() as cur:
            cur.execute('''SELECT id,buyer_uuid,seller_uuid,kit_id,rarity,shop_type,commerce_kind,gross_cents,server_tax_cents,faction_tax_cents,seller_net_cents,
                snapshot_json,code_hash,completed_at,redeem_requested_at,delivered_at FROM dune_kit_sales
                WHERE buyer_uuid=%s OR seller_uuid=%s ORDER BY completed_at DESC,id DESC LIMIT 100''',(player,player))
            orders=[]
            for row in cur.fetchall():
                item=json.loads(row['snapshot_json'])
                entry={'orderLineId':row['id'],'structuredCommunication':receipt_ogm('kit',row['id']),'side':'purchase' if row['buyer_uuid']==player else 'sale',
                    'name':item['name'],'quality':row['rarity'],'shopType':row['shop_type'],'commerceKind':row['commerce_kind'],
                    'grossDunemarks':format(Decimal(row['gross_cents'])/100,'.2f'),
                    'serverTaxDunemarks':format(Decimal(row['server_tax_cents'])/100,'.2f'),
                    'factionTaxDunemarks':format(Decimal(row['faction_tax_cents'])/100,'.2f'),
                    'sellerNetDunemarks':format(Decimal(row['seller_net_cents'])/100,'.2f'),
                    'sellerPayoutDestination':'personal-bank' if row['commerce_kind']=='faction_sale' else 'none' if row['commerce_kind']=='server_sale' else 'wallet',
                    'completedAt':row['completed_at'],'deliveredAt':row['delivered_at'],
                    'status':'delivered' if row['delivered_at'] is not None else 'pending-in-game-delivery' if row['redeem_requested_at'] is not None else 'code-ready'}
                if row['buyer_uuid']==player:
                    code=receipt_code(key,row['id'])
                    if not hmac.compare_digest(code_hash(code),row['code_hash']):
                        raise RuntimeError('Item-code key differs from receipt')
                    entry['code']=code
                orders.append(entry)
    return {'playerUuid':player,'currency':'dunemarks','orders':orders}

def catalogue(connect):
    with connect() as con:
        with con.cursor() as cur:
            cur.execute('CALL dune_kit_catalogue()');rows=cur.fetchall()
            while cur.nextset():pass
            cur.execute('SELECT listing_id,COUNT(*) AS sales FROM dune_kit_sales WHERE delivered_at IS NOT NULL AND buyer_uuid<>seller_uuid GROUP BY listing_id')
            popularity={row['listing_id']:int(row['sales']) for row in cur.fetchall()}
            owners=sorted({identity(row['seller_uuid']) for row in rows if row.get('commerce_kind')=='personal_sale'})
            unlocked={owner:set() for owner in owners}
            if owners:
                cur.execute('SELECT player_uuid,stage_index FROM dune_kit_arc_claims WHERE player_uuid IN ('+','.join(['%s']*len(owners))+')',tuple(owners))
                for row in cur.fetchall():unlocked[row['player_uuid']].add(int(row['stage_index']))
            listings=[];office_cache={}
            for row in rows:
                item=listing_snapshot(row)
                try:
                    current_listing_authority(cur,item,locking=False,cache=office_cache)
                except PermissionError:
                    continue
                if item['commerceKind']=='personal_sale':
                    stages=sorted(unlocked[item['sellerUuid']])
                    if stages!=list(range(len(stages))) or (not item['sellerTierOverride'] and TIERS.index(item['quality'])>len(stages)):continue
                item['completedSales']=popularity.get(item['listingId'],0)
                item['sellerName']=str(row['seller_name'])[:64]
                item['priceDunemarks']=format(Decimal(item['priceCents'])/100,'.2f')
                listings.append(item)
    return {'currency':'dunemarks','listings':listings}

def queue_redemption(connect, player, code):
    player = identity(player); digest = code_hash(code)
    with connect() as con:
        try:
            con.begin()
            with con.cursor() as cur:
                cur.execute('SELECT id,buyer_uuid,delivered_at,redeem_requested_at FROM dune_kit_sales WHERE code_hash=%s FOR UPDATE', (digest,))
                row = cur.fetchone()
                if not row or row['buyer_uuid'] != player:
                    raise PermissionError('Item code is unavailable for this account')
                if row['delivered_at'] is None and row['redeem_requested_at'] is None:
                    cur.execute('UPDATE dune_kit_sales SET redeem_requested_at=%s WHERE id=%s AND redeem_requested_at IS NULL', (now(cur), row['id']))
                result = {'ok': True, 'orderLineId': row['id'], 'status': 'delivered' if row['delivered_at'] is not None else 'pending-in-game-delivery'}
            con.commit()
            return result
        except Exception:
            con.rollback();raise

def claim_arc(connect, player, index):
    player = identity(player); index = stage(index)
    arc_definition()
    with connect() as con:
        try:
            con.begin()
            with con.cursor() as cur:
                # Central treasury lock serializes rewards across servers and makes insufficient funding retryable.
                cur.execute("SELECT balance FROM dune_staff_bank_wallet WHERE account_key='network' FOR UPDATE")
                treasury = cur.fetchone()
                done = claimed(cur, player)
                if index in done:
                    con.rollback();return {'ok': True, 'alreadyClaimed': True, 'stage': index}
                if index != len(done) or progress(cur, player, index) < TARGETS[index]:
                    raise PermissionError('Complete the current sales chapter first')
                reward = Decimal(REWARDS_CENTS[index])/100
                if not treasury or Decimal(treasury['balance']) < reward:
                    con.rollback();return {'ok': False, 'pending': True, 'reason': 'server-bank-funding', 'stage': index}
                cur.execute('SELECT balance FROM dune_economy_balances WHERE uuid=%s FOR UPDATE', (player,))
                wallet = cur.fetchone()
                if wallet is None:
                    raise PermissionError('An existing Minecraft wallet is required')
                amount = Decimal(wallet['balance']) + reward
                if amount > Decimal('1000000000000'):
                    raise ValueError('Wallet limit reached')
                stamp = now(cur)
                cur.execute('INSERT INTO dune_kit_arc_claims(player_uuid,stage_index,reward_cents,claimed_at) VALUES(%s,%s,%s,%s)', (player,index,REWARDS_CENTS[index],stamp))
                balance = Decimal(treasury['balance'])-reward
                cur.execute("UPDATE dune_staff_bank_wallet SET balance=%s,updated_at=%s WHERE account_key='network'", (balance,stamp))
                cur.execute('UPDATE dune_economy_balances SET balance=%s WHERE uuid=%s', (amount,player))
                import uuid
                reference = 'kit-arc:'+player+':'+str(index)
                cur.execute('INSERT INTO dune_staff_bank_ledger(id,player_uuid,action,delta,balance_after,created_at,reference) VALUES(%s,%s,%s,%s,%s,%s,%s)', (str(uuid.uuid4()),player,'kit-arc-reward',-reward,balance,stamp,reference))
            con.commit()
            return {'ok': True, 'alreadyClaimed': False, 'stage': index, 'rewardDunemarks': format(reward,'.2f')}
        except Exception:
            con.rollback();raise
