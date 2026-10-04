from pathlib import Path
import re
p=Path('public/app-v2.js')
s=p.read_text(encoding='utf-8')

def one(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise RuntimeError(f'{label}: expected 1, got {n}')
    s=s.replace(old,new,1)

# Keep the More tab active on subscription and return Back to More.
s=s.replace("['services','settings','share','analytics','profile']","['services','settings','share','analytics','subscription','profile']")

one("['reminders','Напоминания клиентам за 24 часа']","['reminders','Подтверждение визита клиентом за 24 часа']",'24h settings label')

# Booking success: no manual permission instructions; write access is requested automatically in flow.
old="!b.manual?'<p class=\"note\">'+(messageAllowed?'Подтверждение придёт в Telegram. Напоминания включены.':'Для сообщений нажмите «Разрешить уведомления» или /start в чате бота.')+'</p>'+(!messageAllowed?'<button class=\"secondary\" id=\"notifications\">Разрешить уведомления</button>':''):''"
new="!b.manual?'<p class=\"note\">Подтверждение и напоминания отправляются автоматически в Telegram.</p>':''"
one(old,new,'booking success notification copy')

# Profile should not ask the user to manually enable bot messages.
pattern=r"function profile\(\)\{return `.*?`\}\nfunction openSheet"
replacement="""function profile(){return `${heading(isClient()?'Мой профиль':'Помощь и аккаунт',isClient()?'Всё для ваших визитов.':'Такт всегда под рукой.')}<section class=\"editor-card\">${imageTag('',S.me?.name)}<h2>${esc(S.me?.name||'Гость')}</h2><p class=\"note\">${isClient()?'Ваши записи доступны только вам и специалисту. Уведомления приходят автоматически после запуска бота.':'Вы управляете только своим пространством. Уведомления Takt работают автоматически.'}</p><div class=\"actions\"><button class=\"secondary\" id=\"guide\">Короткое знакомство</button></div></section>${!isClient()&&S.me?.owner?'<section class=\"editor-card\"><h3>Подключение Telegram · владелец</h3><button class=\"secondary\" id=\"connect-bot\">Обновить настройки бота</button></section>':''}`}
function openSheet"""
s,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1: raise RuntimeError(f'profile polish: expected 1, got {n}')

# Delivery status stays informative without telling users to press /start or grant permissions manually.
pattern=r"async function loadDeliveryStatus\(\)\{.*?\}\n\nasync function loadClientNext"
replacement="""async function loadDeliveryStatus(){try{const x=await api('/v4/delivery?company='+S.own.id),target=document.querySelector('#delivery-status');if(target){const issue=(x.blocked||0)+(x.failed||0)+(x.unknown||0)+(x.sending||0);target.textContent=issue?'Есть сообщения без подтверждённой доставки. Takt продолжит обработку автоматически.':'Уведомления работают автоматически.'}}catch{}}

async function loadClientNext"""
s,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1: raise RuntimeError(f'delivery status polish: expected 1, got {n}')

# Show attendance inside booking details too, not only on dashboard/list.
old='<span class="badge ${b.status}">${labels[b.status]}</span><p>${esc(b.name)} · ${esc(b.phone)}</p>'
new='<span class="badge ${b.status}">${labels[b.status]}</span>${admin?(()=>{const a=attendanceInfo(b);return `<span class="attendance visit-confirmation ${a[0]}">${a[1]}</span>`})():\'\'}<p>${esc(b.name)} · ${esc(b.phone)}</p>'
one(old,new,'booking details attendance')

one("'Получите напоминания за 24 и 2 часа 🔔'","'За 24 часа подтвердите визит, за 2 часа Takt напомнит 🔔'",'client intro confirmation')

p.write_text(s,encoding='utf-8')
print('Takt 6 UI polish applied')
