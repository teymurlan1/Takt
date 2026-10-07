/* Takt 14.0: «Инструменты» (чеклист, клиенты, шаблоны, отзывы, портфолио, экспорт), лист ожидания, галерея, подвал. */
import {tt} from './tools-copy140.js?v=151';
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T=()=>window.Takt140,stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);
const IMG=/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
export function renderTools(d,lang){
 const L=tt(lang),c=d.checklist,pct=Math.round(c.done/c.total*100);
 const check=`<section class="t140x-card"><h3>${esc(L.chk_h)} · ${c.done}/${c.total}</h3><div class="t140x-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>${c.done===c.total?`<p class="note">${esc(L.chk_done)}</p>`:`<ul class="t140x-list">${c.items.map(i=>`<li class="${i.done?'done':''}"><span aria-hidden="true">${i.done?'✓':'○'}</span>${esc(L.chk[i.key])}</li>`).join('')}</ul>`}</section>`;
 const tpl=d.templates||[],opts=tpl.map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
 const clients=(d.clients||[]).map(x=>`<article class="t140x-client" data-cid="${esc(x.client_id)}"><div class="t140x-head"><strong>${esc(x.name||'—')}</strong><span class="t140x-badges"><em>${esc(L.visits(x.visits))}</em>${x.no_shows?`<em class="warn">${esc(L.noshow(x.no_shows))}</em>`:''}${x.overdue?`<em class="info">${esc(L.overdue)}</em>`:''}${x.blocked?`<em class="bad">${esc(L.blocked)}</em>`:''}${x.tag?`<em>${esc(x.tag)}</em>`:''}</span></div>
<div class="t140x-actions">${x.reachable?`<details><summary>${esc(L.call_back)}</summary><form data-t-form="winback"><select aria-label="${esc(L.tpl_pick)}" data-t-tpl><option value="">${esc(L.tpl_pick)}</option>${opts}</select><textarea name="text" maxlength="500" required placeholder="${esc(L.msg_ph)}" aria-label="${esc(L.msg_ph)}"></textarea><button class="primary">${esc(L.msg_send)}</button></form></details>`:`<small class="note">${esc(L.no_bot)}</small>`}
<details><summary>⋯</summary><form data-t-form="flag"><input name="tag" maxlength="30" value="${esc(x.tag)}" placeholder="${esc(L.tag_ph)}" aria-label="${esc(L.tag_ph)}"><input name="birthday" maxlength="5" pattern="\\d{2}-\\d{2}" value="${esc(x.birthday)}" placeholder="${esc(L.bd_ph)}" aria-label="${esc(L.bd_ph)}"><button class="secondary">${esc(L.save)}</button></form><button type="button" class="secondary" data-t="block" data-blocked="${x.blocked?0:1}">${esc(x.blocked?L.unblock:L.block)}</button></details></div></article>`).join('')||`<p class="note">${esc(L.cl_empty)}</p>`;
 const bd=(d.birthdays||[]).length?`<p class="note">🎂 ${esc(L.bd_h)}: ${d.birthdays.map(b=>esc(b.name)+' '+esc(b.birthday)).join(', ')}</p>`:'';
 const templates=`<section class="t140x-card"><h3>${esc(L.tpl_h)}</h3>${tpl.map(t=>`<div class="t140x-tpl"><div><strong>${esc(t.title)}</strong><p>${esc(t.text)}</p></div><button type="button" class="secondary" data-t="tpl-del" data-id="${esc(t.id)}" aria-label="${esc(L.tpl_del)}">✕</button></div>`).join('')||`<p class="note">${esc(L.tpl_empty)}</p>`}<form data-t-form="tpl"><input name="title" maxlength="40" required placeholder="${esc(L.tpl_title_ph)}" aria-label="${esc(L.tpl_title_ph)}"><textarea name="text" maxlength="500" required placeholder="${esc(L.tpl_text_ph)}" aria-label="${esc(L.tpl_text_ph)}"></textarea><button class="secondary">${esc(L.tpl_add)}</button></form></section>`;
 const reviews=`<section class="t140x-card"><h3>${esc(L.rv_h)}${d.rating?.count?` · ${esc(L.rv_avg(d.rating.avg,d.rating.count))}`:''}</h3>${(d.reviews||[]).map(r=>`<article class="t140x-review"><div class="t140x-head"><strong>${esc(r.client_name)}</strong><span aria-label="${r.rating}/5">${stars(r.rating)}</span></div>${r.text?`<p>${esc(r.text)}</p>`:''}${r.reply?`<p class="t140x-reply"><b>${esc(L.rv_reply)}:</b> ${esc(r.reply)}</p>`:''}<form data-t-form="reply" data-bid="${esc(r.booking_id)}"><textarea name="text" maxlength="600" required placeholder="${esc(L.rv_reply_ph)}" aria-label="${esc(L.rv_reply_ph)}">${esc(r.reply||'')}</textarea><button class="secondary">${esc(L.rv_send)}</button></form></article>`).join('')||`<p class="note">${esc(L.rv_empty)}</p>`}</section>`;
 const portfolio=`<section class="t140x-card"><h3>${esc(L.pf_h)} · ${esc(L.pf_count(d.portfolio.count,d.portfolio.limit))}</h3><div class="t140x-grid" data-t-gallery></div><label class="secondary t140x-upload" role="button" tabindex="0">${esc(L.pf_add)}<input type="file" accept="image/*" data-t-upload hidden${d.portfolio.count>=d.portfolio.limit?' disabled':''}></label></section>`;
 const exp=`<section class="t140x-card"><h3>${esc(L.ex_h)}</h3><div class="t140x-actions"><button type="button" class="secondary" data-t="export" data-kind="clients">${esc(L.ex_clients)}</button><button type="button" class="secondary" data-t="export" data-kind="bookings">${esc(L.ex_bookings)}</button></div><div data-t-export></div></section>`;
 return `<header class="t140x-title"><h2>${esc(L.title)}</h2><p class="note">${esc(L.sub)}</p></header>${check}${d.waiting?`<p class="note">🔔 ${esc(L.wait(d.waiting))}</p>`:''}<section class="t140x-card"><h3>${esc(L.cl_h)}</h3>${bd}${clients}</section>${templates}${reviews}${portfolio}${exp}`;
}
async function compress(file){
 const bmp=await createImageBitmap(file);let side=1000,q=.8,out='';
 for(let i=0;i<8;i++){const k=Math.min(1,side/Math.max(bmp.width,bmp.height)),cv=document.createElement('canvas');cv.width=Math.round(bmp.width*k);cv.height=Math.round(bmp.height*k);cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);out=cv.toDataURL('image/jpeg',q);if(out.length<=110000)return out;if(q>.5)q-=.1;else side-=150}
 return out;
}
if(typeof document!=='undefined'){
 const cache=new Map();let timer;
 async function hydrateTools(el,force){const t=T();if(!t)return;el.dataset.h140='1';const id=el.dataset.tools140,lang=t.lang();
  try{const d=await t.api('/v140/tools?company='+encodeURIComponent(id));if(!el.isConnected)return;el.dataset.lang=lang;el.innerHTML=renderTools(d,lang);cache.set(id,d);loadGallery(el.querySelector('[data-t-gallery]'),id,0,true)}
  catch{if(el.isConnected)el.innerHTML=`<p class="note" role="alert">${esc(tt(lang).err)}</p><button type="button" class="secondary" data-t="retry">${esc(tt(lang).retry)}</button>`}}
 async function loadGallery(box,id,offset,manage){if(!box)return;const t=T(),L=tt(t.lang());
  try{const r=await t.api('/v140/portfolio?company='+encodeURIComponent(id)+'&offset='+offset);if(!box.isConnected)return;box.querySelector('[data-more]')?.remove();
   box.insertAdjacentHTML('beforeend',r.items.filter(i=>IMG.test(i.data)).map(i=>`<figure><img loading="lazy" alt="${esc(L.gallery)}" src="${i.data}">${manage?`<button type="button" class="t140x-x" data-t="photo-del" data-id="${esc(i.id)}" aria-label="${esc(L.pf_del)}">✕</button>`:''}</figure>`).join(''));
   const shown=offset+r.items.length;if(!r.total&&manage)box.innerHTML=`<p class="note">${esc(L.pf_empty)}</p>`;
   if(shown<r.total)box.insertAdjacentHTML('beforeend',`<button type="button" class="secondary" data-more data-t="photo-more" data-id="${esc(id)}" data-offset="${shown}" data-manage="${manage?1:0}">${esc(L.pf_more)}</button>`)}catch{}}
 function fill(){document.querySelectorAll('[data-tools140]:not([data-h140])').forEach(el=>hydrateTools(el));
  document.querySelectorAll('[data-gallery140]:not([data-h140])').forEach(el=>{const t=T();if(!t)return;el.dataset.h140='1';const L=tt(t.lang());el.innerHTML=`<h3>${esc(L.gallery)}</h3><div class="t140x-grid" data-t-gallery></div>`;loadGallery(el.querySelector('[data-t-gallery]'),el.dataset.gallery140,0,false).then(()=>{if(!el.querySelector('figure'))el.remove()})});
  document.querySelectorAll('[data-foot140]:not([data-h140])').forEach(el=>{const t=T();if(!t)return;el.dataset.h140='1';el.innerHTML=`<a href="https://t.me/takt_service_bot?startapp=create" target="_blank" rel="noopener">${esc(tt(t.lang()).foot)}</a>`});
  document.querySelectorAll('[data-tools-link]:not([data-h140])').forEach(el=>{const t=T();if(!t)return;el.dataset.h140='1';const L=tt(t.lang());el.innerHTML=`<strong>${esc(L.title)}</strong><span>${esc(L.link_sub)}</span>`});
  document.querySelectorAll('#available-slots .no-slots:not([data-wl])').forEach(el=>{const t=T(),b=t?.booking?.();if(!b?.tenant||!b.s||!b.date)return;el.dataset.wl='1';const L=tt(t.lang());el.insertAdjacentHTML('beforeend',`<button type="button" class="secondary" data-t="waitlist" data-company="${esc(b.tenant.id)}" data-service="${esc(b.s.id)}" data-date="${esc(b.date)}">${esc(L.wl_btn)}</button>`)})}
 new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(fill,60)}).observe(document.documentElement,{childList:true,subtree:true});fill();
 const company=el=>el.closest('[data-tools140]')?.dataset.tools140;
 const act=(el,body)=>T().api('/v140/tools/action',{method:'POST',body:JSON.stringify({company:company(el),...body})});
 const reload=el=>{const h=el.closest('[data-tools140]');h.removeAttribute('data-h140');h.innerHTML='';fill()};
 document.addEventListener('change',e=>{const s=e.target.closest?.('[data-t-tpl]');if(s){const d=cache.get(company(s)),tpl=d?.templates?.find(x=>x.id===s.value);if(tpl)s.closest('form').elements.text.value=tpl.text}
  const f=e.target.closest?.('[data-t-upload]');if(f&&f.files[0]){const t=T(),L=tt(t.lang()),host=f,file=f.files[0];f.value='';f.parentElement.firstChild.textContent=L.pf_busy;
   compress(file).then(data=>act(host,{action:'portfolio_add',data})).then(()=>reload(host)).catch(err=>{t.toast(err.message||L.err);reload(host)})}});
 document.addEventListener('click',async e=>{const b=e.target.closest?.('[data-t]');if(!b||b.disabled)return;const t=T(),L=tt(t.lang()),a=b.dataset.t;
  try{
   if(a==='retry'){reload(b);return}
   if(a==='block'){b.disabled=true;await act(b,{action:'client_flag',client_id:b.closest('[data-cid]').dataset.cid,blocked:b.dataset.blocked==='1'});reload(b);return}
   if(a==='tpl-del'){b.disabled=true;await act(b,{action:'template_delete',id:b.dataset.id});reload(b);return}
   if(a==='photo-del'){b.disabled=true;await act(b,{action:'portfolio_delete',id:b.dataset.id});reload(b);return}
   if(a==='photo-more'){b.disabled=true;loadGallery(b.parentElement,b.dataset.id,Number(b.dataset.offset),b.dataset.manage==='1');return}
   if(a==='export'){b.disabled=true;const r=await t.api('/v140/tools/export?company='+encodeURIComponent(company(b))+'&kind='+b.dataset.kind);b.disabled=false;const box=b.closest('section').querySelector('[data-t-export]'),url=URL.createObjectURL(new Blob([r.csv],{type:'text/csv;charset=utf-8'}));box.innerHTML=`<p class="note">${esc(L.ex_rows(r.rows))}</p><div class="t140x-actions"><a class="secondary" href="${url}" download="${esc(r.filename)}">${esc(L.ex_download)}</a><button type="button" class="secondary" data-t="copy-csv">${esc(L.ex_copy)}</button></div>`;box.dataset.csv=r.csv;return}
   if(a==='copy-csv'){const csv=b.closest('[data-t-export]').dataset.csv;try{await navigator.clipboard.writeText(csv);t.toast(L.done)}catch{}return}
   if(a==='waitlist'){b.disabled=true;await t.api('/v140/waitlist',{method:'POST',body:JSON.stringify({company_id:b.dataset.company,service_id:b.dataset.service,date:b.dataset.date})});b.textContent=L.wl_done;return}
  }catch(err){b.disabled=false;t.toast(err.message||L.err)}});
 document.addEventListener('submit',async e=>{const f=e.target.closest?.('[data-t-form]');if(!f)return;e.preventDefault();const btn=f.querySelector('button.primary,button.secondary');if(btn.disabled)return;const t=T(),L=tt(t.lang()),k=f.dataset.tForm;btn.disabled=true;
  try{
   if(k==='tpl')await act(f,{action:'template_save',title:f.elements.title.value,text:f.elements.text.value});
   if(k==='reply')await act(f,{action:'review_reply',booking_id:f.dataset.bid,text:f.elements.text.value});
   if(k==='flag')await act(f,{action:'client_flag',client_id:f.closest('[data-cid]').dataset.cid,tag:f.elements.tag.value,birthday:f.elements.birthday.value.trim()});
   if(k==='winback'){await act(f,{action:'win_back',client_id:f.closest('[data-cid]').dataset.cid,text:f.elements.text.value});t.toast(L.msg_sent);f.reset();btn.disabled=false;return}
   t.toast(L.done);reload(f)}catch(err){btn.disabled=false;t.toast(err.message||L.err)}});
}
