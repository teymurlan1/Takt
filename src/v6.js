import {config} from './v10.js';
const now=()=>Math.floor(Date.now()/1000);
export const TRIAL_DAYS=7;
export const MONTHLY_PRICE=590;

export async function subscription(db,companyId,current=now()){
  const tariff=(await config(db)).tariff;
  await db.prepare(`INSERT OR IGNORE INTO subscriptions(company_id,trial_started_at,trial_ends_at,status,paid_until,updated_at) VALUES(?,?,?,?,NULL,?)`).bind(companyId,current,current+(tariff.enabled?tariff.trial_days:0)*86400,'trial',current).run();
  const row=await db.prepare('SELECT * FROM subscriptions WHERE company_id=?').bind(companyId).first();
  const status=row.paid_until&&row.paid_until>current?'active':row.trial_ends_at>current?'trial':'expired';
  if(row.status!==status)await db.prepare('UPDATE subscriptions SET status=?,updated_at=? WHERE company_id=?').bind(status,current,companyId).run();
  return {...row,status,price:tariff.price,trial_days:tariff.trial_days,tariff_name:tariff.name,tariff_description:tariff.description,tariff_enabled:tariff.enabled,days_left:status==='trial'?Math.max(0,Math.ceil((row.trial_ends_at-current)/86400)):0};
}

export async function attendance(db,bookingId){
  return (await db.prepare('SELECT state,responded_at FROM booking_attendance WHERE booking_id=?').bind(bookingId).first())||{state:'unknown',responded_at:null};
}

export async function setAttendance(db,bookingId,state,current=now()){
  if(!['unknown','coming','not_coming'].includes(state))throw Object.assign(new Error('Некорректный статус визита'),{status:400});
  await db.prepare(`INSERT INTO booking_attendance(booking_id,state,responded_at) VALUES(?,?,?) ON CONFLICT(booking_id) DO UPDATE SET state=excluded.state,responded_at=excluded.responded_at`).bind(bookingId,state,current).run();
  return {state,responded_at:current};
}

