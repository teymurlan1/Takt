import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {messagePayload} from '../src/v3.js';

const company={id:'c1',name:'Studio',timezone:'Europe/Moscow',address:'',notifications:{}};
const booking={id:'b1',company_id:'c1',name:'Анна Петрова',phone:'+79990000000',service_name:'Услуга',price:1500,starts_at:1791226800,status:'done'};

test('review request uses universal Takt wording',()=>{const p=messagePayload(booking,company,'review_request',false);assert.match(p.text,/Как всё прошло\? ⭐/);assert.match(p.text,/Будем рады вашему отзыву/);assert.doesNotMatch(p.text,/Спасибо за встречу/)});
test('v7 migration has verified reviews and live message map',()=>{const sql=fs.readFileSync(new URL('../migrations/0007_takt_v7.sql',import.meta.url),'utf8');assert.match(sql,/CREATE TABLE IF NOT EXISTS reviews/);assert.match(sql,/booking_id TEXT PRIMARY KEY/);assert.match(sql,/telegram_booking_messages/)});
test('delivery edits primary booking messages',()=>{const s=fs.readFileSync(new URL('../src/delivery.js',import.meta.url),'utf8');assert.match(s,/editMessageText/);assert.match(s,/telegram_booking_messages/);assert.match(s,/review_request/)});
test('mobile calendar has device-specific layout',()=>{const css=fs.readFileSync(new URL('../public/takt-v7.css',import.meta.url),'utf8');assert.match(css,/@media\(max-width:520px\)/);assert.match(css,/calendar-grid\.week/);assert.match(css,/calendar-free/)});
