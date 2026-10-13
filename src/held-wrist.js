import {GRIP_TUNING} from './grip-tuning.js';
// Pose wrists continue an established grip; they never invent finger observations.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export class HeldWrist {
 constructor(wrist,tuning=GRIP_TUNING){this.tuning=tuning;this.last={...wrist};this.time=null;this.candidate=null;this.revision=0;this.status='tracked';this.recoveredAt=null}
 update(wrist,now,{recover=false,sampleTime=now}={}){
  if(!wrist||!Number.isFinite(wrist.x)||!Number.isFinite(wrist.y)){this.status='missing';this.candidate=null;return null}
  if((wrist.visibility??1)<this.tuning.wristVisibility){this.status='uncertain';this.candidate=null;return null}
  // Continuous travel has no permanent radius limit. Abrupt changes must first
  // establish a stable, unambiguous nearby wrist; they are never scored as motion.
  if(distance(wrist,this.last)>.075){
   this.status='recovering';
   if(!recover||distance(wrist,this.last)>.28){this.candidate=null;return null}
   if(!this.candidate||distance(wrist,this.candidate.wrist)>.025)this.candidate={wrist:{...wrist},since:now,sampleTime,samples:0};
   if(this.candidate.sampleTime!==sampleTime||this.candidate.samples===0){this.candidate.samples++;this.candidate.sampleTime=sampleTime;}
   if(now-this.candidate.since<this.tuning.wristRecoveryMs||this.candidate.samples<3)return null;
   this.last={...wrist};this.time=now;this.candidate=null;this.revision++;this.recoveredAt=now;this.status='tracked';return {...this.last};
  }
  this.candidate=null;this.status='tracked';
  const dt=this.time===null?0:Math.min(.1,Math.max(0,(now-this.time)/1000));
  const d=distance(wrist,this.last),u=d?Math.min(1,Math.max(.003,dt*.65)/d):1;
  this.last={...wrist,x:this.last.x+(wrist.x-this.last.x)*u,y:this.last.y+(wrist.y-this.last.y)*u};this.time=now;
  return {...this.last};
 }
}
export function wristTurn(start,wrist,center,startCenter=center){
 if(!start||!wrist)return null;
 const a={x:start.x-startCenter.x,y:start.y-startCenter.y},b={x:wrist.x-center.x,y:wrist.y-center.y};
 const r=Math.hypot(a.x,a.y),s=Math.hypot(b.x,b.y);
 if(r<.06||s<r*.65||s>r*1.35)return null;
 return Math.atan2(a.x*b.y-a.y*b.x,a.x*b.x+a.y*b.y);
}
// Keep the last observed closed shape rigid. No inferred opening, finger bending,
// scaling or bone-length changes are introduced while fingers are hidden.
export function gloveAtWrist(hand,wrist){
 if(!hand||!wrist)return null;
 const center=[5,9,13,17].reduce((p,k)=>({x:p.x+hand[k].x/4,y:p.y+hand[k].y/4}),{x:0,y:0});
 const angle=wristTurn(hand[0],wrist,center)??0,c=Math.cos(angle),s=Math.sin(angle),w=hand[0];
 return hand.map(p=>({...p,x:wrist.x+(p.x-w.x)*c-(p.y-w.y)*s,y:wrist.y+(p.x-w.x)*s+(p.y-w.y)*c}));
}
