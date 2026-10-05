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

# Manual claim notification inherits specialist language for a brand-new client,
# while an existing client keeps their own already-selected language.
p='src/worker.js'; s=read(p)
old="const booking=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first(),c=await company(db,claim.company_id),lang=await languageOf(db,userId);await queue(db,`manual-claim:${bookingId}:${userId}`,userId,JSON.stringify(await applyNotificationText(db,messagePayload(booking,c,'created',false,null,lang)))).run();return {company:c,booking}}"
new="const booking=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first(),c=await company(db,claim.company_id),prefs=await appSetting(db,userId),owner=await db.prepare('SELECT s.language FROM memberships m LEFT JOIN user_app_settings s ON s.user_id=m.user_id WHERE m.company_id=? ORDER BY m.rowid LIMIT 1').bind(claim.company_id).first(),lang=APP_LANGS.includes(prefs?.language)?prefs.language:APP_LANGS.includes(owner?.language)?owner.language:'ru';await queue(db,`manual-claim:${bookingId}:${userId}`,userId,JSON.stringify(await applyNotificationText(db,messagePayload(booking,c,'created',false,null,lang)))).run();return {company:c,booking,lang}}"
if old not in s: raise SystemExit('manual claim language marker missing')
s=s.replace(old,new,1)
old="await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:'Готово ✅'});await deliver(env).catch(()=>{});return json({method:'editMessageText',chat_id:cb.from.id,message_id:cb.message?.message_id,...await botEntry(env,new URL(req.url).origin,String(cb.from.id),claimed.company)})"
new="await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:claimed.lang==='az'?'Hazırdır ✅':'Готово ✅'});await deliver(env).catch(()=>{});return json({method:'editMessageText',chat_id:cb.from.id,message_id:cb.message?.message_id,...await botEntry(env,new URL(req.url).origin,String(cb.from.id),claimed.company)})"
if old not in s: raise SystemExit('manual claim success marker missing')
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

test('new manual client claim inherits specialist language until client chooses their own',()=>{
 const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 assert.ok(worker.includes("APP_LANGS.includes(prefs?.language)?prefs.language:APP_LANGS.includes(owner?.language)?owner.language:'ru'"));
 assert.ok(worker.includes("claimed.lang==='az'?'Hazırdır ✅':'Готово ✅'"));
});
"""
write(p,s)
print('Takt 12.1 final safeguards applied')
