import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('13.0: файлы подключены и версия обновлена',()=>{const h=readFileSync('public/index.html','utf8');assert.ok(h.includes('takt-v130.css?v=140')&&h.includes('v130.js?v=140'));assert.ok(readFileSync('src/worker.js','utf8').includes("version:'14.0.0'"))});
import {translateText} from '../public/i18n.js';
test('13.2: азербайджанский перевод работает, Takt не переводится',()=>{globalThis.localStorage={getItem(){return null},setItem(){}};assert.equal(translateText('Создать страницу','az'),'Səhifə yarat');assert.ok(!/[А-Яа-я]/.test(translateText('Знакомство с Тактом и уведомления','az')));assert.ok(translateText('Takt готов','az').includes('Takt'))});
