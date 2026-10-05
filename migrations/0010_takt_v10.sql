-- Takt 10: additive controls and audit; existing data is preserved.
CREATE TABLE IF NOT EXISTS service_config(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL,updated_by TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,before_value TEXT NOT NULL,after_value TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS account_controls(user_id TEXT PRIMARY KEY,blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN (0,1)),updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS specialist_controls(company_id TEXT PRIMARY KEY REFERENCES companies(id),disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS bot_entry(user_id TEXT PRIMARY KEY,company_id TEXT,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS booking_outcomes(booking_id TEXT PRIMARY KEY REFERENCES bookings(id),outcome TEXT NOT NULL CHECK(outcome IN ('done','no_show')),updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_broadcasts(id TEXT PRIMARY KEY,actor TEXT NOT NULL,text TEXT NOT NULL,recipients TEXT NOT NULL,token TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'preview',created_at INTEGER NOT NULL,sent_at INTEGER);
CREATE TABLE IF NOT EXISTS api_limits(user_id TEXT NOT NULL,window INTEGER NOT NULL,n INTEGER NOT NULL,PRIMARY KEY(user_id,window));
CREATE TABLE IF NOT EXISTS booking_message_delivery(booking_id TEXT NOT NULL,chat_id TEXT NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,uncertain INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(booking_id,chat_id));
CREATE INDEX IF NOT EXISTS admin_audit_time ON admin_audit(created_at DESC);
