CREATE TABLE IF NOT EXISTS entity_translations (entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, company_id TEXT NOT NULL REFERENCES companies(id), language TEXT NOT NULL, values_json TEXT NOT NULL, PRIMARY KEY(entity_type,entity_id,language));
INSERT OR IGNORE INTO schema_versions(version) VALUES (12);
