import {body,limb} from '../../src/throw-motion.js';

// Independent fixed-length solo bodies. Never import the judge or its targets.
export function practiceFixture(id,stage,{size=1,torso=.49,legScale=1,aspect=16/9,yawOffset=0,pitch=0,roll=0,depthGain=1,noise=0,seed=1,hidden=[],invalid=null}={}){
 const ouchi=id==='o-uchi-gari';
 const poses=ouchi?[
  {p:[0,.92,0],yaw:0,lean:.04,l:[.18,.065,-.04],r:[-.18,.065,.13]},
  {p:[.02,.88,.12],yaw:0,lean:.12,l:[.18,.065,-.04],r:[-.12,.09,.55]},
  {p:[.02,.84,.28],yaw:0,lean:.15,l:[.31,.065,.10],r:[-.13,.095,.65]},
  {p:[.02,.80,.45],yaw:0,lean:.4,l:[.31,.065,.10],r:[-.52,.09,.80]},
 ]:[
  {p:[0,.92,0],yaw:0,lean:.04,l:[.18,.065,-.04],r:[-.18,.065,.13]},
  {p:[0,.83,.10],yaw:-1.35,lean:.08,l:[.16,.065,-.08],r:[-.08,.065,.35]},
  {p:[0,.73,.10],yaw:-Math.PI,lean:.25,l:[-.18,.065,.11],r:[.18,.065,.23]},
  {p:[0,.86,.10],yaw:-Math.PI,lean:.80,l:[-.18,.065,.11],r:[.18,.065,.23]},
 ];
 const selected=structuredClone(poses[invalid==='finish-at-start'?3:invalid==='bent-at-start'?2:stage]);
 if(invalid==='stationary')Object.assign(selected,structuredClone(poses[0]));
 if(invalid==='previous')Object.assign(selected,structuredClone(poses[Math.max(0,stage-1)]));
 if(invalid==='wrong-turn')selected.yaw=-selected.yaw;
 if(invalid==='upright')selected.lean=.04;
 if(invalid==='no-extension'&&!ouchi&&stage===3)selected.p[1]=poses[2].p[1];
 if(invalid==='wrong-leg'&&ouchi&&stage===3){selected.r=structuredClone(poses[2].r);selected.l[0]=.65;selected.p[1]=.70;}
 for(const key of ['p','l','r'])selected[key]=selected[key].map(v=>v*legScale);
 const rig=body(selected);rig.shoulders={left:rig.at(-.205,torso),right:rig.at(.205,torso)};rig.head=rig.at(0,torso+.21);
 for(const [side,sign,foot]of [['left',-1,selected.l],['right',1,selected.r]])rig.legs[side]=limb(rig.at(sign*.135,0),foot,.46*legScale,.45*legScale,rig.forward.map((v,i)=>v-rig.up[i]*.1));
 for(const [side,hand]of [['left',[-.30,torso-.14,.30]],['right',[.13,torso-.06,.28]]])rig.arms[side]=limb(rig.shoulders[side],rig.at(...hand),.33,.31,[0,-1,.2]);
 for(const kind of ['arms','legs'])for(const part of Object.values(rig[kind]))if(part.reachError>1e-8)throw Error('Unreachable independent fixture: '+id+' '+stage+' '+invalid);
 const yaw=(ouchi?0:Math.PI/2)+yawOffset,c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll),points=Array(33).fill(null);
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32-.5};
 const put=(i,v)=>{
  const dx=v[0]-rig.pelvis[0],dy=v[1]-rig.pelvis[1],dz=v[2]-rig.pelvis[2];
  const x=dx*c-dz*s,depth=dx*s+dz*c,y=dy*cp-depth*sp,z=depth*cp+dy*sp,perspective=1/(1-z*.25),u=x*perspective,vv=-y*perspective;
  points[i]={x:.5+(u*cr-vv*sr)*.28*size+random()*noise,y:(aspect*.5+(u*sr+vv*cr)*.28*size+random()*noise)/aspect,z:-z*.28*size*depthGain+random()*noise*.5,visibility:hidden.includes(i)?0:1};
 };
 put(0,rig.head);for(const [side,a,e,w,h,k,f]of [['left',11,13,15,23,25,27],['right',12,14,16,24,26,28]]){
  put(a,rig.shoulders[side]);put(e,rig.arms[side].joint);put(w,rig.arms[side].end);put(h,rig.legs[side].root);put(k,rig.legs[side].joint);put(f,rig.legs[side].end);
 }
 return points;
}
