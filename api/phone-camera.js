import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {APIError,redisFromEnv} from './baemilgi.js';
const PREFIX='just-judo:phone-camera:v1:',TTL=300,MAX_MESSAGES=64;
const digest=value=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(24).toString('base64url');
const validToken=value=>typeof value==='string'&&/^[\w-]{32}$/.test(value);
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const APPEND=`local old=redis.call('GET',KEYS[2]); if ARGV[3]~='' and old then if old==ARGV[3] then return 2 else return -2 end end; if redis.call('LLEN',KEYS[1])>=64 then return 0 end; redis.call('RPUSH',KEYS[1],ARGV[1]); redis.call('EXPIRE',KEYS[1],ARGV[2]); if ARGV[3]~='' then redis.call('SET',KEYS[2],ARGV[3],'EX',ARGV[2]) end; return 1`;
const RATE=`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; return n`;
export function redisPairingStore(redis){return {
 secret:redis.secret,
 get:key=>redis.command(['GET',key]),
 set:(key,value,ttl)=>redis.command(['SET',key,value,'EX',ttl]),
 setNX:(key,value,ttl)=>redis.command(['SET',key,value,'NX','EX',ttl]),
 rate:key=>redis.command(['EVAL',RATE,1,key]),
 append:(key,message,ttl,phase)=>redis.command(['EVAL',APPEND,2,key,key+':'+message.type,JSON.stringify(message),ttl,phase]),
 read:(key,cursor)=>redis.command(['LRANGE',key,cursor,cursor+31]),
};}
// Explicitly used by the localhost development server and tests, never as a
// production fallback: independent serverless instances must share Redis.
export function memoryPairingStore({now=Date.now}={}){
 const data=new Map();
 const get=key=>{const item=data.get(key);if(!item||item.until<=now()){data.delete(key);return null;}return item.value;};
 const set=(key,value,ttl)=>{for(const [k,item]of data)if(item.until<=now())data.delete(k);data.set(key,{value,until:now()+ttl*1000});return 'OK';};
 return {secret:'localhost-only',get:async key=>get(key),set:async(...args)=>set(...args),setNX:async(key,value,ttl)=>get(key)===null?set(key,value,ttl):null,
  rate:async key=>{const value=(get(key)??0)+1;set(key,value,3600);return value;},
  append:async(key,message,ttl,phase)=>{const phaseKey=key+':'+message.type,old=get(phaseKey);if(phase&&old)return old===phase?2:-2;const list=get(key)??[];if(list.length>=MAX_MESSAGES)return 0;list.push(JSON.stringify(message));set(key,list,ttl);if(phase)set(phaseKey,phase,ttl);return 1;},
  read:async(key,cursor)=>(get(key)??[]).slice(cursor,cursor+32),
 };
}
function messageFor(role,message){
 if(!message||typeof message!=='object')throw new APIError(400,'message');
 if(message.type==='offer'||message.type==='answer'){
  if(message.type!==(role==='host'?'offer':'answer'))throw new APIError(403,'role');
  const sdp=message.sdp;if(typeof sdp!=='string'||sdp.length>24000||!sdp.startsWith('v=0'))throw new APIError(400,'sdp');
  return {type:message.type,sdp};
 }
 if(message.type!=='candidate'||!message.candidate||typeof message.candidate.candidate!=='string'||message.candidate.candidate.length>2048)throw new APIError(400,'candidate');
 const {candidate,sdpMid,sdpMLineIndex,usernameFragment}=message.candidate;
 if(sdpMid!=null&&(typeof sdpMid!=='string'||sdpMid.length>64)||sdpMLineIndex!=null&&(!Number.isInteger(sdpMLineIndex)||sdpMLineIndex<0||sdpMLineIndex>32)||usernameFragment!=null&&(typeof usernameFragment!=='string'||usernameFragment.length>256))throw new APIError(400,'candidate');
 return {type:'candidate',candidate:{candidate,sdpMid:sdpMid??null,sdpMLineIndex:sdpMLineIndex??null,...(usernameFragment?{usernameFragment}:{})}};
}
export function createPairingService(store,{now=Date.now}={}){
 const iceServers=[{urls:'stun:stun.l.google.com:19302'}];
 async function authorize(body){
  if(typeof body.room!=='string'||!/^[\w-]{24}$/.test(body.room)||!validToken(body.token)||!['host','phone'].includes(body.role))throw new APIError(403,'session');
  const key=PREFIX+body.room,raw=await store.get(key);if(!raw)throw new APIError(410,'expired');
  const room=JSON.parse(raw);if(now()>=room.expiresAt)throw new APIError(410,'expired');
  if(!equal(digest(body.token),room[body.role+'Hash']))throw new APIError(403,'session');
  return {key,room,ttl:Math.max(1,Math.ceil((room.expiresAt-now())/1000))};
 }
 return {async request(body,ip='unknown'){
  if(body.action==='create'){
   const rateKey=PREFIX+'rate:'+createHmac('sha256',store.secret).update(ip).digest('hex');
   if(await store.rate(rateKey)>30)throw new APIError(429,'rate_limit');
   const id=randomBytes(18).toString('base64url'),hostToken=token(),phoneToken=token(),expiresAt=now()+TTL*1000;
   const room={hostHash:digest(hostToken),phoneHash:digest(phoneToken),expiresAt};
   if(!await store.setNX(PREFIX+id,JSON.stringify(room),TTL))throw new APIError(503,'storage_unavailable');
   return {room:id,token:hostToken,phoneToken,expiresAt,iceServers};
  }
  const auth=await authorize(body),{key,room,ttl}=auth;
  if(body.role==='phone'){
   if(!validToken(body.client))throw new APIError(403,'client');
   if(body.action==='join')await store.setNX(key+':client',digest(body.client),ttl);
   if(!equal(await store.get(key+':client'),digest(body.client)))throw new APIError(body.action==='join'?409:403,'already_joined');
  }
  if(await store.get(key+':closed')){if(body.action==='poll')return {closed:true,messages:[],cursor:body.cursor??0};if(body.action==='close')return {closed:true};throw new APIError(410,'closed');}
  if(body.action==='join'){
   if(body.role!=='phone')throw new APIError(403,'role');return {expiresAt:room.expiresAt,iceServers};
  }
  if(body.action==='poll'){
   if(!Number.isInteger(body.cursor)||body.cursor<0||body.cursor>MAX_MESSAGES)throw new APIError(400,'cursor');
   const messages=(await store.read(key+':'+body.role,body.cursor)).map(value=>JSON.parse(value));
   return {messages,cursor:body.cursor+messages.length,closed:false};
  }
  if(body.action==='send'){
   const message=messageFor(body.role,body.message),target=body.role==='host'?'phone':'host';
   const result=await store.append(key+':'+target,message,ttl,message.type==='candidate'?'':digest(JSON.stringify(message)));
   if(result===-2)throw new APIError(409,'description_exists');if(!result)throw new APIError(429,'message_limit');return {sent:true};
  }
  if(body.action==='close'){await store.set(key+':closed','1',ttl);return {closed:true};}
  throw new APIError(400,'action');
 }};
}
export function createPairingHandler(getStore=()=>{const redis=redisFromEnv();return redis&&redisPairingStore(redis);}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
 try{
  if(req.method!=='POST'){res.setHeader('Allow','POST');throw new APIError(405,'method');}
  let origin;try{origin=new URL(req.headers.origin);}catch{throw new APIError(403,'origin');}
  if(origin.host!==req.headers.host||!['http:','https:'].includes(origin.protocol))throw new APIError(403,'origin');
  if(!req.headers['content-type']?.startsWith('application/json'))throw new APIError(415,'content_type');
  let body=req.body;if(body===undefined){let text='';for await(const part of req){text+=part;if(Buffer.byteLength(text)>32768)throw new APIError(413,'size');}body=text;}
  if(Buffer.byteLength(typeof body==='string'?body:JSON.stringify(body??null))>32768)throw new APIError(413,'size');
  if(typeof body==='string'){try{body=JSON.parse(body);}catch{throw new APIError(400,'json');}}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new APIError(400,'json');
  const store=getStore();if(!store)throw new APIError(503,'not_configured');
  send(200,await createPairingService(store).request(body,req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown'));
 }catch(error){send(error instanceof APIError?error.status:503,{error:error instanceof APIError?error.code:'storage_unavailable'});}
};}
export default createPairingHandler();
