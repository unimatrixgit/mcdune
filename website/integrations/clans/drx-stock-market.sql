-- DRX foundation schema; additive and isolated from existing player balances.
-- MySQL 8 / InnoDB. No shares or Dunemarks are minted by this migration.
CREATE TABLE IF NOT EXISTS dune_market_issuers (
 id CHAR(36) PRIMARY KEY,
 ticker VARCHAR(8) NOT NULL UNIQUE,
 legal_name VARCHAR(120) NOT NULL,
 business_kind VARCHAR(32) NOT NULL,
 official BOOLEAN NOT NULL DEFAULT FALSE,
 operator_uuid CHAR(36) NULL,
 status ENUM('draft','active','suspended','delisted') NOT NULL DEFAULT 'draft',
 created_at BIGINT NOT NULL,
 updated_at BIGINT NOT NULL,
 CHECK (ticker REGEXP '^[A-Z][A-Z0-9]{1,7}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dune_market_share_classes (
 id CHAR(36) PRIMARY KEY,
 issuer_id CHAR(36) NOT NULL,
 symbol VARCHAR(12) NOT NULL UNIQUE,
 issued_shares BIGINT UNSIGNED NOT NULL DEFAULT 0,
 last_trade_cents BIGINT UNSIGNED NULL,
 last_trade_at BIGINT NULL,
 FOREIGN KEY (issuer_id) REFERENCES dune_market_issuers(id),
 CHECK (issued_shares <= 1000000000000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dune_market_positions (
 share_class_id CHAR(36) NOT NULL,
 holder_uuid CHAR(36) NOT NULL,
 quantity BIGINT UNSIGNED NOT NULL DEFAULT 0,
 reserved_quantity BIGINT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY (share_class_id, holder_uuid),
 FOREIGN KEY (share_class_id) REFERENCES dune_market_share_classes(id),
 CHECK (reserved_quantity <= quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dune_market_orders (
 id CHAR(36) PRIMARY KEY,
 share_class_id CHAR(36) NOT NULL,
 owner_uuid CHAR(36) NOT NULL,
 side ENUM('buy','sell') NOT NULL,
 limit_price_cents BIGINT UNSIGNED NOT NULL,
 original_quantity BIGINT UNSIGNED NOT NULL,
 remaining_quantity BIGINT UNSIGNED NOT NULL,
 status ENUM('open','filled','cancelled','expired') NOT NULL DEFAULT 'open',
 created_at BIGINT NOT NULL,
 updated_at BIGINT NOT NULL,
 FOREIGN KEY (share_class_id) REFERENCES dune_market_share_classes(id),
 INDEX market_book (share_class_id,side,status,limit_price_cents,created_at),
 CHECK (limit_price_cents > 0),
 CHECK (original_quantity > 0),
 CHECK (remaining_quantity <= original_quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dune_market_fills (
 id CHAR(36) PRIMARY KEY,
 buy_order_id CHAR(36) NOT NULL,
 sell_order_id CHAR(36) NOT NULL,
 share_class_id CHAR(36) NOT NULL,
 buyer_uuid CHAR(36) NOT NULL,
 seller_uuid CHAR(36) NOT NULL,
 quantity BIGINT UNSIGNED NOT NULL,
 price_cents BIGINT UNSIGNED NOT NULL,
 settled_at BIGINT NOT NULL,
 settlement_request_id CHAR(36) NOT NULL UNIQUE,
 ogm_reference VARCHAR(21) NULL,
 FOREIGN KEY (buy_order_id) REFERENCES dune_market_orders(id),
 FOREIGN KEY (sell_order_id) REFERENCES dune_market_orders(id),
 FOREIGN KEY (share_class_id) REFERENCES dune_market_share_classes(id),
 CHECK (buyer_uuid <> seller_uuid),
 CHECK (quantity > 0),
 CHECK (price_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dune_market_issuer_metrics (
 issuer_id CHAR(36) NOT NULL,
 observed_at BIGINT NOT NULL,
 revenue_cents BIGINT UNSIGNED NULL,
 exchange_volume_cents BIGINT UNSIGNED NULL,
 network_money_supply_cents BIGINT UNSIGNED NULL,
 source VARCHAR(64) NOT NULL,
 PRIMARY KEY (issuer_id, observed_at),
 FOREIGN KEY (issuer_id) REFERENCES dune_market_issuers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dune_market_index_snapshots (
 index_code VARCHAR(12) NOT NULL,
 observed_at BIGINT NOT NULL,
 level_decimal DECIMAL(24,8) NOT NULL,
 divisor_decimal DECIMAL(32,12) NOT NULL,
 constituents_count SMALLINT UNSIGNED NOT NULL,
 PRIMARY KEY (index_code,observed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dune_market_audit (
 id CHAR(36) PRIMARY KEY,
 actor_uuid CHAR(36) NOT NULL,
 action VARCHAR(64) NOT NULL,
 subject_id CHAR(36) NOT NULL,
 reason VARCHAR(255) NOT NULL,
 created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
