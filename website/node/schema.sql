CREATE TABLE IF NOT EXISTS integration_sso_codes (
 code_hash CHAR(64) PRIMARY KEY,user_id VARCHAR(36) NOT NULL,session_ref CHAR(64) NOT NULL,client_id VARCHAR(20) NOT NULL,expires_at BIGINT NOT NULL,
 INDEX integration_sso_expiry(expires_at)
);
CREATE TABLE IF NOT EXISTS site_accounts (
 id CHAR(36) PRIMARY KEY, username VARCHAR(32) NOT NULL UNIQUE, display_name VARCHAR(40) NOT NULL,
 password_salt CHAR(32) NOT NULL, password_hash CHAR(128) NOT NULL,
 role VARCHAR(16) NOT NULL DEFAULT 'player', created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS site_sessions (
 token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL, expires_at BIGINT NOT NULL,
 INDEX site_session_expiry(expires_at), FOREIGN KEY(user_id) REFERENCES site_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS forum_topics (
 id CHAR(36) PRIMARY KEY, category VARCHAR(24) NOT NULL, title VARCHAR(120) NOT NULL, body TEXT NOT NULL,
 author_id VARCHAR(200) NOT NULL, author_name VARCHAR(40) NOT NULL, created_at BIGINT NOT NULL,
 last_activity_at BIGINT NOT NULL, closed TINYINT NOT NULL DEFAULT 0, deleted TINYINT NOT NULL DEFAULT 0,
 INDEX forum_topics_activity(deleted,last_activity_at), INDEX forum_topics_author(author_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS forum_posts (
 id CHAR(36) PRIMARY KEY, topic_id CHAR(36) NOT NULL, body TEXT NOT NULL, author_id VARCHAR(200) NOT NULL,
 author_name VARCHAR(40) NOT NULL, created_at BIGINT NOT NULL, deleted TINYINT NOT NULL DEFAULT 0,
 INDEX forum_posts_topic(topic_id,deleted,created_at), INDEX forum_posts_author(author_id,created_at),
 FOREIGN KEY(topic_id) REFERENCES forum_topics(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS forum_reports (
 id CHAR(36) PRIMARY KEY, target_type VARCHAR(16) NOT NULL, target_id CHAR(36) NOT NULL,
 reporter_id VARCHAR(200) NOT NULL, reason TEXT NOT NULL, created_at BIGINT NOT NULL,
 resolved TINYINT NOT NULL DEFAULT 0, UNIQUE(target_type,target_id,reporter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS player_profiles (
 user_id VARCHAR(200) PRIMARY KEY, display_name VARCHAR(40) NOT NULL,
 minecraft_name VARCHAR(32) NOT NULL DEFAULT '', discord_name VARCHAR(50) NOT NULL DEFAULT '',
 created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS support_tickets (
 id CHAR(36) PRIMARY KEY, user_id VARCHAR(200) NOT NULL, category VARCHAR(24) NOT NULL,
 subject VARCHAR(120) NOT NULL, body TEXT NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'open',
 created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
 INDEX support_tickets_owner(user_id,updated_at), INDEX support_tickets_status(status,updated_at),
 FOREIGN KEY(user_id) REFERENCES player_profiles(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS support_messages (
 id CHAR(36) PRIMARY KEY, ticket_id CHAR(36) NOT NULL, author_id VARCHAR(200) NOT NULL,
 author_name VARCHAR(40) NOT NULL, author_role VARCHAR(16) NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL,
 INDEX support_messages_ticket(ticket_id,created_at), INDEX support_messages_author(author_id,created_at),
 FOREIGN KEY(ticket_id) REFERENCES support_tickets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS site_game_links (
 user_id CHAR(36) PRIMARY KEY,
 minecraft_uuid CHAR(36) UNIQUE DEFAULT NULL,
 minecraft_name VARCHAR(32) DEFAULT NULL,
 token_hash CHAR(64) UNIQUE DEFAULT NULL,
 expires_at BIGINT NOT NULL DEFAULT 0,
 linked_at BIGINT DEFAULT NULL,
 FOREIGN KEY(user_id) REFERENCES site_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS site_game_identities (
 minecraft_uuid CHAR(36) PRIMARY KEY, first_linked_at BIGINT NOT NULL, last_name VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS site_link_challenges (
 user_id CHAR(36) PRIMARY KEY, token_hash CHAR(64) NOT NULL UNIQUE, expires_at BIGINT NOT NULL,
 FOREIGN KEY(user_id) REFERENCES site_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS community_campaigns (
 month CHAR(7) PRIMARY KEY, target_cents BIGINT NOT NULL, received_cents BIGINT NOT NULL DEFAULT 0,
 reward_amount INT NOT NULL, public_code VARCHAR(48) NOT NULL UNIQUE,
 reached_at BIGINT DEFAULT NULL, created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS community_rewards (
 minecraft_uuid CHAR(36) NOT NULL, month CHAR(7) NOT NULL, personal_code VARCHAR(48) NOT NULL UNIQUE,
 issued_at BIGINT NOT NULL, used_at BIGINT DEFAULT NULL,
 PRIMARY KEY(minecraft_uuid,month), FOREIGN KEY(month) REFERENCES community_campaigns(month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS community_claims (
 minecraft_uuid CHAR(36) NOT NULL, month CHAR(7) NOT NULL, receipt CHAR(64) NOT NULL UNIQUE,
 amount INT NOT NULL, prepared_at BIGINT NOT NULL, delivered_at BIGINT DEFAULT NULL,
 PRIMARY KEY(minecraft_uuid,month), FOREIGN KEY(month) REFERENCES community_campaigns(month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS account_audit (
 id CHAR(36) PRIMARY KEY, actor_id CHAR(36) NOT NULL, action VARCHAR(40) NOT NULL,
 details VARCHAR(500) NOT NULL, created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS cp_ranks (
 rank_key VARCHAR(40) PRIMARY KEY, label VARCHAR(40) NOT NULL, rank_level INTEGER NOT NULL,
 kind VARCHAR(16) NOT NULL, permissions_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS website_post_categories (
 category_key VARCHAR(32) PRIMARY KEY, label VARCHAR(50) NOT NULL, artwork VARCHAR(180) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS website_posts (
 id CHAR(36) PRIMARY KEY, source_key VARCHAR(120) UNIQUE DEFAULT NULL,
 category VARCHAR(32) NOT NULL, title VARCHAR(120) NOT NULL, body TEXT NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'draft', author_id VARCHAR(200) NOT NULL,
 created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, published_at BIGINT DEFAULT NULL,
 version INTEGER NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS website_settings (
 setting_key VARCHAR(64) PRIMARY KEY, setting_value TEXT NOT NULL, updated_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS moderation_ticket_links (
 ban_key VARCHAR(120) PRIMARY KEY, ticket_id CHAR(36) NOT NULL, actor_id CHAR(36) NOT NULL,
 updated_at BIGINT NOT NULL, FOREIGN KEY(ticket_id) REFERENCES support_tickets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS moderation_bans (
 id CHAR(36) PRIMARY KEY, source_key VARCHAR(180) UNIQUE NOT NULL, native_key VARCHAR(120) NOT NULL,
 minecraft_uuid CHAR(36) NOT NULL, player_name VARCHAR(40) NOT NULL, banned_by VARCHAR(120) NOT NULL,
 reason TEXT NOT NULL, scope VARCHAR(32) NOT NULL, created_text VARCHAR(80) NOT NULL,
 expires_text VARCHAR(80) NOT NULL, active INTEGER NOT NULL DEFAULT 1, first_seen BIGINT NOT NULL,
 updated_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS moderation_appeals (
 id CHAR(36) PRIMARY KEY, ban_id CHAR(36) NOT NULL, ticket_id CHAR(36) NOT NULL UNIQUE,
 status VARCHAR(16) NOT NULL DEFAULT 'pending', ban_snapshot TEXT NOT NULL, opened_at BIGINT NOT NULL,
 decision_reason TEXT DEFAULT NULL, decided_by VARCHAR(40) DEFAULT NULL, decided_at BIGINT DEFAULT NULL,
 FOREIGN KEY(ban_id) REFERENCES moderation_bans(id), FOREIGN KEY(ticket_id) REFERENCES support_tickets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS moderation_events (
 id CHAR(36) PRIMARY KEY, ban_id CHAR(36) NOT NULL, actor_id VARCHAR(200) NOT NULL,
 action VARCHAR(32) NOT NULL, reason TEXT NOT NULL, snapshot TEXT NOT NULL, created_at BIGINT NOT NULL,
 FOREIGN KEY(ban_id) REFERENCES moderation_bans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS moderation_evidence (
 id CHAR(36) PRIMARY KEY, ban_id CHAR(36) NOT NULL, kind VARCHAR(16) NOT NULL,
 label VARCHAR(120) NOT NULL, file_name VARCHAR(120) DEFAULT NULL, mime VARCHAR(64) DEFAULT NULL,
 file_key VARCHAR(80) DEFAULT NULL, link_url TEXT DEFAULT NULL, sha256 CHAR(64) DEFAULT NULL,
 actor_id CHAR(36) NOT NULL, created_at BIGINT NOT NULL,
 FOREIGN KEY(ban_id) REFERENCES moderation_bans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS site_profiles (
 user_id CHAR(36) PRIMARY KEY, bio VARCHAR(1000) NOT NULL DEFAULT '', birthday CHAR(10) DEFAULT NULL,
 public_birthday INTEGER NOT NULL DEFAULT 0, public_info VARCHAR(500) NOT NULL DEFAULT '',
 socials_json TEXT NOT NULL, avatar_key CHAR(36) DEFAULT NULL, avatar_mime VARCHAR(32) DEFAULT NULL,
 updated_at BIGINT NOT NULL, FOREIGN KEY(user_id) REFERENCES site_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS native_ban_appeals (
 id CHAR(36) PRIMARY KEY,ban_id CHAR(36) NOT NULL,ticket_id BIGINT UNSIGNED NOT NULL UNIQUE,
 user_id CHAR(36) NOT NULL,status VARCHAR(16) NOT NULL DEFAULT 'pending',ban_snapshot TEXT NOT NULL,
 opened_at BIGINT NOT NULL,decision_reason TEXT DEFAULT NULL,decided_by CHAR(36) DEFAULT NULL,decided_at BIGINT DEFAULT NULL,
 FOREIGN KEY(ban_id) REFERENCES moderation_bans(id),FOREIGN KEY(user_id) REFERENCES site_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS site_age_declarations (user_id CHAR(36) PRIMARY KEY,age_band VARCHAR(12) NOT NULL,declared_at BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS site_account_policies(user_id CHAR(36) PRIMARY KEY,service_uuid CHAR(36) NOT NULL UNIQUE,game_link_exempt TINYINT NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cp_account_ranks (user_id VARCHAR(36) NOT NULL, rank_key VARCHAR(40) NOT NULL, PRIMARY KEY(user_id,rank_key));

CREATE TABLE IF NOT EXISTS website_badges (user_id VARCHAR(36) NOT NULL,badge_key VARCHAR(48) NOT NULL,earned_at BIGINT NOT NULL,PRIMARY KEY(user_id,badge_key));
CREATE TABLE IF NOT EXISTS season_rewards (minecraft_uuid CHAR(36) NOT NULL,season_key VARCHAR(48) NOT NULL,personal_code VARCHAR(48) NOT NULL UNIQUE,receipt CHAR(64) NOT NULL UNIQUE,amount INT NOT NULL,issued_at BIGINT NOT NULL,delivered_at BIGINT DEFAULT NULL,PRIMARY KEY(minecraft_uuid,season_key));

CREATE TABLE IF NOT EXISTS native_sync_outbox (job_key VARCHAR(32) PRIMARY KEY, revision CHAR(36) NOT NULL, attempts INTEGER NOT NULL, next_attempt_at BIGINT NOT NULL, lease_token CHAR(36) NOT NULL, lease_until BIGINT NOT NULL, created_at BIGINT NOT NULL, last_error VARCHAR(80) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS site_account_archive(user_id CHAR(36) PRIMARY KEY,role VARCHAR(40) NOT NULL,ranks_json TEXT NOT NULL,password_salt VARCHAR(64) NOT NULL,password_hash VARCHAR(256) NOT NULL,deleted_by CHAR(36) NOT NULL,deleted_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS site_honours(user_id CHAR(36) NOT NULL,rank_key VARCHAR(40) NOT NULL,citation TEXT NOT NULL,awarded_by CHAR(36) NOT NULL,updated_at BIGINT NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(user_id,rank_key));
CREATE TABLE IF NOT EXISTS site_memorials(slug VARCHAR(64) PRIMARY KEY,user_id CHAR(36) NOT NULL UNIQUE,title VARCHAR(120) NOT NULL,summary TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS site_condolences(id CHAR(36) PRIMARY KEY,memorial_slug VARCHAR(64) NOT NULL,user_id CHAR(36) NOT NULL,body TEXT NOT NULL,body_hash CHAR(64) NOT NULL,status VARCHAR(16) NOT NULL,created_at BIGINT NOT NULL,reviewed_by CHAR(36) NULL,reviewed_at BIGINT NULL,version INTEGER NOT NULL,UNIQUE(memorial_slug,user_id,body_hash));

CREATE TABLE IF NOT EXISTS site_first_login(user_id CHAR(36) PRIMARY KEY,password_changed INTEGER NOT NULL DEFAULT 0,created_at BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS site_terms_acceptances(user_id CHAR(36) NOT NULL,version VARCHAR(40) NOT NULL,accepted_at BIGINT NOT NULL,PRIMARY KEY(user_id,version)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
