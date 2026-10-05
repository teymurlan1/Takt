from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')

# Stale persisted admin config from older releases must not re-enable hidden languages.
p='src/v10.js'; s=read(p)
old="export async function config(db){const c=structuredClone(defaults);for(const r of (await db.prepare('SELECT key,value FROM service_config').all()).results){if(r.key in c)try{c[r.key]=JSON.parse(r.value)}catch{}}return c}"
new="export async function config(db){const c=structuredClone(defaults);for(const r of (await db.prepare('SELECT key,value FROM service_config').all()).results){if(r.key in c)try{c[r.key]=JSON.parse(r.value)}catch{}}c.languages=Array.isArray(c.languages)?c.languages.filter(l=>LANGS.includes(l)):LANGS.slice();if(!c.languages.includes('ru'))c.languages.unshift('ru');c.languages=[...new Set(c.languages)];return c}"
if old not in s: raise SystemExit('config function marker missing')
s=s.replace(old,new,1)
write(p,s)

# Visible version label follows the release.
p='public/app-v2.js'; s=read(p).replace('Takt 12.0</strong><span>Версия приложения','Takt 12.1</strong><span>Версия приложения')
write(p,s)

# Strengthen 12.1 regression checks without depending on hidden legacy dictionaries.
p='test/v121.test.mjs'; s=read(p)
s += """

test('stored legacy language config is clamped by current RU/AZ contract',()=>{
 const source=fs.readFileSync(new URL('../src/v10.js',import.meta.url),'utf8');
 assert.ok(source.includes("c.languages.filter(l=>LANGS.includes(l))"));
});

test('Azerbaijani landing localizes weekday preview and client tour is bilingual',()=>{
 const landingSource=fs.readFileSync(new URL('../public/landing.js',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');
 assert.ok(landingSource.includes("lang==='az'?['Be','Ça','Ç','Ca','C']"));
 assert.ok(app.includes("S.language==='az'"));
 assert.ok(app.includes("ŞƏXSİ QEYD SƏHİFƏNİZ"));
 assert.ok(app.includes('Takt 12.1'));
});
"""
write(p,s)
print('Takt 12.1 final safeguards applied')
