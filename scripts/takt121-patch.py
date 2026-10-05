from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT/path).read_text(encoding='utf-8')

def write(path,text):
    (ROOT/path).write_text(text,encoding='utf-8')

def replace_once(path,old,new):
    text=read(path)
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]!r}')
    text=text.replace(old,new,1)
    write(path,text)

def replace_all(path,old,new):
    text=read(path)
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]!r}')
    write(path,text.replace(old,new))

def replace_between(path,start_marker,end_marker,new_block):
    text=read(path)
    start=text.find(start_marker)
    if start<0: raise SystemExit(f'start marker not found in {path}: {start_marker}')
    end=text.find(end_marker,start)
    if end<0: raise SystemExit(f'end marker not found in {path}: {end_marker}')
    write(path,text[:start]+new_block+text[end:])

# ---- version / cache ----
replace_once('package.json','"version": "12.0.0"','"version": "12.1.0"')
text=read('public/index.html').replace('?v=120','?v=121')
if '/takt-v121.css' not in text:
    text=text.replace('<link rel="stylesheet" href="/takt-v12.css?v=121">','<link rel="stylesheet" href="/takt-v12.css?v=121">\n<link rel="stylesheet" href="/takt-v121.css?v=121">')
write('public/index.html',text)

# ---- only Russian + Azerbaijani ----
replace_once('public/i18n.js',"import {copy12} from './copy-v12.js?v=120';","import {copy12} from './copy-v12.js?v=121';")
replace_once('public/i18n.js',"import {copy10} from './copy-v10.js?v=120';","import {copy10} from './copy-v10.js?v=121';")
replace_once('public/i18n.js',"export const LANGUAGES=[['ru','🇷🇺','Русский'],['kk','🇰🇿','Қазақша'],['az','🇦🇿','Azərbaycan dili'],['uz','🇺🇿','O‘zbekcha']];","export const LANGUAGES=[['ru','🇷🇺','Русский'],['az','🇦🇿','Azərbaycan dili']];")
replace_once('src/v10.js',"export const LANGS=['ru','kk','az','uz'];","export const LANGS=['ru','az'];")
replace_once('src/worker.js',"const APP_LANGS=['ru','kk','az','uz'];","const APP_LANGS=['ru','az'];")
replace_once('src/worker.js',"if(path==='/api/health')return json({ok:true,version:'12.0.0'});","if(path==='/api/health')return json({ok:true,version:'12.1.0'});")
replace_once('src/worker.js',"lang=['ru','kk','az','uz'].includes(u.searchParams.get('lang'))?u.searchParams.get('lang'):'ru'","lang=['ru','az'].includes(u.searchParams.get('lang'))?u.searchParams.get('lang'):'ru'")
replace_all('public/admin-v10.js','?v=120','?v=121')
replace_once('public/admin-v10.js',"const langs=[['ru','🇷🇺 Русский'],['kk','🇰🇿 Қазақша'],['az','🇦🇿 Azərbaycan dili'],['uz','🇺🇿 O‘zbekcha']];","const langs=[['ru','🇷🇺 Русский'],['az','🇦🇿 Azərbaycan dili']];")
replace_all('public/app-v2.js','?v=120','?v=121')

text=read('src/v11.js')
text=text.replace("!['ru','kk','az','uz'].includes(b.language)","!['ru','az'].includes(b.language)")
text=text.replace("!['kk','az','uz'].includes(b.language)","b.language!=='az'")
write('src/v11.js',text)

# ---- admin broadcast: specialists only, backend enforced twice ----
preview_send = r''' if(p==='/api/v10/admin/broadcast/preview'&&req.method==='POST'){const b=await h.body(req),message=clean(b.text,3500);if(!message)error(400,'Введите сообщение');let ids;
 if(b.audience==='specialists')ids=(await db.prepare("SELECT DISTINCT m.user_id FROM memberships m JOIN telegram_contacts t ON t.user_id=m.user_id WHERE t.state='allowed'").all()).results.map(r=>String(r.user_id));
 else if(b.audience==='selected'&&Array.isArray(b.ids)&&b.ids.length<=100){ids=[...new Set(b.ids.map(String))];if(!ids.length||ids.some(i=>!/^\d{1,20}$/.test(i)))error(400,'Проверьте получателей');const q=ids.map(()=>'?').join(','),n=(await db.prepare("SELECT COUNT(DISTINCT m.user_id) n FROM memberships m JOIN telegram_contacts t ON t.user_id=m.user_id WHERE t.state='allowed' AND m.user_id IN ("+q+")").bind(...ids).first()).n;if(Number(n)!==ids.length)error(400,'Рассылка разрешена только специалистам, которые активировали бота')}else error(400,'Рассылка доступна только специалистам');
 if(b.filters){const f=b.filters;if(f.language&&!LANGS.includes(f.language))error(400,'Проверьте язык');if(f.status&&!['active','trial','expiring'].includes(f.status))error(400,'Проверьте статус');if(f.registered_after&&(!Number.isInteger(f.registered_after)||f.registered_after<0))error(400,'Проверьте дату');const allowed=(await db.prepare(`SELECT DISTINCT m.user_id FROM memberships m LEFT JOIN subscriptions z ON z.company_id=m.company_id LEFT JOIN user_app_settings s ON s.user_id=m.user_id LEFT JOIN registrations r ON r.company_id=m.company_id WHERE (?='' OR s.language=?) AND (?=0 OR r.created_at>=?) AND (?='' OR ?='active' AND z.paid_until>unixepoch() OR ?='trial' AND z.trial_ends_at>unixepoch() AND COALESCE(z.paid_until,0)<=unixepoch() OR ?='expiring' AND MAX(COALESCE(z.paid_until,0),z.trial_ends_at) BETWEEN unixepoch() AND unixepoch()+7*86400)`).bind(f.language||'',f.language||'',f.registered_after||0,f.registered_after||0,f.status||'',f.status||'',f.status||'',f.status||'').all()).results.map(r=>String(r.user_id));ids=ids.filter(id=>allowed.includes(String(id)))}
 ids=ids.filter(i=>String(i)!==String(user.id));if(!ids.length)error(400,'Нет доступных специалистов для рассылки');if(ids.length>10000)error(400,'Выберите меньшую аудиторию');const id=crypto.randomUUID(),token=crypto.randomUUID();await db.prepare('INSERT INTO admin_broadcasts(id,actor,text,recipients,token,created_at) VALUES(?,?,?,?,?,?)').bind(id,user.id,message,JSON.stringify(ids),token,stamp()).run();return h.json({id,token,text:message,count:ids.length})}
 if(p==='/api/v10/admin/broadcast/send'&&req.method==='POST'){const b=await h.body(req),r=await db.prepare('SELECT * FROM admin_broadcasts WHERE id=? AND actor=? AND token=?').bind(clean(b.id,80),user.id,clean(b.token,80)).first();if(!r||b.confirm!==true)error(400,'Сначала проверьте предпросмотр');if(r.created_at<stamp()-3600)error(409,'Предпросмотр устарел');const stored=[...new Set(JSON.parse(r.recipients).map(String))];if(!stored.length)error(400,'Нет получателей');const q=stored.map(()=>'?').join(','),allowed=(await db.prepare("SELECT DISTINCT m.user_id FROM memberships m JOIN telegram_contacts t ON t.user_id=m.user_id WHERE t.state='allowed' AND m.user_id IN ("+q+")").bind(...stored).all()).results.map(x=>String(x.user_id)),ids=stored.filter(id=>allowed.includes(id));if(!ids.length)error(409,'Специалисты больше недоступны для рассылки');if(r.status==='queued')return h.json({ok:true,count:ids.length});const recipients=JSON.stringify(ids);const result=await db.batch([db.prepare("UPDATE admin_broadcasts SET status='queued',recipients=?,sent_at=? WHERE id=? AND status='preview'").bind(recipients,stamp(),r.id),db.prepare("INSERT OR IGNORE INTO outbox(id,chat_id,text,created_at) SELECT 'broadcast:'||?||':'||value,value,?,? FROM json_each(?) WHERE EXISTS(SELECT 1 FROM memberships WHERE user_id=value) AND EXISTS(SELECT 1 FROM admin_broadcasts WHERE id=? AND status='queued')").bind(r.id,r.text,stamp(),recipients,r.id),auditStatement(db,user.id,'broadcast',r.id,null,{count:ids.length,audience:'specialists'})]);return h.json({ok:true,count:ids.length})}
'''
replace_between('src/v10.js'," if(p==='/api/v10/admin/broadcast/preview'"," error(404,'Раздел не найден');",preview_send)
replace_once('public/admin-v10.js',"pick('audience',[['specialists','Все специалисты'],['selected','Выбранные пользователи'],['clients','Клиенты']])","pick('audience',[['specialists','Все специалисты'],['selected','Выбранные специалисты']])")

# ---- bot entry: preserve chosen language, latest specialist, two-language choices ----
replace_once('src/bot-entry.js',"const languageLabels={ru:'🇷🇺 Русский',kk:'🇰🇿 Қазақша',az:'🇦🇿 Azərbaycan dili',uz:'🇺🇿 O‘zbekcha'};","const languageLabels={ru:'🇷🇺 Русский',az:'🇦🇿 Azərbaycan dili'};")
replace_once('src/bot-entry.js'," let entry=await db.prepare('SELECT * FROM bot_entry WHERE user_id=?').bind(id).first(),prefs=await db.prepare('SELECT * FROM user_app_settings WHERE user_id=?').bind(id).first();"," let entry=await db.prepare('SELECT * FROM bot_entry WHERE user_id=?').bind(id).first(),prefs=await db.prepare('SELECT * FROM user_app_settings WHERE user_id=?').bind(id).first();\n if(prefs?.language&&!LANGS.includes(prefs.language)){await db.prepare(\"UPDATE user_app_settings SET language='',updated_at=? WHERE user_id=?\").bind(now(),id).run();prefs=await db.prepare('SELECT * FROM user_app_settings WHERE user_id=?').bind(id).first()}")
replace_between('src/bot-entry.js',' if(invited){',' await db.prepare(\'INSERT INTO bot_entry VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET company_id=excluded.company_id,updated_at=excluded.updated_at\'',''' if(invited){entry={company_id:invited.id};const owner=await db.prepare('SELECT s.language FROM memberships m LEFT JOIN user_app_settings s ON s.user_id=m.user_id WHERE m.company_id=? ORDER BY m.rowid LIMIT 1').bind(invited.id).first(),inherited=LANGS.includes(owner?.language)?owner.language:'ru';if(!prefs?.language){await db.prepare("INSERT INTO user_app_settings(user_id,language,role,theme,updated_at) VALUES(?,?,?,'light',?) ON CONFLICT(user_id) DO UPDATE SET language=CASE WHEN user_app_settings.language='' THEN excluded.language ELSE user_app_settings.language END,role=CASE WHEN user_app_settings.role='' THEN 'client' ELSE user_app_settings.role END,updated_at=excluded.updated_at").bind(id,inherited,'client',now()).run();prefs=await db.prepare('SELECT * FROM user_app_settings WHERE user_id=?').bind(id).first()}else if(!prefs.role){await db.prepare("UPDATE user_app_settings SET role='client',updated_at=? WHERE user_id=? AND role=''").bind(now(),id).run();prefs=await db.prepare('SELECT * FROM user_app_settings WHERE user_id=?').bind(id).first()}}
 else if(!await db.prepare('SELECT 1 FROM memberships WHERE user_id=?').bind(id).first()){const link=await db.prepare('SELECT company_id FROM client_links WHERE user_id=? ORDER BY last_seen DESC LIMIT 1').bind(id).first();if(link)entry={company_id:link.company_id}}
''')

# ---- schema 13 + linked specialists list ----
v2=read('src/v2.js')
marker="export const schema=["
if marker not in v2: raise SystemExit('schema marker missing')
schema13="""export const schema13=[\n`CREATE TABLE IF NOT EXISTS manual_client_claims(booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,username TEXT NOT NULL,created_at INTEGER NOT NULL,claimed_at INTEGER,claimed_user_id TEXT)`,\n`CREATE INDEX IF NOT EXISTS manual_client_claim_username ON manual_client_claims(username,claimed_at,created_at DESC)`\n];\n"""
v2=v2.replace(marker,schema13+marker,1)
v2=v2.replace('...schema11,...schema12\n];','...schema11,...schema12,...schema13\n];',1)
start=v2.find('export async function ensureSchema(db){')
end=v2.find('const err=',start)
if start<0 or end<0: raise SystemExit('ensureSchema markers missing')
new_ensure="""export async function ensureSchema(db){if(!initialized.has(db))initialized.set(db,(async()=>{await db.prepare('CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY)').run();if(await db.prepare('SELECT 1 FROM schema_versions WHERE version=13').first())return;const current12=await db.prepare('SELECT 1 FROM schema_versions WHERE version=12').first(),current11=await db.prepare('SELECT 1 FROM schema_versions WHERE version=11').first(),previous=await db.prepare('SELECT 1 FROM schema_versions WHERE version IN (9,10)').first();const statements=current12?schema13:current11?[...schema12,...schema13]:previous?[...schema10,...schema11,...schema12,...schema13]:schema;await db.batch([...statements.map(sql=>db.prepare(sql)),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(11)'),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(12)'),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(13)')])})().catch(e=>{initialized.delete(db);throw e}));await initialized.get(db)}\n"""
v2=v2[:start]+new_ensure+v2[end:]
context_marker="if(p==='/api/v2/context'){"
specialists_endpoint="""if(p==='/api/v2/specialists'&&m==='GET'){const rows=(await db.prepare(`SELECT c.id,c.name,c.category,COALESCE(s.photo,'') photo,COALESCE(h.handle,'') username,l.last_seen FROM client_links l JOIN companies c ON c.id=l.company_id AND c.active=1 LEFT JOIN specialist_settings s ON s.company_id=c.id LEFT JOIN specialist_handles h ON h.company_id=c.id WHERE l.user_id=? ORDER BY l.last_seen DESC,c.name`).bind(user.id).all()).results;return json(rows)}\n"""
if context_marker not in v2: raise SystemExit('context marker missing')
v2=v2.replace(context_marker,specialists_endpoint+context_marker,1)
write('src/v2.js',v2)

# ---- manual username claim security + claim-on-next-start ----
worker=read('src/worker.js')
lang_marker="async function languageOf(db,userId){return (await appSetting(db,userId))?.language||'ru'}\n"
claim_helpers=r'''async function languageOf(db,userId){return (await appSetting(db,userId))?.language||'ru'}
function normalizedTelegramUsername(value){const v=String(value||'').trim().replace(/^@/,'').toLowerCase();return /^[a-z][a-z0-9_]{4,31}$/.test(v)?v:''}
async function pendingManualClaim(db,userId,username){const handle=normalizedTelegramUsername(username);if(!handle)return null;return await db.prepare(`SELECT mc.booking_id,mc.company_id,mc.username,c.name,COALESCE(NULLIF(s.language,''),'ru') language FROM manual_client_claims mc JOIN bookings b ON b.id=mc.booking_id JOIN companies c ON c.id=mc.company_id AND c.active=1 LEFT JOIN memberships m ON m.company_id=c.id LEFT JOIN user_app_settings s ON s.user_id=m.user_id WHERE mc.claimed_at IS NULL AND lower(mc.username)=? AND b.user_id LIKE 'manual-%' AND b.starts_at>? ORDER BY mc.created_at DESC LIMIT 1`).bind(handle,now()-86400).first()}
async function claimManualBooking(db,userId,bookingId,username){const handle=normalizedTelegramUsername(username);if(!handle)return null;const claim=await db.prepare(`SELECT mc.booking_id,mc.company_id,mc.username FROM manual_client_claims mc JOIN bookings b ON b.id=mc.booking_id WHERE mc.booking_id=? AND mc.claimed_at IS NULL AND lower(mc.username)=? AND b.user_id LIKE 'manual-%'`).bind(bookingId,handle).first();if(!claim)return null;const changed=await db.prepare("UPDATE bookings SET user_id=? WHERE id=? AND user_id LIKE 'manual-%'").bind(String(userId),bookingId).run();if(!changed.meta.changes)return null;await db.batch([db.prepare('INSERT INTO client_links(user_id,company_id,created_at,last_seen) VALUES(?,?,?,?) ON CONFLICT(user_id,company_id) DO UPDATE SET last_seen=excluded.last_seen').bind(String(userId),claim.company_id,now(),Date.now()),db.prepare('UPDATE manual_client_claims SET claimed_at=?,claimed_user_id=? WHERE booking_id=? AND claimed_at IS NULL').bind(now(),String(userId),bookingId)]);const booking=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first(),c=await company(db,claim.company_id),lang=await languageOf(db,userId);await queue(db,`manual-claim:${bookingId}:${userId}`,userId,JSON.stringify(await applyNotificationText(db,messagePayload(booking,c,'created',false,null,lang)))).run();return {company:c,booking}}
'''
if lang_marker not in worker: raise SystemExit('languageOf marker missing')
worker=worker.replace(lang_marker,claim_helpers,1)
cb_marker="  await enforceAccount(env.DB,String(cb.from.id));\n  const visit=cb.data.match(/^visit:"
cb_insert=r'''  await enforceAccount(env.DB,String(cb.from.id));
  const manualClaim=cb.data.match(/^manual:(claim|ignore):([a-z0-9-]+)$/);if(manualClaim){try{if(manualClaim[1]==='ignore'){await env.DB.prepare('UPDATE manual_client_claims SET claimed_at=?,claimed_user_id=? WHERE booking_id=? AND claimed_at IS NULL').bind(now(),'ignored:'+cb.from.id,manualClaim[2]).run();await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:'Запись не привязана'});return json({method:'editMessageText',chat_id:cb.from.id,message_id:cb.message?.message_id,text:'Хорошо. Эта запись не привязана к вашему аккаунту Takt.'})}const claimed=await claimManualBooking(env.DB,String(cb.from.id),manualClaim[2],cb.from.username);if(!claimed)fail(409,'Запись уже привязана или имя Telegram изменилось');await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:'Готово ✅'});await deliver(env).catch(()=>{});return json({method:'editMessageText',chat_id:cb.from.id,message_id:cb.message?.message_id,...await botEntry(env,new URL(req.url).origin,String(cb.from.id),claimed.company)})}catch(e){await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:e.message||'Не удалось привязать запись',show_alert:true}).catch(()=>{});return json({ok:true})}}
  const visit=cb.data.match(/^visit:'''
if cb_marker not in worker: raise SystemExit('callback marker missing')
worker=worker.replace(cb_marker,cb_insert,1)
start_line=" if(command==='/start')return json({method:'sendMessage',chat_id:m.chat.id,...await botEntry(env,new URL(req.url).origin,String(m.chat.id),invited)});"
start_block=r''' if(command==='/start'){if(!invited){const claim=await pendingManualClaim(env.DB,String(m.chat.id),m.from?.username);if(claim){const lang=APP_LANGS.includes(claim.language)?claim.language:'ru',az=lang==='az',text=az?`<b>${escHtml(claim.name)} sizi Takt-da öz cədvəlinə əlavə edib.</b>\n\nBu Telegram hesabını qeyd ilə əlaqələndirək?`:`<b>${escHtml(claim.name)} добавил(а) вас в своё расписание Takt.</b>\n\nПривязать эту запись к вашему Telegram-аккаунту?`;return json({method:'sendMessage',chat_id:m.chat.id,text,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:az?'✅ Bəli, bu mənəm':'✅ Да, это я',style:'success',callback_data:'manual:claim:'+claim.booking_id}],[{text:az?'Xeyr':'Нет, это не я',style:'danger',callback_data:'manual:ignore:'+claim.booking_id}]]}})}}return json({method:'sendMessage',chat_id:m.chat.id,...await botEntry(env,new URL(req.url).origin,String(m.chat.id),invited)})}'''
if start_line not in worker: raise SystemExit('/start marker missing')
worker=worker.replace(start_line,start_block,1)
old_booking_head="  const b=await body(req),c=await company(db,b.company_id);if(b.manual&&!await access(db,env,user,c.id))fail(403,'Нет доступа');let bookingUser=b.manual?'manual-'+c.id+'-'+text(b.phone,24).replace(/\\D/g,''):user.id;\n  if(b.manual&&b.client_id){if(!await db.prepare('SELECT 1 FROM bookings WHERE company_id=? AND user_id=? UNION SELECT 1 FROM client_links WHERE company_id=? AND user_id=? LIMIT 1').bind(c.id,b.client_id,c.id,b.client_id).first())fail(403,'Нет доступа к клиенту');bookingUser=b.client_id}if(!/^[a-zA-Z0-9-]{8,80}$/.test(b.request_key||''))fail(400,'Повторите оформление');"
new_booking_head="  const b=await body(req),c=await company(db,b.company_id);if(b.manual&&!await access(db,env,user,c.id))fail(403,'Нет доступа');const manualUsername=b.manual?normalizedTelegramUsername(b.telegram_username):'';if(b.manual&&b.telegram_username&&!manualUsername)fail(400,'Проверьте Telegram username клиента');let bookingUser=b.manual?'manual-'+c.id+'-'+text(b.phone,24).replace(/\\D/g,''):user.id;\n  if(b.manual&&b.client_id){if(!await db.prepare('SELECT 1 FROM bookings WHERE company_id=? AND user_id=? UNION SELECT 1 FROM client_links WHERE company_id=? AND user_id=? LIMIT 1').bind(c.id,b.client_id,c.id,b.client_id).first())fail(403,'Нет доступа к клиенту');bookingUser=b.client_id}else if(b.manual&&manualUsername){const linked=await db.prepare(\"SELECT p.user_id FROM telegram_profiles p JOIN client_links l ON l.user_id=p.user_id AND l.company_id=? WHERE lower(p.username)=? ORDER BY l.last_seen DESC LIMIT 1\").bind(c.id,manualUsername).first();if(linked?.user_id)bookingUser=String(linked.user_id)}if(!/^[a-zA-Z0-9-]{8,80}$/.test(b.request_key||''))fail(400,'Повторите оформление');"
if old_booking_head not in worker: raise SystemExit('booking head marker missing')
worker=worker.replace(old_booking_head,new_booking_head,1)
needle="...await notices(db,booking,'created'),...(!b.manual||/^[0-9]+$/.test(bookingUser)?[db.prepare('INSERT INTO client_links(user_id,company_id,created_at,last_seen) VALUES(?,?,?,?) ON CONFLICT(user_id,company_id) DO UPDATE SET last_seen=excluded.last_seen').bind(bookingUser,c.id,now(),Date.now())]:[])"
replacement="...await notices(db,booking,'created'),...(b.manual&&manualUsername&&!/^[0-9]+$/.test(String(bookingUser))?[db.prepare('INSERT OR REPLACE INTO manual_client_claims(booking_id,company_id,username,created_at,claimed_at,claimed_user_id) VALUES(?,?,?,?,NULL,NULL)').bind(booking.id,c.id,manualUsername,now())]:[]),...(!b.manual||/^[0-9]+$/.test(String(bookingUser))?[db.prepare('INSERT INTO client_links(user_id,company_id,created_at,last_seen) VALUES(?,?,?,?) ON CONFLICT(user_id,company_id) DO UPDATE SET last_seen=excluded.last_seen').bind(bookingUser,c.id,now(),Date.now())]:[])"
if needle not in worker: raise SystemExit('booking batch marker missing')
worker=worker.replace(needle,replacement,1)
write('src/worker.js',worker)

# ---- app 12.1 behaviour ----
app=read('public/app-v2.js')
app=app.replace("subscriptionStats:null,date:","subscriptionStats:null,specialists:[],date:",1)
app=app.replace("manualNewClient={name:'',phone:''}","manualNewClient={name:'',phone:'',telegram:''}")
app=app.replace("LANGUAGES.filter(([code])=>code!=='ru')","LANGUAGES.filter(([code])=>code==='az')")
app=app.replace("Object.fromEntries(['kk','az','uz'].map(lang=>[lang,Object.fromEntries(keys.map(key=>[key,String(fd.get('tr_'+lang+'_'+key)||'')]))]))","Object.fromEntries(['az'].map(lang=>[lang,Object.fromEntries(keys.map(key=>[key,String(fd.get('tr_'+lang+'_'+key)||'')]))]))")
app=app.replace("<button class=\"account-button\" data-page=\"profile\"","<button class=\"account-button\" data-page=\"more\"",1)
app=app.replace("if(invite){const owner=await api('/v10/invite?company='+encodeURIComponent(invite));if(owner.language!==S.appSettings.language){await post('/v8/profile',{language:owner.language,company_id:invite});S.appSettings=await api('/v8/profile')}}","if(invite&&!S.appSettings.language){const owner=await api('/v10/invite?company='+encodeURIComponent(invite));await post('/v8/profile',{language:owner.language,company_id:invite});S.appSettings=await api('/v8/profile')}",1)
app=app.replace("S.tour=!((S.prefs[S.mode+'_intro']||0)>=2||stored('tour-'+S.mode)==='2');","if(S.me&&S.mode==='client')S.specialists=await api('/v2/specialists').catch(()=>[]);else S.specialists=[];S.tour=!((S.prefs[S.mode+'_intro']||0)>=2||stored('tour-'+S.mode)==='2');",1)
app=app.replace("['profile','user','Помощь','Знакомство с Тактом и уведомления']","['profile','user','Интерфейс','Язык и оформление'],['help','check','Помощь','Вопросы и поддержка']",1)
app=app.replace('>Продлить подписку</a>', '>Связаться с поддержкой</a>',1).replace('>Продлить подписку</button>', '>Связаться с поддержкой</button>',1)
app=app.replace('Пока продление подписки выполняется вручную. Чтобы продлить подписку, свяжитесь с поддержкой.','Пока подключение и продление выполняются вручную. Выберите период и свяжитесь с поддержкой — администратор подтвердит подписку.',1)
app=app.replace("manualNewClient={name:String(fd.get('name')||''),phone:String(fd.get('phone')||'')}","manualNewClient={name:String(fd.get('name')||''),phone:String(fd.get('phone')||''),telegram:String(fd.get('telegram')||'')}",1)
app=app.replace("manualNewClient={name:b.name,phone:b.phone};manualClient={name:b.name,phone:b.phone};","manualNewClient={name:b.name,phone:b.phone,telegram:b.telegram||''};manualClient={name:b.name,phone:b.phone,telegram:b.telegram||''};",1)
app=app.replace("<label>Телефон<input name=\"phone\" type=\"tel\" value=\"${esc(manualNewClient.phone)}\" required minlength=\"10\" maxlength=\"24\" autocomplete=\"tel\"></label><div class=\"form-error\"","<label>Телефон<input name=\"phone\" type=\"tel\" value=\"${esc(manualNewClient.phone)}\" required minlength=\"10\" maxlength=\"24\" autocomplete=\"tel\"></label><label>Telegram · по желанию<input name=\"telegram\" value=\"${esc(manualNewClient.telegram||'')}\" maxlength=\"33\" placeholder=\"@username\" autocapitalize=\"none\" autocomplete=\"off\"></label><small class=\"note\">Если указать Telegram, клиент сможет безопасно привязать эту запись при следующем запуске Takt.</small><div class=\"form-error\"",1)
app=app.replace("client_id:manual?manualClient?.id:undefined,known:","client_id:manual?manualClient?.id:undefined,telegram_username:manual?manualClient?.telegram||previous?.telegram_username||'':undefined,known:",1)
app=app.replace("client_id:b.manual?b.client_id:undefined});","client_id:b.manual?b.client_id:undefined,telegram_username:b.manual?b.telegram_username:undefined});",1)

sort_marker="const until=t=>{"
if sort_marker not in app: raise SystemExit('sort marker missing')
app=app.replace(sort_marker,"const terminalBooking=b=>b.status==='done'||b.visit_outcome==='done'||b.visit_outcome==='no_show'||b.status==='cancelled';\nconst scheduleSort=(a,b)=>Number(terminalBooking(a))-Number(terminalBooking(b))||a.starts_at-b.starts_at;\n"+sort_marker,1)
app=app.replace("const rows=S.bookings.filter(b=>date(b.starts_at)===d&&b.status!=='cancelled').sort((a,b)=>a.starts_at-b.starts_at);","const rows=S.bookings.filter(b=>date(b.starts_at)===d&&b.status!=='cancelled').sort(scheduleSort);",1)
app=app.replace("rows=S.bookings.filter(b=>date(b.starts_at)===d&&b.status!=='cancelled').sort((a,b)=>a.starts_at-b.starts_at),blocks=","rows=S.bookings.filter(b=>date(b.starts_at)===d&&b.status!=='cancelled').sort(scheduleSort),blocks=",1)
app=app.replace("today.filter(b=>b.status!=='cancelled'&&b.visit_outcome!=='no_show').sort((a,b)=>a.starts_at-b.starts_at)","today.filter(b=>b.status!=='cancelled').sort(scheduleSort)",1)

profile_marker="function profile(){const app=S.appSettings||{};return `${heading(isClient()?'Мой профиль':'Мой кабинет',isClient()?'Настройки клиента и ваши визиты.':'Аккаунт, интерфейс и помощь Takt.')}<section class=\"editor-card profile-v8\">"
if profile_marker not in app: raise SystemExit('profile marker missing')
profile_repl="function profile(){const app=S.appSettings||{},specialists=isClient()&&S.specialists?.length?`<section class=\"editor-card client-specialists-v121\"><h3>${translateText('Мои специалисты',S.language)}</h3><p class=\"note\">${translateText('Выберите специалиста, к которому хотите записаться.',S.language)}</p><div>${S.specialists.map(x=>`<button class=\"more-card ${S.tenant?.id===x.id?'selected':''}\" data-specialist=\"${esc(x.id)}\">${imageTag(x.photo,x.name,'small-avatar')}<span><strong>${userText(x.name)}</strong><small>${S.tenant?.id===x.id?translateText('Выбран',S.language):translateText('Открыть',S.language)}</small></span>${icon('arrow')}</button>`).join('')}</div></section>`:'';return `${heading(isClient()?'Мой профиль':'Мой кабинет',isClient()?'Настройки клиента и ваши визиты.':'Аккаунт, интерфейс и помощь Takt.')}<section class=\"editor-card profile-v8\">"
app=app.replace(profile_marker,profile_repl,1)
app=app.replace("</section><section class=\"editor-card profile-settings-v8\"><h3>Интерфейс</h3>","</section>${specialists}<section class=\"editor-card profile-settings-v8\"><h3>Интерфейс</h3>",1)
click_marker="if(el.dataset.page==='legal'&&!S.me){"
if click_marker not in app: raise SystemExit('click page marker missing')
switcher="if(el.dataset.specialist){const id=el.dataset.specialist;S.tenant=await api('/v2/page/'+encodeURIComponent(id));await post('/v2/context',{company_id:id});stored('tenant',id);S.page='client';S.tab='upcoming';await render({force:true});return}\n"
app=app.replace(click_marker,switcher+click_marker,1)
write('public/app-v2.js',app)

# ---- fully localized centered How-it-works landing (RU/AZ) ----
landing=r'''import {icon} from './icons.js';
const C={
ru:{heroTag:'TAKT · ВАШ ЛИЧНЫЙ СЕРВИС ЗАПИСИ',hero1:'Запись клиентов',hero2:'без лишних сообщений.',heroP:'Клиент сам выбирает услугу, дату и свободное время. Вы просто занимаетесь своей работой.',start:'Начать работу',meet:'Познакомиться с Takt ↓',day:'Ваш день',plan:'Всё по плану',first:'Первая встреча',confirmed:'Запись подтверждена',self:'Время для себя',next:'Следующий клиент',reminder:'Напоминание отправлено',illustration:'Иллюстрация возможностей',s1tag:'01 / ПОРЯДОК В ДЕЛАХ',s1:'Всё расписание в одном месте.',s1p:'Календарь, записи и свободные окна всегда перед глазами. День складывается без таблиц и заметок.',dayBtn:'День',week:'Неделя',rhythm:'Ваш рабочий ритм',s2tag:'02 / МЕНЬШЕ ПЕРЕПИСКИ',s2:'Больше никаких «А есть окошко?»',s2p:'Отправьте одну ссылку — клиент запишется самостоятельно.',q1:'Есть время вечером?',q2:'А завтра в 17:00?',answer:'Выберите удобное время по моей ссылке ↗',s3tag:'03 / ПРОСТО ДЛЯ КЛИЕНТА',s3:'Как работает Takt',steps:['Клиент выбирает услугу','Выбирает дату','Находит свободное время','Подтверждает запись','Takt добавляет встречу в расписание и отправляет уведомления'],s4tag:'04 / ВАШЕ ПРОСТРАНСТВО',s4:'Ваш собственный сервис записи.',s4p:'Фото, описание, услуги и цены. Клиент приходит именно к вам и видит только вашу страницу.',create:'Создать страницу',future:'ВАША БУДУЩАЯ СТРАНИЦА',yourName:'Ваше имя',approach:'Ваш подход. Ваши услуги.',service:'Название услуги',duration:'Длительность · стоимость',book:'Записаться',s5tag:'05 / ВСЁ ПОД РУКОЙ',s5:'Всё необходимое внутри.',features:['Расписание','Клиенты','Услуги','Напоминания','Статистика','Персональная ссылка'],remember:'TAKT ПОМНИТ ЗА ВАС',notify:'Takt сам напоминает о записи',notifyP:'Меньше пропущенных записей — Takt заранее напоминает обеим сторонам.',notes:['✅ Добавляет запись в расписание','🔔 За 24 часа напоминает о записи','⏰ За 2 часа спрашивает, придёт ли клиент','👤 Напоминает специалисту за 2 часа','📊 Присылает итоги дня — по умолчанию в 20:00'],notifyFoot:'Уведомления уже включены. Специалист может изменить их в настройках.',try:'ПОПРОБУЙТЕ БЕСПЛАТНО',days:'дней',month:'месяц',free:'Клиенты записываются по вашей ссылке бесплатно. Платит только специалист за свой кабинет Takt.',finalTag:'ВАШЕ ВРЕМЯ ПРИНАДЛЕЖИТ ВАМ',final:'Создайте свою страницу записи за несколько минут.',createMine:'Создать мой Takt',want:'Хотите записаться к специалисту?',wantP:'Откройте его персональную ссылку.',my:'Мои записи'},
az:{heroTag:'TAKT · ŞƏXSİ QEYD XİDMƏTİNİZ',hero1:'Müştərilərin qeydi',hero2:'artıq yazışma olmadan.',heroP:'Müştəri xidməti, tarixi və boş vaxtı özü seçir. Siz isə sadəcə işinizlə məşğul olursunuz.',start:'İşə başla',meet:'Takt ilə tanış olun ↓',day:'Sizin gününüz',plan:'Hər şey plan üzrə',first:'İlk görüş',confirmed:'Qeyd təsdiqlənib',self:'Özünüz üçün vaxt',next:'Növbəti müştəri',reminder:'Xatırlatma göndərildi',illustration:'İmkanların nümunəsi',s1tag:'01 / İŞLƏRDƏ QAYDA',s1:'Bütün cədvəl bir yerdə.',s1p:'Təqvim, qeydlər və boş vaxtlar həmişə göz önündədir. Gün cədvəlsiz və qeydsiz planlanır.',dayBtn:'Gün',week:'Həftə',rhythm:'Sizin iş ritminiz',s2tag:'02 / DAHA AZ YAZIŞMA',s2:'Artıq «Boş vaxt var?» sualı yoxdur.',s2p:'Bir link göndərin — müştəri özü qeydiyyatdan keçsin.',q1:'Axşam boş vaxt var?',q2:'Bəs sabah 17:00?',answer:'Uyğun vaxtı linkimdən seçin ↗',s3tag:'03 / MÜŞTƏRİ ÜÇÜN SADƏ',s3:'Takt necə işləyir',steps:['Müştəri xidməti seçir','Tarixi seçir','Uyğun boş vaxtı tapır','Qeydi təsdiqləyir','Takt görüşü cədvələ əlavə edir və bildiriş göndərir'],s4tag:'04 / SİZİN MƏKANINIZ',s4:'Öz qeyd xidmətiniz.',s4p:'Foto, təsvir, xidmətlər və qiymətlər. Müştəri məhz sizə gəlir və yalnız sizin səhifənizi görür.',create:'Səhifə yarat',future:'GƏLƏCƏK SƏHİFƏNİZ',yourName:'Adınız',approach:'Sizin yanaşmanız. Sizin xidmətləriniz.',service:'Xidmətin adı',duration:'Müddət · qiymət',book:'Qeyd ol',s5tag:'05 / HƏR ŞEY ƏL ALTINDA',s5:'Lazım olan hər şey daxilindədir.',features:['Cədvəl','Müştərilər','Xidmətlər','Xatırlatmalar','Statistika','Şəxsi link'],remember:'TAKT SİZİN ƏVƏZİNİZƏ XATIRLAYIR',notify:'Takt qeydi özü xatırladır',notifyP:'Daha az buraxılmış görüş — Takt hər iki tərəfə əvvəlcədən xatırladır.',notes:['✅ Qeydi cədvələ əlavə edir','🔔 24 saat əvvəl qeydi xatırladır','⏰ 2 saat əvvəl müştərinin gələcəyini soruşur','👤 Mütəxəssisə 2 saat əvvəl xatırladır','📊 Günün yekununu göndərir — standart olaraq 20:00-da'],notifyFoot:'Bildirişlər əvvəlcədən aktivdir. Mütəxəssis onları parametrlərdə dəyişə bilər.',try:'PULSUZ YOXLAYIN',days:'gün',month:'ay',free:'Müştərilər linkinizlə pulsuz qeydiyyatdan keçir. Yalnız mütəxəssis öz Takt kabineti üçün ödəyir.',finalTag:'VAXTINIZ SİZƏ MƏXSUSDUR',final:'Qeyd səhifənizi bir neçə dəqiqəyə yaradın.',createMine:'Mənim Takt səhifəmi yarat',want:'Mütəxəssisə qeyd olunmaq istəyirsiniz?',wantP:'Onun şəxsi linkini açın.',my:'Qeydlərim'}};
export function landing(tariff={},lang='ru'){const L=C[lang==='az'?'az':'ru'],days=Number.isInteger(tariff.trial_days)?tariff.trial_days:7,price=Number.isInteger(tariff.price)?tariff.price:590,offer=tariff.enabled===false?'':`<section class="trial-offer"><span class="eyebrow">${L.try}</span><h3>${days?`<strong>${days} ${L.days} — 0 ₽</strong><br>`:''}${price} ₽ / ${L.month}</h3><p>${L.free}</p><button class="primary" data-begin>${L.start}</button></section>`;return `<div class="v3-intro"><section class="v3-hero"><div><span class="eyebrow">${L.heroTag}</span><h1>${L.hero1}<br><span class="hero-second-line">${L.hero2}</span></h1><p>${L.heroP}</p><button class="primary" data-begin>${L.start} ${icon('arrow')}</button><a class="intro-scroll" href="#intro-schedule">${L.meet}</a></div><div class="v3-calendar-mock" aria-label="${L.illustration}"><div class="mock-heading">${L.day} <span>${L.plan}</span></div><div class="mock-week"><span>Пн</span><span>Вт</span><b>Ср</b><span>Чт</span><span>Пт</span></div><div class="mock-appointment"><time>10:00</time><div><b>${L.first}</b><small>${L.confirmed}</small></div>${icon('check')}</div><div class="mock-gap"><time>12:00</time><span>${L.self}</span></div><div class="mock-appointment"><time>14:30</time><div><b>${L.next}</b><small>${L.reminder}</small></div>${icon('clock')}</div><span class="mock-caption">${L.illustration}</span></div></section><section class="v3-story" id="intro-schedule"><span class="eyebrow">${L.s1tag}</span><h2>${L.s1}</h2><p>${L.s1p}</p><div class="intro-features"><span>${L.dayBtn}</span><span>${L.week}</span><span>${L.rhythm}</span></div></section><section class="v3-story story-grid"><div><span class="eyebrow">${L.s2tag}</span><h2>${L.s2}</h2><p>${L.s2p}</p></div><div class="chat-demo"><div>${L.q1}</div><div>${L.q2}</div><div class="chat-answer">${L.answer}</div></div></section><section class="v3-story"><span class="eyebrow">${L.s3tag}</span><h2>${L.s3}</h2><ol class="v3-steps">${L.steps.map((t,i)=>`<li><span>0${i+1}</span><p>${t}</p></li>`).join('')}</ol></section><section class="v3-story story-grid"><div><span class="eyebrow">${L.s4tag}</span><h2>${L.s4}</h2><p>${L.s4p}</p><button class="primary" data-begin>${L.create} ${icon('arrow')}</button></div><div class="page-demo"><span class="eyebrow">${L.future}</span><span class="demo-avatar">T</span><h3>${L.yourName}</h3><p>${L.approach}</p><div><span>${L.service}<small>${L.duration}</small></span>${icon('arrow')}</div><span class="demo-cta">${L.book}</span></div></section><section class="v3-story"><span class="eyebrow">${L.s5tag}</span><h2>${L.s5}</h2><div class="v3-feature-grid">${[['calendar',L.features[0]],['user',L.features[1]],['beauty',L.features[2]],['clock',L.features[3]],['grid',L.features[4]],['link',L.features[5]]].map(([i,t])=>`<div>${icon(i)}<h3>${t}</h3></div>`).join('')}</div></section><section class="v3-story notification-story"><span class="eyebrow">${L.remember}</span><h2>${L.notify}</h2><p>${L.notifyP}</p><ul>${L.notes.map(x=>`<li>${x}</li>`).join('')}</ul><p>${L.notifyFoot}</p></section>${offer}<section class="v3-finale"><span class="eyebrow">${L.finalTag}</span><h2>${L.final}</h2><button class="primary" data-begin>${L.createMine} ${icon('arrow')}</button></section><div class="client-note">${icon('link')}<div><h3>${L.want}</h3><p>${L.wantP}</p><button class="text-button" id="enter-client">${L.my}</button></div></div></div>`}
export function initLandingMotion(){const nodes=[...document.querySelectorAll('.v3-hero,.v3-story,.trial-offer,.v3-finale,.client-note')];if(!nodes.length)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced){nodes.forEach(x=>x.classList.add('is-visible'));return}nodes.forEach((x,i)=>{x.classList.add('landing-reveal');x.style.setProperty('--reveal-delay',(i%3)*55+'ms')});const observer=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('is-visible',e.isIntersecting)),{threshold:.14,rootMargin:'0px 0px -7% 0px'});nodes.forEach(x=>observer.observe(x));}
'''
write('public/landing.js',landing)

css=r'''/* Takt 12.1 — final pilot polish */
:root{--takt-v121-card-gap:12px}
.v3-intro .v3-hero,.v3-intro .v3-story,.v3-intro .trial-offer,.v3-intro .v3-finale{width:min(100%,920px);margin-left:auto;margin-right:auto;text-align:center;justify-items:center;align-items:center}
.v3-intro .v3-hero{grid-template-columns:minmax(0,1fr);gap:28px}
.v3-intro .v3-hero>div:first-child,.v3-intro .v3-story>div,.v3-intro .trial-offer>*,.v3-intro .v3-finale>*{margin-left:auto;margin-right:auto}
.v3-intro .story-grid{grid-template-columns:minmax(0,1fr);justify-items:center}
.v3-intro .story-grid>div{width:min(100%,720px)}
.v3-intro .intro-features,.v3-intro .v3-feature-grid{justify-content:center}
.v3-intro .v3-steps{width:min(100%,760px);margin-inline:auto;padding:0}
.v3-intro .v3-steps li{grid-template-columns:52px minmax(0,1fr);align-items:center;text-align:left}
.v3-intro .notification-story ul{display:grid;gap:10px;width:min(100%,700px);margin:20px auto;text-align:left}
.v3-intro .chat-demo,.v3-intro .page-demo,.v3-intro .v3-calendar-mock{width:min(100%,620px);margin-inline:auto;text-align:left}
.v3-intro button.primary,.v3-intro .trial-offer .primary,.v3-intro .v3-finale .primary{margin-inline:auto}
.calendar-grid.day{width:100%;max-width:none}
@media (min-width:700px){
 .calendar-grid.day>.calendar-day{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--takt-v121-card-gap);align-items:start}
 .calendar-grid.day .calendar-date,.calendar-grid.day .calendar-free,.calendar-grid.day .free-timeline,.calendar-grid.day .closed-day{grid-column:1/-1}
 .calendar-grid.day .calendar-event{width:100%;min-width:0;margin:0;align-self:stretch}
 .calendar-grid.day .calendar-block{min-width:0}
}
@media (max-width:699px){.calendar-grid.day>.calendar-day{display:block}.calendar-grid.day .calendar-event{width:100%}}
.calendar-event.done,.calendar-event.no_show,.visit-card[data-booking-status="done"],.visit-card[data-booking-status="no_show"]{opacity:.78}
.client-specialists-v121{display:grid;gap:12px}
.client-specialists-v121>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.client-specialists-v121 .more-card{display:flex;align-items:center;gap:10px;text-align:left}
.client-specialists-v121 .more-card.selected{outline:2px solid var(--accent,#2f5bea);outline-offset:1px}
.client-specialists-v121 .more-card>span:nth-child(2){display:grid;gap:3px;min-width:0;flex:1}
#manual-client-form .note{display:block;margin:-4px 0 8px}
'''
write('public/takt-v121.css',css)

test=r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LANGS,defaults,validateConfig} from '../src/v10.js';
import {landing} from '../public/landing.js';

test('Takt 12.1 exposes only Russian and Azerbaijani',()=>{
 assert.deepEqual(LANGS,['ru','az']);
 assert.deepEqual(defaults.languages,['ru','az']);
 assert.throws(()=>validateConfig('languages',['ru','kk']));
});

test('reminder contract remains 24h and 2h for pilot',()=>{
 assert.equal(defaults.notification_intervals.client_24h,24);
 assert.equal(defaults.notification_intervals.client_2h,2);
 assert.equal(defaults.notification_intervals.master_2h,2);
 assert.throws(()=>validateConfig('notification_intervals',{client_24h:12,client_2h:2,master_2h:2,master_reminder_minutes:60,retry_seconds:300}));
});

test('Azerbaijani how-it-works copy has no Russian UI text and keeps Takt brand',()=>{
 const html=landing({trial_days:7,price:590,enabled:true},'az');
 assert.ok(html.includes('Takt'));
 assert.ok(html.includes('Takt necə işləyir'));
 for(const word of ['Начать работу','Как работает','Записаться','Мои записи','Напоминание отправлено'])assert.equal(html.includes(word),false,word);
});

test('admin broadcast source cannot target client audience',()=>{
 const server=fs.readFileSync(new URL('../src/v10.js',import.meta.url),'utf8');
 const ui=fs.readFileSync(new URL('../public/admin-v10.js',import.meta.url),'utf8');
 const block=server.slice(server.indexOf('/broadcast/preview'),server.indexOf("error(404,'Раздел не найден')"));
 assert.equal(block.includes("b.audience==='clients'"),false);
 assert.ok(block.includes('Рассылка доступна только специалистам'));
 assert.equal(ui.includes("['clients','Клиенты']"),false);
});

test('manual Telegram binding requires a confirmation claim',()=>{
 const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 assert.ok(worker.includes('manual:claim:'));
 assert.ok(worker.includes('pendingManualClaim'));
 assert.ok(worker.includes("b.user_id LIKE 'manual-%'"));
 assert.ok(worker.includes('claimManualBooking'));
});

test('schedule sorting puts done and no-show after active visits',()=>{
 const app=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');
 assert.ok(app.includes('const scheduleSort='));
 assert.ok(app.includes("visit_outcome==='no_show'"));
 assert.ok(app.includes('.sort(scheduleSort)'));
});
'''
write('test/v121.test.mjs',test)

print('Takt 12.1 patch applied')
