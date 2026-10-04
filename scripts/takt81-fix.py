from pathlib import Path

# Fix one missing closing parenthesis in the specialist review notification queue.
p=Path('src/worker.js');s=p.read_text()
old="reply_markup:{inline_keyboard:[[{text:R.open,style:'primary',web_app:{url:openUrl}}]]}}))}if(ops.length)await db.batch(ops);"
new="reply_markup:{inline_keyboard:[[{text:R.open,style:'primary',web_app:{url:openUrl}}]]}})))}if(ops.length)await db.batch(ops);"
if old not in s: raise SystemExit('review notification syntax anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

# Takt 8.1 intentionally removes bot-mediated specialist/client chat.
p=Path('test/v72.test.mjs');s=p.read_text()
s=s.replace("assert.match(app,/Отправить через Takt/)","assert.match(app,/Личный Telegram клиента/)")
p.write_text(s)
print('Takt 8.1 follow-up fixes applied')
