const encoder = new TextEncoder();
export async function hmac(key, data) {
 const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key, {name:'HMAC',hash:'SHA-256'},false,['sign']);
 return new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(data)));
}
export async function validateTelegram(raw, token, now = Math.floor(Date.now()/1000)) {
 if (!raw || !token || raw.length>12000) throw new Error('AUTH');
 const p=new URLSearchParams(raw), hash=p.get('hash');
 if (new Set(p.keys()).size!==[...p.keys()].length || !/^[a-f0-9]{64}$/.test(hash||'')) throw new Error('AUTH');
 const date=Number(p.get('auth_date'));
 if (!Number.isInteger(date)||date>now+30||now-date>3600) throw new Error('AUTH');
 p.delete('hash');
 const check=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
 const digest=await hmac(await hmac('WebAppData',token),check);
 let diff=0; for(let i=0;i<32;i++) diff|=digest[i]^parseInt(hash.slice(i*2,i*2+2),16);
 if(diff) throw new Error('AUTH');
 const user=JSON.parse(p.get('user')||'null');
 if(!Number.isSafeInteger(user?.id)||user.id<=0) throw new Error('AUTH');
 return {id:String(user.id),name:String(user.first_name||'Клиент')};
}
export async function identify(request,env) {
 const hostname=new URL(request.url).hostname;
 if(env.DEV_MODE==='true' && ['127.0.0.1','localhost'].includes(hostname)) {
  const role=request.headers.get('x-demo-role')||'client';
  return {id:role==='owner'?'9001':role==='company'?'9002':'9003',name:'Тимур',demo:true};
 }
 return validateTelegram(request.headers.get('x-telegram-init-data'),env.BOT_TOKEN);
}
