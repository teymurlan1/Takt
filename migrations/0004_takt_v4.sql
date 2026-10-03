-- Additive delivery tracking; existing bookings and settings are preserved.
CREATE TABLE IF NOT EXISTS delivery_state(id TEXT PRIMARY KEY REFERENCES outbox(id) ON DELETE CASCADE,state TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS telegram_updates(id INTEGER PRIMARY KEY,created_at INTEGER NOT NULL);
