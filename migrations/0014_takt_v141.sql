-- Takt 14.0 (additive only): payments seam, referrals, subscription notice dedupe.
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), amount INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'RUB', status TEXT NOT NULL CHECK(status IN ('pending','paid','failed','refunded','manual','bonus')), provider TEXT NOT NULL DEFAULT 'manual', provider_ref TEXT, days INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS payments_company_time ON payments(company_id, created_at DESC);
CREATE TABLE IF NOT EXISTS referrals (referred_company TEXT PRIMARY KEY REFERENCES companies(id), referrer_company TEXT NOT NULL REFERENCES companies(id), bonus_days INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS referrals_referrer ON referrals(referrer_company);
CREATE TABLE IF NOT EXISTS subscription_notices (company_id TEXT NOT NULL, kind INTEGER NOT NULL, period_end INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(company_id, kind, period_end));
INSERT OR IGNORE INTO schema_versions(version) VALUES (141);
