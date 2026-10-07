import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from '../scripts/db.mjs';import worker from '../src/worker.js';import {ensureSchema} from '../src/v2.js';
import {prefOn,setPref,getPrefs,PREF_KEYS} from '../src/schema150.js';import {dashboardSummary} from '../src/v150.js';import {deliverMessages} from '../src/delivery.js';import {COMMANDS_I18N} from '../src/v140.js';
const T=()=>Math.floor(Date.now()/1000),D=86400;let seq=0;
async function setup(){const DB=database();DB.sqlite.exec(fs.readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));await ensureSchema(DB);return DB}
const svc=DB=>DB.sqlite.prepare("SELECT id,name FROM services WHERE company_id='nail' LIMIT 1").get();
function book(DB,user,days,{status='confirmed',outcome}={}){const s=svc(DB),id='b'+(++seq)+Math.random().toString(36).slice(2,7),st=T()+Math.round(days*D)+seq*7200;DB.sqlite.prepare('INSERT INTO bookings(id,company_id,service_id,user_id,name,phone,details,starts_at,ends_at,price,service_name,status,created_at,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'nail',s.id,user,'Анна','+7999','',st,st+3600,1000,s.name,status,T(),'rk-'+id);if(outcome)DB.sqlite.prepare('INSERT INTO booking_outcomes(booking_id,outcome,updated_at) VALUES(?,?,?)').run(id,outcome,T());return id}
test('15.0: настройки клиента — по умолчанию всё включено, переключение и проверка ключей',async()=>{const DB=await setup();
 for(const k of PREF_KEYS)assert.equal(await prefOn(DB,'7001',k),true);assert.equal(await prefOn(DB,'7001','unknown_key'),true);
 assert.equal(await setPref(DB,'7001','reminder_2h',false),true);assert.equal(await setPref(DB,'7001','nope',false),false);
 assert.equal(await prefOn(DB,'7001','reminder_2h'),false);assert.equal(await prefOn(DB,'7001','reminder_24h'),true);assert.equal(await prefOn(DB,'7002','reminder_2h'),true);
 assert.equal((await getPrefs(DB,'7001')).reminder_2h,false);await setPref(DB,'7001','reminder_2h',true);assert.equal(await prefOn(DB,'7001','reminder_2h'),true)});
test('15.0: выключенное клиентом напоминание не отправляется, остальные сообщения идут',async()=>{const DB=await setup();const env={DB,BOT_TOKEN:'fake'};const sent=[];const orig=globalThis.fetch;globalThis.fetch=async(u,o)=>{sent.push(JSON.parse(o.body));return Response.json({ok:true,result:{message_id:1}})};
 try{await setPref(DB,'7001','reminder_2h',false);
  const row=(id,chat,event)=>DB.sqlite.prepare('INSERT INTO outbox(id,chat_id,text,created_at) VALUES(?,?,?,?)').run(id,chat,JSON.stringify({text:'Напоминание',takt:{booking:'none',company:'nail',start:1,event,admin:false,lang:'ru'}}),T());
  row('x:1','7001','client_2h');
  const deps={ensureSchema,company:async()=>({id:'nail',timezone:'Europe/Moscow',notifications:{}}),enrichCompany:async c=>c,queue:async()=>{}};
  await deliverMessages(env,deps);
  const r=DB.sqlite.prepare("SELECT sent_at FROM outbox WHERE id='x:1'").get();assert.ok(r.sent_at,'помечено обработанным');assert.equal(sent.filter(m=>String(m.chat_id)==='7001').length,0,'в Telegram не ушло');
  DB.sqlite.prepare("INSERT INTO outbox(id,chat_id,text,created_at) VALUES('plain:1','7001','Подтверждение записи',?)").run(T());await deliverMessages(env,deps);
  assert.equal(sent.filter(m=>String(m.chat_id)==='7001').length,1,'обычные сообщения не блокируются')}finally{globalThis.fetch=orig}});
test('15.0: «Требует внимания» — подтверждения, риск неявки, давно не приходили, подписка',async()=>{const DB=await setup();
 book(DB,'7001',-90);book(DB,'7001',-60);book(DB,'7002',-20,{outcome:'no_show'});book(DB,'7002',-15,{outcome:'no_show'});book(DB,'7002',3);book(DB,'7003',0.2,{status:'pending'});
 DB.sqlite.prepare('INSERT OR REPLACE INTO subscriptions(company_id,trial_started_at,trial_ends_at,status,paid_until,updated_at) VALUES(?,?,?,?,?,?)').run('nail',T()-30*D,T()-D,'trial',null,T());
 DB.sqlite.prepare("INSERT INTO waitlist(id,company_id,service_id,user_id,date,created_at) VALUES('w1','nail',?,?,?,?)").run(svc(DB).id,'7005','2099-01-01',T());
 const d=await dashboardSummary(DB,'nail',{company:async()=>({id:'nail',timezone:'Europe/Moscow'}),enrichService:async x=>x,availableSlots:async()=>[1,2,3]});
 assert.equal(d.pending,1);assert.equal(d.risky,1);assert.equal(d.overdue_clients,1);assert.equal(d.waiting,1);assert.equal(d.free_today,3);assert.equal(d.subscription.state,'grace');assert.equal(d.checklist.total,4);assert.ok(d.next_24h>=1);
 const d2=await dashboardSummary(DB,'nail',{});assert.equal(d2.free_today,null)});
test('15.0: API — права, настройки клиента, главный экран',async()=>{const DB=await setup();const env={DB,DEV_MODE:'true',SUPERADMIN_IDS:'9001',ADMIN_ID:'9001'};
 const call=(role,path,body)=>worker.fetch(new Request('http://localhost'+path,{method:body?'POST':'GET',headers:{'x-demo-role':role,'content-type':'application/json'},body:body?JSON.stringify(body):undefined}),env);
 assert.equal((await call('client','/api/v150/dashboard?company=nail')).status,403);
 const p=await call('client','/api/v150/prefs');assert.equal(p.status,200);assert.equal((await p.json()).review,true);
 const s=await call('client','/api/v150/prefs',{key:'review',value:false});assert.equal((await s.json()).review,false);assert.equal((await call('client','/api/v150/prefs',{key:'hack',value:false})).status,400);assert.equal((await (await call('client','/api/v150/prefs')).json()).review,false)});
test('15.0: команды бота локализованы, версия и миграции',async()=>{
 for(const l of ['kk','az','uz']){assert.deepEqual(COMMANDS_I18N[l].map(c=>c.command),['start','help','support','id']);for(const c of COMMANDS_I18N[l])assert.ok(c.description.length>=3&&c.description.length<=256)}
 const r=await worker.fetch(new Request('http://localhost/api/health'),{DB:database()});assert.equal((await r.json()).version,'15.1.1');assert.equal(JSON.parse(fs.readFileSync('package.json','utf8')).version,'15.1.1')});
test('15.0: записи клиента содержат адрес и телефон специалиста для карточки',async()=>{const src=fs.readFileSync('src/worker.js','utf8');assert.ok(src.includes('c.address AS company_address')&&src.includes('c.phone AS company_phone'))});
test('15.0: миграция настроек клиента аддитивная и совпадает со схемой',()=>{const m=fs.readFileSync('migrations/0017_takt_v150.sql','utf8');assert.ok(!/DROP|DELETE|ALTER/i.test(m));assert.ok(!/CREATE TABLE(?! IF NOT EXISTS)/.test(m));for(const k of PREF_KEYS)assert.ok(m.includes(k))});
