import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from '../scripts/db.mjs';import worker from '../src/worker.js';import {ensureSchema} from '../src/v2.js';
async function setup(){const DB=database();DB.sqlite.exec(fs.readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 const env={DB,DEV_MODE:'true',SUPERADMIN_IDS:'9001',ADMIN_ID:'9001',BOT_TOKEN:'fake',APP_URL:'https://example.com'};
 const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,o)=>{calls.push({method:String(url).split('/').pop(),payload:JSON.parse(o.body)});return Response.json({ok:true,result:true})};
 let uid=1;
 return {env,calls,restore:()=>{globalThis.fetch=original},uid:()=>uid++};}
async function boot(){const t=await setup();await worker.fetch(new Request('http://localhost/api/telegram/setup',{method:'POST',headers:{'x-demo-role':'owner'}}),t.env);const secret=t.calls.find(c=>c.method==='setWebhook').payload.secret_token;t.calls.length=0;
 t.msg=(chat,text,extra={})=>worker.fetch(new Request('https://example.com/api/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify({update_id:t.uid(),message:{chat:{id:chat,type:'private'},from:{id:chat,first_name:'U'+chat},text,...extra}})}),t.env);
 t.cb=(from,data)=>worker.fetch(new Request('https://example.com/api/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify({update_id:t.uid(),callback_query:{id:'cb'+t.uid(),from:{id:from},data,message:{message_id:1,date:1}}})}),t.env);
 t.sent=(m,chat)=>t.calls.filter(c=>c.method===m&&(chat===undefined||String(c.payload.chat_id)===String(chat)));return t}
test('14.0: /support и start=support просят описать вопрос; тикет уходит админу с кнопками',async()=>{const t=await boot();try{
 await t.msg(500,'/start support');assert.match(t.sent('sendMessage',500)[0].payload.text,/одним сообщением/);
 await t.msg(500,'Не могу продлить подписку');
 const row=t.env.DB.sqlite.prepare('SELECT * FROM support_tickets').get();assert.equal(row.status,'new');assert.equal(row.role,'client');assert.equal(row.lang,'ru');
 const admin=t.sent('sendMessage',9001);assert.equal(admin.length,1);assert.match(admin[0].payload.text,/Обращение №1/);assert.ok(admin[0].payload.reply_markup.inline_keyboard[0].length===3);
 assert.match(t.sent('sendMessage',500).pop().payload.text,/№1 принято/);
 assert.equal(t.env.DB.sqlite.prepare('SELECT COUNT(*) n FROM support_state').get().n,0);
}finally{t.restore()}});
test('14.0: ответ админа уходит пользователю, статусы меняются, чужой не может отвечать',async()=>{const t=await boot();try{
 await t.msg(500,'/support');await t.msg(500,'Нужна помощь с записью');t.calls.length=0;
 await t.cb(777,'sup:r:1');assert.equal(t.sent('sendMessage',777).length,0);assert.equal(t.env.DB.sqlite.prepare('SELECT COUNT(*) n FROM support_state WHERE user_id=?').get('777').n,0);
 await t.cb(9001,'sup:r:1');await t.msg(9001,'Здравствуйте! Уже помогаем.');
 const toUser=t.sent('sendMessage',500);assert.match(toUser[0].payload.text,/Ответ поддержки · обращение №1/);assert.match(toUser[0].payload.text,/Уже помогаем/);
 assert.equal(t.env.DB.sqlite.prepare('SELECT status FROM support_tickets WHERE id=1').get().status,'in_progress');
 await t.cb(9001,'sup:c:1');assert.equal(t.env.DB.sqlite.prepare('SELECT status FROM support_tickets WHERE id=1').get().status,'closed');assert.match(t.sent('sendMessage',500).pop().payload.text,/закрыто/);
}finally{t.restore()}});
test('14.0: лимит обращений в час и язык пользователя',async()=>{const t=await boot();try{
 await ensureSchema(t.env.DB);t.env.DB.sqlite.prepare("INSERT INTO user_app_settings(user_id,language,role,theme,policy_version,consent_version,terms_version,consent_at,updated_at) VALUES('600','az','client','light','','','',0,1)").run();
 await t.msg(600,'/support');assert.match(t.sent('sendMessage',600)[0].payload.text,/Sualınızı/);
 for(let i=0;i<4;i++){await t.msg(600,'/support');await t.msg(600,'Sual nömrə '+i)}
 assert.equal(t.env.DB.sqlite.prepare('SELECT COUNT(*) n FROM support_tickets').get().n,3);
 assert.match(t.sent('sendMessage',600).pop().payload.text,/həddindən çox/);
}finally{t.restore()}});
test('14.0: старая веб-форма отключена, версия и миграция на месте',async()=>{
 const r=await worker.fetch(new Request('http://localhost/api/health'),{DB:database()});assert.equal((await r.json()).version,'14.0.0');
 assert.match(fs.readFileSync('migrations/0013_takt_v140.sql','utf8'),/support_tickets/);
 assert.ok(!/CREATE TABLE(?! IF NOT EXISTS)/.test(fs.readFileSync('migrations/0013_takt_v140.sql','utf8')));
 assert.ok(JSON.parse(fs.readFileSync('package.json','utf8')).version==='14.0.0');
 assert.ok(fs.readFileSync('public/app-v2.js','utf8').includes('?start=support'));
});
