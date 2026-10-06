-- Takt 14.0 (additive only): support tickets handled in the bot chat.
CREATE TABLE IF NOT EXISTS support_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, company_id TEXT, role TEXT NOT NULL DEFAULT 'client', lang TEXT NOT NULL DEFAULT 'ru', plan TEXT NOT NULL DEFAULT '', message TEXT NOT NULL, photo_id TEXT, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','closed')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS support_tickets_user_time ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status ON support_tickets(status, created_at DESC);
CREATE TABLE IF NOT EXISTS support_state (user_id TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK(mode IN ('await_ticket','reply')), ticket_id INTEGER, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS support_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL REFERENCES support_tickets(id), admin_id TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL);
INSERT OR IGNORE INTO schema_versions(version) VALUES (14);
