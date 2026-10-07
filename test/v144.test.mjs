import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from '../scripts/db.mjs';import {deliver} from '../src/worker.js';import {ensureSchema} from '../src/v2.js';
import {noticeKind,subscriptionNotices,subscriptionUrl,endStamp} from '../src/billing140.js';
import {messagePayload,localMinute,defaults} from '../src/v3.js';import {rebookTick} from '../src/tools140.js';import {botEntry} from '../src/bot-entry.js';import {legalVersions} from '../src/v10.js';
const D=86400,RT=Date.now.bind(Date),T=()=>Math.floor(Date.now()/1000);let seq=0;
async function setup(){const DB=database();DB.sqlite.exec(fs.readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));await ensureSchema(DB);return DB}
const sub=(DB,id,trial,paid=null)=>DB.sqlite.prepare('INSERT OR REPLACE INTO subscriptions(company_id,trial_started_at,trial_ends_at,status,paid_until,updated_at) VALUES(?,?,?,?,?,?)').run(id,T()-D,trial,'trial',paid,T());
const sent=[];const realFetch=globalThis.fetch;
const mockTelegram=()=>{sent.length=0;globalThis.fetch=async(url,o)=>{sent.push({method:String(url).split('/').pop(),payload:JSON.parse(o.body)});return Response.json({ok:true,result:{message_id:500+sent.length}})}};
const restore=()=>{globalThis.fetch=realFetch;Date.now=RT};
function book(DB,user,{status='done',endedAgo=3600,outcome,attendance}={}){const s=DB.sqlite.prepare("SELECT id,name FROM services WHERE company_id='nail' LIMIT 1").get(),id='r'+(++seq)+Math.random().toString(36).slice(2,8),end=T()-endedAgo,st=end-3600;
 DB.sqlite.prepare('INSERT INTO bookings(id,company_id,service_id,user_id,name,phone,details,starts_at,ends_at,price,service_name,status,created_at,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'nail',s.id,user,'Анна','+79990000000','',st,end,1000,s.name,status,st-D,'rk-'+id);
 if(outcome)DB.sqlite.prepare('INSERT INTO booking_outcomes(booking_id,outcome,updated_at) VALUES(?,?,?)').run(id,outcome,T());
 if(attendance)DB.sqlite.prepare('INSERT INTO booking_attendance(booking_id,state,responded_at) VALUES(?,?,?)').run(id,attendance,T());return id}
function queueReview(DB,id,user,createdAgo=60){const b=DB.sqlite.prepare('SELECT * FROM bookings WHERE id=?').get(id),c={...DB.sqlite.prepare("SELECT * FROM companies WHERE id='nail'").get(),timezone:defaults.timezone};
 DB.sqlite.prepare('INSERT INTO outbox(id,chat_id,text,created_at) VALUES(?,?,?,?)').run(id+':review-request:e1',user,JSON.stringify(messagePayload(b,c,'review_request',false,null,'ru')),T()-createdAgo)}
const state=(DB,id)=>DB.sqlite.prepare('SELECT sent_at,lease_until FROM outbox WHERE id=?').get(id+':review-request:e1');
// Дневное время по поясу специалиста, чтобы тесты не зависели от часа запуска.
const daytime=()=>{let t=T();while(true){const m=localMinute(t,defaults.timezone);if(m>=12*60&&m<14*60)break;t+=900}Date.now=()=>t*1000;return t};
const nighttime=()=>{let t=T();while(true){const m=localMinute(t,defaults.timezone);if(m>=23*60&&m<23*60+30)break;t+=900}Date.now=()=>t*1000;return t};
const env=DB=>({DB,BOT_TOKEN:'123:test',APP_URL:'https://example.com'});

test('14.4: окна напоминаний о подписке — за 3 дня, последний день, после окончания',()=>{const t=1e9;
 assert.equal(noticeKind(t+8*D,t),null);assert.equal(noticeKind(t+7*D,t),null);assert.equal(noticeKind(t+5*D,t),null);
 assert.equal(noticeKind(t+3*D,t),3);assert.equal(noticeKind(t+2*D,t),3);assert.equal(noticeKind(t+D,t),1);assert.equal(noticeKind(t+3600,t),1);
 assert.equal(noticeKind(t-3600,t),0);assert.equal(noticeKind(t-2*D,t),null)});
test('14.4: дата окончания пишется по поясу специалиста на языке получателя',()=>{
 const ts=Date.parse('2026-10-10T13:30:00Z')/1000;
 assert.match(endStamp(ts,'Asia/Almaty','ru'),/10 октября 2026.*18:30/);
 assert.match(endStamp(ts,'Europe/Moscow','ru'),/16:30/);
 assert.match(endStamp(ts,'Not/AZone','ru'),/13:30/)});
test('14.4: за 3 дня — текст с датой и кнопка «Продлить» ведёт в раздел подписки, повтора нет',async()=>{const DB=await setup();sub(DB,'nail',T()+2.5*D);
 DB.sqlite.prepare("INSERT INTO memberships(company_id,user_id) VALUES('nail','7001')").run();
 await subscriptionNotices({APP_URL:'https://example.com'},DB);await subscriptionNotices({APP_URL:'https://example.com'},DB);
 const rows=DB.sqlite.prepare("SELECT id,text FROM outbox WHERE id LIKE 'subend:%'").all();assert.equal(rows.length,1);assert.match(rows[0].id,/^subend:nail:3:/);
 const p=JSON.parse(rows[0].text);assert.match(p.text,/через 3 дня/);assert.match(p.text,/Дата окончания: <b>\d+ \S+ 2026.*\d\d:\d\d<\/b>/);
 const btn=p.reply_markup.inline_keyboard.at(-1)[0];assert.match(btn.text,/Продлить/);assert.equal(btn.web_app.url,'https://example.com/?view=subscription');assert.equal(subscriptionUrl('https://example.com'),btn.web_app.url)});
test('14.4: в последний день — точная дата и время окончания, затем отдельное сообщение об окончании',async()=>{const DB=await setup();
 const end=T()+6*3600;sub(DB,'nail',end);DB.sqlite.prepare("INSERT INTO memberships(company_id,user_id) VALUES('nail','7001')").run();
 await subscriptionNotices({APP_URL:'https://example.com'},DB);
 const row=DB.sqlite.prepare("SELECT id,text,lease_until FROM outbox WHERE id LIKE 'subend:nail:1:%'").get();assert.ok(row);
 const p=JSON.parse(row.text);assert.match(p.text,/Последний день доступа/);assert.match(p.text,/Доступ закончится <b>.*\d\d:\d\d<\/b>/);assert.ok(p.reply_markup.inline_keyboard[0][0].web_app.url.endsWith('view=subscription'));
 assert.ok(row.lease_until<end,'сообщение последнего дня не откладывается за момент окончания');
 sub(DB,'nail',T()-3600);await subscriptionNotices({APP_URL:'https://example.com'},DB);
 const after=DB.sqlite.prepare("SELECT text FROM outbox WHERE id LIKE 'subend:nail:0:%'").get();assert.match(JSON.parse(after.text).text,/Срок доступа Takt закончился/)});
test('14.4: напоминание не уходит, если подписку уже продлили',async()=>{const DB=await setup();sub(DB,'nail',T()+2.5*D);DB.sqlite.prepare("INSERT INTO memberships(company_id,user_id) VALUES('nail','7001')").run();
 await subscriptionNotices({APP_URL:'https://example.com'},DB);
 DB.sqlite.prepare("UPDATE subscriptions SET paid_until=? WHERE company_id='nail'").run(T()+40*D);
 mockTelegram();try{Date.now=RT;await deliver(env(DB))}finally{restore()}
 assert.equal(sent.filter(x=>x.payload.chat_id==='7001').length,0);
 assert.ok(DB.sqlite.prepare("SELECT sent_at FROM outbox WHERE id LIKE 'subend:%'").get().sent_at)});
test('14.4: напоминание о подписке доходит с кнопкой, пока подписка не продлена',async()=>{const DB=await setup();sub(DB,'nail',T()+2.5*D);DB.sqlite.prepare("INSERT INTO memberships(company_id,user_id) VALUES('nail','7001')").run();
 await subscriptionNotices({APP_URL:'https://example.com'},DB);DB.sqlite.prepare("UPDATE outbox SET lease_until=0").run();
 mockTelegram();try{await deliver(env(DB))}finally{restore()}
 const m=sent.find(x=>x.method==='sendMessage'&&x.payload.chat_id==='7001');assert.ok(m);assert.equal(m.payload.parse_mode,'HTML');assert.equal(m.payload.takt_sub,undefined);assert.ok(m.payload.reply_markup.inline_keyboard[0][0].web_app.url.includes('view=subscription'))});

test('14.4: отзыв просим только у клиента, который пришёл',async()=>{const DB=await setup();
 const ok=book(DB,'7001');queueReview(DB,ok,'7001');
 mockTelegram();try{daytime();await deliver(env(DB))}finally{restore()}
 const m=sent.find(x=>x.method==='sendMessage');assert.ok(m,'завершённый визит — отзыв отправляется');assert.ok(state(DB,ok).sent_at)});
for(const [name,opts,setupFn] of [
 ['неявка',{outcome:'no_show'}],
 ['клиент ответил «не смогу»',{attendance:'not_coming'}],
 ['запись отменена',{status:'cancelled'}],
 ['запись ещё не завершена',{status:'confirmed'}]]){
 test('14.4: отзыв не просим — '+name,async()=>{const DB=await setup();const id=book(DB,'7001',opts);queueReview(DB,id,'7001');
  mockTelegram();try{daytime();await deliver(env(DB))}finally{restore()}
  assert.equal(sent.filter(x=>x.method==='sendMessage').length,0);assert.ok(state(DB,id).sent_at,'сообщение снято из очереди, а не зависло')})}
test('14.4: отзыв не просим, если отзыв уже оставлен или просьба уже была',async()=>{const DB=await setup();
 const a=book(DB,'7001');queueReview(DB,a,'7001');DB.sqlite.prepare("INSERT INTO reviews(booking_id,company_id,user_id,client_name,service_name,rating,text,created_at) VALUES(?,?,?,?,?,?,?,?)").run(a,'nail','7001','Анна','Услуга',5,'',T());
 const b=book(DB,'7002');queueReview(DB,b,'7002');DB.sqlite.prepare('INSERT INTO telegram_review_messages(booking_id,chat_id,message_id,updated_at) VALUES(?,?,?,?)').run(b,'7002',1,T());
 mockTelegram();try{daytime();await deliver(env(DB))}finally{restore()}
 assert.equal(sent.filter(x=>x.method==='sendMessage').length,0)});
test('14.4: просьба об отзыве устаревает через 7 дней',async()=>{const DB=await setup();const id=book(DB,'7001');queueReview(DB,id,'7001',8*D);
 mockTelegram();try{daytime();await deliver(env(DB))}finally{restore()}assert.equal(sent.length,0);assert.ok(state(DB,id).sent_at)});
test('14.4: ночью отзыв ждёт до 09:00 по поясу специалиста',async()=>{const DB=await setup();const id=book(DB,'7001');queueReview(DB,id,'7001');let now;
 mockTelegram();try{now=nighttime();await deliver(env(DB))}finally{restore()}
 assert.equal(sent.filter(x=>x.method==='sendMessage').length,0);const st=state(DB,id);assert.equal(st.sent_at,null);assert.ok(st.lease_until>now&&st.lease_until-now<=11*3600);assert.equal(localMinute(st.lease_until,defaults.timezone),540)});

const visit=(DB,user,daysAgo,opts={})=>book(DB,user,{endedAgo:daysAgo*D,...opts});
test('14.4: «пора записаться снова» считает только состоявшиеся визиты',async()=>{const DB=await setup();
 for(const d of [100,70,40])visit(DB,'7001',d);assert.equal((await rebookTick({APP_URL:'https://x'},DB)).sent,1);
 // подтверждённые, но не отмеченные как «состоялся» записи визитами не считаются
 for(const d of [100,70,40])visit(DB,'7002',d,{status:'confirmed'});assert.equal((await rebookTick({APP_URL:'https://x'},DB)).sent,0);
 // последний визит — неявка: не зовём
 for(const d of [100,70])visit(DB,'7003',d);visit(DB,'7003',30,{outcome:'no_show'});visit(DB,'7003',40);assert.equal((await rebookTick({APP_URL:'https://x'},DB)).sent,0)});
test('14.4: бот открывает раздел подписки по ссылке view=subscription',()=>{
 const js=fs.readFileSync('public/app-v2.js','utf8');assert.match(js,/\['subscription','clients','reviews','share'\]\.includes\(params\.get\('view'\)\)\)S\.page=params\.get\('view'\)/);assert.match(js,/params\.get\('view'\)==='my'\)S\.page='my'/);
 assert.ok(fs.readFileSync('public/index.html','utf8').includes('app-v2.js?v=144'))});

async function consent(DB,id,role){const v=await legalVersions(DB);DB.sqlite.prepare("INSERT OR REPLACE INTO user_app_settings(user_id,language,role,theme,policy_version,consent_version,terms_version,consent_at,updated_at) VALUES(?,'ru',?,'light',?,?,?,1,1)").run(id,role,v.policy,v.consent,v.terms)}
test('14.4: приветствие специалиста — сводка на 24 часа и быстрые кнопки',async()=>{const DB=await setup();DB.sqlite.prepare("INSERT INTO memberships(company_id,user_id) VALUES('nail','7001')").run();await consent(DB,'7001','specialist');
 const s=DB.sqlite.prepare("SELECT id,name FROM services WHERE company_id='nail' LIMIT 1").get(),st=T()+7200;
 DB.sqlite.prepare("INSERT INTO bookings(id,company_id,service_id,user_id,name,phone,details,starts_at,ends_at,price,service_name,status,created_at,request_key) VALUES('g1','nail',?,'7005','Анна','+7','',?,?,1000,?,'pending',?,'rk-g1')").run(s.id,st,st+3600,s.name,T());
 const m=await botEntry({DB,APP_URL:'https://example.com'},'https://example.com','7001');
 assert.match(m.text,/Ближайшие 24 часа: <b>1<\/b>/);assert.match(m.text,/Ждут подтверждения: <b>1<\/b>/);
 assert.match(m.reply_markup.inline_keyboard[0][0].web_app.url,/^https:\/\/example\.com\/?$/);
 const row=m.reply_markup.inline_keyboard[1];assert.match(row[0].web_app.url,/view=calendar/);assert.match(row[1].web_app.url,/view=clients/)});
test('14.4: приветствие клиента — ближайшая запись и кнопка «Мои записи»; без записей приветствие прежнее',async()=>{const DB=await setup();await consent(DB,'7002','client');
 let m=await botEntry({DB,APP_URL:'https://example.com'},'https://example.com','7002',{id:'nail',name:'Студия'});assert.doesNotMatch(m.text,/Ближайшая запись/);
 const s=DB.sqlite.prepare("SELECT id,name FROM services WHERE company_id='nail' LIMIT 1").get(),st=T()+2*D;
 DB.sqlite.prepare("INSERT INTO bookings(id,company_id,service_id,user_id,name,phone,details,starts_at,ends_at,price,service_name,status,created_at,request_key) VALUES('g2','nail',?,'7002','Анна','+7','',?,?,1000,?,'confirmed',?,'rk-g2')").run(s.id,st,st+3600,s.name,T());
 m=await botEntry({DB,APP_URL:'https://example.com'},'https://example.com','7002',{id:'nail',name:'Студия'});
 assert.match(m.text,/Ближайшая запись: <b>.*\d\d:\d\d<\/b>/);assert.match(m.reply_markup.inline_keyboard[1][0].web_app.url,/view=my/);assert.match(m.reply_markup.inline_keyboard[1][0].web_app.url,/company=nail/)});
test('14.4: компактные пустые состояния подключены',()=>{const css=fs.readFileSync('public/takt-v144.css','utf8'),html=fs.readFileSync('public/index.html','utf8'),js=fs.readFileSync('public/app-v2.js','utf8');
 assert.match(html,/takt-v144\.css\?v=144/);assert.match(css,/\.empty-state/);assert.ok(js.includes('empty-ic'));assert.ok(!js.includes("<span class=\"service-placeholder\""),'серой заглушки у услуг без фото больше нет')});
