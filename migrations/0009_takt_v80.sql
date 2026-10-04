-- Takt 8.0: first-run preferences/consents and editable review request message.
CREATE TABLE IF NOT EXISTS user_app_settings(
  user_id TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'system',
  policy_version TEXT NOT NULL DEFAULT '',
  consent_version TEXT NOT NULL DEFAULT '',
  terms_version TEXT NOT NULL DEFAULT '',
  consent_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS telegram_review_messages(
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(booking_id,chat_id)
);
