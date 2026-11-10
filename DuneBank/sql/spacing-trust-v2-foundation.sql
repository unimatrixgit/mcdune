-- Spacing Trust Bank 2.0 additive foundation. MySQL 8 / InnoDB.
-- Apply only after backup and staging verification; this DOES NOT reset balances.
-- Existing dune_player_banks and treasury tables remain authoritative until migration.

CREATE TABLE IF NOT EXISTS dune_bank_account_registry (
 account_id CHAR(36) PRIMARY KEY,
 iban CHAR(20) NOT NULL UNIQUE,
 account_type ENUM('personal','savings','joint','clan','company','official') NOT NULL,
 owner_kind ENUM('player','clan','company','house','imperial','landsraad','spacing_guild') NOT NULL,
 owner_key VARCHAR(80) NOT NULL,
 display_name VARCHAR(120) NOT NULL,
 state ENUM('pending','active','frozen','closed') NOT NULL DEFAULT 'pending',
 legacy_balance_source VARCHAR(64) NULL,
 legacy_balance_key VARCHAR(80) NULL,
 created_at BIGINT NOT NULL,
 closed_at BIGINT NULL,
 INDEX owner_accounts(owner_kind,owner_key,state),
 UNIQUE KEY legacy_mapping(legacy_balance_source,legacy_balance_key),
 CHECK (iban REGEXP '^DR[0-9]{18}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sequence allocation MUST use SELECT ... FOR UPDATE within one transaction.
-- Do not derive sequence from MAX(iban) or count(rows).
CREATE TABLE IF NOT EXISTS dune_bank_iban_sequences (
 category_code CHAR(3) PRIMARY KEY,
 next_sequence BIGINT UNSIGNED NOT NULL,
 CHECK (next_sequence BETWEEN 1 AND 9999999999999)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO dune_bank_iban_sequences(category_code,next_sequence)
 VALUES ('101',1),('201',1),('301',1),('401',1),('501',1),('979',1);

CREATE TABLE IF NOT EXISTS dune_bank_mandates (
 account_id CHAR(36) NOT NULL,
 player_uuid CHAR(36) NOT NULL,
 role ENUM('owner','co_owner','treasurer','authorized','deposit_only','viewer') NOT NULL,
 can_view BOOLEAN NOT NULL DEFAULT TRUE,
 can_deposit BOOLEAN NOT NULL DEFAULT FALSE,
 can_pay BOOLEAN NOT NULL DEFAULT FALSE,
 can_manage BOOLEAN NOT NULL DEFAULT FALSE,
 daily_limit_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
 expires_at BIGINT NULL,
 accepted_at BIGINT NULL,
 revoked_at BIGINT NULL,
 PRIMARY KEY(account_id,player_uuid),
 FOREIGN KEY(account_id) REFERENCES dune_bank_account_registry(account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- New immutable double-entry journals, separate from legacy audit ledgers.
-- Entries must be posted in a single transaction, SUM(amount_cents)=0 per journal.
CREATE TABLE IF NOT EXISTS dune_bank_journals (
 id CHAR(36) PRIMARY KEY,
 source_system VARCHAR(48) NOT NULL,
 source_event_id VARCHAR(100) NOT NULL,
 actor_uuid CHAR(36) NULL,
 reference VARCHAR(100) NULL,
 ogm_reference VARCHAR(21) NULL,
 posted_at BIGINT NOT NULL,
 UNIQUE KEY idempotent_source(source_system,source_event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS dune_bank_journal_lines (
 journal_id CHAR(36) NOT NULL,
 line_no SMALLINT UNSIGNED NOT NULL,
 account_id CHAR(36) NOT NULL,
 amount_cents BIGINT NOT NULL,
 PRIMARY KEY(journal_id,line_no),
 FOREIGN KEY(journal_id) REFERENCES dune_bank_journals(id),
 FOREIGN KEY(account_id) REFERENCES dune_bank_account_registry(account_id),
 INDEX account_journal(account_id,journal_id),
 CHECK(amount_cents <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- WARNING: schema alone does not enforce balanced journals or immutable rows.
-- Posting service must verify balance, authorization and available funds under locks.
