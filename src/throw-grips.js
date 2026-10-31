// Material-space grasp locations. These are independent of the gripping wrist;
// tests compare the wrist with this surface, never with a copy of itself.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>mul(a,1/(Math.hypot(...a)||1));
const mix=(a,b,t)=>add(mul(a,1-t),mul(b,t));
export const GRASP_OFFSET=.047;
export function sleeveContact(arm,toward){
 const axis=unit(sub(arm.end,arm.joint)),centre=mix(arm.joint,arm.end,.35),delta=sub(toward,centre);
 const normal=unit(sub(delta,mul(axis,dot(delta,axis))));
 // Sleeve radius here is .0585 m; a 6.5 mm gathered fold remains connected
 // to the sleeve. The palm and curled fingers surround that fold.
 const surface=add(centre,mul(normal,.065));
 return {kind:'sleeve',centre,axis,normal,surface,wrist:add(surface,mul(normal,GRASP_OFFSET)),held:1};
}
export function lapelContact(rig){
 const normal=rig.forward,surface=rig.at(-.1,.40,.153);
 return {kind:'lapel',surface,normal,axis:rig.up,wrist:add(surface,mul(normal,GRASP_OFFSET)),held:1};
}
export function underarmContact(rig){
 const arm=rig.arms.right,axis=unit(sub(arm.joint,arm.root)),centre=add(arm.root,mul(axis,.24)),down=mul(rig.up,-1);
 const normal=unit(sub(down,mul(axis,dot(down,axis)))),surface=add(centre,mul(normal,.078));
 return {kind:'underarm',centre,axis,normal,surface,wrist:add(surface,mul(normal,GRASP_OFFSET)),held:1};
}
export function releaseRightGrip(rig,held,fall,shoulderThrow){
 const resting=rig.at(.24,.05,.40),direct=mix(held,resting,fall);
 // The hooked right hand leaves around the outside of uke's arm, not on a
 // straight line through its sleeve during the shoulder roll.
 return shoulderThrow?add(direct,mul(rig.right,.18*Math.sin(Math.PI*fall))):direct;
}
export function attachThrowGrips(pose){
 const {tori,uke,turn,fall}=pose;
 const sleeve=sleeveContact(uke.arms.right,tori.arms.left.end),lapel=lapelContact(uke),under=underarmContact(uke);
 const right={kind:turn<.001?'lapel':turn>.999?'underarm':'transfer',
  surface:mix(lapel.surface,under.surface,turn),normal:unit(mix(lapel.normal,under.normal,turn)),
  axis:unit(mix(lapel.axis,under.axis,turn)),
  wrist:releaseRightGrip(tori,mix(lapel.wrist,under.wrist,turn),fall,pose.id==='ippon-seoi-nage'),
  held:(1-fall)*(turn>0&&turn<1?0:1),orientationWeight:1-fall};
 pose.grips={left:sleeve,right};
 pose.contacts={sleeve:sleeve.wrist,rightGrip:right.wrist};
 return pose;
}
