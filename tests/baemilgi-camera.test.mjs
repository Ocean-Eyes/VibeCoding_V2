import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraConstraints,listCameras,preferredWideCamera,minimizeCameraZoom} from '../src/baemilgi-camera.js';

const camera=(deviceId,label)=>({kind:'videoinput',deviceId,label});
test('automatic framing prefers rear capture without requiring a mobile-only camera or cropping',()=>{
 const {video,audio}=cameraConstraints();
 assert.equal(audio,false);
 assert.deepEqual(video.facingMode,{ideal:'environment'});
 assert.deepEqual(video.resizeMode,{ideal:'none'});
 assert.equal(video.width.exact,undefined);
 assert.deepEqual(cameraConstraints('user').video.facingMode,{ideal:'user'});
 const manual=cameraConstraints('chosen-lens').video;
 assert.deepEqual(manual.deviceId,{exact:'chosen-lens'});
 assert.equal(manual.facingMode,undefined,'manual choice is not overridden by automatic rear selection');
});
test('ultrawide wins over standard wide and front cameras regardless of enumeration order',()=>{
 const devices=[camera('front','Front Ultra Wide Camera'),camera('wide','Back Wide Camera'),camera('tele','Back Telephoto Camera'),camera('ultra','Back Ultra Wide Camera')];
 assert.equal(preferredWideCamera(devices).deviceId,'ultra');
 assert.equal(preferredWideCamera(devices.toReversed()).deviceId,'ultra');
 assert.equal(preferredWideCamera([camera('ko','후면 초광각 카메라')]).deviceId,'ko');
 assert.equal(preferredWideCamera([camera('half','Back 0.5×')]).deviceId,'half');
 assert.equal(preferredWideCamera([camera('front','전면 광각'),camera('unknown','camera 2')]),null);
 assert.equal(preferredWideCamera([{kind:'audioinput',deviceId:'mic',label:'Ultra Wide'},camera('','Back Ultra Wide')]),null);
});
test('portrait framing requests a tall camera image while preserving lens choice',()=>{
 const {video,audio}=cameraConstraints('chosen-lens','portrait');assert.equal(audio,false);
 assert.deepEqual(video.aspectRatio,{ideal:9/16});assert.deepEqual(cameraConstraints().video.aspectRatio,{ideal:16/9});
 assert.deepEqual(video.width,{ideal:720});assert.deepEqual(video.height,{ideal:1280});assert.deepEqual(video.deviceId,{exact:'chosen-lens'});
 assert.deepEqual(cameraConstraints().video.width,{ideal:1280});assert.deepEqual(cameraConstraints().video.height,{ideal:720});
});
test('unavailable or privacy-restricted device enumeration keeps basic camera capture usable',async()=>{
 assert.deepEqual(await listCameras({}),[]);
 assert.deepEqual(await listCameras({enumerateDevices:async()=>{throw Error('blocked')}}),[]);
 assert.deepEqual(await listCameras({enumerateDevices:async()=>[camera('rear','Back'),camera('',''),{kind:'audioinput',deviceId:'mic'}]}),[camera('rear','Back')]);
});
test('minimum supported zoom preserves capture constraints and accepts cameras whose minimum is 1',async()=>{
 for(const min of [.5,1]){
  let applied;
  const constraints=cameraConstraints().video;
  await minimizeCameraZoom({getCapabilities:()=>({zoom:{min,max:8}}),getConstraints:()=>constraints,applyConstraints:async value=>{applied=value;}});
  assert.equal(applied.advanced.at(-1).zoom,min);
  assert.deepEqual(applied.frameRate,constraints.frameRate);
  assert.deepEqual(applied.resizeMode,constraints.resizeMode);
 }
});
test('missing, invalid or rejected zoom controls never fail the challenge',async()=>{
 await minimizeCameraZoom({});
 for(const min of [undefined,NaN,Infinity,-1])await minimizeCameraZoom({getCapabilities:()=>({zoom:{min}}),applyConstraints:()=>assert.fail('unsupported zoom')});
 await minimizeCameraZoom({getCapabilities:()=>{throw Error('unsupported')}});
 await minimizeCameraZoom({getCapabilities:()=>({zoom:{min:.5}}),applyConstraints:async()=>{throw Error('zoom denied')}});
});
