from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')

p='src/worker.js'; s=read(p)
old="A=callbackLang==='az'?{confirmed:'Qeyd təsdiqləndi ✅',declined:'Qeyd ləğv edildi',failed:'Qeydi dəyişmək mümkün olmadı'}:{confirmed:'Запись подтверждена ✅',declined:'Запись отменена',failed:'Не удалось изменить запись'};try{"
new="A=callbackLang==='az'?{confirmed:'Qeyd təsdiqləndi ✅',declined:'Qeyd ləğv edildi',late:'Gec ləğv üçün mütəxəssislə əlaqə saxlayın.',failed:'Qeydi dəyişmək mümkün olmadı'}:{confirmed:'Запись подтверждена ✅',declined:'Запись отменена',late:'Поздняя отмена согласовывается со специалистом. Напишите ему.',failed:'Не удалось изменить запись'};try{"
if old not in s: raise SystemExit('manual client callback copy marker missing')
s=s.replace(old,new,1)
old="if(b.status!=='pending')fail(409,A.failed);const status=clientBooking[2]==='confirm'?'confirmed':'cancelled'"
new="if(b.status!=='pending')fail(409,A.failed);if(clientBooking[2]==='decline'&&b.starts_at<=now()+(await config(env.DB)).cancel_hours*3600)fail(403,A.late);const status=clientBooking[2]==='confirm'?'confirmed':'cancelled'"
if old not in s: raise SystemExit('manual client cancellation cutoff marker missing')
s=s.replace(old,new,1)
old="text:callbackLang==='az'?A.failed:(e.message||A.failed),show_alert:true"
new="text:e.message||A.failed,show_alert:true"
if old not in s: raise SystemExit('manual client callback error marker missing')
s=s.replace(old,new,1)
write(p,s)

p='test/v121.test.mjs'; s=read(p)
s += """

test('specialist-created client cancellation still respects backend cancellation deadline',()=>{
 const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 assert.ok(worker.includes("clientBooking[2]==='decline'&&b.starts_at<=now()+(await config(env.DB)).cancel_hours*3600"));
 assert.ok(worker.includes('Поздняя отмена согласовывается со специалистом'));
 assert.ok(worker.includes('Gec ləğv üçün mütəxəssislə əlaqə saxlayın.'));
});
"""
write(p,s)
print('Takt 12.1 cancellation guard applied')
