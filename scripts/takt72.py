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
    out,n=re.subn(pattern,lambda _m: repl,s,count=1,flags=flags)
    if n!=1: raise SystemExit(f'{label}: expected 1 regex match, got {n}')
    return out

# ---------- schema / auth ----------
v2=read('src/v2.js')
v2=replace_once(v2,
"`CREATE INDEX IF NOT EXISTS subscriptions_status ON subscriptions(status,trial_ends_at,paid_until)`\n];",
"`CREATE INDEX IF NOT EXISTS subscriptions_status ON subscriptions(status,trial_ends_at,paid_until)`,\n`CREATE TABLE IF NOT EXISTS telegram_profiles(user_id TEXT PRIMARY KEY,username TEXT NOT NULL DEFAULT '',first_name TEXT NOT NULL DEFAULT '',last_name TEXT NOT NULL DEFAULT '',updated_at INTEGER NOT NULL)`,\n`CREATE TABLE IF NOT EXISTS support_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,company_id TEXT,message TEXT NOT NULL,created_at INTEGER NOT NULL)`,\n`CREATE INDEX IF NOT EXISTS support_requests_user_time ON support_requests(user_id,created_at DESC)`,\n`CREATE TABLE IF NOT EXISTS client_messages(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,client_id TEXT NOT NULL,sender_id TEXT NOT NULL,message TEXT NOT NULL,created_at INTEGER NOT NULL)`,\n`CREATE INDEX IF NOT EXISTS client_messages_sender_time ON client_messages(company_id,sender_id,created_at DESC)`\n];",
'v72 schema')
v2=v2.replace("WHERE version=7","WHERE version=8").replace("VALUES(7)","VALUES(8)")
old_clients="return json((await db.prepare(`SELECT b.user_id AS id,(SELECT name FROM bookings latest WHERE latest.company_id=b.company_id AND latest.user_id=b.user_id ORDER BY latest.created_at DESC,latest.rowid DESC LIMIT 1) AS name,(SELECT phone FROM bookings latest WHERE latest.company_id=b.company_id AND latest.user_id=b.user_id ORDER BY latest.created_at DESC,latest.rowid DESC LIMIT 1) AS phone,COUNT(*) AS bookings,SUM(CASE WHEN b.status='done' THEN 1 ELSE 0 END) AS visits,SUM(CASE WHEN b.status='done' THEN b.price ELSE 0 END) AS revenue,MAX(CASE WHEN b.status='done' THEN b.starts_at END) AS last_visit,MIN(CASE WHEN b.status IN ('pending','confirmed') AND b.starts_at>? THEN b.starts_at END) AS next_visit,COALESCE(n.note,'') AS note FROM bookings b LEFT JOIN client_notes n ON n.company_id=b.company_id AND n.client_id=b.user_id WHERE b.company_id=? GROUP BY b.user_id ORDER BY MAX(b.created_at) DESC`).bind(stamp(),id).all()).results);"
new_clients="return json((await db.prepare(`SELECT b.user_id AS id,(SELECT name FROM bookings latest WHERE latest.company_id=b.company_id AND latest.user_id=b.user_id ORDER BY latest.created_at DESC,latest.rowid DESC LIMIT 1) AS name,(SELECT phone FROM bookings latest WHERE latest.company_id=b.company_id AND latest.user_id=b.user_id ORDER BY latest.created_at DESC,latest.rowid DESC LIMIT 1) AS phone,(SELECT username FROM telegram_profiles p WHERE p.user_id=b.user_id) AS telegram_username,(SELECT state FROM telegram_contacts tc WHERE tc.user_id=b.user_id) AS telegram_state,COUNT(*) AS bookings,SUM(CASE WHEN b.status='done' THEN 1 ELSE 0 END) AS visits,SUM(CASE WHEN b.status='done' THEN b.price ELSE 0 END) AS revenue,MAX(CASE WHEN b.status='done' THEN b.starts_at END) AS last_visit,MIN(CASE WHEN b.status IN ('pending','confirmed') AND b.starts_at>? THEN b.starts_at END) AS next_visit,COALESCE(n.note,'') AS note FROM bookings b LEFT JOIN client_notes n ON n.company_id=b.company_id AND n.client_id=b.user_id WHERE b.company_id=? GROUP BY b.user_id ORDER BY MAX(b.created_at) DESC`).bind(stamp(),id).all()).results);"
v2=replace_once(v2,old_clients,new_clients,'client telegram data')
write('src/v2.js',v2)

write('migrations/0008_takt_v72.sql',r'''-- Takt 7.2: Telegram profiles, private support and specialist-to-client messages.
CREATE TABLE IF NOT EXISTS telegram_profiles(
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS support_requests(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS support_requests_user_time ON support_requests(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS client_messages(
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS client_messages_sender_time ON client_messages(company_id,sender_id,created_at DESC);
''')

auth=read('src/auth.js')
auth=replace_once(auth,
"return {id:String(user.id),name:String(user.first_name||'Клиент'),allows_write:user.allows_write_to_pm===true};",
"return {id:String(user.id),name:String(user.first_name||'Клиент'),first_name:String(user.first_name||'').slice(0,80),last_name:String(user.last_name||'').slice(0,80),username:String(user.username||'').replace(/^@/,'').slice(0,32),allows_write:user.allows_write_to_pm===true};",
'auth profile')
write('src/auth.js',auth)

# ---------- persistent display mode ----------
write('public/display.js',r'''let tg,notify,unsupported=false,manual=false;
const MODE_KEY='takt:display-mode';
const native=()=>!!tg?.initData;
const supported=()=>native()&&!unsupported&&!!tg?.isVersionAtLeast?.('8.0')&&typeof tg.requestFullscreen==='function';
const full=()=>native()?!!tg.isFullscreen:!!document.fullscreenElement;
const available=()=>native()?supported():!!document.fullscreenEnabled;
const savedMode=()=>{try{return localStorage.getItem(MODE_KEY)||'auto'}catch{return 'auto'}};
const saveMode=value=>{try{localStorage.setItem(MODE_KEY,value)}catch{}};
const label=()=>full()?'Свернуть':'На весь экран';
export function displayButton(){return available()?`<button type="button" id="fullscreen-toggle" class="screen-button" aria-label="${label()}" title="${label()}" aria-pressed="${full()}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg><span>${label()}</span></button>`:''}
function sync(){const root=document.documentElement;for(const side of ['top','right','bottom','left']){const system=native()?Number(tg.safeAreaInset?.[side])||0:0,content=native()?Number(tg.contentSafeAreaInset?.[side])||0:0;root.style.setProperty('--takt-system-'+side,Math.max(0,system)+'px');root.style.setProperty('--takt-content-'+side,Math.max(0,content)+'px')}root.classList.toggle('is-fullscreen',full());root.dataset.displayMode=savedMode();const b=document.querySelector('#fullscreen-toggle');if(b){b.hidden=!available();b.title=label();b.setAttribute('aria-label',label());b.setAttribute('aria-pressed',String(full()));b.querySelector('span').textContent=label()}}
async function setFullscreen(want,remember=false){if(remember)saveMode(want?'fullscreen':'compact');try{if(supported()){if(want&&!full())tg.requestFullscreen();else if(!want&&full())tg.exitFullscreen();else if(!want)tg.expand()}else if(!native()&&document.fullscreenEnabled){if(want&&!full())await document.documentElement.requestFullscreen();else if(!want&&full())await document.exitFullscreen()}else if(native())tg.expand()}catch{if(manual)notify('Этот режим экрана недоступен в вашей версии Telegram.')}sync()}
async function toggle(){manual=true;await setFullscreen(!full(),true);manual=false}
export function initDisplay(app,toast){tg=app;notify=toast;tg?.ready();tg?.expand();try{tg?.setHeaderColor('#ffffff');tg?.setBackgroundColor('#f6f7fb')}catch{}for(const event of ['safeAreaChanged','contentSafeAreaChanged','fullscreenChanged','viewportChanged'])tg?.onEvent?.(event,sync);tg?.onEvent?.('fullscreenFailed',event=>{if(event?.error==='UNSUPPORTED')unsupported=true;sync();if(manual)notify('Telegram не поддерживает полный экран на этом устройстве.');manual=false});document.addEventListener('fullscreenchange',sync);window.addEventListener('resize',sync);document.addEventListener('click',event=>{if(event.target.closest('#fullscreen-toggle'))toggle()});sync();const mode=savedMode();if(mode==='fullscreen')setFullscreen(true);else if(mode==='compact')setFullscreen(false);else if(supported()&&!full())setFullscreen(true)}
''')

# ---------- worker ----------
worker=read('src/worker.js')
worker=worker.replace("version:'7.1.0'","version:'7.2.0'")
# save Telegram username from webhook messages
worker=replace_once(worker,
"if(m?.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id<=0)return json({ok:true});\n await resumeBlocked(env.DB,m.chat.id);",
"if(m?.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id<=0)return json({ok:true});\n if(m.from?.id)await env.DB.prepare('INSERT INTO telegram_profiles(user_id,username,first_name,last_name,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,last_name=excluded.last_name,updated_at=excluded.updated_at').bind(String(m.from.id),text(m.from.username||'',32),text(m.from.first_name||'',80),text(m.from.last_name||'',80),now()).run();\n await resumeBlocked(env.DB,m.chat.id);",
'webhook profile')
# support menu opens form inside Takt
worker=replace_once(worker,
"const supportDraft='Здравствуйте! Хочу обратиться в поддержку Takt.\\nПроблема: ';\n const supportUrl=`https://t.me/${env.BOT_USERNAME||'takt_service_bot'}?text=${encodeURIComponent(supportDraft)}`;",
"const supportUrl=new URL(appUrl.href);supportUrl.searchParams.set('support','1');",
'support url')
worker=replace_once(worker,
"{text:'Как это работает?',style:'success',web_app:{url:helpUrl.href}},{text:'Поддержка',style:'danger',url:supportUrl}",
"{text:'Как это работает?',style:'success',web_app:{url:helpUrl.href}},{text:'Поддержка',style:'danger',web_app:{url:supportUrl.href}}",
'support button')
# new authenticated routes before v2 router
anchor="if(path==='/api/v7/reviews'&&req.method==='POST'){return json(await createReview(db,user.id,await body(req)),201)}\n"
extra=r'''if(path==='/api/v72/support'&&req.method==='POST'){
  const data=await body(req),message=text(data.message,1500);if(message.length<5)fail(400,'Опишите проблему чуть подробнее');const admins=owners(env);if(!admins.length)fail(503,'Поддержка временно недоступна');
  const recent=await db.prepare('SELECT COUNT(*) n FROM support_requests WHERE user_id=? AND created_at>?').bind(user.id,now()-600).first();if(Number(recent?.n||0)>=3)fail(429,'Подождите немного перед новым обращением');
  const membership=await db.prepare('SELECT m.company_id,c.name FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.user_id=? AND c.active=1 ORDER BY c.rowid LIMIT 1').bind(user.id).first(),id=crypto.randomUUID(),role=membership?'специалист':'клиент';
  const bodyText=`🛟 <b>Новое обращение в Takt</b>\n\nОт: ${escHtml(user.name||'Пользователь')}\nРоль: ${role}${membership?`\nКабинет: ${escHtml(membership.name)}`:''}\nTelegram ID: <code>${escHtml(user.id)}</code>\n\n${escHtml(message)}`;
  await db.batch([db.prepare('INSERT INTO support_requests(id,user_id,company_id,message,created_at) VALUES(?,?,?,?,?)').bind(id,user.id,membership?.company_id||null,message,now()),...admins.map(admin=>queue(db,`support:${id}:${admin}`,admin,JSON.stringify({text:bodyText,parse_mode:'HTML'})))]);return json({ok:true});
 }
 if(path==='/api/v72/client-message'&&req.method==='POST'){
  const data=await body(req),companyId=text(data.company_id,80),clientId=text(data.client_id,80),message=text(data.message,1000);if(message.length<1)fail(400,'Напишите сообщение');if(!await access(db,env,user,companyId))fail(403,'Нет доступа');const c=await company(db,companyId);if(!/^[0-9]+$/.test(clientId))fail(409,'Этому клиенту можно связаться только по телефону');const ownClient=await db.prepare('SELECT 1 FROM bookings WHERE company_id=? AND user_id=? LIMIT 1').bind(companyId,clientId).first();if(!ownClient)fail(403,'Нет доступа к клиенту');const state=(await db.prepare('SELECT state FROM telegram_contacts WHERE user_id=?').bind(clientId).first())?.state;if(state==='blocked')fail(409,'Клиент запретил сообщения от бота');const count=await db.prepare('SELECT COUNT(*) n,MAX(created_at) last FROM client_messages WHERE company_id=? AND sender_id=? AND created_at>?').bind(companyId,user.id,now()-3600).first();if(Number(count?.n||0)>=10||Number(count?.last||0)>now()-20)fail(429,'Слишком частая отправка. Подождите немного');const id=crypto.randomUUID(),u=new URL(env.APP_URL||url.origin);u.searchParams.set('company',companyId);const payload={text:`<b>Сообщение от ${escHtml(c.name)}</b>\n\n${escHtml(message)}`,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:'Открыть специалиста',style:'primary',web_app:{url:u.href}}]]}};await db.batch([db.prepare('INSERT INTO client_messages(id,company_id,client_id,sender_id,message,created_at) VALUES(?,?,?,?,?,?)').bind(id,companyId,clientId,user.id,message,now()),queue(db,`client-message:${id}`,clientId,JSON.stringify(payload))]);return json({ok:true});
 }
'''
worker=replace_once(worker,anchor,anchor+extra,'v72 routes')
# save profile from WebApp identify
worker=replace_once(worker,
"if(path==='/api/me'){\n  await db.prepare('INSERT INTO account_activity VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen').bind(user.id,now(),now()).run();",
"if(path==='/api/me'){\n  await db.batch([db.prepare('INSERT INTO account_activity VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen').bind(user.id,now(),now()),db.prepare('INSERT INTO telegram_profiles(user_id,username,first_name,last_name,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,last_name=excluded.last_name,updated_at=excluded.updated_at').bind(user.id,text(user.username||'',32),text(user.first_name||user.name||'',80),text(user.last_name||'',80),now())]);",
'webapp profile')
# specialists may complete confirmed booking early; client still cannot
worker=replace_once(worker,"  if(status==='done'&&b.ends_at>now())fail(400,'Завершить можно после окончания записи');\n",'', 'early completion backend')
# immediate delivery for support/client messages
worker=worker.replace("/\\/api\\/(bookings|v2\\/reschedule)/","/\\/api\\/(bookings|v2\\/reschedule|v72\\/(support|client-message))/")
worker=worker.replace("bot-webhook-v70","bot-webhook-v72").replace("bot-menu-v70","bot-menu-v72")
write('src/worker.js',worker)

# ---------- app ----------
app=read('public/app-v2.js')
app=app.replace('?v=71','?v=72').replace('?v=70','?v=72')
# clearer working intervals
app=regex_once(app,r"function intervalInputs\(i,d\)\{[\s\S]*?\}\nfunction scheduleFields",r'''function intervalInputs(i,d){return `<div class="work-interval"><label><small>Начало</small><input type="time" name="start${i}" value="${minute(d.start)}" step="300" aria-label="Начало работы"></label><span class="interval-arrow">→</span><label><small>Окончание</small><input type="time" name="end${i}" value="${minute(d.end===1440?0:d.end)}" step="300" aria-label="Окончание работы"></label><button type="button" class="interval-remove" data-remove-interval aria-label="Удалить интервал">×</button></div>`}
function scheduleFields''','interval ui')
app=replace_once(app,"<div class=\"schedule-editor\">${[1,2,3,4,5,6,0].map(i=>", "<p class=\"schedule-help\">Для каждого дня укажите время работы. Добавьте второй интервал, если нужен перерыв в течение дня.</p><div class=\"schedule-editor\">${[1,2,3,4,5,6,0].map(i=>",'schedule helper')
# support deep link after init
app=replace_once(app,"await render();if(params.get('booking')&&!S.tour)openLinkedBooking().catch(e=>toast(e.message));","await render();if(params.get('support')==='1'&&!S.tour)requestAnimationFrame(()=>supportEditor());if(params.get('booking')&&!S.tour)openLinkedBooking().catch(e=>toast(e.message));",'support init')
# dashboard: blue compact 3 upcoming records
new_dashboard=r'''function dashboard(){const now=Date.now()/1000,today=S.bookings.filter(b=>date(b.starts_at)===day()),futureRows=S.bookings.filter(future).sort((a,b)=>a.starts_at-b.starts_at),upcoming=futureRows.slice(0,3),earned=today.filter(b=>b.status!=='cancelled').reduce((a,b)=>a+b.price,0);const attention=futureRows.filter(b=>b.status==='pending'||b.attendance_state==='not_coming'||(b.attendance_state!=='coming'&&b.starts_at-now<=7200));const reason=b=>b.attendance_state==='not_coming'?['danger','Клиент сообщил, что не придёт']:b.status==='pending'?['warn','Новая запись — подтвердите её']:['muted','Ответа клиента пока нет · до визита меньше 2 часов'];const attentionBlock=attention.length?`<section class="attention-panel"><div class="attention-head"><div><span class="eyebrow">ВАЖНО СЕЙЧАС</span><h2>Требуют внимания</h2></div><strong>${attention.length}</strong></div><div class="attention-list">${attention.slice(0,4).map(b=>{const q=reason(b);return `<article class="attention-row"><div class="attention-main"><strong>${time(b.starts_at)} · ${esc(b.name)}</strong><span>${dateLabel(date(b.starts_at))} · ${esc(b.service_name)}</span><small class="attention-reason ${q[0]}">${q[1]}</small></div><div class="attention-actions">${b.status==='pending'?`<button class="primary compact" data-status="confirmed" data-id="${b.id}">Подтвердить</button>`:''}<button class="secondary compact" data-visit="${b.id}">Открыть</button>${/^[0-9]+$/.test(String(b.user_id))?`<button class="text-button compact" data-message-client="${esc(b.user_id)}">Написать</button>`:''}</div></article>`}).join('')}</div></section>`:'';const nextBlock=upcoming.length?`<section class="next72"><div class="next72-head"><div><span class="eyebrow">БЛИЖАЙШИЕ ЗАПИСИ</span><h2>${upcoming.length===1?'Следующий клиент':'Следующие клиенты'}</h2></div><button class="next72-calendar" data-page="calendar">Расписание →</button></div><div class="next72-list">${upcoming.map((b,i)=>{const att=attendanceInfo(b),duration=Math.round((b.ends_at-b.starts_at)/60),state=b.status==='pending'?'Новая запись':att[1];return `<article class="next72-row ${i===0?'primary-row':''}"><div class="next72-time"><strong>${time(b.starts_at)}</strong><span>${dateLabel(date(b.starts_at))}</span>${i===0?`<small>${until(b.starts_at)}</small>`:''}</div><div class="next72-client"><h3>${esc(b.name)}</h3><p>${esc(b.service_name)}</p><small>${duration} мин · ${money(b.price)}</small></div><div class="next72-state"><span>${esc(state)}</span>${att[2]?`<small>${esc(att[2])}</small>`:''}</div><div class="next72-actions"><button class="next72-open" data-visit="${b.id}">Открыть</button>${/^[0-9]+$/.test(String(b.user_id))?`<button class="next72-message" data-message-client="${esc(b.user_id)}">Написать</button>`:''}</div></article>`}).join('')}</div></section>`:`<section class="next72 empty"><div><span class="eyebrow">БЛИЖАЙШИЕ ЗАПИСИ</span><h2>Пока всё свободно</h2><p>Добавьте клиента вручную или поделитесь своей ссылкой.</p></div><div class="next72-empty-actions"><button class="next72-message" data-manual>＋ Добавить запись</button><button class="next72-open" data-page="share">Моя ссылка</button></div></section>`;const rd=S.own.reviews||{average:0,count:0,items:[]},lastReview=rd.items?.[0],reviewBlock=rd.count?`<section class="dashboard-reviews"><button data-page="reviews"><span class="eyebrow">ОТЗЫВЫ</span><strong>${Number(rd.average||0).toFixed(1)} ★ · ${rd.count}</strong><small>${lastReview?.text?esc(lastReview.text):'Посмотреть все отзывы'}</small></button></section>`:'';return `${heading('Добрый день, '+S.own.name,'Сегодня · '+dateLabel(day()))}<section class="today-summary"><div><span>Записей сегодня</span><strong>${today.filter(active).length}</strong></div><div><span>Стоимость записей</span><strong>${money(earned)}</strong></div><div><span>Вариантов времени</span><strong id="free-count">…</strong><small id="free-label"></small></div></section>${attentionBlock}${nextBlock}${reviewBlock}<div class="section-heading"><h2>Быстрые действия</h2></div><div class="quick-grid"><button data-manual>${icon('calendar')}Добавить запись</button><button data-edit-service="new">${icon('grid')}Добавить услугу</button><button data-page="share">${icon('link')}Моя ссылка</button><button id="block-time">${icon('clock')}Закрыть время</button></div><div class="section-heading"><h2>Записи на сегодня</h2><button data-page="calendar" class="text-button">Все →</button></div>${today.filter(b=>b.status!=='cancelled').sort((a,b)=>a.starts_at-b.starts_at).map(b=>bookingCard(b,true)).join('')||'<div class="dashboard-empty"><h3>На сегодня всё свободно</h3><p>Можно поделиться ссылкой или добавить запись вручную.</p></div>'}`}
'''
app=regex_once(app,r"function dashboard\(\)\{[\s\S]*?\}\nfunction calendarPage\(\)",new_dashboard+"function calendarPage()",'dashboard 7.2')
# calendar day sheet + keep month functional
calendar_helper=r'''function calendarDaySheet(d){const rows=S.bookings.filter(b=>date(b.starts_at)===d&&b.status!=='cancelled').sort((a,b)=>a.starts_at-b.starts_at);openSheet(dateLabel(d),`<div class="calendar-day-sheet"><p class="dialog-sub">${new Date(d+'T12:00Z').toLocaleDateString('ru-RU',{weekday:'long'})} · ${esc(zoneLabel(zone()))}</p>${rows.length?`<div class="calendar-day-list">${rows.map(b=>`<button data-visit="${b.id}"><span><strong>${time(b.starts_at)}–${time(b.ends_at)}</strong><small>${esc(b.service_name)} · ${esc(b.name)}</small></span><span>${money(b.price)}</span></button>`).join('')}</div>`:'<div class="calendar-day-empty"><strong>На этот день записей нет</strong><span>Можно сразу добавить клиента вручную.</span></div>'}<div class="calendar-day-actions"><button class="primary" data-manual-date="${d}">＋ Добавить клиента</button><button class="secondary" data-open-day="${d}">Открыть день</button></div></div>`)}
'''
app=replace_once(app,"function calendarPage(){",calendar_helper+"function calendarPage(){",'calendar helper')
# clients page
new_clients=r'''function clientsPage(){return `${heading('Клиенты','Контакты, история и быстрые действия в одном месте.')}<label class="search-label clients-search">${icon('user')}<input id="client-search" type="search" placeholder="Имя или телефон" aria-label="Найти клиента"></label><div class="client-grid client-grid72">${S.clients.map(x=>{const canMessage=/^[0-9]+$/.test(String(x.id));return `<article class="client-card72" data-search="${esc((x.name+' '+x.phone).toLowerCase())}"><div class="client-card72-main">${imageTag('',x.name,'small-avatar')}<div><h3>${esc(x.name)}</h3><p>${esc(x.phone)}</p><small>${x.visits} завершённых визитов${x.last_visit?' · '+dateLabel(date(x.last_visit)):''}</small></div><span class="client-status72">${x.next_visit?'Запись '+dateLabel(date(x.next_visit)):'Без будущей записи'}</span></div>${x.note?`<p class="client-note72">${esc(x.note)}</p>`:''}<div class="client-actions72">${canMessage?`<button class="client-write72" data-message-client="${esc(x.id)}">Написать</button>`:''}<a class="client-call72" href="tel:${esc(String(x.phone||'').replace(/[^+0-9]/g,''))}">Позвонить</a><button class="client-open72" data-client="${esc(x.id)}">История и заметка</button></div></article>`}).join('')||empty('Здесь появятся ваши клиенты','Отправьте персональную ссылку. После первой записи клиент появится здесь.',button('Поделиться ссылкой','share'))}</div>`}
'''
app=regex_once(app,r"function clientsPage\(\)\{[\s\S]*?\}\nfunction more\(\)",new_clients+"function more()",'clients page 7.2')
# message/support helper functions + richer details
helpers=r'''function supportEditor(){openSheet('Поддержка Takt',`<form id="support-form"><p class="dialog-sub">Сообщение получит только администратор Takt.</p><label>Опишите проблему<textarea name="message" maxlength="1500" minlength="5" required placeholder="Что произошло и что вы ожидали увидеть?"></textarea></label><div class="form-error" role="alert"></div><button class="danger wide" type="submit">Отправить в поддержку</button></form>`)}
function clientMessageEditor(id){const x=S.clients.find(c=>String(c.id)===String(id));if(!x)return;const direct=x.telegram_username?`<button type="button" class="secondary wide" data-open-telegram="${esc(x.telegram_username)}">Открыть личный чат в Telegram</button>`:'';openSheet('Написать клиенту',`${direct}<form id="client-message-form" data-client="${esc(x.id)}"><p class="dialog-sub">${esc(x.name)} · сообщение придёт от Takt с названием вашего кабинета.</p><label>Сообщение<textarea name="message" maxlength="1000" required placeholder="Например: появилось удобное время на завтра…"></textarea></label><div class="form-error" role="alert"></div><button class="primary wide" type="submit">Отправить через Takt</button></form>`)}
function openTelegramClient(username){const clean=String(username||'').replace(/^@/,'').replace(/[^A-Za-z0-9_]/g,'');if(!clean){toast('Личный Telegram клиента пока недоступен');return}const url='https://t.me/'+clean;try{if(tg?.openTelegramLink)tg.openTelegramLink(url);else window.open(url,'_blank','noopener');setTimeout(()=>tg?.close?.(),120)}catch{window.location.href=url}}
'''
app=replace_once(app,"function clientDetails(id){",helpers+"function clientDetails(id){",'communication helpers')
new_details=r'''function clientDetails(id){const x=S.clients.find(x=>x.id===id);if(!x)return;const canMessage=/^[0-9]+$/.test(String(x.id));openSheet(x.name,`<div class="client-detail72"><div class="client-detail72-contact"><div><span>Телефон</span><strong>${esc(x.phone)}</strong></div><div class="client-detail72-actions">${canMessage?`<button class="primary" data-message-client="${esc(id)}">Написать</button>`:''}<a class="secondary" href="tel:${esc(String(x.phone||'').replace(/[^+0-9]/g,''))}">Позвонить</a></div></div><div class="client-summary"><span>${x.visits} завершённых визитов</span><strong>${money(x.revenue)}</strong></div><p class="note">${x.next_visit?'Ближайший визит: '+dateLabel(date(x.next_visit))+' · '+time(x.next_visit):'Нет предстоящих визитов'}</p><form id="note-form" data-client="${esc(id)}"><label>Ваша личная заметка<textarea name="note" maxlength="2000">${esc(x.note)}</textarea></label><div class="form-error" role="alert"></div><button class="secondary">Сохранить заметку</button></form><h3>История записей</h3>${S.bookings.filter(b=>b.user_id===id).map(b=>`<button class="history-line history-button72" data-visit="${b.id}"><strong>${dateLabel(date(b.starts_at))} · ${time(b.starts_at)}</strong><span>${esc(b.service_name)}</span><small>${labels[b.status]} · ${money(b.price)}</small></button>`).join('')||'<p class="note">История пока пуста.</p>'}</div>`)}
'''
app=regex_once(app,r"function clientDetails\(id\)\{[\s\S]*?\}\nasync function reorder",new_details+"async function reorder",'client details 7.2')
# visitActions: early done + separate message/call
new_visit=r'''function visitActions(id){const b=S.bookings.find(x=>x.id===id);if(!b)return;const admin=!isClient(),allowed=active(b)&&(admin||b.starts_at>Date.now()/1000+(S.tenant?.cancel_hours||0)*3600),canMessage=admin&&/^[0-9]+$/.test(String(b.user_id));openSheet('Детали записи',`<div class="booking-review"><h3>${esc(b.service_name)}</h3><p>${dateLabel(date(b.starts_at))} · ${time(b.starts_at)}–${time(b.ends_at)}</p><span class="badge ${b.status}">${labels[b.status]}</span>${admin?(()=>{const a=attendanceInfo(b);return `<div class="visit-attendance"><span class="attendance visit-confirmation ${a[0]}">${a[1]}</span>${a[2]?`<small>${a[2]}</small>`:''}</div>`})():''}<p>${esc(b.name)} · ${esc(b.phone)}</p>${b.details?`<p>${esc(b.details)}</p>`:''}<strong>${money(b.price)}</strong></div><div class="sheet-actions">${!admin&&b.status==='done'&&!b.review_rating?`<button class="primary" data-review="${b.id}">⭐ Оставить отзыв</button>`:''}${admin&&b.status==='pending'?`<button class="primary" data-status="confirmed" data-id="${id}">Подтвердить</button>`:''}${admin&&b.status==='confirmed'?`<button class="primary" data-status="done" data-id="${id}">Завершить визит</button>`:''}${canMessage?`<button class="secondary" data-message-client="${esc(b.user_id)}">Написать клиенту</button>`:''}${admin&&b.phone?`<a class="secondary" href="tel:${esc(String(b.phone).replace(/[^+0-9]/g,''))}">Позвонить</a>`:''}${allowed?` ${admin||S.tenant?.allow_reschedule?`<button class="secondary" data-move="${id}">Перенести</button>`:''}<button class="danger" data-cancel="${id}">Отменить запись</button>`:''}</div><div class="form-error" role="alert"></div>`)}
'''
app=regex_once(app,r"function visitActions\(id\)\{[\s\S]*?\}\nfunction supportEditor",new_visit+"function supportEditor",'visit actions 7.2')
# version settings
app=app.replace('Takt 7.1','Takt 7.2')
# navigation: calendar always enters from top
app=replace_once(app,"if(el.dataset.page){booking=null;pageScroll.set(S.page,scrollY);S.page=el.dataset.page;const y=pageScroll.get(S.page)||0;await render();requestAnimationFrame(()=>scrollTo({top:y,behavior:'auto'}));return}","if(el.dataset.page){booking=null;pageScroll.set(S.page,scrollY);S.page=el.dataset.page;const y=S.page==='calendar'?0:(pageScroll.get(S.page)||0);await render();requestAnimationFrame(()=>scrollTo({top:y,behavior:'auto'}));return}",'calendar top')
# month date -> action sheet, plus direct communication/support handlers
app=replace_once(app,"if(el.dataset.date){S.date=el.dataset.date;S.calendar='day';await render();return}","if(el.dataset.date){if(S.calendar==='month'){calendarDaySheet(el.dataset.date);return}S.date=el.dataset.date;S.calendar='day';await render();return}",'month day sheet')
insert_after="if(el.dataset.review){reviewEditor(el.dataset.review);return}\n"
add_click=r'''if(el.dataset.messageClient){clientMessageEditor(el.dataset.messageClient);return}
if(el.dataset.openTelegram){openTelegramClient(el.dataset.openTelegram);return}
if(el.dataset.manualDate){manualDate=el.dataset.manualDate;manualAt=null;sheet.close();await manualEditor(true);return}
if(el.dataset.openDay){sheet.close();S.date=el.dataset.openDay;S.calendar='day';await render();requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}));return}
if(el.id==='support'){supportEditor();return}
'''
app=replace_once(app,insert_after,insert_after+add_click,'v72 click handlers')
# early done confirmation before status PATCH
old_status="if(el.dataset.status){el.disabled=true;await api('/bookings/'+el.dataset.id,{method:'PATCH',body:JSON.stringify({status:el.dataset.status})});sheet.close();invalidate('work','my');await render({force:true});toast('Статус обновлён');return}"
new_status="if(el.dataset.status){const target=S.bookings.find(b=>b.id===el.dataset.id);if(el.dataset.status==='done'&&target&&target.ends_at>Date.now()/1000&&!el.dataset.confirmDone){openSheet('Завершить запись раньше?',`<p class=\"note\">До запланированного окончания ещё есть время. Уверены, что хотите завершить запись сейчас?</p><button class=\"primary wide\" data-status=\"done\" data-id=\"${target.id}\" data-confirm-done=\"1\">Да, завершить запись</button>`);return}el.disabled=true;await api('/bookings/'+el.dataset.id,{method:'PATCH',body:JSON.stringify({status:el.dataset.status})});sheet.close();invalidate('work','my');await render({force:true});toast(el.dataset.status==='done'?'Запись завершена':'Статус обновлён');return}"
app=replace_once(app,old_status,new_status,'early done confirmation')
# submit support/client-message
submit_anchor="if(form.id==='note-form'){await post('/v2/client-note',{company_id:S.own.id,client_id:form.dataset.client,note:b.note});sheet.close();await render();toast('Заметка сохранена');return}"
submit_new=submit_anchor+r'''
if(form.id==='client-message-form'){await post('/v72/client-message',{company_id:S.own.id,client_id:form.dataset.client,message:b.message});sheet.close();toast('Сообщение отправлено клиенту');return}
if(form.id==='support-form'){await post('/v72/support',{message:b.message});sheet.close();toast('Обращение отправлено в поддержку');return}'''
app=replace_once(app,submit_anchor,submit_new,'message/support submit')
write('public/app-v2.js',app)

# ---------- landing hero ----------
landing=read('public/landing.js')
landing=landing.replace("<h1>Запись клиентов<br>без лишних<br><em>сообщений.</em></h1>","<h1>Запись клиентов<br>без лишних <em>сообщений.</em></h1>")
write('public/landing.js',landing)

# ---------- CSS ----------
write('public/takt-v72.css',r'''/* Takt 7.2 — requested UX polish */
:root{--t72-blue:#2857e6;--t72-blue-deep:#1d42be;--t72-lime:#c9ff32;--t72-green:#2dbb74;--t72-soft-green:#edf9f3}
/* Landing: never clip the headline on phones/tablets. */
.v3-hero{overflow:hidden}.v3-hero h1{max-width:100%;font-size:clamp(44px,6vw,82px)!important;line-height:.98!important;overflow-wrap:normal;word-break:normal}.v3-hero h1 em{color:var(--t72-lime);font-style:normal;display:inline}.v3-hero>div:first-child{min-width:0}.v3-calendar-mock{min-width:0}
/* Client onboarding gets a premium blue frame without becoming a giant solid block. */
.client-intro{position:relative;overflow:hidden;max-width:760px;margin:22px auto;padding:42px 36px!important;border:1px solid #c9d6ff!important;border-radius:30px!important;background:linear-gradient(155deg,#fff 0%,#f7f9ff 70%,#edf3ff 100%)!important;box-shadow:0 22px 70px rgba(33,71,174,.09)}.client-intro:before{content:'';position:absolute;inset:0 0 auto;height:6px;background:linear-gradient(90deg,var(--t72-blue),#6e8fff,var(--t72-lime))}.client-intro .portrait,.client-intro .initials{box-shadow:0 0 0 7px #edf2ff,0 12px 32px rgba(47,91,234,.15)}.client-intro .primary{background:var(--t72-lime)!important;color:#1d2b15!important}
/* Blue, compact, useful nearest bookings panel. */
.next72{margin:18px 0 22px;padding:22px;border-radius:26px;background:linear-gradient(145deg,var(--t72-blue),var(--t72-blue-deep));color:#fff;box-shadow:0 20px 50px rgba(35,78,199,.19)}.next72-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:14px}.next72 .eyebrow{color:#cbd8ff}.next72-head h2{margin:4px 0 0;font-size:24px}.next72-calendar,.next72-open,.next72-message{border:0;border-radius:12px;padding:10px 14px;font-weight:750}.next72-calendar,.next72-open{background:rgba(255,255,255,.13);color:#fff;border:1px solid rgba(255,255,255,.18)}.next72-message{background:var(--t72-lime);color:#213012}.next72-list{display:grid;gap:8px}.next72-row{display:grid;grid-template-columns:132px minmax(0,1.2fr) minmax(170px,.9fr) auto;gap:16px;align-items:center;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.10)}.next72-row.primary-row{background:rgba(255,255,255,.15)}.next72-time{display:grid}.next72-time strong{font-size:30px;letter-spacing:-1px}.next72-time span,.next72-time small,.next72-client small,.next72-state small{color:#dbe4ff}.next72-client h3{margin:0 0 3px;font-size:18px}.next72-client p{margin:0 0 3px;color:#fff}.next72-state{display:grid;gap:4px;font-size:13px}.next72-actions{display:flex;gap:7px}.next72.empty{display:flex;align-items:center;justify-content:space-between;gap:18px}.next72.empty h2{margin:5px 0}.next72.empty p{margin:0;color:#dce5ff}.next72-empty-actions{display:flex;gap:8px}
/* Clients */
.client-grid72{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.client-card72{padding:18px;border:1px solid #e4e9f1;border-radius:20px;background:#fff;box-shadow:0 10px 30px rgba(22,35,63,.04)}.client-card72-main{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center}.client-card72-main h3{margin:0}.client-card72-main p{margin:3px 0;color:#687384}.client-card72-main small{color:#8b95a5}.client-status72{padding:6px 9px;border-radius:999px;background:var(--t72-soft-green);color:#23885b;font-size:11px;font-weight:750}.client-note72{margin:13px 0 0;padding:10px 12px;border-radius:12px;background:#f7f8fa;color:#66717f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.client-actions72{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.client-actions72 button,.client-actions72 a{min-height:40px;padding:9px 12px;border-radius:11px;text-decoration:none;font-weight:700}.client-write72{border:0;background:var(--t72-green);color:#fff}.client-call72,.client-open72{border:1px solid #e2e6ed;background:#fff;color:#3155a6}.client-detail72-contact{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px;border-radius:16px;background:#f7faf8;border:1px solid #def0e6}.client-detail72-contact>div:first-child{display:grid;gap:3px}.client-detail72-contact span{font-size:11px;color:#7a8792}.client-detail72-actions{display:flex;gap:8px}.history-button72{width:100%;border:0;text-align:left}
/* Calendar month day sheet */
.calendar-day-list{display:grid;gap:8px;margin:12px 0}.calendar-day-list button{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;padding:13px 14px;border:1px solid #e6eaf1;border-radius:14px;background:#fff;text-align:left}.calendar-day-list button span:first-child{display:grid;gap:2px}.calendar-day-list small{color:#7f8998}.calendar-day-empty{display:grid;gap:5px;padding:22px;border-radius:16px;background:#fff5f5;border:1px solid #ffdadd;text-align:center;color:#9d3440}.calendar-day-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
/* Schedule editor: aligned weekday checkbox and readable intervals. */
.schedule-help{margin:0 0 12px;padding:12px 14px;border-radius:14px;background:#f2f7ff;color:#56647a;font-size:13px}.work-day{align-items:start}.day-check{display:grid!important;grid-template-columns:24px minmax(0,1fr)!important;align-items:center!important;gap:10px!important;min-height:44px}.day-check input[type=checkbox]{margin:0!important;justify-self:center!important;align-self:center!important}.work-interval{display:grid!important;grid-template-columns:minmax(110px,1fr) auto minmax(110px,1fr) 36px!important;gap:8px!important;align-items:end!important;padding:10px!important;border-radius:14px!important;background:#f8f9fb!important;border:1px solid #e9edf3!important}.work-interval label{display:grid!important;gap:4px!important;margin:0!important}.work-interval label small{font-size:10px!important;color:#8b95a4!important}.interval-arrow{align-self:center;color:#8e98a7}.interval-remove{width:34px;height:34px;border:0;border-radius:50%;background:#eef1f5;color:#596575;font-size:20px}
/* Settings receive only subtle green accents, blue stays primary. */
.settings-section[open]>summary{color:#214fae}.settings-section[open]>summary:before{background:var(--t72-green)!important}.settings-card .toggle-row input:checked{background:var(--t72-green)!important;border-color:var(--t72-green)!important}
/* Support */
#support-form .danger{background:#d94755!important;color:#fff!important}
@media(max-width:760px){.v3-hero{padding:20px 16px!important;border-radius:22px!important}.v3-hero h1{font-size:clamp(34px,10.5vw,48px)!important;line-height:1!important;margin:15px 0!important}.v3-hero h1 br{display:none}.v3-hero h1 em{display:inline}.v3-calendar-mock{margin-top:18px!important}.client-intro{margin:10px 0 18px;padding:30px 18px!important;border-radius:24px!important}.client-intro h1{font-size:30px!important}.next72{padding:16px;border-radius:22px}.next72-head{align-items:center}.next72-head h2{font-size:20px}.next72-row{grid-template-columns:76px minmax(0,1fr);gap:10px;padding:12px}.next72-time strong{font-size:24px}.next72-state{grid-column:1/3;padding-top:8px;border-top:1px solid rgba(255,255,255,.12)}.next72-actions{grid-column:1/3}.next72-actions button{flex:1}.next72.empty{display:grid}.next72-empty-actions{display:grid;grid-template-columns:1fr 1fr}.client-grid72{grid-template-columns:1fr}.client-card72{padding:15px}.client-card72-main{grid-template-columns:auto minmax(0,1fr)}.client-status72{grid-column:2}.client-actions72{display:grid;grid-template-columns:1fr 1fr}.client-open72{grid-column:1/3}.calendar-day-actions{grid-template-columns:1fr}.work-interval{grid-template-columns:1fr auto 1fr!important}.interval-remove{grid-column:3;justify-self:end}.interval-arrow{grid-row:1}.work-interval label input{min-width:0}.client-detail72-contact{display:grid}.client-detail72-actions{display:grid;grid-template-columns:1fr 1fr}.client-detail72-actions>*{text-align:center}}
@media(min-width:761px) and (max-width:1100px){.v3-hero h1{font-size:clamp(42px,6vw,64px)!important}.next72-row{grid-template-columns:100px minmax(0,1fr) minmax(150px,.8fr)}.next72-actions{grid-column:2/4}.client-grid72{grid-template-columns:1fr}}
''')

# ---------- cache/version ----------
index=read('public/index.html')
index=index.replace('?v=71','?v=72').replace('?v=70','?v=72')
if '/takt-v72.css' not in index:index=index.replace('</head>','<link rel="stylesheet" href="/takt-v72.css?v=72">\n</head>')
write('public/index.html',index)

pkg=json.loads(read('package.json'));pkg['version']='7.2.0';write('package.json',json.dumps(pkg,ensure_ascii=False,separators=(',',':'))+'\n')
try:
 lock=json.loads(read('package-lock.json'));lock['version']='7.2.0';
 if isinstance(lock.get('packages'),dict) and '' in lock['packages']:lock['packages']['']['version']='7.2.0'
 write('package-lock.json',json.dumps(lock,ensure_ascii=False,indent=2)+'\n')
except Exception: pass

write('test/v72.test.mjs',r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('7.2 persists display choice',()=>{const s=fs.readFileSync(new URL('../public/display.js',import.meta.url),'utf8');assert.match(s,/takt:display-mode/);assert.match(s,/fullscreen/);assert.match(s,/compact/)});
test('7.2 has private support and specialist client messaging',()=>{const s=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');assert.match(s,/\/api\/v72\/support/);assert.match(s,/\/api\/v72\/client-message/);assert.match(s,/owners\(env\)/)});
test('7.2 allows early specialist completion with confirmation in UI',()=>{const w=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8'),a=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');assert.doesNotMatch(w,/Завершить можно после окончания записи/);assert.match(a,/Завершить запись раньше\?/)});
test('7.2 month calendar has quick day actions',()=>{const a=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');assert.match(a,/calendarDaySheet/);assert.match(a,/data-manual-date/);assert.match(a,/data-open-day/)});
test('7.2 nearest bookings panel and client communication exist',()=>{const a=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');assert.match(a,/БЛИЖАЙШИЕ ЗАПИСИ/);assert.match(a,/data-message-client/);assert.match(a,/Отправить через Takt/)});
''')
print('Takt 7.2 patch applied')
