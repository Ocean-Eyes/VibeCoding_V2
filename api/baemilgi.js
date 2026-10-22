import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';

const PREFIX='just-judo:baemilgi:v1';
const MAX_DURATION=2*60*60*1000;
export class APIError extends Error {constructor(status,code){super(code);this.status=status;this.code=code;}}
export function redisFromEnv(env=process.env){
  const url=env.UPSTASH_REDIS_REST_URL||env.KV_REST_API_URL;
  const token=env.UPSTASH_REDIS_REST_TOKEN||env.KV_REST_API_TOKEN;
  if(!url||!token)return null;
  return {secret:env.BAEMILGI_SESSION_SECRET||token,async command(args){
    const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new APIError(503,'storage_unavailable');
    const body=await response.json();if(body.error)throw new APIError(503,'storage_unavailable');return body.result;
  }};
}
export function validateResult(body){
  const nickname=typeof body.nickname==='string'?body.nickname.normalize('NFC').trim():'';
  if(!/^[\p{L}\p{N}_ -]{2,12}$/u.test(nickname))throw new APIError(400,'nickname');
  const {count,reps,duration,version,endedBy}=body;
  if(version!=='baemilgi-v1'||endedBy!=='standing'||!Number.isInteger(count)||count<1||count>3000||
    !Array.isArray(reps)||reps.length!==count||!Number.isInteger(duration)||duration<1200||duration>MAX_DURATION)
    throw new APIError(400,'result');
  let previous=-650;
  for(const time of reps){if(!Number.isInteger(time)||time<180||time-previous<650||time>duration-1200)throw new APIError(400,'result');previous=time;}
  return {nickname,count,duration};
}
const RATE_SCRIPT=`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; return n`;
const LIST_SCRIPT=`local ids=redis.call('ZREVRANGE',KEYS[1],0,49); local rows={}; for _,id in ipairs(ids) do local row=redis.call('HGET',KEYS[2],id); if row then table.insert(rows,row) end end; return rows`;
// One atomic operation makes retries idempotent and retains each browser's best.
const SAVE_SCRIPT=`
local saved=redis.call('GET',KEYS[3]); if saved then return saved end
local old=tonumber(redis.call('ZSCORE',KEYS[1],ARGV[1]) or '-1')
local score=tonumber(ARGV[2]); local improved=score>old
if improved then redis.call('ZADD',KEYS[1],score,ARGV[1]); redis.call('HSET',KEYS[2],ARGV[1],ARGV[3]) end
local best=math.max(score,old)
local rank=redis.call('ZCOUNT',KEYS[1],'('..best,'+inf')+1
local excess=redis.call('ZCARD',KEYS[1])-1000
if excess>0 then local ids=redis.call('ZRANGE',KEYS[1],0,excess-1); for _,id in ipairs(ids) do redis.call('ZREM',KEYS[1],id); redis.call('HDEL',KEYS[2],id) end end
local result=cjson.encode({saved=true,improved=improved,best=best,rank=rank})
redis.call('SET',KEYS[3],result,'EX',604800); return result`;

export function createLeaderboard(store,{now=Date.now}={}){
  const sign=value=>createHmac('sha256',store.secret).update(value).digest('base64url');
  function verify(token){
    if(typeof token!=='string'||token.length>1024)throw new APIError(400,'session');
    const [payload,signature,...extra]=token.split('.');const expected=sign(payload||'');
    if(extra.length||!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw new APIError(400,'session');
    let session;try{session=JSON.parse(Buffer.from(payload,'base64url').toString())}catch{throw new APIError(400,'session')}
    if(!session||!Number.isFinite(session.at)||now()-session.at>MAX_DURATION||session.at>now())throw new APIError(400,'session_expired');
    return session;
  }
  async function rate(ip,action,limit){
    const key=`${PREFIX}:rate:${action}:${sign(ip)}`;
    if(await store.command(['EVAL',RATE_SCRIPT,1,key])>limit)throw new APIError(429,'rate_limit');
  }
  return {
    async list(){
      const data=await store.command(['EVAL',LIST_SCRIPT,2,`${PREFIX}:scores`,`${PREFIX}:players`]);
      const entries=data.map(row=>JSON.parse(row));
      let rank=0,previous=null;return entries.map((entry,i)=>{if(entry.count!==previous)rank=i+1;previous=entry.count;return {...entry,rank};});
    },
    async start(body,ip){
      if(typeof body.player!=='string'||!/^[a-f\d-]{36}$/i.test(body.player))throw new APIError(400,'player');
      await rate(ip,'start',30);
      const payload=Buffer.from(JSON.stringify({id:randomUUID(),player:sign(body.player),at:now()})).toString('base64url');
      return {token:`${payload}.${sign(payload)}`};
    },
    async save(body,ip){
      const result=validateResult(body),session=verify(body.token);
      if(result.duration>now()-session.at+1000)throw new APIError(400,'duration');
      await rate(ip,'save',60);
      const entry={nickname:result.nickname,count:result.count,date:new Date(now()).toISOString()};
      const response=await store.command(['EVAL',SAVE_SCRIPT,3,`${PREFIX}:scores`,`${PREFIX}:players`,`${PREFIX}:session:${session.id}`,session.player,result.count,JSON.stringify(entry)]);
      return JSON.parse(response);
    }
  };
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  try{
    if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');throw new APIError(405,'method');}
    if(req.method==='POST'){
      let origin;try{origin=new URL(req.headers.origin)}catch{throw new APIError(403,'origin')}
      if(origin.host!==req.headers.host||!['https:','http:'].includes(origin.protocol))throw new APIError(403,'origin');
      if(!req.headers['content-type']?.startsWith('application/json'))throw new APIError(415,'content_type');
    }
    const store=redisFromEnv();if(!store)throw new APIError(503,'not_configured');
    const service=createLeaderboard(store);
    if(req.method==='GET'){
      const entries=await service.list();
      if(new URL(req.url||'/', 'http://localhost').searchParams.get('fresh')!=='1')res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=120');
      send(200,{entries});return;
    }
    let body=req.body;
    if(body===undefined){let text='';for await(const part of req){text+=part;if(Buffer.byteLength(text)>32768)throw new APIError(413,'size');}body=text;}
    if(Buffer.byteLength(typeof body==='string'?body:JSON.stringify(body))>32768)throw new APIError(413,'size');
    if(typeof body==='string'){try{body=JSON.parse(body)}catch{throw new APIError(400,'json')}}
    if(!body||typeof body!=='object')throw new APIError(400,'json');
    const ip=req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown';
    if(body.action==='start')send(200,await service.start(body,ip));
    else if(body.action==='save')send(200,await service.save(body,ip));
    else throw new APIError(400,'action');
  }catch(error){send(error instanceof APIError?error.status:503,{error:error instanceof APIError?error.code:'storage_unavailable'});}
}
