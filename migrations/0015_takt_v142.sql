-- Takt 14.0 (additive only): waitlist, client flags, review replies, templates, portfolio, rebook notices.
CREATE TABLE IF NOT EXISTS waitlist (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), service_id TEXT NOT NULL, user_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','notified','booked','cancelled')), created_at INTEGER NOT NULL, notified_at INTEGER, UNIQUE(company_id, service_id, user_id, date));
CREATE INDEX IF NOT EXISTS waitlist_open ON waitlist(status, date);
CREATE TABLE IF NOT EXISTS client_flags (company_id TEXT NOT NULL REFERENCES companies(id), client_id TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, tag TEXT NOT NULL DEFAULT '', birthday TEXT NOT NULL DEFAULT '', PRIMARY KEY(company_id, client_id));
CREATE TABLE IF NOT EXISTS review_replies (booking_id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), text TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS message_templates (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), title TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS portfolio_photos (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), position INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS portfolio_company ON portfolio_photos(company_id, position);
CREATE TABLE IF NOT EXISTS rebook_notices (company_id TEXT NOT NULL, user_id TEXT NOT NULL, last_visit INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(company_id, user_id, last_visit));
INSERT OR IGNORE INTO schema_versions(version) VALUES (142);
