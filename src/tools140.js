import {requireAdmin} from './control-auth.js';
import {ensure143} from './bot140.js';
// 14.0 — инструменты: лист ожидания, «пора записаться снова», неявки и чёрный список, ответы на отзывы,
// шаблоны, экспорт, онбординг-чеклист, портфолио. Только добавляющая схема; права проверяются на сервере.
export const PORTFOLIO_DEFAULT=20,PORTFOLIO_MAX=30,PHOTO_MAX_CHARS=150000,WAITLIST_PER_USER=5,TEMPLATES_MAX=20,WINBACK_PER_DAY=20;
export const schema142=[
`CREATE TABLE IF NOT EXISTS waitlist(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),service_id TEXT NOT NULL,user_id TEXT NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','notified','booked','cancelled')),created_at INTEGER NOT NULL,notified_at INTEGER,UNIQUE(company_id,service_id,user_id,date))`,
`CREATE INDEX IF NOT EXISTS waitlist_open ON waitlist(status,date)`,
`CREATE TABLE IF NOT EXISTS client_flags(company_id TEXT NOT NULL REFERENCES companies(id),client_id TEXT NOT NULL,blocked INTEGER NOT NULL DEFAULT 0,tag TEXT NOT NULL DEFAULT '',birthday TEXT NOT NULL DEFAULT '',PRIMARY KEY(company_id,client_id))`,
`CREATE TABLE IF NOT EXISTS review_replies(booking_id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),text TEXT NOT NULL,created_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS message_templates(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),title TEXT NOT NULL,text TEXT NOT NULL,created_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS portfolio_photos(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),position INTEGER NOT NULL DEFAULT 0,data TEXT NOT NULL,created_at INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS portfolio_company ON portfolio_photos(company_id,position)`,
`CREATE TABLE IF NOT EXISTS rebook_notices(company_id TEXT NOT NULL,user_id TEXT NOT NULL,last_visit INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(company_id,user_id,last_visit))`
];
export async function ensure142(db){if(!await db.prepare('SELECT 1 FROM schema_versions WHERE version=142').first())await db.batch([...schema142.map(s=>db.prepare(s)),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(142)')]);await ensure143(db)}
const now=()=>Math.floor(Date.now()/1000),D=86400,DATE=/^\d{4}-\d{2}-\d{2}$/,isTg=id=>/^\d{3,15}$/.test(String(id));
const clean=(v,n)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const cleanMulti=(v,n)=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,n);
const COPY={
 ru:{wl:(s,d)=>`🔔 Освободилось время: ${s}, ${d}. Откройте запись, пока окно свободно.`,rebook:n=>`👋 Пора записаться снова к «${n}». Выберите удобное время.`,win:n=>`💬 Сообщение от «${n}»:`,open:'Открыть'},
 kk:{wl:(s,d)=>`🔔 Уақыт босады: ${s}, ${d}. Терезе бос кезде жазылыңыз.`,rebook:n=>`👋 «${n}» мамандына қайта жазылатын уақыт болды. Ыңғайлы уақытты таңдаңыз.`,win:n=>`💬 «${n}» хабарламасы:`,open:'Ашу'},
 az:{wl:(s,d)=>`🔔 Vaxt boşaldı: ${s}, ${d}. Pəncərə boş ikən qeyd olun.`,rebook:n=>`👋 «${n}» ilə yenidən qeyd olunmağın vaxtıdır. Uyğun vaxtı seçin.`,win:n=>`💬 «${n}» mesajı:`,open:'Aç'},
 uz:{wl:(s,d)=>`🔔 Vaqt bo‘shadi: ${s}, ${d}. Oyna bo‘sh paytda yoziling.`,rebook:n=>`👋 «${n}» ga qayta yozilish vaqti keldi. Qulay vaqtni tanlang.`,win:n=>`💬 «${n}» xabari:`,open:'Ochish'}
};
const langOf=async(db,id)=>(await db.prepare('SELECT language FROM user_app_settings WHERE user_id=?').bind(String(id)).first())?.language||'ru';
async function queueMsg(db,id,chat,text,base,when=0){const L=COPY.ru;await db.prepare('INSERT OR IGNORE INTO outbox(id,chat_id,text,created_at,lease_until) VALUES(?,?,?,?,?)').bind(id,String(chat),JSON.stringify({text,reply_markup:{inline_keyboard:[[{text:L.open,web_app:{url:base}}]]}}),now(),when>now()?when:0).run()}
// ---------- клиенты: неявки, интервалы, флаги ----------
export const isBlockedClient=async(db,company,client)=>!!(await db.prepare('SELECT 1 FROM client_flags WHERE company_id=? AND client_id=? AND blocked=1').bind(company,String(client)).first());
export async function clientInsights(db,company,t=now()){
 const rows=(await db.prepare(`SELECT b.user_id,MAX(b.name) name,MAX(b.phone) phone,
 SUM(CASE WHEN b.starts_at<=? AND b.status IN ('done','confirmed') AND COALESCE(o.outcome,'done')='done' THEN 1 ELSE 0 END) visits,
 SUM(CASE WHEN o.outcome='no_show' THEN 1 ELSE 0 END) no_shows,
 MIN(CASE WHEN b.starts_at<=? AND b.status IN ('done','confirmed') AND COALESCE(o.outcome,'done')='done' THEN b.starts_at END) first_visit,
 MAX(CASE WHEN b.starts_at<=? AND b.status IN ('done','confirmed') AND COALESCE(o.outcome,'done')='done' THEN b.starts_at END) last_visit,
 SUM(CASE WHEN b.starts_at>? AND b.status IN ('pending','confirmed') THEN 1 ELSE 0 END) upcoming
 FROM bookings b LEFT JOIN booking_outcomes o ON o.booking_id=b.id WHERE b.company_id=? GROUP BY b.user_id`).bind(t,t,t,t,company).all()).results;
 const flags=new Map((await db.prepare('SELECT * FROM client_flags WHERE company_id=?').bind(company).all()).results.map(f=>[f.client_id,f]));
 return rows.map(r=>{const f=flags.get(r.user_id)||{},visits=Number(r.visits||0),avg=visits>=2?Math.max(1,Math.round((r.last_visit-r.first_visit)/(visits-1)/D)):null,since=r.last_visit?Math.floor((t-r.last_visit)/D):null;
  const overdue=!r.upcoming&&r.last_visit&&(avg?since>avg*1.5:since>60);
  return {client_id:r.user_id,name:r.name,phone:r.phone,visits,no_shows:Number(r.no_shows||0),last_visit:r.last_visit||null,avg_interval_days:avg,days_since:since,upcoming:Number(r.upcoming||0),overdue:!!overdue,reachable:isTg(r.user_id),blocked:!!f.blocked,tag:f.tag||'',birthday:f.birthday||''}});
}
export async function setClientFlag(db,company,client,{blocked,tag,birthday}){
 const known=await db.prepare('SELECT 1 FROM bookings WHERE company_id=? AND user_id=? UNION SELECT 1 FROM client_links WHERE company_id=? AND user_id=? LIMIT 1').bind(company,client,company,client).first();if(!known)return {ok:false,reason:'unknown'};
 const cur=await db.prepare('SELECT * FROM client_flags WHERE company_id=? AND client_id=?').bind(company,client).first()||{blocked:0,tag:'',birthday:''};
 const b=blocked===undefined?cur.blocked:(blocked?1:0),tg=tag===undefined?cur.tag:clean(tag,30),bd=birthday===undefined?cur.birthday:(birthday===''||/^\d{2}-\d{2}$/.test(birthday)?birthday:null);if(bd===null)return {ok:false,reason:'birthday'};
 await db.prepare('INSERT INTO client_flags(company_id,client_id,blocked,tag,birthday) VALUES(?,?,?,?,?) ON CONFLICT(company_id,client_id) DO UPDATE SET blocked=excluded.blocked,tag=excluded.tag,birthday=excluded.birthday').bind(company,client,b,tg,bd).run();return {ok:true}}
// ---------- онбординг ----------
export async function checklist(db,company){
 const q=async(sql,...a)=>Number((await db.prepare(sql).bind(...a).first())?.n||0),c=await db.prepare('SELECT address,phone FROM companies WHERE id=?').bind(company).first()||{};
 const items=[{key:'service',done:await q('SELECT COUNT(*) n FROM services WHERE company_id=? AND active=1',company)>0},{key:'profile',done:!!(c.address||c.phone)},{key:'client',done:await q('SELECT COUNT(*) n FROM client_links WHERE company_id=?',company)>0},{key:'booking',done:await q("SELECT COUNT(*) n FROM bookings WHERE company_id=? AND user_id NOT LIKE 'manual-%'",company)>0}];
 return {items,done:items.filter(i=>i.done).length,total:items.length};
}
// ---------- портфолио ----------
export async function portfolioLimit(db){const v=Number((await db.prepare("SELECT value FROM service_config WHERE key='portfolio_limit'").first())?.value);return Number.isFinite(v)?Math.min(PORTFOLIO_MAX,Math.max(PORTFOLIO_DEFAULT,Math.trunc(v))):PORTFOLIO_DEFAULT}
export async function addPhoto(db,company,data){
 if(typeof data!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data)||data.length>PHOTO_MAX_CHARS)return {ok:false,reason:'format'};
 const limit=await portfolioLimit(db),n=Number((await db.prepare('SELECT COUNT(*) n FROM portfolio_photos WHERE company_id=?').bind(company).first()).n);if(n>=limit)return {ok:false,reason:'limit',limit};
 const id=crypto.randomUUID();await db.prepare('INSERT INTO portfolio_photos(id,company_id,position,data,created_at) VALUES(?,?,?,?,?)').bind(id,company,n,data,now()).run();return {ok:true,id,count:n+1,limit}}
// ---------- шаблоны ----------
export async function saveTemplate(db,company,{id,title,text}){
 const ti=clean(title,40),tx=cleanMulti(text,500);if(!ti||!tx)return {ok:false,reason:'empty'};
 if(id){const r=await db.prepare('UPDATE message_templates SET title=?,text=? WHERE id=? AND company_id=?').bind(ti,tx,String(id),company).run();return r.meta.changes?{ok:true,id}:{ok:false,reason:'missing'}}
 if(Number((await db.prepare('SELECT COUNT(*) n FROM message_templates WHERE company_id=?').bind(company).first()).n)>=TEMPLATES_MAX)return {ok:false,reason:'limit'};
 const nid=crypto.randomUUID();await db.prepare('INSERT INTO message_templates(id,company_id,title,text,created_at) VALUES(?,?,?,?,?)').bind(nid,company,ti,tx,now()).run();return {ok:true,id:nid}}
// ---------- ответ на отзыв ----------
export async function replyReview(db,company,bookingId,text){
 const tx=cleanMulti(text,600);if(!tx)return {ok:false,reason:'empty'};
 if(!await db.prepare('SELECT 1 FROM reviews WHERE booking_id=? AND company_id=?').bind(String(bookingId),company).first())return {ok:false,reason:'missing'};
 await db.prepare('INSERT INTO review_replies(booking_id,company_id,text,created_at) VALUES(?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET text=excluded.text,created_at=excluded.created_at').bind(String(bookingId),company,tx,now()).run();return {ok:true}}
// ---------- вернуть клиента ----------
export async function winBack(env,db,company,client,text,{quietUntil=x=>x}={}){
 if(!isTg(client))return {ok:false,reason:'unreachable'};const tx=cleanMulti(text,500);if(!tx)return {ok:false,reason:'empty'};
 if(!await db.prepare('SELECT 1 FROM bookings WHERE company_id=? AND user_id=? UNION SELECT 1 FROM client_links WHERE company_id=? AND user_id=? LIMIT 1').bind(company,client,company,client).first())return {ok:false,reason:'unknown'};
 if(await isBlockedClient(db,company,client))return {ok:false,reason:'blocked'};
 const today=Number((await db.prepare("SELECT COUNT(*) n FROM outbox WHERE id LIKE ? AND created_at>?").bind(`winback:${company}:%`,now()-D).first()).n);if(today>=WINBACK_PER_DAY)return {ok:false,reason:'limit'};
 const week=Math.floor(now()/(7*D)),name=(await db.prepare('SELECT name FROM companies WHERE id=?').bind(company).first())?.name||'Takt',L=COPY[await langOf(db,client)]||COPY.ru;
 const id=`winback:${company}:${client}:${week}`;if(await db.prepare('SELECT 1 FROM outbox WHERE id=?').bind(id).first())return {ok:false,reason:'recent'};
 await db.prepare('INSERT OR IGNORE INTO outbox(id,chat_id,text,created_at,lease_until) VALUES(?,?,?,?,?)').bind(id,String(client),JSON.stringify({text:`${L.win(name)}\n\n${tx}`,reply_markup:{inline_keyboard:[[{text:L.open,web_app:{url:env.APP_URL||'https://takt.taktapp.workers.dev'}}]]}}),now(),quietUntil(now(),'Asia/Almaty')>now()?quietUntil(now(),'Asia/Almaty'):0).run();return {ok:true}}
// ---------- экспорт CSV ----------
const cell=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n\r;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
export async function exportCsv(db,company,kind){
 const iso=t=>t?new Date(t*1000).toISOString().slice(0,16).replace('T',' '):'';
 if(kind==='clients'){const rows=await clientInsights(db,company);return {filename:'takt-clients.csv',rows:rows.length,csv:'\ufeff'+[['Имя','Телефон','Визитов','Неявок','Последний визит','Тег','День рождения'],...rows.map(r=>[r.name,r.phone,r.visits,r.no_shows,iso(r.last_visit),r.tag,r.birthday])].map(r=>r.map(cell).join(',')).join('\n')}}
 const rows=(await db.prepare("SELECT b.starts_at,b.name,b.phone,b.service_name,b.price,b.status,o.outcome FROM bookings b LEFT JOIN booking_outcomes o ON o.booking_id=b.id WHERE b.company_id=? ORDER BY b.starts_at DESC LIMIT 5000").bind(company).all()).results;
 return {filename:'takt-bookings.csv',rows:rows.length,csv:'\ufeff'+[['Дата (UTC)','Клиент','Телефон','Услуга','Цена','Статус','Итог'],...rows.map(r=>[iso(r.starts_at),r.name,r.phone,r.service_name,r.price,r.status,r.outcome||''])].map(r=>r.map(cell).join(',')).join('\n')}}
// ---------- лист ожидания ----------
export async function joinWaitlist(db,user,{company_id,service_id,date}){
 if(!DATE.test(String(date||'')))return {ok:false,reason:'date'};const t=now(),day=new Date(t*1000).toISOString().slice(0,10),max=new Date((t+60*D)*1000).toISOString().slice(0,10);if(date<day||date>max)return {ok:false,reason:'date'};
 if(!await db.prepare('SELECT 1 FROM client_links WHERE user_id=? AND company_id=? UNION SELECT 1 FROM bookings WHERE user_id=? AND company_id=? LIMIT 1').bind(String(user),company_id,String(user),company_id).first())return {ok:false,reason:'forbidden'};
 if(!await db.prepare('SELECT 1 FROM services WHERE id=? AND company_id=? AND active=1').bind(service_id,company_id).first())return {ok:false,reason:'service'};
 if(await isBlockedClient(db,company_id,user))return {ok:false,reason:'forbidden'};
 if(Number((await db.prepare("SELECT COUNT(*) n FROM waitlist WHERE user_id=? AND status='waiting'").bind(String(user)).first()).n)>=WAITLIST_PER_USER)return {ok:false,reason:'limit'};
 const id=crypto.randomUUID(),r=await db.prepare("INSERT INTO waitlist(id,company_id,service_id,user_id,date,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(company_id,service_id,user_id,date) DO UPDATE SET status='waiting',notified_at=NULL WHERE status IN ('cancelled','notified','booked')").bind(id,company_id,service_id,String(user),date,t).run();
 return {ok:true,id:(await db.prepare('SELECT id FROM waitlist WHERE company_id=? AND service_id=? AND user_id=? AND date=?').bind(company_id,service_id,String(user),date).first()).id,changed:!!r.meta.changes}}
export async function waitlistTick(env,db,{company,enrichService,availableSlots,quietUntil=x=>x},{budget=30}={}){
 const t=now(),today=new Date((t-D)*1000).toISOString().slice(0,10);
 await db.prepare("UPDATE waitlist SET status='cancelled' WHERE status='waiting' AND date<?").bind(today).run();
 const rows=(await db.prepare("SELECT * FROM waitlist WHERE status='waiting' ORDER BY created_at LIMIT ?").bind(budget).all()).results,seen=new Map();let sent=0;
 for(const w of rows){try{const key=w.company_id+w.service_id+w.date;let free=seen.get(key);
  if(free===undefined){const c=await company(db,w.company_id),sv=await enrichService(db,await db.prepare('SELECT * FROM services WHERE id=? AND company_id=? AND active=1').bind(w.service_id,w.company_id).first());free=c&&sv?((await availableSlots(db,c,sv,w.date)).length>0):false;seen.set(key,free)}
  if(!free)continue;
  const upd=await db.prepare("UPDATE waitlist SET status='notified',notified_at=? WHERE id=? AND status='waiting'").bind(t,w.id).run();if(!upd.meta.changes)continue;
  const sv=await db.prepare('SELECT name FROM services WHERE id=?').bind(w.service_id).first(),L=COPY[await langOf(db,w.user_id)]||COPY.ru;
  await queueMsg(db,`waitlist:${w.id}`,w.user_id,L.wl(sv?.name||'',w.date),env.APP_URL||'https://takt.taktapp.workers.dev',quietUntil(t,(await company(db,w.company_id))?.timezone||'Asia/Almaty'));sent++}catch{}}
 return {sent}}
// ---------- «пора записаться снова» ----------
export async function rebookTick(env,db,{quietUntil=x=>x}={},{budget=30}={}){
 const t=now(),base=env.APP_URL||'https://takt.taktapp.workers.dev';
 const rows=(await db.prepare(`SELECT b.company_id,b.user_id,
 SUM(CASE WHEN b.starts_at<=? AND b.status='done' AND COALESCE(o.outcome,'done')='done' THEN 1 ELSE 0 END) n,
 MIN(CASE WHEN b.starts_at<=? AND b.status='done' AND COALESCE(o.outcome,'done')='done' THEN b.starts_at END) f,
 MAX(CASE WHEN b.starts_at<=? AND b.status='done' AND COALESCE(o.outcome,'done')='done' THEN b.starts_at END) l,
 SUM(CASE WHEN b.starts_at>? AND b.status IN ('pending','confirmed') THEN 1 ELSE 0 END) fut,MAX(CASE WHEN b.starts_at<=? AND o.outcome='no_show' THEN b.starts_at END) ns,MAX(c.name) cname,MAX(json_extract(so.data,'$.timezone')) tz
 FROM bookings b JOIN companies c ON c.id=b.company_id AND c.active=1 LEFT JOIN booking_outcomes o ON o.booking_id=b.id LEFT JOIN specialist_options so ON so.company_id=b.company_id WHERE b.starts_at>? AND b.user_id GLOB '[0-9]*' AND b.user_id NOT LIKE 'manual-%' GROUP BY b.company_id,b.user_id HAVING n>=2 AND fut=0 LIMIT 500`).bind(t,t,t,t,t,t-400*D).all()).results;let sent=0;
 for(const r of rows){if(sent>=budget)break;const avg=(r.l-r.f)/(r.n-1),since=t-r.l;if(!(since>=avg*1.2&&since<=avg*3&&avg>=3*D))continue;
  if(r.ns&&r.ns>=r.l)continue; // последний визит — неявка: не зовём «записаться снова»
  if(await isBlockedClient(db,r.company_id,r.user_id))continue;
  const fresh=await db.prepare('INSERT OR IGNORE INTO rebook_notices(company_id,user_id,last_visit,created_at) VALUES(?,?,?,?)').bind(r.company_id,r.user_id,r.l,t).run();if(!fresh.meta.changes)continue;
  const L=COPY[await langOf(db,r.user_id)]||COPY.ru;await queueMsg(db,`rebook:${r.company_id}:${r.user_id}:${r.l}`,r.user_id,L.rebook(r.cname),base,quietUntil(t,r.tz||'Asia/Almaty'));sent++}
 return {sent}}
// ---------- HTTP ----------
const ERR={unknown:'Клиент не найден',birthday:'Формат дня рождения: ММ-ДД',empty:'Заполните поле',missing:'Не найдено',limit:'Достигнут лимит',format:'Фото должно быть JPEG до 150 КБ',unreachable:'Клиент не писал боту — сообщение отправить нельзя',blocked:'Клиент в чёрном списке',recent:'Этому клиенту уже писали на этой неделе',date:'Выберите дату в ближайшие 60 дней',forbidden:'Нет доступа к специалисту',service:'Услуга недоступна'};
export async function apiTools(req,env,user,h){
 const u=new URL(req.url),p=u.pathname;if(!p.startsWith('/api/v140/'))return null;const db=env.DB;
 const mine=async id=>{id=String(id||'').slice(0,80);if(!id||!await h.access(db,env,user,id))h.fail(403,'Нет доступа');return id};
 const bad=r=>{if(!r.ok)h.fail(r.reason==='forbidden'?403:400,ERR[r.reason]||'Не удалось выполнить')};
 if(p==='/api/v140/tools'&&req.method==='GET'){
  const id=await mine(u.searchParams.get('company')),clients=await clientInsights(db,id);
  const reviews=(await db.prepare('SELECT r.booking_id,r.client_name,r.service_name,r.rating,r.text,r.created_at,p.text reply FROM reviews r LEFT JOIN review_replies p ON p.booking_id=r.booking_id WHERE r.company_id=? ORDER BY r.created_at DESC LIMIT 30').bind(id).all()).results;
  const rated=await db.prepare('SELECT COUNT(*) n,AVG(rating) a FROM reviews WHERE company_id=?').bind(id).first(),pc=Number((await db.prepare('SELECT COUNT(*) n FROM portfolio_photos WHERE company_id=?').bind(id).first()).n);
  const birthdays=clients.filter(c=>c.birthday).map(c=>({client_id:c.client_id,name:c.name,birthday:c.birthday}));
  return h.json({checklist:await checklist(db,id),clients:clients.sort((a,b)=>(b.overdue-a.overdue)||(b.no_shows-a.no_shows)||(b.visits-a.visits)).slice(0,100),templates:(await db.prepare('SELECT id,title,text FROM message_templates WHERE company_id=? ORDER BY created_at').bind(id).all()).results,reviews,rating:{count:Number(rated.n),avg:rated.a?Math.round(rated.a*10)/10:null},portfolio:{count:pc,limit:await portfolioLimit(db)},birthdays,waiting:Number((await db.prepare("SELECT COUNT(*) n FROM waitlist WHERE company_id=? AND status='waiting'").bind(id).first()).n)});
 }
 if(p==='/api/v140/tools/action'&&req.method==='POST'){
  const b=await h.body(req),id=await mine(b.company);
  switch(b.action){
   case 'client_flag':bad(await setClientFlag(db,id,String(b.client_id||''),{blocked:b.blocked,tag:b.tag,birthday:b.birthday}));return h.json({ok:true});
   case 'template_save':{const r=await saveTemplate(db,id,b);bad(r);return h.json(r)}
   case 'template_delete':await db.prepare('DELETE FROM message_templates WHERE id=? AND company_id=?').bind(String(b.id||''),id).run();return h.json({ok:true});
   case 'review_reply':bad(await replyReview(db,id,b.booking_id,b.text));return h.json({ok:true});
   case 'win_back':{const r=await winBack(env,db,id,String(b.client_id||''),b.text,{quietUntil:h.quietUntil});bad(r);return h.json(r)}
   case 'portfolio_add':{const r=await addPhoto(db,id,b.data);bad(r);return h.json(r)}
   case 'portfolio_delete':await db.prepare('DELETE FROM portfolio_photos WHERE id=? AND company_id=?').bind(String(b.id||''),id).run();return h.json({ok:true});
   default:h.fail(400,'Неизвестное действие')}
 }
 if(p==='/api/v140/tools/export'&&req.method==='GET'){const id=await mine(u.searchParams.get('company'));return h.json(await exportCsv(db,id,u.searchParams.get('kind')==='bookings'?'bookings':'clients'))}
 if(p==='/api/v140/portfolio'&&req.method==='GET'){
  const id=String(u.searchParams.get('company')||'').slice(0,80),manager=await h.access(db,env,user,id);
  if(!manager&&!await db.prepare('SELECT 1 FROM client_links WHERE user_id=? AND company_id=? UNION SELECT 1 FROM bookings WHERE user_id=? AND company_id=? LIMIT 1').bind(String(user.id),id,String(user.id),id).first())h.fail(403,'Нет доступа');
  const off=Math.max(0,Math.min(100,Number(u.searchParams.get('offset'))||0));
  return h.json({items:(await db.prepare('SELECT id,data FROM portfolio_photos WHERE company_id=? ORDER BY position,created_at LIMIT 6 OFFSET ?').bind(id,off).all()).results,total:Number((await db.prepare('SELECT COUNT(*) n FROM portfolio_photos WHERE company_id=?').bind(id).first()).n)});
 }
 if(p==='/api/v140/waitlist'){
  if(req.method==='GET')return h.json({items:(await db.prepare('SELECT w.id,w.company_id,w.date,w.status,s.name service FROM waitlist w JOIN services s ON s.id=w.service_id WHERE w.user_id=? AND w.status IN (\'waiting\',\'notified\') ORDER BY w.date').bind(String(user.id)).all()).results});
  if(req.method==='POST'){const r=await joinWaitlist(db,user.id,await h.body(req));bad(r);return h.json(r)}
  if(req.method==='DELETE'){const b=await h.body(req);await db.prepare("UPDATE waitlist SET status='cancelled' WHERE id=? AND user_id=?").bind(String(b.id||''),String(user.id)).run();return h.json({ok:true})}
 }
 if(p==='/api/v140/admin/portfolio-limit'&&req.method==='POST'){
  const b=await h.body(req),v=Math.min(PORTFOLIO_MAX,Math.max(PORTFOLIO_DEFAULT,Math.trunc(Number(b.limit)||PORTFOLIO_DEFAULT)));try{await requireAdmin(db,env,user.id,'manage_config')}catch(e){h.fail(e.status||403,e.message||'Нет доступа')}
  await db.batch([db.prepare("INSERT INTO service_config(key,value,updated_at,updated_by) VALUES('portfolio_limit',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(String(v),now(),String(user.id)),db.prepare('INSERT INTO admin_audit(id,actor,action,target,before_value,after_value,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),String(user.id),'portfolio.limit','global','',String(v),now())]);return h.json({ok:true,limit:v})}
 return null;
}
