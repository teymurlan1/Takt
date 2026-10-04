from pathlib import Path
import json

P=Path('.')
def r(p): return (P/p).read_text(encoding='utf-8')
def w(p,s): (P/p).write_text(s,encoding='utf-8')
def once(s,a,b,label):
    c=s.count(a)
    if c!=1: raise RuntimeError(f'{label}: {c} matches')
    return s.replace(a,b,1)

# delivery: route only at 2h reminder
p='src/delivery.js'; s=r(p)
s=once(s,"if(!meta.admin&&route&&['reminder','client_2h'].includes(meta.event))payload.reply_markup.inline_keyboard.push([{text:'📍 Построить маршрут',url:route}]);","if(!meta.admin&&route&&meta.event==='client_2h')payload.reply_markup.inline_keyboard.push([{text:'📍 Построить маршрут',url:route}]);",'route reminder')
w(p,s)

# worker: callback UX + auto webhook + version
p='src/worker.js'; s=r(p)
a=s.find("if(cb?.id&&Number.isSafeInteger(cb.from?.id)&&typeof cb.data==='string')")
b=s.find("if(m?.chat?.type!=='private'",a)
if a<0 or b<0: raise RuntimeError('callback block not found')
cb=r"""if(cb?.id&&Number.isSafeInteger(cb.from?.id)&&typeof cb.data==='string'){const hit=cb.data.match(/^visit:([a-z0-9-]+):(yes|no)$/);if(hit){try{const result=await respondAttendance(env.DB,String(cb.from.id),hit[1],hit[2]==='yes'?'coming':'not_coming'),feedback=result.attendance_state==='coming'?'✅ Вы подтвердили визит':result.late?'⚠️ Вы сообщили, что не сможете прийти. Специалист уведомлён.':'❌ Запись отменена';await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:result.attendance_state==='coming'?'Спасибо, визит подтверждён ✅':result.late?'Специалист уведомлён':'Запись отменена'});if(cb.message?.chat?.id&&cb.message?.message_id){const original=String(cb.message.text||'Напоминание о записи').replace(/\n\n(?:✅ Вы подтвердили визит|⚠️ Вы сообщили[\s\S]*|❌ Запись отменена)$/,'');await telegram(env,'editMessageText',{chat_id:cb.message.chat.id,message_id:cb.message.message_id,text:(original+'\n\n'+feedback).slice(0,4096),reply_markup:{inline_keyboard:[]}}).catch(()=>{});}}catch(e){await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id,text:e.message||'Не удалось сохранить ответ',show_alert:true}).catch(()=>{});}return json({ok:true})}}
 """
s=s[:a]+cb+s[b:]
s=once(s,"if(path==='/api/health')return json({ok:true,version:'6.0.0'});","if(path==='/api/health')return json({ok:true,version:'6.1.0'});",'health version')
sa=s.find(' async scheduled(_event,env,ctx){')
se=s.rfind('\n};')
if sa<0 or se<0: raise RuntimeError('scheduled block not found')
scheduled=r""" async scheduled(_event,env,ctx){await ensureSchema(env.DB);ctx.waitUntil((async()=>{if(env.BOT_TOKEN&&!await env.DB.prepare("SELECT 1 FROM task_runs WHERE name='bot-webhook-v61' AND state='ok'").first()){try{await trackedTask(env.DB,'bot-webhook-v61',async()=>{const secret=await webhookSecret(env),appUrl=new URL(env.APP_URL||'https://takt.teymurstudent.workers.dev');await telegram(env,'setWebhook',{url:new URL('/api/telegram/webhook',appUrl).href,secret_token:secret,allowed_updates:['message','callback_query']})})}catch{}}if(env.BOT_TOKEN&&!await env.DB.prepare("SELECT 1 FROM task_runs WHERE name='bot-menu-v5' AND state='ok'").first()){try{await trackedTask(env.DB,'bot-menu-v5',()=>telegram(env,'setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть Takt',web_app:{url:env.APP_URL||'https://takt.teymurstudent.workers.dev'}}}))}catch{}}await trackedTask(env.DB,'notifications',()=>deliver(env))})())}
};"""
s=s[:sa]+scheduled+s[se+3:]
w(p,s)

p='package.json'; data=json.loads(r(p)); data['version']='6.1.0'; w(p,json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
print('Takt 6.1 server patch applied')
