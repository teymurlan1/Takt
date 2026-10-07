import {requireAdmin} from './control-auth.js';
import {localMinute,localDate,fromLocal,dateShift,defaults} from './v3.js';
import {setTicketStatus,replyToTicket,ensure140} from './v140.js';
import {ensure142} from './tools140.js';
// 14.0 billing layer. Additive schema; no payment provider is connected yet (manual extension + payment history are the seam).
export const GRACE_DAYS=3,REFERRAL_BONUS_DAYS=7,REFERRAL_MAX_REWARDS=12,REFERRAL_WINDOW_DAYS=14,QUIET_FROM=22,QUIET_TO_MINUTES=540;
export const schema140b=[
`CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),amount INTEGER NOT NULL DEFAULT 0,currency TEXT NOT NULL DEFAULT 'RUB',status TEXT NOT NULL CHECK(status IN ('pending','paid','failed','refunded','manual','bonus')),provider TEXT NOT NULL DEFAULT 'manual',provider_ref TEXT,days INTEGER NOT NULL DEFAULT 0,note TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS payments_company_time ON payments(company_id,created_at DESC)`,
`CREATE TABLE IF NOT EXISTS referrals(referred_company TEXT PRIMARY KEY REFERENCES companies(id),referrer_company TEXT NOT NULL REFERENCES companies(id),bonus_days INTEGER NOT NULL,created_at INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS referrals_referrer ON referrals(referrer_company)`,
`CREATE TABLE IF NOT EXISTS subscription_notices(company_id TEXT NOT NULL,kind INTEGER NOT NULL,period_end INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(company_id,kind,period_end))`
];
export async function ensure140b(db){await ensure140(db);if(!await db.prepare('SELECT 1 FROM schema_versions WHERE version=141').first())await db.batch([...schema140b.map(s=>db.prepare(s)),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(141)')]);await ensure142(db)}
const now=()=>Math.floor(Date.now()/1000);
export function subscriptionState(sub,t=now()){
 const trial=Number(sub?.trial_ends_at||0),paid=Number(sub?.paid_until||0),end=Math.max(trial,paid),grace=end+GRACE_DAYS*86400;
 const state=!sub?'none':t<end?(paid>t?'active':'trial'):t<grace?'grace':'expired';
 return {state,until:end,days_left:Math.ceil((end-t)/86400),grace_until:grace,new_bookings_paused:state==='grace'||state==='expired'};
}
// ---- quiet hours: non-urgent messages wait until 09:00 recipient-local time ----
export function quietUntil(ts,tz){try{const m=localMinute(ts,tz);if(m>=QUIET_FROM*60||m<QUIET_TO_MINUTES){const d=localDate(ts,tz);return fromLocal(m>=QUIET_FROM*60?dateShift(d,1):d,QUIET_TO_MINUTES,tz)}}catch{}return ts}
// ---- granting days (referral / manual) ----
function grantStatements(db,sub,days,t=now()){
 if(Number(sub.paid_until||0)>t)return [db.prepare('UPDATE subscriptions SET paid_until=paid_until+?,updated_at=? WHERE company_id=?').bind(days*86400,t,sub.company_id)];
 return [db.prepare("UPDATE subscriptions SET trial_ends_at=MAX(?,trial_ends_at)+?,status='trial',updated_at=? WHERE company_id=?").bind(t,days*86400,t,sub.company_id)];
}
export async function applyReferral(db,referredCompany,code){
 const key=String(code||'').trim().replace(/^r_/,'').slice(0,80);if(!key)return {ok:false,reason:'empty'};
 const referrer=await db.prepare('SELECT c.id FROM companies c LEFT JOIN specialist_handles h ON h.company_id=c.id WHERE c.active=1 AND (c.id=? OR h.handle=?) LIMIT 1').bind(key,key).first();
 if(!referrer)return {ok:false,reason:'unknown'};if(referrer.id===referredCompany)return {ok:false,reason:'self'};
 if(await db.prepare('SELECT 1 FROM referrals WHERE referred_company=?').bind(referredCompany).first())return {ok:false,reason:'already'};
 const mine=await db.prepare('SELECT * FROM subscriptions WHERE company_id=?').bind(referredCompany).first(),theirs=await db.prepare('SELECT * FROM subscriptions WHERE company_id=?').bind(referrer.id).first();
 if(!mine||!theirs)return {ok:false,reason:'nosub'};
 if(mine.trial_started_at<now()-REFERRAL_WINDOW_DAYS*86400)return {ok:false,reason:'late'};
 const rewarded=await db.prepare('SELECT COUNT(*) n FROM referrals WHERE referrer_company=?').bind(referrer.id).first(),rewardReferrer=Number(rewarded?.n||0)<REFERRAL_MAX_REWARDS,t=now();
 const ops=[db.prepare('INSERT INTO referrals(referred_company,referrer_company,bonus_days,created_at) VALUES(?,?,?,?)').bind(referredCompany,referrer.id,REFERRAL_BONUS_DAYS,t),...grantStatements(db,mine,REFERRAL_BONUS_DAYS,t),db.prepare("INSERT INTO payments(id,company_id,status,provider,days,note,created_at) VALUES(?,?,'bonus','referral',?,?,?)").bind('ref:'+referredCompany+':in',referredCompany,REFERRAL_BONUS_DAYS,'referral invited',t)];
 if(rewardReferrer)ops.push(...grantStatements(db,theirs,REFERRAL_BONUS_DAYS,t),db.prepare("INSERT INTO payments(id,company_id,status,provider,days,note,created_at) VALUES(?,?,'bonus','referral',?,?,?)").bind('ref:'+referredCompany+':out',referrer.id,REFERRAL_BONUS_DAYS,'referral reward',t));
 await db.batch(ops);return {ok:true,referrer:referrer.id,bonus_days:REFERRAL_BONUS_DAYS,referrer_rewarded:rewardReferrer};
}
export async function manualExtend(db,{company,days,amount=0,currency='RUB',note='',actor,key}){
 const d=Math.trunc(Number(days));if(!(d>=1&&d<=366))return {ok:false,reason:'days'};
 const sub=await db.prepare('SELECT * FROM subscriptions WHERE company_id=?').bind(company).first();if(!sub)return {ok:false,reason:'nosub'};
 const id='manual:'+(String(key||'').slice(0,60)||crypto.randomUUID()),t=now();
 if(await db.prepare('SELECT 1 FROM payments WHERE id=?').bind(id).first())return {ok:true,duplicate:true,id};
 await db.batch([db.prepare("INSERT INTO payments(id,company_id,amount,currency,status,provider,days,note,created_by,created_at) VALUES(?,?,?,?,'manual','manual',?,?,?,?)").bind(id,company,Math.max(0,Math.trunc(Number(amount)||0)),String(currency).slice(0,5),d,String(note).slice(0,200),String(actor),t),...grantStatements(db,sub,d,t),db.prepare('INSERT INTO admin_audit(id,actor,action,target,before_value,after_value,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),String(actor),'subscription.manual_extend',company,String(Math.max(sub.paid_until||0,sub.trial_ends_at||0)),String(d)+'d',t)]);
 return {ok:true,id};
}
// ---- end-of-subscription notices: 7 / 3 / 1 days before and on the day; one per (company, kind, period) ----
const NOTICE={
 ru:{n:d=>`⏳ Доступ специалиста Takt заканчивается через ${d} дн. Продлите заранее — записи клиентов не прервутся.`,zero:`⏰ Срок доступа Takt закончился. Данные и клиенты сохранены, клиенты по-прежнему пользуются бесплатно. Новые записи на паузе — продлите доступ, и они возобновятся.`,btn:'Продлить'},
 kk:{n:d=>`⏳ Takt мамандық қолжетімділігі ${d} күннен кейін аяқталады. Алдын ала ұзартыңыз — клиент жазылулары үзілмейді.`,zero:`⏰ Takt қолжетімділік мерзімі аяқталды. Деректер мен клиенттер сақталды, клиенттер тегін қолдана береді. Жаңа жазылулар кідіртілді — ұзартсаңыз, қайта жалғасады.`,btn:'Ұзарту'},
 az:{n:d=>`⏳ Takt mütəxəssis girişi ${d} gün sonra bitir. Əvvəlcədən yeniləyin — müştəri qeydləri kəsilməz.`,zero:`⏰ Takt giriş müddəti bitdi. Məlumatlar və müştərilər saxlanılıb, müştərilər pulsuz istifadə edir. Yeni qeydlər dayandırılıb — yenilədikdə bərpa olunacaq.`,btn:'Yenilə'},
 uz:{n:d=>`⏳ Takt mutaxassis kirishi ${d} kundan keyin tugaydi. Oldindan uzaytiring — mijoz yozuvlari to‘xtamaydi.`,zero:`⏰ Takt kirish muddati tugadi. Ma’lumotlar va mijozlar saqlangan, mijozlar bepul foydalanadi. Yangi yozuvlar to‘xtatilgan — uzaytirsangiz, tiklanadi.`,btn:'Uzaytirish'}
};
export const noticeKind=(end,t=now())=>{const left=end-t;if(left<=0)return t-end<=86400?0:null;if(left<=86400)return 1;if(left<=3*86400)return 3;if(left<=7*86400)return 7;return null};
export async function subscriptionNotices(env,db,{budget=40}={}){
 await ensure140b(db);const t=now(),base=env.APP_URL||'https://takt.taktapp.workers.dev';let queued=0;
 const subs=(await db.prepare('SELECT s.*,o.data options FROM subscriptions s JOIN companies c ON c.id=s.company_id AND c.active=1 LEFT JOIN specialist_options o ON o.company_id=s.company_id WHERE MAX(COALESCE(s.paid_until,0),s.trial_ends_at) BETWEEN ? AND ?').bind(t-86400,t+7*86400).all()).results;
 for(const s of subs){if(queued>=budget)break;const end=Math.max(Number(s.paid_until||0),Number(s.trial_ends_at||0)),kind=noticeKind(end,t);if(kind===null)continue;
  const fresh=await db.prepare('INSERT OR IGNORE INTO subscription_notices(company_id,kind,period_end,created_at) VALUES(?,?,?,?)').bind(s.company_id,kind,end,t).run();if(!fresh.meta.changes)continue;
  let tz=defaults.timezone;try{tz=JSON.parse(s.options||'{}').timezone||tz}catch{}
  const when=quietUntil(t,tz),members=(await db.prepare('SELECT user_id FROM memberships WHERE company_id=?').bind(s.company_id).all()).results;
  for(const m of members){const lang=(await db.prepare('SELECT language FROM user_app_settings WHERE user_id=?').bind(String(m.user_id)).first())?.language||'ru',L=NOTICE[lang]||NOTICE.ru,days=kind===1?1:kind;
   const payload={text:kind===0?L.zero:L.n(days),reply_markup:{inline_keyboard:[[{text:L.btn,web_app:{url:base}}]]}};
   await db.prepare('INSERT OR IGNORE INTO outbox(id,chat_id,text,created_at,lease_until) VALUES(?,?,?,?,?)').bind(`subend:${s.company_id}:${kind}:${end}:${m.user_id}`,String(m.user_id),JSON.stringify(payload),t,when>t?when:0).run();queued++}}
 return {queued};
}
// ---- HTTP API ----
const REASONS={blocked:'Пользователь заблокировал бота',failed:'Telegram отклонил сообщение',unknown:'Исход отправки неясен, повтор не делается',retry:'Ждёт повторной попытки',sending:'Отправляется',pending:'Ожидает отправки'};
export async function api140(req,env,user,h){
 const u=new URL(req.url),p=u.pathname;if(!p.startsWith('/api/v140/'))return null;const db=env.DB;await ensure140b(db);
 const guard=async perm=>{try{return await requireAdmin(db,env,user.id,perm)}catch(e){h.fail(e.status||403,e.message||'Нет доступа')}};
 if(p==='/api/v140/subscription'&&req.method==='GET'){
  const id=String(u.searchParams.get('company')||'').slice(0,80);if(!await h.access(db,env,user,id))h.fail(403,'Нет доступа');
  const sub=await db.prepare('SELECT * FROM subscriptions WHERE company_id=?').bind(id).first(),st=subscriptionState(sub),
   payments=(await db.prepare('SELECT id,amount,currency,status,provider,days,note,created_at FROM payments WHERE company_id=? ORDER BY created_at DESC LIMIT 20').bind(id).all()).results,
   ref=await db.prepare('SELECT COUNT(*) n,COALESCE(SUM(bonus_days),0) d FROM referrals WHERE referrer_company=?').bind(id).first(),handle=(await db.prepare('SELECT handle FROM specialist_handles WHERE company_id=?').bind(id).first())?.handle;
  return h.json({...st,grace_days:GRACE_DAYS,payments,referral:{code:'r_'+(handle||id),invited:Number(ref?.n||0),bonus_days_total:Number(ref?.d||0),bonus_days_each:REFERRAL_BONUS_DAYS},after_end:{data_kept:true,clients_free:true,new_bookings_paused:true}});
 }
 if(p==='/api/v140/referral'&&req.method==='POST'){
  const b=await h.body(req),id=String(b.company||'').slice(0,80);if(!await h.access(db,env,user,id))h.fail(403,'Нет доступа');
  const r=await applyReferral(db,id,b.code);if(!r.ok)h.fail(r.reason==='already'?409:400,{unknown:'Код не найден',self:'Нельзя использовать свой код',already:'Реферальный код уже применён',late:'Код можно применить в первые '+REFERRAL_WINDOW_DAYS+' дней',empty:'Введите код',nosub:'Подписка не найдена'}[r.reason]||'Не удалось применить код');
  return h.json(r);
 }
 if(p==='/api/v140/admin/undelivered'&&req.method==='GET'){
  await guard('system');
  const rows=(await db.prepare("SELECT o.id,o.chat_id,o.attempts,o.created_at,o.lease_until,COALESCE(d.state,'pending') state FROM outbox o LEFT JOIN delivery_state d ON d.id=o.id WHERE o.created_at>? AND (o.sent_at IS NULL AND (COALESCE(d.state,'pending') IN ('failed','blocked','unknown','retry','sending') OR o.attempts>=5) ) ORDER BY o.created_at DESC LIMIT 100").bind(now()-7*86400).all()).results;
  return h.json({items:rows.map(r=>({id:r.id,kind:r.id.split(':')[0],chat_id:r.chat_id,state:r.state,attempts:r.attempts,created_at:r.created_at,reason:REASONS[r.state]||REASONS.pending}))});
 }
 if(p==='/api/v140/admin/tickets'){
  if(req.method==='GET'){await guard('support');const s=u.searchParams.get('status');const rows=(await db.prepare(`SELECT id,user_id,role,lang,plan,status,substr(message,1,200) message,created_at,updated_at FROM support_tickets ${['new','in_progress','closed'].includes(s)?'WHERE status=?':''} ORDER BY id DESC LIMIT 100`).bind(...(['new','in_progress','closed'].includes(s)?[s]:[])).all()).results;return h.json({items:rows})}
  if(req.method==='POST'){await guard('support');const b=await h.body(req),id=Number(b.id);if(!Number.isSafeInteger(id))h.fail(400,'Нет номера обращения');
   if(b.action==='reply'){const ok=await replyToTicket(env,db,String(user.id),id,b.text);return h.json({ok:true,delivered:ok})}
   if(b.action==='status'&&['new','in_progress','closed'].includes(b.status)){const t=await setTicketStatus(env,db,String(user.id),id,b.status);if(!t)h.fail(404,'Не найдено');return h.json({ok:true})}
   h.fail(400,'Неизвестное действие')}
 }
 if(p==='/api/v140/admin/billing'&&req.method==='POST'){const role=await guard('manage_config'),b=await h.body(req),v=b.enforce?'1':'0',before=(await db.prepare("SELECT value FROM service_config WHERE key='billing_enforce'").first())?.value||'0';await db.batch([db.prepare("INSERT INTO service_config(key,value,updated_at,updated_by) VALUES('billing_enforce',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(v,now(),String(user.id)),db.prepare('INSERT INTO admin_audit(id,actor,action,target,before_value,after_value,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),String(user.id),'billing.enforce','global',before,v,now())]);return h.json({ok:true,enforce:v==='1',role})}
 if(p==='/api/v140/admin/payments'){
  if(req.method==='GET'){await guard('finance');const c=u.searchParams.get('company');const rows=(await db.prepare(`SELECT * FROM payments ${c?'WHERE company_id=?':''} ORDER BY created_at DESC LIMIT 100`).bind(...(c?[c]:[])).all()).results;return h.json({items:rows})}
  if(req.method==='POST'){await guard('finance');const b=await h.body(req),r=await manualExtend(db,{company:String(b.company||''),days:b.days,amount:b.amount,currency:b.currency||'RUB',note:b.note||'',actor:user.id,key:b.request_key});if(!r.ok)h.fail(400,{days:'Укажите срок от 1 до 366 дней',nosub:'Подписка не найдена'}[r.reason]||'Не удалось продлить');return h.json(r)}
 }
 return null;
}
