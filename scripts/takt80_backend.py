from pathlib import Path
import re, json

ROOT=Path('.')
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s):
    q=ROOT/p; q.parent.mkdir(parents=True,exist_ok=True); q.write_text(s,encoding='utf-8')
def replace_once(s,old,new,label):
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    return s.replace(old,new,1)
def regex_once(s,pattern,repl,label,flags=re.S):
    out,n=re.subn(pattern,lambda _m: repl,s,count=1,flags=flags)
    if n!=1: raise SystemExit(f'{label}: expected 1 regex match, got {n}')
    return out

# ---- v3 defaults + localized Telegram booking messages ----
v3=read('src/v3.js')
v3=replace_once(v3,"horizon:30","horizon:90",'default horizon')
new_tail=r'''const localeByLang={ru:'ru-RU',kk:'kk-KZ',az:'az-AZ',uz:'uz-UZ'};
const telegramText={
 ru:{created_admin:'🆕 Новая запись',created_client:'🟡 Запись создана',confirmed:'✅ Запись подтверждена',cancelled:'❌ Запись отменена',done:'🏁 Запись завершена',review_request:'Как всё прошло? ⭐',client_2h:'⏰ До записи 2 часа',master_2h:'👤 Клиент через 2 часа',master_reminder:'⏳ Скоро следующий клиент',reminder:'🔔 Подтвердите визит',moved:'🔄 Запись перенесена',attendance_yes:'✅ Клиент подтвердил визит',attendance_no:'❌ Клиент не сможет прийти',client:'Клиент',specialist:'Специалист',phone:'Телефон',created_client_note:'Специалист подтвердит запись в Takt.',created_admin_note:'Подтвердите запись, когда будете готовы принять клиента.',cancel_admin_note:'Время снова доступно для записи.',confirm_visit:'Пожалуйста, подтвердите, что вы придёте.',see_you:'До встречи.',was:'Было',became:'Стало',tomorrow:'Завтра, '},
 kk:{created_admin:'🆕 Жаңа жазба',created_client:'🟡 Жазба жасалды',confirmed:'✅ Жазба расталды',cancelled:'❌ Жазба тоқтатылды',done:'🏁 Жазба аяқталды',review_request:'Қалай өтті? ⭐',client_2h:'⏰ Жазбаға 2 сағат қалды',master_2h:'👤 Клиент 2 сағаттан кейін',master_reminder:'⏳ Келесі клиент жақында',reminder:'🔔 Келуді растаңыз',moved:'🔄 Жазба ауыстырылды',attendance_yes:'✅ Клиент келетінін растады',attendance_no:'❌ Клиент келе алмайды',client:'Клиент',specialist:'Маман',phone:'Телефон',created_client_note:'Маман жазбаны Takt ішінде растайды.',created_admin_note:'Клиентті қабылдай алсаңыз, жазбаны растаңыз.',cancel_admin_note:'Уақыт қайтадан жазылуға қолжетімді.',confirm_visit:'Келетініңізді растаңыз.',see_you:'Кездескенше.',was:'Бұрын',became:'Енді',tomorrow:'Ертең, '},
 az:{created_admin:'🆕 Yeni qeyd',created_client:'🟡 Qeyd yaradıldı',confirmed:'✅ Qeyd təsdiqləndi',cancelled:'❌ Qeyd ləğv edildi',done:'🏁 Qeyd tamamlandı',review_request:'Necə keçdi? ⭐',client_2h:'⏰ Qeydə 2 saat qalıb',master_2h:'👤 Müştəri 2 saatdan sonra',master_reminder:'⏳ Növbəti müştəri yaxındadır',reminder:'🔔 Gəlişi təsdiqləyin',moved:'🔄 Qeyd köçürüldü',attendance_yes:'✅ Müştəri gələcəyini təsdiqlədi',attendance_no:'❌ Müştəri gələ bilməyəcək',client:'Müştəri',specialist:'Mütəxəssis',phone:'Telefon',created_client_note:'Mütəxəssis qeydi Takt-da təsdiqləyəcək.',created_admin_note:'Müştərini qəbul edə bilirsinizsə, qeydi təsdiqləyin.',cancel_admin_note:'Vaxt yenidən qeyd üçün açıqdır.',confirm_visit:'Zəhmət olmasa gələcəyinizi təsdiqləyin.',see_you:'Görüşənədək.',was:'Əvvəl',became:'İndi',tomorrow:'Sabah, '},
 uz:{created_admin:'🆕 Yangi yozuv',created_client:'🟡 Yozuv yaratildi',confirmed:'✅ Yozuv tasdiqlandi',cancelled:'❌ Yozuv bekor qilindi',done:'🏁 Yozuv yakunlandi',review_request:'Qanday o‘tdi? ⭐',client_2h:'⏰ Yozuvgacha 2 soat',master_2h:'👤 Mijoz 2 soatdan keyin',master_reminder:'⏳ Keyingi mijoz yaqin',reminder:'🔔 Tashrifni tasdiqlang',moved:'🔄 Yozuv ko‘chirildi',attendance_yes:'✅ Mijoz kelishini tasdiqladi',attendance_no:'❌ Mijoz kela olmaydi',client:'Mijoz',specialist:'Mutaxassis',phone:'Telefon',created_client_note:'Mutaxassis yozuvni Takt ichida tasdiqlaydi.',created_admin_note:'Mijozni qabul qila olsangiz, yozuvni tasdiqlang.',cancel_admin_note:'Vaqt yana yozilish uchun ochiq.',confirm_visit:'Kelishingizni tasdiqlang.',see_you:'Ko‘rishguncha.',was:'Oldin',became:'Endi',tomorrow:'Ertaga, '}
};
const tgLang=lang=>telegramText[lang]||telegramText.ru;
export function when(t,zone,lang='ru'){const locale=localeByLang[lang]||localeByLang.ru;return {date:new Date(t*1000).toLocaleDateString(locale,{timeZone:zone,day:'numeric',month:'long'}),time:new Date(t*1000).toLocaleTimeString(locale,{timeZone:zone,hour:'2-digit',minute:'2-digit'})}}
export function messagePayload(b,c,event,admin=false,previous=null,lang='ru'){
 const L=tgLang(lang),w=when(b.starts_at,c.timezone,lang),money=new Intl.NumberFormat(localeByLang[lang]||'ru-RU').format(b.price)+' ₽';
 const title=event==='created'?(admin?L.created_admin:L.created_client):(L[event]||L.moved);
 if(event==='review_request')return {text:`<b>${L.review_request}</b>\n\n${lang==='ru'?'Будем рады вашему отзыву — он поможет специалисту становиться лучше, а другим клиентам сделать выбор.':lang==='kk'?'Пікіріңіз маманға жақсара түсуге, ал басқа клиенттерге таңдау жасауға көмектеседі.':lang==='az'?'Rəyiniz mütəxəssisə inkişaf etməyə, digər müştərilərə isə seçim etməyə kömək edəcək.':'Fikringiz mutaxassisga yaxshilanishga, boshqa mijozlarga esa tanlov qilishga yordam beradi.'}\n\n${escHtml(c.name)} · ${escHtml(b.service_name)}`,parse_mode:'HTML',takt:{booking:b.id,company:b.company_id,start:b.starts_at,event,admin:false}};
 let lines=[`<b>${title}</b>`];
 if(previous){const old=when(previous,c.timezone,lang);lines.push('',`${L.was}: ${old.date} · ${old.time}`,`${L.became}: ${w.date} · ${w.time}`)}else lines.push('',`📅 <b>${event==='reminder'&&localDate(b.starts_at,c.timezone)===dateShift(localDate(Date.now()/1000,c.timezone),1)?L.tomorrow:''}${w.date} · ${w.time}</b>`);
 lines.push(`${escHtml(b.service_name)} · ${money}`,admin?`${L.client}: ${escHtml(b.name)}`:`${L.specialist}: ${escHtml(c.name)}`);
 if(admin&&b.phone)lines.push(`${L.phone}: ${escHtml(b.phone)}`);else if(!admin&&c.address)lines.push(`📍 ${escHtml(c.address)}`);
 if(event==='created'&&!admin)lines.push('',L.created_client_note);
 if(event==='created'&&admin)lines.push('',L.created_admin_note);
 if(event==='cancelled'&&admin)lines.push('',L.cancel_admin_note);
 if(event==='reminder')lines.push('',L.confirm_visit);
 if(event==='client_2h')lines.push('',b.attendance_state==='unknown'?L.confirm_visit:L.see_you);
 return {text:lines.join('\n'),parse_mode:'HTML',takt:{booking:b.id,company:b.company_id,start:b.starts_at,event,admin}};
}
'''
v3=regex_once(v3,r"export function when\([\s\S]*$",new_tail,'localized message tail')
write('src/v3.js',v3)

# ---- schema v9 ----
v2=read('src/v2.js')
needle="`CREATE INDEX IF NOT EXISTS client_messages_sender_time ON client_messages(company_id,sender_id,created_at DESC)`\n];"
replacement="`CREATE INDEX IF NOT EXISTS client_messages_sender_time ON client_messages(company_id,sender_id,created_at DESC)`,\n`CREATE TABLE IF NOT EXISTS user_app_settings(user_id TEXT PRIMARY KEY,language TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',theme TEXT NOT NULL DEFAULT 'system',policy_version TEXT NOT NULL DEFAULT '',consent_version TEXT NOT NULL DEFAULT '',terms_version TEXT NOT NULL DEFAULT '',consent_at INTEGER,updated_at INTEGER NOT NULL DEFAULT 0)`,\n`CREATE TABLE IF NOT EXISTS telegram_review_messages(booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,chat_id TEXT NOT NULL,message_id INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(booking_id,chat_id))`\n];"
v2=replace_once(v2,needle,replacement,'v8 schema tables')
v2=v2.replace("WHERE version=8","WHERE version=9").replace("VALUES(8)","VALUES(9)")
write('src/v2.js',v2)

write('migrations/0009_takt_v80.sql',r'''-- Takt 8.0: first-run preferences/consents and editable review request message.
CREATE TABLE IF NOT EXISTS user_app_settings(
  user_id TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'system',
  policy_version TEXT NOT NULL DEFAULT '',
  consent_version TEXT NOT NULL DEFAULT '',
  terms_version TEXT NOT NULL DEFAULT '',
  consent_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS telegram_review_messages(
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(booking_id,chat_id)
);
''')

# ---- worker v8 ----
w=read('src/worker.js')
w=w.replace("version:'7.2.0'","version:'8.0.0'")
w=w.replace("(c.horizon||30)","(c.horizon||90)")
insert_after="const owners=env=>(env.SUPERADMIN_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);\n"
helpers=r'''const APP_LANGS=['ru','kk','az','uz'];
const LEGAL_VERSIONS={policy:'2026-10-05-v1',consent:'2026-10-05-v1',terms:'2026-10-05-v1'};
const BOT_COPY={
 ru:{open:'Открыть Takt',how:'Как это работает?',support:'Поддержка',first:'Добро пожаловать в Takt. Сначала выберите язык, ознакомьтесь с документами и настройте роль.',specialist:'Добро пожаловать в Takt — ваш сервис онлайн-записи.',client:'Добро пожаловать в Takt — ваши записи в одном месте.',invite:n=>`Добро пожаловать в онлайн-запись к ${n}.`,helpSpecialist:'<b>Как работает Takt для специалиста</b>\n\n1. Настройте услуги и расписание.\n2. Отправьте клиентам персональную ссылку.\n3. Подтверждайте записи в Telegram или приложении.\n4. Takt напомнит о визите и сохранит историю.',helpClient:'<b>Как работает Takt для клиента</b>\n\n1. Откройте ссылку специалиста.\n2. Выберите услугу и свободное время.\n3. Следите за статусом и напоминаниями в Telegram.'},
 kk:{open:'Takt ашу',how:'Қалай жұмыс істейді?',support:'Қолдау',first:'Takt-қа қош келдіңіз. Алдымен тілді таңдаңыз, құжаттармен танысыңыз және рөліңізді баптаңыз.',specialist:'Takt-қа қош келдіңіз — онлайн жазылу сервисіңіз.',client:'Takt-қа қош келдіңіз — жазбаларыңыз бір жерде.',invite:n=>`${n} маманына онлайн жазылуға қош келдіңіз.`,helpSpecialist:'<b>Takt маман үшін қалай жұмыс істейді</b>\n\n1. Қызметтер мен кестені баптаңыз.\n2. Клиенттерге жеке сілтемені жіберіңіз.\n3. Жазбаларды Telegram немесе қолданбада растаңыз.\n4. Takt еске салып, тарихты сақтайды.',helpClient:'<b>Takt клиент үшін қалай жұмыс істейді</b>\n\n1. Маманның сілтемесін ашыңыз.\n2. Қызмет пен бос уақытты таңдаңыз.\n3. Мәртебе мен еске салуларды Telegram-да бақылаңыз.'},
 az:{open:'Takt-ı aç',how:'Necə işləyir?',support:'Dəstək',first:'Takt-a xoş gəlmisiniz. Əvvəl dili seçin, sənədlərlə tanış olun və rolunuzu qurun.',specialist:'Takt-a xoş gəlmisiniz — onlayn qeyd xidmətiniz.',client:'Takt-a xoş gəlmisiniz — qeydləriniz bir yerdə.',invite:n=>`${n} üçün onlayn qeydə xoş gəlmisiniz.`,helpSpecialist:'<b>Takt mütəxəssis üçün necə işləyir</b>\n\n1. Xidmətləri və cədvəli qurun.\n2. Şəxsi linki müştərilərə göndərin.\n3. Qeydləri Telegram-da və ya tətbiqdə təsdiqləyin.\n4. Takt xatırladacaq və tarixçəni saxlayacaq.',helpClient:'<b>Takt müştəri üçün necə işləyir</b>\n\n1. Mütəxəssisin linkini açın.\n2. Xidmət və boş vaxt seçin.\n3. Status və xatırlatmaları Telegram-da izləyin.'},
 uz:{open:'Taktni ochish',how:'Qanday ishlaydi?',support:'Yordam',first:'Taktga xush kelibsiz. Avval tilni tanlang, hujjatlar bilan tanishing va rolingizni sozlang.',specialist:'Taktga xush kelibsiz — onlayn yozuv xizmatingiz.',client:'Taktga xush kelibsiz — yozuvlaringiz bir joyda.',invite:n=>`${n} mutaxassisiga onlayn yozuvga xush kelibsiz.`,helpSpecialist:'<b>Takt mutaxassis uchun qanday ishlaydi</b>\n\n1. Xizmatlar va jadvalni sozlang.\n2. Shaxsiy havolani mijozlarga yuboring.\n3. Yozuvlarni Telegram yoki ilovada tasdiqlang.\n4. Takt eslatadi va tarixni saqlaydi.',helpClient:'<b>Takt mijoz uchun qanday ishlaydi</b>\n\n1. Mutaxassis havolasini oching.\n2. Xizmat va bo‘sh vaqtni tanlang.\n3. Status va eslatmalarni Telegram-da kuzating.'}
};
const botCopy=lang=>BOT_COPY[APP_LANGS.includes(lang)?lang:'ru'];
async function appSetting(db,userId){return await db.prepare('SELECT * FROM user_app_settings WHERE user_id=?').bind(String(userId)).first()||null}
async function languageOf(db,userId){return (await appSetting(db,userId))?.language||'ru'}
function appButtonUrl(env,origin,params={}){const u=new URL(env.APP_URL||origin);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));return u.href}
function roleWelcome(env,origin,role,lang,companyRow=null){const L=botCopy(lang),base=appButtonUrl(env,origin),help=appButtonUrl(env,origin,{guide:'1'}),support=appButtonUrl(env,origin,{support:'1'}),text=role==='specialist'?L.specialist:companyRow?L.invite(companyRow.name):L.client;return {text:`<b>${escHtml(text)}</b>`,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:L.open,style:'primary',web_app:{url:base}}],[{text:L.how,style:'success',web_app:{url:help}},{text:L.support,style:'danger',web_app:{url:support}}]]}}}
'''
w=replace_once(w,insert_after,insert_after+helpers,'worker v8 helpers')

# localized notice fanout
w=regex_once(w,r"async function notices\(db,b,event,guard=null,previous=null\)\{[\s\S]*?\n\}\n\nasync function attendanceNotices",r'''async function notices(db,b,event,guard=null,previous=null){
 const c=await company(db,b.company_id),kind=event.startsWith('moved-')?'moved':event;
 const members=await db.prepare("SELECT m.user_id,COALESCE(NULLIF(s.language,''),'ru') language FROM memberships m LEFT JOIN user_app_settings s ON s.user_id=m.user_id WHERE m.company_id=?").bind(b.company_id).all();
 const clientLang=await languageOf(db,b.user_id);
 return [...(/^[0-9]+$/.test(b.user_id)&&c.notifications.client_events!==false?[queue(db,`${b.id}:${event}:client`,b.user_id,JSON.stringify(messagePayload(b,c,kind,false,previous,clientLang)),guard)]:[]),...(c.notifications[kind]!==false?members.results.filter(m=>m.user_id!==b.user_id).map(m=>queue(db,`${b.id}:${event}:${m.user_id}`,m.user_id,JSON.stringify(messagePayload(b,c,kind,true,previous,m.language||'ru')),guard)):[])];
}

async function attendanceNotices''','localized notices')
w=regex_once(w,r"async function attendanceNotices\(db,b,state\)\{[\s\S]*?\n\}\nasync function respondAttendance",r'''async function attendanceNotices(db,b,state){
 const c=await company(db,b.company_id),members=await db.prepare("SELECT m.user_id,COALESCE(NULLIF(s.language,''),'ru') language FROM memberships m LEFT JOIN user_app_settings s ON s.user_id=m.user_id WHERE m.company_id=?").bind(b.company_id).all(),event=state==='coming'?'attendance_yes':'attendance_no';
 return members.results.filter(m=>m.user_id!==b.user_id).map(m=>queue(db,`${b.id}:attendance:${state}:${b.starts_at}:${m.user_id}`,m.user_id,JSON.stringify(messagePayload({...b,attendance_state:state},c,event,true,null,m.language||'ru'))));
}
async function respondAttendance''','localized attendance')

# callback handling: visit + specialist booking confirm/decline
w=regex_once(w,r" if\(cb\?\.id&&Number\.isSafeInteger\(cb\.from\?\.id\)&&typeof cb\.data==='string'\)\{[\s\S]*?\n if\(m\?\.chat\?\.type",r''' if(cb?.id&&Number.isSafeInteger(cb.from?.id)&&typeof cb.data==='string'){
  const visit=cb.data.match(/^visit:([a-z0-9-]+):(yes|no)$/);if(visit){try{const result=await respondAttendance(env.DB,String(cb.from.id),visit[1],visit[2]==='yes'?'coming':'not_coming'),feedback=result.attendance_state==='coming'?'✅ Вы подтвердили визит':result.late?'⚠️ Вы сообщили, что не сможете прийти. Специалист уведомлён.':'❌ Запись отменена';await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:result.attendance_state==='coming'?'Спасибо, визит подтверждён ✅':result.late?'Специалист уведомлён':'Запись отменена'});if(cb.message?.chat?.id&&cb.message?.message_id){const original=String(cb.message.text||'Напоминание о записи').replace(/\n\n(?:✅ Вы подтвердили визит|⚠️ Вы сообщили[\s\S]*|❌ Запись отменена)$/,'');await telegram(env,'editMessageText',{chat_id:cb.message.chat.id,message_id:cb.message.message_id,text:(original+'\n\n'+feedback).slice(0,4096),reply_markup:{inline_keyboard:[]}}).catch(()=>{});}}catch(e){await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:e.message||'Не удалось сохранить ответ',show_alert:true}).catch(()=>{});}return json({ok:true})}
  const action=cb.data.match(/^booking:([a-z0-9-]+):(confirm|decline)$/);if(action){try{const userId=String(cb.from.id),b=await env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(action[1]).first();if(!b)fail(404,'Запись не найдена');if(!await env.DB.prepare('SELECT 1 FROM memberships WHERE company_id=? AND user_id=?').bind(b.company_id,userId).first())fail(403,'Эта запись другого специалиста');if(b.status!=='pending')fail(409,'Запись уже обработана');const status=action[2]==='confirm'?'confirmed':'cancelled',eventId=crypto.randomUUID(),ops=[env.DB.prepare('UPDATE bookings SET status=?,status_event=? WHERE id=? AND status=?').bind(status,eventId,b.id,'pending'),...await notices(env.DB,b,status,[b.id,eventId])];if(status==='cancelled')ops.push(env.DB.prepare('DELETE FROM outbox WHERE id LIKE ? AND sent_at IS NULL').bind(b.id+':%reminder%'));const result=await env.DB.batch(ops);if(!result[0].meta.changes)fail(409,'Запись уже обработана');await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:status==='confirmed'?'Запись подтверждена ✅':'Запись отклонена'});await deliver(env);}catch(e){await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:e.message||'Не удалось изменить запись',show_alert:true}).catch(()=>{});}return json({ok:true})}
 }
 if(m?.chat?.type''','callback actions')

# role-aware bot chat menu
w=regex_once(w,r" const command=typeof m\.text==='string'\?[\s\S]*? return json\(\{method:'sendMessage',chat_id:m\.chat\.id,text:message,parse_mode:'HTML',reply_markup:keyboard\.length\?\{inline_keyboard:keyboard\}:undefined\}\);",r''' const command=typeof m.text==='string'?m.text.trim().split(/\s+/)[0].split('@')[0]:'';
 if(!['/start','/help','/id'].includes(command))return json({ok:true});
 const appUrl=new URL(env.APP_URL||new URL(req.url).origin);if(appUrl.protocol!=='https:')fail(503,'Укажите HTTPS адрес приложения');
 const referral=typeof m.text==='string'?m.text.trim().split(/\s+/)[1]:'';let invited=null;
 if(referral&&/^(master_|c_|u_)[a-z0-9-]+$/.test(referral)){let id=referral.replace(/^(master_|c_|u_)/,'');if(referral.startsWith('u_'))id=(await env.DB.prepare('SELECT company_id FROM specialist_handles WHERE handle=?').bind(id).first())?.company_id;try{invited=await company(env.DB,id)}catch{}if(invited)appUrl.searchParams.set('company',invited.id)}
 const setting=await appSetting(env.DB,String(m.chat.id)),lang=setting?.language||'ru',L=botCopy(lang),role=invited?'client':setting?.role||'',consentCurrent=setting?.policy_version===LEGAL_VERSIONS.policy&&setting?.consent_version===LEGAL_VERSIONS.consent&&setting?.terms_version===LEGAL_VERSIONS.terms;
 const helpUrl=new URL(appUrl.href);helpUrl.searchParams.set('guide','1');const supportUrl=new URL(appUrl.href);supportUrl.searchParams.set('support','1');
 let message;if(command==='/id')message=`Telegram ID: ${m.chat.id}`;else if(command==='/help')message=role==='specialist'?L.helpSpecialist:L.helpClient;else if(!setting?.language||!consentCurrent||!role&&!invited)message=`<b>${escHtml(L.first)}</b>`;else message=`<b>${escHtml(role==='specialist'?L.specialist:invited?L.invite(invited.name):L.client)}</b>`;
 const keyboard=command==='/id'?[]:[[{text:L.open,style:'primary',web_app:{url:appUrl.href}}],[{text:L.how,style:'success',web_app:{url:helpUrl.href}},{text:L.support,style:'danger',web_app:{url:supportUrl.href}}],...(owners(env).includes(String(m.chat.id))?[[{text:'Админ-панель',web_app:{url:new URL('/?view=admin',appUrl).href}}]]:[])];
 return json({method:'sendMessage',chat_id:m.chat.id,text:message,parse_mode:'HTML',reply_markup:keyboard.length?{inline_keyboard:keyboard}:undefined});''','bot role menu')

# replace review POST with edit-in-place thanks + insert v8 routes
old_review=" if(path==='/api/v7/reviews'&&req.method==='POST'){return json(await createReview(db,user.id,await body(req)),201)}\n"
new_review=r''' if(path==='/api/v7/reviews'&&req.method==='POST'){
  const result=await createReview(db,user.id,await body(req)),bookingId=text((await body(new Request(req.url,{method:'POST',body:'{}'}))).booking_id,80);return json(result,201)
 }
'''
# Do not use the placeholder above; insert a correct route with one body read.
correct_review=r''' if(path==='/api/v7/reviews'&&req.method==='POST'){
  const data=await body(req),result=await createReview(db,user.id,data),b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(text(data.booking_id,80)).first(),c=b?await company(db,b.company_id):null,lang=await languageOf(db,user.id),saved=b?await db.prepare('SELECT message_id FROM telegram_review_messages WHERE booking_id=? AND chat_id=?').bind(b.id,String(user.id)).first():null;
  if(b&&c){const appUrl=env.APP_URL||url.origin,L=lang==='kk'?['Пікіріңізге рақмет 💙','Пікір жарияланды және басқа клиенттерге маманды жақсырақ тануға көмектеседі.','Takt ашу','Маманды ашу']:lang==='az'?['Rəyiniz üçün təşəkkür edirik 💙','Rəy dərc olundu və digər müştərilərə mütəxəssisi daha yaxşı tanımağa kömək edir.','Takt-ı aç','Mütəxəssisi aç']:lang==='uz'?['Fikringiz uchun rahmat 💙','Fikr e’lon qilindi va boshqa mijozlarga mutaxassisni yaxshiroq bilishga yordam beradi.','Taktni ochish','Mutaxassisni ochish']:['Спасибо за отзыв 💙','Он уже опубликован в профиле специалиста и поможет другим клиентам сделать выбор.','Открыть Takt','Открыть специалиста'],payload={chat_id:user.id,text:`<b>${L[0]}</b>\n\n${L[1]}`,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:L[2],style:'primary',web_app:{url:appUrl}}],[{text:L[3],style:'success',web_app:{url:new URL('/?company='+b.company_id,appUrl).href}}]]}};let edited=false;if(saved?.message_id){try{await telegram(env,'editMessageText',{...payload,message_id:saved.message_id});edited=true}catch{}}if(!edited)await queue(db,`review-thanks:${b.id}:${now()}`,user.id,JSON.stringify({text:payload.text,parse_mode:'HTML',reply_markup:payload.reply_markup})).run()}
  return json(result,201)
 }
'''
w=replace_once(w,old_review,correct_review,'review thanks route')

anchor="if(path==='/api/v72/support'&&req.method==='POST'){"
v8_routes=r'''if(path==='/api/v8/profile'){
  const existing=await appSetting(db,user.id),membership=await db.prepare('SELECT company_id FROM memberships WHERE user_id=? LIMIT 1').bind(user.id).first(),clientLink=await db.prepare('SELECT company_id FROM client_links WHERE user_id=? ORDER BY last_seen DESC LIMIT 1').bind(user.id).first(),inferred=membership?'specialist':clientLink?'client':'';
  if(req.method==='GET'){const x=existing||{};return json({language:x.language||'',role:x.role||inferred||'',theme:x.theme||'system',consent_at:x.consent_at||null,policy_version:x.policy_version||'',consent_version:x.consent_version||'',terms_version:x.terms_version||'',consent_current:x.policy_version===LEGAL_VERSIONS.policy&&x.consent_version===LEGAL_VERSIONS.consent&&x.terms_version===LEGAL_VERSIONS.terms,versions:LEGAL_VERSIONS})}
  if(req.method==='POST'){const data=await body(req),current=existing||{},language=data.language===undefined?(current.language||''):text(data.language,4),theme=data.theme===undefined?(current.theme||'system'):text(data.theme,12),requestedRole=data.role===undefined?(current.role||inferred||''):text(data.role,12);if(language&&!APP_LANGS.includes(language))fail(400,'Неизвестный язык');if(!['system','light','dark'].includes(theme))fail(400,'Неизвестная тема');if(requestedRole&&!['client','specialist'].includes(requestedRole))fail(400,'Неизвестная роль');if(current.role&&data.role&&current.role!==data.role)fail(409,'Роль уже выбрана');let companyRow=null;if(data.company_id){try{companyRow=await company(db,text(data.company_id,80))}catch{fail(404,'Специалист не найден')}}const accept=data.consent===true,policy=accept?LEGAL_VERSIONS.policy:(current.policy_version||''),consent=accept?LEGAL_VERSIONS.consent:(current.consent_version||''),terms=accept?LEGAL_VERSIONS.terms:(current.terms_version||''),consentAt=accept?now():(current.consent_at||null);if(accept&&!language)fail(400,'Сначала выберите язык');await db.prepare('INSERT INTO user_app_settings(user_id,language,role,theme,policy_version,consent_version,terms_version,consent_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language,role=CASE WHEN user_app_settings.role=\'\' THEN excluded.role ELSE user_app_settings.role END,theme=excluded.theme,policy_version=excluded.policy_version,consent_version=excluded.consent_version,terms_version=excluded.terms_version,consent_at=excluded.consent_at,updated_at=excluded.updated_at').bind(user.id,language,requestedRole,theme,policy,consent,terms,consentAt,now()).run();if(!current.role&&requestedRole){const welcome=roleWelcome(env,url.origin,requestedRole,language||'ru',companyRow);await queue(db,`welcome-v8:${user.id}:${requestedRole}:${companyRow?.id||'home'}`,user.id,JSON.stringify(welcome)).run()}return json({ok:true,language,role:requestedRole,theme,consent_current:policy===LEGAL_VERSIONS.policy&&consent===LEGAL_VERSIONS.consent&&terms===LEGAL_VERSIONS.terms,versions:LEGAL_VERSIONS})}
 }
 if(path==='/api/v8/subscription-stats'&&req.method==='GET'){const id=text(url.searchParams.get('company'),80);if(!await access(db,env,user,id))fail(403,'Нет доступа');const since=now()-30*86400,stats=await db.prepare("SELECT COUNT(*) bookings,COUNT(DISTINCT user_id) clients FROM bookings WHERE company_id=? AND created_at>=?").bind(id,since).first(),notifications=await db.prepare("SELECT COUNT(*) n FROM outbox WHERE created_at>=? AND json_valid(text) AND json_extract(text,'$.takt.company')=?").bind(since,id).first();return json({period_days:30,bookings:Number(stats?.bookings||0),clients:Number(stats?.clients||0),notifications:Number(notifications?.n||0)})}
'''
w=replace_once(w,anchor,v8_routes+anchor,'v8 api routes')

# /me exposes app settings too
old_me="  const memberships=await db.prepare('SELECT company_id FROM memberships WHERE user_id=?').bind(user.id).all();\n  return json({...user,owner:owners(env).includes(user.id),companies:memberships.results.map(m=>m.company_id)});"
new_me="  const memberships=await db.prepare('SELECT company_id FROM memberships WHERE user_id=?').bind(user.id).all(),app=await appSetting(db,user.id);\n  return json({...user,owner:owners(env).includes(user.id),companies:memberships.results.map(m=>m.company_id),app:app?{language:app.language,role:app.role,theme:app.theme,consent_at:app.consent_at}:null});"
w=replace_once(w,old_me,new_me,'me app settings')

# Deep short links go straight to Telegram Mini App
old_redirect="if(/^\\/[a-z][a-z0-9-]{2,31}$/.test(url.pathname)){await ensureSchema(env.DB);const handle=url.pathname.slice(1),row=await env.DB.prepare('SELECT company_id FROM specialist_handles WHERE handle=?').bind(handle).first();if(row){url.pathname='/';url.searchParams.set('username',handle);return Response.redirect(url.href,302)}}"
new_redirect="if(/^\\/[a-z][a-z0-9-]{2,31}$/.test(url.pathname)){await ensureSchema(env.DB);const handle=url.pathname.slice(1),row=await env.DB.prepare('SELECT company_id FROM specialist_handles WHERE handle=?').bind(handle).first();if(row)return Response.redirect(`https://t.me/${env.BOT_USERNAME||'takt_service_bot'}?startapp=u_${encodeURIComponent(handle)}`,302)}"
w=replace_once(w,old_redirect,new_redirect,'short link redirect')

# Deliver immediately after v8 profile welcome as well
w=w.replace("v72\\/(support|client-message)","v72\\/(support|client-message)|v8\\/profile")
w=w.replace("bot-webhook-v72","bot-webhook-v80").replace("bot-menu-v72","bot-menu-v80")
write('src/worker.js',w)

# ---- delivery: language, inline confirm/decline, focus links, review request message map ----
d=read('src/delivery.js')
old="for(const b of due){if(generationBudget<=0)break;generationBudget--;const c=await getCompany(b.company_id);if(!c.notifications[event.pref])continue;const id=`${b.id}:${event.key}:${b.starts_at}${event.admin?':'+b.recipient:''}`;await queue(db,id,b.recipient,JSON.stringify(messagePayload(b,c,event.kind,event.admin))).run()}"
new="for(const b of due){if(generationBudget<=0)break;generationBudget--;const c=await getCompany(b.company_id);if(!c.notifications[event.pref])continue;const id=`${b.id}:${event.key}:${b.starts_at}${event.admin?':'+b.recipient:''}`,lang=(await db.prepare(\"SELECT language FROM user_app_settings WHERE user_id=?\").bind(String(b.recipient)).first())?.language||'ru';await queue(db,id,b.recipient,JSON.stringify(messagePayload(b,c,event.kind,event.admin,null,lang))).run()}"
d=replace_once(d,old,new,'reminder language')
# explicit message focus only when clicking Telegram button
d=d.replace("u.searchParams.set('booking',b.id);if(action)","u.searchParams.set('booking',b.id);u.searchParams.set('focus','1');if(action)")
# new booking specialist callback buttons
target="else if(meta.admin&&meta.event==='cancelled'){payload.reply_markup={inline_keyboard:[[{text:'Открыть Takt',style:'primary',web_app:{url:env.APP_URL||'https://takt.teymurstudent.workers.dev'}}]]}}\nelse{payload.reply_markup={inline_keyboard:"
insert="else if(meta.admin&&meta.event==='cancelled'){payload.reply_markup={inline_keyboard:[[{text:'Открыть Takt',style:'primary',web_app:{url:env.APP_URL||'https://takt.teymurstudent.workers.dev'}}]]}}\nelse if(meta.admin&&meta.event==='created'&&b.status==='pending'){payload.reply_markup={inline_keyboard:[[{text:'✅ Подтвердить',style:'success',callback_data:`booking:${b.id}:confirm`},{text:'❌ Отклонить',style:'danger',callback_data:`booking:${b.id}:decline`}],[{text:'📋 Открыть запись',style:'primary',web_app:{url:make()}}]]}}\nelse{payload.reply_markup={inline_keyboard:"
d=replace_once(d,target,insert,'admin created callback buttons')
# save review request message id after successful send
old_success="if(live&&data.result?.message_id)await db.prepare('INSERT INTO telegram_booking_messages(booking_id,chat_id,message_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(booking_id,chat_id) DO UPDATE SET message_id=excluded.message_id,updated_at=excluded.updated_at').bind(meta.booking,String(row.chat_id),data.result.message_id,now()).run();await record('sent');await contact(db,row.chat_id,'allowed')"
new_success="if(live&&data.result?.message_id)await db.prepare('INSERT INTO telegram_booking_messages(booking_id,chat_id,message_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(booking_id,chat_id) DO UPDATE SET message_id=excluded.message_id,updated_at=excluded.updated_at').bind(meta.booking,String(row.chat_id),data.result.message_id,now()).run();if(meta?.event==='review_request'&&data.result?.message_id)await db.prepare('INSERT INTO telegram_review_messages(booking_id,chat_id,message_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(booking_id,chat_id) DO UPDATE SET message_id=excluded.message_id,updated_at=excluded.updated_at').bind(meta.booking,String(row.chat_id),data.result.message_id,now()).run();await record('sent');await contact(db,row.chat_id,'allowed')"
d=replace_once(d,old_success,new_success,'review request message map')
write('src/delivery.js',d)

print('Takt 8.0 backend patch applied')
