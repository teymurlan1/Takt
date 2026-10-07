import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from '../scripts/db.mjs';import worker from '../src/worker.js';import {ensureSchema} from '../src/v2.js';
import {subscriptionState,noticeKind,quietUntil,applyReferral,manualExtend,subscriptionNotices,GRACE_DAYS} from '../src/billing140.js';
import {backoff} from '../src/delivery.js';import {specialistAvailable} from '../src/v10.js';
const T=()=>Math.floor(Date.now()/1000),D=86400;
async function setup(){const DB=database();DB.sqlite.exec(fs.readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));await ensureSchema(DB);return DB}
const sub=(DB,id,trial,paid=null)=>DB.sqlite.prepare('INSERT OR REPLACE INTO subscriptions(company_id,trial_started_at,trial_ends_at,status,paid_until,updated_at) VALUES(?,?,?,?,?,?)').run(id,T()-D,trial,'trial',paid,T());
test('14.1: состояния подписки — активна, пробный, льготные дни, закончилась',()=>{const t=1e9;
 assert.equal(subscriptionState({trial_ends_at:t+D,paid_until:null},t).state,'trial');
 assert.equal(subscriptionState({trial_ends_at:t-9*D,paid_until:t+D},t).state,'active');
 const g=subscriptionState({trial_ends_at:t-D,paid_until:null},t);assert.equal(g.state,'grace');assert.equal(g.new_bookings_paused,true);
 assert.equal(subscriptionState({trial_ends_at:t-(GRACE_DAYS+1)*D,paid_until:null},t).state,'expired');assert.equal(subscriptionState(null,t).state,'none')});
test('14.1: окна напоминаний 3 дня / последний день / окончание',()=>{const t=1e9;
 assert.equal(noticeKind(t+8*D,t),null);assert.equal(noticeKind(t+7*D,t),null);assert.equal(noticeKind(t+5*D,t),null);assert.equal(noticeKind(t+3*D,t),3);assert.equal(noticeKind(t+2*D,t),3);assert.equal(noticeKind(t+D,t),1);assert.equal(noticeKind(t+3600,t),1);assert.equal(noticeKind(t-3600,t),0);assert.equal(noticeKind(t-2*D,t),null)});
test('14.1: тихие часы переносят на 09:00 по поясу получателя',()=>{
 const night=Date.parse('2026-10-06T19:30:00Z')/1000; // 00:30 в Asia/Almaty (UTC+5)
 const q=quietUntil(night,'Asia/Almaty');assert.ok(q>night&&q-night<=9*3600);assert.equal(new Date(q*1000).toISOString(),'2026-10-07T04:00:00.000Z');
 const noon=Date.parse('2026-10-06T07:00:00Z')/1000;assert.equal(quietUntil(noon,'Asia/Almaty'),noon);
 const late=Date.parse('2026-10-06T17:30:00Z')/1000; // 22:30 локально → следующее утро
 assert.equal(new Date(quietUntil(late,'Asia/Almaty')*1000).toISOString(),'2026-10-07T04:00:00.000Z')});
test('14.1: пауза повторов растёт, retry_after уважается, потолок сутки',()=>{
 assert.equal(backoff({},1,300),300);assert.equal(backoff({},2,300),600);assert.equal(backoff({},3,300),1200);assert.equal(backoff({parameters:{retry_after:45}},4,300),60);assert.equal(backoff({parameters:{retry_after:900}},1,300),900);assert.equal(backoff({},20,300),86400)});
test('14.1: реферал — оба получают дни, повтор и самореферал отклоняются',async()=>{const DB=await setup();sub(DB,'nail',T()+5*D);sub(DB,'clean',T()+5*D);
 assert.equal((await applyReferral(DB,'nail','nail')).reason,'self');
 const r=await applyReferral(DB,'clean','nail');assert.equal(r.ok,true);
 const end=id=>DB.sqlite.prepare('SELECT trial_ends_at e FROM subscriptions WHERE company_id=?').get(id).e;
 assert.ok(end('clean')>=T()+11.9*D);assert.ok(end('nail')>=T()+11.9*D);
 assert.equal((await applyReferral(DB,'clean','nail')).reason,'already');assert.equal((await applyReferral(DB,'auto','nope')).reason,'unknown');
 assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM payments WHERE status='bonus'").get().n,2)});
test('14.1: ручное продление админом идемпотентно и пишет платёж и аудит',async()=>{const DB=await setup();sub(DB,'nail',T()-D);
 const a=await manualExtend(DB,{company:'nail',days:30,amount:990,actor:'9001',key:'k1'}),b=await manualExtend(DB,{company:'nail',days:30,amount:990,actor:'9001',key:'k1'});
 assert.equal(a.ok,true);assert.equal(b.duplicate,true);
 const s=DB.sqlite.prepare('SELECT * FROM subscriptions WHERE company_id=?').get('nail');assert.ok(s.trial_ends_at>=T()+29*D&&s.trial_ends_at<=T()+31*D);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM payments').get().n,1);assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='subscription.manual_extend'").get().n,1);
 assert.equal((await manualExtend(DB,{company:'nail',days:0,actor:'1'})).reason,'days')});
test('14.1: напоминание об окончании ставится один раз на получателя',async()=>{const DB=await setup();sub(DB,'nail',T()+2*D);
 DB.sqlite.prepare("INSERT INTO memberships(company_id,user_id) VALUES('nail','7001')").run();
 await subscriptionNotices({APP_URL:'https://example.com'},DB);await subscriptionNotices({APP_URL:'https://example.com'},DB);
 const rows=DB.sqlite.prepare("SELECT id,text FROM outbox WHERE id LIKE 'subend:%'").all();assert.equal(rows.length,1);assert.match(rows[0].id,/^subend:nail:3:/);assert.match(JSON.parse(rows[0].text).text,/через 3 дня/)});
test('14.1: блокировка новых записей после окончания включается флагом и по умолчанию выключена',async()=>{const DB=await setup();sub(DB,'nail',T()-5*D);
 await specialistAvailable(DB,'nail');
 DB.sqlite.prepare("INSERT INTO service_config(key,value,updated_at,updated_by) VALUES('billing_enforce','1',1,'t')").run();
 await assert.rejects(()=>specialistAvailable(DB,'nail'),/на паузе|приостановлен/);
 sub(DB,'nail',T()+5*D);await specialistAvailable(DB,'nail')});
test('14.1: админ-API «Не доставлено» и тикеты доступны только по ролям',async()=>{const DB=await setup();const env={DB,DEV_MODE:'true',SUPERADMIN_IDS:'9001',ADMIN_ID:'9001'};
 DB.sqlite.exec("INSERT INTO outbox(id,chat_id,text,attempts,created_at) VALUES('reminder:x:1','5','{}',5,"+T()+");INSERT INTO delivery_state VALUES('reminder:x:1','blocked',"+T()+")");
 const call=(role,path)=>worker.fetch(new Request('http://localhost'+path,{headers:{'x-demo-role':role}}),env);
 assert.equal((await call('client','/api/v140/admin/undelivered')).status,403);
 const ok=await call('owner','/api/v140/admin/undelivered');assert.equal(ok.status,200);const d=await ok.json();assert.equal(d.items[0].state,'blocked');assert.match(d.items[0].reason,/заблокировал/);assert.equal(d.items[0].kind,'reminder');assert.ok(!('text' in d.items[0]));
 assert.equal((await call('client','/api/v140/admin/tickets')).status,403);assert.equal((await call('owner','/api/v140/admin/tickets')).status,200)});
test('14.1: миграция аддитивная, версия схемы и конфиг',()=>{const m=fs.readFileSync('migrations/0014_takt_v141.sql','utf8');assert.ok(!/DROP|DELETE|ALTER/i.test(m));assert.ok(!/CREATE TABLE(?! IF NOT EXISTS)/.test(m))});
