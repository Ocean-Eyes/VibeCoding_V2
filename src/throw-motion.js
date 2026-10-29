// Reference events and coordinate conventions: docs/throw-motion-reference.md.
// Authored instructional poses, not a contact physics simulation.
export const PHASE_SECONDS=[3.2,4.2,4];
export const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k);
export const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),unit=a=>mul(a,1/(Math.hypot(...a)||1));
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),ease=t=>t*t*(3-2*t),clamp=t=>Math.max(0,Math.min(1,t));
export const BONE_LENGTHS={thigh:.46,shin:.45,upperArm:.33,forearm:.31,spine:.49};
// Feet are ankle centres. The sole is .065 m below them.
const ready={p:[0,.9,-.34],yaw:0,lean:.04,l:[-.18,.065,-.40],r:[.18,.065,-.23]};
const partner={p:[0,.91,.38],yaw:Math.PI,lean:0,l:[.22,.065,.49],r:[-.22,.065,.33]};
const pose=(base,change)=>({...base,...change});
const key=(at,t,u)=>({at,t:pose(ready,t),u:pose(partner,u)});
export const THROW_KEYS={
 'o-soto-gari':[
  key(0,{},{}),
  key(1,{p:[-.24,.89,-.23],l:[-.42,.065,-.22],lean:.10},{p:[-.04,.91,.54],lean:-.12}),
  key(1.45,{p:[-.40,.86,.06],l:[-.55,.065,.45],r:[-.10,.065,-.22],lean:.08},{p:[-.04,.91,.57],lean:-.15}),
  key(2,{p:[-.44,.89,.34],l:[-.55,.065,.45],r:[-.19,.31,.95],lean:.12},{p:[-.05,.91,.59],lean:-.18}),
  key(2.25,{p:[-.44,.89,.37],l:[-.55,.065,.45],r:[-.20,.13,.53],lean:.35},{p:[-.05,.85,.68],lean:-.42,r:[-.22,.16,.45]}),
  key(2.60,{p:[-.44,.89,.39],l:[-.55,.065,.45],r:[-.20,.46,-.20],lean:.9},{p:[-.05,.52,.93],lean:-1.1,l:[.22,.26,.33],r:[-.22,.43,.18]}),
  key(3,{p:[-.44,.84,.57],l:[-.55,.065,.45],r:[-.20,.64,-.24],lean:1.45},{p:[-.05,.20,1.05],lean:-Math.PI/2,l:[.22,.10,.27],r:[-.22,.25,.24]}),
 ],
 'o-uchi-gari':[
  key(0,{},{}),
  key(1,{p:[.02,.87,-.22],lean:.12},{p:[.04,.91,.56],lean:-.12,l:[.28,.065,.61]}),
  key(1.45,{p:[.02,.85,-.06],r:[.10,.095,.38],lean:.12},{p:[.04,.91,.57],lean:-.14,l:[.28,.065,.61]}),
  key(2,{p:[.02,.84,.13],l:[-.16,.065,.04],r:[.13,.10,.49],lean:.15},{p:[.04,.91,.59],lean:-.18,l:[.28,.065,.63]}),
  key(2.3,{p:[.03,.81,.24],l:[-.16,.065,.04],r:[.25,.12,.72],lean:.23},{p:[.05,.85,.70],lean:-.35,l:[.36,.14,.70]}),
  key(2.65,{p:[.04,.76,.36],l:[-.16,.065,.04],r:[.58,.095,.74],lean:.40},{p:[.10,.54,.99],lean:-1.0,l:[.65,.25,.74],r:[-.20,.24,.38]}),
  key(3,{p:[.04,.72,.63],l:[-.16,.065,.15],r:[.62,.065,.65],lean:1.1},{p:[.10,.20,1.12],lean:-Math.PI/2,l:[.65,.16,.60],r:[-.20,.09,.34]}),
 ],
 'ippon-seoi-nage':[
  key(0,{},{}),
  key(1,{p:[0,.88,-.34],lean:-.04},{p:[0,.92,.35],lean:.12}),
  key(1.4,{p:[.08,.83,-.05],yaw:-.7,lean:.05,r:[-.16,.065,.20]},{p:[0,.92,.32],lean:.2}),
  key(1.72,{p:[.03,.73,.04],yaw:-2.1,lean:.10,r:[-.16,.065,.20],l:[.18,.13,-.08]},{p:[0,.94,.34],lean:.3}),
  key(2,{p:[0,.69,.04],yaw:-Math.PI,lean:.12,l:[.18,.065,.05],r:[-.18,.065,.15]},{p:[0,.94,.37],lean:.40}),
  key(2.32,{p:[0,.85,.04],yaw:-Math.PI,lean:.55,l:[.18,.065,.05],r:[-.18,.065,.15]},{p:[-.18,1.10,.22],lean:.92,l:[.04,.35,.60],r:[-.40,.35,.44]}),
  key(2.55,{p:[0,.84,.04],yaw:-Math.PI,lean:1.00,l:[.18,.065,.05],r:[-.18,.065,.15]},{p:[-.34,1.14,-.30],lean:1.85,l:[-.15,1.06,.47],r:[-.59,1.13,.40]}),
  key(2.75,{p:[0,.79,.04],yaw:-Math.PI,lean:1.15,l:[.18,.065,.05],r:[-.18,.065,.15]},{p:[-.23,.75,-.76],lean:3.35,l:[-.06,1.44,-.70],r:[-.50,1.40,-.82]}),
  key(3,{p:[0,.78,.04],yaw:-Math.PI,lean:1.2,l:[.18,.065,.05],r:[-.18,.065,.15]},{p:[-.12,.20,-1.00],lean:Math.PI*1.5,l:[.06,.10,-1.77],r:[-.36,.18,-1.77]}),
 ],
};
function blend(a,b,t){return Object.fromEntries(Object.keys(a).map(k=>[k,Array.isArray(a[k])?mix(a[k],b[k],t):a[k]+(b[k]-a[k])*t]));}
// A fixed-length two-bone solve. Reach correction is exposed for QA; it must
// never be hidden by stretching the limb or changing the camera scale.
function limb(root,target,a,b,pole){
 const delta=sub(target,root),distance=Math.hypot(...delta),d=Math.max(.0001,Math.min(a+b-.00001,distance));
 const axis=unit(delta),end=add(root,mul(axis,d)),along=(a*a-b*b+d*d)/(2*d);
 let bend=sub(pole,mul(axis,dot(pole,axis)));if(Math.hypot(...bend)<.001)bend=cross(axis,[0,0,1]);
 const joint=add(add(root,mul(axis,along)),mul(unit(bend),Math.sqrt(Math.max(0,a*a-along*along))));
 return {root,joint,end,reachError:Math.max(0,distance-d)};
}
function body(p){
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw),cl=Math.cos(p.lean),sl=Math.sin(p.lean);
 const right=[c,0,-s],up=[s*sl,cl,c*sl],forward=[s*cl,-sl,c*cl];
 const at=(x,y,z=0)=>add(p.p,add(mul(right,x),add(mul(up,y),mul(forward,z))));
 const legs={};for(const [side,sign,foot] of [['left',-1,p.l],['right',1,p.r]])legs[side]=limb(at(sign*.135,0),foot,BONE_LENGTHS.thigh,BONE_LENGTHS.shin,add(mul(forward,1),mul(up,-.1)));
 return {pelvis:p.p,yaw:p.yaw,lean:p.lean,right,up,forward,at,shoulders:{left:at(-.205,.49),right:at(.205,.49)},neck:at(0,.57),head:at(0,.70),legs,arms:{}};
}
export function sampleThrow(id,time){
 const keys=THROW_KEYS[id];if(!keys)throw new Error('Unknown throw: '+id);
 const t=Math.max(0,Math.min(3,time));let i=0;while(i<keys.length-2&&t>keys[i+1].at)i++;
 const a=keys[i],b=keys[i+1],q=ease((t-a.at)/(b.at-a.at));
 const tPose=blend(a.t,b.t,q),uPose=blend(a.u,b.u,q),seoi=id==='ippon-seoi-nage';
 // During the shoulder roll the head must clear the mat before the back lands.
 // Lift the airborne root, not the head or individual bones.
 if(seoi&&t>2){const c=Math.cos(uPose.lean),s=Math.sin(uPose.lean);uPose.p[1]=Math.max(uPose.p[1],.025-.70*c+Math.hypot(.137*c,.10*s));}
 const tori=body(tPose),uke=body(uPose);
 const turn=seoi?ease(clamp((t-1)/.8)):0,fall=ease(clamp((t-2.35)/.55));
 // The sleeve stays attached to uke's right forearm throughout the motion.
 const sleeveDirection=unit(sub(tori.shoulders.left,uke.shoulders.right));
 const ukeElbow=add(uke.shoulders.right,mul(sleeveDirection,.33));
 const ukeWrist=add(ukeElbow,mul(unit(sub(tori.at(-.1,.44,.1),ukeElbow)),.31));
 uke.arms.right={root:uke.shoulders.right,joint:ukeElbow,end:ukeWrist,reachError:0};
 const sleeve=add(ukeElbow,mul(unit(sub(ukeWrist,ukeElbow)),.035));
 tori.arms.left=limb(tori.shoulders.left,sleeve,.33,.31,add(mul(tori.right,-1),mul(tori.up,-.8)));
 const lapel=uke.at(-.1,.40,.145),underarm=add(uke.shoulders.right,mul(sleeveDirection,.13));
 const rightGrip=mix(mix(lapel,underarm,turn),tori.at(.24,.05,.40),fall);
 tori.arms.right=limb(tori.shoulders.right,rightGrip,.33,.31,add(mul(tori.right,1),mul(tori.up,-1)));
 const release=mix(tori.arms.right.joint,uke.at(-.58,.15,.08),fall);
 uke.arms.left=limb(uke.shoulders.left,release,.33,.31,add(mul(uke.right,-1),mul(uke.up,-.4)));
 return {id,time:t,phase:Math.min(2,Math.floor(t)),tori,uke,contacts:{sleeve,rightGrip},turn,fall};
}
