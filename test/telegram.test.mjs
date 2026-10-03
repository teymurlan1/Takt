import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {database} from '../scripts/db.mjs';
import {readFileSync} from 'node:fs';
test('bot setup is owner-only and webhook authenticates Telegram requests',async()=>{
 const DB=database();DB.sqlite.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));const env={DB,DEV_MODE:'true',SUPERADMIN_IDS:'9001',BOT_TOKEN:'fake-test-token',APP_URL:'https://example.com'};
 const setup=role=>worker.fetch(new Request('http://localhost/api/telegram/setup',{method:'POST',headers:{'x-demo-role':role}}),env);
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{const method=url.split('/').pop(),payload=JSON.parse(options.body);calls.push({method,payload});return Response.json({ok:true,result:method==='getWebhookInfo'?{url:'https://example.com/api/telegram/webhook'}:true})};
 try{
  assert.equal((await setup('client')).status,403);assert.equal(calls.length,0);
  assert.equal((await setup('owner')).status,200);
  assert.deepEqual(calls.map(c=>c.method),['setWebhook','setChatMenuButton','setMyCommands','setMyDescription','setMyShortDescription','getWebhookInfo']);
  assert.ok(calls[3].payload.description.length<=512);assert.ok(calls[4].payload.short_description.length<=120);
  const secret=calls[0].payload.secret_token;
  assert.match(secret,/^[a-f0-9]{64}$/);assert.notEqual(secret,env.BOT_TOKEN);
  const webhook=(token,command='/start',type='private')=>worker.fetch(new Request('https://example.com/api/telegram/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':token},body:JSON.stringify({message:{chat:{id:123,type},text:command}})}),env);
  assert.equal((await webhook('')).status,403);
  assert.equal((await webhook('forged')).status,403);
  const start=await (await webhook(secret,'/start c_nail')).json();
  assert.equal(start.method,'sendMessage');assert.equal(start.chat_id,123);
  assert.equal(start.reply_markup.inline_keyboard[0][0].web_app.url,'https://example.com/?company=nail');
  assert.match((await (await webhook(secret,'/id')).json()).text,/123/);
  assert.deepEqual(await (await webhook(secret,'/start','group')).json(),{ok:true});
  assert.deepEqual(await (await webhook(secret,'hello')).json(),{ok:true});
  globalThis.fetch=async()=>Response.json({ok:false,description:'fake secret details'});
  const failure=await setup('owner');assert.equal(failure.status,502);assert.ok(!(await failure.text()).includes('fake secret details'));
 }finally{globalThis.fetch=original}
});
