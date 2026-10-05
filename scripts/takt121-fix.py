from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def once(p,a,b):
    s=read(p)
    if a not in s: raise SystemExit(f'pattern missing: {p}: {a[:100]!r}')
    write(p,s.replace(a,b,1))

# Keep historical schema version 12. Takt 12.1 adds only idempotent additive tables.
p='src/v2.js'; s=read(p)
s=s.replace('export const schema13=[','export const schema121=[')
s=s.replace('...schema11,...schema12,...schema13\n];','...schema11,...schema12,...schema121\n];')
start=s.index('export async function ensureSchema(db){')
end=s.index('const err=',start)
ensure="""export async function ensureSchema(db){if(!initialized.has(db))initialized.set(db,(async()=>{await db.prepare('CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY)').run();await db.batch(schema121.map(sql=>db.prepare(sql)));if(await db.prepare('SELECT 1 FROM schema_versions WHERE version=12').first())return;const current=await db.prepare('SELECT 1 FROM schema_versions WHERE version=11').first();const previous=await db.prepare('SELECT 1 FROM schema_versions WHERE version IN (9,10)').first();await db.batch([...(current?schema12:previous?[...schema10,...schema11,...schema12]:schema).map(sql=>db.prepare(sql)),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(11)'),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(12)')])})().catch(e=>{initialized.delete(db);throw e}));await initialized.get(db)}\n"""
s=s[:start]+ensure+s[end:]
write(p,s)

# Product scope changed in 12.1: only RU + AZ are selectable now.
p='test/v8.test.mjs'; s=read(p)
s=s.replace("test('8.0 supports Russian Kazakh Azerbaijani and Uzbek',()=>{for(const code of [\"'ru'\",\"'kk'\",\"'az'\",\"'uz'\"])assert.match(i18n,new RegExp(code));assert.match(app,/languageControl/)});","test('12.1 exposes Russian and Azerbaijani as the selectable product languages',()=>{assert.match(i18n,/LANGUAGES=\\[\\['ru'/);assert.match(i18n,/\\['az'/);assert.doesNotMatch(i18n,/LANGUAGES=.*'kk'/);assert.doesNotMatch(i18n,/LANGUAGES=.*'uz'/);assert.match(app,/languageControl/)});")
write(p,s)

p='test/v81.test.mjs'; s=read(p)
s=s.replace("assert.equal(pkg.version,'12.0.0')","assert.equal(pkg.version,'12.1.0')")
s=s.replace("/version:'12\\.0\\.0'/","/version:'12\\.1\\.0'/")
write(p,s)

# UI release matrix follows the currently selectable languages.
p='scripts/ui-regression.mjs'; s=read(p)
s=s.replace("for(const lang of ['ru','kk','az','uz'])","for(const lang of ['ru','az'])")
write(p,s)

# Keep lockfile metadata aligned with package version.
p='package-lock.json'; s=read(p)
s=s.replace('"version": "12.0.0"','"version": "12.1.0"',2)
write(p,s)

print('Takt 12.1 compatibility fixes applied')
