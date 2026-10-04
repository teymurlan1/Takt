import {schema3,options,validateOptions,localDate,fromLocal,dateShift} from './v3.js';
import {schema7} from './v7.js';
// Additive schema: legacy bookings and service IDs are preserved.
export const schema=[
...schema3,
...schema7,
`CREATE TABLE IF NOT EXISTS specialist_settings(company_id TEXT PRIMARY KEY REFERENCES companies(id),category TEXT NOT NULL DEFAULT 'beauty',photo TEXT NOT NULL DEFAULT '',schedule TEXT NOT NULL,cancel_hours INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS service_details(service_id TEXT PRIMARY KEY REFERENCES services(id),company_id TEXT NOT NULL REFERENCES companies(id),description TEXT NOT NULL DEFAULT '',photo TEXT NOT NULL DEFAULT '',duration INTEGER NOT NULL CHECK(duration>=15 AND duration<=480 AND duration%5=0),position INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS client_links(user_id TEXT NOT NULL,company_id TEXT NOT NULL REFERENCES companies(id),created_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,PRIMARY KEY(user_id,company_id))`,
`CREATE TABLE IF NOT EXISTS user_preferences(user_id TEXT PRIMARY KEY,specialist_intro INTEGER NOT NULL DEFAULT 0,client_intro INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS client_notes(company_id TEXT NOT NULL REFERENCES companies(id),client_id TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',PRIMARY KEY(company_id,client_id))`,
`CREATE TABLE IF NOT EXISTS blocked_slots(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL,label TEXT NOT NULL DEFAULT 'Не принимаю',CHECK(ends_at>starts_at))`,
`CREATE INDEX IF NOT EXISTS blocked_time ON blocked_slots(company_id,starts_at)`,
`CREATE TRIGGER IF NOT EXISTS block_booking_insert BEFORE INSERT ON bookings WHEN NEW.status IN ('pending','confirmed') AND EXISTS(SELECT 1 FROM blocked_slots WHERE company_id=NEW.company_id AND starts_at<NEW.ends_at AND ends_at>NEW.starts_at) BEGIN SELECT RAISE(ABORT,'SLOT_TAKEN'); END`,
`CREATE TRIGGER IF NOT EXISTS booking_update_guard BEFORE UPDATE OF starts_at,ends_at,status ON bookings WHEN NEW.status IN ('pending','confirmed') AND (EXISTS(SELECT 1 FROM bookings WHERE company_id=NEW.company_id AND id<>NEW.id AND status IN ('pending','confirmed') AND starts_at<NEW.ends_at AND ends_at>NEW.starts_at) OR EXISTS(SELECT 1 FROM blocked_slots WHERE company_id=NEW.company_id AND starts_at<NEW.ends_at AND ends_at>NEW.starts_at)) BEGIN SELECT RAISE(ABORT,'SLOT_TAKEN'); END`,
`CREATE TRIGGER IF NOT EXISTS blocked_insert_guard BEFORE INSERT ON blocked_slots WHEN EXISTS(SELECT 1 FROM bookings WHERE company_id=NEW.company_id AND status IN ('pending','confirmed') AND starts_at<NEW.ends_at AND ends_at>NEW.starts_at) OR EXISTS(SELECT 1 FROM blocked_slots WHERE company_id=NEW.company_id AND starts_at<NEW.ends_at AND ends_at>NEW.starts_at) BEGIN SELECT RAISE(ABORT,'SLOT_TAKEN'); END`,
`CREATE TABLE IF NOT EXISTS booking_attendance(booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,state TEXT NOT NULL DEFAULT 'unknown' CHECK(state IN ('unknown','coming','not_coming')),responded_at INTEGER)`,
`CREATE TABLE IF NOT EXISTS subscriptions(company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,trial_started_at INTEGER NOT NULL,trial_ends_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'trial' CHECK(status IN ('trial','active','expired','grace')),paid_until INTEGER,updated_at INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS booking_attendance_state ON booking_attendance(state,responded_at)`,
`CREATE INDEX IF NOT EXISTS subscriptions_status ON subscriptions(status,trial_ends_at,paid_until)`
];
const initialized=new WeakMap();
export async function ensureSchema(db){if(!initialized.has(db))initialized.set(db,(async()=>{await db.prepare('CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY)').run();if(await db.prepare('SELECT 1 FROM schema_versions WHERE version=7').first())return;await db.batch([...schema.map(sql=>db.prepare(sql)),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(7)')])})().catch(e=>{initialized.delete(db);throw e}));await initialized.get(db)}
const err=(status,message)=>{throw Object.assign(new Error(message),{status})};
const clean=(s,n=200)=>typeof s==='string'?s.trim().slice(0,n):'';
const stamp=()=>Math.floor(Date.now()/1000);
export const categories=['beauty','barber','hair','brows','cosmetology','massage','cleaning','photo','education','auto','repair','other'];
export function photo(value){if(!value)return '';if(typeof value!=='string'||value.length>95000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))err(400,'Загрузите небольшое фото JPG, PNG или WebP');return value}
export function schedule(value){if(!Array.isArray(value)||value.length!==7)err(400,'Укажите расписание недели');return value.map(d=>{if(d===null)return null;const intervals=Array.isArray(d)?d:[d];if(!intervals.length||intervals.length>8)err(400,'Укажите от 1 до 8 рабочих интервалов');let end=-1;const valid=intervals.map(v=>{if(!v||!Number.isInteger(v.start)||!Number.isInteger(v.end)||v.start<0||v.end>1440||v.end<=v.start||v.start%5||v.end%5||v.start<end)err(400,'Рабочие интервалы должны идти по порядку и не пересекаться');end=v.end;return {start:v.start,end:v.end}});return Array.isArray(d)?valid:valid[0]})}
export async function enrichCompany(db,c){const x=await db.prepare('SELECT * FROM specialist_settings WHERE company_id=?').bind(c.id).first();return {...c,...await options(db,c.id),category:x?.category||c.category,photo:x?.photo||'',schedule:x?JSON.parse(x.schedule):Array.from({length:7},()=>({start:c.open_hour*60,end:c.close_hour*60})),cancel_hours:x?.cancel_hours||0}}
export async function enrichService(db,s){if(!s)return s;const x=await db.prepare('SELECT * FROM service_details WHERE service_id=? AND company_id=?').bind(s.id,s.company_id).first();return {...s,description:x?.description||'',photo:x?.photo||'',duration:x?.duration||s.duration,position:x?.position||0}}
export async function services(db,id,privateView=false){const rows=(await db.prepare('SELECT * FROM services WHERE company_id=?'+(privateView?'':' AND active=1')+' ORDER BY rowid').bind(id).all()).results;const all=await Promise.all(rows.map(s=>enrichService(db,s)));return all.sort((a,b)=>a.position-b.position)}
export async function v2(req,env,user,h){const {json,body,access,company,slots,notices}=h,db=env.DB,url=new URL(req.url),p=url.pathname,m=req.method;
const guard=async id=>{if(!await access(db,env,user,id))err(403,'Нет доступа к этому кабинету');return company(db,id)};
if(p==='/api/v2/handle'&&m==='POST'){
 const b=await body(req);await guard(b.company_id);const handle=clean(b.username,32).toLowerCase();if(!/^[a-z][a-z0-9-]{2,31}$/.test(handle)||['api','admin','app','assets','register','help','takt','settings'].includes(handle))err(400,'От 3 до 32 символов: латинские буквы, цифры и дефис');
 const used=await db.prepare('SELECT company_id FROM specialist_handles WHERE handle=?').bind(handle).first();if(used&&used.company_id!==b.company_id)err(409,'Этот адрес уже занят');
 try{await db.batch([db.prepare('INSERT OR IGNORE INTO specialist_handles VALUES(?,?,?)').bind(handle,b.company_id,stamp()),db.prepare("INSERT INTO specialist_options(company_id,data) VALUES(?,json_object('username',?)) ON CONFLICT(company_id) DO UPDATE SET data=json_set(data,'$.username',?) WHERE EXISTS(SELECT 1 FROM specialist_handles WHERE handle=? AND company_id=?)").bind(b.company_id,handle,handle,handle,b.company_id)])}catch{err(409,'Не удалось сохранить адрес. Попробуйте другой')}
 const check=await db.prepare('SELECT company_id FROM specialist_handles WHERE handle=?').bind(handle).first();if(check?.company_id!==b.company_id)err(409,'Этот адрес уже занят');return json({username:handle});
}
if(p==='/api/v2/preferences'){
 if(m==='GET')return json(await db.prepare('SELECT * FROM user_preferences WHERE user_id=?').bind(user.id).first()||{});
 if(m==='POST'){const b=await body(req);if(!['specialist','client'].includes(b.mode))err(400,'Неизвестный режим');await db.prepare(`INSERT INTO user_preferences(user_id,${b.mode}_intro) VALUES(?,2) ON CONFLICT(user_id) DO UPDATE SET ${b.mode}_intro=2`).bind(user.id).run();return json({ok:true})}
}
if(p==='/api/v2/context'){
 if(m==='POST'){const b=await body(req);await company(db,b.company_id);await db.prepare('INSERT INTO client_links(user_id,company_id,created_at,last_seen) VALUES(?,?,?,?) ON CONFLICT(user_id,company_id) DO UPDATE SET last_seen=excluded.last_seen').bind(user.id,b.company_id,stamp(),Date.now()).run();return json({ok:true})}
 return json(await db.prepare('SELECT company_id FROM client_links WHERE user_id=? ORDER BY last_seen DESC LIMIT 1').bind(user.id).first()||{});
}
if(p==='/api/v2/register'&&m==='POST'){
 const existing=await db.prepare('SELECT company_id FROM memberships WHERE user_id=? ORDER BY rowid LIMIT 1').bind(user.id).first();if(existing)return json({id:existing.company_id});
 const b=await body(req),name=clean(b.name,80),sn=clean(b.service_name,120),hours=schedule(b.schedule),img=photo(b.photo),sp=photo(b.service_photo);if(name.length<2||sn.length<2||!categories.includes(b.category))err(400,'Укажите имя, сферу и услугу');validateService({...b,name:sn});if(!hours.some(Boolean))err(400,'Выберите хотя бы один рабочий день');
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('takt-business:'+user.id));const id='m-'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('').slice(0,32),sid='s-'+id;
 await db.batch([
 db.prepare('INSERT OR IGNORE INTO companies(id,name,category,tagline,address,phone) VALUES(?,?,?,?,?,?)').bind(id,name,['cleaning','auto'].includes(b.category)?b.category:'beauty',clean(b.tagline,160)||'Запись в удобное для вас время',clean(b.address),clean(b.phone,24)),
 db.prepare('INSERT OR IGNORE INTO memberships VALUES(?,?)').bind(id,user.id),
 db.prepare('INSERT OR IGNORE INTO registrations VALUES(?,?)').bind(id,stamp()),
 db.prepare('INSERT OR IGNORE INTO specialist_settings(company_id,category,photo,schedule) VALUES(?,?,?,?)').bind(id,b.category,img,JSON.stringify(hours)),
 db.prepare('INSERT OR IGNORE INTO services(id,company_id,name,price,duration) VALUES(?,?,?,?,?)').bind(sid,id,sn,b.price,Math.ceil(b.duration/30)*30),
 db.prepare('INSERT OR IGNORE INTO service_details(service_id,company_id,description,photo,duration) VALUES(?,?,?,?,?)').bind(sid,id,clean(b.description,700),sp,b.duration)
 ]);return json({id},201);
}
if(p==='/api/v2/settings'&&m==='POST'){
 const b=await body(req),c=await guard(b.company_id),opts=validateOptions(b,c),hours=schedule(b.schedule),img=photo(b.photo),name=clean(b.name,80);if(name.length<2||!categories.includes(b.category)||!Number.isInteger(b.cancel_hours)||b.cancel_hours<0||b.cancel_hours>168)err(400,'Проверьте настройки');
 await db.batch([db.prepare('INSERT INTO specialist_options(company_id,data) VALUES(?,?) ON CONFLICT(company_id) DO UPDATE SET data=json_patch(data,excluded.data)').bind(c.id,JSON.stringify(opts)),db.prepare('UPDATE companies SET name=?,tagline=?,address=?,phone=? WHERE id=?').bind(name,clean(b.tagline,160),clean(b.address),clean(b.phone,24),c.id),db.prepare('INSERT INTO specialist_settings(company_id,category,photo,schedule,cancel_hours) VALUES(?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET category=excluded.category,photo=excluded.photo,schedule=excluded.schedule,cancel_hours=excluded.cancel_hours').bind(c.id,b.category,img,JSON.stringify(hours),b.cancel_hours)]);return json({ok:true});
}
if(p==='/api/v2/services'&&m==='POST'){
 const b=await body(req);await guard(b.company_id);validateService(b);const img=photo(b.photo);let id=b.id;
 if(id){const s=await db.prepare('SELECT company_id FROM services WHERE id=?').bind(id).first();if(!s||s.company_id!==b.company_id)err(403,'Нет доступа к услуге')}
 else{if(!/^[a-z0-9-]{8,80}$/.test(b.request_key||''))err(400,'Повторите добавление');id=b.company_id+'-'+b.request_key}
 const position=Number.isInteger(b.position)?b.position:0;await db.batch([
 db.prepare('INSERT INTO services(id,company_id,name,price,duration,active) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,price=excluded.price,duration=excluded.duration,active=excluded.active').bind(id,b.company_id,clean(b.name,120),b.price,Math.ceil(b.duration/30)*30,b.active===false||b.active===0?0:1),
 db.prepare('INSERT INTO service_details(service_id,company_id,description,photo,duration,position) VALUES(?,?,?,?,?,?) ON CONFLICT(service_id) DO UPDATE SET description=excluded.description,photo=excluded.photo,duration=excluded.duration,position=excluded.position').bind(id,b.company_id,clean(b.description,700),img,b.duration,position)
 ]);return json({id});
}
if(p==='/api/v2/reorder'&&m==='POST'){
 const b=await body(req);await guard(b.company_id);const own=await services(db,b.company_id,true);if(!Array.isArray(b.ids)||b.ids.length!==own.length||new Set(b.ids).size!==own.length||b.ids.some(id=>!own.some(s=>s.id===id)))err(400,'Обновите список услуг');await db.batch(b.ids.map((id,i)=>db.prepare('INSERT INTO service_details(service_id,company_id,duration,position) VALUES(?,?,?,?) ON CONFLICT(service_id) DO UPDATE SET position=excluded.position').bind(id,b.company_id,own.find(s=>s.id===id).duration,i)));return json({ok:true});
}
if(p==='/api/v2/blocks'){
 const b=m==='GET'?{company_id:url.searchParams.get('company')}:await body(req);await guard(b.company_id);
 if(m==='GET')return json((await db.prepare('SELECT * FROM blocked_slots WHERE company_id=? AND ends_at>? ORDER BY starts_at LIMIT 500').bind(b.company_id,stamp()-31*86400).all()).results);
 if(m==='DELETE'){await db.prepare('DELETE FROM blocked_slots WHERE company_id=? AND id=?').bind(b.company_id,b.id).run();return json({ok:true})}
 if(m==='POST'){if(!Number.isInteger(b.starts_at)||!Number.isInteger(b.ends_at)||b.starts_at<stamp()||b.ends_at<=b.starts_at||b.ends_at-b.starts_at>366*86400)err(400,'Проверьте время блокировки');try{await db.prepare('INSERT INTO blocked_slots VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),b.company_id,b.starts_at,b.ends_at,clean(b.label,80)||'Не принимаю').run()}catch(e){if(String(e).includes('SLOT_TAKEN'))err(409,'Это время уже занято записью или блокировкой');throw e}return json({ok:true})}
}
if(p==='/api/v2/clients'){
 const id=url.searchParams.get('company');await guard(id);
 return json((await db.prepare(`SELECT b.user_id AS id,(SELECT name FROM bookings latest WHERE latest.company_id=b.company_id AND latest.user_id=b.user_id ORDER BY latest.created_at DESC,latest.rowid DESC LIMIT 1) AS name,(SELECT phone FROM bookings latest WHERE latest.company_id=b.company_id AND latest.user_id=b.user_id ORDER BY latest.created_at DESC,latest.rowid DESC LIMIT 1) AS phone,COUNT(*) AS bookings,SUM(CASE WHEN b.status='done' THEN 1 ELSE 0 END) AS visits,SUM(CASE WHEN b.status='done' THEN b.price ELSE 0 END) AS revenue,MAX(CASE WHEN b.status='done' THEN b.starts_at END) AS last_visit,MIN(CASE WHEN b.status IN ('pending','confirmed') AND b.starts_at>? THEN b.starts_at END) AS next_visit,COALESCE(n.note,'') AS note FROM bookings b LEFT JOIN client_notes n ON n.company_id=b.company_id AND n.client_id=b.user_id WHERE b.company_id=? GROUP BY b.user_id ORDER BY MAX(b.created_at) DESC`).bind(stamp(),id).all()).results);
}
if(p==='/api/v2/client-note'&&m==='POST'){
 const b=await body(req);await guard(b.company_id);const exists=await db.prepare('SELECT 1 FROM bookings WHERE company_id=? AND user_id=? LIMIT 1').bind(b.company_id,b.client_id).first();if(!exists)err(404,'Клиент не найден');await db.prepare('INSERT INTO client_notes VALUES(?,?,?) ON CONFLICT(company_id,client_id) DO UPDATE SET note=excluded.note').bind(b.company_id,b.client_id,clean(b.note,2000)).run();return json({ok:true});
}
if(p==='/api/v2/analytics'){
 const id=url.searchParams.get('company');const c=await guard(id),d=url.searchParams.get('date');h.dayBounds(d);const start=fromLocal(d,0,c.timezone),end=fromLocal(dateShift(d,1),0,c.timezone);return json(await db.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN status='done' THEN price ELSE 0 END) AS earned,SUM(CASE WHEN status IN ('pending','confirmed') THEN price ELSE 0 END) AS planned,SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled FROM bookings WHERE company_id=? AND starts_at>=? AND starts_at<?`).bind(id,start,end).first());
}
if(p==='/api/v2/reschedule'&&m==='POST'){
 const data=await body(req),b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(data.id).first();if(!b)err(404,'Запись не найдена');const admin=await access(db,env,user,b.company_id);if(!admin&&b.user_id!==user.id)err(403,'Нет доступа');const c=await company(db,b.company_id);if(!['pending','confirmed'].includes(b.status)||(!admin&&(!c.allow_reschedule||b.starts_at<=stamp()+c.cancel_hours*3600)))err(409,'Перенос уже недоступен. Свяжитесь со специалистом');const start=Number(data.starts_at);if(!Number.isInteger(start)||start<=stamp()+c.min_notice*60||start>stamp()+c.horizon*86400)err(400,'Выберите доступное время в расписании');const duration=(b.ends_at-b.starts_at)/60,date=localDate(start,c.timezone);if(!(await slots(db,c,{duration},date,b.id)).includes(start))err(409,'Это время недоступно');const eid=crypto.randomUUID(),moved={...b,starts_at:start,ends_at:start+duration*60,status:'pending'};
 try{const out=await db.batch([db.prepare("UPDATE bookings SET starts_at=?,ends_at=?,status='pending',status_event=? WHERE id=? AND starts_at=? AND status=?").bind(moved.starts_at,moved.ends_at,eid,b.id,b.starts_at,b.status),...await notices(db,moved,'moved-'+eid,[b.id,eid],b.starts_at),db.prepare('DELETE FROM outbox WHERE id LIKE ? AND sent_at IS NULL AND attempts<5').bind(b.id+':reminder%'),db.prepare('DELETE FROM booking_attendance WHERE booking_id=?').bind(b.id)]);if(!out[0].meta.changes)err(409,'Запись уже изменилась')}catch(e){if(String(e).includes('SLOT_TAKEN'))err(409,'Это время уже заняли');throw e}return json({ok:true});
}
return null;
}
function validateService(b){if(clean(b.name||b.service_name,120).length<2||!Number.isInteger(b.price)||b.price<0||b.price>1000000||!Number.isInteger(b.duration)||b.duration<15||b.duration>480||b.duration%5)err(400,'Проверьте услугу: длительность от 15 минут с шагом 5 минут')}
