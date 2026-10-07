import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {TOOLS,tt} from '../public/tools-copy140.js';import {renderTools,esc} from '../public/tools140.js';
const keys=o=>Object.keys(o).sort().join();
test('14.2 UI: тексты инструментов совпадают по ключам на 4 языках',()=>{for(const l of ['kk','az','uz']){assert.equal(keys(TOOLS[l]),keys(TOOLS.ru),l);assert.equal(keys(TOOLS[l].chk),keys(TOOLS.ru.chk),l)}assert.equal(tt('xx'),TOOLS.ru)});
const data=l=>({checklist:{items:[{key:'service',done:true},{key:'profile',done:false},{key:'client',done:false},{key:'booking',done:false}],done:1,total:4},waiting:2,birthdays:[{client_id:'1',name:'<b>Аня</b>',birthday:'05-12'}],
 clients:[{client_id:'7001',name:'<script>x</script>',visits:3,no_shows:2,overdue:true,blocked:true,tag:'VIP"',birthday:'',reachable:true},{client_id:'manual-1',name:'Ручной',visits:1,no_shows:0,overdue:false,blocked:false,tag:'',birthday:'',reachable:false}],
 templates:[{id:'t1',title:'Привет',text:'Ждём вас'}],reviews:[{booking_id:'b1',client_name:'Оля',rating:4,text:'Хорошо <i>',reply:''}],rating:{count:1,avg:4},portfolio:{count:3,limit:20}});
test('14.2 UI: экран инструментов — все разделы, экранирование, доступность',()=>{
 for(const l of ['ru','kk','az','uz']){const h=renderTools(data(l),l);
  for(const need of ['role="progressbar"','data-t-form="winback"','data-t-form="flag"','data-t-form="tpl"','data-t-form="reply"','data-t-upload','data-t="export"','data-t-gallery'])assert.ok(h.includes(need),l+need);
  assert.ok(!h.includes('<script>')&&!h.includes('<b>Аня')&&!h.includes('<i>'),'escape');assert.ok(h.includes('&lt;script&gt;'));assert.ok(!h.includes('value="VIP""'));
  assert.ok((h.match(/aria-label=/g)||[]).length>=8)}
 assert.match(renderTools(data(),'uz'),/Mijozlar/);assert.match(renderTools({...data(),checklist:{items:[],done:4,total:4}},'az'),/hazırdır/);
 assert.equal(esc('<&">'),'&lt;&amp;&quot;&gt;')});
test('14.2 UI: подключение — страница, ссылка в профиле, лист ожидания, подвал',()=>{
 const a=fs.readFileSync('public/app-v2.js','utf8');for(const n of ['tools:toolsPage','data-tools140','data-tools-link','data-gallery140','data-foot140','booking:()=>booking'])assert.ok(a.includes(n),n);
 assert.ok(fs.readFileSync('public/index.html','utf8').includes('tools140.js?v=151'));
 const t=fs.readFileSync('public/tools140.js','utf8');assert.ok(t.includes('/v140/waitlist')&&t.includes('portfolio_add')&&t.includes('createImageBitmap'));
 const css=fs.readFileSync('public/takt-v140.css','utf8');assert.ok(css.includes('.t140x')&&css.includes('data-theme=dark')&&css.includes('prefers-reduced-motion'))});
