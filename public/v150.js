/* Takt 15.0: крупная карточка ближайшей записи (клиент), «Требует внимания» (специалист), настройки уведомлений клиента. */
import {c150} from './copy150.js?v=151';
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T=()=>window.Takt140,stamp=s=>new Date(s*1e3).toISOString().replace(/[-:]|\.\d{3}/g,'');
export function nextBooking(rows,now,companyId){return (rows||[]).filter(b=>(!companyId||b.company_id===companyId)&&['pending','confirmed'].includes(b.status)&&b.starts_at>now).sort((a,b)=>a.starts_at-b.starts_at)[0]||null}
export function heroHtml(b,lang,f,canRepeat){
 const L=c150(lang),mins=Math.max(0,Math.round((b.starts_at-Date.now()/1000)/60)),addr=b.company_address,phone=String(b.company_phone||'').replace(/[^\d+]/g,'');
 const gcal='https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(f.service(b)+' — '+(b.company_name||''))+'&dates='+stamp(b.starts_at)+'/'+stamp(b.ends_at||b.starts_at+3600);
 const a=(href,label,cls='secondary')=>`<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
 return `<article class="hero150-card" aria-label="${esc(L.hero)}"><span class="hero150-label">${esc(L.hero)}</span><div class="hero150-time"><strong>${esc(f.time(b.starts_at))}</strong><span>${esc(f.date(b.starts_at))}</span><b>${esc(L.rel(mins))}</b></div><h3>${esc(f.service(b))}</h3><p>${esc(b.company_name||'')}</p>
<div class="hero150-actions">${addr?a('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(addr),L.route):''}${phone?`<a class="secondary" href="tel:${esc(phone)}">${esc(L.call)}</a>`:''}${a(gcal,L.cal)}${canRepeat?`<button type="button" class="secondary" data-h150="again" data-service="${esc(b.service_id)}">${esc(L.again)}</button>`:''}<button type="button" class="primary" data-h150="edit" data-id="${esc(b.id)}">${esc(L.edit)}</button></div></article>`;
}
export const heroKey=(b,lang)=>b.id+':'+b.starts_at+':'+b.status+':'+c150(lang).rel(Math.max(0,Math.round((b.starts_at-Date.now()/1000)/60)));
export function retryHtml(lang,what){const L=c150(lang);return `<p class=\"note\" role=\"status\">${esc(L.load_err)}</p><button type=\"button\" class=\"secondary\" data-h150=\"retry\" data-what=\"${esc(what)}\">${esc(L.retry)}</button>`}
export function dashHtml(d,lang){
 const L=c150(lang),chips=[];const add=(txt,page,cls='')=>chips.push(`<button type="button" class="dash150-chip ${cls}" data-page="${page}">${esc(txt)}</button>`);
 if(d.pending)add(L.pending(d.pending),'calendar','warn');if(d.unconfirmed_soon)add(L.soon(d.unconfirmed_soon),'calendar','warn');if(d.risky)add(L.risky(d.risky),'tools','bad');
 if(d.subscription){const s=d.subscription;if(s.state==='grace')add(L.sub_grace,'subscription','bad');else if(s.state==='expired')add(L.sub_expired,'subscription','bad');else if(['active','trial'].includes(s.state)&&s.days_left<=7)add(L.sub(Math.max(0,s.days_left)),'subscription','warn')}
 if(d.overdue_clients)add(L.overdue(d.overdue_clients),'tools','info');if(d.waiting)add(L.waiting(d.waiting),'tools','info');
 if(d.checklist&&d.checklist.done<d.checklist.total)add(L.start(d.checklist.done,d.checklist.total),'tools','info');
 const facts=[d.free_today!==null&&d.free_today!==undefined?L.free(d.free_today):'',L.next(d.next_24h)].filter(Boolean);
 return `<h3>${esc(L.dash)}</h3>${chips.length?`<div class="dash150-chips">${chips.join('')}</div>`:`<p class="note">✓ ${esc(L.ok)}</p>`}<p class="note dash150-facts">${facts.map(esc).join(' · ')}</p>`;
}
export function prefsHtml(p,lang){const L=c150(lang);return `<h3>${esc(L.pr)}</h3>${Object.keys(L.pk).map(k=>`<label class="prefs150-row"><span>${esc(L.pk[k])}</span><input type="checkbox" role="switch" data-h150="pref" data-key="${k}"${p[k]?' checked':''}></label>`).join('')}<p class="note">${esc(L.pr_note)}</p>`}
if(typeof document!=='undefined'){
 let timer;const seen=new WeakSet();
 const fill=async()=>{const t=T();if(!t?.state)return;const S=t.state(),lang=t.lang();
  const seg=document.querySelector('.segmented');const vis=document.querySelector('.visits');const hero=document.querySelector('[data-hero150]');
  const want=seg&&vis&&t.isClient()&&S.tab==='upcoming'?nextBooking(S.bookings,Date.now()/1000,S.tenant?.id):null;
  if(!want){if(hero&&(!seg||!t.isClient()||S.tab!=='upcoming'||!nextBooking(S.bookings,Date.now()/1000,S.tenant?.id)))hero.remove()}
  else{const canRepeat=!!(S.tenant&&S.tenant.id===want.company_id&&S.tenant.services?.some(s=>s.id===want.service_id)),key=heroKey(want,lang);
   if(!hero||hero.dataset.hero150!==key){const html=`<section class=\"hero150\" data-hero150=\"${esc(key)}\">${heroHtml(want,lang,t.fmt,canRepeat)}</section>`;if(hero)hero.outerHTML=html;else seg.insertAdjacentHTML('beforebegin',html)}}
  document.querySelectorAll('[data-dash150]:not([data-h150])').forEach(async el=>{el.dataset.h150='1';try{const d=await t.api('/v150/dashboard?company='+encodeURIComponent(el.dataset.dash150));if(el.isConnected)el.innerHTML=dashHtml(d,lang)}catch{if(el.isConnected)el.innerHTML=retryHtml(lang,'dash')}});
  document.querySelectorAll('[data-prefs150]:not([data-h150])').forEach(async el=>{el.dataset.h150='1';try{const p=await t.api('/v150/prefs');if(el.isConnected)el.innerHTML=prefsHtml(p,lang)}catch{if(el.isConnected)el.innerHTML=retryHtml(lang,'prefs')}})};
 new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(fill,60)}).observe(document.documentElement,{childList:true,subtree:true});fill();
 setInterval(()=>{if(!document.hidden)fill()},60000);
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-h150]');if(!b)return;const t=T(),a=b.dataset.h150;
  if(a==='edit'){document.querySelector(`[data-visit="${CSS.escape(b.dataset.id)}"]`)?.click();return}
  if(a==='again'){t.start(b.dataset.service);return}
  if(a==='retry'){const box=b.closest('[data-dash150],[data-prefs150]');if(box){delete box.dataset.h150;b.disabled=true;fill()}return}});
 document.addEventListener('change',async e=>{const c=e.target.closest?.('[data-h150="pref"]');if(!c)return;const t=T();c.disabled=true;
  try{await t.api('/v150/prefs',{method:'POST',body:JSON.stringify({key:c.dataset.key,value:c.checked})})}catch{c.checked=!c.checked;t.toast(c150(t.lang()).err)}c.disabled=false});
}
