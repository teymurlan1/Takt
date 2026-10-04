export const schema5=[
`CREATE TABLE IF NOT EXISTS registrations(company_id TEXT PRIMARY KEY REFERENCES companies(id),created_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS telegram_contacts(user_id TEXT PRIMARY KEY,state TEXT NOT NULL,updated_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS task_runs(name TEXT PRIMARY KEY,started_at INTEGER NOT NULL,finished_at INTEGER,state TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS operational_errors(id TEXT PRIMARY KEY,kind TEXT NOT NULL,code TEXT NOT NULL,created_at INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS outbox_pending ON outbox(sent_at,attempts,lease_until,created_at)`,
`CREATE INDEX IF NOT EXISTS errors_created ON operational_errors(created_at)`,
`CREATE TABLE IF NOT EXISTS account_activity(user_id TEXT PRIMARY KEY,first_seen INTEGER NOT NULL,last_seen INTEGER NOT NULL)`
];
const now=()=>Math.floor(Date.now()/1000);
export async function recordError(db,kind,code){try{await db.prepare('INSERT INTO operational_errors VALUES(?,?,?,?)').bind(crypto.randomUUID(),kind,String(code).slice(0,50),now()).run()}catch{}}
export async function resumeBlocked(db,id){await db.prepare(`UPDATE outbox SET attempts=0,lease_until=0 WHERE chat_id=? AND sent_at IS NULL AND created_at>? AND EXISTS(SELECT 1 FROM delivery_state d WHERE d.id=outbox.id AND d.state='blocked')`).bind(String(id),now()-86400).run()}
export async function contact(db,id,state){await db.prepare('INSERT INTO telegram_contacts VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at').bind(String(id),state,now()).run()}
export async function overview(db){
 const totals=await db.prepare(`SELECT (SELECT COUNT(DISTINCT company_id) FROM memberships) specialists,(SELECT COUNT(DISTINCT user_id) FROM bookings) clients,(SELECT COUNT(*) FROM bookings) bookings,(SELECT COUNT(*) FROM registrations WHERE created_at>?) registrations,(SELECT COUNT(*) FROM account_activity WHERE last_seen>?) active`).bind(now()-86400,now()-86400).first();
 const delivery=(await db.prepare(`SELECT CASE WHEN o.sent_at IS NOT NULL THEN COALESCE(d.state,'sent') WHEN d.state='sending' AND o.lease_until<unixepoch() THEN 'unknown' WHEN d.state IS NOT NULL THEN d.state WHEN o.attempts>=5 THEN 'unknown' ELSE 'queued' END state,COUNT(*) count FROM outbox o LEFT JOIN delivery_state d ON d.id=o.id WHERE o.created_at>? GROUP BY 1`).bind(now()-86400).all()).results;
 const errors=(await db.prepare('SELECT kind,code,COUNT(*) count,MAX(created_at) last_at FROM operational_errors WHERE created_at>? GROUP BY kind,code ORDER BY last_at DESC LIMIT 20').bind(now()-86400).all()).results;
 const tasks=(await db.prepare('SELECT * FROM task_runs ORDER BY name').all()).results;
 return {totals,delivery,errors,tasks,checked_at:now()};
}
export async function trackedTask(db,name,run){await db.prepare('INSERT INTO task_runs VALUES(?,?,NULL,?) ON CONFLICT(name) DO UPDATE SET started_at=excluded.started_at,finished_at=NULL,state=excluded.state').bind(name,now(),'running').run();try{await run();await db.prepare('UPDATE task_runs SET finished_at=?,state=? WHERE name=?').bind(now(),'ok',name).run()}catch(e){await recordError(db,'scheduled','DELIVERY_FAILED');await db.prepare('UPDATE task_runs SET finished_at=?,state=? WHERE name=?').bind(now(),'error',name).run();throw e}}
