import test from 'node:test';
import assert from 'node:assert/strict';
import {rasterVolume,projectBeltPoint,drawBeltVolume,waistFrontDepth} from '../src/belt-volume-render.js';
const triangle=(z,n)=>[-.2,-.1,z,...n,0,0,.2,-.1,z,...n,0,0,0,.3,z,...n,0,0];
test('3D visibility depends on depth, not material drawing order',()=>{
 const front=triangle(.2,[0,0,1]),back=triangle(-.1,[1,0,0]);
 const a=rasterVolume(new Float32Array([...front,...back]),120,80),b=rasterVolume(new Float32Array([...back,...front]),120,80);
 assert.deepEqual(a,b);assert.ok(a.some((v,i)=>i%4===3&&v===255));
 assert.notDeepEqual(a,rasterVolume(new Float32Array(back),120,80));
});
test('angled inspection exposes real depth without changing the belt geometry',()=>{
 assert.deepEqual(projectBeltPoint([.2,.1,.3]),[.2,.1]);
 const projected=projectBeltPoint([.2,.1,.3],Math.PI/2);assert.ok(Math.abs(projected[0]-.3)<1e-10);assert.equal(projected[1],.1);
});
test('hidden lesson viewport does not create a zero-size render surface',()=>{
 assert.equal(drawBeltVolume(null,{scale:0},null),true);assert.equal(drawBeltVolume(null,{scale:-15},null),true);
});

test('body occlusion follows the curved waist so side wraps reach both hips',()=>{
 for(const x of[-.42,.41]){
  assert.ok(waistFrontDepth(x,.03)<-.14,'side surface recedes around the waist');
  const patch=[x-.008,.01,-.12,0,0,1,0,0,x+.008,.01,-.12,0,0,1,0,0,x,.06,-.12,0,0,1,0,0];
  const pixels=rasterVolume(new Float32Array(patch),552,324,0,true);
  assert.ok(pixels.some((v,i)=>i%4===3&&v===255),'visible belt reaches the hip');
 }
 assert.ok(waistFrontDepth(0,.03)>0,'rear center stays hidden');
 assert.equal(waistFrontDepth(.46,.03),-Infinity,'outside the silhouette stays visible');
});
