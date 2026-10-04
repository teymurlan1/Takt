const now=()=>Math.floor(Date.now()/1000);
const clean=(v,n=1200)=>typeof v==='string'?v.trim().slice(0,n):'';
const publicName=name=>{const p=String(name||'Клиент').trim().split(/\s+/).filter(Boolean);return p.length>1?`${p[0]} ${Array.from(p[1])[0]||''}.`:p[0]||'Клиент'};

export const schema7=[
`CREATE TABLE IF NOT EXISTS reviews(booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,user_id TEXT NOT NULL,client_name TEXT NOT NULL,service_name TEXT NOT NULL,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),text TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL)`,
`CREATE INDEX IF NOT EXISTS reviews_company_time ON reviews(company_id,created_at DESC)`,
`CREATE TABLE IF NOT EXISTS telegram_booking_messages(booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,chat_id TEXT NOT NULL,message_id INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(booking_id,chat_id))`
];

export async function reviewSummary(db,companyId,limit=3){
 const stats=await db.prepare('SELECT COUNT(*) count,COALESCE(ROUND(AVG(rating),1),0) average FROM reviews WHERE company_id=?').bind(companyId).first()||{count:0,average:0};
 const n=Math.max(0,Math.min(100,Number(limit)||3));
 const rows=n?(await db.prepare('SELECT booking_id,client_name,service_name,rating,text,created_at FROM reviews WHERE company_id=? ORDER BY created_at DESC LIMIT ?').bind(companyId,n).all()).results:[];
 return {count:Number(stats.count)||0,average:Number(stats.average)||0,items:rows.map(x=>({...x,client_name:publicName(x.client_name)}))};
}

export async function createReview(db,userId,input){
 const bookingId=clean(input?.booking_id,80),rating=Number(input?.rating),comment=clean(input?.text,1200);
 if(!bookingId||!Number.isInteger(rating)||rating<1||rating>5)throw Object.assign(new Error('Поставьте оценку от 1 до 5'),{status:400});
 const b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first();
 if(!b)throw Object.assign(new Error('Запись не найдена'),{status:404});
 if(String(b.user_id)!==String(userId))throw Object.assign(new Error('Нет доступа к этой записи'),{status:403});
 if(b.status!=='done')throw Object.assign(new Error('Отзыв можно оставить после завершённой записи'),{status:409});
 const exists=await db.prepare('SELECT rating FROM reviews WHERE booking_id=?').bind(bookingId).first();
 if(exists)throw Object.assign(new Error('Вы уже оставили отзыв по этой записи'),{status:409});
 await db.prepare('INSERT INTO reviews(booking_id,company_id,user_id,client_name,service_name,rating,text,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(b.id,b.company_id,String(userId),b.name,b.service_name,rating,comment,now()).run();
 return {ok:true,rating};
}
