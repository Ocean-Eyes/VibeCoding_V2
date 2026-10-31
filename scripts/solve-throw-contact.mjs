// Offline position constraints. Runtime interpolation lives in throw-motion.js.
// Conservative envelopes resolve approach paths; the displayed meshes make the
// final contact check. Keep this script reproducible instead of hand-editing data.
import {body,limb,add,sub,mul,dot,unit,closeThrowGrasps} from '../src/throw-motion.js';
import {bodyIntersections} from '../src/throw-body.js';
import {releaseRightGrip} from '../src/throw-grips.js';
const mix=(a,b,t)=>add(mul(a,1-t),mul(b,t)),len=a=>Math.hypot(...a),clamp=x=>Math.max(0,Math.min(1,x));
function closest(a,b,c,d){
 const u=sub(b,a),v=sub(d,c),w=sub(a,c),aa=dot(u,u),bb=dot(u,v),cc=dot(v,v),dd=dot(u,w),ee=dot(v,w),den=aa*cc-bb*bb;
 let s=den>1e-12?clamp((bb*ee-cc*dd)/den):0,t=cc>1e-12?(bb*s+ee)/cc:0;
 if(t<0){t=0;s=aa>0?clamp(-dd/aa):0;}else if(t>1){t=1;s=aa>0?clamp((bb-dd)/aa):0;}
 return {s,t,a:mix(a,b,s),b:mix(c,d,t)};
}
function particle(p,w=1){return {p:[...p],goal:[...p],w};}
function make(r,who,time){
 const root=particle(r.pelvis,who==='tori'?.001:.01),at=(x,y,z=0)=>add(root.p,add(mul(r.right,x),add(mul(r.up,y),mul(r.forward,z))));
 const parts={};for(const kind of ['legs','arms'])for(const side of ['left','right']){const l=r[kind][side],weight=kind==='legs'?(who==='tori'?0:clamp((time-2)/.2)):1;parts[kind+'.'+side]={root:particle(l.root,0),joint:particle(l.joint),end:particle(l.end,weight)};}
 return {root,at,r,parts};
}
function anchors(s){for(const [name,l] of Object.entries(s.parts)){const [kind,side]=name.split('.');l.root.p=s.at((side==='left'?-1:1)*(kind==='legs'?.135:.205),kind==='legs'?0:.49);}}
function link(a,b,length){const delta=sub(b.p,a.p),d=len(delta),w=a.w+b.w;if(w&&d){const push=mul(delta,(d-length)/d/w);a.p=add(a.p,mul(push,a.w));b.p=sub(b.p,mul(push,b.w));}}
function bones(s){anchors(s);for(const [name,l] of Object.entries(s.parts)){const leg=name.startsWith('legs'),max=leg?.9099:.635,delta=sub(l.end.p,l.root.p),d=len(delta);if(d>max){if(!l.end.w){s.root.p=add(s.root.p,mul(delta,(d-max)/d));anchors(s);}else l.end.p=add(l.root.p,mul(delta,max/d));}link(l.root,l.joint,leg?.46:.33);link(l.joint,l.end,leg?.45:.31);}}
function capsule(a,b,r,owner,ends){return {a,b,r,owner,ends};}
function caps(s){
 const out=[];
 for(const x of [-.075,0,.075])out.push(capsule(s.at(x,.01),s.at(x,.36),.16,s,[s.root,s.root]));
 out.push(capsule(s.at(-.17,.43),s.at(.17,.43),.085,s,[s.root,s.root]));
 out.push(capsule(s.at(0,.70),s.at(0,.70),.14,s,[s.root,s.root]));
 for(const [name,l] of Object.entries(s.parts)){const leg=name.startsWith('legs');out.push(capsule(l.root.p,l.joint.p,leg?.105:.082,s,[l.root,l.joint]));out.push(capsule(l.joint.p,leg?l.end.p:mix(l.joint.p,l.end.p,.76),leg?.084:.064,s,[l.joint,l.end]));if(!leg)out.push(capsule(mix(l.joint.p,l.end.p,.82),l.end.p,.045,s,[l.joint,l.end]));if(leg)out.push(capsule(add(l.end.p,[0,-.027,0]),add(l.end.p,mul([Math.sin(s.r.yaw),0,Math.cos(s.r.yaw)],.13)),.055,s,[l.end,l.end]));}
 return out;
}
function distribute(c,t,n,amount){const weights=[1-t,t];for(let i=0;i<2;i++){let p=c.ends[i];if(p.w===0&&p!==c.owner.root&&p===c.ends[0]&&p!==c.ends[1])p=c.owner.root;p.p=add(p.p,mul(n,amount*weights[i]*p.w));}}
function weight(c,t){return (c.ends[0].w||c.owner.root.w)*(1-t)**2+(c.ends[1].w||c.owner.root.w)*t*t;}
function collisions(a,b){let worst=0;for(const x of caps(a))for(const y of caps(b)){
 const q=closest(x.a,x.b,y.a,y.b),delta=sub(q.a,q.b),d=len(delta),over=x.r+y.r+.003-d;if(over<=0)continue;worst=Math.max(worst,over);const n=d>1e-8?mul(delta,1/d):[1,0,0],w=weight(x,q.s)+weight(y,q.t);if(!w)continue;const push=Math.min(.04,over)*.75/w;distribute(x,q.s,n,push);distribute(y,q.t,n,-push);
 }return worst;}
function grip(a,b,pose,amount=1){
 // A retained sleeve grip lies outside the sleeve, never on the elbow axis.
 const hand=a.parts['arms.left'].end,arm=b.parts['arms.right'],c=mix(arm.joint.p,arm.end.p,.35),axis=unit(sub(arm.end.p,arm.joint.p));
 let n=sub(hand.p,c);n=sub(n,mul(axis,dot(n,axis)));n=unit(n);const target=add(c,mul(n,.112)),err=sub(target,hand.p);
 hand.p=add(hand.p,mul(err,.5*amount));arm.joint.p=sub(arm.joint.p,mul(err,.325*amount));arm.end.p=sub(arm.end.p,mul(err,.175*amount));
 const upper=unit(sub(arm.joint.p,arm.root.p)),site=add(arm.root.p,mul(upper,.24)),toward=mul(b.r.up,-1),normal=unit(sub(toward,mul(upper,dot(toward,upper)))),under=add(site,mul(normal,.125));
 const rightTarget=releaseRightGrip({at:a.at,right:a.r.right},mix(b.at(-.1,.40,.20),under,pose.turn),pose.fall,pose.id==='ippon-seoi-nage');
 a.parts['arms.right'].end.p=mix(a.parts['arms.right'].end.p,rightTarget,.45);
 const receiverTarget=mix(a.at(-.1,.42,.21),add(arm.end.goal,sub(b.root.p,b.root.goal)),Math.max(pose.turn,pose.fall));
 arm.end.p=mix(arm.end.p,receiverTarget,.20);
}
function rig(s){anchors(s);const p={p:s.root.p,yaw:s.r.yaw,lean:s.r.lean,l:s.parts['legs.left'].end.p,r:s.parts['legs.right'].end.p},r=body(p);
 for(const kind of ['arms','legs'])for(const side of ['left','right']){const l=s.parts[kind+'.'+side],root=kind==='arms'?r.shoulders[side]:r.legs[side].root;r[kind][side]=limb(root,l.end.p,kind==='arms'?.33:.46,kind==='arms'?.31:.45,sub(l.joint.p,root));}
 return r;
}
export function solve(p,previous=null,iterations=800){
 const a=make(p.tori,'tori',p.time),b=make(p.uke,'uke',p.time);
 // Starting outside the garment avoids the embedded-hand local minimum.
 for(const s of [a,b])for(const [name,l] of Object.entries(s.parts))if(name.startsWith('arms')){l.end.p=add(l.end.p,mul(s.r.right,name.endsWith('left')?-.07:.07));}
 if(previous)for(const [s,who] of [[a,'tori'],[b,'uke']]){s.root.p=add(s.root.p,sub(previous.solved[who].pelvis,previous.raw[who].pelvis));for(const [name,l] of Object.entries(s.parts)){const [kind,side]=name.split('.');for(const field of ['joint','end'])if(l[field].w)l[field].p=add(l[field].goal,sub(previous.solved[who][kind][side][field],previous.raw[who][kind][side][field]));}}
 for(let i=0;i<iterations;i++){
  const pull=.008;
  for(const s of [a,b]){s.root.p=mix(s.root.p,s.root.goal,pull*.2);for(const l of Object.values(s.parts)){if(l.end.w)l.end.p=mix(l.end.p,l.end.goal,pull);l.joint.p=mix(l.joint.p,l.joint.goal,pull*.25);}bones(s);}
  grip(a,b,p);collisions(a,b);bones(a);bones(b);
  for(const s of [a,b]){for(const [name,l] of Object.entries(s.parts)){l.end.p[1]=Math.max(name.startsWith('legs')?.065:.055,l.end.p[1]);l.joint.p[1]=Math.max(.11,l.joint.p[1]);}const bottom=s.at(0,.70)[1]-Math.hypot(.137*s.r.up[1],.1*s.r.forward[1]);if(bottom<.025)s.root.p[1]+=.025-bottom;}
 }
 function push(s,name,delta){const parts=name.split('.');if(parts[0]==='arm'||parts[0]==='leg'){const l=s.parts[(parts[0]==='arm'?'arms':'legs')+'.'+parts[1]];l.joint.p=add(l.joint.p,mul(delta,parts[2]==='upper'||parts[2]==='thigh'?1.6:1));if(l.end.w)l.end.p=add(l.end.p,delta);}else if(parts[0]==='hand'||parts[0]==='foot'){const l=s.parts[(parts[0]==='hand'?'arms':'legs')+'.'+parts[1]];if(l.end.w)l.end.p=add(l.end.p,delta);else s.root.p=add(s.root.p,delta);}else s.root.p=add(s.root.p,delta);}
 // Leave clearance between unrelated surfaces so interpolating the baked
 // frames cannot reintroduce a collision. Retained grasp surfaces may touch;
 // their actual penetrations are still checked, never excluded.
 const graspPair=hit=>hit.a==='hand.left'&&hit.b==='arm.right.sleeve'||hit.a==='hand.right'&&(hit.b.startsWith('torso.')||hit.b==='arm.right.upper');
 const roll=p.id==='ippon-seoi-nage';
 const clearance=hit=>roll&&(hit.a.startsWith('head')||hit.b.startsWith('head'))?.012:.004;
 let result;for(let i=0;i<80;i++){result=closeThrowGrasps({...p,tori:rig(a),uke:rig(b)});const hits=bodyIntersections(result,roll?-.012:-.004).filter(hit=>hit.depth>.0001||!graspPair(hit)&&hit.depth>-clearance(hit));if(!hits.length)break;const hit=hits[0],aLimb=/^(arm|hand|leg|foot)/.test(hit.a),bLimb=/^(arm|hand|leg|foot)/.test(hit.b),fraction=aLimb===bLimb?.5:aLimb?1:0,delta=mul(hit.direction,hit.depth+clearance(hit)+.003);if(fraction)push(a,hit.a,mul(delta,fraction));if(fraction<1)push(b,hit.b,mul(delta,fraction-1));bones(a);bones(b);}
 return closeThrowGrasps({...p,tori:rig(a),uke:rig(b)});
}
