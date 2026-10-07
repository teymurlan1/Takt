import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {COPY,tr} from '../public/copy140.js';import {view} from '../public/v140.js';
const keys=o=>Object.keys(o).sort().join();
test('14.0 UI: тексты есть на ru/kk/az/uz и ключи совпадают',()=>{
 for(const l of ['kk','az','uz']){assert.equal(keys(COPY[l]),keys(COPY.ru),l);for(const k of ['t_status','t_role','pay_status','u_reason'])assert.equal(keys(COPY[l][k]),keys(COPY.ru[k]),l+k);assert.equal(COPY[l].inc.length,COPY.ru.inc.length);assert.equal(COPY[l].aft.length,COPY.ru.aft.length)}
 assert.equal(tr('xx'),COPY.ru)});
test('14.0 UI: карточка подписки для всех состояний и языков, без внедрения HTML',()=>{
 const base={until:1e9,days_left:5,grace_until:1e9+3*86400,payments:[{created_at:1e9,status:'manual',days:30}],referral:{code:'r_<img src=x>',invited:2,bonus_days_total:14,bonus_days_each:7}};
 for(const l of ['ru','kk','az','uz'])for(const state of ['active','trial','grace','expired','none']){const h=view({...base,state},l);assert.match(h,/data-v140="support"/);assert.match(h,/data-v140-form="referral"/);assert.ok(!h.includes('<img src=x>'),'escape');assert.ok(h.includes('&lt;img'))}
 assert.match(view({...base,state:'grace'},'ru'),/Новые записи на паузе/);
 assert.match(view({...base,state:'active'},'uz'),/kun qoldi/);
 assert.ok(!/s140-note/.test(view({...base,state:'active'},'ru')));
 assert.match(view({...base,state:'trial',payments:[]},'az'),/Hələ ödəniş yoxdur/)});
test('14.0 UI: подключение файлов, мост и админ-разделы',()=>{
 const h=fs.readFileSync('public/index.html','utf8');assert.ok(h.includes('takt-v140.css?v=151')&&h.includes('v140.js?v=151'));
 const a=fs.readFileSync('public/app-v2.js','utf8');assert.ok(a.includes('window.Takt140=')&&a.includes('data-sub140'));assert.ok(!a.includes('id="renew-subscription"')||!a.includes('Период продления'));
 const c=fs.readFileSync('public/control-center.js','utf8');assert.ok(c.includes("key==='undelivered'")&&c.includes('/v140/admin/tickets')&&c.includes('data-t140-reply'));
 const css=fs.readFileSync('public/takt-v140.css','utf8');assert.ok(css.includes('prefers-reduced-motion')&&css.includes('data-theme=dark')&&/min-height:40px/.test(css))});
test('14.3 UI: раздел «Бот» в админке и тексты на 4 языках',()=>{const c=fs.readFileSync('public/control-center.js','utf8');for(const n of ["key==='bot'",'/v140/admin/bot-texts','data-bot-form','data-bot-rollback','data-bot-preview'])assert.ok(c.includes(n),n);
 for(const l of ['ru','kk','az','uz']){assert.ok(COPY[l].nav_bot&&COPY[l].bot.h&&COPY[l].bot.keys.support_ask);assert.equal(keys(COPY[l].bot),keys(COPY.ru.bot));assert.equal(keys(COPY[l].bot.keys),keys(COPY.ru.bot.keys))}});
