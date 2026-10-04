from pathlib import Path
import re


def sub_once(text, pattern, repl, label, flags=re.S):
    out, n = re.subn(pattern, lambda m: repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    return out

# Richer private admin overview.
p=Path('src/v5.js');s=p.read_text()
new_overview=r'''export async function overview(db){
 const cutoff24=now()-86400,cutoff7=now()-7*86400,cutoff30=now()-30*86400;
 const totals=await db.prepare(`SELECT (SELECT COUNT(DISTINCT company_id) FROM memberships) specialists,(SELECT COUNT(DISTINCT user_id) FROM bookings) clients,(SELECT COUNT(*) FROM bookings) bookings,(SELECT COUNT(*) FROM registrations WHERE created_at>?) registrations,(SELECT COUNT(*) FROM account_activity WHERE last_seen>?) active`).bind(cutoff24,cutoff24).first();
 const delivery=(await db.prepare(`SELECT CASE WHEN o.sent_at IS NOT NULL THEN COALESCE(d.state,'sent') WHEN d.state='sending' AND o.lease_until<unixepoch() THEN 'unknown' WHEN d.state IS NOT NULL THEN d.state WHEN o.attempts>=5 THEN 'unknown' ELSE 'queued' END state,COUNT(*) count FROM outbox o LEFT JOIN delivery_state d ON d.id=o.id WHERE o.created_at>? GROUP BY 1`).bind(cutoff24).all()).results;
 const errors=(await db.prepare('SELECT kind,code,COUNT(*) count,MAX(created_at) last_at FROM operational_errors WHERE created_at>? GROUP BY kind,code ORDER BY last_at DESC LIMIT 30').bind(cutoff24).all()).results;
 const tasks=(await db.prepare('SELECT * FROM task_runs ORDER BY name').all()).results;
 const operations=await db.prepare(`SELECT (SELECT COUNT(*) FROM bookings WHERE created_at>?) bookingsToday,(SELECT COUNT(*) FROM bookings WHERE created_at>?) bookings7d,(SELECT COUNT(*) FROM bookings WHERE status='pending') pending,(SELECT COUNT(*) FROM bookings WHERE status='confirmed' AND starts_at>unixepoch()) confirmed,(SELECT COUNT(*) FROM bookings WHERE status='done' AND created_at>?) done30,(SELECT COUNT(*) FROM bookings WHERE status='cancelled' AND created_at>?) cancelled30,(SELECT COUNT(*) FROM support_requests WHERE created_at>?) support7d`).bind(cutoff24,cutoff7,cutoff30,cutoff30,cutoff7).first();
 const subscriptions=await db.prepare(`SELECT COALESCE(SUM(status='trial'),0) trial,COALESCE(SUM(status='active'),0) active,COALESCE(SUM(status='expired'),0) expired,COALESCE(SUM(status='grace'),0) grace FROM subscriptions`).first();
 const languages=(await db.prepare(`SELECT CASE WHEN language IN ('ru','kk','az','uz') THEN language ELSE '' END language,COUNT(*) count FROM user_app_settings GROUP BY 1 ORDER BY count DESC`).all()).results;
 const recentCompanies=(await db.prepare(`SELECT c.id,c.name,c.category,r.created_at FROM registrations r JOIN companies c ON c.id=r.company_id ORDER BY r.created_at DESC LIMIT 20`).all()).results;
 const recentSupport=(await db.prepare(`SELECT s.user_id,s.company_id,s.message,s.created_at,COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.last_name,'')),''),'Пользователь') name FROM support_requests s LEFT JOIN telegram_profiles p ON p.user_id=s.user_id ORDER BY s.created_at DESC LIMIT 20`).all()).results;
 const recentBookings=(await db.prepare(`SELECT b.id,b.name,b.service_name,b.price,b.status,b.created_at,c.name company_name FROM bookings b JOIN companies c ON c.id=b.company_id ORDER BY b.created_at DESC LIMIT 25`).all()).results;
 return {totals,delivery,errors,tasks,operations,subscriptions,languages,recentCompanies,recentSupport,recentBookings,checked_at:now()};
}'''
s=sub_once(s,r"export async function overview\(db\)\{.*?\n\}",new_overview,'overview')
p.write_text(s)

# Telegram metadata carries the recipient language so all inline controls can match it.
p=Path('src/v3.js');s=p.read_text()
s=s.replace("takt:{booking:b.id,company:b.company_id,start:b.starts_at,event,admin:false}","takt:{booking:b.id,company:b.company_id,start:b.starts_at,event,admin:false,lang}")
s=s.replace("takt:{booking:b.id,company:b.company_id,start:b.starts_at,event,admin}","takt:{booking:b.id,company:b.company_id,start:b.starts_at,event,admin,lang}")
p.write_text(s)

# Worker: 8.1 legal versions, no bot-relay chat, review notification for specialist.
p=Path('src/worker.js');s=p.read_text()
s=s.replace("const LEGAL_VERSIONS={policy:'2026-10-05-v1',consent:'2026-10-05-v1',terms:'2026-10-05-v1'};","const LEGAL_VERSIONS={policy:'2026-10-05-v2',consent:'2026-10-05-v2',terms:'2026-10-05-v2'};")
s=s.replace("if(path==='/api/health')return json({ok:true,version:'8.0.0'});","if(path==='/api/health')return json({ok:true,version:'8.1.0'});")
review_copy=r'''const REVIEW_NOTICE={
 ru:{title:'⭐ Новый отзыв',empty:n=>`Клиент оставил оценку ${n} ★`,client:'Клиент',service:'Услуга',open:'Открыть Takt'},
 kk:{title:'⭐ Жаңа пікір',empty:n=>`Клиент ${n} ★ бағасын қалдырды`,client:'Клиент',service:'Қызмет',open:'Takt ашу'},
 az:{title:'⭐ Yeni rəy',empty:n=>`Müştəri ${n} ★ qiymət verdi`,client:'Müştəri',service:'Xidmət',open:'Takt-ı aç'},
 uz:{title:'⭐ Yangi fikr',empty:n=>`Mijoz ${n} ★ baho qoldirdi`,client:'Mijoz',service:'Xizmat',open:'Taktni ochish'}
};
const reviewCopy=lang=>REVIEW_NOTICE[APP_LANGS.includes(lang)?lang:'ru'];
'''
s=s.replace("const botCopy=lang=>BOT_COPY[APP_LANGS.includes(lang)?lang:'ru'];", "const botCopy=lang=>BOT_COPY[APP_LANGS.includes(lang)?lang:'ru'];\n"+review_copy)
# Explicitly disable old relay endpoint.
s=sub_once(s,r"if\(path==='/api/v72/client-message'&&req.method==='POST'\)\{.*?\n \}\n if\(path.startsWith\('/api/v2/'\)\)","if(path==='/api/v72/client-message'&&req.method==='POST')fail(410,'Переписка через Takt отключена. Используйте личный Telegram клиента.');\n if(path.startsWith('/api/v2/'))",'disable relay')
# Ensure review request uses the client's language.
s=s.replace("const reviewRequest=status==='done'&&/^[0-9]+$/.test(String(b.user_id))&&policy.notifications.client_events!==false?[queue(db,`${b.id}:review-request:${eventId}`,b.user_id,JSON.stringify(messagePayload({...b,status:'done'},policy,'review_request',false)),[b.id,eventId])]:[];","const reviewLang=await languageOf(db,b.user_id),reviewRequest=status==='done'&&/^[0-9]+$/.test(String(b.user_id))&&policy.notifications.client_events!==false?[queue(db,`${b.id}:review-request:${eventId}`,b.user_id,JSON.stringify(messagePayload({...b,status:'done'},policy,'review_request',false,null,reviewLang)),[b.id,eventId])]:[];")
# Replace review POST handler.
new_review=r'''if(path==='/api/v7/reviews'&&req.method==='POST'){
  const data=await body(req),result=await createReview(db,user.id,data),bookingId=text(data.booking_id,80),b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first(),c=b?await company(db,b.company_id):null,clientLang=await languageOf(db,user.id),saved=b?await db.prepare('SELECT message_id FROM telegram_review_messages WHERE booking_id=? AND chat_id=?').bind(b.id,String(user.id)).first():null,review=b?await db.prepare('SELECT rating,text FROM reviews WHERE booking_id=?').bind(b.id).first():null;
  if(b&&c){
   const appUrl=env.APP_URL||url.origin,L=clientLang==='kk'?['Пікіріңізге рақмет 💙','Пікір жарияланды және басқа клиенттерге маманды жақсырақ тануға көмектеседі.','Takt ашу','Маманды ашу']:clientLang==='az'?['Rəyiniz üçün təşəkkür edirik 💙','Rəy dərc olundu və digər müştərilərə mütəxəssisi daha yaxşı tanımağa kömək edir.','Takt-ı aç','Mütəxəssisi aç']:clientLang==='uz'?['Fikringiz uchun rahmat 💙','Fikr e’lon qilindi va boshqa mijozlarga mutaxassisni yaxshiroq bilishga yordam beradi.','Taktni ochish','Mutaxassisni ochish']:['Спасибо за отзыв 💙','Он уже опубликован в профиле специалиста и поможет другим клиентам сделать выбор.','Открыть Takt','Открыть специалиста'],payload={chat_id:user.id,text:`<b>${L[0]}</b>\n\n${L[1]}`,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:L[2],style:'primary',web_app:{url:appUrl}}],[{text:L[3],style:'success',web_app:{url:new URL('/?company='+b.company_id,appUrl).href}}]]}};let edited=false;if(saved?.message_id){try{await telegram(env,'editMessageText',{...payload,message_id:saved.message_id});edited=true}catch{}}if(!edited)await queue(db,`review-thanks:${b.id}:${now()}`,user.id,JSON.stringify({text:payload.text,parse_mode:'HTML',reply_markup:payload.reply_markup})).run();
   const members=(await db.prepare("SELECT m.user_id,COALESCE(NULLIF(s.language,''),'ru') language FROM memberships m LEFT JOIN user_app_settings s ON s.user_id=m.user_id WHERE m.company_id=?").bind(b.company_id).all()).results,ops=[];for(const member of members){if(String(member.user_id)===String(user.id))continue;const R=reviewCopy(member.language),comment=text(review?.text||'',180),body=comment?`“${escHtml(comment)}”`:R.empty(review?.rating||result.rating),openUrl=appButtonUrl(env,url.origin,{view:'reviews'});ops.push(queue(db,`review-notice:${b.id}:${member.user_id}`,member.user_id,JSON.stringify({text:`<b>${R.title}</b>\n\n<b>${review?.rating||result.rating} ★</b>\n${body}\n\n${R.client}: ${escHtml(b.name)}\n${R.service}: ${escHtml(b.service_name)}`,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:R.open,style:'primary',web_app:{url:openUrl}}]]}}))}if(ops.length)await db.batch(ops);
  }
  return json(result,201)
 }'''
s=sub_once(s,r"if\(path==='/api/v7/reviews'&&req.method==='POST'\)\{.*?\n \}\nif\(path==='/api/v8/profile'\)",new_review+"\nif(path==='/api/v8/profile')",'review handler')
# Per-user Telegram menu button follows selected language.
needle=".bind(user.id,language,requestedRole,theme,policy,consent,terms,consentAt,now()).run();if(!current.role&&requestedRole){"
repl=".bind(user.id,language,requestedRole,theme,policy,consent,terms,consentAt,now()).run();if(env.BOT_TOKEN&&language)try{await telegram(env,'setChatMenuButton',{chat_id:user.id,menu_button:{type:'web_app',text:botCopy(language).open,web_app:{url:appButtonUrl(env,url.origin,{})}}})}catch{}if(!current.role&&requestedRole){"
if needle not in s: raise SystemExit('profile menu anchor missing')
s=s.replace(needle,repl,1)
# Trigger delivery after review, and re-run bot setup tasks for 8.1.
s=s.replace("/\\/api\\/(bookings|v2\\/reschedule|v72\\/(support|client-message)|v8\\/profile)/","/\\/api\\/(bookings|v2\\/reschedule|v7\\/reviews|v72\\/support|v8\\/profile)/")
s=s.replace("bot-webhook-v80","bot-webhook-v81").replace("bot-menu-v80","bot-menu-v81")
p.write_text(s)

# Delivery: localize Telegram inline buttons and daily summaries.
p=Path('src/delivery.js');s=p.read_text()
copy=r'''const DELIVERY_COPY={
 ru:{review:'⭐ Оставить отзыв',specialist:'Открыть специалиста',open:'Открыть Takt',confirm:'✅ Подтвердить',decline:'❌ Отклонить',booking:'📋 Открыть запись',other:'Выбрать другое время',mine:'Моя запись',client:'👤 Открыть клиента',move:'Перенести',cancel:'Отменить',yes:'✅ Да, приду',no:'❌ Не смогу',route:'📍 Построить маршрут',day:'📊 <b>Итоги дня</b>',today:'Сегодня',done:'Завершено',cancelled:'Отменено',income:'Доход по завершённым',tomorrow:'📅 Завтра',first:'Первая',confirmed:'Подтвердили визит',morning:'☀️ <b>Доброе утро</b>',have:'Сегодня у вас записей',last:'Последняя',free:'Сегодня свободный день.',openRecords:'Открыть записи',tomorrowSchedule:'Расписание на завтра'},
 kk:{review:'⭐ Пікір қалдыру',specialist:'Маманды ашу',open:'Takt ашу',confirm:'✅ Растау',decline:'❌ Бас тарту',booking:'📋 Жазбаны ашу',other:'Басқа уақытты таңдау',mine:'Менің жазбам',client:'👤 Клиентті ашу',move:'Ауыстыру',cancel:'Тоқтату',yes:'✅ Иә, келемін',no:'❌ Келе алмаймын',route:'📍 Бағыт құру',day:'📊 <b>Күн қорытындысы</b>',today:'Бүгін',done:'Аяқталды',cancelled:'Тоқтатылды',income:'Аяқталғандар бойынша табыс',tomorrow:'📅 Ертең',first:'Бірінші',confirmed:'Келуді растады',morning:'☀️ <b>Қайырлы таң</b>',have:'Бүгінгі жазбалар саны',last:'Соңғы',free:'Бүгін бос күн.',openRecords:'Жазбаларды ашу',tomorrowSchedule:'Ертеңгі кесте'},
 az:{review:'⭐ Rəy yaz',specialist:'Mütəxəssisi aç',open:'Takt-ı aç',confirm:'✅ Təsdiqlə',decline:'❌ İmtina et',booking:'📋 Qeydi aç',other:'Başqa vaxt seç',mine:'Qeydim',client:'👤 Müştərini aç',move:'Köçür',cancel:'Ləğv et',yes:'✅ Bəli, gələcəyəm',no:'❌ Gələ bilməyəcəyəm',route:'📍 Marşrut qur',day:'📊 <b>Günün yekunu</b>',today:'Bu gün',done:'Tamamlandı',cancelled:'Ləğv edildi',income:'Tamamlanan qeydlərin məbləği',tomorrow:'📅 Sabah',first:'Birinci',confirmed:'Gəlişi təsdiqləyib',morning:'☀️ <b>Sabahınız xeyir</b>',have:'Bu gün qeydləriniz',last:'Sonuncu',free:'Bu gün boş gündür.',openRecords:'Qeydləri aç',tomorrowSchedule:'Sabahkı cədvəl'},
 uz:{review:'⭐ Fikr qoldirish',specialist:'Mutaxassisni ochish',open:'Taktni ochish',confirm:'✅ Tasdiqlash',decline:'❌ Rad etish',booking:'📋 Yozuvni ochish',other:'Boshqa vaqt tanlash',mine:'Mening yozuvim',client:'👤 Mijozni ochish',move:'Ko‘chirish',cancel:'Bekor qilish',yes:'✅ Ha, kelaman',no:'❌ Kela olmayman',route:'📍 Yo‘nalish qurish',day:'📊 <b>Kun yakuni</b>',today:'Bugun',done:'Yakunlandi',cancelled:'Bekor qilindi',income:'Yakunlangan yozuvlar summasi',tomorrow:'📅 Ertaga',first:'Birinchi',confirmed:'Tashrifni tasdiqladi',morning:'☀️ <b>Xayrli tong</b>',have:'Bugungi yozuvlaringiz',last:'Oxirgi',free:'Bugun bo‘sh kun.',openRecords:'Yozuvlarni ochish',tomorrowSchedule:'Ertangi jadval'}
};
const deliveryCopy=lang=>DELIVERY_COPY[lang]||DELIVERY_COPY.ru;
'''
s=s.replace("const now=()=>Math.floor(Date.now()/1000);","const now=()=>Math.floor(Date.now()/1000);\n"+copy)
# Replace per-company summary construction with per-member language construction.
summary_re=r"let message;if\(evening\)\{.*?for\(const member of members\)await queue\(db,key\+member.user_id,member.user_id,JSON.stringify\(\{text:message,parse_mode:'HTML',takt_summary:\{company:c.id,day:d,evening\},reply_markup:\{inline_keyboard:\[\[button\('Открыть записи',\{view:'calendar',date:d\}\)\],\.\.\.\(evening\?\[\[button\('Расписание на завтра',\{view:'calendar',date:dateShift\(d,1\)\}\)\]\]:\[\]\),\[button\('Открыть Takt',\{\}\)\]\]\}\}\)\)\.run\(\);"
summary_new=r'''const base=env.APP_URL||'https://takt.teymurstudent.workers.dev';for(const member of members){const lang=(await db.prepare('SELECT language FROM user_app_settings WHERE user_id=?').bind(String(member.user_id)).first())?.language||'ru',L=deliveryCopy(lang),button=(text,params)=>({text,style:'primary',web_app:{url:base+'/?'+new URLSearchParams(params)}});let message;if(evening){const next=await db.prepare(`SELECT COUNT(*) n,MIN(starts_at) first,SUM(CASE WHEN EXISTS(SELECT 1 FROM booking_attendance a WHERE a.booking_id=bookings.id AND a.state='coming') THEN 1 ELSE 0 END) confirmed FROM bookings WHERE company_id=? AND status IN ('pending','confirmed') AND starts_at>=? AND starts_at<?`).bind(c.id,end,tomorrowEnd).first();message=`${L.day}\n\n${L.today}: <b>${stats.n}</b>\n${L.done}: ${stats.done||0}\n${L.cancelled}: ${stats.cancelled||0}\n${L.income}: <b>${new Intl.NumberFormat(lang==='kk'?'kk-KZ':lang==='az'?'az-AZ':lang==='uz'?'uz-UZ':'ru-RU').format(stats.revenue)} ₽</b>\n\n${L.tomorrow}: ${next.n}${next.first?'\n'+L.first+' — <b>'+when(next.first,c.timezone,lang).time+'</b>':''}${next.n?'\n'+L.confirmed+': <b>'+(next.confirmed||0)+' / '+next.n+'</b>':''}`;}else message=`${L.morning}\n\n${L.have}: <b>${stats.n-stats.cancelled}</b>.${stats.first?`\n${L.first} — <b>${when(stats.first,c.timezone,lang).time}</b>\n${L.last} — <b>${when(stats.last,c.timezone,lang).time}</b>`:'\n'+L.free}`;await queue(db,key+member.user_id,member.user_id,JSON.stringify({text:message,parse_mode:'HTML',takt_summary:{company:c.id,day:d,evening},reply_markup:{inline_keyboard:[[button(L.openRecords,{view:'calendar',date:d})],...(evening?[[button(L.tomorrowSchedule,{view:'calendar',date:dateShift(d,1)})]]:[]),[button(L.open,{})]]}})).run();}'''
s=sub_once(s,summary_re,summary_new,'localized summaries')
# Inline controls use recipient language from message metadata.
s=s.replace("if(!stale){const make=(action='')=>{","if(!stale){const L=deliveryCopy(meta.lang||'ru'),make=(action='')=>{")
repls={"'⭐ Оставить отзыв'":"L.review","'Открыть специалиста'":"L.specialist","'Открыть Takt'":"L.open","'✅ Подтвердить'":"L.confirm","'❌ Отклонить'":"L.decline","'📋 Открыть запись'":"L.booking","'Выбрать другое время'":"L.other","'Моя запись'":"L.mine","'👤 Открыть клиента'":"L.client","'Перенести'":"L.move","'Отменить'":"L.cancel","'✅ Да, приду'":"L.yes","'❌ Не смогу'":"L.no","'📍 Построить маршрут'":"L.route"}
for old,new in repls.items(): s=s.replace('text:'+old,'text:'+new)
p.write_text(s)

print('Takt 8.1 server patch applied')
