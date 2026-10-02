let tg,notify,unsupported=false,manual=false;
const native=()=>!!tg?.initData;
const supported=()=>native()&&!unsupported&&!!tg?.isVersionAtLeast?.('8.0')&&typeof tg.requestFullscreen==='function';
const full=()=>native()?!!tg.isFullscreen:!!document.fullscreenElement;
const available=()=>native()?supported():!!document.fullscreenEnabled;
const label=()=>full()?'Выйти из полного экрана':'На весь экран';
export function displayButton(){
 return available()?`<button type="button" id="fullscreen-toggle" class="screen-button" aria-label="${label()}" title="${label()}" aria-pressed="${full()}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg><span>${full()?'Свернуть':'На весь экран'}</span></button>`:'';
}
function sync(){
 const root=document.documentElement;
 for(const side of ['top','right','bottom','left']){
  const system=native()?Number(tg.safeAreaInset?.[side])||0:0;
  const content=native()?Number(tg.contentSafeAreaInset?.[side])||0:0;
  root.style.setProperty('--takt-system-'+side,Math.max(0,system)+'px');
  root.style.setProperty('--takt-content-'+side,Math.max(0,content)+'px');
 }
 root.classList.toggle('is-fullscreen',full());
 const b=document.querySelector('#fullscreen-toggle');
 if(b){b.hidden=!available();b.title=label();b.setAttribute('aria-label',label());b.setAttribute('aria-pressed',String(full()));b.querySelector('span').textContent=full()?'Свернуть':'На весь экран'}
}
async function toggle(automatic=false){
 manual=!automatic;
 try{
  if(supported()){if(full()){if(!automatic)tg.exitFullscreen()}else tg.requestFullscreen()}
  else if(!native()&&!automatic&&document.fullscreenEnabled){if(full())await document.exitFullscreen();else await document.documentElement.requestFullscreen()}
  else if(native())tg.expand();
 }catch{if(manual)notify('Полный экран недоступен в этой версии приложения.');}
 sync();
}
export function initDisplay(app,toast){
 tg=app;notify=toast;
 tg?.ready();tg?.expand();
 try{tg?.setHeaderColor('#ffffff');tg?.setBackgroundColor('#f6f8fc')}catch{}
 for(const event of ['safeAreaChanged','contentSafeAreaChanged','fullscreenChanged','viewportChanged'])tg?.onEvent?.(event,sync);
 tg?.onEvent?.('fullscreenFailed',event=>{if(event?.error==='UNSUPPORTED')unsupported=true;sync();if(manual)notify('Telegram не поддерживает полный экран на этом устройстве.');manual=false;});
 document.addEventListener('fullscreenchange',sync);
 window.addEventListener('resize',sync);
 document.addEventListener('click',event=>{if(event.target.closest('#fullscreen-toggle'))toggle()});
 sync();
 if(supported()&&!full())toggle(true);
}
