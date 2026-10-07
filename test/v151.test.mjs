import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from '../scripts/db.mjs';import worker from '../src/worker.js';
import {freezeClock} from '../scripts/fake-clock.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
async function setup(){const DB=database();DB.sqlite.exec(read('migrations/0001_initial.sql'));DB.sqlite.exec("INSERT INTO memberships VALUES('nail','9002')");
 const env={DB,DEV_MODE:'true',SUPERADMIN_IDS:'9001',ADMIN_ID:'9001',BOT_TOKEN:'fake',APP_URL:'https://example.com'};
 const raw=(path,method='GET',data,headers={},e=env)=>worker.fetch(new Request('http://localhost/api'+path,{method,headers:{'content-type':'application/json',...headers},...(data?{body:JSON.stringify(data)}:{})}),e);
 const req=async(path,method='GET',data,role='client')=>{const r=await raw(path,method,data,{'x-demo-role':role});let d=null;try{d=await r.json()}catch{}return {status:r.status,data:d}};
 return {DB,env,raw,req}}

// --- Блок 1: кэш статики — единая версия, чтобы в Telegram не оставался старый код ---
test('15.1: все подключения файлов используют одну версию кэша (нет «застрявших» ?v=120)',()=>{
 const html=read('public/index.html'),want=/\?v=151/;const idx=[...html.matchAll(/(?:src|href)="\/[^"]+\?v=(\d+)"/g)].map(m=>m[1]);
 assert.ok(idx.length>20);assert.deepEqual([...new Set(idx)],['151']);
 for(const f of fs.readdirSync(new URL('../public/',import.meta.url)).filter(x=>x.endsWith('.js')&&x!=='app.js')){
  const s=read('public/'+f);for(const m of s.matchAll(/from '(\.\/[^']+\.js)(\?v=\d+)?'/g))assert.ok(m[2]==='?v=151',f+' → '+m[1]+(m[2]||' (без версии)'));
 }
 assert.equal(JSON.parse(read('package.json')).version,'15.1.1');assert.ok(read('src/worker.js').includes("version:'15.1.1'"))});

// --- Блок 1: матрица ролей ---
const ADMIN_ONLY=[['GET','/v10/admin/specialists'],['GET','/v10/admin/users'],['GET','/v10/admin/audit'],['GET','/v10/admin/config'],['POST','/v10/admin/broadcast/preview',{}],['POST','/v10/admin/broadcast/send',{}],
 ['GET','/v140/admin/billing'],['POST','/v140/admin/billing',{enforce:true}],['GET','/v140/admin/payments'],['GET','/v140/admin/tickets'],['GET','/v140/admin/undelivered'],['GET','/v140/admin/bot'],['GET','/v140/admin/bot-texts'],
 ['POST','/v140/admin/bot-texts',{}],['POST','/v140/admin/bot-texts/rollback',{}],['POST','/v140/admin/portfolio-limit',{limit:30}],['GET','/v5/admin'],['GET','/v8/subscription-stats'],['POST','/v11/admin/subscription',{}],['GET','/v11/funnel']];
test('15.1: служебные маршруты закрыты для клиента, специалиста и анонима',async()=>{const t=await setup();const bad=[];
 for(const [m,p,d] of ADMIN_ONLY){
  for(const role of ['client','company']){const r=await t.req(p,m,d,role);if(![401,403,404].includes(r.status))bad.push(`${role} ${m} ${p} → ${r.status}`)}
  const prod={...t.env,DEV_MODE:'false'};const r=await t.raw(p,m,d,{},prod);if(![401,403,404].includes(r.status))bad.push(`anon ${m} ${p} → ${r.status}`)}
 assert.deepEqual(bad,[])});
test('15.1: маршруты существуют — владелец получает 200, а не пустой 404',async()=>{const t=await setup();
 for(const p of ['/v10/admin/specialists','/v10/admin/users','/v10/admin/audit','/v10/admin/config','/v140/admin/payments','/v140/admin/tickets','/v140/admin/undelivered','/v140/admin/bot-texts','/v5/admin'])assert.equal((await t.req(p,'GET',null,'owner')).status,200,p);
 const b=await t.req('/v140/admin/billing','POST',{enforce:false},'owner');assert.equal(b.status,200,JSON.stringify(b.data))});
test('15.1: владельцу служебные маршруты отвечают без 500',async()=>{const t=await setup();const bad=[];
 for(const [m,p,d] of ADMIN_ONLY.filter(x=>x[0]==='GET')){const r=await t.req(p,m,d,'owner');if(r.status>=500)bad.push(`${m} ${p} → ${r.status}`)}assert.deepEqual(bad,[])});
test('15.1: старая веб-форма поддержки отключена, health без секретов',async()=>{const t=await setup();assert.equal((await t.req('/v72/support','POST',{message:'x'})).status,410);
 const h=await t.req('/health');assert.equal(h.status,200);assert.deepEqual(Object.keys(h.data).sort(),['ok','version'])});

// --- Блок 1: приватность клиента ---
test('15.1: клиент не может перечислить специалистов; связь только по приглашению',async()=>{const t=await setup();
 assert.deepEqual((await t.req('/companies','GET',null,'client')).data,[]);
 for(const p of ['/memberships','/search','/v2/search','/catalog'])assert.ok([404,403].includes((await t.req(p,'GET',null,'client')).status),p);
 const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10),slots=(await t.req('/slots?company=nail&service=nail-1&date='+day)).data;
 const b=await t.req('/bookings','POST',{company_id:'nail',service_id:'nail-1',starts_at:slots[0],name:'Анна',phone:'+79990000001',request_key:crypto.randomUUID()},'client');assert.equal(b.status,201,JSON.stringify(b.data));
 assert.equal((await t.req('/v2/context','POST',{company_id:'nail'},'client')).status,200);
 assert.deepEqual((await t.req('/companies','GET',null,'client')).data,[],'после записи перечня специалистов у клиента всё равно нет');
 assert.deepEqual((await t.req('/v2/context','GET',null,'client')).data,{company_id:'nail'});
 assert.equal((await t.req('/v2/context','POST',{company_id:'no-such'},'client')).status>=400,true)});
test('15.1: специалист не видит чужой кабинет и чужих клиентов',async()=>{const t=await setup();
 for(const p of ['/v2/clients?company=auto','/v2/analytics?company=auto&period=30','/v4/delivery?company=auto','/v150/dashboard?company=auto','/v140/tools?company=auto'])assert.ok([400,403,404].includes((await t.req(p,'GET',null,'company')).status),p);
 assert.deepEqual((await t.req('/bookings?company=auto','GET',null,'company')).data,[])});

// --- Блок 1: карточка записи и повтор загрузки ---
import {heroKey,retryHtml,nextBooking} from '../public/v150.js';import {C150} from '../public/copy150.js';
test('15.1: ключ карточки записи меняется при переносе, отмене и ходе времени (карточка не «залипает»)',()=>{
 const restore=freezeClock(),now=Date.now()/1000,b={id:'b1',starts_at:now+7200,status:'confirmed'};
 try{const k=heroKey(b,'ru');assert.equal(heroKey({...b},'ru'),k);assert.notEqual(heroKey({...b,starts_at:now+9000},'ru'),k);assert.notEqual(heroKey({...b,status:'pending'},'ru'),k);
  assert.notEqual(heroKey(b,'kk'),k);assert.equal(nextBooking([{...b,status:'cancelled'}],now),null);
  assert.equal(nextBooking([b,{...b,id:'b0',starts_at:now+3600}],now).id,'b0')}finally{restore()}});
test('15.1: «Повторить» при сбое загрузки есть на 4 языках; ключи переводов совпадают',()=>{
 const ref=Object.keys(C150.ru).sort();for(const l of ['kk','az','uz']){assert.deepEqual(Object.keys(C150[l]).sort(),ref,l);}
 for(const l of ['ru','kk','az','uz']){const h=retryHtml(l,'dash');assert.ok(h.includes('data-h150="retry"')&&h.includes('role="status"'));assert.ok(C150[l].retry&&C150[l].load_err)}
 assert.ok(!retryHtml('ru','<x>').includes('<x>'))});

// --- Блок 2: календарь ---
import {blocksForDay} from '../public/schedule151.js';
test('15.1: выходной на целый день не «протекает» на следующий день; многодневный отпуск виден во все дни',()=>{
 const day=t=>new Date(t*1000).toISOString().slice(0,10),at=(d,h=0)=>Date.parse(d+'T00:00:00Z')/1000+h*3600;
 const off={id:'a',starts_at:at('2026-10-10'),ends_at:at('2026-10-11')};
 assert.equal(blocksForDay([off],'2026-10-10',day).length,1);assert.equal(blocksForDay([off],'2026-10-11',day).length,0);assert.equal(blocksForDay([off],'2026-10-09',day).length,0);
 const vac={id:'v',starts_at:at('2026-10-12'),ends_at:at('2026-10-15')};
 assert.deepEqual(['11','12','13','14','15'].map(n=>blocksForDay([vac],'2026-10-'+n,day).length),[0,1,1,1,0]);
 const part={id:'p',starts_at:at('2026-10-10',13),ends_at:at('2026-10-10',14)};assert.equal(blocksForDay([part],'2026-10-10',day).length,1);assert.equal(blocksForDay([part],'2026-10-11',day).length,0);
 assert.deepEqual(blocksForDay(undefined,'2026-10-10',day),[])});

// --- Блок 7: цепочка жизни записи ---
import {deliver} from '../src/worker.js';import {fromLocal,dateShift,localDate} from '../src/v3.js';
test('15.1: цепочка запись → напоминания → перенос → отмена → завершение → отзыв',async()=>{
 const restore=freezeClock(),original=globalThis.fetch,calls=[];
 try{const t=await setup(),c=(await t.req('/companies/nail','GET',null,'company')).data;
  assert.equal((await t.req('/v2/settings','POST',{...c,company_id:'nail',min_notice:0,cancel_hours:0,allow_reschedule:true,schedule:Array(7).fill([{start:0,end:1440}]),notifications:{...c.notifications,daily_summary:false}},'company')).status,200);
  globalThis.fetch=async(u,o)=>{calls.push(JSON.parse(o.body));return Response.json({ok:true,result:{message_id:1}})};
  const start=fromLocal(dateShift(localDate(),3),900),later=fromLocal(dateShift(localDate(),4),600);
  const book=(at)=>t.req('/bookings','POST',{company_id:'nail',service_id:'nail-1',starts_at:at,name:'Анна',phone:'+79990000001',request_key:crypto.randomUUID()},'client');
  // 1. запись и подтверждения
  const b=await book(start);assert.equal(b.status,201,JSON.stringify(b.data));await deliver(t.env);
  const to=id=>calls.filter(x=>String(x.chat_id)===id).length;assert.ok(to('9003')>=1,'клиент получил подтверждение');assert.ok(to('9002')>=1,'специалист получил уведомление');
  // 2. напоминание за 24 часа — ровно одно, даже при повторных запусках
  const real=Date.now;Date.now=()=>(start-86400)*1000;await deliver(t.env);await deliver(t.env);
  assert.equal(calls.filter(x=>String(x.chat_id)==='9003'&&x.text.includes('Напоминаем о записи')).length,1);
  // 3. перенос: запись переходит на новое время, старое напоминание не уходит
  Date.now=real;const mv=await t.req('/v2/reschedule','POST',{id:b.data.id,starts_at:later},'client');assert.equal(mv.status,200,JSON.stringify(mv.data));
  const row=()=>t.DB.sqlite.prepare('SELECT status,starts_at FROM bookings WHERE id=?').get(b.data.id);assert.equal(row().starts_at,later);
  assert.equal(t.DB.sqlite.prepare("SELECT COUNT(*) n FROM outbox WHERE id LIKE ? AND sent_at IS NULL").get(b.data.id+':reminder%').n,0,'неотправленные напоминания старого времени удалены');
  const sentBefore=calls.length;await deliver(t.env);assert.ok(calls.length>sentBefore,'сообщение о переносе отправлено');
  // 4. отмена: освобождает слот, повторная отмена безопасна
  const cancel=await t.req('/bookings/'+b.data.id,'PATCH',{status:'cancelled'},'client');assert.equal(cancel.status,200,JSON.stringify(cancel.data));assert.equal(row().status,'cancelled');
  await deliver(t.env);assert.ok(calls.some(x=>/отмен/i.test(x.text)),'сообщение об отмене отправлено');
  const again=await t.req('/bookings/'+b.data.id,'PATCH',{status:'cancelled'},'client');assert.ok(again.status<500);
  // 5. освободившееся время снова доступно, новая запись, завершение специалистом
  const b2=await book(later);assert.equal(b2.status,201,JSON.stringify(b2.data));
  assert.equal((await t.req('/bookings/'+b2.data.id,'PATCH',{status:'confirmed'},'company')).status,200);
  assert.equal((await t.req('/bookings/'+b2.data.id,'PATCH',{status:'done'},'company')).status,200);
  // 6. отзыв: только после завершения, один на запись
  Date.now=()=>(later+7200)*1000; // визит состоялся: часы идут дальше
  assert.ok((await t.req('/v7/reviews','POST',{booking_id:b.data.id,rating:5,text:'x'},'client')).status>=400,'на отменённую запись отзыв нельзя');
  const rv=await t.req('/v7/reviews','POST',{booking_id:b2.data.id,rating:5,text:'Отлично'},'client');assert.equal(rv.status,201,JSON.stringify(rv.data));
  assert.ok((await t.req('/v7/reviews','POST',{booking_id:b2.data.id,rating:1,text:'повтор'},'client')).status>=400||t.DB.sqlite.prepare('SELECT COUNT(*) n FROM reviews WHERE booking_id=?').get(b2.data.id).n===1);
  assert.equal(t.DB.sqlite.prepare('SELECT COUNT(*) n FROM reviews WHERE booking_id=?').get(b2.data.id).n,1);
 }finally{globalThis.fetch=original;restore()}});
