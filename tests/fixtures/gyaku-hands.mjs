import {handAt} from './collar-hands.mjs';
import {graspCenter,lapelRest} from '../../src/collar-interaction.js';
// Rotate about the wrist-to-palm axis in 3D, not just in the image plane.
export function rollHand(hand,angle){
 const w=hand[0],p=graspCenter(hand),z=[5,9,13,17].reduce((v,k)=>v+(hand[k].z??0)/4,0);
 const axis=[p.x-w.x,p.y-w.y,z-(w.z??0)],length=Math.hypot(...axis),[x,y,az]=axis.map(v=>v/length),c=Math.cos(angle),s=Math.sin(angle);
 return hand.map(p=>{const a=p.x-w.x,b=p.y-w.y,d=(p.z??0)-(w.z??0),dot=x*a+y*b+az*d;
  return {...p,x:w.x+a*c+(y*d-az*b)*s+x*dot*(1-c),y:w.y+b*c+(az*a-x*d)*s+y*dot*(1-c),z:(w.z??0)+d*c+(x*b-y*a)*s+az*dot*(1-c)};
 });
}
export function gyakuHands({curl=1,roll=0,mirror=true,scale=1,collapsed=false,wrongFace=false}={}){
 return [0,1].map(i=>{
  const center=lapelRest(i?-1:1,i?.20:.12),raw=handAt(center,curl,i===0,!wrongFace);
  let hand=rollHand(raw,roll*(i?-1:1));
  if(collapsed)hand=hand.map((p,k)=>{if(k<6||[9,13,17].includes(k))return p;const base=5+Math.floor((k-5)/4)*4;if(base<5)return p;const a=hand[base];return {...p,x:a.x+(p.x-a.x)*(typeof collapsed==='number'?collapsed:.25),y:a.y+(p.y-a.y)*(typeof collapsed==='number'?collapsed:.25),z:a.z+(p.z-a.z)*(typeof collapsed==='number'?collapsed:.25)}});
  return hand.map(p=>({...p,x:(center.x+(p.x-center.x)*scale)*(mirror?1:-1),y:center.y+(p.y-center.y)*scale,z:p.z*scale}));
 });
}
