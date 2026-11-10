-- Player-owned DRX company registration foundation.
-- Additive MySQL 8 migration; no player balances, shares or real-money payments changed.
-- A paid entitlement MUST originate from a server-verified, settled shop payment.
CREATE TABLE IF NOT EXISTS dune_market_company_entitlements (
 id CHAR(36) PRIMARY KEY,
 purchaser_uuid CHAR(36) NOT NULL,
 shop_provider VARCHAR(48) NOT NULL,
 provider_payment_id VARCHAR(160) NOT NULL,
 product_sku VARCHAR(80) NOT NULL,
 payment_state ENUM('verified','refunded','chargeback') NOT NULL DEFAULT 'verified',
 consumed_company_id CHAR(36) NULL,
 verified_at BIGINT NOT NULL,
 consumed_at BIGINT NULL,
 UNIQUE KEY unique_provider_payment (shop_provider,provider_payment_id),
 UNIQUE KEY unique_company_consumption (consumed_company_id),
 CHECK (product_sku='drx-company-registration')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dune_market_company_applications (
 id CHAR(36) PRIMARY KEY,
 entitlement_id CHAR(36) NOT NULL UNIQUE,
 founder_uuid CHAR(36) NOT NULL,
 requested_name VARCHAR(120) NOT NULL,
 requested_ticker VARCHAR(8) NOT NULL,
 company_description VARCHAR(1000) NOT NULL,
 state ENUM('pending','approved','rejected','withdrawn') NOT NULL DEFAULT 'pending',
 reviewer_uuid CHAR(36) NULL,
 review_reason VARCHAR(255) NULL,
 issuer_id CHAR(36) NULL UNIQUE,
 created_at BIGINT NOT NULL,
 reviewed_at BIGINT NULL,
 FOREIGN KEY (entitlement_id) REFERENCES dune_market_company_entitlements(id),
 FOREIGN KEY (issuer_id) REFERENCES dune_market_issuers(id),
 UNIQUE KEY unique_pending_ticker (requested_ticker,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dune_market_company_accounts (
 id CHAR(36) PRIMARY KEY,
 issuer_id CHAR(36) NOT NULL UNIQUE,
 bank_account_id CHAR(36) NULL UNIQUE,
 bank_account_number VARCHAR(40) NULL UNIQUE,
 state ENUM('pending-bank-provision','active','suspended') NOT NULL DEFAULT 'pending-bank-provision',
 created_at BIGINT NOT NULL,
 FOREIGN KEY (issuer_id) REFERENCES dune_market_issuers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dune_market_company_members (
 issuer_id CHAR(36) NOT NULL,
 member_uuid CHAR(36) NOT NULL,
 role ENUM('owner','co-owner','treasurer','trader','viewer') NOT NULL,
 can_view BOOLEAN NOT NULL DEFAULT TRUE,
 can_deposit BOOLEAN NOT NULL DEFAULT FALSE,
 can_transfer BOOLEAN NOT NULL DEFAULT FALSE,
 daily_transfer_limit_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
 mandate_expires_at BIGINT NULL,
 revoked_at BIGINT NULL,
 PRIMARY KEY (issuer_id,member_uuid),
 FOREIGN KEY (issuer_id) REFERENCES dune_market_issuers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dune_market_company_provisioning (
 issuer_id CHAR(36) PRIMARY KEY,
 idempotency_key CHAR(36) NOT NULL UNIQUE,
 stage ENUM('awaiting-bank','awaiting-owners','ready','failed') NOT NULL DEFAULT 'awaiting-bank',
 last_error VARCHAR(255) NULL,
 updated_at BIGINT NOT NULL,
 FOREIGN KEY (issuer_id) REFERENCES dune_market_issuers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
