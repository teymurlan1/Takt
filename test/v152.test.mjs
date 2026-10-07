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
const buttons=p=>(p.reply_markup?.inline_keyboard||[]).flat();
test('15.2: кнопка «Поддержка» в приветствии бота начинает диалог в чате, а не открывает приложение',async()=>{const t=await boot();try{
 await t.msg(700,'/start');const r1=await(await t.cb(700,'entry:lang:ru')).json();const agree=buttons(r1).find(b=>/^entry:agree:/.test(b.callback_data));const hello=await(await t.cb(700,agree.callback_data)).json();
 const sup=buttons(hello).filter(b=>b.callback_data==='sup:new');assert.equal(sup.length,1,'есть кнопка поддержки с callback_data');
 assert.ok(!buttons(hello).some(b=>b.web_app&&/support=1/.test(b.web_app.url)),'нет web_app на поддержку');
 const before=t.sent('sendMessage',700).length;await t.cb(700,'sup:new');
 assert.ok(t.calls.some(c=>c.method==='answerCallbackQuery'),'есть answerCallbackQuery');
 const ask=t.sent('sendMessage',700).slice(before).at(-1);assert.match(ask.payload.text,/одним сообщением/);
 await t.msg(700,'не могу записать клиента');assert.ok(t.sent('sendMessage',9001).length>0,'обращение ушло админу');
}finally{t.restore()}});
