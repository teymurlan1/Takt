import {adminRole} from './control-auth.js';
import {permissions} from './control-auth.js';
import {escHtml} from './v3.js';
import {botTextOverride} from './bot140.js';
// 14.0 — support lives in the bot chat. Additive schema only. Authentication: Telegram webhook secret (checked by caller).
export const SUPPORT_HOURLY_LIMIT=3,SUPPORT_STATE_TTL=86400;
export const schema140=[
`CREATE TABLE IF NOT EXISTS support_tickets(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,company_id TEXT,role TEXT NOT NULL DEFAULT 'client',lang TEXT NOT NULL DEFAULT 'ru',plan TEXT NOT NULL DEFAULT '',message TEXT NOT NULL,photo_id TEXT,status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','closed')),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS support_tickets_user_time ON support_tickets(user_id,created_at DESC)`,
`CREATE INDEX IF NOT EXISTS support_tickets_status ON support_tickets(status,created_at DESC)`,
`CREATE TABLE IF NOT EXISTS support_state(user_id TEXT PRIMARY KEY,mode TEXT NOT NULL CHECK(mode IN ('await_ticket','reply')),ticket_id INTEGER,updated_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS support_replies(id INTEGER PRIMARY KEY AUTOINCREMENT,ticket_id INTEGER NOT NULL REFERENCES support_tickets(id),admin_id TEXT NOT NULL,text TEXT NOT NULL,created_at INTEGER NOT NULL)`
];
export async function ensure140(db){if(await db.prepare('SELECT 1 FROM schema_versions WHERE version=14').first())return;await db.batch([...schema140.map(sql=>db.prepare(sql)),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(14)')])}
const now=()=>Math.floor(Date.now()/1000);
const COPY={
 ru:{ask:'🛟 <b>Поддержка Takt</b>\nОпишите ваш вопрос одним сообщением — мы ответим здесь. Можно приложить фото. Отмена: /cancel',accepted:n=>`✅ Обращение №${n} принято. Мы ответим в этом чате.`,limit:'Слишком много обращений за час. Попробуйте чуть позже.',short:'Опишите вопрос чуть подробнее (от 5 символов).',reply:n=>`💬 <b>Ответ поддержки · обращение №${n}</b>`,closed:n=>`✔️ Обращение №${n} закрыто. Если вопрос остался — напишите /support.`,hint:'Чтобы написать в поддержку, нажмите кнопку ниже.',btn:'🛟 Связаться с поддержкой',cancelled:'Отменено.',open:'Открыть Takt',helpBtn:'🛟 Написать в поддержку',helpText:'Нужна помощь? Откройте приложение или напишите нам в поддержку.'},
 kk:{ask:'🛟 <b>Takt қолдауы</b>\nСұрағыңызды бір хабарламамен жазыңыз — осы чатта жауап береміз. Фото қосуға болады. Бас тарту: /cancel',accepted:n=>`✅ №${n} өтініш қабылданды. Жауапты осы чатта береміз.`,limit:'Бір сағатта тым көп өтініш. Сәл кейін қайталаңыз.',short:'Сұрақты толығырақ жазыңыз (кемінде 5 таңба).',reply:n=>`💬 <b>Қолдау жауабы · өтініш №${n}</b>`,closed:n=>`✔️ №${n} өтініш жабылды. Сұрақ қалса — /support жазыңыз.`,hint:'Қолдауға жазу үшін төмендегі батырманы басыңыз.',btn:'🛟 Қолдауға жазу',cancelled:'Бас тартылды.',open:'Takt ашу',helpBtn:'🛟 Қолдауға жазу',helpText:'Көмек керек пе? Қолданбаны ашыңыз немесе қолдауға жазыңыз.'},
 az:{ask:'🛟 <b>Takt dəstəyi</b>\nSualınızı bir mesajla yazın — cavabı burada verəcəyik. Foto əlavə edə bilərsiniz. Ləğv: /cancel',accepted:n=>`✅ №${n} müraciət qəbul edildi. Cavabı bu çatda alacaqsınız.`,limit:'Bir saatda həddindən çox müraciət. Bir az sonra yenidən cəhd edin.',short:'Sualı bir az ətraflı yazın (ən azı 5 simvol).',reply:n=>`💬 <b>Dəstək cavabı · müraciət №${n}</b>`,closed:n=>`✔️ №${n} müraciət bağlandı. Sual qalıbsa — /support yazın.`,hint:'Dəstəyə yazmaq üçün aşağıdakı düyməni basın.',btn:'🛟 Dəstəyə yaz',cancelled:'Ləğv edildi.',open:'Takt-ı aç',helpBtn:'🛟 Dəstəyə yaz',helpText:'Kömək lazımdır? Tətbiqi açın və ya dəstəyə yazın.'},
 uz:{ask:'🛟 <b>Takt yordami</b>\nSavolingizni bitta xabarda yozing — javobni shu chatda beramiz. Foto qo‘shish mumkin. Bekor qilish: /cancel',accepted:n=>`✅ №${n} murojaat qabul qilindi. Javob shu chatda keladi.`,limit:'Bir soatda juda ko‘p murojaat. Birozdan keyin urinib ko‘ring.',short:'Savolni batafsilroq yozing (kamida 5 belgi).',reply:n=>`💬 <b>Yordam javobi · murojaat №${n}</b>`,closed:n=>`✔️ №${n} murojaat yopildi. Savol qolsa — /support yozing.`,hint:'Yordamga yozish uchun pastdagi tugmani bosing.',btn:'🛟 Yordamga yozish',cancelled:'Bekor qilindi.',open:'Taktni ochish',helpBtn:'🛟 Yordamga yozish',helpText:'Yordam kerakmi? Ilovani oching yoki yordamga yozing.'}
};
export const supportCopy=lang=>COPY[lang]||COPY.ru;
export const supportButton=lang=>({text:supportCopy(lang).helpBtn,callback_data:'sup:new'});
// Never throws: a failed send must not break the webhook. Returns true on success.
async function send(env,method,payload){if(!env.BOT_TOKEN)return false;try{const r=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});const d=await r.json();return !!d.ok}catch{return false}}
async function langOf(db,id){return (await db.prepare('SELECT language FROM user_app_settings WHERE user_id=?').bind(String(id)).first())?.language||'ru'}
export async function supportAdmins(db,env){const ids=new Set((env.SUPERADMIN_IDS||'').split(',').map(s=>s.trim()).filter(Boolean));const root=String(env.ADMIN_ID||'').trim();if(root)ids.add(root);for(const r of (await db.prepare("SELECT user_id FROM admin_roles WHERE role IN ('OWNER','SUPPORT') AND active=1").all()).results)ids.add(String(r.user_id));return [...ids]}
export async function isSupportAdmin(db,env,id){const role=await adminRole(db,env,id);if(permissions[role]?.includes('support'))return true;return (env.SUPERADMIN_IDS||'').split(',').map(s=>s.trim()).includes(String(id))}
async function setState(db,user,mode,ticket=null){await db.prepare('INSERT INTO support_state(user_id,mode,ticket_id,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET mode=excluded.mode,ticket_id=excluded.ticket_id,updated_at=excluded.updated_at').bind(String(user),mode,ticket,now()).run()}
const clearState=(db,user)=>db.prepare('DELETE FROM support_state WHERE user_id=?').bind(String(user)).run();
async function getState(db,user){const s=await db.prepare('SELECT * FROM support_state WHERE user_id=?').bind(String(user)).first();return s&&s.updated_at>now()-SUPPORT_STATE_TTL?s:null}
const adminKeyboard=id=>({inline_keyboard:[[{text:'💬 Ответить',callback_data:`sup:r:${id}`},{text:'🛠 В работу',callback_data:`sup:w:${id}`},{text:'✔️ Закрыть',callback_data:`sup:c:${id}`}]]});
export async function ticketPlan(db,companyId){if(!companyId)return '';const s=await db.prepare('SELECT status,trial_ends_at,paid_until FROM subscriptions WHERE company_id=?').bind(companyId).first();if(!s)return '';const until=s.paid_until||s.trial_ends_at;return `${s.status}${until?' до '+new Date(Number(until)*1000).toISOString().slice(0,10):''}`}
export async function createTicket(env,db,{userId,name,username,text,photoId=''}){
 const message=String(text||'').trim().slice(0,1500),lang=await langOf(db,userId),L=supportCopy(lang);
 if(message.length<5&&!photoId)return {ok:false,reason:'short',reply:L.short};
 const recent=await db.prepare('SELECT COUNT(*) n FROM support_tickets WHERE user_id=? AND created_at>?').bind(String(userId),now()-3600).first();
 if(Number(recent?.n||0)>=SUPPORT_HOURLY_LIMIT)return {ok:false,reason:'limit',reply:L.limit};
 const membership=await db.prepare('SELECT m.company_id,c.name FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.user_id=? AND c.active=1 ORDER BY c.rowid LIMIT 1').bind(String(userId)).first(),role=membership?'specialist':'client',plan=await ticketPlan(db,membership?.company_id);
 const row=await db.prepare('INSERT INTO support_tickets(user_id,company_id,role,lang,plan,message,photo_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id').bind(String(userId),membership?.company_id||null,role,lang,plan,message||'[фото]',photoId||null,'new',now(),now()).first();
 const id=row.id,head=`🛟 <b>Обращение №${id}</b> · новое\nОт: ${escHtml(name||'Пользователь')}${username?` (@${escHtml(username)})`:''}\nРоль: ${role==='specialist'?'специалист':'клиент'} · язык: ${lang}${plan?`\nПодписка: ${escHtml(plan)}`:''}${membership?`\nКабинет: ${escHtml(membership.name)}`:''}\nTelegram ID: <code>${escHtml(String(userId))}</code>\n\n${escHtml(message||'[фото]')}`;
 for(const admin of await supportAdmins(db,env)){if(photoId){const ok=await send(env,'sendPhoto',{chat_id:admin,photo:photoId,caption:head.slice(0,1024),parse_mode:'HTML',reply_markup:adminKeyboard(id)});if(ok)continue}await send(env,'sendMessage',{chat_id:admin,text:head,parse_mode:'HTML',reply_markup:adminKeyboard(id)})}
 return {ok:true,id,reply:L.accepted(id)};
}
export async function setTicketStatus(env,db,adminId,id,status){
 const t=await db.prepare('SELECT * FROM support_tickets WHERE id=?').bind(id).first();if(!t)return null;
 await db.prepare('UPDATE support_tickets SET status=?,updated_at=? WHERE id=?').bind(status,now(),id).run();
 if(status==='closed')await send(env,'sendMessage',{chat_id:t.user_id,text:supportCopy(t.lang).closed(id),parse_mode:'HTML'});
 return t;
}
export async function replyToTicket(env,db,adminId,id,text){
 const t=await db.prepare('SELECT * FROM support_tickets WHERE id=?').bind(id).first(),body=String(text||'').trim().slice(0,3000);if(!t||!body)return false;
 await db.batch([db.prepare('INSERT INTO support_replies(ticket_id,admin_id,text,created_at) VALUES(?,?,?,?)').bind(id,String(adminId),body,now()),db.prepare("UPDATE support_tickets SET status=CASE WHEN status='new' THEN 'in_progress' ELSE status END,updated_at=? WHERE id=?").bind(now(),id)]);
 const L=supportCopy(t.lang),ok=await send(env,'sendMessage',{chat_id:t.user_id,text:`${L.reply(id)}\n\n${escHtml(body)}`,parse_mode:'HTML',reply_markup:{inline_keyboard:[[supportButton(t.lang)]]}});return ok;
}
// Returns a webhook response body (object) or null when the update is not support-related.
export async function handleSupportUpdate(env,db,{m,cb}){
 await ensure140(db);
 if(cb){
  const d=String(cb.data||''),from=String(cb.from.id);if(!d.startsWith('sup:'))return null;
  const answer=text=>send(env,'answerCallbackQuery',{callback_query_id:cb.id,...(text?{text}:{})});
  if(d==='sup:new'){const lg=await langOf(db,from),L=supportCopy(lg);await setState(db,from,'await_ticket');await answer();await send(env,'sendMessage',{chat_id:from,text:await botTextOverride(db,'support_ask',lg)||L.ask,parse_mode:'HTML'});return {ok:true}}
  const x=d.match(/^sup:([rwc]):([0-9]+)$/);if(!x)return {ok:true};
  if(!await isSupportAdmin(db,env,from)){await answer('Нет доступа');return {ok:true}}
  const id=Number(x[2]);
  if(x[1]==='r'){const t=await db.prepare('SELECT id FROM support_tickets WHERE id=?').bind(id).first();if(!t){await answer('Не найдено');return {ok:true}}await setState(db,from,'reply',id);await answer();await send(env,'sendMessage',{chat_id:from,text:`Введите ответ на обращение №${id} одним сообщением. Отмена: /cancel`});return {ok:true}}
  const t=await setTicketStatus(env,db,from,id,x[1]==='w'?'in_progress':'closed');await answer(t?(x[1]==='w'?'В работе':'Закрыто'):'Не найдено');return {ok:true};
 }
 if(!m||m.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||m.chat.id<=0)return null;
 const from=String(m.chat.id),raw=typeof m.text==='string'?m.text.trim():(typeof m.caption==='string'?m.caption.trim():''),command=raw.startsWith('/')?raw.split(/\s+/)[0].split('@')[0]:'',arg=raw.split(/\s+/)[1]||'';
 const lang=await langOf(db,from),L=supportCopy(lang);
 if(command==='/support'||(command==='/start'&&arg==='support')){await setState(db,from,'await_ticket');await send(env,'sendMessage',{chat_id:from,text:await botTextOverride(db,'support_ask',lang)||L.ask,parse_mode:'HTML'});return {ok:true}}
 const state=await getState(db,from);
 if(command==='/cancel'){if(state){await clearState(db,from);await send(env,'sendMessage',{chat_id:from,text:L.cancelled})}return {ok:true,handled:!!state}}
 if(command)return null;
 if(state?.mode==='reply'){
  if(!await isSupportAdmin(db,env,from)){await clearState(db,from);return {ok:true}}
  const ok=await replyToTicket(env,db,from,state.ticket_id,raw);await clearState(db,from);
  await send(env,'sendMessage',{chat_id:from,text:ok?`✅ Ответ на №${state.ticket_id} отправлен.`:`⚠️ Не удалось доставить ответ на №${state.ticket_id} (пользователь мог заблокировать бота). Он сохранён в обращении.`});return {ok:true};
 }
 if(state?.mode==='await_ticket'){
  const photo=Array.isArray(m.photo)&&m.photo.length?m.photo[m.photo.length-1].file_id:'';
  if(!raw&&!photo)return {ok:true};
  const r=await createTicket(env,db,{userId:from,name:[m.from?.first_name,m.from?.last_name].filter(Boolean).join(' '),username:m.from?.username||'',text:raw,photoId:photo});
  if(r.ok||r.reason==='limit')await clearState(db,from);
  await send(env,'sendMessage',{chat_id:from,text:r.reply,parse_mode:'HTML'});return {ok:true};
 }
 if(raw&&!await isSupportAdmin(db,env,from)){await send(env,'sendMessage',{chat_id:from,text:L.hint,reply_markup:{inline_keyboard:[[supportButton(lang)]]}});return {ok:true}}
 return null;
}
