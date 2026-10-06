/* Takt 12.5: надстройка поверх интерфейса 12.1. Не меняет логику приложения, только добавляет возможности. */
(()=>{
const tg=window.Telegram?.WebApp,$=(s,r=document)=>r.querySelector(s);
const tick=(t='light')=>{try{tg?.HapticFeedback?.impactOccurred(t)}catch{}};
const toast=t=>{const el=$('#toast');if(el){el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}};
/* 1. Тактильный отклик на кнопки */
document.addEventListener('click',e=>{if(e.target.closest('button:not(:disabled)'))tick()},{passive:true});
/* 2. Баннер «нет сети» */
const bar=document.createElement('div');bar.className='r125-offline';bar.setAttribute('role','status');bar.textContent='Нет соединения — данные обновятся позже';document.addEventListener('DOMContentLoaded',()=>document.body.append(bar));
const net=()=>bar.classList.toggle('on',!navigator.onLine);addEventListener('online',net);addEventListener('offline',net);
/* 3. «В календарь» на предстоящих записях клиента */
let cache=null;
const mine=async()=>{if(cache&&Date.now()-cache.t<30000)return cache.rows;const r=await fetch('/api/bookings',{headers:{'x-telegram-init-data':tg?.initData||''}});if(!r.ok)return [];const rows=await r.json();cache={t:Date.now(),rows:Array.isArray(rows)?rows:[]};return cache.rows};
const stamp=s=>new Date(s*1e3).toISOString().replace(/[-:]|\.\d{3}/g,'');
const gcal=b=>'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(b.service_name+' — '+(b.company_name||''))+'&dates='+stamp(b.starts_at)+'/'+stamp(b.ends_at)+'&details='+encodeURIComponent('Запись через Такт');
const decorate=async()=>{const cards=[...document.querySelectorAll('[data-booking-card]:not([data-r125])')];if(!cards.length)return;cards.forEach(c=>c.dataset.r125='1');let rows;try{rows=await mine()}catch{return}
for(const c of cards){const b=rows.find(x=>x.id===c.dataset.bookingCard);if(!b||!['pending','confirmed'].includes(b.status)||b.ends_at*1e3<Date.now())continue;const info=$('.visit-info',c)||c,a=document.createElement('button');a.type='button';a.className='r125-cal';a.textContent='＋ В календарь';a.onclick=ev=>{ev.stopPropagation();const u=gcal(b);tg?.openLink?tg.openLink(u):window.open(u,'_blank','noopener');toast('Открываю календарь')};info.append(a)}};
let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(decorate,150)}).observe(document.documentElement,{childList:true,subtree:true});
})();
