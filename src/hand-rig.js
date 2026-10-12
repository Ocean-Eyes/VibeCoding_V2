import {HAND_RIG} from './hand-rig-data.js';
const I=[1,0,0,0,1,0,0,0,1];
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const mul=(a,b)=>Array.from({length:9},(_,i)=>{const r=Math.floor(i/3),c=i%3;return a[r*3]*b[c]+a[r*3+1]*b[c+3]+a[r*3+2]*b[c+6]});
const apply=(m,v)=>[dot(m.slice(0,3),v),dot(m.slice(3,6),v),dot(m.slice(6,9),v)];
function rotation(axis,t){
 const length=Math.hypot(...axis),[x,y,z]=axis.map(v=>v/length),c=Math.cos(t),s=Math.sin(t),d=1-c;
 return [c+x*x*d,x*y*d-z*s,x*z*d+y*s,y*x*d+z*s,c+y*y*d,y*z*d-x*s,z*x*d-y*s,z*y*d+x*s,c+z*z*d];
}
// Flexion values are clamped to the supplied AAH coordinate ranges.
export function posedHand(curl=1,thumbAngles={}){
 const frames=[],joints={},byName={};
 for(const node of HAND_RIG){
  const parent=node.parent<0?{p:[0,0,0],r:I}:frames[node.parent];
  const p=add(parent.p,apply(parent.r,node.position));let r=parent.r;
  for(const j of node.joints){
   let angle=0;
   if(/mcp[2-5]_e_f/.test(j.name))angle=.95*curl;
   if(/pip[2-5]_e_f/.test(j.name))angle=.85*curl;
   if(/dip[2-5]_e_f/.test(j.name))angle=.35*curl;
   if(j.name==='ra_cmc1_f_e')angle=.12;
   if(j.name==='ra_cmc1_opp')angle=0;
   if(j.name==='ra_cmc1_ad_ab')angle=.23;
   if(j.name==='ra_mcp1_e_f')angle=.68*curl;
   if(j.name==='ra_ip1_e_f')angle=1.25*curl;
   angle=thumbAngles[j.name]??angle;
   angle=Math.max(j.range[0],Math.min(j.range[1],angle));joints[j.name]=angle;
   r=mul(r,rotation(j.axis,angle));
  }
  const f={p,r,tip:node.tip?add(p,apply(r,node.tip)):null};frames.push(f);byName[node.name]=f;
 }
 // The exact 21 landmark topology documented in references/hands.md.
 const landmarks=[[0,0,0],...['RA4M1','RA5P1','RA6D1'].map(n=>byName[n].p),byName.RA6D1.tip];
 for(let digit=2;digit<=5;digit++)landmarks.push(...[`RA5P${digit}`,`RA6M${digit}`,`RA7D${digit}`].map(n=>byName[n].p),byName[`RA7D${digit}`].tip);
 return {landmarks,joints};
}
// Model coordinates are projected with dorsal +Z toward the viewer and distal -Y upward.
// Left/right identity is independent of screen position; supination is a 3D rotation.
export function handViewPoint(p,left,palmUp){
 const handed=left?1:-1,turn=palmUp?-1:1;
 return [p[0]*handed*turn,p[1],p[2]*turn];
}
export function handCapsules(left=false,palmUp=false){
 const {landmarks}=posedHand();const segments=[];
 const put=(a,b,r)=>segments.push({a:handViewPoint(a,left,palmUp),b:handViewPoint(b,left,palmUp),r});
 for(let finger=0;finger<5;finger++){
  const start=1+finger*4;
  for(let j=0;j<3;j++)put(landmarks[start+j],landmarks[start+j+1],(finger===0?.0105:.0095)-j*.0012-(finger===4?.001:0));
 }
 return segments;
}
