import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const app=fs.readFileSync('public/app-v2.js','utf8'),worker=fs.readFileSync('src/worker.js','utf8'),css=fs.readFileSync('public/takt-v81.css','utf8'),landing=fs.readFileSync('public/landing.js','utf8'),pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
test('8.1 version and visual patch are wired',()=>{assert.match(pkg.version,/^\d+\.\d+\.\d+$/);assert.match(css,/subscription-v81/);assert.match(landing,/hero-second-line/)});
test('client messaging is personal Telegram only',()=>{assert.match(app,/Переписка через Takt отключена/);assert.doesNotMatch(app,/setTimeout\(\(\)=>tg\?\.close/)});
test('month calendar supports whole-cell tap',()=>assert.match(app,/calendar-grid\.month .*calendar-day/));
test('worker is upgraded to 8.1',()=>assert.match(worker,/version:'\d+\.\d+\.\d+'/));

