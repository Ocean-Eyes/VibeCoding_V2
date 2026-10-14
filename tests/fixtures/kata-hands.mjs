import {handAt} from './collar-hands.mjs';
import {lapelRest,graspCenter} from '../../src/collar-interaction.js';
export function kataHands({mirror=true,reverse=false,curl=1,scale=1}={}){
 return [0,1].map(i=>{
  const center=lapelRest((i?-1:1)*(mirror?1:-1),i?.20:.12);
  const hand=handAt({x:0,y:0},curl,i===0,reverse?i===1:i===0);
  return hand.map(p=>({...p,x:center.x+p.x*scale*(mirror?1:-1),y:center.y+p.y*scale,z:p.z*scale}));
 });
}
export function rotateKataHand(hand,angle){
 const center=graspCenter(hand),c=Math.cos(angle),s=Math.sin(angle);
 return hand.map(p=>({...p,x:center.x+(p.x-center.x)*c-(p.y-center.y)*s,y:center.y+(p.x-center.x)*s+(p.y-center.y)*c}));
}
export function kataArms(hands,{mirror=true,angles=[0,0],lift=[0,0],visibility=1}={}){
 return hands.map((h,i)=>{
  const wrist=h[0],sign=(i?1:-1)*(mirror?1:-1),elbow={x:sign*.67,y:.70},a=angles[i],c=Math.cos(a),s=Math.sin(a);
  return {wrist:{...wrist,visibility},shoulder:{x:sign*.5,y:0,visibility},elbow:{x:wrist.x+(elbow.x-wrist.x)*c-(elbow.y-wrist.y)*s,y:wrist.y+(elbow.x-wrist.x)*s+(elbow.y-wrist.y)*c-lift[i],visibility}};
 });
}
