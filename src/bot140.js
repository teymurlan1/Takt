import {requireAdmin} from './control-auth.js';
import {escHtml} from './v3.js';
// 14.0 — тексты бота, которые админ меняет без деплоя: версии, предпросмотр, откат. Разрешены только <b> и <i>.
export const BOT_KEYS={help_specialist:'helpSpecialist',help_client:'helpClient',welcome_first:'first',support_ask:'support_ask'};
export const LANGS=['ru','kk','az','uz'],MAX_TEXT=1500;
export const schema143=[
`CREATE TABLE IF NOT EXISTS bot_texts(key TEXT NOT NULL,lang TEXT NOT NULL,text TEXT NOT NULL,version INTEGER NOT NULL,updated_by TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(key,lang))`,
`CREATE TABLE IF NOT EXISTS bot_text_history(id INTEGER PRIMARY KEY AUTOINCREMENT,key TEXT NOT NULL,lang TEXT NOT NULL,text TEXT NOT NULL,version INTEGER NOT NULL,actor TEXT NOT NULL,created_at INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS bot_text_history_key ON bot_text_history(key,lang,id DESC)`];
export async function ensure143(db){if(await db.prepare('SELECT 1 FROM schema_versions WHERE version=143').first())return;await db.batch([...schema143.map(s=>db.prepare(s)),db.prepare('INSERT OR IGNORE INTO schema_versions VALUES(143)')])}
const now=()=>Math.floor(Date.now()/1000);
// Экранирует всё, кроме парных <b>/<i>; возвращает null, если теги не сбалансированы (Telegram отклонит такое сообщение).
export function safeHtml(text){const raw=String(text??'');const tags=[...raw.matchAll(/<(\/?)(b|i)>/g)];let depth={b:0,i:0};for(const m of tags){depth[m[2]]+=m[1]?-1:1;if(depth[m[2]]<0)return null}if(depth.b||depth.i)return null;
 return escHtml(raw).replace(/&lt;(\/?)(b|i)&gt;/g,'<$1$2>')}
export async function botTextOverride(db,key,lang){try{const r=await db.prepare("SELECT text FROM bot_texts WHERE key=? AND lang=? AND text<>''").bind(key,lang).first();return r?.text?safeHtml(r.text):null}catch{return null}}
export async function saveBotText(db,actor,key,lang,text){
 if(!BOT_KEYS[key]||!LANGS.includes(lang))return {ok:false,reason:'key'};const tx=String(text??'').slice(0,MAX_TEXT+1);if(tx.length>MAX_TEXT)return {ok:false,reason:'long'};if(tx&&safeHtml(tx)===null)return {ok:false,reason:'tags'};
 const cur=await db.prepare('SELECT version FROM bot_texts WHERE key=? AND lang=?').bind(key,lang).first(),v=(cur?.version||0)+1,t=now();
 await db.batch([db.prepare('INSERT INTO bot_texts(key,lang,text,version,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(key,lang) DO UPDATE SET text=excluded.text,version=excluded.version,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(key,lang,tx,v,String(actor),t),db.prepare('INSERT INTO bot_text_history(key,lang,text,version,actor,created_at) VALUES(?,?,?,?,?,?)').bind(key,lang,tx,v,String(actor),t),db.prepare('INSERT INTO admin_audit(id,actor,action,target,before_value,after_value,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),String(actor),'bot.text',key+':'+lang,String(v-1),String(v),t)]);return {ok:true,version:v}}
export async function rollbackBotText(db,actor,key,lang){
 const rows=(await db.prepare('SELECT text FROM bot_text_history WHERE key=? AND lang=? ORDER BY id DESC LIMIT 2').bind(key,lang).all()).results;if(!rows.length)return {ok:false,reason:'none'};
 return saveBotText(db,actor,key,lang,rows.length>1?rows[1].text:'')}
export async function apiBot(req,env,user,h){
 const u=new URL(req.url),p=u.pathname;if(!p.startsWith('/api/v140/admin/bot'))return null;const db=env.DB;
 try{await requireAdmin(db,env,user.id,'content')}catch(e){h.fail(e.status||403,e.message||'Нет доступа')}
 const ERR={key:'Неизвестный текст или язык',long:'Слишком длинный текст (до '+MAX_TEXT+' символов)',tags:'Разрешены только парные теги <b> и <i>',none:'Нет предыдущей версии'};
 if(p==='/api/v140/admin/bot-texts'&&req.method==='GET'){
  const rows=(await db.prepare('SELECT key,lang,text,version,updated_at FROM bot_texts').all()).results,by=new Map(rows.map(r=>[r.key+':'+r.lang,r]));
  return h.json({keys:Object.keys(BOT_KEYS).map(key=>({key,langs:Object.fromEntries(LANGS.map(lang=>{const o=by.get(key+':'+lang),def=key==='support_ask'?h.supportAsk(lang):(h.botCopy(lang)[BOT_KEYS[key]]||'');return [lang,{default:def,override:o&&o.text?o.text:'',version:o?.version||0}]}))}))});
 }
 if(p==='/api/v140/admin/bot-texts'&&req.method==='POST'){const b=await h.body(req),r=await saveBotText(db,user.id,String(b.key||''),String(b.lang||''),b.text);if(!r.ok)h.fail(400,ERR[r.reason]);return h.json(r)}
 if(p==='/api/v140/admin/bot-texts/rollback'&&req.method==='POST'){const b=await h.body(req),r=await rollbackBotText(db,user.id,String(b.key||''),String(b.lang||''));if(!r.ok)h.fail(400,ERR[r.reason]||'Не удалось');return h.json(r)}
 if(p==='/api/v140/admin/bot-texts/preview'&&req.method==='POST'){const b=await h.body(req),html=safeHtml(String(b.text||'').slice(0,MAX_TEXT));if(html===null)h.fail(400,ERR.tags);return h.json({html})}
 return null;
}
