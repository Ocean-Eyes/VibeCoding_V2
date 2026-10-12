import {posedHand,handViewPoint} from '../../src/hand-rig.js';
import {lapelRest,graspCenter} from '../../src/collar-interaction.js';
export function handAt(center,curl,left=true,palmUp=false){
 const angle=left?.95:-.95,c=Math.cos(angle),s=Math.sin(angle);
 const hand=posedHand(curl).landmarks.map(p=>{const [x,y,z]=handViewPoint(p,left,palmUp);return {x:2.55*(x*c-y*s),y:2.55*(x*s+y*c),z:z*2.55}});
 const anchor=graspCenter(hand);return hand.map(p=>({...p,x:p.x+center.x-anchor.x,y:p.y+center.y-anchor.y}));
}
export function collarHands(phase){
 if(phase==='lost')return [null,null];
 return [0,1].map(i=>{
  const side=i?-1:1,point=lapelRest(side,side>0?.12:.20);
  if(['pull','release'].includes(phase)||(phase==='one-pull'&&i===0))point.x+=side*.22;
  if(phase==='fast')point.x+=side*.56;
  if(['inward','hands-only'].includes(phase))point.x-=side*.19;
  if(phase==='outside'){point.x=side*.7;point.y=.7}
  const open=['open','release'].includes(phase);
  return handAt(point,open?0:1,i===0);
 });
}

export function collarArms(phase='close'){
 if(['lost','no-elbows','hands-only'].includes(phase))return [null,null];
 return [0,1].map(i=>({shoulder:{x:i?.5:-.5,y:0,visibility:1},elbow:{x:i?.67:-.67,y:.70-(['lift','lift-wide'].includes(phase)||(phase==='one-lift'&&i===0)?.15:0),visibility:1}}));
}
