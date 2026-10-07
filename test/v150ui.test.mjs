import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {C150,c150} from '../public/copy150.js';import {heroHtml,dashHtml,prefsHtml,nextBooking,esc} from '../public/v150.js';
const keys=o=>Object.keys(o).sort().join();
test('15.0 UI: тексты на 4 языках — одинаковые ключи, склонения, «через …»',()=>{
 for(const l of ['kk','az','uz']){assert.equal(keys(C150[l]),keys(C150.ru),l);assert.equal(keys(C150[l].pk),keys(C150.ru.pk),l)}
 assert.equal(C150.ru.rel(0),'сейчас');assert.equal(C150.ru.rel(30),'через 30 мин');assert.equal(C150.ru.rel(180),'через 3 ч');assert.equal(C150.ru.rel(1440*2+1440),'через 3 дня');assert.equal(C150.ru.rel(1440*5),'через 5 дней');assert.equal(c150('xx'),C150.ru)});
const now=Math.floor(Date.now()/1000),B={id:'b1',company_id:'nail',service_id:'s1',status:'confirmed',starts_at:now+3*3600,ends_at:now+4*3600,company_name:'Студия <b>',company_address:'Москва, ул. Мира 1',company_phone:'+7 (999) 123-45-67'};
const f={time:()=>'16:30',date:()=>'Сегодня',service:b=>'Маникюр'};
test('15.0 UI: ближайшая запись — выбор и карточка с маршрутом, звонком, календарём, повтором',()=>{
 const rows=[{...B,id:'old',starts_at:now-100},{...B,id:'c',status:'cancelled',starts_at:now+60},{...B,id:'far',starts_at:now+9*3600},B,{...B,id:'other',company_id:'x',starts_at:now+10}];
 assert.equal(nextBooking(rows,now,'nail').id,'b1');assert.equal(nextBooking(rows,now,'x').id,'other');assert.equal(nextBooking([],now),null);
 for(const l of ['ru','kk','az','uz']){const h=heroHtml(B,l,f,true);for(const need of ['google.com/maps/search','tel:+79991234567','calendar.google.com','data-h150="again"','data-h150="edit"','16:30'])assert.ok(h.includes(need),l+need);assert.ok(!h.includes('<b>')||h.includes('&lt;b&gt;'));assert.ok(h.includes('&lt;b&gt;'))}
 const bare=heroHtml({...B,company_address:'',company_phone:''},'ru',f,false);assert.ok(!bare.includes('maps')&&!bare.includes('tel:')&&!bare.includes('again'))});
test('15.0 UI: «Требует внимания» — чипы, пустое состояние, ссылки на разделы',()=>{
 const d={pending:2,unconfirmed_soon:1,risky:1,overdue_clients:3,waiting:2,free_today:4,next_24h:5,checklist:{done:1,total:4},subscription:{state:'grace',days_left:-1}};
 for(const l of ['ru','kk','az','uz']){const h=dashHtml(d,l);for(const p of ['data-page="calendar"','data-page="tools"','data-page="subscription"'])assert.ok(h.includes(p),l+p)}
 assert.match(dashHtml(d,'ru'),/Ждут подтверждения: 2/);assert.match(dashHtml(d,'ru'),/Свободных окон сегодня: 4/);
 const calm=dashHtml({pending:0,unconfirmed_soon:0,risky:0,overdue_clients:0,waiting:0,free_today:null,next_24h:0,checklist:{done:4,total:4},subscription:{state:'active',days_left:30}},'uz');assert.match(calm,/nazoratda/);assert.ok(!calm.includes('dash150-chip'));
 assert.match(dashHtml({...d,subscription:{state:'trial',days_left:3}},'ru'),/осталось 3 дн/)});
test('15.0 UI: настройки уведомлений клиента — переключатели с подписями',()=>{const p={reminder_24h:true,reminder_2h:false,review:true,rebook:true,waitlist:true};
 for(const l of ['ru','kk','az','uz']){const h=prefsHtml(p,l);assert.equal((h.match(/role="switch"/g)||[]).length,5);assert.equal((h.match(/ checked/g)||[]).length,4)}assert.equal(esc('<"&>'),'&lt;&quot;&amp;&gt;')});
test('15.0 UI: подключение — файлы, кэш v=150, звёзды, мост, подписи',()=>{
 const html=fs.readFileSync('public/index.html','utf8');assert.ok(html.includes('takt-v150.css?v=151')&&html.includes('v150.js?v=151'));assert.ok(!html.includes('?v=140'));
 const a=fs.readFileSync('public/app-v2.js','utf8');for(const n of ['data-dash150','data-prefs150','start:id=>startBooking(id)','isClient:()=>isClient()','aria-label="${n} / 5"'])assert.ok(a.includes(n),n);assert.ok(!a.includes('<span>${n} ★</span>'));
 const css=fs.readFileSync('public/takt-v150.css','utf8');for(const n of ['prefers-reduced-motion','data-theme=dark','min-width:44px','.rating-field','min-height:40px'])assert.ok(css.includes(n),n)});
