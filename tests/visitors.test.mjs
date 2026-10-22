import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{summarize,visitorCommand,validateVisit} from '../api/visitors.js';
import {readVisitor,exclusionRequested} from '../src/visitor-stats.js';
const id='82a00a80-6124-4dac-b62e-79ee5d4d3651';
test('browser identity persists; broken storage does not invent repeat identities',()=>{
  const entries=new Map(),storage={getItem:k=>entries.get(k),setItem:(k,v)=>entries.set(k,v)};
  const first=readVisitor(storage);assert.equal(readVisitor(storage).id,first.id);
  assert.throws(()=>readVisitor({getItem:()=>null,setItem:()=>{throw Error('blocked')}}));
  assert.equal(exclusionRequested('?exclude_visits=1'),true);assert.equal(exclusionRequested('?exclude_visits=0'),false);
});
test('summary keeps total equal to country sum and omits removed countries',()=>{
  assert.deepEqual(summarize(['KR','3','US','2','ZZ','1','JP','0']),{total:6,countries:[{country:'KR',count:3},{country:'US',count:2},{country:'ZZ',count:1}]});
  assert.deepEqual(summarize([]),{total:0,countries:[]});
});
test('country is server supplied and stored identifiers are keyed hashes',()=>{
  const args=visitorCommand({id,action:'visit',country:'US'},{'x-vercel-ip-country':'KR','x-forwarded-for':'192.0.2.1'},'test-secret');
  assert.equal(args.at(-1),'KR');assert(!JSON.stringify(args).includes(id));assert(!JSON.stringify(args).includes('192.0.2.1'));
  assert.equal(visitorCommand({id,action:'visit'},{'x-vercel-ip-country':'bad'},'test').at(-1),'ZZ');
  for(const value of [null,{}, {id,action:'erase-all'}, {id:'arbitrary',action:'visit'}])assert.throws(()=>validateVisit(value));
});
async function request(method,headers={},body){
  const res={headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}};
  await handler({method,headers,body},res);return res;
}
const headers={origin:'https://justjudo.app',host:'justjudo.app','content-type':'application/json','user-agent':'Browser','x-vercel-ip-country':'KR'};
test('HTTP rejects foreign origins, bad input, oversized payloads and unsupported verbs',async()=>{
  assert.equal((await request('POST',{...headers,origin:'https://evil.example'},{id,action:'visit'})).statusCode,403);
  assert.equal((await request('POST',{...headers,'content-type':'text/plain'},{})).statusCode,415);
  assert.equal((await request('DELETE')).statusCode,405);
  assert.equal((await request('POST',headers,'{')).statusCode,400);
  assert.equal((await request('POST',headers,{id:'bad',action:'visit'})).statusCode,400);
  assert.equal((await request('POST',headers,'x'.repeat(1025))).statusCode,413);
});
test('API caches only public reads, never personal mutations; unavailable storage stays an error',async t=>{
  const keys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'],old=keys.map(k=>process.env[k]);
  keys.forEach((k,i)=>process.env[k]=i?'test-secret':'https://redis.example');
  t.after(()=>keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i]}));
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return {ok:true,json:async()=>({result:['KR','1']})}});
  const get=await request('GET');assert.equal(get.body.total,1);assert.match(get.headers['Cache-Control'],/s-maxage=60/);
  const post=await request('POST',headers,{id,action:'exclude'});assert.equal(post.statusCode,200);assert.equal(post.headers['Cache-Control'],'no-store');
  const before=calls;await request('POST',{...headers,'user-agent':'Googlebot'},{id,action:'visit'});assert.equal(calls,before);
  globalThis.fetch=async()=>{throw Error('offline')};const failure=await request('GET');assert.equal(failure.statusCode,503);assert.equal(failure.body.total,undefined);
});
