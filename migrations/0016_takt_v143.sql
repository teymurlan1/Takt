-- Takt 14.0 (additive only): editable bot texts with version history.
CREATE TABLE IF NOT EXISTS bot_texts (key TEXT NOT NULL, lang TEXT NOT NULL, text TEXT NOT NULL, version INTEGER NOT NULL, updated_by TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(key, lang));
CREATE TABLE IF NOT EXISTS bot_text_history (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, lang TEXT NOT NULL, text TEXT NOT NULL, version INTEGER NOT NULL, actor TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS bot_text_history_key ON bot_text_history(key, lang, id DESC);
INSERT OR IGNORE INTO schema_versions(version) VALUES (143);
