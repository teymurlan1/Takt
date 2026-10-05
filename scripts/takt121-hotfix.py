from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')

# Specialist avatar opens the main cabinet/More area; client avatar still opens Profile.
p='public/app-v2.js'; s=read(p)
old='<button class="account-button" data-page="more"'
new='<button class="account-button" data-page="${isClient()?\'profile\':\'more\'}"'
if old not in s: raise SystemExit('account avatar navigation marker missing')
s=s.replace(old,new,1)
write(p,s)

# Takt 12.1 only exposes RU/AZ. Clamp legacy stored languages during Telegram delivery too,
# including messages already waiting in the outbox from an older version.
p='src/delivery.js'; s=read(p)
old="const deliveryCopy=lang=>DELIVERY_COPY[lang]||DELIVERY_COPY.ru;"
new="const supportedLang=lang=>lang==='az'?'az':'ru';\nconst deliveryCopy=lang=>DELIVERY_COPY[supportedLang(lang)];"
if old not in s: raise SystemExit('delivery copy marker missing')
s=s.replace(old,new,1)
old="const id=`${b.id}:${event.key}:${b.starts_at}${event.admin?':'+b.recipient:''}`,lang=(await db.prepare(\"SELECT language FROM user_app_settings WHERE user_id=?\").bind(String(b.recipient)).first())?.language||'ru';"
new="const id=`${b.id}:${event.key}:${b.starts_at}${event.admin?':'+b.recipient:''}`,lang=supportedLang((await db.prepare(\"SELECT language FROM user_app_settings WHERE user_id=?\").bind(String(b.recipient)).first())?.language);"
if old not in s: raise SystemExit('reminder language marker missing')
s=s.replace(old,new,1)
old="const base=env.APP_URL||'https://takt.teymurstudent.workers.dev';for(const member of members){const lang=(await db.prepare('SELECT language FROM user_app_settings WHERE user_id=?').bind(String(member.user_id)).first())?.language||'ru',L=deliveryCopy(lang),button="
new="const base=env.APP_URL||'https://takt.teymurstudent.workers.dev';for(const member of members){const lang=supportedLang((await db.prepare('SELECT language FROM user_app_settings WHERE user_id=?').bind(String(member.user_id)).first())?.language),L=deliveryCopy(lang),button="
if old not in s: raise SystemExit('summary language marker missing')
s=s.replace(old,new,1)
old="const summary=payload.takt_summary;delete payload.takt_summary;if(summary){"
new="const summary=payload.takt_summary;delete payload.takt_summary;const queuedMeta=payload.takt;if(queuedMeta)queuedMeta.lang=supportedLang(queuedMeta.lang);if(summary){"
if old not in s: raise SystemExit('queued metadata language marker missing')
s=s.replace(old,new,1)
write(p,s)

p='test/v121.test.mjs'; s=read(p)
s += """

test('avatar navigation is role-aware',()=>{
 const app=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');
 assert.ok(app.includes('data-page="${isClient()?\\\'profile\\\':\\\'more\\\'}"'));
});

test('Telegram delivery clamps legacy languages to Russian or Azerbaijani',()=>{
 const delivery=fs.readFileSync(new URL('../src/delivery.js',import.meta.url),'utf8');
 assert.ok(delivery.includes("const supportedLang=lang=>lang==='az'?'az':'ru'"));
 assert.ok(delivery.includes('if(queuedMeta)queuedMeta.lang=supportedLang(queuedMeta.lang)'));
});
"""
write(p,s)
print('Takt 12.1 final hotfixes applied')
