-- Takt 7.0: verified reviews and one live Telegram booking message per recipient.
CREATE TABLE IF NOT EXISTS reviews(
  booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_company_time ON reviews(company_id,created_at DESC);

CREATE TABLE IF NOT EXISTS telegram_booking_messages(
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(booking_id,chat_id)
);
