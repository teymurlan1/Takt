import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('7.2 persists display choice',()=>{const s=fs.readFileSync(new URL('../public/display.js',import.meta.url),'utf8');assert.match(s,/takt:display-mode/);assert.match(s,/fullscreen/);assert.match(s,/compact/)});
test('7.2 has private support and specialist client messaging',()=>{const s=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');assert.match(s,/\/api\/v72\/support/);assert.match(s,/\/api\/v72\/client-message/);assert.match(s,/owners\(env\)/)});
test('7.2 allows early specialist completion with confirmation in UI',()=>{const w=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8'),a=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');assert.doesNotMatch(w,/Завершить можно после окончания записи/);assert.match(a,/Завершить запись раньше\?/)});
test('7.2 month calendar has quick day actions',()=>{const a=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');assert.match(a,/calendarDaySheet/);assert.match(a,/data-manual-date/);assert.match(a,/data-open-day/)});
test('7.2 nearest bookings panel and client communication exist',()=>{const a=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');assert.match(a,/БЛИЖАЙШИЕ ЗАПИСИ/);assert.match(a,/data-message-client/);assert.match(a,/Отправить через Takt/)});
