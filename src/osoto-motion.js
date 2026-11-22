// Blue judogi performer in https://www.youtube.com/shorts/wrE0Zi5VukI.
// Authored solo reconstruction from visible entry/lift/reap events, not mocap.
// +Z is forward, anatomical right is -X. The front camera shows anatomical right on screen-left without mirroring.
import {body,limb,add,mul} from './throw-motion.js';
export const OSOTO_POSES=[
 {p:[0,.945,0],l:[.18,.065,-.17],r:[-.18,.065,.20],lean:.02,left:[-.23,.08,.24],right:[.13,.54,.34]},
 {p:[.12,.94,.14],l:[.23,.065,.38],r:[-.14,.065,.04],lean:.08,left:[-.20,.08,.21],right:[.12,.54,.32]},
 {p:[.16,.94,.20],l:[.23,.065,.38],r:[-.12,.50,.57],lean:.10,left:[-.20,.08,.21],right:[.12,.54,.32]},
 {p:[.15,.94,.24],l:[.23,.065,.38],r:[-.12,.43,-.49],lean:.72,left:[-.20,.08,.21],right:[.10,.54,.32]},
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
 const roll=t<=2?0:-.04*u,c=Math.cos(roll),s=Math.sin(roll);
 const rotate=v=>[c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]];
 const around=p=>add(rig.pelvis,rotate(p.map((v,i)=>v-rig.pelvis[i])));
 const originalAt=rig.at;rig.at=(...args)=>around(originalAt(...args));
 for(const key of ['up','right','forward'])rig[key]=rotate(rig[key]);
 for(const side of ['left','right'])rig.shoulders[side]=around(rig.shoulders[side]);
 rig.head=around(rig.head);rig.neck=around(rig.neck);
 for(const [side,sign]of [['left',-1],['right',1]]){
  const target=rig.at(...pose[side]);
  rig.arms[side]=limb(rig.shoulders[side],target,.33,.31,add(mul(rig.right,sign*.25),add(mul(rig.up,-.8),mul(rig.forward,.2))));
 }
 return rig;
}
