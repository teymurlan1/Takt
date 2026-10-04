from pathlib import Path
import json,re

ROOT=Path('.')
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s):
    q=ROOT/p; q.parent.mkdir(parents=True,exist_ok=True); q.write_text(s,encoding='utf-8')
def replace_once(s,old,new,label):
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    return s.replace(old,new,1)
def regex_once(s,pattern,repl,label,flags=re.S):
    out,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1: raise SystemExit(f'{label}: expected 1 regex match, got {n}')
    return out

# ---------- new v7 backend module ----------
write('src/v7.js',r'''const now=()=>Math.floor(Date.now()/1000);
const clean=(v,n=1200)=>typeof v==='string'?v.trim().slice(0,n):'';
const publicName=name=>{const p=String(name||'Клиент').trim().split(/\s+/).filter(Boolean);return p.length>1?`${p[0]} ${Array.from(p[1])[0]||''}.`:p[0]||'Клиент'};

export const schema7=[
`CREATE TABLE IF NOT EXISTS reviews(booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,user_id TEXT NOT NULL,client_name TEXT NOT NULL,service_name TEXT NOT NULL,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),text TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS reviews_company_time ON reviews(company_id,created_at DESC)`,
`CREATE TABLE IF NOT EXISTS telegram_booking_messages(booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,chat_id TEXT NOT NULL,message_id INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(booking_id,chat_id))`
];

export async function reviewSummary(db,companyId,limit=3){
 const stats=await db.prepare('SELECT COUNT(*) count,COALESCE(ROUND(AVG(rating),1),0) average FROM reviews WHERE company_id=?').bind(companyId).first()||{count:0,average:0};
 const n=Math.max(0,Math.min(100,Number(limit)||3));
 const rows=n?(await db.prepare('SELECT booking_id,client_name,service_name,rating,text,created_at FROM reviews WHERE company_id=? ORDER BY created_at DESC LIMIT ?').bind(companyId,n).all()).results:[];
 return {count:Number(stats.count)||0,average:Number(stats.average)||0,items:rows.map(x=>({...x,client_name:publicName(x.client_name)}))};
}

export async function createReview(db,userId,input){
 const bookingId=clean(input?.booking_id,80),rating=Number(input?.rating),comment=clean(input?.text,1200);
 if(!bookingId||!Number.isInteger(rating)||rating<1||rating>5)throw Object.assign(new Error('Поставьте оценку от 1 до 5'),{status:400});
 const b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first();
 if(!b)throw Object.assign(new Error('Запись не найдена'),{status:404});
 if(String(b.user_id)!==String(userId))throw Object.assign(new Error('Нет доступа к этой записи'),{status:403});
 if(b.status!=='done')throw Object.assign(new Error('Отзыв можно оставить после завершённой записи'),{status:409});
 const exists=await db.prepare('SELECT rating FROM reviews WHERE booking_id=?').bind(bookingId).first();
 if(exists)throw Object.assign(new Error('Вы уже оставили отзыв по этой записи'),{status:409});
 await db.prepare('INSERT INTO reviews(booking_id,company_id,user_id,client_name,service_name,rating,text,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(b.id,b.company_id,String(userId),b.name,b.service_name,rating,comment,now()).run();
 return {ok:true,rating};
}
''')

write('migrations/0007_takt_v7.sql',r'''-- Takt 7.0: verified reviews and one live Telegram booking message per recipient.
CREATE TABLE IF NOT EXISTS reviews(
  booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_company_time ON reviews(company_id,created_at DESC);

CREATE TABLE IF NOT EXISTS telegram_booking_messages(
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(booking_id,chat_id)
);
''')

# ---------- schema v7 ----------
v2=read('src/v2.js')
v2=replace_once(v2,"import {schema3,options,validateOptions,localDate,fromLocal,dateShift} from './v3.js';","import {schema3,options,validateOptions,localDate,fromLocal,dateShift} from './v3.js';\nimport {schema7} from './v7.js';",'v2 import')
v2=replace_once(v2,"export const schema=[\n...schema3,","export const schema=[\n...schema3,\n...schema7,",'v2 schema')
v2=replace_once(v2,"SELECT 1 FROM schema_versions WHERE version=6","SELECT 1 FROM schema_versions WHERE version=7",'v2 version check')
v2=replace_once(v2,"INSERT OR IGNORE INTO schema_versions VALUES(6)","INSERT OR IGNORE INTO schema_versions VALUES(7)",'v2 version insert')
write('src/v2.js',v2)

# ---------- modern Telegram message text ----------
v3=read('src/v3.js')
new_message=r'''export function messagePayload(b,c,event,admin=false,previous=null){
 const w=when(b.starts_at,c.timezone),money=new Intl.NumberFormat('ru-RU').format(b.price)+' ₽';
 const titles={created:admin?'Новая запись':'Запись создана',confirmed:'Запись подтверждена',cancelled:'Запись отменена',done:'Запись завершена',review_request:'Как всё прошло? ⭐',client_2h:'До записи 2 часа',master_2h:'Клиент через 2 часа',master_reminder:'Скоро следующий клиент',reminder:'Подтвердите визит',moved:'Запись перенесена',attendance_yes:'Клиент подтвердил визит',attendance_no:'Клиент не сможет прийти'};
 if(event==='review_request')return {text:`<b>Как всё прошло? ⭐</b>\n\nБудем рады вашему отзыву — он поможет специалисту становиться лучше, а другим клиентам сделать выбор.\n\n${escHtml(c.name)} · ${escHtml(b.service_name)}`,parse_mode:'HTML',takt:{booking:b.id,company:b.company_id,start:b.starts_at,event,admin:false}};
 let lines=[`<b>${titles[event]||titles.moved}</b>`];
 if(previous){const old=when(previous,c.timezone);lines.push('',`Было: ${old.date} · ${old.time}`,`Стало: ${w.date} · ${w.time}`)}else lines.push('',`📅 <b>${event==='reminder'&&localDate(b.starts_at,c.timezone)===dateShift(localDate(Date.now()/1000,c.timezone),1)?'Завтра, ':''}${w.date} · ${w.time}</b>`);
 lines.push(`${escHtml(b.service_name)} · ${money}`,admin?`Клиент: ${escHtml(b.name)}`:`Специалист: ${escHtml(c.name)}`);
 if(admin&&b.phone)lines.push(`Телефон: ${escHtml(b.phone)}`);else if(!admin&&c.address)lines.push(`📍 ${escHtml(c.address)}`);
 if(event==='created'&&!admin)lines.push('','Специалист подтвердит запись в Takt.');
 if(event==='created'&&admin)lines.push('','Подтвердите запись, когда будете готовы принять клиента.');
 if(event==='cancelled'&&admin)lines.push('','Время снова доступно для записи.');
 if(event==='reminder')lines.push('','Пожалуйста, подтвердите, что вы придёте.');
 if(event==='client_2h')lines.push('',b.attendance_state==='unknown'?'Подтвердите, пожалуйста, что вы придёте.':'До встречи.');
 return {text:lines.join('\n'),parse_mode:'HTML',takt:{booking:b.id,company:b.company_id,start:b.starts_at,event,admin}};
}
'''
v3=regex_once(v3,r"export function messagePayload[\s\S]*$",new_message,'messagePayload')
write('src/v3.js',v3)

# ---------- worker: reviews, v7 version, Telegram menu ----------
worker=read('src/worker.js')
worker=replace_once(worker,"import {subscription,setAttendance} from './v6.js';","import {subscription,setAttendance} from './v6.js';\nimport {reviewSummary,createReview} from './v7.js';",'worker v7 import')
worker=replace_once(worker,"if(path==='/api/health')return json({ok:true,version:'6.1.0'});","if(path==='/api/health')return json({ok:true,version:'7.0.0'});",'health')
worker=replace_once(worker,"return json({...publicOptions(c),services:await services(db,c.id)});","return json({...publicOptions(c),services:await services(db,c.id),reviews:await reviewSummary(db,c.id,3)});",'public reviews')
needle=""" const publicCompany=path.match(/^\\/api\\/v2\\/page\\/([a-z0-9-]+)$/);\n if(publicCompany&&req.method==='GET'){\n  const c=await company(db,publicCompany[1]);\n  return json({...publicOptions(c),services:await services(db,c.id),reviews:await reviewSummary(db,c.id,3)});\n }\n let user;"""
repl=""" const publicCompany=path.match(/^\\/api\\/v2\\/page\\/([a-z0-9-]+)$/);\n if(publicCompany&&req.method==='GET'){\n  const c=await company(db,publicCompany[1]);\n  return json({...publicOptions(c),services:await services(db,c.id),reviews:await reviewSummary(db,c.id,3)});\n }\n if(path==='/api/v7/reviews'&&req.method==='GET'){const id=url.searchParams.get('company');await company(db,id);return json(await reviewSummary(db,id,url.searchParams.get('limit')||100))}\n let user;"""
worker=replace_once(worker,needle,repl,'public reviews route')
worker=replace_once(worker,"if(path==='/api/v6/subscription'&&req.method==='GET'){const id=url.searchParams.get('company');if(!await access(db,env,user,id))fail(403,'Нет доступа');return json({...await subscription(db,id),payment_url:env.SUBSCRIPTION_PAYMENT_URL||''})}","if(path==='/api/v6/subscription'&&req.method==='GET'){const id=url.searchParams.get('company');if(!await access(db,env,user,id))fail(403,'Нет доступа');return json({...await subscription(db,id),payment_url:env.SUBSCRIPTION_PAYMENT_URL||''})}\n if(path==='/api/v7/reviews'&&req.method==='POST'){return json(await createReview(db,user.id,await body(req)),201)}",'review post')
worker=replace_once(worker,"services:await services(db,privateCompany[1],true),short_base:shortBase(env),subscription:{...await subscription(db,privateCompany[1]),payment_url:env.SUBSCRIPTION_PAYMENT_URL||''}","services:await services(db,privateCompany[1],true),short_base:shortBase(env),reviews:await reviewSummary(db,privateCompany[1],3),subscription:{...await subscription(db,privateCompany[1]),payment_url:env.SUBSCRIPTION_PAYMENT_URL||''}",'private reviews')
worker=replace_once(worker,"services:await services(db,c.id,true),short_base:shortBase(env),subscription:{...await subscription(db,c.id),payment_url:env.SUBSCRIPTION_PAYMENT_URL||''}","services:await services(db,c.id,true),short_base:shortBase(env),reviews:await reviewSummary(db,c.id,3),subscription:{...await subscription(db,c.id),payment_url:env.SUBSCRIPTION_PAYMENT_URL||''}",'companies reviews')
worker=replace_once(worker,"LEFT JOIN booking_attendance a ON a.booking_id=b.id WHERE ${where}","LEFT JOIN booking_attendance a ON a.booking_id=b.id LEFT JOIN reviews r ON r.booking_id=b.id WHERE ${where}",'booking reviews join')
worker=replace_once(worker,"SELECT b.*,c.name AS company_name,COALESCE(a.state,'unknown') AS attendance_state,a.responded_at AS attendance_responded_at FROM bookings","SELECT b.*,c.name AS company_name,COALESCE(a.state,'unknown') AS attendance_state,a.responded_at AS attendance_responded_at,r.rating AS review_rating FROM bookings",'booking review select')
old_status="""  const results=await db.batch([db.prepare('UPDATE bookings SET status=?,status_event=? WHERE id=? AND status=?').bind(status,eventId,b.id,b.status),...await notices(db,b,status,[b.id,eventId]),...(status==='cancelled'?[db.prepare('DELETE FROM outbox WHERE id LIKE ? AND sent_at IS NULL AND attempts<5').bind(b.id+':reminder%')]:[])]);"""
new_status="""  const reviewRequest=status==='done'&&/^[0-9]+$/.test(String(b.user_id))&&policy.notifications.client_events!==false?[queue(db,`${b.id}:review-request:${eventId}`,b.user_id,JSON.stringify(messagePayload({...b,status:'done'},policy,'review_request',false)),[b.id,eventId])]:[];\n  const results=await db.batch([db.prepare('UPDATE bookings SET status=?,status_event=? WHERE id=? AND status=?').bind(status,eventId,b.id,b.status),...await notices(db,b,status,[b.id,eventId]),...reviewRequest,...(status==='cancelled'?[db.prepare('DELETE FROM outbox WHERE id LIKE ? AND sent_at IS NULL AND attempts<5').bind(b.id+':reminder%')]:[])]);"""
worker=replace_once(worker,old_status,new_status,'review request queue')
# /start and /help menu block
pattern=r" const message=command==='/id'\?[\s\S]*?return json\(\{method:'sendMessage',chat_id:m\.chat\.id,text:message,parse_mode:'HTML',reply_markup:\{inline_keyboard:\[\[\{text:'Открыть Takt'[\s\S]*?\}\}\);"
menu=r''' const helpUrl=new URL(appUrl.href);helpUrl.searchParams.set('guide','1');
 const supportDraft='Здравствуйте! Хочу обратиться в поддержку Takt.\nПроблема: ';
 const supportUrl=`https://t.me/${env.BOT_USERNAME||'takt_service_bot'}?text=${encodeURIComponent(supportDraft)}`;
 const message=command==='/id'?`Ваш Telegram ID: ${m.chat.id}`:command==='/help'?'<b>Как работает Takt</b>\n\n1. Специалист публикует услуги и расписание.\n2. Клиент выбирает услугу и свободное время.\n3. Takt хранит запись, подтверждение и напоминания в одном месте.':invited?`<b>Запись к ${escHtml(invited.name)}</b>\n\nВыберите услугу и удобное время в Takt.`:'<b>Добро пожаловать в Takt</b>\n\nОнлайн-запись, расписание и клиенты — в одном месте.';
 const keyboard=command==='/id'?[]:[[{text:'Открыть Takt',style:'primary',web_app:{url:appUrl.href}}],[{text:'Как это работает?',style:'success',web_app:{url:helpUrl.href}},{text:'Поддержка',style:'danger',url:supportUrl}],...(owners(env).includes(String(m.chat.id))?[[{text:'Админ-панель',web_app:{url:new URL('/?view=admin',appUrl).href}}]]:[])];
 return json({method:'sendMessage',chat_id:m.chat.id,text:message,parse_mode:'HTML',reply_markup:keyboard.length?{inline_keyboard:keyboard}:undefined});'''
worker=regex_once(worker,pattern,menu,'telegram welcome menu')
worker=replace_once(worker,"bot-webhook-v61","bot-webhook-v70",'webhook task')
worker=replace_once(worker,"bot-menu-v5","bot-menu-v70",'menu task')
write('src/worker.js',worker)

# ---------- delivery: button hierarchy + live message editing ----------
delivery=read('src/delivery.js')
# replace the button construction block only
delivery=regex_once(delivery,r"if\(meta\.admin&&meta\.event==='cancelled'\)\{payload\.reply_markup=[\s\S]*?if\(!meta\.admin&&route&&meta\.event==='client_2h'\)payload\.reply_markup\.inline_keyboard\.push\(\[\{text:'📍 Построить маршрут',url:route\}\]\);",r'''if(meta.event==='review_request'&&!meta.admin){payload.reply_markup={inline_keyboard:[[{text:'⭐ Оставить отзыв',style:'success',web_app:{url:make('review')}}],[{text:'Открыть специалиста',style:'primary',web_app:{url:new URL('/?company='+b.company_id,env.APP_URL||'https://takt.teymurstudent.workers.dev').href}}]]}}
else if(meta.admin&&meta.event==='cancelled'){payload.reply_markup={inline_keyboard:[[{text:'Открыть Takt',style:'primary',web_app:{url:env.APP_URL||'https://takt.teymurstudent.workers.dev'}}]]}}
else{payload.reply_markup={inline_keyboard:[[{text:meta.event==='cancelled'&&!meta.admin?'Выбрать другое время':meta.admin||reminder?'📋 Открыть запись':'Моя запись',style:'primary',web_app:{url:meta.event==='cancelled'&&!meta.admin?new URL('/?company='+b.company_id,env.APP_URL||'https://takt.teymurstudent.workers.dev').href:make()}}]]};if(meta.admin){payload.reply_markup.inline_keyboard.push([{text:meta.event==='master_2h'?'👤 Открыть клиента':'Открыть Takt',style:meta.event==='master_2h'?'success':'primary',web_app:{url:meta.event==='master_2h'?make('client'):(env.APP_URL||'https://takt.teymurstudent.workers.dev')}}])}}
if(meta.event==='reminder'&&b.starts_at>now()+c.cancel_hours*3600)payload.reply_markup.inline_keyboard.push([...(c.allow_reschedule?[{text:'Перенести',style:'primary',web_app:{url:make('move')}}]:[]),{text:'Отменить',style:'danger',web_app:{url:make('cancel')}}]);if(!meta.admin&&['reminder','client_2h'].includes(meta.event)&&visit.state==='unknown'){const rows=[[{text:'✅ Да, приду',style:'success',callback_data:`visit:${b.id}:yes`},{text:'❌ Не смогу',style:'danger',callback_data:`visit:${b.id}:no`}]];rows.push([...(meta.event==='reminder'&&c.allow_reschedule?[{text:'Перенести',style:'primary',web_app:{url:make('move')}}]:[]),{text:'Открыть запись',style:'primary',web_app:{url:make()}}]);payload.reply_markup={inline_keyboard:rows}}const route=c.map_url||(c.address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(c.address):'');if(!meta.admin&&route&&meta.event==='client_2h')payload.reply_markup.inline_keyboard.push([{text:'📍 Построить маршрут',style:'primary',url:route}]);''','delivery buttons')
old_send=""" try{const res=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:row.chat_id,...payload}),signal:AbortSignal.timeout(10000)}),data=await res.json();if(data.ok){await db.prepare('UPDATE outbox SET sent_at=? WHERE id=?').bind(now(),row.id).run();await record('sent');await contact(db,row.chat_id,'allowed')}else if(data.error_code===429||data.error_code>=500){const attempts=row.attempts+1;await db.prepare('UPDATE outbox SET attempts=?,lease_until=? WHERE id=?').bind(attempts,now()+Math.max(60,Math.min(86400,Number(data.parameters?.retry_after)||300)),row.id).run();await record(attempts>=5?'failed':'retry');await recordError(db,'telegram',String(data.error_code))}else{await record(data.error_code===403?'blocked':'failed');if(data.error_code===403)await contact(db,row.chat_id,'blocked');await recordError(db,'telegram',String(data.error_code||'REJECTED'))}}\n catch{await record('unknown');await recordError(db,'telegram','DELIVERY_UNKNOWN')}"""
new_send=""" try{const live=meta&&['created','confirmed','moved','cancelled','done'].includes(meta.event);let data=null;if(live){const saved=await db.prepare('SELECT message_id FROM telegram_booking_messages WHERE booking_id=? AND chat_id=?').bind(meta.booking,String(row.chat_id)).first();if(saved?.message_id){const edited=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageText`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:row.chat_id,message_id:saved.message_id,...payload}),signal:AbortSignal.timeout(10000)});data=await edited.json();if(data.ok||data.error_code===400&&/not modified/i.test(String(data.description||''))){await db.prepare('UPDATE outbox SET sent_at=? WHERE id=?').bind(now(),row.id).run();await db.prepare('UPDATE telegram_booking_messages SET updated_at=? WHERE booking_id=? AND chat_id=?').bind(now(),meta.booking,String(row.chat_id)).run();await record('sent');await contact(db,row.chat_id,'allowed');continue}}}const res=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:row.chat_id,...payload}),signal:AbortSignal.timeout(10000)});data=await res.json();if(data.ok){await db.prepare('UPDATE outbox SET sent_at=? WHERE id=?').bind(now(),row.id).run();if(live&&data.result?.message_id)await db.prepare('INSERT INTO telegram_booking_messages(booking_id,chat_id,message_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(booking_id,chat_id) DO UPDATE SET message_id=excluded.message_id,updated_at=excluded.updated_at').bind(meta.booking,String(row.chat_id),data.result.message_id,now()).run();await record('sent');await contact(db,row.chat_id,'allowed')}else if(data.error_code===429||data.error_code>=500){const attempts=row.attempts+1;await db.prepare('UPDATE outbox SET attempts=?,lease_until=? WHERE id=?').bind(attempts,now()+Math.max(60,Math.min(86400,Number(data.parameters?.retry_after)||300)),row.id).run();await record(attempts>=5?'failed':'retry');await recordError(db,'telegram',String(data.error_code))}else{await record(data.error_code===403?'blocked':'failed');if(data.error_code===403)await contact(db,row.chat_id,'blocked');await recordError(db,'telegram',String(data.error_code||'REJECTED'))}}\n catch{await record('unknown');await recordError(db,'telegram','DELIVERY_UNKNOWN')}"""
delivery=replace_once(delivery,old_send,new_send,'live message send')
write('src/delivery.js',delivery)

# ---------- frontend app ----------
app=read('public/app-v2.js')
for old,new in [('?v=62','?v=70')]: app=app.replace(old,new)
app=replace_once(app,"bookings:[],clients:[],blocks:[]","bookings:[],clients:[],blocks:[],reviews:[]",'state reviews')
app=replace_once(app,"['services','settings','share','analytics','subscription','profile'].includes(S.page)","['services','settings','share','analytics','reviews','subscription','profile'].includes(S.page)",'sidebar active reviews')
app=replace_once(app,"if(!isClient()&&['dashboard','calendar','clients','analytics'].includes(S.page)){await workData();if(S.page==='clients')S.clients=await api('/v2/clients?company='+S.own.id)}","if(!isClient()&&['dashboard','calendar','clients','analytics'].includes(S.page)){await workData();if(S.page==='clients')S.clients=await api('/v2/clients?company='+S.own.id)}\nif(!isClient()&&S.page==='reviews')S.reviews=(await api('/v7/reviews?company='+S.own.id+'&limit=100')).items",'load reviews')
app=replace_once(app,"share:sharePage,settings:settingsPage,subscription:subscriptionPage,analytics:analyticsPage","share:sharePage,settings:settingsPage,reviews:reviewsPage,subscription:subscriptionPage,analytics:analyticsPage",'pages reviews')
# guide=1 from Telegram menu
app=replace_once(app,"S.tour=!((S.prefs[S.mode+'_intro']||0)>=2||stored('tour-'+S.mode)==='2');S.tourStep=0;","S.tour=!((S.prefs[S.mode+'_intro']||0)>=2||stored('tour-'+S.mode)==='2');if(params.get('guide')==='1')S.tour=true;S.tourStep=0;",'guide param')
# linked review action
app=replace_once(app,"if(!id||!S.bookings.some(b=>b.id===id))return;visitActions(id);const action=p.get('action');","if(!id||!S.bookings.some(b=>b.id===id))return;const action=p.get('action');if(action==='review'){reviewEditor(id);return}visitActions(id);",'linked review')
# more reviews card
app=replace_once(app,"['analytics','calendar','Статистика','Завершённые и запланированные визиты'],['settings'","['analytics','calendar','Статистика','Завершённые и запланированные визиты'],['reviews','check','Отзывы','Оценка и отзывы после завершённых записей'],['settings'",'more reviews')
# timezone helper inserted before settings
zone_helpers=r'''const timezoneChoices=['Europe/Kaliningrad','Europe/Moscow','Europe/Samara','Asia/Yekaterinburg','Asia/Omsk','Asia/Krasnoyarsk','Asia/Irkutsk','Asia/Yakutsk','Asia/Vladivostok','Asia/Magadan','Asia/Kamchatka','Europe/Berlin','Asia/Dubai','Asia/Almaty','Asia/Tbilisi','Asia/Yerevan','America/New_York'];
function timezoneField(value){return `<label>Часовой пояс<input type="hidden" name="timezone" value="${esc(value)}"><button class="picker-field" type="button" id="timezone-picker"><span>${esc(zoneLabel(value))}</span><small>${esc(value)}</small></button><small>В этом поясе клиент видит время записи. Уже созданные встречи сохраняют свой момент времени.</small></label>`}
function timezonePicker(){const current=document.querySelector('[name="timezone"]')?.value||zone();const all=[...new Set([current,...timezoneChoices])];openSheet('Часовой пояс',`<label class="search-label timezone-search">${icon('search')}<input id="timezone-search" type="search" placeholder="Найти город или пояс" autocomplete="off"></label><div class="timezone-list">${all.map(z=>`<button type="button" class="timezone-option ${z===current?'selected':''}" data-timezone="${esc(z)}" data-search="${esc((zoneLabel(z)+' '+z).toLowerCase())}"><span>${esc(zoneLabel(z))}</span><small>${esc(z)}</small>${z===current?'✓':''}</button>`).join('')}</div>`)}
const starText=n=>'★★★★★'.slice(0,Math.max(0,Math.min(5,Number(n)||0)));
function reviewList(items){return items?.length?`<div class="review-list">${items.map(r=>`<article class="review-card"><div><strong>${esc(r.client_name||'Клиент')}</strong><span>${starText(r.rating)}</span></div>${r.text?`<p>${esc(r.text)}</p>`:''}<small>${esc(r.service_name||'')} · ${new Date(r.created_at*1000).toLocaleDateString('ru-RU')}</small></article>`).join('')}</div>`:'<p class="note">Отзывов пока нет.</p>'}
function reviewsPage(){const summary=S.own.reviews||{average:0,count:0};return `${heading('Отзывы','Отзывы только после завершённых записей.')}<section class="reviews-summary"><div><strong>${Number(summary.average||0).toFixed(1)}</strong><span>★</span></div><p>${summary.count||0} отзывов</p></section>${reviewList(S.reviews)}`}
function clientReviews(x){const r=x.reviews||{average:0,count:0,items:[]};if(!r.count)return '';return `<section class="public-reviews"><button type="button" data-all-reviews="${esc(x.id)}"><div><strong>${Number(r.average||0).toFixed(1)} ★</strong><span>${r.count} отзывов</span></div><span>Все отзывы →</span></button>${reviewList(r.items)}</section>`}
async function showReviews(id){openSheet('Отзывы',skeleton());try{const r=await api('/v7/reviews?company='+encodeURIComponent(id)+'&limit=100');openSheet(`Отзывы · ${r.count}`,`<section class="reviews-summary compact"><div><strong>${Number(r.average||0).toFixed(1)}</strong><span>★</span></div><p>${r.count} отзывов</p></section>${reviewList(r.items)}`)}catch(e){openSheet('Отзывы',`<p>${esc(e.message)}</p>`)}}
function reviewEditor(id){const b=S.bookings.find(x=>x.id===id);if(!b)return;if(b.review_rating){toast('Вы уже оставили отзыв');return}openSheet('Оставить отзыв',`<form id="review-form" data-booking="${esc(id)}"><p class="dialog-sub">${esc(b.service_name)} · ${dateLabel(date(b.starts_at))}</p><fieldset class="rating-field"><legend>Как всё прошло?</legend>${[5,4,3,2,1].map(n=>`<label><input type="radio" name="rating" value="${n}" required><span>${n} ★</span></label>`).join('')}</fieldset><label>Комментарий · по желанию<textarea name="text" maxlength="1200" placeholder="Расскажите о впечатлении"></textarea></label><div class="form-error" role="alert"></div><button class="primary wide" type="submit">Отправить отзыв</button></form>`)}
'''
app=replace_once(app,"function settingsPage(){",zone_helpers+"function settingsPage(){",'review timezone helpers')
# timezone select -> custom picker inside settings
app=regex_once(app,r"<label>Часовой пояс<select name=\"timezone\">\$\{\[\.\.\.new Set\(\[x\.timezone,[\s\S]*?</select><small>В этом поясе клиент видит время записи\. Уже созданные встречи сохраняют свой момент времени\.</small></label>","${timezoneField(x.timezone)}",'timezone field')
app=replace_once(app,"Версия Takt 6.2","Версия Takt 7.0",'settings version')
# client page: inject reviews before services
app=replace_once(app,"${location}<div class=\"section-heading\"><h2>Выберите услугу</h2>","${location}${clientReviews(x)}<div class=\"section-heading\"><h2>Выберите услугу</h2>",'client reviews')
# dashboard compact review block
marker="return `${heading('Добрый день, '+S.own.name,'Сегодня · '+dateLabel(day()))}"
insert="const rd=S.own.reviews||{average:0,count:0,items:[]},lastReview=rd.items?.[0],reviewBlock=rd.count?`<section class=\"dashboard-reviews\"><button data-page=\"reviews\"><span class=\"eyebrow\">ОТЗЫВЫ</span><strong>${Number(rd.average||0).toFixed(1)} ★ · ${rd.count}</strong><small>${lastReview?.text?esc(lastReview.text):'Посмотреть все отзывы'}</small></button></section>`:'';return `${heading('Добрый день, '+S.own.name,'Сегодня · '+dateLabel(day()))}"
app=replace_once(app,marker,insert,'dashboard review var')
app=replace_once(app,"${attentionBlock}${nextBlock}<div class=\"section-heading\"><h2>Быстрые действия</h2>","${attentionBlock}${nextBlock}${reviewBlock}<div class=\"section-heading\"><h2>Быстрые действия</h2>",'dashboard review render')
# client done action in visit sheet
app=replace_once(app,"<div class=\"sheet-actions\">${admin&&b.status==='pending'?","<div class=\"sheet-actions\">${!admin&&b.status==='done'&&!b.review_rating?`<button class=\"primary\" data-review=\"${b.id}\">⭐ Оставить отзыв</button>`:''}${admin&&b.status==='pending'?",'visit review button')
# click handlers
app=replace_once(app,"if(el.id==='timezone-picker')","if(el.id==='timezone-picker')",'noop guard') if "if(el.id==='timezone-picker')" in app else app
click_anchor="if(el.id==='retry-init'){await init();return}"
click_new="if(el.id==='timezone-picker'){timezonePicker();return}\nif(el.dataset.timezone){const input=document.querySelector('[name=\"timezone\"]'),btn=document.querySelector('#timezone-picker');if(input)input.value=el.dataset.timezone;if(btn){btn.querySelector('span').textContent=zoneLabel(el.dataset.timezone);btn.querySelector('small').textContent=el.dataset.timezone}sheet.close();return}\nif(el.dataset.allReviews){await showReviews(el.dataset.allReviews);return}\nif(el.dataset.review){reviewEditor(el.dataset.review);return}\n"+click_anchor
app=replace_once(app,click_anchor,click_new,'click v7')
# submit review
submit_anchor="if(form.id==='note-form'){await post('/v2/client-note',{company_id:S.own.id,client_id:form.dataset.client,note:b.note});sheet.close();await render();toast('Заметка сохранена');return}"
submit_new=submit_anchor+"\nif(form.id==='review-form'){await post('/v7/reviews',{booking_id:form.dataset.booking,rating:Number(b.rating),text:b.text||''});sheet.close();if(isClient())S.bookings=await api('/bookings');else{await refreshOwn();S.reviews=(await api('/v7/reviews?company='+S.own.id+'&limit=100')).items}await render();toast('Спасибо за отзыв');return}"
app=replace_once(app,submit_anchor,submit_new,'submit review')
# timezone search filter
app=replace_once(app,"if(['client-search','manual-search'].includes(e.target.id)){const q=e.target.value.toLowerCase();document.querySelectorAll('[data-search]').forEach(x=>x.hidden=!x.dataset.search.includes(q))}","if(['client-search','manual-search','timezone-search'].includes(e.target.id)){const q=e.target.value.toLowerCase();const scope=e.target.id==='timezone-search'?sheet:document;scope.querySelectorAll('[data-search]').forEach(x=>x.hidden=!x.dataset.search.includes(q))}",'search picker')
# back from reviews
app=replace_once(app,"['services','settings','share','analytics','subscription','profile'].includes(S.page)?'more':'dashboard'","['services','settings','share','analytics','reviews','subscription','profile'].includes(S.page)?'more':'dashboard'",'go back reviews')
write('public/app-v2.js',app)

# ---------- v7 responsive/premium UI ----------
write('public/takt-v7.css',r'''/* Takt 7.0 — device-specific responsive polish, compact calendar, reviews and modern controls. */
:root{--t7-blue:#2f5bea;--t7-blue-soft:#eef3ff;--t7-green:#26a866;--t7-red:#d93d4b;--t7-red-soft:#fff1f2;--t7-graphite:#202938;--t7-line:#e8ebf1}
html{scroll-behavior:smooth}body{background:#f7f8fa}.v2-main{min-width:0}.primary{background:linear-gradient(180deg,#3565f2,#2d57d9);box-shadow:0 8px 24px rgba(47,91,234,.13)}.primary:active{transform:translateY(1px)}
/* Modern close and form controls */
dialog .close,.dialog-head .close{width:38px!important;height:38px!important;min-width:38px!important;padding:0!important;border:0!important;border-radius:50%!important;background:#f1f3f7!important;color:#303746!important;display:grid!important;place-items:center!important;font-size:22px!important;line-height:1!important;box-shadow:none!important}.dialog-head .close:active{background:#e7eaf0!important;transform:scale(.96)}
input[type=checkbox]{appearance:none;-webkit-appearance:none;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;border:1.5px solid #c8cfda!important;border-radius:7px!important;background:#fff!important;display:inline-grid!important;place-items:center!important;box-shadow:none!important;outline:0!important;transition:.18s ease}input[type=checkbox]:checked{background:var(--t7-blue)!important;border-color:var(--t7-blue)!important}input[type=checkbox]:checked:after{content:'✓';color:#fff;font-size:14px;font-weight:900;line-height:1}input[type=checkbox]:focus-visible{outline:0!important;box-shadow:0 0 0 3px rgba(47,91,234,.12)!important}
select,.picker-field{width:100%;min-height:50px;border:1px solid var(--t7-line);border-radius:14px;background:#f8f9fb;color:var(--t7-graphite);font:inherit}.picker-field{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;text-align:left}.picker-field span{font-weight:700}.picker-field small{color:#8992a2;font-size:11px;overflow-wrap:anywhere}.timezone-search{position:sticky;top:0;z-index:2;margin-bottom:10px}.timezone-list{display:grid;gap:7px;max-height:min(60dvh,520px);overflow:auto;overscroll-behavior:contain;padding:2px}.timezone-option{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:center;width:100%;padding:13px 14px;border:1px solid var(--t7-line);border-radius:14px;background:#fff;text-align:left}.timezone-option span{font-weight:700}.timezone-option small{grid-column:1;color:#8a93a3}.timezone-option.selected{background:var(--t7-blue-soft);border-color:#cdd9ff;color:#244bc4}
/* Calendar cards never stretch to a neighbour's height */
.calendar-grid.week,.calendar-grid.month{align-items:start}.calendar-day{align-self:start;height:auto!important;min-height:0}.calendar-day.blank{background:transparent!important}.calendar-free{display:grid;place-items:center;min-height:82px;margin:7px 0 0;padding:14px;text-align:center;border:1px solid #ffd6da;border-radius:14px;background:var(--t7-red-soft);color:#b62c39;font-size:12px;font-weight:750}.calendar-event{box-shadow:none!important}.calendar-event.confirmed{background:#eff4ff;border-color:#6d8ff2}.calendar-event.pending{background:#fff8e7;border-color:#d4a642}.calendar-event.done{background:#eef8f2;border-color:#6caf82}
/* Reviews */
.reviews-summary{display:flex;align-items:center;gap:18px;padding:22px 24px;margin:0 0 16px;border:1px solid var(--t7-line);border-radius:22px;background:#fff}.reviews-summary>div{display:flex;align-items:baseline;gap:7px}.reviews-summary strong{font-size:40px;letter-spacing:-1.5px}.reviews-summary span{font-size:22px;color:#f0a000}.reviews-summary p{margin:0;color:#737d8d}.reviews-summary.compact{padding:15px 17px}.reviews-summary.compact strong{font-size:30px}.review-list{display:grid;gap:10px}.review-card{padding:18px;border:1px solid var(--t7-line);border-radius:18px;background:#fff}.review-card>div{display:flex;justify-content:space-between;gap:12px}.review-card>div span{color:#f0a000;letter-spacing:1px}.review-card p{margin:10px 0;color:#3e4757;line-height:1.6}.review-card small{color:#8b94a3}.public-reviews{margin:18px auto 28px;max-width:900px}.public-reviews>button{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:17px 18px;margin-bottom:10px;border:1px solid var(--t7-line);border-radius:18px;background:#fff;text-align:left}.public-reviews>button>div{display:grid;gap:2px}.public-reviews>button strong{font-size:20px}.public-reviews>button span{color:#707a8b;font-size:12px}.dashboard-reviews{margin:14px 0}.dashboard-reviews button{width:100%;display:grid;grid-template-columns:auto 1fr;gap:4px 16px;align-items:center;padding:16px 18px;border:1px solid var(--t7-line);border-radius:18px;background:#fff;text-align:left}.dashboard-reviews .eyebrow{grid-row:1/3}.dashboard-reviews strong{font-size:17px}.dashboard-reviews small{color:#7d8797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rating-field{border:0;padding:0;margin:20px 0}.rating-field legend{font-weight:750;margin-bottom:10px}.rating-field{display:flex;gap:7px;flex-wrap:wrap}.rating-field label input{position:absolute;opacity:0;pointer-events:none}.rating-field label span{display:block;padding:10px 12px;border:1px solid var(--t7-line);border-radius:12px;background:#fff;cursor:pointer}.rating-field label:has(input:checked) span{background:#fff6d9;border-color:#efc34c;color:#6d5200}
/* Compact intro hero: phone-first instead of desktop banner squeezed into a phone. */
@media(max-width:520px){
 .v2-main{padding:0 14px calc(92px + var(--safe-bottom))!important}.v2-top{height:72px!important;margin-bottom:8px!important}.page-title{align-items:flex-start;margin:10px 0 20px}.page-title h1{font-size:27px;letter-spacing:-.9px}.page-title>.primary,.page-title>.secondary{min-height:42px;padding:0 12px}.today-summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:14px 0}.today-summary>div{padding:14px 11px;border-radius:17px;gap:7px}.today-summary strong{font-size:22px}.today-summary span{font-size:10px}
 .v3-hero{display:block!important;min-height:0!important;padding:22px 18px!important;margin:0 -2px 18px!important;border-radius:24px!important}.v3-hero h1{font-size:clamp(34px,10vw,44px)!important;line-height:.98!important;margin:18px 0!important}.v3-hero>div:first-child>p{font-size:14px!important;line-height:1.55!important;margin-bottom:18px!important}.v3-hero .primary{width:100%!important}.v3-calendar-mock{margin-top:20px!important;padding:16px!important;border-radius:20px!important;transform:none!important}.intro-scroll{margin-top:14px!important}
 .quick-grid{grid-template-columns:1fr 1fr;gap:8px}.quick-grid>button{padding:16px;border-radius:17px;gap:14px}.visit-card{padding:16px 14px;gap:12px;border-radius:18px}.visit-time strong{font-size:20px}.visit-end{gap:8px}.visit-end>strong{display:none}
 .calendar-toolbar{align-items:stretch}.calendar-toolbar .segmented{width:100%;display:grid;grid-template-columns:repeat(3,1fr)}.calendar-toolbar .segmented button{padding:8px 4px}.date-controls{width:100%}.date-controls input{flex:1;max-width:none!important}.calendar-grid.week,.calendar-grid.month{grid-template-columns:repeat(2,minmax(0,1fr))!important;overflow:visible!important;padding:8px!important;gap:8px!important}.month-weekday,.calendar-day.blank{display:none!important}.calendar-day{padding:10px!important;border-radius:16px!important}.calendar-date{padding:4px 0 10px!important}.calendar-event{padding:11px!important}.calendar-free{min-height:64px;padding:10px}
 dialog{width:calc(100% - 16px)!important;max-width:none!important;margin:auto 8px 8px!important;border-radius:24px!important;max-height:88dvh!important}.dialog-head{padding-left:2px!important;padding-right:2px!important}.dialog-head h2{font-size:20px!important}.sheet-actions{display:grid!important;grid-template-columns:1fr!important}.editor-card{padding:20px 16px!important;border-radius:22px!important}.form-grid,.location-grid{grid-template-columns:1fr!important}.more-grid,.client-grid,.service-cards{grid-template-columns:1fr!important}.public-reviews{margin-top:12px}.review-card{padding:15px}.reviews-summary{padding:17px}.reviews-summary strong{font-size:34px}
}
/* Tablet gets its own density instead of a stretched phone layout. */
@media(min-width:521px) and (max-width:900px){
 .v2-main{padding-left:24px!important;padding-right:24px!important}.v2-sidebar{width:210px}.v2-layout:not(.simple){grid-template-columns:210px minmax(0,1fr)}.v2-layout:not(.simple) .v2-main{grid-column:2}.calendar-grid.week{grid-template-columns:repeat(3,minmax(0,1fr))!important;overflow:visible!important}.calendar-grid.month{grid-template-columns:repeat(4,minmax(0,1fr))!important;overflow:visible!important}.month-weekday,.calendar-day.blank{display:none!important}.quick-grid{grid-template-columns:repeat(2,1fr)}.v3-hero{grid-template-columns:minmax(0,1fr) minmax(260px,.72fr)!important;padding:34px!important}.v3-hero h1{font-size:52px!important}
}
/* Desktop keeps information density and full calendar. */
@media(min-width:901px){.calendar-grid.week,.calendar-grid.month{align-items:start}.calendar-day{align-self:start}.reviews-summary{max-width:760px}.review-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
''')

# ---------- index/version/cache ----------
index=read('public/index.html').replace('?v=61','?v=70')
if '/takt-v7.css' not in index:index=index.replace('</head>','<link rel="stylesheet" href="/takt-v7.css?v=70">\n</head>')
write('public/index.html',index)

pkg=json.loads(read('package.json'));pkg['version']='7.0.0';pkg['scripts']['check']=pkg['scripts']['check'].replace('src/v6.js','src/v6.js && node --check src/v7.js');write('package.json',json.dumps(pkg,ensure_ascii=False,separators=(',',':'))+'\n')
try:
 lock=json.loads(read('package-lock.json'));lock['version']='7.0.0';
 if isinstance(lock.get('packages'),dict) and '' in lock['packages']:lock['packages']['']['version']='7.0.0'
 write('package-lock.json',json.dumps(lock,ensure_ascii=False,indent=2)+'\n')
except Exception: pass

# ---------- tests ----------
write('test/v7.test.mjs',r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {messagePayload} from '../src/v3.js';

const company={id:'c1',name:'Studio',timezone:'Europe/Moscow',address:'',notifications:{}};
const booking={id:'b1',company_id:'c1',name:'Анна Петрова',phone:'+79990000000',service_name:'Услуга',price:1500,starts_at:1791226800,status:'done'};

test('review request uses universal Takt wording',()=>{const p=messagePayload(booking,company,'review_request',false);assert.match(p.text,/Как всё прошло\? ⭐/);assert.match(p.text,/Будем рады вашему отзыву/);assert.doesNotMatch(p.text,/Спасибо за встречу/)});
test('v7 migration has verified reviews and live message map',()=>{const sql=fs.readFileSync(new URL('../migrations/0007_takt_v7.sql',import.meta.url),'utf8');assert.match(sql,/CREATE TABLE IF NOT EXISTS reviews/);assert.match(sql,/booking_id TEXT PRIMARY KEY/);assert.match(sql,/telegram_booking_messages/)});
test('delivery edits primary booking messages',()=>{const s=fs.readFileSync(new URL('../src/delivery.js',import.meta.url),'utf8');assert.match(s,/editMessageText/);assert.match(s,/telegram_booking_messages/);assert.match(s,/review_request/)});
test('mobile calendar has device-specific layout',()=>{const css=fs.readFileSync(new URL('../public/takt-v7.css',import.meta.url),'utf8');assert.match(css,/@media\(max-width:520px\)/);assert.match(css,/calendar-grid\.week/);assert.match(css,/calendar-free/)});
''')

print('Takt 7.0 patch applied')
