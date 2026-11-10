-- Public monthly institutional treasury reports (Emperor, Landsraad, Houses, Guild, clans).
-- Existing balances and leadership records are untouched.
CREATE TABLE IF NOT EXISTS dune_institutional_monthly_reports (
 id CHAR(36) PRIMARY KEY,
 institution_kind ENUM('imperial','landsraad','house','spacing_guild','clan') NOT NULL,
 institution_key VARCHAR(80) NOT NULL,
 report_month CHAR(7) NOT NULL,
 revision SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 status ENUM('draft','published','restated') NOT NULL DEFAULT 'draft',
 opening_balance_cents BIGINT NULL,
 closing_balance_cents BIGINT NULL,
 income_cents BIGINT UNSIGNED NULL,
 expenses_cents BIGINT UNSIGNED NULL,
 vat_collected_cents BIGINT UNSIGNED NULL,
 vat_paid_cents BIGINT UNSIGNED NULL,
 war_spending_cents BIGINT UNSIGNED NULL,
 contract_spending_cents BIGINT UNSIGNED NULL,
 source_cutoff_at BIGINT NOT NULL,
 published_at BIGINT NULL,
 published_by CHAR(36) NULL,
 notes TEXT NULL,
 UNIQUE KEY institution_report_revision (institution_kind,institution_key,report_month,revision),
 INDEX public_institution_month (status,report_month,institution_kind),
 CHECK (report_month REGEXP '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 CHECK (revision > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A 21% tax is a game rule, not a claim of real-world Belgian VAT.
-- Never create duplicate debits for existing settled sales.
CREATE TABLE IF NOT EXISTS dune_imperial_tax_ledger (
 id CHAR(36) PRIMARY KEY,
 source_system VARCHAR(48) NOT NULL,
 source_transaction_id VARCHAR(100) NOT NULL,
 policy_version VARCHAR(40) NOT NULL,
 transaction_kind VARCHAR(48) NOT NULL,
 taxable_base_cents BIGINT UNSIGNED NOT NULL,
 vat_cents BIGINT UNSIGNED NOT NULL,
 treasury_reference VARCHAR(100) NULL,
 settled_at BIGINT NOT NULL,
 UNIQUE KEY one_tax_per_source (source_system,source_transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
