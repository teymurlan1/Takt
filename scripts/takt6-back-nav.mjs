import fs from 'node:fs';

const path = 'public/app-v2.js';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Patch target is ambiguous: ${label}`);
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

function replaceBlock(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Block start not found: ${label}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Block end not found: ${label}`);
  source = source.slice(0, start) + replacement + source.slice(end);
}

replaceOnce(
  "let renderVersion=0,booking=null,toastTimer,pollBusy=false,manualDate=day(),manualAt=null,manualClient=null;",
  "let renderVersion=0,booking=null,toastTimer,pollBusy=false,manualDate=day(),manualAt=null,manualClient=null,manualNewClient={name:'',phone:''};",
  'manual booking draft state'
);

replaceOnce(
  "async function manualEditor(){if(!S.own.services.some(s=>s.active)){toast('Сначала добавьте доступную услугу');return}manualClient=null;openSheet('Кого записать?',skeleton());",
  "async function manualEditor(reset=true){if(!S.own.services.some(s=>s.active)){toast('Сначала добавьте доступную услугу');return}if(reset){manualClient=null;manualNewClient={name:'',phone:''};booking=null}openSheet('Кого записать?',skeleton());",
  'manual client picker reset'
);

replaceBlock(
  'function manualServices(){',
  'async function startBooking',
  `function manualNewClientEditor(){openSheet('Новый клиент',\`<form id="manual-client-form"><label>Имя<input name="name" value="\${esc(manualNewClient.name)}" required minlength="2" maxlength="80" autocomplete="name"></label><label>Телефон<input name="phone" type="tel" value="\${esc(manualNewClient.phone)}" required minlength="10" maxlength="24" autocomplete="tel"></label><div class="form-error" role="alert"></div><div class="actions"><button type="button" class="secondary" id="manual-back-clients">Назад</button><button class="primary">Выбрать услугу</button></div></form>\`)}
function manualServices(){openSheet('Выберите услугу',\`<p class="note">Клиент: \${esc(manualClient.name)}</p><div class="manual-services">\${S.own.services.filter(s=>s.active).map(s=>\`<button class="more-card" data-manual-service="\${s.id}"><div><h3>\${esc(s.name)}</h3><p>\${s.duration} мин · \${money(s.price)}</p></div>\${icon('arrow')}</button>\`).join('')}</div><div class="actions"><button class="secondary" id="manual-back-clients">Назад</button></div>\`)}
`,
  'manual service picker navigation'
);

replaceBlock(
  'async function startBooking(id,manual=false,move=null){',
  'function bookingCalendar',
  `async function startBooking(id,manual=false,move=null){if(!S.me){openSheet('Вход через Telegram',login());return}const tenant=manual?S.own:S.tenant,s=tenant?.services.find(x=>x.id===id)||move&&{id:move.service_id,name:move.service_name,duration:(move.ends_at-move.starts_at)/60,price:move.price};if(!tenant||!s)return;const previous=manual&&booking?.manual&&!booking.move?booking:null,sameClient=previous&&((previous.client_id&&previous.client_id===manualClient?.id)||(!previous.client_id&&previous.phone===manualClient?.phone));booking={tenant,s,manual,move,key:crypto.randomUUID(),step:0,date:manual?(previous?.date||manualDate):day(),at:manual?(previous?.at||null):null,name:manual?manualClient?.name||previous?.name||'':S.me.name,phone:manual?manualClient?.phone||previous?.phone||'':'',details:manual&&sameClient?previous.details||'':'',client_id:manual?manualClient?.id:undefined,known:manual&&!!manualClient,month:manual?(previous?.month||(previous?.date||manualDate).slice(0,7)):day().slice(0,7),availability:{}};if(!manual&&!move){try{const contact=await api('/v4/contact?company='+tenant.id);if(contact.phone){booking.name=contact.name;booking.phone=contact.phone;booking.known=true}}catch{}}await bookingSheet()}
`,
  'manual booking state preservation'
);

replaceOnce(
  '<div class="sticky-actions"><button class="primary wide" id="booking-next" disabled>',
  '<div class="sticky-actions">${b.manual&&!b.move?\'<button class="secondary" id="manual-back-services">Назад</button>\':\'\'}<button class="primary wide" id="booking-next" disabled>',
  'manual booking date step back button'
);

replaceBlock(
  'async function loadSlots(){',
  'async function submitBooking',
  `async function loadSlots(){const n=++slotRequest,b=booking,selectedAt=b.at;try{const slots=await api('/slots?company='+b.tenant.id+'&service='+b.s.id+'&date='+b.date+(b.move?'&booking='+b.move.id:''));if(n!==slotRequest||booking!==b||!sheet.open)return;const selectedValid=selectedAt&&slots.includes(selectedAt);b.at=selectedValid?selectedAt:null;sheet.querySelector('#available-slots').innerHTML=slots.length?slots.map(t=>\`<button class="slot \${selectedValid&&t===selectedAt?'active':''}" data-slot="\${t}">\${time(t)}</button>\`).join(''):'<div class="no-slots"><h3>На этот день свободного времени нет</h3><p>Ищем ближайший доступный день…</p></div>';const nextButton=sheet.querySelector('#booking-next');if(nextButton)nextButton.disabled=!selectedValid;if(!slots.length){const next=await api('/next-slot?company='+b.tenant.id+'&service='+b.s.id+'&date='+b.date+(b.move?'&booking='+b.move.id:''));if(n!==slotRequest||booking!==b||!sheet.open)return;sheet.querySelector('#available-slots').innerHTML=next.date?\`<div class="no-slots"><h3>На этот день свободного времени нет</h3><p>Ближайшее время: \${dateLabel(next.date)} · \${time(next.starts_at)}</p><button class="secondary" data-book-date="\${next.date}">Показать</button></div>\`:'<div class="no-slots"><h3>Все доступные даты заняты</h3><p>Свяжитесь со специалистом, чтобы подобрать время.</p></div>'}}catch(e){if(n===slotRequest&&sheet.open)sheet.querySelector('#available-slots').textContent=e.message}}
`,
  'preserve selected slot when going back'
);

replaceOnce(
  "if(el.dataset.manualClient){manualClient=S.clients.find(c=>c.id===el.dataset.manualClient);manualServices();return}\nif(el.id==='manual-new'){openSheet('Новый клиент',`<form id=\"manual-client-form\"><label>Имя<input name=\"name\" required minlength=\"2\" maxlength=\"80\" autocomplete=\"name\"></label><label>Телефон<input name=\"phone\" type=\"tel\" required minlength=\"10\" maxlength=\"24\" autocomplete=\"tel\"></label><div class=\"form-error\" role=\"alert\"></div><button class=\"primary wide\">Выбрать услугу</button></form>`);return}",
  "if(el.dataset.manualClient){manualClient=S.clients.find(c=>c.id===el.dataset.manualClient);manualServices();return}\nif(el.id==='manual-back-clients'){const form=sheet.querySelector('#manual-client-form');if(form){const fd=new FormData(form);manualNewClient={name:String(fd.get('name')||''),phone:String(fd.get('phone')||'')}}await manualEditor(false);return}\nif(el.id==='manual-back-services'){manualServices();return}\nif(el.id==='manual-new'){manualNewClientEditor();return}",
  'manual step back handlers'
);

replaceOnce(
  "if(el.hasAttribute('data-manual')){manualDate=el.dataset.start?date(Number(el.dataset.start)):S.page==='calendar'?S.date:day();manualAt=el.dataset.start?Number(el.dataset.start):null;manualEditor();return}",
  "if(el.hasAttribute('data-manual')){manualDate=el.dataset.start?date(Number(el.dataset.start)):S.page==='calendar'?S.date:day();manualAt=el.dataset.start?Number(el.dataset.start):null;booking=null;manualEditor(true);return}",
  'fresh manual booking reset'
);

replaceOnce(
  "if(form.id==='manual-client-form'){manualClient={name:b.name,phone:b.phone};manualServices();return}",
  "if(form.id==='manual-client-form'){manualNewClient={name:b.name,phone:b.phone};manualClient={name:b.name,phone:b.phone};manualServices();return}",
  'preserve new client fields'
);

replaceOnce(
  "async function goBack(){if(sheet.open){if(booking&&sheet.querySelector('#booking-back')){sheet.querySelector('#booking-back').click();return}sheet.close();return}",
  "async function goBack(){if(sheet.open){const back=sheet.querySelector('#booking-back,#manual-back-services,#manual-back-clients');if(back){back.click();return}sheet.close();return}",
  'system and Telegram BackButton flow'
);

fs.writeFileSync(path, source);
console.log('Takt 6 booking Back navigation patch applied.');
