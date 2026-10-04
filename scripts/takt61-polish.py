from pathlib import Path
import json

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

def replace_block(text, start, end, replacement, label):
    i = text.find(start)
    if i < 0:
        raise RuntimeError(f'{label}: start not found')
    j = text.find(end, i)
    if j < 0:
        raise RuntimeError(f'{label}: end not found')
    return text[:i] + replacement + text[j:]

# ---------- public/app-v2.js ----------
app_path = 'public/app-v2.js'
app = read(app_path).replace('?v=60', '?v=61')

new_dashboard = r'''function dashboard(){const now=Date.now()/1000,today=S.bookings.filter(b=>date(b.starts_at)===day()),futureRows=S.bookings.filter(future).sort((a,b)=>a.starts_at-b.starts_at),next=futureRows[0],earned=today.filter(b=>b.status!=='cancelled').reduce((a,b)=>a+b.price,0),sub=S.own.subscription;const attention=futureRows.filter(b=>b.status==='pending'||b.attendance_state==='not_coming'||(b.attendance_state!=='coming'&&b.starts_at-now<=7200));const attentionReason=b=>b.attendance_state==='not_coming'?['danger','Клиент сообщил, что не придёт']:b.status==='pending'?['warn','Новая запись — подтвердите её']:['muted','Скоро визит — клиент ещё не ответил'];const attentionBlock=attention.length?`<section class="attention-panel"><div class="attention-head"><div><span class="eyebrow">ВАЖНО СЕЙЧАС</span><h2>Требуют внимания</h2></div><strong>${attention.length}</strong></div><div class="attention-list">${attention.slice(0,4).map(b=>{const reason=attentionReason(b);return `<article class="attention-row"><div class="attention-main"><strong>${time(b.starts_at)} · ${esc(b.name)}</strong><span>${dateLabel(date(b.starts_at))} · ${esc(b.service_name)}</span><small class="attention-reason ${reason[0]}">${reason[1]}</small></div><div class="attention-actions">${b.status==='pending'?`<button class="primary compact" data-status="confirmed" data-id="${b.id}">Подтвердить</button>`:''}<button class="secondary compact" data-visit="${b.id}">Открыть</button>${b.phone?`<a class="text-button compact" href="tel:${esc(String(b.phone).replace(/[^+0-9]/g,''))}">Связаться</a>`:''}</div></article>`}).join('')}</div></section>`:'';const nextBlock=next?(()=>{const att=attendanceInfo(next),duration=Math.round((next.ends_at-next.starts_at)/60),phone=String(next.phone||'').replace(/[^+0-9]/g,'');return `<section class="next-visit"><div class="next-visit-head"><span class="eyebrow">СЛЕДУЮЩАЯ ЗАПИСЬ</span><span class="next-countdown">${until(next.starts_at)}</span></div><div class="next-visit-body"><div class="next-time"><strong>${time(next.starts_at)}</strong><span>${dateLabel(date(next.starts_at))}</span></div><div class="next-person"><h2>${esc(next.name)}</h2><p>${esc(next.service_name)}</p><div class="next-facts"><span>${duration} мин</span><span>${money(next.price)}</span></div></div><div class="next-statuses"><span class="badge ${next.status}">${labels[next.status]}</span><span class="attendance ${att[0]}">${att[1]}</span></div></div><div class="next-actions"><button class="secondary" data-visit="${next.id}">Открыть запись</button>${phone?`<a class="next-contact" href="tel:${esc(phone)}">Связаться</a>`:''}</div></section>`})():`<div class="dashboard-empty"><h3>Сегодня записей нет 👋</h3><p>Свободные окна доступны клиентам для онлайн-записи.</p><div class="actions"><button class="primary" data-page="share">Поделиться ссылкой</button><button class="secondary" data-manual>＋ Добавить запись</button></div></div>`;return `${heading('Добрый день, '+S.own.name,'Сегодня · '+dateLabel(day()))}${sub?`<button class="subscription-strip ${sub.status==='expired'?'expired':''}" data-page="subscription"><span>${esc(trialText(S.own))}</span><strong>${sub.status==='trial'?'7 дней бесплатно → 590 ₽/мес':sub.status==='expired'?'590 ₽/месяц':'Takt'}</strong></button>`:''}<section class="today-summary"><div><span>Записей сегодня</span><strong>${today.filter(active).length}</strong></div><div><span>Стоимость записей</span><strong>${money(earned)}</strong></div><div><span>Вариантов времени</span><strong id="free-count">…</strong><small id="free-label"></small></div></section>${attentionBlock}${nextBlock}<div class="section-heading"><h2>Быстрые действия</h2></div><div class="quick-grid"><button data-manual>${icon('calendar')}Добавить запись</button><button data-edit-service="new">${icon('grid')}Добавить услугу</button><button data-page="share">${icon('link')}Моя ссылка</button><button id="block-time">${icon('clock')}Закрыть время</button></div><div class="section-heading"><h2>Записи на сегодня</h2><button data-page="calendar" class="text-button">Все →</button></div>${today.filter(b=>b.status!=='cancelled').sort((a,b)=>a.starts_at-b.starts_at).map(b=>bookingCard(b,true)).join('')||'<div class="dashboard-empty"><h3>На сегодня всё свободно</h3><p>Можно поделиться ссылкой или добавить запись вручную.</p></div>'}`}
'''
app = replace_block(app, 'function dashboard(){', 'function calendarPage(){', new_dashboard, 'dashboard')

old_open = "function openSheet(title,html){sheet.scrollTop=0;sheet.innerHTML=`<div class=\"sheet-grip\"></div><div class=\"dialog-head\"><h2>${esc(title)}</h2><button class=\"close\" data-close aria-label=\"Закрыть\">×</button></div>${html}`;if(!sheet.open)sheet.showModal()}"
new_open = "function openSheet(title,html,back=''){sheet.scrollTop=0;const backButton=back?(back==='close'?'<button class=\"dialog-back\" data-close aria-label=\"Назад\">← Назад</button>':`<button class=\"dialog-back\" id=\"${back}\" aria-label=\"Назад\">← Назад</button>`):'';sheet.innerHTML=`<div class=\"sheet-grip\"></div><div class=\"dialog-head ${back?'has-back':''}\">${backButton}<h2>${esc(title)}</h2><button class=\"close\" data-close aria-label=\"Закрыть\">×</button></div>${html}`;if(!sheet.open)sheet.showModal()}"
app = replace_once(app, old_open, new_open, 'openSheet')

manual_start = app.find('function manualNewClientEditor(){')
manual_end = app.find('async function startBooking', manual_start)
if manual_start < 0 or manual_end < 0:
    raise RuntimeError('manual flow block not found')
new_manual = r'''function manualNewClientEditor(){openSheet('Новый клиент',`<form id="manual-client-form"><label>Имя<input name="name" value="${esc(manualNewClient.name)}" required minlength="2" maxlength="80" autocomplete="name"></label><label>Телефон<input name="phone" type="tel" value="${esc(manualNewClient.phone)}" required minlength="10" maxlength="24" autocomplete="tel"></label><div class="form-error" role="alert"></div><button class="primary wide">Выбрать услугу</button></form>`,'manual-back-clients')}
function manualServices(){openSheet('Выберите услугу',`<p class="note">Клиент: ${esc(manualClient.name)}</p><div class="manual-services">${S.own.services.filter(s=>s.active).map(s=>`<button class="more-card" data-manual-service="${s.id}"><div><h3>${esc(s.name)}</h3><p>${s.duration} мин · ${money(s.price)}</p></div>${icon('arrow')}</button>`).join('')}</div>`,'manual-back-clients')}
'''
app = app[:manual_start] + new_manual + app[manual_end:]

bs = app.find('async function bookingSheet(){')
be = app.find('let slotRequest=0,calendarRequest=0;', bs)
if bs < 0 or be < 0:
    raise RuntimeError('bookingSheet block not found')
new_booking_sheet = r'''async function bookingSheet(){const epoch=++calendarRequest,b=booking;if(!b)return;if(b.step===0){const back=b.manual&&!b.move?'manual-back-services':'close';openSheet(b.move?'Перенести запись':'Выберите дату и время',`<p class="dialog-sub">${esc(b.s.name)} · ${b.s.duration} мин · ${money(b.s.price)}</p><div id="booking-calendar">${skeleton()}</div><div id="available-slots" class="slots">${skeleton()}</div><p class="note">${esc(zoneLabel(zone()))}</p><div class="sticky-actions"><button class="primary wide" id="booking-next" disabled>${b.move?'Перенести на это время':'Продолжить'}</button></div><div class="form-error" role="alert"></div>`,back);try{const dates=await api('/availability?company='+b.tenant.id+'&service='+b.s.id+'&date='+b.month+'-01&days=31'+(b.move?'&booking='+b.move.id:''));if(epoch!==calendarRequest||booking!==b||!sheet.open)return;for(const d of dates)b.availability[d.date]=d;if(!b.date.startsWith(b.month))b.date=dates.find(d=>d.date.startsWith(b.month)&&d.count>0)?.date||b.month+'-01';sheet.querySelector('#booking-calendar').innerHTML=bookingCalendar(b);await loadSlots()}catch(e){if(epoch===calendarRequest&&booking===b&&sheet.open){sheet.querySelector('#available-slots').innerHTML='<p>Не удалось загрузить данные</p><button class="secondary" id="retry-slots">Повторить</button>';sheet.querySelector('#booking-calendar').innerHTML=''}}}
else if(b.step===1){openSheet('Контакты для встречи',`<p class="dialog-sub">${dateLabel(b.date)} · ${time(b.at)} · ${esc(b.s.name)}</p><form id="booking-contact"><label>Имя<input name="name" value="${esc(b.name)}" minlength="2" maxlength="80" required autocomplete="given-name"></label><label>Телефон<input name="phone" type="tel" value="${esc(b.phone)}" minlength="10" maxlength="24" required autocomplete="tel"></label><label>${b.tenant.category==='cleaning'?'Адрес и площадь':b.tenant.category==='auto'?'Автомобиль и задача':'Комментарий'}<textarea name="details" maxlength="1200" ${['cleaning','auto'].includes(b.tenant.category)?'required minlength="5"':''}>${esc(b.details)}</textarea></label><label class="consent"><input type="checkbox" required><span>Передать контакты ${b.manual?'для оформления записи':'специалисту для обработки моей заявки'}.</span></label><div class="form-error" role="alert"></div><button class="primary wide">Проверить запись</button></form>`,'booking-back')}
else openSheet('Ваша запись',`<div class="booking-review"><span class="eyebrow">${esc(b.tenant.name)}</span><h2>${esc(b.s.name)}</h2><div><span>Дата и время</span><strong>${dateLabel(b.date)}, ${time(b.at)}</strong></div><div><span>Длительность</span><strong>${b.s.duration} мин</strong></div><div><span>Стоимость</span><strong>${money(b.s.price)}</strong></div><div><span>Клиент</span><strong>${esc(b.name)}</strong></div><div><span>Телефон</span><strong>${esc(b.phone)}</strong></div><p class="note">Без онлайн-оплаты. ${b.manual?'Запись появится в вашем календаре.':'Специалист подтвердит вашу заявку.'}</p><div class="form-error" role="alert"></div><button class="primary wide" id="booking-submit">${b.manual?'Добавить запись':'Подтвердить запись'}</button></div>`,'booking-back')}
'''
app = app[:bs] + new_booking_sheet + app[be:]

# Add visible version to Settings.
settings_start = app.find('function settingsPage(){')
settings_end = app.find('function analyticsPage(){', settings_start)
if settings_start < 0 or settings_end < 0:
    raise RuntimeError('settingsPage block not found')
settings = app[settings_start:settings_end]
settings = replace_once(settings, '</form></section>`}', '</form></section><p class="settings-version">Версия Takt 6.1</p>`}', 'settings version')
app = app[:settings_start] + settings + app[settings_end:]
write(app_path, app)

# ---------- public/takt-v6.css ----------
css_path = 'public/takt-v6.css'
css = read(css_path)
marker = '/* Takt 6.1 — dashboard clarity, top Back navigation and stronger booking states. */'
if marker not in css:
    css += r'''

/* Takt 6.1 — dashboard clarity, top Back navigation and stronger booking states. */
.next-visit{padding:22px 26px!important;min-height:0!important;display:block!important;background:#2f59db!important;color:#fff;border-radius:28px!important;box-shadow:0 12px 34px rgba(38,73,190,.16)}
.next-visit-head{display:flex!important;justify-content:space-between;align-items:center!important;gap:16px;margin-bottom:18px}.next-visit-head .eyebrow{color:#dfe7ff;letter-spacing:.12em}.next-countdown{font-weight:750;font-size:14px;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.18);padding:7px 10px;border-radius:999px;white-space:nowrap}
.next-visit-body{display:grid!important;grid-template-columns:130px minmax(0,1fr) auto;align-items:center!important;gap:24px!important}.next-time{display:flex!important;flex-direction:column;gap:2px!important}.next-time strong{font-size:48px;line-height:1;font-weight:820;letter-spacing:-.04em}.next-time span{font-size:14px;color:#dfe7ff}.next-person{display:block!important}.next-person h2{font-size:22px!important;line-height:1.15;margin:0 0 6px!important;color:#fff}.next-person p{margin:0!important;color:#e4eaff!important}.next-facts{display:flex!important;gap:8px!important;margin-top:8px;font-size:14px;color:#fff}.next-facts span+span:before{content:'·';margin-right:8px;opacity:.65}.next-statuses{display:flex!important;flex-direction:column;align-items:flex-end!important;gap:8px!important}.next-visit .badge,.next-visit .attendance{margin:0!important;white-space:nowrap}.next-visit .badge{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.18);padding:7px 10px;border-radius:999px}.next-visit .badge.confirmed{background:#e9f6c7;color:#344718;border-color:transparent}.next-visit .badge.pending{background:#fff0bd;color:#6e5310;border-color:transparent}.next-visit .attendance.unknown{background:rgba(255,255,255,.94);color:#526079}.next-visit .attendance.coming{background:#dff4b9;color:#29450f}.next-visit .attendance.not_coming{background:#ffe0e0;color:#922b2b}.next-actions{display:flex!important;align-items:center!important;gap:12px!important;margin-top:18px!important}.next-actions .secondary{background:#fff;color:#2a4eb7;border:0}.next-contact{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:14px;color:#fff;font-weight:750;text-decoration:none;border:1px solid rgba(255,255,255,.32)}
.attention-panel{margin:20px 0;padding:20px 22px;border-radius:24px;background:#fff;border:1px solid #e5e9f2;box-shadow:0 8px 28px rgba(37,48,73,.05)}.attention-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:10px}.attention-head h2{margin:3px 0 0;font-size:24px}.attention-head .eyebrow{color:#7d8798}.attention-head>strong{min-width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#eef2ff;color:#2f59db}.attention-list{display:grid}.attention-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:15px 0;border-top:1px solid #edf0f5}.attention-main{display:grid;gap:4px;min-width:0}.attention-main>strong{font-size:16px}.attention-main>span{font-size:14px;color:#697386}.attention-reason{display:inline-flex;width:max-content;max-width:100%;padding:6px 9px;border-radius:9px;font-size:12px;font-weight:750}.attention-reason.warn{background:#fff4ce;color:#74560c}.attention-reason.danger{background:#ffe9e9;color:#9d3030}.attention-reason.muted{background:#eef2f7;color:#59677b}.attention-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}.compact{min-height:38px!important;padding:0 13px!important;border-radius:12px!important;font-size:13px!important}
#dialog .dialog-head{position:sticky;top:0;z-index:20;display:grid!important;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;background:#fff;padding-top:6px;padding-bottom:14px;border-bottom:1px solid rgba(226,231,240,.75)}#dialog .dialog-head h2{grid-column:2;margin:0!important;min-width:0}#dialog .dialog-head .close{grid-column:3}.dialog-back{grid-column:1;border:0;background:#eef2ff;color:#2f59b9;font:inherit;font-weight:750;min-height:42px;padding:0 13px;border-radius:13px;cursor:pointer}.dialog-back:hover{background:#e4eaff}.sticky-actions{position:sticky!important;bottom:0;z-index:12;background:linear-gradient(to bottom,rgba(255,255,255,0),#fff 28%);padding-top:28px!important;margin-top:8px!important}.sticky-actions .primary{width:100%}.slot.active{background:#d4f542!important;color:#263216!important;border-color:#b9da25!important;box-shadow:0 0 0 3px rgba(212,245,66,.22)}.settings-version{margin:14px 4px 0;text-align:center;color:#9299a7;font-size:12px}
@media(max-width:760px){.next-visit{padding:20px!important;border-radius:22px!important}.next-visit-head{align-items:flex-start!important;flex-direction:column;gap:8px}.next-visit-body{grid-template-columns:92px minmax(0,1fr)!important;gap:15px!important}.next-time strong{font-size:38px}.next-statuses{grid-column:1/-1;align-items:flex-start!important;flex-direction:row;flex-wrap:wrap}.next-actions{flex-wrap:wrap}.attention-row{align-items:flex-start;flex-direction:column}.attention-actions{width:100%;flex-wrap:wrap}#dialog .dialog-head{gap:8px}.dialog-back{padding:0 10px;min-height:40px}.dialog-head h2{font-size:21px!important}}
'''
write(css_path, css)

# ---------- src/delivery.js ----------
delivery_path = 'src/delivery.js'
delivery = read(delivery_path)
delivery = replace_once(delivery, "if(!meta.admin&&route&&['reminder','client_2h'].includes(meta.event))payload.reply_markup.inline_keyboard.push([{text:'📍 Построить маршрут',url:route}]);", "if(!meta.admin&&route&&meta.event==='client_2h')payload.reply_markup.inline_keyboard.push([{text:'📍 Построить маршрут',url:route}]);", 'route only at 2h')
write(delivery_path, delivery)

# ---------- src/worker.js ----------
worker_path = 'src/worker.js'
worker = read(worker_path)
cb_start = worker.find("if(cb?.id&&Number.isSafeInteger(cb.from?.id)&&typeof cb.data==='string')")
cb_end = worker.find("if(m?.chat?.type!=='private'", cb_start)
if cb_start < 0 or cb_end < 0:
    raise RuntimeError('callback block not found')
new_cb = r'''if(cb?.id&&Number.isSafeInteger(cb.from?.id)&&typeof cb.data==='string'){const hit=cb.data.match(/^visit:([a-z0-9-]+):(yes|no)$/);if(hit){try{const result=await respondAttendance(env.DB,String(cb.from.id),hit[1],hit[2]==='yes'?'coming':'not_coming'),feedback=result.attendance_state==='coming'?'✅ Вы подтвердили визит':result.late?'⚠️ Вы сообщили, что не сможете прийти. Специалист уведомлён.':'❌ Запись отменена';await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:result.attendance_state==='coming'?'Спасибо, визит подтверждён ✅':result.late?'Специалист уведомлён':'Запись отменена'});if(cb.message?.chat?.id&&cb.message?.message_id){const original=String(cb.message.text||'Напоминание о записи').replace(/\n\n(?:✅ Вы подтвердили визит|⚠️ Вы сообщили[\s\S]*|❌ Запись отменена)$/,'');await telegram(env,'editMessageText',{chat_id:cb.message.chat.id,message_id:cb.message.message_id,text:(original+'\n\n'+feedback).slice(0,4096),reply_markup:{inline_keyboard:[]}}).catch(()=>{});}}catch(e){await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:e.message||'Не удалось сохранить ответ',show_alert:true}).catch(()=>{});}return json({ok:true})}}
 '' '
new_cb = new_cb[:-4]  # remove helper spacing marker
worker = worker[:cb_start] + new_cb + worker[cb_end:]
worker = replace_once(worker, "if(path==='/api/health')return json({ok:true,version:'6.0.0'});", "if(path==='/api/health')return json({ok:true,version:'6.1.0'});", 'health version')

sched_start = worker.find(' async scheduled(_event,env,ctx){')
sched_end = worker.rfind('\n};')
if sched_start < 0 or sched_end < 0:
    raise RuntimeError('scheduled block not found')
new_sched = r''' async scheduled(_event,env,ctx){await ensureSchema(env.DB);ctx.waitUntil((async()=>{if(env.BOT_TOKEN&&!await env.DB.prepare("SELECT 1 FROM task_runs WHERE name='bot-webhook-v61' AND state='ok'").first()){try{await trackedTask(env.DB,'bot-webhook-v61',async()=>{const secret=await webhookSecret(env),appUrl=new URL(env.APP_URL||'https://takt.teymurstudent.workers.dev');await telegram(env,'setWebhook',{url:new URL('/api/telegram/webhook',appUrl).href,secret_token:secret,allowed_updates:['message','callback_query']})})}catch{}}if(env.BOT_TOKEN&&!await env.DB.prepare("SELECT 1 FROM task_runs WHERE name='bot-menu-v5' AND state='ok'").first()){try{await trackedTask(env.DB,'bot-menu-v5',()=>telegram(env,'setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть Takt',web_app:{url:env.APP_URL||'https://takt.teymurstudent.workers.dev'}}}))}catch{}}await trackedTask(env.DB,'notifications',()=>deliver(env))})())}
};'''
worker = worker[:sched_start] + new_sched + worker[sched_end+3:]
write(worker_path, worker)

# ---------- package.json ----------
pkg_path = 'package.json'
pkg = json.loads(read(pkg_path))
pkg['version'] = '6.1.0'
write(pkg_path, json.dumps(pkg, ensure_ascii=False, separators=(',',':')) + '\n')

# ---------- public/index.html ----------
index_path = 'public/index.html'
index = read(index_path).replace('?v=60','?v=61')
write(index_path,index)

print('Takt 6.1 polish applied')
