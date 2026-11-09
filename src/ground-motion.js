// Authored hand-connection demonstration. Reference: docs/ground-reference.md.
// No joint rotation or pressure is animated; the opponent's bent arm stays fixed.
import {body,limb,add,sub,mul,unit} from './throw-motion.js';
function seatedBody(pose,roll){
 const rig=body(pose),c=Math.cos(roll),s=Math.sin(roll);
 const rotate=v=>[c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]];
 const around=v=>add(rig.pelvis,rotate(sub(v,rig.pelvis)));
 const at=rig.at;rig.at=(...args)=>around(at(...args));
 for(const key of ['right','up','forward'])rig[key]=rotate(rig[key]);
 for(const key of ['head','neck'])rig[key]=around(rig[key]);
 for(const side of ['left','right'])rig.shoulders[side]=around(rig.shoulders[side]);
 for(const [side,sign,foot]of [['left',-1,pose.l],['right',1,pose.r]])
  rig.legs[side]=limb(rig.at(sign*.135,0),foot,.46,.45,[-.7,.35,0]);
 return rig;
}
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
function opponent(){
 const rig=body({p:[0,.24,0],yaw:0,lean:-Math.PI/2,l:[.18,.12,.87],r:[-.18,.12,.87]});
 rig.arms.left=limb(rig.shoulders.left,[.28,.26,-.02],.33,.31,[1,.2,0]);
 rig.arms.right=limb(rig.shoulders.right,[-.26,.27,-.05],.33,.31,[0,1,0]);
 return rig;
}
export function sampleGround(id,time=0){
 const uke=opponent(),t=Math.max(0,Math.min(id==='ude-garami'?2:3,time));
 const enter=smooth(t),wrap=smooth(t-1);
 const tori=id==='ude-garami'?body({p:[-.5,.4,-.2],yaw:Math.PI,lean:0,l:[-.8,.08,-.8],r:[-.9,.08,.5]}):
 seatedBody({p:mix([-.62,.49,-.06],[-.48,.24,-.16],enter),yaw:Math.PI,lean:.1+.15*enter+.25*wrap,
 l:[-.90,.075,.50],r:mix([-.72,.075,.05],[-.70,.075,-.92],enter)},-.4*enter-.42*wrap);
 if(id==='ude-garami'){
  // Anatomical right upper arm extends sideways; the 90-degree forearm
  // points toward the head, not toward the feet.
  uke.arms.right={root:uke.shoulders.right,joint:add(uke.shoulders.right,[-.33,0,0]),end:add(uke.shoulders.right,[-.33,0,-.31])};
  const wrist=uke.arms.right.end,elbow=uke.arms.right.joint;
  const rightEnd=mix([-.96,.50,-1.20],add(wrist,[-.045,.025,0]),smooth(t));
  const rightRoot=[-.96,.52,-1.11];
  tori.arms.right=limb(rightRoot,rightEnd,.33,.31,[0,.4,-.4]);
  const rightJoint=tori.arms.right.joint;
  const ownForearm=add(rightEnd,mul(unit(sub(rightJoint,rightEnd)),.115));
  const under=add(elbow,[0,-.14,-.08]);
  const q=smooth((t-1)*2),finish=smooth((t-1.5)*2);
  const leftEnd=t<1.5?mix([-.95,.45,-.30],under,q):mix(under,ownForearm,finish);
  // The forearm approaches from below the opponent's upper arm.
  tori.arms.left=limb([-.91,.44,-.61],leftEnd,.33,.31,[0,-.4,.4]);
  return {id,time:t,ground:true,armsOnly:true,tori,uke,gripTargets:{opponentWrist:wrist,ownForearm,under}};
 }
 // The hip sits beside uke's right ribs. The trunk tilts sideways onto the
 // upper chest, facing the head; the right leg extends forward, left leg back.
 uke.arms.left=limb(uke.shoulders.left,[.28,.26,-.02],.33,.31,[1,.2,0]);
 uke.arms.right=limb(uke.shoulders.right,mix([-.30,.26,-.05],[-.31,.69,-.41],enter),.33,.31,[-1,.4,0]);
 const rightEnd=mix([-.72,.48,-.32],[.17,.33,-.49],wrap);
 tori.arms.right=limb(tori.shoulders.right,rightEnd,.33,.31,[0,-.2,-1]);
 const sleeve=add(uke.arms.right.joint,[-.04,.035,0]);
 tori.arms.left=limb(tori.shoulders.left,mix([-.45,.45,-.10],sleeve,enter),.33,.31,[-1,.15,-.2]);
 return {id,time:t,ground:true,tori,uke};
}
