from pathlib import Path
p=Path('test/v3.test.mjs')
s=p.read_text(encoding='utf-8')
old="assert.equal(r.headers.get('location'),'https://example.com/?username=davud')"
new="assert.equal(r.headers.get('location'),'https://t.me/takt_service_bot?startapp=u_davud')"
if s.count(old)!=1: raise SystemExit('expected old short-link assertion once')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('Updated short-link regression for direct Telegram deep link')
