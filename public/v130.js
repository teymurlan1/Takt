/* Takt 13.0: выравнивание карточек и звёзды отзыва. Логику приложения не меняет. */
(()=>{
const fixSlots=()=>{document.querySelectorAll('.next72-actions:not([data-r130]),.attention-actions:not([data-r130])').forEach(g=>{g.dataset.r130='1';const n=g.children.length;for(let i=n;i<3;i++){const s=document.createElement('span');s.className='r130-slot';s.setAttribute('aria-hidden','true');g.append(s)}})};
const fixStars=()=>{document.querySelectorAll('.rating-field:not([data-r130])').forEach(f=>{f.dataset.r130='1';f.querySelectorAll('label').forEach(l=>{const v=l.querySelector('input')?.value,s=l.querySelector('span');if(s)s.textContent='★';l.setAttribute('aria-label',v+' из 5')})})};
let t;const run=()=>{clearTimeout(t);t=setTimeout(()=>{fixSlots();fixStars()},60)};
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});run();
})();
/* 13.1: плавный счёт чисел в карточках статистики */
(()=>{const count=()=>document.querySelectorAll('.dashboard-kpis strong:not([data-r131])').forEach(el=>{const t=el.textContent.trim();if(!/^\d{1,4}$/.test(t))return;el.dataset.r131='1';const n=+t;if(n<2||matchMedia('(prefers-reduced-motion:reduce)').matches)return;const s=performance.now();const step=now=>{const k=Math.min(1,(now-s)/600);el.textContent=Math.round(n*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(step);else el.textContent=n};requestAnimationFrame(step)});
new MutationObserver(()=>setTimeout(count,80)).observe(document.documentElement,{childList:true,subtree:true})})();
/* 13.2: админ-панель на азербайджанском (только точные совпадения интерфейса, введённые админом тексты не трогаем) */
import('/az132.js?v=151').then(({AZ})=>{
const exact=el=>{if(document.documentElement.lang!=='az')return;const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.trim();if(t&&AZ[t]&&!n.parentElement.closest('input,textarea,[data-user-content]'))n.nodeValue=n.nodeValue.replace(t,AZ[t])}el.querySelectorAll('[placeholder],[title],[aria-label]').forEach(e=>['placeholder','title','aria-label'].forEach(a=>{const v=e.getAttribute(a)?.trim();if(v&&AZ[v])e.setAttribute(a,AZ[v])}))};
let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>document.querySelectorAll('[data-admin-content]').forEach(exact),120)}).observe(document.documentElement,{childList:true,subtree:true});
}).catch(()=>{});
