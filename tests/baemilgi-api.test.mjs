import test from 'node:test';import assert from 'node:assert/strict';
import handler,{createLeaderboard,validateResult,redisFromEnv} from '../api/baemilgi.js';
import {readRecords,saveRecord,leaderboardRequest} from '../src/baemilgi-records.js';
const valid={nickname:'유도왕',count:3,reps:[700,1800,3000],duration:4500,version:'baemilgi-v1',endedBy:'standing'};
test('explicit score refresh bypasses shared cache while initial reads remain cached',async t=>{
 const previous={...process.env};
 process.env.UPSTASH_REDIS_REST_URL='https://redis.example';process.env.UPSTASH_REDIS_REST_TOKEN='test-only';
 t.after(()=>{for(const key of ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN']){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}});
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({result:[]})}));
 async function request(url){const response={headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}};await handler({method:'GET',url,headers:{}},response);assert.equal(response.statusCode,200);return response;}
 assert.match((await request('/api/baemilgi')).headers['Cache-Control'],/s-maxage=60/);
 assert.equal((await request('/api/baemilgi?fresh=1')).headers['Cache-Control'],'no-store');
});
test('client uses fresh reads only when requested and leaves writes unchanged',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({entries:[]})}});
 await leaderboardRequest();await leaderboardRequest(undefined,{fresh:true});await leaderboardRequest({action:'start'},{fresh:true});
 assert.deepEqual(calls.map(c=>c.url),['/api/baemilgi','/api/baemilgi?fresh=1','/api/baemilgi']);assert.equal(calls[2].options.method,'POST');
});
test('results require a full, chronological repetition log and standing finish',()=>{
 assert.equal(validateResult(valid).count,3);
 for(const patch of [{nickname:'<img>'},{nickname:'a'},{nickname:'a\nb'},{count:3.5},{count:0},{count:3001},{reps:[700,1000,3000]},{reps:[700,1800]},{reps:[700,1800,4000]},{duration:Infinity},{endedBy:'cancel'},{version:'other'}])assert.throws(()=>validateResult({...valid,...patch}),{status:400});
});
test('server signs sessions, bounds elapsed time and rejects tampering/expiry',async()=>{
 let now=100000,rate=0,commands=[];
 const store={secret:'test secret, never production',command:async args=>{commands.push(args);if(args[1].includes("INCR"))return ++rate;return JSON.stringify({saved:true,best:3,rank:1,improved:true});}};
 const service=createLeaderboard(store,{now:()=>now});
 const {token}=await service.start({player:'82a00a80-6124-4dac-b62e-79ee5d4d3651'},'127.0.0.1');
 await assert.rejects(service.save({...valid,token},'127.0.0.1'),{code:'duration'});
 now+=5000;assert.equal((await service.save({...valid,token},'127.0.0.1')).best,3);
 const save=commands.at(-1);assert.equal(save[0],'EVAL');assert.equal(save[2],3);assert.equal(JSON.parse(save.at(-1)).nickname,'유도왕');
 await assert.rejects(service.save({...valid,token:token+'a'},'127.0.0.1'),{code:'session'});
 now+=7200001;await assert.rejects(service.save({...valid,token},'127.0.0.1'),{code:'session_expired'});
});
test('rate limits and leaderboard ties are enforced; no credentials means no storage',async()=>{
 assert.equal(redisFromEnv({}),null);
 const limited=createLeaderboard({secret:'test',command:async()=>31});await assert.rejects(limited.start({player:'82a00a80-6124-4dac-b62e-79ee5d4d3651'},'ip'),{status:429});
 const list=createLeaderboard({secret:'test',command:async()=>[20,20,12].map((count,i)=>JSON.stringify({nickname:'user'+i,count}))});assert.deepEqual((await list.list()).map(r=>r.rank),[1,1,3]);
});
test('HTTP rejects cross-origin writes and unsupported methods before touching storage',async()=>{
 async function request(method,headers={}){let body;const response={headers:{},setHeader(k,v){this.headers[k]=v},end(v){body=JSON.parse(v)}};await handler({method,headers,socket:{}},response);return {...response,body};}
 assert.equal((await request('DELETE')).statusCode,405);
 assert.equal((await request('POST',{origin:'https://evil.example',host:'justjudo.app','content-type':'application/json'})).statusCode,403);
 assert.equal((await request('POST',{origin:'https://justjudo.app',host:'justjudo.app','content-type':'text/plain'})).statusCode,415);
});
test('device records tolerate corrupt storage, sort by count and deduplicate retries',()=>{
 let value='{bad';const storage={getItem:()=>value,setItem:(k,v)=>value=v};assert.deepEqual(readRecords(storage),[]);
 const first={id:'run1',nickname:'유도왕',count:3,date:'2026-10-22'};saveRecord(storage,first);saveRecord(storage,first);assert.equal(readRecords(storage).length,1);
 saveRecord(storage,{...first,id:'run2',count:5});assert.deepEqual(readRecords(storage).map(r=>r.count),[5,3]);
 assert.throws(()=>saveRecord(storage,{...first,nickname:'<script>'}));
 value='[null,{},true]';assert.deepEqual(readRecords(storage),[]);
});
