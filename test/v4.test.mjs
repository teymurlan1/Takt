import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {database} from '../scripts/db.mjs';
import worker,{deliver} from '../src/worker.js';
import {localDate,dateShift,fromLocal} from '../src/v3.js';
async function setup(extra={}){
 const DB=database();DB.sqlite.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));DB.sqlite.exec("INSERT INTO memberships VALUES('nail','9002')");
 const env={DB,DEV_MODE:'true',BOT_TOKEN:'test-only',APP_URL:'https://example.com'};
 const req=async(path,method='GET',data,role='company')=>{const r=await worker.fetch(new Request('http://localhost/api'+path,{method,headers:{'x-demo-role':role,'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);return {status:r.status,data:await r.json()}};
 const c=(await req('/companies/nail')).data;assert.equal((await req('/v2/settings','POST',{...c,company_id:'nail',min_notice:0,schedule:Array(7).fill([{start:0,end:1440}]),...extra})).status,200);
 const book=(at,extra={},role='client')=>req('/bookings','POST',{company_id:'nail',service_id:'nail-1',starts_at:at,name:'Александр',phone:'+79991234567',request_key:crypto.randomUUID(),...extra},role);
 return {DB,env,req,book};
}
test('availability calendar reflects blocked days and contact data stays scoped',async()=>{
 const t=await setup(),date=dateShift(localDate(),2),at=fromLocal(date,600),b=await t.book(at);assert.equal(b.status,201);
 const r=await t.req('/availability?company=nail&service=nail-1&date='+date+'&days=3');assert.equal(r.status,200);assert.equal(r.data.length,3);assert.deepEqual(Object.keys(r.data[0]).sort(),['count','date','first']);
 assert.equal((await t.req('/v2/blocks','POST',{company_id:'nail',starts_at:fromLocal(dateShift(date,1),0),ends_at:fromLocal(dateShift(date,2),0),label:'Выходной'})).status,200);
 const closed=(await t.req('/availability?company=nail&service=nail-1&date='+date+'&days=3')).data;assert.equal(closed[1].count,0);assert.ok(closed[2].count>0);
 assert.equal((await t.req('/v4/contact?company=nail','GET',null,'client')).data.phone,'+79991234567');assert.deepEqual((await t.req('/v4/contact?company=auto','GET',null,'client')).data,{});assert.deepEqual((await t.req('/v4/contact?company=nail')).data,{});
 assert.equal((await t.req('/availability?company=nail&service=nail-1&date='+date+'&booking='+b.data.id,'GET',null,'owner')).status,403);
});
test('manual booking preserves a known client identity and rejects unknown tenant clients',async()=>{
 const t=await setup(),at=fromLocal(dateShift(localDate(),2),600);await t.book(at);
 const b=await t.book(at+7200,{manual:true,client_id:'9003'},'company');assert.equal(b.status,201);assert.equal(b.data.user_id,'9003');
 assert.equal((await t.book(at+14400,{manual:true,client_id:'9001'},'company')).status,403);
 assert.equal((await t.req('/bookings','GET',null,'client')).data.length,2);
});
test('master one-hour reminder is optional, unique and invalidated by cancellation',async()=>{
 const t=await setup({notifications:{master_reminder:true}}),at=Math.ceil((Date.now()/1000+1200)/900)*900;const b=await t.book(at);assert.equal(b.status,201);
 const original=fetch,calls=[];globalThis.fetch=async(u,o)=>{calls.push(JSON.parse(o.body));return Response.json({ok:true})};
 try{await deliver(t.env);await deliver(t.env);const reminders=calls.filter(x=>x.text.includes('Скоро следующий клиент'));assert.equal(reminders.length,1);assert.equal(reminders[0].chat_id,'9002');assert.equal(calls.filter(x=>x.text.includes('Напоминаем')).length,1);await t.req('/bookings/'+b.data.id,'PATCH',{status:'cancelled'},'client');await deliver(t.env);assert.equal(calls.filter(x=>x.text.includes('Скоро следующий клиент')).length,1)}finally{globalThis.fetch=original}
});
test('ambiguous Telegram timeout is not resent, explicit rate limit is retried',async()=>{
 const t=await setup(),original=fetch;let calls=0;
 const insert=id=>t.DB.sqlite.prepare('INSERT INTO outbox(id,chat_id,text,created_at) VALUES(?,?,?,?)').run(id,'9002',JSON.stringify({text:'Проверка'}),Math.floor(Date.now()/1000));
 try{insert('ambiguous');globalThis.fetch=async()=>{calls++;throw Error('network timeout')};await deliver(t.env);await deliver(t.env);assert.equal(calls,1);assert.equal(t.DB.sqlite.prepare("SELECT state FROM delivery_state WHERE id='ambiguous'").get().state,'unknown');
 insert('rate-limited');globalThis.fetch=async()=>{calls++;return Response.json({ok:false,error_code:429,parameters:{retry_after:60}})};await deliver(t.env);assert.equal(calls,2);await deliver(t.env);assert.equal(calls,2);t.DB.sqlite.exec("UPDATE outbox SET lease_until=0 WHERE id='rate-limited'");globalThis.fetch=async()=>{calls++;return Response.json({ok:true})};await deliver(t.env);await deliver(t.env);assert.equal(calls,3);assert.equal(t.DB.sqlite.prepare("SELECT state FROM delivery_state WHERE id='rate-limited'").get().state,'sent');
 }finally{globalThis.fetch=original}
});
test('parallel dispatch claims only one send and delivery reporting is tenant protected',async()=>{
 const t=await setup(),original=fetch;let calls=0;t.DB.sqlite.prepare('INSERT INTO outbox(id,chat_id,text,created_at) VALUES(?,?,?,?)').run('parallel','9002','Проверка',1);
 globalThis.fetch=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return Response.json({ok:true})};
 try{await Promise.all([deliver(t.env),deliver(t.env)]);assert.equal(calls,1);assert.equal((await t.req('/v4/delivery?company=auto')).status,403);assert.equal((await t.req('/v4/delivery?company=nail','GET',null,'client')).status,403);assert.equal((await t.req('/v4/delivery?company=nail')).status,200)}finally{globalThis.fetch=original}
});

test('manual retry keys cannot expose a client booking from another specialist',async()=>{
 const t=await setup(),at=fromLocal(dateShift(localDate(),2),600);await t.book(at);
 const key=crypto.randomUUID(),other=await t.req('/bookings','POST',{company_id:'auto',service_id:'auto-1',starts_at:at,name:'Александр',phone:'+79991234567',details:'Автомобиль, диагностика',request_key:key},'client');assert.equal(other.status,201);
 const retry=await t.book(at+10800,{manual:true,client_id:'9003',request_key:key},'company');assert.equal(retry.status,409);assert.equal(retry.data.id,undefined);assert.equal(retry.data.company_id,undefined);
});
