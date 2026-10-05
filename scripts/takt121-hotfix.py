from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')

# Specialist avatar opens the main cabinet/More area; client avatar still opens Profile.
p='public/app-v2.js'; s=read(p)
old='<button class="account-button" data-page="more"'
new='<button class="account-button" data-page="${isClient()?\'profile\':\'more\'}"'
if old not in s: raise SystemExit('account avatar navigation marker missing')
s=s.replace(old,new,1)
write(p,s)

# First specialist start must ask the language before documents, exactly as the 12.1 product flow requires.
p='src/bot-entry.js'; s=read(p)
old="const labels={ru:['Выберите язык'"
new="const labels={ru:['На каком языке будем продолжать?'"
if old not in s: raise SystemExit('RU first-start language prompt marker missing')
s=s.replace(old,new,1)
old="az:['Dili seçin'"
new="az:['Hansı dildə davam edək?'"
if old not in s: raise SystemExit('AZ first-start language prompt marker missing')
s=s.replace(old,new,1)
write(p,s)

# Mark manually-created client notifications in delivery metadata. This lets the client confirm/cancel
# that specific specialist-created booking without opening the same action for ordinary self-bookings.
p='src/v3.js'; s=read(p)
old="return {text:lines.join('\\n'),parse_mode:'HTML',takt:{booking:b.id,company:b.company_id,start:b.starts_at,event,admin,lang,previous}};"
new="return {text:lines.join('\\n'),parse_mode:'HTML',takt:{booking:b.id,company:b.company_id,start:b.starts_at,event,admin,lang,previous,manual:b.manual===true}};"
if old not in s: raise SystemExit('messagePayload metadata marker missing')
s=s.replace(old,new,1)
write(p,s)

# A pending manually-added Telegram client can still connect much later, but not forever:
# keep a one-year safety window to reduce username-recycling risk. The user must still explicitly confirm the claim.
p='src/worker.js'; s=read(p)
old="WHERE mc.claimed_at IS NULL AND lower(mc.username)=? AND b.user_id LIKE 'manual-%' AND b.starts_at>? ORDER BY mc.created_at DESC LIMIT 1`).bind(handle,now()-86400).first()"
new="WHERE mc.claimed_at IS NULL AND lower(mc.username)=? AND b.user_id LIKE 'manual-%' AND mc.created_at>? ORDER BY mc.created_at DESC LIMIT 1`).bind(handle,now()-365*86400).first()"
if old not in s: raise SystemExit('pending manual claim window marker missing')
s=s.replace(old,new,1)

# When a claimed manual booking is attached to the real Telegram account, preserve the manual marker
# so its first client notification contains Confirm / Cancel / Open Takt.
old="messagePayload(booking,c,'created',false,null,lang)"
new="messagePayload({...booking,manual:true},c,'created',false,null,lang)"
if old not in s: raise SystemExit('manual claim notification marker missing')
s=s.replace(old,new,1)

# The normal manual-booking path also marks the initial client notification as manual.
old="...await notices(db,booking,'created'),"
new="...await notices(db,{...booking,manual:!!b.manual},'created'),"
if old not in s: raise SystemExit('manual booking notice marker missing')
s=s.replace(old,new,1)

# Client-side confirmation/cancellation for specialist-created pending bookings.
# Authorization is backend-enforced and additionally requires a queued manual notification marker,
# preventing an ordinary self-booking from forging this callback and bypassing normal cancellation rules.
marker="  const visit=cb.data.match(/^visit:"
if marker not in s: raise SystemExit('visit callback insertion marker missing')
client_cb=r'''  const clientBooking=cb.data.match(/^clientbooking:([a-z0-9-]+):(confirm|decline)$/);if(clientBooking){const callbackLang=await languageOf(env.DB,String(cb.from.id)),A=callbackLang==='az'?{confirmed:'Qeyd təsdiqləndi ✅',declined:'Qeyd ləğv edildi',failed:'Qeydi dəyişmək mümkün olmadı'}:{confirmed:'Запись подтверждена ✅',declined:'Запись отменена',failed:'Не удалось изменить запись'};try{const userId=String(cb.from.id),b=await env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(clientBooking[1]).first();if(!b)fail(404,A.failed);if(String(b.user_id)!==userId)fail(403,A.failed);const manualNotice=await env.DB.prepare("SELECT 1 FROM outbox WHERE chat_id=? AND json_valid(text) AND json_extract(text,'$.takt.booking')=? AND json_extract(text,'$.takt.manual')=1 LIMIT 1").bind(userId,b.id).first();if(!manualNotice)fail(403,A.failed);if(b.status!=='pending')fail(409,A.failed);const status=clientBooking[2]==='confirm'?'confirmed':'cancelled',eventId=crypto.randomUUID(),ops=[env.DB.prepare('UPDATE bookings SET status=?,status_event=? WHERE id=? AND status=?').bind(status,eventId,b.id,'pending'),...await notices(env.DB,{...b,status},status,[b.id,eventId])];if(status==='cancelled')ops.push(env.DB.prepare('DELETE FROM outbox WHERE id LIKE ? AND sent_at IS NULL').bind(b.id+':%reminder%'));const result=await env.DB.batch(ops);if(!result[0].meta.changes)fail(409,A.failed);await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:status==='confirmed'?A.confirmed:A.declined});await deliver(env);}catch(e){await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:callbackLang==='az'?A.failed:(e.message||A.failed),show_alert:true}).catch(()=>{});}return json({ok:true})}
'''
s=s.replace(marker,client_cb+marker,1)

# Only RU/AZ document rendering is public in 12.1 as well.
old="const u=new URL(req.url),lang=['ru','kk','az','uz'].includes(u.searchParams.get('lang'))?u.searchParams.get('lang'):'ru'"
new="const u=new URL(req.url),lang=APP_LANGS.includes(u.searchParams.get('lang'))?u.searchParams.get('lang'):'ru'"
if old not in s: raise SystemExit('document language marker missing')
s=s.replace(old,new,1)
write(p,s)

# Takt 12.1 only exposes RU/AZ. Clamp legacy stored languages during Telegram delivery too,
# including messages already waiting in the outbox from an older version.
p='src/delivery.js'; s=read(p)
old="const deliveryCopy=lang=>DELIVERY_COPY[lang]||DELIVERY_COPY.ru;"
new="const supportedLang=lang=>lang==='az'?'az':'ru';\nconst deliveryCopy=lang=>DELIVERY_COPY[supportedLang(lang)];"
if old not in s: raise SystemExit('delivery copy marker missing')
s=s.replace(old,new,1)
old="const id=`${b.id}:${event.key}:${b.starts_at}${event.admin?':'+b.recipient:''}`,lang=(await db.prepare(\"SELECT language FROM user_app_settings WHERE user_id=?\").bind(String(b.recipient)).first())?.language||'ru';"
new="const id=`${b.id}:${event.key}:${b.starts_at}${event.admin?':'+b.recipient:''}`,lang=supportedLang((await db.prepare(\"SELECT language FROM user_app_settings WHERE user_id=?\").bind(String(b.recipient)).first())?.language);"
if old not in s: raise SystemExit('reminder language marker missing')
s=s.replace(old,new,1)
old="const base=env.APP_URL||'https://takt.teymurstudent.workers.dev';for(const member of members){const lang=(await db.prepare('SELECT language FROM user_app_settings WHERE user_id=?').bind(String(member.user_id)).first())?.language||'ru',L=deliveryCopy(lang),button="
new="const base=env.APP_URL||'https://takt.teymurstudent.workers.dev';for(const member of members){const lang=supportedLang((await db.prepare('SELECT language FROM user_app_settings WHERE user_id=?').bind(String(member.user_id)).first())?.language),L=deliveryCopy(lang),button="
if old not in s: raise SystemExit('summary language marker missing')
s=s.replace(old,new,1)
old="const summary=payload.takt_summary;delete payload.takt_summary;if(summary){"
new="const summary=payload.takt_summary;delete payload.takt_summary;const queuedMeta=payload.takt;if(queuedMeta)queuedMeta.lang=supportedLang(queuedMeta.lang);if(summary){"
if old not in s: raise SystemExit('queued metadata language marker missing')
s=s.replace(old,new,1)

# Specialist-created bookings get exactly the requested client actions. Ordinary self-bookings do not.
old="else if(!meta.admin&&meta.event==='created'&&b.status==='confirmed'){payload.reply_markup={inline_keyboard:[[{text:L.confirm,style:'success',callback_data:`visit:${b.id}:yes:${b.starts_at}`},{text:L.cancel,style:'danger',callback_data:`visit:${b.id}:no:${b.starts_at}`}],[{text:L.open,style:'primary',web_app:{url:make()}}]]}}"
new="else if(!meta.admin&&meta.event==='created'&&meta.manual&&b.status==='pending'){payload.reply_markup={inline_keyboard:[[{text:L.confirm,style:'success',callback_data:`clientbooking:${b.id}:confirm`},{text:L.cancel,style:'danger',callback_data:`clientbooking:${b.id}:decline`}],[{text:L.open,style:'primary',web_app:{url:make()}}]]}}\nelse if(!meta.admin&&meta.event==='created'&&meta.manual&&b.status==='confirmed'){payload.reply_markup={inline_keyboard:[[{text:L.confirm,style:'success',callback_data:`visit:${b.id}:yes:${b.starts_at}`},{text:L.cancel,style:'danger',callback_data:`visit:${b.id}:no:${b.starts_at}`}],[{text:L.open,style:'primary',web_app:{url:make()}}]]}}"
if old not in s: raise SystemExit('manual booking delivery action marker missing')
s=s.replace(old,new,1)
write(p,s)

p='test/v121.test.mjs'; s=read(p)
s += """

test('avatar navigation is role-aware',()=>{
 const app=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');
 assert.ok(app.includes('data-page="${isClient()?\\\'profile\\\':\\\'more\\\'}"'));
});

test('first specialist start asks language before documents and only RU/AZ are offered',()=>{
 const bot=fs.readFileSync(new URL('../src/bot-entry.js',import.meta.url),'utf8');
 assert.ok(bot.includes('На каком языке будем продолжать?'));
 assert.ok(bot.includes("const languageLabels={ru:'🇷🇺 Русский',az:'🇦🇿 Azərbaycan dili'}"));
});

test('pending manual Telegram claim remains available for delayed first start with safety expiry',()=>{
 const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 assert.ok(worker.includes("mc.created_at>? ORDER BY mc.created_at DESC LIMIT 1`).bind(handle,now()-365*86400)"));
});

test('specialist-created client booking uses protected client confirmation callbacks',()=>{
 const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 const delivery=fs.readFileSync(new URL('../src/delivery.js',import.meta.url),'utf8');
 const v3=fs.readFileSync(new URL('../src/v3.js',import.meta.url),'utf8');
 assert.ok(v3.includes('manual:b.manual===true'));
 assert.ok(worker.includes('clientbooking:([a-z0-9-]+):(confirm|decline)'));
 assert.ok(worker.includes("json_extract(text,'$.takt.manual')=1"));
 assert.ok(delivery.includes("meta.event==='created'&&meta.manual&&b.status==='pending'"));
 assert.ok(delivery.includes('callback_data:`clientbooking:${b.id}:confirm`'));
 assert.ok(delivery.includes('callback_data:`clientbooking:${b.id}:decline`'));
});

test('public document language is clamped to current RU/AZ product languages',()=>{
 const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 assert.ok(worker.includes("lang=APP_LANGS.includes(u.searchParams.get('lang'))?u.searchParams.get('lang'):'ru'"));
});

test('Telegram delivery clamps legacy languages to Russian or Azerbaijani',()=>{
 const delivery=fs.readFileSync(new URL('../src/delivery.js',import.meta.url),'utf8');
 assert.ok(delivery.includes("const supportedLang=lang=>lang==='az'?'az':'ru'"));
 assert.ok(delivery.includes('if(queuedMeta)queuedMeta.lang=supportedLang(queuedMeta.lang)'));
});
"""
write(p,s)
print('Takt 12.1 final hotfixes applied')
