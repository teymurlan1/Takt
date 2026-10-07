-- Takt 15.0 (additive only): client notification preferences.
CREATE TABLE IF NOT EXISTS client_prefs (user_id TEXT PRIMARY KEY, reminder_24h INTEGER NOT NULL DEFAULT 1, reminder_2h INTEGER NOT NULL DEFAULT 1, review INTEGER NOT NULL DEFAULT 1, rebook INTEGER NOT NULL DEFAULT 1, waitlist INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO schema_versions(version) VALUES (150);
