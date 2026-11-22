// Authored hand-connection demonstration. Reference: docs/ground-reference.md.
// The final lever is a small demonstration, never a pressure measurement.
import {body,limb,add,sub,mul,unit,dot,cross} from './throw-motion.js';
import {GROUND_CONTACT_RATE,UDE_LEFT_ELBOWS,UDE_RIGHT_ELBOWS} from './ground-contact-data.js';
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
export function groundDemoTime(id,elapsed){
 const cycle=elapsed%(id==='ude-garami'?24:12);
 return id!=='ude-garami'||cycle<=12?Math.min(3,cycle/3):Math.max(0,3-(cycle-12)/3);
}
function opponent(){
 const rig=body({p:[0,.24,0],yaw:0,lean:-Math.PI/2,l:[.18,.12,.87],r:[-.18,.12,.87]});
 rig.arms.left=limb(rig.shoulders.left,[.28,.26,-.02],.33,.31,[1,.2,0]);
 rig.arms.right=limb(rig.shoulders.right,[-.26,.27,-.05],.33,.31,[0,1,0]);
 return rig;
}
export function sampleGroundAuthored(id,time=0,rightContact=UDE_RIGHT_ELBOWS){
 const uke=opponent(),t=Math.max(0,Math.min(3,time));
 const enter=smooth(t),wrap=smooth(t-1);
 const tori=id==='ude-garami'?body({p:[-.5,.4,-.2],yaw:Math.PI,lean:0,l:[-.8,.08,-.8],r:[-.9,.08,.5]}):
 seatedBody({p:mix([-.62,.49,-.06],[-.48,.24,-.16],enter),yaw:Math.PI,lean:.1+.15*enter+.25*wrap,
 l:[-.90,.075,.50],r:mix([-.72,.075,.05],[-.70,.075,-.92],enter)},-.4*enter-.42*wrap);
 if(id==='ude-garami'){
  // Uke's anatomical right arm is raised in a clear L: the upper arm opens
  // away from the ribs and the forearm points upward, as in the requested pose.
  uke.arms.right={root:uke.shoulders.right,joint:add(uke.shoulders.right,[-.33,0,0]),end:add(uke.shoulders.right,[-.33,.31,0])};
  const lift=smooth(t-2),arm=uke.arms.right;
  // Rotate the elbow around the shoulder-to-wrist axis. Both bone lengths
  // and the pinned wrist remain fixed while the elbow rises.
  const pivotAxis=unit(sub(arm.end,arm.root)),v=sub(arm.joint,arm.root),angle=.28*lift;
  arm.joint=add(arm.root,add(add(mul(v,Math.cos(angle)),mul(cross(pivotAxis,v),Math.sin(angle))),mul(pivotAxis,dot(pivotAxis,v)*(1-Math.cos(angle)))));
  const wrist=uke.arms.right.end,elbow=uke.arms.right.joint;
  // Mounted above the chest and turned toward the right arm. Preserve the
  // shoulder width while leaning in; neither arm reaches through the other.
  const reach=1-smooth((t-1.6)/.4);
  const rightRoot=[.035-.15*reach,.47+.085*lift,-.58];
  const leftRoot=add(rightRoot,[-.38,0,-Math.sqrt(.41**2-.38**2)]);
  const wristAxis=unit(sub(wrist,elbow)),rightNormal=unit(sub([0,0,-1],mul(wristAxis,dot([0,0,-1],wristAxis))));
  const wristSite=add(wrist,mul(wristAxis,-.012));
  const rightApproach=1-smooth(t/.8);
  const rightEnd=add(add(wristSite,mul(rightNormal,.080+.18*rightApproach)),[0,.14*rightApproach,0]);
  tori.arms.right=limb(rightRoot,rightEnd,.33,.31,[-1,.156,.49]);
  if(rightContact.length){
   const index=t*GROUND_CONTACT_RATE,i=Math.min(rightContact.length-2,Math.floor(index));
   tori.arms.right=limb(rightRoot,rightEnd,.33,.31,sub(mix(rightContact[i],rightContact[i+1],index-i),rightRoot));
  }
  const rightJoint=tori.arms.right.joint;
  const ownForearm=add(rightEnd,mul(unit(sub(rightJoint,rightEnd)),.115));
  const axis=unit(sub(rightJoint,rightEnd)),toward=[0,-1,-.4];
  const leftNormal=unit(sub(toward,mul(axis,dot(toward,axis))));
  // Place the palm outside the forearm; curled fingers face its surface.
  const ownGrip=add(ownForearm,mul(leftNormal,.080));
  // Enter below the elbow from outside, then rise on the head side before
  // closing the figure-four grip. Direct diagonals cross uke's forearm.
  const under=add(elbow,[-.165,-.14,-.23]);
  const below=add(elbow,[-.165,-.14,.11]);
  const bridge=add(elbow,[.095,.10,-.24]);
  const leftEnd=t<1?below:
   t<1.35?mix(below,under,smooth((t-1)/.35)):
   t<1.65?mix(under,bridge,smooth((t-1.35)/.30)):mix(bridge,ownGrip,smooth((t-1.65)/.25));
  // The forearm approaches from below the opponent's upper arm.
  tori.arms.left=limb(leftRoot,leftEnd,.33,.31,[-.37,-1,-.165]);
  return {id,time:t,ground:true,armsOnly:true,tori,uke,
   ukeGrips:{right:{offset:.050}},
   grips:{right:{normal:rightNormal,axis:wristAxis,radius:.038,palmOffset:.080,held:smooth((t-.8)/.2)},left:{normal:leftNormal,axis,radius:.042,palmOffset:.080,held:smooth((t-1.9)/.1)}},
   gripTargets:{opponentWrist:wrist,wristSite,ownForearm,ownGrip,under,below}};
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

export function sampleGround(id,time=0){
 const pose=sampleGroundAuthored(id,time);
 if(id==='ude-garami'){
  const index=pose.time*GROUND_CONTACT_RATE,i=Math.min(UDE_LEFT_ELBOWS.length-2,Math.floor(index));
  const guide=mix(UDE_LEFT_ELBOWS[i],UDE_LEFT_ELBOWS[i+1],index-i),arm=pose.tori.arms.left;
  pose.tori.arms.left=limb(arm.root,arm.end,.33,.31,sub(guide,arm.root));
 }
 return pose;
}
