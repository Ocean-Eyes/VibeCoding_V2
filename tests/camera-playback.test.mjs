import test from 'node:test';
import assert from 'node:assert/strict';
import {createCameraPlayback} from '../src/camera-playback.js';
const blocked=()=>new DOMException('Tap required','NotAllowedError');
const turn=()=>new Promise(resolve=>setTimeout(resolve,0));
test('camera video is visible, muted and inline before playback starts',async()=>{
 const video={hidden:true,play(){assert.equal(this.hidden,false);assert.equal(this.muted,true);assert.equal(this.defaultMuted,true);assert.equal(this.playsInline,true);return Promise.resolve();}},button={};
 assert.equal(await createCameraPlayback(video,button).start(),true);assert.equal(button.hidden,true);
});
test('autoplay rejection waits for a tap without turning a camera into a permission error',async()=>{
 let calls=0,notices=0;const video={play(){calls++;return calls===1?Promise.reject(blocked()):Promise.resolve();}},button={};
 const playback=createCameraPlayback(video,button,{onBlocked:()=>notices++}),result=playback.start();
 await turn();assert.equal(button.hidden,false);assert.equal(calls,1);assert.equal(notices,1);
 await button.onclick();assert.equal(await result,true);assert.equal(calls,2);assert.equal(button.hidden,true);
});
test('repeated blocked taps can recover, and cancel releases a pending gesture wait',async()=>{
 let failures=0;const button={},playback=createCameraPlayback({play:()=>Promise.reject(blocked())},button,{onRetryFailed:()=>failures++});
 const result=playback.start();await turn();await button.onclick();assert.equal(failures,1);assert.equal(button.disabled,false);
 playback.cancel();assert.equal(await result,false);assert.equal(button.hidden,true);assert.equal(button.onclick,null);
});
test('a superseded connection cannot resume the previous screen',async()=>{
 let resolve;const button={},playback=createCameraPlayback({play:()=>new Promise(done=>resolve=done)},button);
 const result=playback.start();playback.cancel();resolve();assert.equal(await result,false);
});
test('non-policy playback failures still reach the owning screen',async()=>{
 const failure=new DOMException('Decode failed','NotSupportedError');
 await assert.rejects(createCameraPlayback({play:()=>Promise.reject(failure)},{}).start(),error=>error===failure);
});
