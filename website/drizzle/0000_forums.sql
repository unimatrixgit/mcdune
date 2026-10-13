CREATE TABLE forum_topics (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('help','gameplay','lore','feedback')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  closed INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX forum_topics_activity ON forum_topics(deleted,last_activity_at);
--> statement-breakpoint
CREATE INDEX forum_topics_author ON forum_topics(author_id,created_at);
--> statement-breakpoint
CREATE TABLE forum_posts (
  id TEXT PRIMARY KEY NOT NULL,
  topic_id TEXT NOT NULL REFERENCES forum_topics(id),
  body TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX forum_posts_topic ON forum_posts(topic_id,deleted,created_at);
--> statement-breakpoint
CREATE INDEX forum_posts_author ON forum_posts(author_id,created_at);
--> statement-breakpoint
CREATE TABLE forum_reports (
  id TEXT PRIMARY KEY NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('topic','post')),
  target_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  UNIQUE(target_type,target_id,reporter_id)
);
