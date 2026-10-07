import {translateText} from './i18n.js?v=151';
let tg,notify,unsupported=false,manual=false;
const MODE_KEY='takt:display-mode';
const native=()=>!!tg?.initData;
const supported=()=>native()&&!unsupported&&!!tg?.isVersionAtLeast?.('8.0')&&typeof tg.requestFullscreen==='function';
const full=()=>native()?!!tg.isFullscreen:!!document.fullscreenElement;
const available=()=>native()?supported():!!document.fullscreenEnabled;
const savedMode=()=>{try{return localStorage.getItem(MODE_KEY)||'auto'}catch{return 'auto'}};
const saveMode=value=>{try{localStorage.setItem(MODE_KEY,value)}catch{}};
const label=()=>translateText(full()?'Свернуть':'На весь экран',document.documentElement.lang||'ru');
export function displayButton(){return available()?`<button type="button" id="fullscreen-toggle" class="screen-button" aria-label="${label()}" title="${label()}" aria-pressed="${full()}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg><span>${label()}</span></button>`:''}
function sync(){const root=document.documentElement;for(const side of ['top','right','bottom','left']){const system=native()?Number(tg.safeAreaInset?.[side])||0:0,content=native()?Number(tg.contentSafeAreaInset?.[side])||0:0;root.style.setProperty('--takt-system-'+side,Math.max(0,system)+'px');root.style.setProperty('--takt-content-'+side,Math.max(0,content)+'px')}root.classList.toggle('is-fullscreen',full());root.dataset.displayMode=savedMode();const b=document.querySelector('#fullscreen-toggle');if(b){b.hidden=!available();b.title=label();b.setAttribute('aria-label',label());b.setAttribute('aria-pressed',String(full()));b.querySelector('span').textContent=label()}}
async function setFullscreen(want,remember=false){if(remember)saveMode(want?'fullscreen':'compact');try{if(supported()){if(want&&!full())tg.requestFullscreen();else if(!want&&full())tg.exitFullscreen();else if(!want)tg.expand()}else if(!native()&&document.fullscreenEnabled){if(want&&!full())await document.documentElement.requestFullscreen();else if(!want&&full())await document.exitFullscreen()}else if(native())tg.expand()}catch{if(manual)notify('Этот режим экрана недоступен в вашей версии Telegram.')}sync()}
async function toggle(){manual=true;await setFullscreen(!full(),true);manual=false}
export function initDisplay(app,toast){tg=app;notify=toast;tg?.ready();tg?.expand();try{tg?.setHeaderColor('#ffffff');tg?.setBackgroundColor('#f6f7fb')}catch{}for(const event of ['safeAreaChanged','contentSafeAreaChanged','fullscreenChanged','viewportChanged'])tg?.onEvent?.(event,sync);tg?.onEvent?.('fullscreenFailed',event=>{if(event?.error==='UNSUPPORTED')unsupported=true;sync();if(manual)notify('Telegram не поддерживает полный экран на этом устройстве.');manual=false});document.addEventListener('fullscreenchange',sync);window.addEventListener('resize',sync);document.addEventListener('click',event=>{if(event.target.closest('#fullscreen-toggle'))toggle()});sync();const mode=savedMode();if(mode==='fullscreen')setFullscreen(true);else if(mode==='compact')setFullscreen(false);else if(supported()&&!full())setFullscreen(true)}

