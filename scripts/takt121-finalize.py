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
old="async function languageOf(db,userId){return (await appSetting(db,userId))?.language||'ru'}"
new="async function languageOf(db,userId){const lang=(await appSetting(db,userId))?.language||'ru';return APP_LANGS.includes(lang)?lang:'ru'}"
if old not in s: raise SystemExit('languageOf marker missing')
s=s.replace(old,new,1)
old="const booking=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first(),c=await company(db,claim.company_id),lang=await languageOf(db,userId);await queue(db,`manual-claim:${bookingId}:${userId}`,userId,JSON.stringify(await applyNotificationText(db,messagePayload(booking,c,'created',false,null,lang)))).run();return {company:c,booking}}"
new="const booking=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first(),c=await company(db,claim.company_id),prefs=await appSetting(db,userId),owner=await db.prepare('SELECT s.language FROM memberships m LEFT JOIN user_app_settings s ON s.user_id=m.user_id WHERE m.company_id=? ORDER BY m.rowid LIMIT 1').bind(claim.company_id).first(),lang=APP_LANGS.includes(prefs?.language)?prefs.language:APP_LANGS.includes(owner?.language)?owner.language:'ru';await queue(db,`manual-claim:${bookingId}:${userId}`,userId,JSON.stringify(await applyNotificationText(db,messagePayload(booking,c,'created',false,null,lang)))).run();return {company:c,booking,lang}}"
if old not in s: raise SystemExit('manual claim language marker missing')
s=s.replace(old,new,1)
old="await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:'Готово ✅'});await deliver(env).catch(()=>{});return json({method:'editMessageText',chat_id:cb.from.id,message_id:cb.message?.message_id,...await botEntry(env,new URL(req.url).origin,String(cb.from.id),claimed.company)})"
new="await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:claimed.lang==='az'?'Hazırdır ✅':'Готово ✅'});await deliver(env).catch(()=>{});return json({method:'editMessageText',chat_id:cb.from.id,message_id:cb.message?.message_id,...await botEntry(env,new URL(req.url).origin,String(cb.from.id),claimed.company)})"
if old not in s: raise SystemExit('manual claim success marker missing')
s=s.replace(old,new,1)
old="if(req.method==='GET'){const x=existing||{};return json({language:x.language||'',role:x.role||inferred||'',theme:x.theme||'light'"
new="if(req.method==='GET'){const x=existing||{};return json({language:APP_LANGS.includes(x.language)?x.language:'',role:x.role||inferred||'',theme:x.theme||'light'"
if old not in s: raise SystemExit('profile language GET marker missing')
s=s.replace(old,new,1)
# Never trust a Telegram username alone to bind a manual booking to an old numeric account.
a="else if(b.manual&&manualUsername){const linked=await db.prepare(\"SELECT p.user_id FROM telegram_profiles p JOIN client_links l ON l.user_id=p.user_id AND l.company_id=? WHERE lower(p.username)=? ORDER BY l.last_seen DESC LIMIT 1\").bind(c.id,manualUsername).first();if(linked?.user_id)bookingUser=String(linked.user_id)}"
if a not in s: raise SystemExit('unsafe username auto-link marker missing')
s=s.replace(a,'',1)
# Localize callback feedback in Telegram itself, not only message/button copy.
old="const visit=cb.data.match(/^visit:([a-z0-9-]+):(yes|no)(?::([0-9]+))?$/);if(visit){try{"
new="const visit=cb.data.match(/^visit:([a-z0-9-]+):(yes|no)(?::([0-9]+))?$/);if(visit){const callbackLang=await languageOf(env.DB,String(cb.from.id)),A=callbackLang==='az'?{yes:'✅ Gəlişi təsdiqlədiniz',late:'⚠️ Gələ bilməyəcəyinizi bildirdiniz. Mütəxəssis xəbərdar edildi.',cancel:'❌ Qeyd ləğv edildi',thanks:'Təşəkkürlər, görüş təsdiqləndi ✅',notified:'Mütəxəssis xəbərdar edildi',failed:'Cavabı yadda saxlamaq mümkün olmadı'}:{yes:'✅ Вы подтвердили визит',late:'⚠️ Вы сообщили, что не сможете прийти. Специалист уведомлён.',cancel:'❌ Запись отменена',thanks:'Спасибо, визит подтверждён ✅',notified:'Специалист уведомлён',failed:'Не удалось сохранить ответ'};try{"
if old not in s: raise SystemExit('visit callback marker missing')
s=s.replace(old,new,1)
old="feedback=result.attendance_state==='coming'?'✅ Вы подтвердили визит':result.late?'⚠️ Вы сообщили, что не сможете прийти. Специалист уведомлён.':'❌ Запись отменена';await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:result.attendance_state==='coming'?'Спасибо, визит подтверждён ✅':result.late?'Специалист уведомлён':'Запись отменена'});"
new="feedback=result.attendance_state==='coming'?A.yes:result.late?A.late:A.cancel;await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:result.attendance_state==='coming'?A.thanks:result.late?A.notified:A.cancel});"
if old not in s: raise SystemExit('visit feedback marker missing')
s=s.replace(old,new,1)
old="await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:e.message||'Не удалось сохранить ответ',show_alert:true}).catch(()=>{});"
new="await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:callbackLang==='az'?A.failed:(e.message||A.failed),show_alert:true}).catch(()=>{});"
if old not in s: raise SystemExit('visit error marker missing')
s=s.replace(old,new,1)
old="const action=cb.data.match(/^booking:([a-z0-9-]+):(confirm|decline)$/);if(action){try{"
new="const action=cb.data.match(/^booking:([a-z0-9-]+):(confirm|decline)$/);if(action){const callbackLang=await languageOf(env.DB,String(cb.from.id)),A=callbackLang==='az'?{confirmed:'Qeyd təsdiqləndi ✅',declined:'Qeyd rədd edildi',failed:'Qeydi dəyişmək mümkün olmadı'}:{confirmed:'Запись подтверждена ✅',declined:'Запись отклонена',failed:'Не удалось изменить запись'};try{"
if old not in s: raise SystemExit('booking callback marker missing')
s=s.replace(old,new,1)
old="await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:status==='confirmed'?'Запись подтверждена ✅':'Запись отклонена'});"
new="await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:status==='confirmed'?A.confirmed:A.declined});"
if old not in s: raise SystemExit('booking feedback marker missing')
s=s.replace(old,new,1)
old="await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:e.message||'Не удалось изменить запись',show_alert:true}).catch(()=>{});"
new="await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:callbackLang==='az'?A.failed:(e.message||A.failed),show_alert:true}).catch(()=>{});"
if old not in s: raise SystemExit('booking error marker missing')
s=s.replace(old,new,1)
write(p,s)

# A manually-created confirmed booking lets the client confirm/cancel and open Takt.
p='src/delivery.js'; s=read(p)
old="else if(meta.admin&&meta.event==='created'&&b.status==='pending'){payload.reply_markup={inline_keyboard:[[{text:L.confirm,style:'success',callback_data:`booking:${b.id}:confirm`},{text:L.decline,style:'danger',callback_data:`booking:${b.id}:decline`}],[{text:L.booking,style:'primary',web_app:{url:make()}}]]}}\nelse{payload.reply_markup={inline_keyboard:[[{text:meta.event==='cancelled'&&!meta.admin?L.other:meta.admin||reminder?L.booking:L.mine,style:'primary',web_app:{url:meta.event==='cancelled'&&!meta.admin?new URL('/?company='+b.company_id,env.APP_URL||'https://takt.teymurstudent.workers.dev').href:make()}}]]};"
new="else if(meta.admin&&meta.event==='created'&&b.status==='pending'){payload.reply_markup={inline_keyboard:[[{text:L.confirm,style:'success',callback_data:`booking:${b.id}:confirm`},{text:L.decline,style:'danger',callback_data:`booking:${b.id}:decline`}],[{text:L.booking,style:'primary',web_app:{url:make()}}]]}}\nelse if(!meta.admin&&meta.event==='created'&&b.status==='confirmed'){payload.reply_markup={inline_keyboard:[[{text:L.confirm,style:'success',callback_data:`visit:${b.id}:yes:${b.starts_at}`},{text:L.cancel,style:'danger',callback_data:`visit:${b.id}:no:${b.starts_at}`}],[{text:L.open,style:'primary',web_app:{url:make()}}]]}}\nelse{payload.reply_markup={inline_keyboard:[[{text:meta.event==='cancelled'&&!meta.admin?L.other:meta.admin||reminder?L.booking:L.mine,style:'primary',web_app:{url:meta.event==='cancelled'&&!meta.admin?new URL('/?company='+b.company_id,env.APP_URL||'https://takt.teymurstudent.workers.dev').href:make()}}]]};"
if old not in s: raise SystemExit('delivery manual confirmation marker missing')
s=s.replace(old,new,1)
write(p,s)

# Visible version label follows the release.
p='public/app-v2.js'; s=read(p).replace('Takt 12.0</strong><span>Версия приложения','Takt 12.1</strong><span>Версия приложения')
write(p,s)

# Strengthen 12.1 regression checks.
p='test/v121.test.mjs'; s=read(p)
s += """

test('stored legacy language config is clamped by current RU/AZ contract',()=>{
 const source=fs.readFileSync(new URL('../src/v10.js',import.meta.url),'utf8');
 const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 assert.ok(source.includes("c.languages.filter(l=>LANGS.includes(l))"));
 assert.ok(worker.includes("language:APP_LANGS.includes(x.language)?x.language:''"));
 assert.ok(worker.includes("return APP_LANGS.includes(lang)?lang:'ru'"));
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

test('manual booking username is never auto-linked by username alone',()=>{
 const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 assert.equal(worker.includes('JOIN client_links l ON l.user_id=p.user_id AND l.company_id=? WHERE lower(p.username)=?'),false);
 assert.ok(worker.includes('manual_client_claims'));
});

test('manually created client notification offers confirm cancel and open Takt',()=>{
 const delivery=fs.readFileSync(new URL('../src/delivery.js',import.meta.url),'utf8');
 assert.ok(delivery.includes("!meta.admin&&meta.event==='created'&&b.status==='confirmed'"));
 assert.ok(delivery.includes('callback_data:`visit:${b.id}:yes:${b.starts_at}`'));
 assert.ok(delivery.includes('callback_data:`visit:${b.id}:no:${b.starts_at}`'));
 assert.ok(delivery.includes('text:L.open'));
});

test('Telegram action feedback is localized for Azerbaijani',()=>{
 const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 assert.ok(worker.includes('Təşəkkürlər, görüş təsdiqləndi ✅'));
 assert.ok(worker.includes('Qeyd təsdiqləndi ✅'));
 assert.ok(worker.includes('Mütəxəssis xəbərdar edildi'));
});
"""
write(p,s)
print('Takt 12.1 final safeguards applied')
