import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from '../scripts/db.mjs';import worker from '../src/worker.js';import {ensureSchema} from '../src/v2.js';
import {safeHtml,saveBotText,rollbackBotText,botTextOverride} from '../src/bot140.js';
async function setup(){const DB=database();DB.sqlite.exec(fs.readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));await ensureSchema(DB);return DB}
test('14.3: безопасный HTML — разрешены только парные <b>/<i>',()=>{
 assert.equal(safeHtml('<b>Привет</b> <i>мир</i>'),'<b>Привет</b> <i>мир</i>');assert.equal(safeHtml('<script>alert(1)</script>'),'&lt;script&gt;alert(1)&lt;/script&gt;');
 assert.equal(safeHtml('<b>не закрыто'),null);assert.equal(safeHtml('закрыто</b>'),null);assert.equal(safeHtml('a & b'),'a &amp; b');assert.equal(safeHtml('<a href="x">l</a>'),'&lt;a href=&quot;x&quot;&gt;l&lt;/a&gt;'.replace(/&quot;/g,'"'))});
test('14.3: тексты бота — версии, откат до стандартного, проверки',async()=>{const DB=await setup();
 assert.equal((await saveBotText(DB,'9001','nope','ru','x')).reason,'key');assert.equal((await saveBotText(DB,'9001','help_client','de','x')).reason,'key');assert.equal((await saveBotText(DB,'9001','help_client','ru','<b>x')).reason,'tags');assert.equal((await saveBotText(DB,'9001','help_client','ru','x'.repeat(1501))).reason,'long');
 assert.equal((await saveBotText(DB,'9001','help_client','ru','Первая')).version,1);assert.equal((await saveBotText(DB,'9001','help_client','ru','<b>Вторая</b>')).version,2);
 assert.equal(await botTextOverride(DB,'help_client','ru'),'<b>Вторая</b>');assert.equal(await botTextOverride(DB,'help_client','kk'),null);
 assert.equal((await rollbackBotText(DB,'9001','help_client','ru')).version,3);assert.equal(await botTextOverride(DB,'help_client','ru'),'Первая');
 await rollbackBotText(DB,'9001','help_client','ru');assert.equal(await botTextOverride(DB,'help_client','ru'),'<b>Вторая</b>');
 assert.equal((await saveBotText(DB,'9001','help_client','ru','')).ok,true);assert.equal(await botTextOverride(DB,'help_client','ru'),null);
 assert.equal(DB.sqlite.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='bot.text'").get().n,5)});
test('14.3: админ-API текстов бота — права и предпросмотр',async()=>{const DB=await setup();const env={DB,DEV_MODE:'true',SUPERADMIN_IDS:'9001',ADMIN_ID:'9001'};
 const call=(role,path,body)=>worker.fetch(new Request('http://localhost'+path,{method:body?'POST':'GET',headers:{'x-demo-role':role,'content-type':'application/json'},body:body?JSON.stringify(body):undefined}),env);
 assert.equal((await call('client','/api/v140/admin/bot-texts')).status,403);assert.equal((await call('client','/api/v140/admin/bot-texts',{key:'help_client',lang:'ru',text:'x'})).status,403);
 const ok=await call('owner','/api/v140/admin/bot-texts');assert.equal(ok.status,200);const d=await ok.json();assert.deepEqual(d.keys.map(k=>k.key),['help_specialist','help_client','welcome_first','support_ask']);assert.ok(d.keys[0].langs.ru.default.length>10);assert.ok(d.keys[3].langs.uz.default.includes('Takt'));
 const pv=await call('owner','/api/v140/admin/bot-texts/preview',{text:'<b>Привет</b> <u>x</u>'});assert.equal(pv.status,200);assert.equal((await pv.json()).html,'<b>Привет</b> &lt;u&gt;x&lt;/u&gt;');assert.equal((await call('owner','/api/v140/admin/bot-texts/preview',{text:'<i>'})).status,400)});
test('14.3: изменённый текст используется в /help и приглашении в поддержку',async()=>{const DB=await setup();const env={DB,DEV_MODE:'true',SUPERADMIN_IDS:'9001',ADMIN_ID:'9001',BOT_TOKEN:'fake',APP_URL:'https://example.com'};
 const calls=[];const orig=globalThis.fetch;globalThis.fetch=async(u,o)=>{calls.push({method:String(u).split('/').pop(),payload:JSON.parse(o.body)});return Response.json({ok:true,result:true})};
 try{await worker.fetch(new Request('http://localhost/api/telegram/setup',{method:'POST',headers:{'x-demo-role':'owner'}}),env);const secret=calls.find(c=>c.method==='setWebhook').payload.secret_token;calls.length=0;
  await saveBotText(DB,'9001','support_ask','ru','<b>Расскажите, что случилось</b>');await saveBotText(DB,'9001','help_client','ru','Свой <i>текст</i> помощи');
  const hook=(text)=>worker.fetch(new Request('https://example.com/api/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify({update_id:Math.floor(Math.random()*1e9),message:{chat:{id:555,type:'private'},from:{id:555,first_name:'U'},text}})}),env);
  await hook('/support');assert.ok(calls.some(c=>c.method==='sendMessage'&&String(c.payload.chat_id)==='555'&&c.payload.text==='<b>Расскажите, что случилось</b>'));
  const r=await (await hook('/help')).json();assert.equal(r.text,'Свой <i>текст</i> помощи')}finally{globalThis.fetch=orig}});
test('14.3: миграция текстов бота аддитивная',()=>{const m=fs.readFileSync('migrations/0016_takt_v143.sql','utf8');assert.ok(!/DROP|DELETE|ALTER/i.test(m));assert.ok(!/CREATE TABLE(?! IF NOT EXISTS)/.test(m))});
