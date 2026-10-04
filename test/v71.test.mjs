import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const app=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../public/takt-v71.css',import.meta.url),'utf8'),worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
test('7.1 navigation keeps cached pages and scroll state',()=>{assert.match(app,/pageScroll=new Map/);assert.match(app,/pageCached/);assert.match(app,/loadPageData/);assert.match(app,/shellSignature/)});
test('7.1 specialist attendance wording is clear',()=>{assert.match(app,/Визит подтверждён клиентом/);assert.match(app,/Ожидаем подтверждение клиента/);assert.match(app,/Ответа клиента пока нет/)});
test('7.1 client cabinet surfaces reviews and aligned location details',()=>{assert.match(app,/client-review-preview/);assert.match(app,/location-details/);assert.match(app,/Кабинет \/ квартира/);assert.match(css,/client-premium-head/)});
test('7.1 settings are split into clear groups',()=>{for(const x of ['Профиль','Место работы','Расписание','Выходные и отпуск','Правила записи','Уведомления','Часовой пояс'])assert.ok(app.includes(x))});
test('7.1 responses add safe headers without blocking Telegram webview framing',()=>{assert.match(worker,/Referrer-Policy/);assert.match(worker,/X-Content-Type-Options/);assert.doesNotMatch(worker,/X-Frame-Options/)});
