import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{analyticsURL,parseVisitors} from '../api/visitors.js';
const config={VERCEL_ANALYTICS_TOKEN:'test-secret',VERCEL_ANALYTICS_PROJECT_ID:'prj_test',VERCEL_ANALYTICS_TEAM_ID:'team_test'};
test('queries lifetime production count without a reporting window or public filters',()=>{
 const url=analyticsURL(config);assert.equal(url.origin,'https://api.vercel.com');assert.equal(url.pathname,'/v1/query/web-analytics/visits/count');
 assert.equal(url.searchParams.get('projectId'),'prj_test');assert.equal(url.searchParams.get('teamId'),'team_test');
 for(const key of ['since','until','filter','token'])assert(!url.searchParams.has(key));
 assert(!analyticsURL({...config,VERCEL_ANALYTICS_TEAM_ID:''}).searchParams.has('teamId'));
 assert.throws(()=>analyticsURL({}));
});
test('uses Visitors, never pageviews or a sum of country counts',()=>{
 assert.equal(parseVisitors({data:{visitors:12,pageviews:9999}}).total,12);
 assert.equal(parseVisitors({data:{visitors:0,pageviews:22}}).total,0);
 for(const data of [{pageviews:12},{visitors:null},{visitors:-1},{visitors:1.5},{visitors:'12'}])assert.throws(()=>parseVisitors({data}));
});
async function request(method='GET',url='/api/visitors'){
 const res={headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}};
 await handler({method,url},res);return res;
}
test('API is read-only, keeps token server-side, caches success and fails without invented counts',async t=>{
 const old=Object.fromEntries(Object.keys(config).map(k=>[k,process.env[k]]));Object.assign(process.env,config);
 t.after(()=>{for(const k of Object.keys(config)){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}});
 let called=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{called++;assert.equal(new URL(url).searchParams.get('projectId'),'prj_test');assert.equal(options.headers.Authorization,'Bearer test-secret');return {ok:true,json:async()=>({data:{visitors:12,pageviews:999}})}});
 const result=await request('GET','/api/visitors?projectId=other');assert.equal(result.statusCode,200);assert.equal(result.body.total,12);assert.match(result.headers['Cache-Control'],/s-maxage=300/);assert(!JSON.stringify(result).includes('test-secret'));
 const before=called;assert.equal((await request('POST')).statusCode,405);assert.equal(called,before);
 delete process.env.VERCEL_ANALYTICS_TOKEN;assert.equal((await request()).body.error,'analytics_not_configured');assert.equal(called,before);process.env.VERCEL_ANALYTICS_TOKEN='test-secret';
 globalThis.fetch=async()=>({ok:false,status:403});const denied=await request();assert.equal(denied.body.error,'analytics_access_denied');assert.equal(denied.headers['Cache-Control'],'no-store');
 globalThis.fetch=async()=>({ok:true,json:async()=>({data:{pageviews:500}})});assert.equal((await request()).statusCode,503);
 globalThis.fetch=async()=>{throw Error('timeout test-secret')};const failed=await request();assert.equal(failed.statusCode,503);assert.equal(failed.body.total,undefined);assert(!JSON.stringify(failed).includes('test-secret'));
});
