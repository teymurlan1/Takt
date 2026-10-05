from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')

p='public/app-v2.js'; s=read(p)
old='<button class="account-button" data-page="more"'
new='<button class="account-button" data-page="${isClient()?\'profile\':\'more\'}"'
if old not in s: raise SystemExit('account avatar navigation marker missing')
s=s.replace(old,new,1)
write(p,s)

p='test/v121.test.mjs'; s=read(p)
s += """

test('avatar navigation is role-aware',()=>{
 const app=fs.readFileSync(new URL('../public/app-v2.js',import.meta.url),'utf8');
 assert.ok(app.includes('data-page="${isClient()?\\\'profile\\\':\\\'more\\\'}"'));
});
"""
write(p,s)
print('Takt 12.1 avatar hotfix applied')
