import test from 'node:test';
import assert from 'node:assert/strict';
import {createPairingService,memoryPairingStore,createPairingHandler} from '../api/phone-camera.js';
const client='a'.repeat(32),otherClient='b'.repeat(32),candidate={type:'candidate',candidate:{candidate:'candidate:1 1 udp 1 192.0.2.1 5000 typ host',sdpMid:'0',sdpMLineIndex:0}};
async function setup(options={}){
 const service=createPairingService(memoryPairingStore(options),options),session=await service.request({action:'create'},'test-ip');
 const host={room:session.room,token:session.token,role:'host'},phone={room:session.room,token:session.phoneToken,role:'phone',client};
 return {service,session,host,phone};
}
test('separate PC and phone capabilities expire, and a QR can only be claimed by one phone',async()=>{
 let now=1000;const {service,session,host,phone}=await setup({now:()=>now});
 assert.notEqual(session.token,session.phoneToken);assert.equal(session.expiresAt,301000);assert.equal(session.room.length,24);
 await assert.rejects(service.request({...host,token:session.phoneToken,action:'poll',cursor:0}),{status:403});
 await service.request({...phone,action:'join'});await service.request({...phone,action:'join'});
 await assert.rejects(service.request({...phone,client:otherClient,action:'join'}),{status:409});
 await assert.rejects(service.request({...phone,client:otherClient,action:'poll',cursor:0}),{status:403});
 now=301001;await assert.rejects(service.request({...host,action:'poll',cursor:0}),{status:410});
});
test('signaling preserves order, isolates roles and makes SDP retries idempotent',async()=>{
 const {service,host,phone}=await setup();await service.request({...phone,action:'join'});
 const offer={type:'offer',sdp:'v=0\r\ns=host'},answer={type:'answer',sdp:'v=0\r\ns=phone'};
 await service.request({...host,action:'send',message:offer});await service.request({...host,action:'send',message:offer});await service.request({...host,action:'send',message:candidate});
 const read=await service.request({...phone,action:'poll',cursor:0});assert.equal(read.messages.length,2);assert.equal(read.messages[0].type,'offer');assert.equal(read.messages[1].type,'candidate');
 assert.deepEqual((await service.request({...phone,action:'poll',cursor:read.cursor})).messages,[]);
 await service.request({...phone,action:'send',message:answer});assert.equal((await service.request({...host,action:'poll',cursor:0})).messages[0].sdp,answer.sdp);
 await assert.rejects(service.request({...phone,action:'send',message:offer}),{status:403});
 await assert.rejects(service.request({...host,action:'send',message:{...offer,sdp:'v=0\r\ns=changed'}}),{status:409});
 await assert.rejects(service.request({...host,action:'send',message:{type:'video',bytes:'data'}}),{status:400});
 await service.request({...phone,action:'close'});assert.equal((await service.request({...host,action:'poll',cursor:0})).closed,true);
 await assert.rejects(service.request({...host,action:'send',message:candidate}),{status:410});
});
test('rooms, candidate queues and malformed packets are bounded',async()=>{
 const {service,host}=await setup();
 await assert.rejects(service.request({...host,action:'poll',cursor:-1}),{status:400});
 await assert.rejects(service.request({...host,action:'send',message:{...candidate,candidate:{candidate:'x'.repeat(2049)}}}),{status:400});
 for(let i=0;i<64;i++)await service.request({...host,action:'send',message:candidate});
 await assert.rejects(service.request({...host,action:'send',message:candidate}),{status:429});
 for(let i=1;i<30;i++)await service.request({action:'create'},'test-ip');
 await assert.rejects(service.request({action:'create'},'test-ip'),{status:429});
});
async function http(handler,{method='POST',origin='https://justjudo.app',type='application/json',body={action:'create'}}={}){
 const req={method,headers:{host:'justjudo.app',origin,'content-type':type},body,socket:{remoteAddress:'test-http'}};
 let result;const res={headers:{},setHeader(name,value){this.headers[name]=value;},end(value){result={status:this.statusCode,body:JSON.parse(value),headers:this.headers};}};
 await handler(req,res);return result;
}
test('HTTP rejects foreign origins and oversized bodies before accessing storage',async()=>{
 let reads=0;const handler=createPairingHandler(()=>{reads++;return memoryPairingStore();});
 assert.equal((await http(handler,{method:'GET'})).status,405);assert.equal((await http(handler,{origin:'https://foreign.example'})).status,403);
 assert.equal((await http(handler,{type:'text/plain'})).status,415);assert.equal((await http(handler,{body:'x'.repeat(32769)})).status,413);assert.equal(reads,0);
 const created=await http(handler);assert.equal(created.status,200);assert.equal(created.headers['Cache-Control'],'no-store');
 assert.equal((await http(createPairingHandler(()=>null))).status,503);
});
