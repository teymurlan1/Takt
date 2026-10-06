import {localizedBookings} from './content12.js';
import {icsResponse} from './v125.js';
import {admin11,publicContent,applyPromo,recordFunnel} from './v11.js';
import {adminRole} from './control-auth.js';
import {adminApi,config,legalVersions,isMainAdmin,enforceAccount,writeLimit,specialistAvailable,publicConfig,enabled,applyNotificationText} from './v10.js';
import {botEntry} from './bot-entry.js';
import {legalDoc,translateText} from '../public/i18n.js';
import {overview,resumeBlocked,contact,recordError,trackedTask} from './v5.js';
import {deliverMessages} from './delivery.js';
import {localDate,localMinute,fromLocal,dateShift,publicOptions,shortBase,escHtml,messagePayload,when} from './v3.js';
import {ensureSchema,enrichCompany,enrichService,services,v2} from './v2.js';
import {identify} from './auth.js';
import {subscription,setAttendance} from './v6.js';
import {reviewSummary,createReview} from './v7.js';
const now=()=>Math.floor(Date.now()/1000);
const securityHeaders={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Robots-Tag':'noindex, nofollow'};const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...securityHeaders}});const secure=response=>{const headers=new Headers(response.headers);for(const [k,v] of Object.entries(securityHeaders))headers.set(k,v);return new Response(response.body,{status:response.status,statusText:response.statusText,headers})};
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(s,m)=>{throw new HttpError(s,m)};
const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const owners=env=>(env.SUPERADMIN_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
const APP_LANGS=['ru','kk','az','uz'];
const LEGAL_VERSIONS={policy:'2026-10-05-v2',consent:'2026-10-05-v2',terms:'2026-10-05-v2'};
const BOT_COPY={
 ru:{open:'Открыть Takt',how:'Как это работает?',support:'Поддержка',first:'Добро пожаловать в Takt. Сначала выберите язык, ознакомьтесь с документами и настройте роль.',specialist:'Добро пожаловать в Takt — ваш сервис онлайн-записи.',client:'Добро пожаловать в Takt — ваши записи в одном месте.',invite:n=>`Добро пожаловать в онлайн-запись к ${n}.`,helpSpecialist:'<b>Как работает Takt для специалиста</b>\n\n1. Настройте услуги и расписание.\n2. Отправьте клиентам персональную ссылку.\n3. Подтверждайте записи в Telegram или приложении.\n4. Takt напомнит о визите и сохранит историю.',helpClient:'<b>Как работает Takt для клиента</b>\n\n1. Откройте ссылку специалиста.\n2. Выберите услугу и свободное время.\n3. Следите за статусом и напоминаниями в Telegram.'},
 kk:{open:'Takt ашу',how:'Қалай жұмыс істейді?',support:'Қолдау',first:'Takt-қа қош келдіңіз. Алдымен тілді таңдаңыз, құжаттармен танысыңыз және рөліңізді баптаңыз.',specialist:'Takt-қа қош келдіңіз — онлайн жазылу сервисіңіз.',client:'Takt-қа қош келдіңіз — жазбаларыңыз бір жерде.',invite:n=>`${n} маманына онлайн жазылуға қош келдіңіз.`,helpSpecialist:'<b>Takt маман үшін қалай жұмыс істейді</b>\n\n1. Қызметтер мен кестені баптаңыз.\n2. Клиенттерге жеке сілтемені жіберіңіз.\n3. Жазбаларды Telegram немесе қолданбада растаңыз.\n4. Takt еске салып, тарихты сақтайды.',helpClient:'<b>Takt клиент үшін қалай жұмыс істейді</b>\n\n1. Маманның сілтемесін ашыңыз.\n2. Қызмет пен бос уақытты таңдаңыз.\n3. Мәртебе мен еске салуларды Telegram-да бақылаңыз.'},
 az:{open:'Takt-ı aç',how:'Necə işləyir?',support:'Dəstək',first:'Takt-a xoş gəlmisiniz. Əvvəl dili seçin, sənədlərlə tanış olun və rolunuzu qurun.',specialist:'Takt-a xoş gəlmisiniz — onlayn qeyd xidmətiniz.',client:'Takt-a xoş gəlmisiniz — qeydləriniz bir yerdə.',invite:n=>`${n} üçün onlayn qeydə xoş gəlmisiniz.`,helpSpecialist:'<b>Takt mütəxəssis üçün necə işləyir</b>\n\n1. Xidmətləri və cədvəli qurun.\n2. Şəxsi linki müştərilərə göndərin.\n3. Qeydləri Telegram-da və ya tətbiqdə təsdiqləyin.\n4. Takt xatırladacaq və tarixçəni saxlayacaq.',helpClient:'<b>Takt müştəri üçün necə işləyir</b>\n\n1. Mütəxəssisin linkini açın.\n2. Xidmət və boş vaxt seçin.\n3. Status və xatırlatmaları Telegram-da izləyin.'},
 uz:{open:'Taktni ochish',how:'Qanday ishlaydi?',support:'Yordam',first:'Taktga xush kelibsiz. Avval tilni tanlang, hujjatlar bilan tanishing va rolingizni sozlang.',specialist:'Taktga xush kelibsiz — onlayn yozuv xizmatingiz.',client:'Taktga xush kelibsiz — yozuvlaringiz bir joyda.',invite:n=>`${n} mutaxassisiga onlayn yozuvga xush kelibsiz.`,helpSpecialist:'<b>Takt mutaxassis uchun qanday ishlaydi</b>\n\n1. Xizmatlar va jadvalni sozlang.\n2. Shaxsiy havolani mijozlarga yuboring.\n3. Yozuvlarni Telegram yoki ilovada tasdiqlang.\n4. Takt eslatadi va tarixni saqlaydi.',helpClient:'<b>Takt mijoz uchun qanday ishlaydi</b>\n\n1. Mutaxassis havolasini oching.\n2. Xizmat va bo‘sh vaqtni tanlang.\n3. Status va eslatmalarni Telegram-da kuzating.'}
};
const botCopy=lang=>BOT_COPY[APP_LANGS.includes(lang)?lang:'ru'];
const REVIEW_NOTICE={
 ru:{title:'⭐ Новый отзыв',empty:n=>`Клиент оставил оценку ${n} ★`,client:'Клиент',service:'Услуга',open:'Открыть Takt'},
 kk:{title:'⭐ Жаңа пікір',empty:n=>`Клиент ${n} ★ бағасын қалдырды`,client:'Клиент',service:'Қызмет',open:'Takt ашу'},
 az:{title:'⭐ Yeni rəy',empty:n=>`Müştəri ${n} ★ qiymət verdi`,client:'Müştəri',service:'Xidmət',open:'Takt-ı aç'},
 uz:{title:'⭐ Yangi fikr',empty:n=>`Mijoz ${n} ★ baho qoldirdi`,client:'Mijoz',service:'Xizmat',open:'Taktni ochish'}
};
const reviewCopy=lang=>REVIEW_NOTICE[APP_LANGS.includes(lang)?lang:'ru'];

async function appSetting(db,userId){return await db.prepare('SELECT * FROM user_app_settings WHERE user_id=?').bind(String(userId)).first()||null}
async function languageOf(db,userId){return (await appSetting(db,userId))?.language||'ru'}
function appButtonUrl(env,origin,params={}){const u=new URL(env.APP_URL||origin);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));return u.href}
function roleWelcome(env,origin,role,lang,companyRow=null){const L=botCopy(lang),context=companyRow?{company:companyRow.id}:{},base=appButtonUrl(env,origin,context),help=appButtonUrl(env,origin,{...context,guide:'1'}),support=appButtonUrl(env,origin,{...context,support:'1'}),text=role==='specialist'?L.specialist:companyRow?L.invite(companyRow.name):L.client;return {text:`<b>${escHtml(text)}</b>`,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:L.open,style:'primary',web_app:{url:base}}],[{text:L.how,style:'success',web_app:{url:help}},{text:L.support,style:'danger',web_app:{url:support}}]]}}}
async function body(req){if(Number(req.headers.get('content-length'))>140000)fail(413,'Слишком большой запрос');const raw=await req.text();if(raw.length>140000)fail(413,'Слишком большой запрос');try{return JSON.parse(raw)}catch{fail(400,'Некорректные данные')}}
async function access(db,env,user,company){return !!await db.prepare('SELECT 1 FROM memberships WHERE company_id=? AND user_id=?').bind(company,user.id).first()}
async function company(db,id){const c=await db.prepare('SELECT * FROM companies WHERE id=? AND active=1').bind(id).first();if(!c)fail(404,'Компания не найдена');return enrichCompany(db,c)}
export function dayBounds(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))fail(400,'Выберите дату');
 const start=Date.parse(`${date}T00:00:00+03:00`)/1000;
 if(!Number.isFinite(start)||new Date((start+10800)*1000).toISOString().slice(0,10)!==date)fail(400,'Некорректная дата');
 return [start,start+86400];
}
export function possibleSlots(c,s,date,busy,time=now()){
 dayBounds(date);const zone=c.timezone||'Europe/Moscow',day=fromLocal(date,0,zone);if(day>time+(c.horizon||90)*86400)return [];
 const weekday=new Date(date+'T12:00Z').getUTCDay(),hours=c.schedule?c.schedule[weekday]:{start:c.open_hour*60,end:c.close_hour*60};if(!hours)return [];const result=[],buffer=(c.buffer||0)*60;
 for(const h of Array.isArray(hours)?hours:[hours]){const begin=fromLocal(date,h.start,zone),end=fromLocal(date,h.end,zone);for(let t=begin;t+s.duration*60<=end;t+=900){if(Number.isFinite(t)&&t+s.duration*60<=end&&t>time+(c.min_notice??30)*60&&t<=time+(c.horizon||90)*86400&&!busy.some(b=>b.starts_at<t+s.duration*60+(b.blocked?0:buffer)&&b.ends_at+(b.blocked?0:buffer)>t))result.push(t)}}return [...new Set(result)].sort((a,b)=>a-b);
}
export async function availableSlots(db,c,s,date,exclude=''){
 dayBounds(date);const start=fromLocal(date,0,c.timezone),end=fromLocal(dateShift(date,1),0,c.timezone),buffer=(c.buffer||0)*60;
 const busy=(await db.prepare("SELECT starts_at,ends_at,0 AS blocked FROM bookings WHERE company_id=? AND id<>? AND status IN ('pending','confirmed') AND starts_at<? AND ends_at>? UNION ALL SELECT starts_at,ends_at,1 AS blocked FROM blocked_slots WHERE company_id=? AND starts_at<? AND ends_at>?").bind(c.id,exclude,end+buffer,start-buffer,c.id,end,start).all()).results;return possibleSlots(c,s,date,busy);
}
const queue=(db,id,chat,message,guard=null)=>guard ? db.prepare('INSERT OR IGNORE INTO outbox(id,chat_id,text,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status_event=?)').bind(id,chat,message,now(),...guard) : db.prepare('INSERT OR IGNORE INTO outbox(id,chat_id,text,created_at) VALUES(?,?,?,?)').bind(id,chat,message,now());
function stamp(t){return new Date(t*1000).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}
async function notices(db,b,event,guard=null,previous=null){
 const c=await company(db,b.company_id),kind=event.startsWith('moved-')?'moved':event;
 const members=await db.prepare("SELECT m.user_id,COALESCE(NULLIF(s.language,''),'ru') language FROM memberships m LEFT JOIN user_app_settings s ON s.user_id=m.user_id WHERE m.company_id=?").bind(b.company_id).all();
 const clientLang=await languageOf(db,b.user_id);
 return [...(b.visit_outcome!=='no_show'&&/^[0-9]+$/.test(b.user_id)&&c.notifications.client_events!==false?[queue(db,`${b.id}:${event}:client`,b.user_id,JSON.stringify(await applyNotificationText(db,messagePayload(b,c,kind,false,previous,clientLang))),guard)]:[]),...(c.notifications[kind]!==false?await Promise.all(members.results.filter(m=>m.user_id!==b.user_id).map(async m=>queue(db,`${b.id}:${event}:${m.user_id}`,m.user_id,JSON.stringify(await applyNotificationText(db,messagePayload(b,c,kind,true,previous,m.language||'ru'))),guard))):[])];
}

async function attendanceNotices(db,b,state){
 const c=await company(db,b.company_id),members=await db.prepare("SELECT m.user_id,COALESCE(NULLIF(s.language,''),'ru') language FROM memberships m LEFT JOIN user_app_settings s ON s.user_id=m.user_id WHERE m.company_id=?").bind(b.company_id).all(),event=state==='coming'?'attendance_yes':'attendance_no';
 return members.results.filter(m=>m.user_id!==b.user_id).map(m=>queue(db,`${b.id}:attendance:${state}:${b.starts_at}:${m.user_id}`,m.user_id,JSON.stringify(messagePayload({...b,attendance_state:state},c,event,true,null,m.language||'ru'))));
}
async function respondAttendance(db,userId,bookingId,state){
 const b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first();if(!b)fail(404,'Запись не найдена');if(String(b.user_id)!==String(userId))fail(403,'Нет доступа');if(!['pending','confirmed'].includes(b.status))fail(409,'Запись уже изменена');const c=await company(db,b.company_id);
 if(b.starts_at<=now())fail(409,'Визит уже начался');if(state==='coming'){const previous=await db.prepare('SELECT state FROM booking_attendance WHERE booking_id=?').bind(b.id).first();if(previous?.state==='coming')return {ok:true,attendance_state:'coming',booking_status:b.status,late:false};await setAttendance(db,b.id,'coming');const q=await attendanceNotices(db,b,'coming');if(q.length)await db.batch(q);return {ok:true,attendance_state:'coming',booking_status:b.status,late:false}}
 if(state!=='not_coming')fail(400,'Неизвестный ответ');const late=b.starts_at<=now()+(await config(db)).cancel_hours*3600;
 if(!late){const eventId=crypto.randomUUID(),changed=await db.prepare("UPDATE bookings SET status='cancelled',status_event=? WHERE id=? AND status=?").bind(eventId,b.id,b.status).run();if(!changed.meta.changes)fail(409,'Запись уже изменена');await setAttendance(db,b.id,'not_coming');await db.batch([...await notices(db,b,'cancelled',[b.id,eventId]),db.prepare('DELETE FROM outbox WHERE id LIKE ? AND sent_at IS NULL').bind(b.id+':%reminder%'),db.prepare('DELETE FROM outbox WHERE id LIKE ? AND sent_at IS NULL').bind(b.id+':%2h:%')]);return {ok:true,attendance_state:'not_coming',booking_status:'cancelled',late:false}}
 await setAttendance(db,b.id,'not_coming');const q=await attendanceNotices(db,b,'not_coming');if(q.length)await db.batch(q);return {ok:true,attendance_state:'not_coming',booking_status:b.status,late:true};
}
async function webhookSecret(env){
 if(!env.BOT_TOKEN)fail(503,'Токен бота не настроен');
 const enc=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',enc.encode(env.BOT_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode('takt:telegram-webhook:v1'))),b=>b.toString(16).padStart(2,'0')).join('');
}
async function telegram(env,method,payload){
 let data;
 try{const r=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});data=await r.json()}catch{fail(502,'Telegram временно недоступен. Повторите подключение.')}
 if(!data.ok)fail(502,'Telegram не принял настройки. Проверьте BOT_TOKEN и повторите подключение.');
 return data.result;
}
async function webhook(req,env){
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const expected=await webhookSecret(env),given=req.headers.get('X-Telegram-Bot-Api-Secret-Token')||'';
 let diff=expected.length^given.length;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^(given.charCodeAt(i)||0);
 if(diff)fail(403,'Forbidden');
 const update=await body(req),m=update.message,cb=update.callback_query;await ensureSchema(env.DB);if(Number.isSafeInteger(update.update_id)){const inserted=await env.DB.prepare('INSERT OR IGNORE INTO telegram_updates VALUES(?,?)').bind(update.update_id,now()).run();if(!inserted.meta.changes)return json({ok:true})}
 if(cb?.id&&Number.isSafeInteger(cb.from?.id)&&typeof cb.data==='string'){
  if(cb.data.startsWith('entry:')){const payload=await botEntry(env,new URL(req.url).origin,String(cb.from.id),null,cb.data);await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id});return json({method:cb.message?.message_id?'editMessageText':'sendMessage',chat_id:cb.from.id,...(cb.message?.message_id?{message_id:cb.message.message_id}:{}),...payload})}
  await enforceAccount(env.DB,String(cb.from.id));
  const visit=cb.data.match(/^visit:([a-z0-9-]+):(yes|no)(?::([0-9]+))?$/);if(visit){try{const current=await env.DB.prepare('SELECT starts_at FROM bookings WHERE id=?').bind(visit[1]).first();if(!current||visit[3]&&Number(visit[3])!==current.starts_at)fail(409,'Запись уже перенесена. Откройте её заново');if(!visit[3]){const moved=await env.DB.prepare("SELECT MAX(created_at) t FROM outbox WHERE id LIKE ?").bind(visit[1]+':moved-%').first();if(moved?.t&&(!cb.message?.date||cb.message.date<=moved.t))fail(409,'Откройте актуальную запись');}const result=await respondAttendance(env.DB,String(cb.from.id),visit[1],visit[2]==='yes'?'coming':'not_coming'),feedback=result.attendance_state==='coming'?'✅ Вы подтвердили визит':result.late?'⚠️ Вы сообщили, что не сможете прийти. Специалист уведомлён.':'❌ Запись отменена';await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:result.attendance_state==='coming'?'Спасибо, визит подтверждён ✅':result.late?'Специалист уведомлён':'Запись отменена'});if(cb.message?.chat?.id&&cb.message?.message_id){const original=String(cb.message.text||'Напоминание о записи').replace(/\n\n(?:✅ Вы подтвердили визит|⚠️ Вы сообщили[\s\S]*|❌ Запись отменена)$/,'');await telegram(env,'editMessageText',{chat_id:cb.message.chat.id,message_id:cb.message.message_id,text:(original+'\n\n'+feedback).slice(0,4096),reply_markup:{inline_keyboard:[]}}).catch(()=>{});}}catch(e){await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:e.message||'Не удалось сохранить ответ',show_alert:true}).catch(()=>{});}return json({ok:true})}
  const action=cb.data.match(/^booking:([a-z0-9-]+):(confirm|decline)$/);if(action){try{const userId=String(cb.from.id),b=await env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(action[1]).first();if(!b)fail(404,'Запись не найдена');if(!await env.DB.prepare('SELECT 1 FROM memberships WHERE company_id=? AND user_id=?').bind(b.company_id,userId).first())fail(403,'Эта запись другого специалиста');if(b.status!=='pending')fail(409,'Запись уже обработана');const status=action[2]==='confirm'?'confirmed':'cancelled',eventId=crypto.randomUUID(),ops=[env.DB.prepare('UPDATE bookings SET status=?,status_event=? WHERE id=? AND status=?').bind(status,eventId,b.id,'pending'),...await notices(env.DB,b,status,[b.id,eventId])];if(status==='cancelled')ops.push(env.DB.prepare('DELETE FROM outbox WHERE id LIKE ? AND sent_at IS NULL').bind(b.id+':%reminder%'));const result=await env.DB.batch(ops);if(!result[0].meta.changes)fail(409,'Запись уже обработана');await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:status==='confirmed'?'Запись подтверждена ✅':'Запись отклонена'});await deliver(env);}catch(e){await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:e.message||'Не удалось изменить запись',show_alert:true}).catch(()=>{});}return json({ok:true})}
 }
 if(m?.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id<=0)return json({ok:true});
 if(m.from?.id)await env.DB.prepare('INSERT INTO telegram_profiles(user_id,username,first_name,last_name,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,last_name=excluded.last_name,updated_at=excluded.updated_at').bind(String(m.from.id),text(m.from.username||'',32),text(m.from.first_name||'',80),text(m.from.last_name||'',80),now()).run();
 await resumeBlocked(env.DB,m.chat.id);await contact(env.DB,m.chat.id,'allowed');
 const command=typeof m.text==='string'?m.text.trim().split(/\s+/)[0].split('@')[0]:'';
 if(!['/start','/help','/id'].includes(command))return json({ok:true});
 const appUrl=new URL(env.APP_URL||new URL(req.url).origin);if(appUrl.protocol!=='https:')fail(503,'Укажите HTTPS адрес приложения');
 const referral=typeof m.text==='string'?m.text.trim().split(/\s+/)[1]:'';let invited=null;
 if(referral&&/^(master_|c_|u_)[a-z0-9-]+$/.test(referral)){let id=referral.replace(/^(master_|c_|u_)/,'');if(referral.startsWith('u_'))id=(await env.DB.prepare('SELECT company_id FROM specialist_handles WHERE handle=?').bind(id).first())?.company_id;try{invited=await company(env.DB,id)}catch{}if(invited)appUrl.searchParams.set('company',invited.id)}
 if(command==='/start')return json({method:'sendMessage',chat_id:m.chat.id,...await botEntry(env,new URL(req.url).origin,String(m.chat.id),invited)});
 const setting=await appSetting(env.DB,String(m.chat.id)),lang=setting?.language||'ru',L=botCopy(lang),role=invited?'client':setting?.role||'',consentCurrent=setting?.policy_version===LEGAL_VERSIONS.policy&&setting?.consent_version===LEGAL_VERSIONS.consent&&setting?.terms_version===LEGAL_VERSIONS.terms;
 const helpUrl=new URL(appUrl.href);helpUrl.searchParams.set('guide','1');const supportUrl=new URL(appUrl.href);supportUrl.searchParams.set('support','1');
 let message;if(command==='/id')message=`Telegram ID: ${m.chat.id}`;else if(command==='/help')message=role==='specialist'?L.helpSpecialist:L.helpClient;else if(!setting?.language||!consentCurrent||!role&&!invited)message=`<b>${escHtml(L.first)}</b>`;else message=`<b>${escHtml(role==='specialist'?L.specialist:invited?L.invite(invited.name):L.client)}</b>`;
 const keyboard=command==='/id'?[]:[[{text:L.open,style:'primary',web_app:{url:appUrl.href}}],[{text:L.how,style:'success',web_app:{url:helpUrl.href}},{text:L.support,style:'danger',web_app:{url:supportUrl.href}}],...(isMainAdmin(env,String(m.chat.id))?[[{text:'Админ-панель',web_app:{url:new URL('/?view=admin',appUrl).href}}]]:[])];
 return json({method:'sendMessage',chat_id:m.chat.id,text:message,parse_mode:'HTML',reply_markup:keyboard.length?{inline_keyboard:keyboard}:undefined});

}

export async function api(req,env){
 const url=new URL(req.url),path=url.pathname,db=env.DB;
 if(path==='/api/telegram/webhook')return webhook(req,env);
 if(path==='/api/health')return json({ok:true,version:'12.5.0'});
 if(!db)fail(503,'База ещё не подключена');
 if(path!=='/api/telegram/setup')await ensureSchema(db);
 if(path==='/api/v11/content'&&req.method==='GET')return json(await publicContent(db,new URL(req.url).searchParams.get('language')||'ru'));
 if(path==='/api/v10/public'&&req.method==='GET')return json(await publicConfig(db,'',env));
 if(path==='/api/v2/resolve'){const handle=url.searchParams.get('username')||'';const row=await db.prepare('SELECT company_id FROM specialist_handles WHERE handle=?').bind(handle).first();if(!row)fail(404,'Страница не найдена. Проверьте ссылку специалиста');return json({company_id:row.company_id})}
 const publicCompany=path.match(/^\/api\/v2\/page\/([a-z0-9-]+)$/);
 if(publicCompany&&req.method==='GET'){
  const c=await company(db,publicCompany[1]);
  return json({...publicOptions(c),services:await services(db,c.id),reviews:await reviewSummary(db,c.id,3)});
 }
 if(path==='/api/v7/reviews'&&req.method==='GET'){const id=text(url.searchParams.get('company'),80);if(!/^[a-z0-9-]{1,80}$/.test(id))fail(400,'Некорректный кабинет');await company(db,id);return json(await reviewSummary(db,id,url.searchParams.get('limit')||50,url.searchParams.get('sort')||'new'))}
 let user;try{user=await identify(req,env)}catch{fail(401,'Откройте приложение через Telegram. Если оно уже открыто — закройте и откройте снова.')}
 if(path==='/api/v125/ics'&&req.method==='GET')return icsResponse(db,user,url.searchParams.get('booking'),c=>access(db,env,user,c));
 if(path!=='/api/telegram/setup'){await enforceAccount(db,user.id);if(!['GET','HEAD'].includes(req.method))await writeLimit(db,user.id);}
 const controlResponse=await admin11(req,env,user,{json,body});if(controlResponse)return controlResponse;
 if(path==='/api/v10/admin/specialist'&&req.method==='POST'){const action=await body(req.clone());if(['extend','trial'].includes(action.action))return admin11(new Request(new URL('/api/v11/admin/subscription',req.url),{method:'POST',headers:req.headers,body:JSON.stringify(action)}),env,user,{json,body});}
 const adminResponse=await adminApi(req,env,user,{json,body});if(adminResponse)return adminResponse;
 if(path==='/api/v10/invite'&&req.method==='GET'){const id=text(url.searchParams.get('company'),80);await company(db,id);const o=await db.prepare('SELECT s.language FROM memberships m LEFT JOIN user_app_settings s ON s.user_id=m.user_id WHERE m.company_id=? ORDER BY m.rowid LIMIT 1').bind(id).first();return json({language:APP_LANGS.includes(o?.language)?o.language:'ru'})}
 if(path==='/api/v10/config'&&req.method==='GET')return json(await publicConfig(db,user.id,env));
 if(path==='/api/v11/promo'&&req.method==='POST')return json(await applyPromo(db,user,await body(req)));
 if(path==='/api/v11/funnel'&&req.method==='POST')return json(await recordFunnel(db,user,await body(req)));
 if(path==='/api/v5/admin'&&req.method==='GET'){if(!isMainAdmin(env,user.id))fail(403,'Нет доступа');return json({...await overview(db),bot_configured:!!env.BOT_TOKEN})}
 if(path==='/api/v5/notifications'&&req.method==='POST'){await resumeBlocked(db,user.id);return json({ok:true})}
 if(path==='/api/v5/notifications'&&req.method==='GET'){return json({state:(await db.prepare('SELECT state FROM telegram_contacts WHERE user_id=?').bind(user.id).first())?.state||'unknown',allows_write:user.allows_write===true})}
 if(path==='/api/v6/attendance'&&req.method==='POST'){const b=await body(req),result=await respondAttendance(db,user.id,text(b.booking_id,80),b.state);return json(result)}
 if(path==='/api/v6/subscription'&&req.method==='GET'){const id=url.searchParams.get('company');if(!await access(db,env,user,id))fail(403,'Нет доступа');return json({...await subscription(db,id),payment_url:env.SUBSCRIPTION_PAYMENT_URL||''})}
 if(path==='/api/v7/reviews'&&req.method==='POST'){
  const reviewInput=await body(req.clone()),reviewTenant=await db.prepare('SELECT company_id FROM bookings WHERE id=? AND user_id=?').bind(text(reviewInput.booking_id,80),user.id).first();if(!enabled(await config(db),'reviews',user.id,reviewTenant?.company_id))fail(403,'Функция временно недоступна');
  const data=await body(req),result=await createReview(db,user.id,data),bookingId=text(data.booking_id,80),b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first(),c=b?await company(db,b.company_id):null,clientLang=await languageOf(db,user.id),saved=b?await db.prepare('SELECT message_id FROM telegram_review_messages WHERE booking_id=? AND chat_id=?').bind(b.id,String(user.id)).first():null,review=b?await db.prepare('SELECT rating,text FROM reviews WHERE booking_id=?').bind(b.id).first():null;
  if(b&&c){
   const appUrl=env.APP_URL||url.origin,L=clientLang==='kk'?['Пікіріңізге рақмет 💙','Пікір жарияланды және басқа клиенттерге маманды жақсырақ тануға көмектеседі.','Takt ашу','Маманды ашу']:clientLang==='az'?['Rəyiniz üçün təşəkkür edirik 💙','Rəy dərc olundu və digər müştərilərə mütəxəssisi daha yaxşı tanımağa kömək edir.','Takt-ı aç','Mütəxəssisi aç']:clientLang==='uz'?['Fikringiz uchun rahmat 💙','Fikr e’lon qilindi va boshqa mijozlarga mutaxassisni yaxshiroq bilishga yordam beradi.','Taktni ochish','Mutaxassisni ochish']:['Спасибо за отзыв 💙','Он уже опубликован в профиле специалиста и поможет другим клиентам сделать выбор.','Открыть Takt','Открыть специалиста'],payload={chat_id:user.id,text:`<b>${L[0]}</b>\n\n${L[1]}`,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:L[2],style:'primary',web_app:{url:appUrl}}],[{text:L[3],style:'success',web_app:{url:new URL('/?company='+b.company_id,appUrl).href}}]]}};let edited=false;if(saved?.message_id){try{await telegram(env,'editMessageText',{...payload,message_id:saved.message_id});edited=true}catch{}}if(!edited)await queue(db,`review-thanks:${b.id}:${now()}`,user.id,JSON.stringify({text:payload.text,parse_mode:'HTML',reply_markup:payload.reply_markup})).run();
   const members=(await db.prepare("SELECT m.user_id,COALESCE(NULLIF(s.language,''),'ru') language FROM memberships m LEFT JOIN user_app_settings s ON s.user_id=m.user_id WHERE m.company_id=?").bind(b.company_id).all()).results,ops=[];for(const member of members){if(String(member.user_id)===String(user.id))continue;const R=reviewCopy(member.language),comment=text(review?.text||'',180),body=comment?`“${escHtml(comment)}”`:R.empty(review?.rating||result.rating),openUrl=appButtonUrl(env,url.origin,{view:'reviews'});ops.push(queue(db,`review-notice:${b.id}:${member.user_id}`,member.user_id,JSON.stringify({text:`<b>${R.title}</b>\n\n<b>${review?.rating||result.rating} ★</b>\n${body}\n\n${R.client}: ${escHtml(b.name)}\n${R.service}: ${escHtml(b.service_name)}`,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:R.open,style:'primary',web_app:{url:openUrl}}]]}})))}if(ops.length)await db.batch(ops);
  }
  return json(result,201)
 }
if(path==='/api/v8/profile'){
  const LEGAL_VERSIONS=await legalVersions(db);
  const existing=await appSetting(db,user.id),membership=await db.prepare('SELECT company_id FROM memberships WHERE user_id=? LIMIT 1').bind(user.id).first(),clientLink=await db.prepare('SELECT company_id FROM client_links WHERE user_id=? ORDER BY last_seen DESC LIMIT 1').bind(user.id).first(),inferred=membership?'specialist':clientLink?'client':'';
  if(req.method==='GET'){const x=existing||{};return json({language:x.language||'',role:x.role||inferred||'',theme:x.theme||'light',consent_at:x.consent_at||null,policy_version:x.policy_version||'',consent_version:x.consent_version||'',terms_version:x.terms_version||'',consent_current:x.policy_version===LEGAL_VERSIONS.policy&&x.consent_version===LEGAL_VERSIONS.consent&&x.terms_version===LEGAL_VERSIONS.terms,versions:LEGAL_VERSIONS})}
  if(req.method==='POST'){const data=await body(req),current=existing||{},language=data.language===undefined?(current.language||''):text(data.language,4),theme=data.theme===undefined?(current.theme||'light'):text(data.theme,12),requestedRole=data.role===undefined?(current.role||inferred||''):text(data.role,12);if(language&&!APP_LANGS.includes(language))fail(400,'Неизвестный язык');if(!['system','light','dark'].includes(theme))fail(400,'Неизвестная тема');if(requestedRole&&!['client','specialist'].includes(requestedRole))fail(400,'Неизвестная роль');if(current.role&&data.role&&current.role!==data.role)fail(409,'Роль уже выбрана');let companyRow=null;if(data.company_id){try{companyRow=await company(db,text(data.company_id,80))}catch{fail(404,'Специалист не найден')}}const accept=data.consent===true,policy=accept?LEGAL_VERSIONS.policy:(current.policy_version||''),consent=accept?LEGAL_VERSIONS.consent:(current.consent_version||''),terms=accept?LEGAL_VERSIONS.terms:(current.terms_version||''),consentAt=accept?now():(current.consent_at||null);if(accept&&!language)fail(400,'Сначала выберите язык');await db.prepare('INSERT INTO user_app_settings(user_id,language,role,theme,policy_version,consent_version,terms_version,consent_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language,role=CASE WHEN user_app_settings.role=\'\' THEN excluded.role ELSE user_app_settings.role END,theme=excluded.theme,policy_version=excluded.policy_version,consent_version=excluded.consent_version,terms_version=excluded.terms_version,consent_at=excluded.consent_at,updated_at=excluded.updated_at').bind(user.id,language,requestedRole,theme,policy,consent,terms,consentAt,now()).run();if(env.BOT_TOKEN&&language)try{await telegram(env,'setChatMenuButton',{chat_id:user.id,menu_button:{type:'web_app',text:botCopy(language).open,web_app:{url:appButtonUrl(env,url.origin,{})}}})}catch{}if(!current.role&&requestedRole){const welcome=roleWelcome(env,url.origin,requestedRole,language||'ru',companyRow);await queue(db,`welcome-v8:${user.id}:${requestedRole}:${companyRow?.id||'home'}`,user.id,JSON.stringify(welcome)).run()}return json({ok:true,language,role:requestedRole,theme,consent_current:policy===LEGAL_VERSIONS.policy&&consent===LEGAL_VERSIONS.consent&&terms===LEGAL_VERSIONS.terms,versions:LEGAL_VERSIONS})}
 }
 if(path==='/api/v8/subscription-stats'&&req.method==='GET'){const id=text(url.searchParams.get('company'),80);if(!await access(db,env,user,id))fail(403,'Нет доступа');const since=now()-30*86400,stats=await db.prepare("SELECT COUNT(*) bookings,COUNT(DISTINCT user_id) clients FROM bookings WHERE company_id=? AND created_at>=?").bind(id,since).first(),notifications=await db.prepare("SELECT COUNT(*) n FROM outbox WHERE created_at>=? AND json_valid(text) AND json_extract(text,'$.takt.company')=?").bind(since,id).first();return json({period_days:30,bookings:Number(stats?.bookings||0),clients:Number(stats?.clients||0),notifications:Number(notifications?.n||0)})}
if(path==='/api/v72/support'&&req.method==='POST'){
  if(!(await publicConfig(db,user.id,env)).flags.help)fail(403,'Функция временно недоступна');
  const data=await body(req),message=text(data.message,1500);if(message.length<5)fail(400,'Опишите проблему чуть подробнее');const admins=owners(env);if(!admins.length)fail(503,'Поддержка временно недоступна');
  const recent=await db.prepare('SELECT COUNT(*) n FROM support_requests WHERE user_id=? AND created_at>?').bind(user.id,now()-600).first();if(Number(recent?.n||0)>=3)fail(429,'Подождите немного перед новым обращением');
  const membership=await db.prepare('SELECT m.company_id,c.name FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.user_id=? AND c.active=1 ORDER BY c.rowid LIMIT 1').bind(user.id).first(),id=crypto.randomUUID(),role=membership?'специалист':'клиент';
  const bodyText=`🛟 <b>Новое обращение в Takt</b>\n\nОт: ${escHtml(user.name||'Пользователь')}\nРоль: ${role}${membership?`\nКабинет: ${escHtml(membership.name)}`:''}\nTelegram ID: <code>${escHtml(user.id)}</code>\n\n${escHtml(message)}`;
  await db.batch([db.prepare('INSERT INTO support_requests(id,user_id,company_id,message,created_at) VALUES(?,?,?,?,?)').bind(id,user.id,membership?.company_id||null,message,now()),...admins.map(admin=>queue(db,`support:${id}:${admin}`,admin,JSON.stringify({text:bodyText,parse_mode:'HTML'})))]);return json({ok:true});
 }
 if(path==='/api/v72/client-message'&&req.method==='POST')fail(410,'Переписка через Takt отключена. Используйте личный Telegram клиента.');
 if(path.startsWith('/api/v2/')){const response=await v2(req,env,user,{json,body,access,company,slots:availableSlots,notices,dayBounds});if(response)return response}
 const privateCompany=path.match(/^\/api\/companies\/([a-z0-9-]+)$/);if(privateCompany&&req.method==='GET'){if(!await access(db,env,user,privateCompany[1]))fail(403,'Нет доступа');return json({...await company(db,privateCompany[1]),services:await services(db,privateCompany[1],true),short_base:shortBase(env),reviews:await reviewSummary(db,privateCompany[1],3),subscription:{...await subscription(db,privateCompany[1]),payment_url:env.SUBSCRIPTION_PAYMENT_URL||''}})}
 if(path==='/api/companies'&&req.method==='GET'){
  const cs=await db.prepare('SELECT c.* FROM companies c JOIN memberships m ON m.company_id=c.id WHERE m.user_id=? AND c.active=1 ORDER BY c.rowid').bind(user.id).all();
  const result=[];for(const c of cs.results)result.push({...await enrichCompany(db,c),services:await services(db,c.id,true),short_base:shortBase(env),reviews:await reviewSummary(db,c.id,3),subscription:{...await subscription(db,c.id),payment_url:env.SUBSCRIPTION_PAYMENT_URL||''}});
  return json(result);
 }
 if(path==='/api/register'&&req.method==='POST'){
  const own=await db.prepare('SELECT c.id FROM companies c JOIN memberships m ON m.company_id=c.id WHERE m.user_id=? AND c.active=1 ORDER BY c.rowid LIMIT 1').bind(user.id).first();if(own)return json({id:own.id});
  const b=await body(req),name=text(b.name,80),address=text(b.address,200),phone=text(b.phone,24),tagline=text(b.tagline,160),serviceName=text(b.service_name,120);
  if(name.length<2||!['beauty','cleaning','auto'].includes(b.category)||serviceName.length<2)fail(400,'Укажите название, сферу и первую услугу');
  if(!Number.isInteger(b.open_hour)||!Number.isInteger(b.close_hour)||b.open_hour<0||b.close_hour>24||b.open_hour>=b.close_hour)fail(400,'Проверьте часы работы');
  if(!Number.isInteger(b.price)||b.price<0||b.price>1000000||!Number.isInteger(b.duration)||b.duration<30||b.duration>480||b.duration%30)fail(400,'Проверьте цену и длительность (шаг 30 минут)');
  // Stable ID makes retries and concurrent registration atomic: one new business per account.
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('takt-business:'+user.id));
  const id='m-'+Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('').slice(0,32);
  const existing=await db.prepare('SELECT id FROM companies WHERE id=?').bind(id).first();if(existing)return json({id});
  await db.batch([
   db.prepare('INSERT OR IGNORE INTO companies(id,name,category,tagline,address,phone,open_hour,close_hour) VALUES(?,?,?,?,?,?,?,?)').bind(id,name,b.category,tagline||'Запись в удобное для вас время',address,phone,b.open_hour,b.close_hour),
   db.prepare('INSERT OR IGNORE INTO memberships(company_id,user_id) VALUES(?,?)').bind(id,user.id),
   db.prepare('INSERT OR IGNORE INTO registrations VALUES(?,?)').bind(id,now()),
   db.prepare('INSERT OR IGNORE INTO services(id,company_id,name,price,duration) VALUES(?,?,?,?,?)').bind('s-'+id,id,serviceName,b.price,b.duration)
  ]);
  return json({id},201);
 }
 if(path==='/api/services'&&req.method==='POST'){
  const b=await body(req);if(!await access(db,env,user,b.company_id))fail(403,'Нет доступа');await company(db,b.company_id);
  const name=text(b.name,120);if(name.length<2||!Number.isInteger(b.price)||b.price<0||b.price>1000000||!Number.isInteger(b.duration)||b.duration<30||b.duration>480||b.duration%30)fail(400,'Проверьте цену и длительность (шаг 30 минут)');
  if(!/^[a-zA-Z0-9-]{8,80}$/.test(b.request_key||''))fail(400,'Повторите добавление услуги');
  const id=b.company_id+'-'+b.request_key.toLowerCase();
  await db.prepare('INSERT OR IGNORE INTO services(id,company_id,name,price,duration) VALUES(?,?,?,?,?)').bind(id,b.company_id,name,b.price,b.duration).run();return json({id},201);
 }
 if(path==='/api/telegram/setup'&&req.method==='POST'){
  if(!isMainAdmin(env,user.id))fail(403,'Только владелец сервиса может подключить бота');
  const appUrl=new URL(env.APP_URL||url.origin);
  if(appUrl.protocol!=='https:')fail(400,'Подключение доступно на опубликованном HTTPS сайте');
  const secret=await webhookSecret(env);
  await telegram(env,'setWebhook',{url:new URL('/api/telegram/webhook',appUrl).href,secret_token:secret,allowed_updates:['message','callback_query']});
  await telegram(env,'setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть Takt',web_app:{url:appUrl.href}}});
  await telegram(env,'setMyCommands',{commands:[{command:'start',description:'Открыть Такт'},{command:'help',description:'Как пользоваться'},{command:'id',description:'Мой Telegram ID'}]});
  await telegram(env,'setMyDescription',{description:"Такт — ваше дело в вашем ритме.\n\nДля мастеров и компаний\nСоздайте кабинет, добавьте услуги и часы работы. Отправьте клиентам свою ссылку на запись. Управляйте заявками в журнале.\n\nДля клиентов\nОткройте ссылку мастера, выберите услугу и время. Ваши записи и история — в приложении, подтверждения и напоминания — в Telegram.\n\nНажмите «Открыть Takt», чтобы начать."});
  await telegram(env,'setMyShortDescription',{short_description:'Такт — запись на услуги в Telegram. Клиентам — удобное время и напоминания, компаниям — управление заявками.'});
  const info=await telegram(env,'getWebhookInfo',{});
  if(info.url!==new URL('/api/telegram/webhook',appUrl).href)fail(502,'Не удалось проверить подключение. Повторите попытку.');
  return json({ok:true});
 }
 if(path==='/api/v4/contact'&&req.method==='GET'){const id=url.searchParams.get('company');await company(db,id);return json(await db.prepare('SELECT name,phone FROM bookings WHERE company_id=? AND user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(id,user.id).first()||{})}
 if(path==='/api/v4/delivery'&&req.method==='GET'){const id=url.searchParams.get('company');if(!await access(db,env,user,id))fail(403,'Нет доступа');const rows=(await db.prepare("SELECT COALESCE(d.state,'unknown') state,COUNT(*) n FROM outbox o LEFT JOIN delivery_state d ON o.id=d.id WHERE o.chat_id=? AND COALESCE(d.updated_at,o.created_at)>? AND (d.state IS NOT NULL OR (o.attempts=5 AND o.sent_at IS NULL)) AND CASE WHEN json_valid(o.text) THEN json_extract(o.text,'$.takt.company') END=? GROUP BY COALESCE(d.state,'unknown')").bind(user.id,now()-86400,id).all()).results;return json(Object.fromEntries(rows.map(x=>[x.state,x.n])))}
 if(path==='/api/me'){
  await db.batch([db.prepare('INSERT INTO account_activity VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen').bind(user.id,now(),now()),db.prepare('INSERT INTO telegram_profiles(user_id,username,first_name,last_name,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,last_name=excluded.last_name,updated_at=excluded.updated_at').bind(user.id,text(user.username||'',32),text(user.first_name||user.name||'',80),text(user.last_name||'',80),now())]);if(user.allows_write){await resumeBlocked(db,user.id);await contact(db,user.id,'allowed');}
  const memberships=await db.prepare('SELECT company_id FROM memberships WHERE user_id=?').bind(user.id).all(),app=await appSetting(db,user.id);
  return json({...user,owner:!!(await adminRole(db,env,user.id)),admin_role:await adminRole(db,env,user.id),companies:memberships.results.map(m=>m.company_id),app:app?{language:app.language,role:app.role,theme:app.theme,consent_at:app.consent_at}:null});
 }
 if((path==='/api/slots'||path==='/api/next-slot'||path==='/api/availability')&&req.method==='GET'){
  const c=await company(db,url.searchParams.get('company'));
  const moving=url.searchParams.get('booking');let s,exclude='';if(moving){const b=await db.prepare('SELECT * FROM bookings WHERE id=? AND company_id=?').bind(moving,c.id).first();if(!b||b.user_id!==user.id&&!await access(db,env,user,c.id))fail(403,'Нет доступа');s={duration:(b.ends_at-b.starts_at)/60};exclude=b.id}else{s=await enrichService(db,await db.prepare('SELECT * FROM services WHERE id=? AND company_id=? AND active=1').bind(url.searchParams.get('service'),c.id).first());if(!s)fail(404,'Услуга не найдена')}
  const date=url.searchParams.get('date');if(path==='/api/availability'){dayBounds(date);const days=Math.min(42,Math.max(1,Number(url.searchParams.get('days'))||14)),start=fromLocal(date,0,c.timezone),end=fromLocal(dateShift(date,days),0,c.timezone),buffer=c.buffer*60;if(date<dateShift(localDate(now(),c.timezone),-31)||date>dateShift(localDate(now(),c.timezone),181))fail(400,'Выберите дату в периоде записи');const busy=(await db.prepare("SELECT starts_at,ends_at,0 blocked FROM bookings WHERE company_id=? AND id<>? AND status IN ('pending','confirmed') AND starts_at<? AND ends_at>? UNION ALL SELECT starts_at,ends_at,1 blocked FROM blocked_slots WHERE company_id=? AND starts_at<? AND ends_at>?").bind(c.id,exclude,end+buffer,start-buffer,c.id,end,start).all()).results;return json(Array.from({length:days},(_,i)=>{const d=dateShift(date,i),slots=possibleSlots(c,s,d,busy);return {date:d,count:slots.length,first:slots[0]||null}}))}if(path==='/api/next-slot'){dayBounds(date);const limit=dateShift(localDate(now(),c.timezone),c.horizon),start=fromLocal(date,0,c.timezone),end=fromLocal(dateShift(limit,1),0,c.timezone),buffer=c.buffer*60;const busy=(await db.prepare("SELECT starts_at,ends_at,0 blocked FROM bookings WHERE company_id=? AND id<>? AND status IN ('pending','confirmed') AND starts_at<? AND ends_at>? UNION ALL SELECT starts_at,ends_at,1 blocked FROM blocked_slots WHERE company_id=? AND starts_at<? AND ends_at>?").bind(c.id,exclude,end+buffer,start-buffer,c.id,end,start).all()).results;for(let d=dateShift(date,1);d<=limit;d=dateShift(d,1)){const found=possibleSlots(c,s,d,busy);if(found.length)return json({date:d,starts_at:found[0]})}return json({date:null,reason:date>limit?'horizon':'no_availability',last_date:limit})}return json(await availableSlots(db,c,s,date,exclude));
 }
 if(path==='/api/bookings'&&req.method==='GET'){
  const scope=url.searchParams.get('scope'),c=url.searchParams.get('company');
  let where='b.user_id=?',value=user.id;
  if(scope==='company'){if(!await access(db,env,user,c))fail(403,'Нет доступа');where='b.company_id=?';value=c}
  if(scope==='owner')fail(403,'Используйте свой кабинет');
  const rows=(await db.prepare(`SELECT b.*,(SELECT outcome FROM booking_outcomes WHERE booking_id=b.id) visit_outcome,c.name AS company_name,COALESCE(a.state,'unknown') AS attendance_state,a.responded_at AS attendance_responded_at,r.rating AS review_rating FROM bookings b JOIN companies c ON c.id=b.company_id LEFT JOIN booking_attendance a ON a.booking_id=b.id LEFT JOIN reviews r ON r.booking_id=b.id WHERE ${where} ORDER BY b.starts_at DESC LIMIT 500`).bind(value).all()).results;return json(await localizedBookings(db,rows));
 }
 if(path==='/api/bookings'&&req.method==='POST'){
  const b=await body(req),c=await company(db,b.company_id);if(b.manual&&!await access(db,env,user,c.id))fail(403,'Нет доступа');let bookingUser=b.manual?'manual-'+c.id+'-'+text(b.phone,24).replace(/\D/g,''):user.id;
  if(b.manual&&b.client_id){if(!await db.prepare('SELECT 1 FROM bookings WHERE company_id=? AND user_id=? UNION SELECT 1 FROM client_links WHERE company_id=? AND user_id=? LIMIT 1').bind(c.id,b.client_id,c.id,b.client_id).first())fail(403,'Нет доступа к клиенту');bookingUser=b.client_id}if(!/^[a-zA-Z0-9-]{8,80}$/.test(b.request_key||''))fail(400,'Повторите оформление');
  const old=await db.prepare('SELECT * FROM bookings WHERE user_id=? AND request_key=? AND company_id=?').bind(bookingUser,b.request_key,c.id).first();if(old)return json(old);
  const s=await enrichService(db,await db.prepare('SELECT * FROM services WHERE id=? AND company_id=? AND active=1').bind(b.service_id,c.id).first());if(!s)fail(400,'Услуга недоступна');
  const name=text(b.name,80),phone=text(b.phone,24),details=text(b.details,1200),start=Number(b.starts_at);
  if(name.length<2||!/^[+\d\s()-]{10,24}$/.test(phone)||phone.replace(/\D/g,'').length<10)fail(400,'Проверьте имя и телефон');
  if(!Number.isInteger(start)||start<=now()+c.min_notice*60||start>now()+c.horizon*86400)fail(400,'Выберите доступное время в расписании');
  const date=localDate(start,c.timezone);
  if(!(await availableSlots(db,c,s,date)).includes(start))fail(409,'Время вне расписания или уже занято');
  if(['cleaning','auto'].includes(c.category)&&details.length<5)fail(400,c.category==='cleaning'?'Укажите адрес и площадь':'Укажите автомобиль и задачу');
  const count=await db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE user_id=? AND starts_at>? AND status IN ('pending','confirmed')").bind(user.id,now()).first();if(!b.manual&&count.n>=10)fail(429,'У вас уже 10 активных записей');
  if(b.manual&&!await access(db,env,user,c.id))fail(403,'Нет доступа');
  await specialistAvailable(db,c.id);
  const booking={id:crypto.randomUUID(),company_id:c.id,service_id:s.id,user_id:bookingUser,name,phone,details,starts_at:start,ends_at:start+s.duration*60,price:s.price,service_name:s.name,status:'pending',created_at:now(),request_key:b.request_key};
  try{await db.batch([db.prepare('INSERT INTO bookings(id,company_id,service_id,user_id,name,phone,details,starts_at,ends_at,price,service_name,status,created_at,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...Object.values(booking)),...await notices(db,booking,'created'),...(!b.manual||/^[0-9]+$/.test(bookingUser)?[db.prepare('INSERT INTO client_links(user_id,company_id,created_at,last_seen) VALUES(?,?,?,?) ON CONFLICT(user_id,company_id) DO UPDATE SET last_seen=excluded.last_seen').bind(bookingUser,c.id,now(),Date.now())]:[])]);}
  catch(e){if(String(e).includes('PLAN_LIMIT'))fail(403,'Специалист временно не принимает новые записи. Свяжитесь с ним');if(String(e).includes('SLOT_TAKEN'))fail(409,'Это время только что заняли. Выберите другое.');if(String(e).includes('UNIQUE')){const retry=await db.prepare('SELECT * FROM bookings WHERE user_id=? AND request_key=? AND company_id=?').bind(bookingUser,b.request_key,c.id).first();if(retry)return json(retry);fail(409,'Повторите оформление записи')}throw e}
  return json(booking,201);
 }
 const bookingMatch=path.match(/^\/api\/bookings\/([a-z0-9-]+)$/);
 if(bookingMatch&&req.method==='PATCH'){
  const b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingMatch[1]).first();if(!b)fail(404,'Запись не найдена');
  const admin=await access(db,env,user,b.company_id),data=await body(req),status=data.status==='no_show'?'done':data.status;
  const policy=await company(db,b.company_id);if(!admin&&status==='cancelled'&&b.user_id===user.id&&b.starts_at<=now()+(await config(db)).cancel_hours*3600)fail(403,'Поздняя отмена согласовывается со специалистом. Напишите ему');if(!admin&&(b.user_id!==user.id||status!=='cancelled'||b.starts_at<=now()+(await config(db)).cancel_hours*3600))fail(403,'Нет доступа');
  if(b.status===status){const previousOutcome=(await db.prepare('SELECT outcome FROM booking_outcomes WHERE booking_id=?').bind(b.id).first())?.outcome;if(status!=='done'||previousOutcome===(data.status==='no_show'?'no_show':'done'))return json({ok:true});}
  if(!({pending:['confirmed','cancelled'],confirmed:['done','cancelled']}[b.status]||[]).includes(status))fail(409,'Статус уже изменился. Обновите список.');
  const noShow=data.status==='no_show';
  // Atomic compare-and-set: only one operator can transition the same status.
  const eventId=crypto.randomUUID();
  const reviewLang=await languageOf(db,b.user_id),reviewRequest=status==='done'&&!noShow&&/^[0-9]+$/.test(String(b.user_id))&&policy.notifications.client_events!==false?[queue(db,`${b.id}:review-request:${eventId}`,b.user_id,JSON.stringify(messagePayload({...b,status:'done'},policy,'review_request',false,null,reviewLang)),[b.id,eventId])]:[];
  const results=await db.batch([db.prepare('UPDATE bookings SET status=?,status_event=? WHERE id=? AND status=?').bind(status,eventId,b.id,b.status),...await notices(db,{...b,status,visit_outcome:noShow?'no_show':status==='done'?'done':null},status,[b.id,eventId]),...reviewRequest,...(status==='done'?[db.prepare('INSERT INTO booking_outcomes SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status_event=?) ON CONFLICT(booking_id) DO UPDATE SET outcome=excluded.outcome,updated_at=excluded.updated_at').bind(b.id,noShow?'no_show':'done',now(),b.id,eventId)]:[]),...(status==='cancelled'?[db.prepare('DELETE FROM outbox WHERE id LIKE ? AND sent_at IS NULL AND attempts<5').bind(b.id+':reminder%')]:[])]);
  if(!results[0].meta.changes)fail(409,'Статус уже изменился');return json({ok:true});
 }
 const companyMatch=path.match(/^\/api\/companies\/([a-z0-9-]+)$/);
 if(companyMatch&&req.method==='PATCH'){
  const id=companyMatch[1];if(!await access(db,env,user,id))fail(403,'Нет доступа');
  const c=await company(db,id),b=await body(req),name=text(b.name,80),address=text(b.address,200),phone=text(b.phone,24),tagline=text(b.tagline??c.tagline,160);
  if(name.length<2||!Number.isInteger(b.open_hour)||!Number.isInteger(b.close_hour)||b.open_hour<0||b.close_hour>24||b.open_hour>=b.close_hour)fail(400,'Проверьте название и часы работы');
  await db.prepare('UPDATE companies SET name=?,address=?,phone=?,open_hour=?,close_hour=?,tagline=? WHERE id=?').bind(name,address,phone,b.open_hour,b.close_hour,tagline,c.id).run();return json({ok:true});
 }
 const serviceMatch=path.match(/^\/api\/services\/([a-z0-9-]+)$/);
 if(serviceMatch&&req.method==='PATCH'){
  const s=await db.prepare('SELECT * FROM services WHERE id=?').bind(serviceMatch[1]).first();if(!s)fail(404,'Услуга не найдена');if(!await access(db,env,user,s.company_id))fail(403,'Нет доступа');
  const b=await body(req),name=text(b.name,120);
  if(name.length<2||!Number.isInteger(b.price)||b.price<0||b.price>1000000||!Number.isInteger(b.duration)||b.duration<30||b.duration>480||b.duration%30)fail(400,'Проверьте цену и длительность (шаг 30 минут)');
  await db.prepare('UPDATE services SET name=?,price=?,duration=? WHERE id=?').bind(name,b.price,b.duration,s.id).run();return json({ok:true});
 }
 if(path==='/api/memberships'&&req.method==='POST'){
  if(!isMainAdmin(env,user.id))fail(403,'Нет доступа');const b=await body(req);await company(db,b.company_id);
  if(!/^[1-9]\d{3,15}$/.test(b.user_id||''))fail(400,'Введите числовой Telegram ID');
  await db.prepare('INSERT OR IGNORE INTO memberships(company_id,user_id) VALUES(?,?)').bind(b.company_id,b.user_id).run();return json({ok:true});
 }
 fail(404,'Не найдено');
}
export async function deliver(env){return deliverMessages(env,{ensureSchema,company,enrichCompany,queue})}
export default {
 async fetch(req,env,ctx){try{if(new URL(req.url).pathname==='/documents'){await ensureSchema(env.DB);const u=new URL(req.url),lang=['ru','kk','az','uz'].includes(u.searchParams.get('lang'))?u.searchParams.get('lang'):'ru',[title,parts]=legalDoc(u.searchParams.get('type'),lang);return new Response('<!doctype html><html lang="'+lang+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escHtml(title)+'</title><style>body{font:16px/1.7 system-ui;max-width:760px;padding:24px;margin:auto;color:#172033}h1{font-size:28px}</style><h1>'+escHtml(title)+'</h1>'+parts.map(x=>'<p>'+escHtml(x)+'</p>').join('')+'</html>',{headers:{'Content-Type':'text/html; charset=utf-8',...securityHeaders}})}if(new URL(req.url).pathname.startsWith('/api/')){const result=await api(req,env);if(result.ok&&['POST','PATCH'].includes(req.method)&&/\/api\/(bookings|v2\/reschedule|v7\/reviews|v72\/support|v8\/profile|v6\/attendance)/.test(new URL(req.url).pathname))ctx?.waitUntil(deliver(env));return result;}const url=new URL(req.url);if(/^\/[a-z][a-z0-9-]{2,31}$/.test(url.pathname)){await ensureSchema(env.DB);const handle=url.pathname.slice(1),row=await env.DB.prepare('SELECT company_id FROM specialist_handles WHERE handle=?').bind(handle).first();if(row)return Response.redirect(`https://t.me/${env.BOT_USERNAME||'takt_service_bot'}?startapp=u_${encodeURIComponent(handle)}`,302)}return secure(await env.ASSETS.fetch(req))}catch(e){if(e instanceof HttpError||Number.isInteger(e.status)){let lang='ru';try{const u=await identify(req,env);lang=await languageOf(env.DB,u.id)}catch{}return json({error:translateText(e.message,lang)},e.status);}console.error('Request failed',e.name);if(env.DB)await recordError(env.DB,'api','REQUEST_FAILED');let lang='ru';try{const u=await identify(req,env);lang=await languageOf(env.DB,u.id)}catch{}return json({error:translateText('Не удалось выполнить запрос. Попробуйте ещё раз.',lang)},500)}},
 async scheduled(_event,env,ctx){await ensureSchema(env.DB);ctx.waitUntil((async()=>{const botBase=new URL(env.APP_URL||'https://takt.taktapp.workers.dev').origin,hookTask='bot-webhook:'+botBase,menuTask='bot-menu:'+botBase;if(env.BOT_TOKEN&&!await env.DB.prepare("SELECT 1 FROM task_runs WHERE name=? AND state='ok'").bind(hookTask).first()){try{await trackedTask(env.DB,hookTask,async()=>{const secret=await webhookSecret(env),appUrl=new URL(env.APP_URL||'https://takt.taktapp.workers.dev');await telegram(env,'setWebhook',{url:new URL('/api/telegram/webhook',appUrl).href,secret_token:secret,allowed_updates:['message','callback_query']})})}catch{}}if(env.BOT_TOKEN&&!await env.DB.prepare("SELECT 1 FROM task_runs WHERE name=? AND state='ok'").bind(menuTask).first()){try{await trackedTask(env.DB,menuTask,()=>telegram(env,'setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть Takt',web_app:{url:env.APP_URL||'https://takt.taktapp.workers.dev'}}}))}catch{}}await trackedTask(env.DB,'notifications',()=>deliver(env))})())}
};

