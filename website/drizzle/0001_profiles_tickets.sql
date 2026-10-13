CREATE TABLE player_profiles (
  user_id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  minecraft_name TEXT NOT NULL DEFAULT '',
  discord_name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE support_tickets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES player_profiles(user_id),
  category TEXT NOT NULL CHECK(category IN ('ban-appeal','staff-support')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','waiting_on_player','resolved','closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX support_tickets_owner ON support_tickets(user_id,updated_at);
--> statement-breakpoint
CREATE INDEX support_tickets_status ON support_tickets(status,updated_at);
--> statement-breakpoint
CREATE TABLE support_messages (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id),
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL CHECK(author_role IN ('player','staff','system')),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX support_messages_ticket ON support_messages(ticket_id,created_at);
--> statement-breakpoint
CREATE INDEX support_messages_author ON support_messages(author_id,created_at);
