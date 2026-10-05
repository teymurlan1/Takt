from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def once(p,a,b):
    s=read(p)
    if a not in s: raise SystemExit(f'pattern missing: {p}: {a[:100]!r}')
    write(p,s.replace(a,b,1))

# Keep historical schema version 12. Takt 12.1 adds only idempotent additive tables.
p='src/v2.js'; s=read(p)
s=s.replace('export const schema13=[','export const schema121=[')
s=s.replace('...schema11,...schema12,...schema13\n];','...schema11,...schema12,...schema121\n];')
start=s.index('export async function ensureSchema(db){')
end=s.index('const err=',start)
ensure="""export async function ensureSchema(db){if(!initialized.has(db))initialized.set(db,(async()=>{await db.prepare('CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY)').run();await db.batch(schema121.map(sql=>db.prepare(sql)));if(await db.prepare('SELECT 1 FROM schema_versions WHERE version=12').first())return;const current=await db.prepare('SELECT 1 FROM schema_versions WHERE version=11').first();const previous=await db.prepare('SELECT 1 FROM schema_versions WHERE version IN (9,10)').first();await db.batch([...(current?schema12:previous?[...schema10,...schema11,...schema12]:schema).map(sql=>db.prepare(sql)),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(11)'),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(12)')])})().catch(e=>{initialized.delete(db);throw e}));await initialized.get(db)}\n"""
s=s[:start]+ensure+s[end:]
write(p,s)

# Complete localization for 12.1-only UI copy. Legacy hidden translation data may remain,
# but only RU/AZ are selectable and all newly visible copy has Azerbaijani equivalents.
p='public/i18n.js'; s=read(p)
marker='Object.assign(D,copy12);'
extra="""Object.assign(D,copy12);\nObject.assign(D,{\n'Мои специалисты':['Мои специалисты','Mütəxəssislərim','Мои специалисты'],\n'Выберите специалиста, к которому хотите записаться.':['Выберите специалиста, к которому хотите записаться.','Qeyd olunmaq istədiyiniz mütəxəssisi seçin.','Выберите специалиста, к которому хотите записаться.'],\n'Выбран':['Выбран','Seçilib','Выбран'],\n'Язык и оформление':['Язык и оформление','Dil və görünüş','Язык и оформление'],\n'Вопросы и поддержка':['Вопросы и поддержка','Suallar və dəstək','Вопросы и поддержка'],\n'Связаться с поддержкой':['Связаться с поддержкой','Dəstəklə əlaqə saxla','Связаться с поддержкой'],\n'Пока подключение и продление выполняются вручную. Выберите период и свяжитесь с поддержкой — администратор подтвердит подписку.':['Пока подключение и продление выполняются вручную. Выберите период и свяжитесь с поддержкой — администратор подтвердит подписку.','Hələlik qoşulma və abunəliyin uzadılması əl ilə edilir. Müddəti seçin və dəstəklə əlaqə saxlayın — administrator abunəliyi təsdiqləyəcək.','Пока подключение и продление выполняются вручную. Выберите период и свяжитесь с поддержкой — администратор подтвердит подписку.'],\n'Telegram · по желанию':['Telegram · по желанию','Telegram · istəyə görə','Telegram · по желанию'],\n'Если указать Telegram, клиент сможет безопасно привязать эту запись при следующем запуске Takt.':['Если указать Telegram, клиент сможет безопасно привязать эту запись при следующем запуске Takt.','Telegram göstərilsə, müştəri Takt-ı növbəti dəfə açanda bu qeydi təhlükəsiz şəkildə öz hesabına bağlaya biləcək.','Если указать Telegram, клиент сможет безопасно привязать эту запись при следующем запуске Takt.']\n});"""
if marker not in s: raise SystemExit('copy12 marker missing')
s=s.replace(marker,extra,1)
write(p,s)

# The landing preview also localizes weekday abbreviations.
p='public/landing.js'; s=read(p)
old='<div class="mock-week"><span>Пн</span><span>Вт</span><b>Ср</b><span>Чт</span><span>Пт</span></div>'
new='<div class="mock-week">${(lang===\'az\'?[\'Be\',\'Ça\',\'Ç\',\'Ca\',\'C\']:[\'Пн\',\'Вт\',\'Ср\',\'Чт\',\'Пт\']).map((d,i)=>i===2?`<b>${d}</b>`:`<span>${d}</span>`).join(\'\')}</div>'
if old not in s: raise SystemExit('landing weekdays marker missing')
s=s.replace(old,new,1)
write(p,s)

# Manual-username claim responses must follow the user's chosen language as well.
p='src/worker.js'; s=read(p)
old="if(manualClaim[1]==='ignore'){await env.DB.prepare('UPDATE manual_client_claims SET claimed_at=?,claimed_user_id=? WHERE booking_id=? AND claimed_at IS NULL').bind(now(),'ignored:'+cb.from.id,manualClaim[2]).run();await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:'Запись не привязана'});return json({method:'editMessageText',chat_id:cb.from.id,message_id:cb.message?.message_id,text:'Хорошо. Эта запись не привязана к вашему аккаунту Takt.'})}"
new="if(manualClaim[1]==='ignore'){const az=(await languageOf(env.DB,String(cb.from.id)))==='az';await env.DB.prepare('UPDATE manual_client_claims SET claimed_at=?,claimed_user_id=? WHERE booking_id=? AND claimed_at IS NULL').bind(now(),'ignored:'+cb.from.id,manualClaim[2]).run();await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:az?'Qeyd bağlanmadı':'Запись не привязана'});return json({method:'editMessageText',chat_id:cb.from.id,message_id:cb.message?.message_id,text:az?'Yaxşı. Bu qeyd sizin Takt hesabınıza bağlanmadı.':'Хорошо. Эта запись не привязана к вашему аккаунту Takt.'})}"
if old not in s: raise SystemExit('manual ignore marker missing')
s=s.replace(old,new,1)
write(p,s)

# Product scope changed in 12.1: only RU + AZ are selectable now.
p='test/v8.test.mjs'; s=read(p)
s=s.replace("test('8.0 supports Russian Kazakh Azerbaijani and Uzbek',()=>{for(const code of [\"'ru'\",\"'kk'\",\"'az'\",\"'uz'\"])assert.match(i18n,new RegExp(code));assert.match(app,/languageControl/)});","test('12.1 exposes Russian and Azerbaijani as the selectable product languages',()=>{assert.match(i18n,/LANGUAGES=\\[\\['ru'/);assert.match(i18n,/\\['az'/);assert.doesNotMatch(i18n,/LANGUAGES=.*'kk'/);assert.doesNotMatch(i18n,/LANGUAGES=.*'uz'/);assert.match(app,/languageControl/)});")
write(p,s)

p='test/v81.test.mjs'; s=read(p)
s=s.replace("assert.equal(pkg.version,'12.0.0')","assert.equal(pkg.version,'12.1.0')")
s=s.replace("/version:'12\\.0\\.0'/","/version:'12\\.1\\.0'/")
write(p,s)

# UI release matrix follows the currently selectable languages.
p='scripts/ui-regression.mjs'; s=read(p)
s=s.replace("for(const lang of ['ru','kk','az','uz'])","for(const lang of ['ru','az'])")
write(p,s)

# Keep lockfile metadata aligned with package version.
p='package-lock.json'; s=read(p)
s=s.replace('"version": "12.0.0"','"version": "12.1.0"',2)
write(p,s)

print('Takt 12.1 compatibility fixes applied')
