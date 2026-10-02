import {identify} from './auth.js';
const now=()=>Math.floor(Date.now()/1000);
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(s,m)=>{throw new HttpError(s,m)};
const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const owners=env=>(env.SUPERADMIN_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
async function body(req){if(Number(req.headers.get('content-length'))>20000)fail(413,'Слишком большой запрос');const raw=await req.text();if(raw.length>20000)fail(413,'Слишком большой запрос');try{return JSON.parse(raw)}catch{fail(400,'Некорректные данные')}}
async function access(db,env,user,company){return owners(env).includes(user.id)||!!await db.prepare('SELECT 1 FROM memberships WHERE company_id=? AND user_id=?').bind(company,user.id).first()}
async function company(db,id){const c=await db.prepare('SELECT * FROM companies WHERE id=? AND active=1').bind(id).first();if(!c)fail(404,'Компания не найдена');return c}
export function dayBounds(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))fail(400,'Выберите дату');
 const start=Date.parse(`${date}T00:00:00+03:00`)/1000;
 if(!Number.isFinite(start)||new Date((start+10800)*1000).toISOString().slice(0,10)!==date)fail(400,'Некорректная дата');
 return [start,start+86400];
}
export function possibleSlots(c,s,date,busy,time=now()){
 const [day]=dayBounds(date);if(day>time+31*86400)return [];
 const result=[];for(let t=day+c.open_hour*3600;t+s.duration*60<=day+c.close_hour*3600;t+=1800){
  if(t>time+1800&&!busy.some(b=>b.starts_at<t+s.duration*60&&b.ends_at>t))result.push(t);
 }return result;
}
const queue=(db,id,chat,message,guard=null)=>guard ? db.prepare('INSERT OR IGNORE INTO outbox(id,chat_id,text,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status_event=?)').bind(id,chat,message,now(),...guard) : db.prepare('INSERT OR IGNORE INTO outbox(id,chat_id,text,created_at) VALUES(?,?,?,?)').bind(id,chat,message,now());
function stamp(t){return new Date(t*1000).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}
async function notices(db,b,event,guard=null){
 const c=await db.prepare('SELECT name FROM companies WHERE id=?').bind(b.company_id).first();
 const labels={created:'Заявка получена',confirmed:'Запись подтверждена',cancelled:'Запись отменена',done:'Услуга завершена'};
 const msg=`Такт · ${labels[event]}\n${c.name}\n${b.service_name}\n${stamp(b.starts_at)} (МСК)\n№ ${b.id.slice(0,8)}`;
 const members=await db.prepare('SELECT user_id FROM memberships WHERE company_id=?').bind(b.company_id).all();
 return [queue(db,`${b.id}:${event}:client`,b.user_id,msg,guard),...members.results.filter(m=>m.user_id!==b.user_id).map(m=>queue(db,`${b.id}:${event}:${m.user_id}`,m.user_id,`${msg}\nКлиент: ${b.name}\nТелефон: ${b.phone}`,guard))];
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
 const update=await body(req),m=update.message;
 if(m?.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id<=0)return json({ok:true});
 const command=typeof m.text==='string'?m.text.trim().split(/\s+/)[0].split('@')[0]:'';
 if(!['/start','/help','/id'].includes(command))return json({ok:true});
 const appUrl=new URL(env.APP_URL||new URL(req.url).origin);
 if(appUrl.protocol!=='https:')fail(503,'Укажите HTTPS адрес приложения');
 const message=command==='/id'?`Ваш Telegram ID: ${m.chat.id}`:'Такт — запись в вашем ритме.\n\nМастерам: создайте свой кабинет, добавьте услуги и отправьте клиентам личную ссылку.\n\nКлиентам: записывайтесь по ссылке мастера, следите за визитами и получайте напоминания.\n\nВсё начинается в приложении ↓';
 return json({method:'sendMessage',chat_id:m.chat.id,text:message,reply_markup:{inline_keyboard:[[{text:'Открыть Такт',web_app:{url:appUrl.href}}]]}});
}

export async function api(req,env){
 const url=new URL(req.url),path=url.pathname,db=env.DB;
 if(path==='/api/telegram/webhook')return webhook(req,env);
 if(path==='/api/health')return json({ok:true,version:'0.2.0'});
 if(!db)fail(503,'База ещё не подключена');
 const publicCompany=path.match(/^\/api\/companies\/([a-z0-9-]+)$/);
 if(publicCompany&&req.method==='GET'){
  const c=await company(db,publicCompany[1]);
  const services=(await db.prepare('SELECT * FROM services WHERE company_id=? AND active=1 ORDER BY rowid').bind(c.id).all()).results;
  return json({...c,services});
 }
 let user;try{user=await identify(req,env)}catch{fail(401,'Откройте приложение через Telegram. Если оно уже открыто — закройте и откройте снова.')}
 if(path==='/api/companies'&&req.method==='GET'){
  const cs=owners(env).includes(user.id)?await db.prepare('SELECT * FROM companies WHERE active=1 ORDER BY rowid').all():await db.prepare('SELECT c.* FROM companies c JOIN memberships m ON m.company_id=c.id WHERE m.user_id=? AND c.active=1 ORDER BY c.rowid').bind(user.id).all();
  const result=[];for(const c of cs.results){const services=(await db.prepare('SELECT * FROM services WHERE company_id=? AND active=1 ORDER BY rowid').bind(c.id).all()).results;result.push({...c,services})}
  return json(result);
 }
 if(path==='/api/register'&&req.method==='POST'){
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
  if(!owners(env).includes(user.id))fail(403,'Только владелец сервиса может подключить бота');
  const appUrl=new URL(env.APP_URL||url.origin);
  if(appUrl.protocol!=='https:')fail(400,'Подключение доступно на опубликованном HTTPS сайте');
  const secret=await webhookSecret(env);
  await telegram(env,'setWebhook',{url:new URL('/api/telegram/webhook',appUrl).href,secret_token:secret,allowed_updates:['message']});
  await telegram(env,'setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть Такт',web_app:{url:appUrl.href}}});
  await telegram(env,'setMyCommands',{commands:[{command:'start',description:'Открыть Такт'},{command:'help',description:'Как пользоваться'},{command:'id',description:'Мой Telegram ID'}]});
  await telegram(env,'setMyDescription',{description:"Такт — ваше дело в вашем ритме.\n\nДля мастеров и компаний\nСоздайте кабинет, добавьте услуги и часы работы. Отправьте клиентам свою ссылку на запись. Управляйте заявками в журнале.\n\nДля клиентов\nОткройте ссылку мастера, выберите услугу и время. Ваши записи и история — в приложении, подтверждения и напоминания — в Telegram.\n\nНажмите «Открыть приложение», чтобы начать."});
  await telegram(env,'setMyShortDescription',{short_description:'Такт — запись на услуги в Telegram. Клиентам — удобное время и напоминания, компаниям — управление заявками.'});
  const info=await telegram(env,'getWebhookInfo',{});
  if(info.url!==new URL('/api/telegram/webhook',appUrl).href)fail(502,'Не удалось проверить подключение. Повторите попытку.');
  return json({ok:true});
 }
 if(path==='/api/me'){
  const memberships=await db.prepare('SELECT company_id FROM memberships WHERE user_id=?').bind(user.id).all();
  return json({...user,owner:owners(env).includes(user.id),companies:memberships.results.map(m=>m.company_id)});
 }
 if(path==='/api/slots'&&req.method==='GET'){
  const c=await company(db,url.searchParams.get('company'));
  const s=await db.prepare('SELECT * FROM services WHERE id=? AND company_id=? AND active=1').bind(url.searchParams.get('service'),c.id).first();if(!s)fail(404,'Услуга не найдена');
  const date=url.searchParams.get('date'),[start,end]=dayBounds(date);
  const busy=await db.prepare("SELECT starts_at,ends_at FROM bookings WHERE company_id=? AND status IN ('pending','confirmed') AND starts_at<? AND ends_at>?").bind(c.id,end,start).all();
  return json(possibleSlots(c,s,date,busy.results));
 }
 if(path==='/api/bookings'&&req.method==='GET'){
  const scope=url.searchParams.get('scope'),c=url.searchParams.get('company');
  let where='b.user_id=?',value=user.id;
  if(scope==='company'){if(!await access(db,env,user,c))fail(403,'Нет доступа');where='b.company_id=?';value=c}
  if(scope==='owner'){if(!owners(env).includes(user.id))fail(403,'Нет доступа');where='1=?';value=1}
  return json((await db.prepare(`SELECT b.*,c.name AS company_name FROM bookings b JOIN companies c ON c.id=b.company_id WHERE ${where} ORDER BY b.starts_at DESC LIMIT 500`).bind(value).all()).results);
 }
 if(path==='/api/bookings'&&req.method==='POST'){
  const b=await body(req),c=await company(db,b.company_id);
  if(!/^[a-zA-Z0-9-]{8,80}$/.test(b.request_key||''))fail(400,'Повторите оформление');
  const old=await db.prepare('SELECT * FROM bookings WHERE user_id=? AND request_key=?').bind(user.id,b.request_key).first();if(old)return json(old);
  const s=await db.prepare('SELECT * FROM services WHERE id=? AND company_id=? AND active=1').bind(b.service_id,c.id).first();if(!s)fail(400,'Услуга недоступна');
  const name=text(b.name,80),phone=text(b.phone,24),details=text(b.details,1200),start=Number(b.starts_at);
  if(name.length<2||!/^[+\d\s()-]{10,24}$/.test(phone)||phone.replace(/\D/g,'').length<10)fail(400,'Проверьте имя и телефон');
  if(!Number.isInteger(start)||start<=now()+1800||start>now()+31*86400)fail(400,'Выберите время в ближайшие 30 дней');
  const date=new Date((start+10800)*1000).toISOString().slice(0,10);
  if(!possibleSlots(c,s,date,[]).includes(start))fail(400,'Время вне расписания');
  if(c.category!=='beauty'&&details.length<5)fail(400,c.category==='cleaning'?'Укажите адрес и площадь':'Укажите автомобиль и задачу');
  const count=await db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE user_id=? AND starts_at>? AND status IN ('pending','confirmed')").bind(user.id,now()).first();if(count.n>=10)fail(429,'У вас уже 10 активных записей');
  const booking={id:crypto.randomUUID(),company_id:c.id,service_id:s.id,user_id:user.id,name,phone,details,starts_at:start,ends_at:start+s.duration*60,price:s.price,service_name:s.name,status:'pending',created_at:now(),request_key:b.request_key};
  try{await db.batch([db.prepare('INSERT INTO bookings(id,company_id,service_id,user_id,name,phone,details,starts_at,ends_at,price,service_name,status,created_at,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...Object.values(booking)),...await notices(db,booking,'created')]);}
  catch(e){if(String(e).includes('SLOT_TAKEN'))fail(409,'Это время уже заняли. Выберите другое.');if(String(e).includes('UNIQUE')){const retry=await db.prepare('SELECT * FROM bookings WHERE user_id=? AND request_key=?').bind(user.id,b.request_key).first();if(retry)return json(retry)}throw e}
  return json(booking,201);
 }
 const bookingMatch=path.match(/^\/api\/bookings\/([a-z0-9-]+)$/);
 if(bookingMatch&&req.method==='PATCH'){
  const b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingMatch[1]).first();if(!b)fail(404,'Запись не найдена');
  const admin=await access(db,env,user,b.company_id),data=await body(req),status=data.status;
  if(!admin&&(b.user_id!==user.id||status!=='cancelled'||b.starts_at<=now()))fail(403,'Нет доступа');
  if(!({pending:['confirmed','cancelled'],confirmed:['done','cancelled']}[b.status]||[]).includes(status))fail(409,'Статус уже изменился. Обновите список.');
  if(status==='done'&&b.starts_at>now())fail(400,'Завершить можно после начала записи');
  // Atomic compare-and-set: only one operator can transition the same status.
  const eventId=crypto.randomUUID();
  const results=await db.batch([db.prepare('UPDATE bookings SET status=?,status_event=? WHERE id=? AND status=?').bind(status,eventId,b.id,b.status),...await notices(db,b,status,[b.id,eventId])]);
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
  if(!owners(env).includes(user.id))fail(403,'Нет доступа');const b=await body(req);await company(db,b.company_id);
  if(!/^[1-9]\d{3,15}$/.test(b.user_id||''))fail(400,'Введите числовой Telegram ID');
  await db.prepare('INSERT OR IGNORE INTO memberships(company_id,user_id) VALUES(?,?)').bind(b.company_id,b.user_id).run();return json({ok:true});
 }
 fail(404,'Не найдено');
}
export async function deliver(env){
 if(!env.BOT_TOKEN)return;
 const reminders=await env.DB.prepare("SELECT b.*,c.name AS company_name FROM bookings b JOIN companies c ON c.id=b.company_id WHERE status='confirmed' AND starts_at>? AND starts_at<=?").bind(now(),now()+86400).all();
 if(reminders.results.length)await env.DB.batch(reminders.results.map(b=>queue(env.DB,`${b.id}:reminder`,b.user_id,`Такт · Напоминание\n${b.company_name}\n${b.service_name}\n${stamp(b.starts_at)} (МСК)`)));
 const rows=await env.DB.prepare('SELECT * FROM outbox WHERE sent_at IS NULL AND attempts<5 AND lease_until<? ORDER BY created_at LIMIT 30').bind(now()).all();
 for(const row of rows.results){
  const claimed=await env.DB.prepare('UPDATE outbox SET lease_until=?,attempts=attempts+1 WHERE id=? AND sent_at IS NULL AND lease_until<? RETURNING id').bind(now()+300,row.id,now()).first();if(!claimed)continue;
  try{const res=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:row.chat_id,text:row.text}),signal:AbortSignal.timeout(10000)});const data=await res.json();if(data.ok)await env.DB.prepare('UPDATE outbox SET sent_at=? WHERE id=?').bind(now(),row.id).run();}catch{/* retry on the next cron; never log tokens or personal data */}
 }
}
export default {
 async fetch(req,env){try{if(new URL(req.url).pathname.startsWith('/api/'))return await api(req,env);return env.ASSETS.fetch(req)}catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);console.error('Request failed',e.name);return json({error:'Не удалось выполнить запрос. Попробуйте ещё раз.'},500)}},
 async scheduled(_event,env,ctx){ctx.waitUntil(deliver(env))}
};
