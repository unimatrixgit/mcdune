// Internal DuneRealms accounts. DR is not a registered IBAN country code.
// These identifiers cannot be used for real-world bank transfers.

const types = {
  player:  '101',
  current: '102',
  clan:    '201',
  faction: '301',
  server:  '979'
};

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export const accountSchema = `
CREATE TABLE IF NOT EXISTS imperial_bank_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bank_type VARCHAR(12) NOT NULL,
  owner_key VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY bank_owner(bank_type,owner_key)
) ENGINE=InnoDB`;

function mod97(value) {
  let remainder = 0;
  for (const digit of value) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

function ibanCheckDigits(bban) {
  // ISO 13616 rearrangement: BBAN + DR + 00
  // D = 13, R = 27
  const remainder = mod97(bban + '132700');
  return String(98 - remainder).padStart(2, '0');
}

export function accountNumber(type, id) {
  const prefix = types[type];
  if (!prefix || !Number.isSafeInteger(id) || id < 1 || id > 999999999) {
    throw new Error('Invalid bank identifier');
  }

  const bban = prefix + String(id).padStart(9, '0');
  const raw = 'DR' + ibanCheckDigits(bban) + bban;
  return raw.match(/.{1,4}/g).join(' ');
}

export function validAccountNumber(value) {
  if (typeof value !== 'string') return false;

  const raw = value.replaceAll(' ', '').toUpperCase();
  if (!/^DR\d{14}$/.test(raw)) return false;

  const bban = raw.slice(4);
  const prefix = bban.slice(0, 3);
  const type = Object.keys(types).find(key => types[key] === prefix);
  if (!type) return false;

  const id = Number(bban.slice(3));
  if (!Number.isSafeInteger(id) || id < 1) return false;

  return mod97(bban + '1327' + raw.slice(2, 4)) === 1;
}

export async function imperialAccount(db, type, owner) {
  if (!types[type] || typeof owner !== 'string') {
    throw new Error('Invalid bank owner');
  }

  owner = owner.toLowerCase();

  if (['player', 'current', 'clan'].includes(type) && !uuid.test(owner)) {
    throw new Error('Invalid bank owner');
  }

  if (
    (type === 'server' && owner !== 'network') ||
    (type === 'faction' &&
      !['atreides','harkonnen','corrino','ordos','fremen',
        'veiled_concord','spacing_guild'].includes(owner))
  ) {
    throw new Error('Invalid bank owner');
  }

  const existing = await db.prepare(
    'SELECT id FROM imperial_bank_accounts WHERE bank_type=? AND owner_key=?'
  ).bind(type, owner).first();

  if (existing) return accountNumber(type, Number(existing.id));

  const [result] = await db.batch([{
    async run(connection) {
      await connection.execute(
        `INSERT INTO imperial_bank_accounts
         (bank_type,owner_key,created_at)
         VALUES(?,?,?)
         ON DUPLICATE KEY UPDATE owner_key=VALUES(owner_key)`,
        [type, owner, Date.now()]
      );

      const [[row]] = await connection.execute(
        `SELECT id FROM imperial_bank_accounts
         WHERE bank_type=? AND owner_key=? FOR UPDATE`,
        [type, owner]
      );

      return accountNumber(type, Number(row.id));
    }
  }]);

  return result;
}
