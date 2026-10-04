-- Additive operational metadata. Preserve all existing accounts and appointments.
CREATE TABLE IF NOT EXISTS registrations(company_id TEXT PRIMARY KEY REFERENCES companies(id),created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS telegram_contacts(user_id TEXT PRIMARY KEY,state TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS task_runs(name TEXT PRIMARY KEY,started_at INTEGER NOT NULL,finished_at INTEGER,state TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS operational_errors(id TEXT PRIMARY KEY,kind TEXT NOT NULL,code TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox(sent_at,attempts,lease_until,created_at);
CREATE INDEX IF NOT EXISTS errors_created ON operational_errors(created_at);
CREATE TABLE IF NOT EXISTS account_activity(user_id TEXT PRIMARY KEY,first_seen INTEGER NOT NULL,last_seen INTEGER NOT NULL);
