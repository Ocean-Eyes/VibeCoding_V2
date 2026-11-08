import {graspCenter,curledFingers,fingerExtension,gripPosture} from './collar-interaction.js';
import {GRIP_STEPS} from './demonstration.js';

export const PLACEMENT_HOLD_SECONDS=1.2;
export const PLACEMENT_PASS_SCORE=100;
export const PLACEMENT_RADIUS=.32;
export function placementTarget(index,mirrored=true){
 const p=GRIP_STEPS[2][index];return {x:p.x*(mirrored?-1:1),y:p.y};
}
export function evaluatePlacement(hand,index,{mirrored=true,directions=['↓','↓']}={}){
 const target=placementTarget(index,mirrored);
 if(!hand||hand.length!==21||hand.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z??0)))return {target,matched:false,issue:'tracking',score:0};
 const center=graspCenter(hand),distance=Math.hypot(center.x-target.x,center.y-target.y);
 const side=(index?-1:1)*(mirrored?1:-1);
 const orientation=gripPosture(hand,index,side,mirrored,directions[index]);
 // Allow a relaxed fist and one or two noisy finger estimates from the webcam.
 const closed=curledFingers(hand).length>=2&&fingerExtension(hand)<.92;
 const located=distance<=PLACEMENT_RADIUS;
 const matched=closed&&located&&!orientation;
 return {target,center,distance,closed,located,orientation,matched,
   issue:!closed?'open':orientation?'palm':!located?'position':'hold',
   score:matched?100:Math.min(99,Math.round(((closed?1:0)+(orientation?0:1)+Math.max(0,1-Math.max(0,distance-PLACEMENT_RADIUS)/.3))/3*100))};
}
// Static targets only: no grab transition, sequence, elbow lift, wrist turn, or
// inferred/remembered hand can award progress. Both observed hands must match.
export class HandPlacement{
 constructor(){this.reset()}
 reset(){this.hands=[{grip:null},{grip:null}];this.lastTime=null;this.lastMirror=null;this.hold=0;this.tapped=false}
 update(observations,now,{active=false,mirrored=true,directions=['↓','↓']}={}){
  if(this.lastMirror!==null&&this.lastMirror!==mirrored)this.reset();
  const dt=this.lastTime===null?0:Math.max(0,Math.min(.1,(now-this.lastTime)/1000));this.lastTime=now;this.lastMirror=mirrored;
  const checks=[0,1].map(i=>evaluatePlacement(observations[i],i,{mirrored,directions}));
  const grips=checks.map((c,i)=>c.matched?{side:(i?-1:1)*(mirrored?1:-1),center:c.center,start:c.center,wrist:observations[i][0],t:.15,dx:0,dy:0}:null);
  this.hands=grips.map(grip=>({grip}));
  const matched=checks.every(c=>c.matched),count=grips.filter(Boolean).length;
  if(!this.tapped)this.hold=active&&matched?Math.min(PLACEMENT_HOLD_SECONDS,this.hold+dt):0;
  if(this.hold>=PLACEMENT_HOLD_SECONDS)this.tapped=true;
  return {checks,grips,count,visible:observations.filter(Boolean).length,score:matched?100:Math.min(99,Math.round(checks.reduce((v,c)=>v+c.score,0)/2)),
   aligned:matched,crossed:matched,completion:matched?1:0,hold:this.hold,tapped:this.tapped,
   trackingPaused:checks.some(c=>c.issue==='tracking'),issue:checks.find(c=>!c.matched)?.issue??'hold',
   posture:checks.map(c=>c.orientation),deformation:[],wristHands:[null,null],wristOpacity:[0,0],
   scoringWrists:observations.map(h=>h?.[0]??null),wristStatus:checks.map(c=>c.issue==='tracking'?'missing':'tracked'),
   finishLevels:checks.map(c=>c.matched?1:0),elbowLevels:[null,null],forearmLevels:[0,0],forearmStatus:['not-used','not-used'],forearmAngles:[null,null],wristLevels:[0,0]};
 }
}
