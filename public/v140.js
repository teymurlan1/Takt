/* Takt 14.0: экран подписки (срок, что входит, что после окончания, реферал, история) и поддержка через бота. */
import {tr} from './copy140.js?v=151';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LOCALE={ru:'ru-RU',kk:'kk-KZ',az:'az-AZ',uz:'uz-UZ'};
const date=(t,l)=>{try{return new Date(t*1000).toLocaleDateString(LOCALE[l]||'ru-RU',{day:'numeric',month:'long',year:'numeric'})}catch{return ''}};
const cache=new Map(),TTL=20000;
const T=()=>window.Takt140;
async function load(id,force=false){const hit=cache.get(id);if(!force&&hit&&Date.now()-hit.at<TTL)return hit.data;const data=await T().api('/v140/subscription?company='+encodeURIComponent(id));cache.set(id,{at:Date.now(),data});return data}
export function view(d,lang){
 const L=tr(lang),until=date(d.until,lang),state=d.state;
 const title=state==='active'?L.active(until):state==='trial'?L.trial(until):state==='grace'?L.grace(date(d.grace_until,lang)):state==='expired'?L.expired:L.none;
 const left=state==='active'||state==='trial'?`<span>${esc(L.left(Math.max(0,d.days_left)))}</span>`:'';
 const note=state==='grace'?L.grace_note:state==='expired'?L.expired_note:'';
 const list=a=>`<ul>${a.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
 const r=d.referral||{},hist=(d.payments||[]).map(p=>`<li><span>${esc(date(p.created_at,lang))}</span><span>${esc(L.pay_status[p.status]||p.status)}</span><b>${p.days?esc(L.days(p.days)):''}</b></li>`).join('');
 return `<div class="s140-status s140-${esc(state)}" role="status"><strong>${esc(title)}</strong>${left}</div>${note?`<p class="s140-note">${esc(note)}</p>`:''}
<button type="button" class="primary wide" data-v140="support">${esc(L.pay)}</button><p class="note">${esc(L.pay_note)}</p>
<div class="s140-grid"><section><h3>${esc(L.inc_h)}</h3>${list(L.inc)}</section><section><h3>${esc(L.aft_h)}</h3>${list(L.aft)}</section></div>
<section class="s140-ref"><h3>${esc(L.ref_h)}</h3><p>${esc(L.ref_text(r.bonus_days_each||7))}</p>
<div class="s140-code"><span>${esc(L.ref_code)}</span><code>${esc(r.code||'')}</code><button type="button" class="secondary" data-v140="copy" data-code="${esc(r.code||'')}">${esc(L.ref_copy)}</button><button type="button" class="secondary" data-v140="share" data-code="${esc(r.code||'')}">${esc(L.ref_share)}</button></div>
${r.invited?`<p class="note">${esc(L.ref_stats(r.invited,r.bonus_days_total))}</p>`:''}
<form data-v140-form="referral"><input name="code" maxlength="80" autocomplete="off" autocapitalize="off" placeholder="${esc(L.ref_ph)}" aria-label="${esc(L.ref_ph)}"><button class="secondary">${esc(L.ref_apply)}</button></form></section>
<section class="s140-hist"><h3>${esc(L.hist_h)}</h3>${hist?`<ul>${hist}</ul>`:`<p class="note">${esc(L.hist_empty)}</p>`}</section>`;
}
async function hydrate(el,force=false){
 const t=T();if(!t)return;const id=el.dataset.sub140,lang=t.lang();el.dataset.h140='1';
 try{const d=await load(id,force);if(el.isConnected)el.innerHTML=view(d,lang)}
 catch(e){if(el.isConnected)el.innerHTML=`<p class="note" role="alert">${esc(tr(lang).err)}</p><button type="button" class="secondary" data-v140="retry">${esc(tr(lang).retry)}</button>`}
}
if(typeof document!=='undefined'){let timer;const scan=()=>{clearTimeout(timer);timer=setTimeout(()=>document.querySelectorAll('[data-sub140]:not([data-h140])').forEach(el=>hydrate(el)),60)};
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});scan();
const copyText=async text=>{try{await navigator.clipboard.writeText(text);return true}catch{const a=document.createElement('textarea');a.value=text;a.style.position='fixed';a.style.opacity='0';document.body.append(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch{}a.remove();return ok}};
document.addEventListener('click',async e=>{
 const b=e.target.closest?.('[data-v140]');if(!b)return;const t=T(),L=tr(t.lang()),a=b.dataset.v140,host=b.closest('[data-sub140]');
 if(a==='support'){t.support();return}
 if(a==='retry'&&host){host.innerHTML='<div class="skeletons"><div></div></div>';hydrate(host,true);return}
 if(a==='copy'){if(await copyText(b.dataset.code))t.toast(L.ref_copied);return}
 if(a==='share'){const url='https://t.me/share/url?url='+encodeURIComponent('https://t.me/takt_service_bot')+'&text='+encodeURIComponent(L.ref_share_text(b.dataset.code));const tg=window.Telegram?.WebApp;try{if(tg?.openTelegramLink)tg.openTelegramLink(url);else window.open(url,'_blank','noopener')}catch{window.location.href=url}}
});
document.addEventListener('submit',async e=>{
 const f=e.target.closest?.('[data-v140-form="referral"]');if(!f)return;e.preventDefault();
 const t=T(),L=tr(t.lang()),host=f.closest('[data-sub140]'),btn=f.querySelector('button'),code=f.elements.code.value.trim();if(!code||btn.disabled)return;
 btn.disabled=true;
 try{const r=await t.api('/v140/referral',{method:'POST',body:JSON.stringify({company:host.dataset.sub140,code})});t.toast(L.ref_done(r.bonus_days||7));cache.delete(host.dataset.sub140);await hydrate(host,true)}
 catch(err){t.toast(err.message);btn.disabled=false}
});
}
