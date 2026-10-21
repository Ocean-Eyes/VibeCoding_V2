import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBlenderBelt} from '../src/belt-blender-motion.js';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function ray(tri,x,y){const[a,b,c]=tri,u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-a[0],c[1]-a[1]],det=u[0]*v[1]-u[1]*v[0];if(Math.abs(det)<1e-12)return null;const q=((x-a[0])*v[1]-(y-a[1])*v[0])/det,r=(u[0]*(y-a[1])-u[1]*(x-a[0]))/det;if(q<0||r<0||q+r>1)return null;return a[2]+q*(b[2]-a[2])+r*(c[2]-a[2])}
function seatedGaps(mesh,strip){
 const faces=mesh.parts.filter(p=>p.name==='middle-inner'||p.name===(strip.material==='A'?'B':'A')).flatMap(p=>{const points=p.positions.map((q,i)=>q.map((v,k)=>v+.003*Math.sign(p.normals[i][2])*p.normals[i][k]));return p.triangles.map(f=>f.map(i=>points[i]))}),gaps=[];
 for(let s=.08;s<=.35;s+=.005)for(const v of[-.039,-.0195,0,.0195,.039]){const at=strip.sourceToMaterial(s),mid=strip.sampleMaterialPoint(at,v),back=strip.sampleMaterialPoint(at,v,-Math.sign(mid.normal[2])).center;let z=-Infinity;for(const f of faces){const hit=ray(f,back[0],back[1]);if(hit!==null&&hit<=back[2]+.001)z=Math.max(z,hit)}if(Number.isFinite(z))gaps.push(back[2]-z)}
 return gaps.sort((a,b)=>a-b);
}
test('standing surfaces sit against the waist layers at the completed front crossing',()=>{
 const mesh=buildBlenderBelt(8.5),old=buildBlenderBelt(8.5,{depthContact:false});
 for(const [i,strip]of mesh.strips.entries()){const gap=seatedGaps(mesh,strip),before=seatedGaps(old,old.strips[i]);assert.ok(gap.length>=60);assert.ok(gap[Math.floor(gap.length/2)]<.003);assert.ok(gap.filter(g=>g<.003).length/gap.length>.90);assert.ok(before[Math.floor(before.length/2)]>.02);}
});
test('depth contact keeps the approved front knot route and full cross section',()=>{
 for(const t of[8.5,10,11.2,12.5,13.5,14.6,15.5,16.7,17.56,18,18.5]){const mesh=buildBlenderBelt(t),before=buildBlenderBelt(t,{depthContact:false});for(let i=0;i<2;i++){const s=mesh.strips[i],old=before.strips[i];for(let at=0;at<=1.05;at+=.015)for(const v of[-.039,0,.039]){const p=s.sampleMaterialPoint(s.sourceToMaterial(at),v),q=old.sampleMaterialPoint(old.sourceToMaterial(at),v);assert.ok(Math.hypot(p.center[0]-q.center[0],p.center[1]-q.center[1])<1e-10,`front path at ${t}/${i}/${at}`);assert.ok(Math.abs(distance(s.sampleMaterialPoint(s.sourceToMaterial(at),v,1).center,s.sampleMaterialPoint(s.sourceToMaterial(at),v,-1).center)-.006)<1e-10);}}}
});
test('the approved final pull stays byte-identical after the depth contact transition',()=>{
 for(const t of[18.8,18.9,19,19.2,19.5,19.8])assert.deepEqual(buildBlenderBelt(t).vertexData,buildBlenderBelt(t,{depthContact:false}).vertexData);
});
