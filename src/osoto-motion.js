// Blue judogi performer in https://www.youtube.com/shorts/wrE0Zi5VukI.
// Authored solo reconstruction from visible entry/lift/reap events, not mocap.
// +Z is forward, anatomical right is -X. The front camera shows anatomical right on screen-left without mirroring.
import {body,limb,add,mul} from './throw-motion.js';
export const OSOTO_POSES=[
 {p:[0,.88,0],l:[.18,.045,-.14],r:[-.18,.045,.13],lean:.02,left:[-.23,.37,.38],right:[.13,.48,.36]},
 {p:[.12,.85,.12],l:[.23,.045,.34],r:[-.14,.045,.04],lean:.12,left:[-.12,.26,.30],right:[.10,.47,.30]},
 {p:[.16,.87,.20],l:[.23,.045,.34],r:[-.10,.48,.52],lean:.16,left:[-.10,.23,.25],right:[.10,.45,.25]},
 {p:[.15,.85,.26],l:[.23,.045,.34],r:[-.12,.40,-.23],lean:.62,left:[-.24,.12,.24],right:[.06,.38,.26]},
];
const blend=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u);
export function sampleOsotoMotion(time){
 const t=Math.max(0,Math.min(3,time)),i=Math.min(2,Math.floor(t)),fraction=t-i,u=fraction*fraction*(3-2*fraction),a=OSOTO_POSES[i],b=OSOTO_POSES[i+1];
 const pose={yaw:0,lean:a.lean+(b.lean-a.lean)*u};
 for(const key of ['p','l','r','left','right'])pose[key]=blend(a[key],b[key],u);
 // A small arch gives the stepping left foot clearance before it plants.
 if(t<1)pose.l[1]+=.085*Math.sin(Math.PI*t)**2;
 const rig=body(pose);
 // The blue performer's finish also inclines slightly toward their left.
 // Tilt the torso rather than turning the front camera into a side view.
 const roll=t<=2?0:-.20*u,c=Math.cos(roll),s=Math.sin(roll);
 const rotate=v=>[c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]];
 const around=p=>add(rig.pelvis,rotate(p.map((v,i)=>v-rig.pelvis[i])));
 const originalAt=rig.at;rig.at=(...args)=>around(originalAt(...args));
 for(const key of ['up','right','forward'])rig[key]=rotate(rig[key]);
 for(const side of ['left','right'])rig.shoulders[side]=around(rig.shoulders[side]);
 rig.head=around(rig.head);rig.neck=around(rig.neck);
 for(const [side,sign]of [['left',-1],['right',1]]){
  const target=rig.at(...pose[side]);
  rig.arms[side]=limb(rig.shoulders[side],target,.33,.31,add(mul(rig.right,sign*.5),add(mul(rig.up,-.5),mul(rig.forward,.2))));
 }
 return rig;
}
