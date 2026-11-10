-- Monthly corporate statements: snapshots are immutable after publication.
-- MySQL 8, additive. Does not alter bank balances or existing ledgers.
CREATE TABLE IF NOT EXISTS dune_market_monthly_reports (
 id CHAR(36) PRIMARY KEY,
 issuer_id CHAR(36) NOT NULL,
 report_month CHAR(7) NOT NULL,
 status ENUM('draft','published','restated') NOT NULL DEFAULT 'draft',
 currency CHAR(2) NOT NULL DEFAULT 'DM',
 revenue_cents BIGINT NULL,
 operating_expenses_cents BIGINT NULL,
 tax_cents BIGINT NULL,
 profit_cents BIGINT NULL,
 opening_cash_cents BIGINT NULL,
 closing_cash_cents BIGINT NULL,
 spice_quantity BIGINT UNSIGNED NULL,
 spice_sales_cents BIGINT UNSIGNED NULL,
 exchange_volume_cents BIGINT UNSIGNED NULL,
 shares_outstanding BIGINT UNSIGNED NULL,
 notes TEXT NULL,
 source_cutoff_at BIGINT NOT NULL,
 prepared_at BIGINT NOT NULL,
 published_at BIGINT NULL,
 published_by CHAR(36) NULL,
 previous_report_id CHAR(36) NULL,
 UNIQUE KEY unique_issuer_month_version (issuer_id,report_month,id),
 INDEX public_reports (issuer_id,status,report_month),
 FOREIGN KEY (issuer_id) REFERENCES dune_market_issuers(id),
 FOREIGN KEY (previous_report_id) REFERENCES dune_market_monthly_reports(id),
 CHECK (report_month REGEXP '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 CHECK (profit_cents IS NULL OR profit_cents = revenue_cents - operating_expenses_cents - tax_cents),
 CHECK (revenue_cents IS NULL OR revenue_cents >= 0),
 CHECK (operating_expenses_cents IS NULL OR operating_expenses_cents >= 0),
 CHECK (tax_cents IS NULL OR tax_cents >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Evidence for every published metric, e.g. verified service sales, paid invoices,
-- treasury snapshots. References are internal; never publish player identifiers.
CREATE TABLE IF NOT EXISTS dune_market_monthly_report_sources (
 report_id CHAR(36) NOT NULL,
 metric VARCHAR(48) NOT NULL,
 source_system VARCHAR(64) NOT NULL,
 source_watermark VARCHAR(128) NOT NULL,
 record_count BIGINT UNSIGNED NOT NULL,
 amount_cents BIGINT NULL,
 PRIMARY KEY (report_id,metric,source_system),
 FOREIGN KEY (report_id) REFERENCES dune_market_monthly_reports(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
