from pathlib import Path
import re
ROOT=Path('.')
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def replace_once(s,old,new,label):
 n=s.count(old)
 if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
 return s.replace(old,new,1)
def regex_once(s,pattern,repl,label):
 out,n=re.subn(pattern,lambda _m: repl,s,count=1,flags=re.S)
 if n!=1: raise SystemExit(f'{label}: expected 1 regex match, got {n}')
 return out

# Preserve primary specialist role when an existing specialist opens an invitation during first v8 consent.
a=read('public/app-v2.js')
a=replace_once(a,"if(!S.own&&S.appSettings?.role==='client'&&(previous||start==='client')){S.mode='client';if(previous)try{S.tenant=await api('/v2/page/'+previous)}catch{}S.page='client'}else","if(!S.own&&S.appSettings?.role==='client'){S.mode='client';if(previous)try{S.tenant=await api('/v2/page/'+previous)}catch{}S.page='client'}else",'client primary role')
a=replace_once(a,"await post('/v8/profile',{language:S.language,consent:true,...(S.pendingInvite?{role:'client',company_id:S.pendingInvite}:{})});","await post('/v8/profile',{language:S.language,consent:true,...(S.pendingInvite&&!S.appSettings?.role?{role:'client',company_id:S.pendingInvite}:{})});",'consent invited role guard')
write('public/app-v2.js',a)

# Queued first welcome for an invited client must keep the exact specialist context.
w=read('src/worker.js')
old="function roleWelcome(env,origin,role,lang,companyRow=null){const L=botCopy(lang),base=appButtonUrl(env,origin),help=appButtonUrl(env,origin,{guide:'1'}),support=appButtonUrl(env,origin,{support:'1'}),text=role==='specialist'?L.specialist:companyRow?L.invite(companyRow.name):L.client;"
new="function roleWelcome(env,origin,role,lang,companyRow=null){const L=botCopy(lang),context=companyRow?{company:companyRow.id}:{},base=appButtonUrl(env,origin,context),help=appButtonUrl(env,origin,{...context,guide:'1'}),support=appButtonUrl(env,origin,{...context,support:'1'}),text=role==='specialist'?L.specialist:companyRow?L.invite(companyRow.name):L.client;"
w=replace_once(w,old,new,'welcome specialist context')
write('src/worker.js',w)

# Expand full FAQ translations and additional common interface strings.
i=read('public/i18n.js')
extra=r'''Object.assign(D,{
'Добрый день':['Қайырлы күн','Salam','Assalomu alaykum'],'Записей сегодня':['Бүгінгі жазбалар','Bugünkü qeydlər','Bugungi yozuvlar'],'Стоимость записей':['Жазбалар құны','Qeydlərin dəyəri','Yozuvlar qiymati'],'Свободных окон':['Бос уақыттар','Boş vaxtlar','Bo‘sh vaqtlar'],'ВАЖНО СЕЙЧАС':['ҚАЗІР МАҢЫЗДЫ','İNDİ VACİB','HOZIR MUHIM'],'БЛИЖАЙШИЕ ЗАПИСИ':['ЖАҚЫН ЖАЗБАЛАР','YAXIN QEYDLƏR','YAQIN YOZUVLAR'],'ОТЗЫВЫ':['ПІКІРЛЕР','RƏYLƏR','FIKRLAR'],'УСЛУГИ':['ҚЫЗМЕТТЕР','XİDMƏTLƏR','XIZMATLAR'],'МЕСТО ВСТРЕЧИ':['КЕЗДЕСУ ОРНЫ','GÖRÜŞ YERİ','UCHRASHUV JOYI'],'Нет предстоящих визитов':['Алдағы келулер жоқ','Gələcək görüş yoxdur','Kelgusi tashrif yo‘q'],'История и заметка':['Тарих және жазба','Tarixçə və qeyd','Tarix va eslatma'],'Ваша личная заметка':['Жеке жазбаңыз','Şəxsi qeydiniz','Shaxsiy eslatmangiz'],'Сохранить заметку':['Жазбаны сақтау','Qeydi yadda saxla','Eslatmani saqlash'],'Новый клиент':['Жаңа клиент','Yeni müştəri','Yangi mijoz'],'Выбрать услугу':['Қызметті таңдау','Xidmət seç','Xizmatni tanlash'],'Кого записать?':['Кімді жазамыз?','Kimi qeyd edək?','Kimni yozamiz?'],'Выберите дату и время':['Күн мен уақытты таңдаңыз','Tarix və vaxt seçin','Sana va vaqtni tanlang'],'Продолжить':['Жалғастыру','Davam et','Davom etish'],'Подтвердить запись':['Жазбаны растау','Qeydi təsdiqlə','Yozuvni tasdiqlash'],'Запись создана':['Жазба жасалды','Qeyd yaradıldı','Yozuv yaratildi'],'Запись подтверждена':['Жазба расталды','Qeyd təsdiqləndi','Yozuv tasdiqlandi'],'Запись отменена':['Жазба тоқтатылды','Qeyd ləğv edildi','Yozuv bekor qilindi'],'Запись завершена':['Жазба аяқталды','Qeyd tamamlandı','Yozuv yakunlandi'],'Запись перенесена':['Жазба ауыстырылды','Qeyd köçürüldü','Yozuv ko‘chirildi'],'Оставить отзыв':['Пікір қалдыру','Rəy yaz','Fikr qoldirish'],'Отправить отзыв':['Пікірді жіберу','Rəyi göndər','Fikrni yuborish'],'Написать клиенту':['Клиентке жазу','Müştəriyə yaz','Mijozga yozish'],'Отправить через Takt':['Takt арқылы жіберу','Takt ilə göndər','Takt orqali yuborish'],'Открыть личный чат в Telegram':['Telegram-дағы жеке чатты ашу','Telegram-da şəxsi çatı aç','Telegramdagi shaxsiy chatni ochish'],'Сохранить услугу':['Қызметті сақтау','Xidməti yadda saxla','Xizmatni saqlash'],'Новая услуга':['Жаңа қызмет','Yeni xidmət','Yangi xizmat'],'Редактировать услугу':['Қызметті өңдеу','Xidməti redaktə et','Xizmatni tahrirlash'],'Закрыть период':['Кезеңді жабу','Dövrü bağla','Davrni yopish'],'Правила записи':['Жазылу ережелері','Qeyd qaydaları','Yozilish qoidalari'],'Уведомления':['Хабарламалар','Bildirişlər','Bildirishnomalar'],'Часовой пояс':['Уақыт белдеуі','Saat qurşağı','Vaqt mintaqasi'],'Интерфейс':['Интерфейс','İnterfeys','Interfeys'],'Место работы':['Жұмыс орны','İş yeri','Ish joyi'],'Выходные и отпуск':['Демалыс және отпуск','İstirahət və məzuniyyət','Dam olish va ta’til'],'Профессия':['Мамандық','Peşə','Kasb'],'Описание':['Сипаттама','Təsvir','Tavsif'],'Телефон':['Телефон','Telefon','Telefon'],'Адрес':['Мекенжай','Ünvan','Manzil'],'Как пройти':['Қалай жетуге болады','Necə gəlmək olar','Qanday borish'],'Открыть документ':['Құжатты ашу','Sənədi aç','Hujjatni ochish'],'Написать в поддержку':['Қолдауға жазу','Dəstəyə yaz','Yordamga yozish'],'Сообщение отправлено клиенту':['Хабарлама клиентке жіберілді','Mesaj müştəriyə göndərildi','Xabar mijozga yuborildi'],'Обращение отправлено в поддержку':['Өтініш қолдауға жіберілді','Müraciət dəstəyə göndərildi','Murojaat yordamga yuborildi']
});
'''
i=replace_once(i,"const translated=(text,lang)=>",extra+"const translated=(text,lang)=>",'extra translations')
full_faq=r'''export function faqCopy(lang='ru'){const rows={
 ru:[['Как клиент записывается ко мне?','Отправьте персональную ссылку из раздела «Моя ссылка». Клиент сразу попадёт в Takt к вашему профилю.'],['Как подтвердить новую запись?','Нажмите «Подтвердить» в Telegram или в блоке «Требуют внимания» на главной.'],['Как закрыть выходной или отпуск?','Откройте настройки расписания или кнопку «Закрыть время», выберите дату или период.'],['Как изменить рабочие часы?','В настройках откройте «Расписание». Можно добавить несколько интервалов в день и перерывы между ними.'],['Как написать клиенту?','В карточке клиента нажмите «Написать». Если прямой Telegram недоступен, сообщение отправит бот Takt.'],['Что делать, если уведомления не приходят?','Откройте Takt через Telegram, разрешите сообщения боту и проверьте раздел «Уведомления» в настройках.'],['Как работают отзывы?','После завершённой записи клиент получает предложение оставить отзыв. Один визит — один отзыв.'],['Что будет после окончания подписки?','Данные не удаляются. Доступ можно возобновить, после чего записи и функции снова станут доступны.']],
 kk:[['Клиент маған қалай жазылады?','«Менің сілтемем» бөлімінен жеке сілтемені жіберіңіз. Клиент Takt ішінде бірден сіздің профиліңізге түседі.'],['Жаңа жазбаны қалай растаймын?','Telegram-дағы «Растау» батырмасын немесе басты беттегі «Назар аударуды қажет етеді» блогын пайдаланыңыз.'],['Демалыс немесе отпускты қалай жабамын?','Кесте баптауларын немесе «Уақытты жабу» батырмасын ашып, күнді не кезеңді таңдаңыз.'],['Жұмыс уақытын қалай өзгертемін?','Баптаулардан «Кесте» бөлімін ашыңыз. Бір күнге бірнеше интервал және олардың арасында үзіліс қосуға болады.'],['Клиентке қалай жазамын?','Клиент карточкасында «Жазу» батырмасын басыңыз. Жеке Telegram қолжетімсіз болса, хабарламаны Takt боты жеткізеді.'],['Еске салулар келмесе не істеу керек?','Takt-ты Telegram арқылы ашып, бот хабарламаларына рұқсат беріңіз және «Хабарламалар» бөлімін тексеріңіз.'],['Пікірлер қалай жұмыс істейді?','Аяқталған жазбадан кейін клиентке пікір қалдыру ұсынылады. Бір келу — бір пікір.'],['Жазылым аяқталса не болады?','Деректер жойылмайды. Қолжетімділікті қайта қосқаннан кейін жазбалар мен функциялар қайта жұмыс істейді.']],
 az:[['Müştəri mənə necə qeyd olunur?','«Mənim linkim» bölməsindən şəxsi linki göndərin. Müştəri Takt-da birbaşa sizin profilinizə düşəcək.'],['Yeni qeydi necə təsdiqləyim?','Telegram-da «Təsdiqlə» düyməsini və ya əsas səhifədə «Diqqət tələb edir» blokunu istifadə edin.'],['İstirahət və ya məzuniyyəti necə bağlayım?','Cədvəl parametrlərini və ya «Vaxtı bağla» düyməsini açıb tarix və ya dövr seçin.'],['İş saatlarını necə dəyişdirim?','Parametrlərdə «Cədvəl» bölməsini açın. Gün ərzində bir neçə interval və fasilə əlavə etmək olar.'],['Müştəriyə necə yaza bilərəm?','Müştəri kartında «Yaz» düyməsini basın. Birbaşa Telegram mümkün deyilsə, mesajı Takt botu çatdıracaq.'],['Bildirişlər gəlmirsə nə etməli?','Takt-ı Telegram vasitəsilə açın, bot mesajlarına icazə verin və «Bildirişlər» bölməsini yoxlayın.'],['Rəylər necə işləyir?','Tamamlanmış qeyddən sonra müştəriyə rəy yazmaq təklif olunur. Bir görüş — bir rəy.'],['Abunə bitəndə nə olur?','Məlumatlar silinmir. Girişi bərpa etdikdən sonra qeydlər və funksiyalar yenidən işləyəcək.']],
 uz:[['Mijoz menga qanday yoziladi?','«Mening havolam» bo‘limidan shaxsiy havolani yuboring. Mijoz Takt ichida darhol sizning profilingizga tushadi.'],['Yangi yozuvni qanday tasdiqlayman?','Telegram-dagi «Tasdiqlash» tugmasini yoki bosh sahifadagi «E’tibor talab qiladi» blokini ishlating.'],['Dam olish yoki ta’tilni qanday yopaman?','Jadval sozlamalarini yoki «Vaqtni yopish» tugmasini ochib, sana yoki davrni tanlang.'],['Ish vaqtini qanday o‘zgartiraman?','Sozlamalardan «Jadval» bo‘limini oching. Bir kunda bir nechta interval va ular orasida tanaffus qo‘shish mumkin.'],['Mijozga qanday yozaman?','Mijoz kartasida «Yozish» tugmasini bosing. To‘g‘ridan-to‘g‘ri Telegram mavjud bo‘lmasa, xabarni Takt boti yetkazadi.'],['Bildirishnomalar kelmasa nima qilish kerak?','Takt-ni Telegram orqali oching, bot xabarlariga ruxsat bering va «Bildirishnomalar» bo‘limini tekshiring.'],['Fikrlar qanday ishlaydi?','Yakunlangan yozuvdan so‘ng mijozga fikr qoldirish taklif qilinadi. Bir tashrif — bir fikr.'],['Obuna tugasa nima bo‘ladi?','Ma’lumotlar o‘chirilmaydi. Kirishni tiklagandan keyin yozuvlar va funksiyalar yana ishlaydi.']]
};return rows[lang]||rows.ru}
'''
i=regex_once(i,r"export function faqCopy\(lang='ru'\)\{[\s\S]*$",full_faq,'full faq translations')
write('public/i18n.js',i)

# Static regression tests for the major Takt 8.0 promises.
write('test/v8.test.mjs',r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const v3=fs.readFileSync(new URL('../src/v3.js',import.meta.url),'utf8');
const v2=fs.readFileSync(new URL('../src/v2.js',import.meta.url),'utf8');
const delivery=fs.readFileSync(new URL('../src/delivery.js',import.meta.url),'utf8');
const i18n=fs.readFileSync(new URL('../public/i18n.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/takt-v8.css',import.meta.url),'utf8');

test('8.0 first run stores language role consent versions and theme',()=>{assert.match(v2,/user_app_settings/);assert.match(worker,/\/api\/v8\/profile/);assert.match(worker,/LEGAL_VERSIONS/);assert.match(app,/showOnboarding\('language'\)/);assert.match(app,/accept-consent/);assert.match(app,/data-onboard-role/)});
test('8.0 supports Russian Kazakh Azerbaijani and Uzbek',()=>{for(const code of ["'ru'","'kk'","'az'","'uz'"])assert.match(i18n,new RegExp(code));assert.match(app,/languageControl/)});
test('8.0 persists full dark theme',()=>{assert.match(css,/html\[data-theme="dark"\]/);assert.match(app,/themeControl/);assert.match(i18n,/applyTheme/)});
test('8.0 specialist links go directly to Telegram and preserve exact specialist',()=>{assert.match(app,/https:\/\/t\.me\/takt_service_bot\?startapp=/);assert.match(worker,/startapp=u_/);assert.match(worker,/companyRow\?\{company:companyRow\.id\}/)});
test('8.0 specialist can confirm or decline a new booking in Telegram',()=>{assert.match(delivery,/booking:\$\{b\.id\}:confirm/);assert.match(delivery,/booking:\$\{b\.id\}:decline/);assert.match(worker,/booking:\(\[a-z0-9-\]\+\):\(confirm\|decline\)/)});
test('8.0 client booking status messages are visually distinct',()=>{assert.match(v3,/🟡 Запись создана/);assert.match(v3,/✅ Запись подтверждена/);assert.match(v3,/❌ Запись отменена/);assert.match(v3,/🏁 Запись завершена/)});
test('8.0 review request is edited to thanks when possible',()=>{assert.match(v2,/telegram_review_messages/);assert.match(delivery,/telegram_review_messages/);assert.match(worker,/editMessageText/);assert.match(worker,/Спасибо за отзыв/)});
test('8.0 default booking horizon is three months while settings remain configurable',()=>{assert.match(v3,/horizon:90/);assert.match(app,/3 месяца · стандарт/);assert.match(app,/180/)});
test('8.0 month calendar carries chosen date into manual booking',()=>{assert.match(app,/data-manual-date/);assert.match(app,/manualDate=el\.dataset\.manualDate;S\.date=manualDate/);assert.match(app,/Дата: \$\{dateLabel\(targetDate\)\}/)});
test('8.0 dashboard order is attention then quick actions then nearest bookings',()=>{const fn=app.slice(app.indexOf('function dashboard'),app.indexOf('function calendarDaySheet'));assert.ok(fn.indexOf('${attentionBlock}')<fn.indexOf('Быстрые действия'));assert.ok(fn.indexOf('Быстрые действия')<fn.indexOf('${nextBlock}'))});
test('8.0 call and message actions use shared handlers',()=>{assert.match(app,/function callClient/);assert.match(app,/data-call=/);assert.match(app,/async function clientMessageEditor/)});
test('8.0 help legal documents and subscription value are available',()=>{assert.match(app,/function helpPage/);assert.match(app,/function legalPage/);assert.match(app,/subscriptionStats/);assert.match(worker,/subscription-stats/)});
''')

print('Takt 8.0 finalizer applied')
