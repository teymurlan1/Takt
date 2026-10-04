-- Takt 6.0: visit confirmations and specialist trial/subscription state.
CREATE TABLE IF NOT EXISTS booking_attendance(
  booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'unknown' CHECK(state IN ('unknown','coming','not_coming')),
  responded_at INTEGER
);
CREATE INDEX IF NOT EXISTS booking_attendance_state ON booking_attendance(state,responded_at);

CREATE TABLE IF NOT EXISTS subscriptions(
  company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  trial_started_at INTEGER NOT NULL,
  trial_ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial' CHECK(status IN ('trial','active','expired','grace')),
  paid_until INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS subscriptions_status ON subscriptions(status,trial_ends_at,paid_until);
