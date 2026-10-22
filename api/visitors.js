import {createHmac} from 'node:crypto';

const PREFIX='just-judo:visitors:v1';
export const UPDATE_VISITOR=`
local old=redis.call('HGET',KEYS[1],ARGV[1])
if ARGV[2]=='exclude' then
  if old and old~='excluded' then redis.call('HINCRBY',KEYS[2],old,-1) end
  redis.call('HSET',KEYS[1],ARGV[1],'excluded')
elseif not old or (old=='excluded' and ARGV[2]=='include') then
  local n=redis.call('INCR',KEYS[3]); if n==1 then redis.call('EXPIRE',KEYS[3],3600) end
  if n>120 then return redis.error_reply('visitor_rate_limit') end
  redis.call('HSET',KEYS[1],ARGV[1],ARGV[3])
  redis.call('HINCRBY',KEYS[2],ARGV[3],1)
end
return redis.call('HGETALL',KEYS[2])`;

export function summarize(values){
  const countries=[];
  for(let i=0;i<values.length;i+=2){const count=Number(values[i+1]);if(count>0)countries.push({country:values[i],count});}
  countries.sort((a,b)=>b.count-a.count||a.country.localeCompare(b.country));
  return {total:countries.reduce((sum,row)=>sum+row.count,0),countries};
}
export function validateVisit(body){
  if(!body||!['visit','exclude','include'].includes(body.action)||typeof body.id!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).test(body.id))throw Object.assign(new Error('invalid_visit'),{status:400});
  return body;
}
export function visitorCommand(body,headers,secret){
  validateVisit(body);
  const hash=value=>createHmac('sha256',secret).update(value).digest('hex');
  const country=/^[A-Z]{2}$/.test(headers['x-vercel-ip-country']||'')?headers['x-vercel-ip-country']:'ZZ';
  // IP is used only as a short-lived, keyed rate-limit hash; never stored raw.
  const ip=(headers['x-forwarded-for']||'unknown').split(',')[0].trim();
  return ['EVAL',UPDATE_VISITOR,3,`${PREFIX}:browsers`,`${PREFIX}:countries`,`${PREFIX}:rate:${hash(ip)}`,hash(body.id),body.action,country];
}
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
  try{
    if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return send(405,{error:'method'});}
    let body;
    if(req.method==='POST'){
      let origin;try{origin=new URL(req.headers.origin)}catch{return send(403,{error:'origin'})}
      if(origin.host!==req.headers.host||!['https:','http:'].includes(origin.protocol))return send(403,{error:'origin'});
      if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'content_type'});
      body=req.body;
      if(body===undefined){body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1024)return send(413,{error:'size'});}}
      if(Buffer.byteLength(typeof body==='string'?body:JSON.stringify(body))>1024)return send(413,{error:'size'});
      if(typeof body==='string'){try{body=JSON.parse(body)}catch{return send(400,{error:'json'})}}
      validateVisit(body);
      if(/bot|crawler|spider|headless/i.test(req.headers['user-agent']||'')&&body.action!=='exclude')return send(200,{ignored:true});
    }
    const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
    const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
    if(!url||!token)return send(503,{error:'not_configured'});
    const args=body?visitorCommand(body,req.headers,token):['HGETALL',`${PREFIX}:countries`];
    const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
    if(!response.ok)return send(503,{error:'storage_unavailable'});
    const data=await response.json();
    if(data.error)return send(data.error.includes('visitor_rate_limit')?429:503,{error:'storage_unavailable'});
    if(!body)res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=120');
    send(200,summarize(data.result));
  }catch(error){send(error.status||503,{error:error.status===400?'invalid_visit':'storage_unavailable'});}
}
