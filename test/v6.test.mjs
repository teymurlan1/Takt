import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {database} from '../scripts/db.mjs';
import worker,{deliver} from '../src/worker.js';
import {fromLocal,localDate,dateShift} from '../src/v3.js';

function setup(){
  const DB=database();
  DB.sqlite.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  DB.sqlite.exec("INSERT INTO memberships VALUES('nail','9002')");
  const env={DB,DEV_MODE:'true',SUPERADMIN_IDS:'9001',BOT_TOKEN:'fake',APP_URL:'https://example.com'};
  const req=async(path,method='GET',data,role='company')=>{const r=await worker.fetch(new Request('http://localhost/api'+path,{method,headers:{'x-demo-role':role,'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);return {status:r.status,data:await r.json()}};
  return {DB,env,req};
}
async function configure(t,extra={}){const c=(await t.req('/companies/nail')).data;const r=await t.req('/v2/settings','POST',{...c,company_id:'nail',min_notice:0,schedule:Array(7).fill([{start:0,end:1440}]),...extra});assert.equal(r.status,200,JSON.stringify(r.data));return (await t.req('/companies/nail')).data}
async function book(t,start){const r=await t.req('/bookings','POST',{company_id:'nail',service_id:'nail-1',starts_at:start,name:'Клиент',phone:'+79991234567',request_key:crypto.randomUUID()},'client');assert.equal(r.status,201,JSON.stringify(r.data));return r.data}
const alignedAfter=seconds=>Math.ceil((Date.now()/1000+seconds)/900)*900;

test('Takt 6 trial is specialist-only and location instructions are public business data',async()=>{
  const t=setup(),c=await configure(t,{venue_name:'Beauty Room',floor:'2 этаж',room:'205',entrance:'Вход со двора',directions:'Рядом с кофейней',map_url:'https://maps.example/room'});
  assert.equal(c.subscription.status,'trial');assert.equal(c.subscription.price,590);assert.equal(c.subscription.trial_days,7);assert.ok(c.subscription.days_left>=6);
  const pub=(await t.req('/v2/page/nail','GET',null,'client')).data;
  assert.equal(pub.subscription,undefined);assert.equal(pub.venue_name,'Beauty Room');assert.equal(pub.floor,'2 этаж');assert.equal(pub.room,'205');assert.equal(pub.directions,'Рядом с кофейней');assert.equal(pub.map_url,'https://maps.example/room');
  assert.equal((await t.req('/v6/subscription?company=nail','GET',null,'client')).status,403);
});

test('client attendance confirmation is isolated and visible to specialist',async()=>{
  const t=setup();await configure(t,{cancel_hours:24});const b=await book(t,alignedAfter(3*86400));
  const yes=await t.req('/v6/attendance','POST',{booking_id:b.id,state:'coming'},'client');assert.equal(yes.status,200);assert.equal(yes.data.attendance_state,'coming');
  assert.equal((await t.req('/v6/attendance','POST',{booking_id:b.id,state:'not_coming'},'company')).status,403);
  const rows=(await t.req('/bookings?scope=company&company=nail')).data;assert.equal(rows.find(x=>x.id===b.id).attendance_state,'coming');
});

test('early decline cancels and late decline only warns specialist',async()=>{
  const t=setup();await configure(t,{cancel_hours:24});
  const early=await book(t,alignedAfter(3*86400));const no1=await t.req('/v6/attendance','POST',{booking_id:early.id,state:'not_coming'},'client');assert.equal(no1.status,200);assert.equal(no1.data.late,false);assert.equal(no1.data.booking_status,'cancelled');
  const late=await book(t,alignedAfter(2*3600));const no2=await t.req('/v6/attendance','POST',{booking_id:late.id,state:'not_coming'},'client');assert.equal(no2.status,200);assert.equal(no2.data.late,true);assert.equal(no2.data.booking_status,'pending');
  const rows=(await t.req('/bookings?scope=company&company=nail')).data;const row=rows.find(x=>x.id===late.id);assert.equal(row.status,'pending');assert.equal(row.attendance_state,'not_coming');
});

test('24h reminder asks client to confirm attendance with Telegram buttons',async()=>{
  const t=setup();await configure(t,{cancel_hours:24});const start=alignedAfter(3*86400),b=await book(t,start),real=Date.now,original=globalThis.fetch,calls=[];
  globalThis.fetch=async(_u,o)=>{calls.push(JSON.parse(o.body));return Response.json({ok:true})};
  try{Date.now=()=> (start-86400)*1000;await deliver(t.env);const msg=calls.find(x=>String(x.chat_id)==='9003'&&x.text.includes('Подтвердите визит'));assert.ok(msg);const flat=msg.reply_markup.inline_keyboard.flat();assert.ok(flat.some(x=>x.callback_data===`visit:${b.id}:yes`));assert.ok(flat.some(x=>x.callback_data===`visit:${b.id}:no`));assert.ok(flat.some(x=>x.text.includes('Перенести')))}finally{Date.now=real;globalThis.fetch=original}
});
