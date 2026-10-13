// Hand identity is assigned before filtering; detector array order can change at a crossing.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function assignHands(hands,points,previous=[null,null]){
  const valid=hands.filter(h=>h?.length===21&&h.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  const cost=(h,side)=>{
    const wrist=points?.[15+side],old=previous[side]?.[0];
    if(wrist&&(wrist.visibility??1)>=.65)return distance(h[0],wrist)+(old?.x!==undefined?distance(h[0],old)*.08:0);
    return old?distance(h[0],old):1;
  };
  if(!valid.length)return [null,null];
  if(valid.length===1){const side=cost(valid[0],0)<=cost(valid[0],1)?0:1;return side?[null,valid[0]]:[valid[0],null]}
  return cost(valid[0],0)+cost(valid[1],1)<=cost(valid[1],0)+cost(valid[0],1)?valid.slice(0,2):[valid[1],valid[0]];
}
const alpha=(cutoff,dt)=>1/(1+1/(2*Math.PI*cutoff*dt));
// Adaptive low-pass in normalized camera coordinates: quiet hands are stabilized,
// deliberate motion raises the cutoff. Confidence and tracking loss are never held over.
export class LandmarkStream{
  constructor(){this.reset()}
  reset(){this.previous=null;this.filtered=null;this.velocity=[];this.from=null;this.time=null;this.period=0}
  update(points,time){
    if(!points){this.reset();return null}
    if(this.time===null||time-this.time>250||time<=this.time){
      this.previous=points.map(p=>p?{...p}:null);this.filtered=this.previous;this.from=this.filtered;
      this.velocity=points.map(()=>0);this.time=time;this.period=0;return this.filtered;
    }
    const dt=Math.max(.001,(time-this.time)/1000),from=this.at(time);
    this.filtered=points.map((p,i)=>{
      if(!p||(p.visibility??1)<.65){this.velocity[i]=0;return p?{...p}:null}
      const old=this.previous[i],f=this.filtered[i];
      if(!old||!f||(old.visibility??1)<.65){this.velocity[i]=0;return {...p}}
      const speed=distance(p,old)/dt;
      this.velocity[i]=(this.velocity[i]||0)+alpha(1,dt)*(speed-(this.velocity[i]||0));
      const a=alpha(1.8+12*this.velocity[i],dt),out={...p};
      for(const key of ['x','y','z'])if(Number.isFinite(p[key])&&Number.isFinite(f[key]))out[key]=f[key]+a*(p[key]-f[key]);
      return out;
    });
    this.from=from;this.previous=points.map(p=>p?{...p}:null);this.period=Math.min(65,time-this.time);this.time=time;
    return this.filtered;
  }
  at(time){
    if(!this.filtered||time-this.time>250)return null;
    const t=this.period?Math.max(0,Math.min(1,(time-this.time)/this.period)):1;
    return this.filtered.map((p,i)=>{
      const a=this.from?.[i];if(!p||!a||(p.visibility??1)<.65||(a.visibility??1)<.65)return p;
      return {...p,x:a.x+(p.x-a.x)*t,y:a.y+(p.y-a.y)*t,z:(a.z??0)+((p.z??0)-(a.z??0))*t};
    });
  }
}
export function projectHand(hand,body,scene,mirrored=true){
  const sign=mirrored?-1:1;
  return hand.map(p=>{
    const dx=p.x-body.origin.x,dy=p.y-body.origin.y;
    return {x:scene.origin.x+sign*(dx*body.x.x+dy*body.x.y)/body.scale*scene.scale,
      y:scene.origin.y+(dx*body.y.x+dy*body.y.y)/body.scale*scene.scale,z:(p.z??0)/body.scale*scene.scale};
  });
}
// Signed palm normal in image space. Mirroring changes the projection, not identity.
export function palmFacing(hand,left,mirrored=true){
  const a=hand[5],b=hand[17],w=hand[0];
  const cross=(a.x-w.x)*(b.y-w.y)-(a.y-w.y)*(b.x-w.x);
  return cross*(left?1:-1)*(mirrored?-1:1)>0;
}

// Calibrate scale and axes before grasping, then keep that ruler while pulling.
// Re-estimating shoulder width every frame can divide away the hand movement.
export class GripProjection{
 constructor(){this.reset()}
 reset(){this.anchor=null;this.origin=null}
 resolve(body,gripped){
  if(!gripped){this.anchor=body?{...body,origin:{...body.origin},x:{...body.x},y:{...body.y}}:null;this.origin=body?.origin??null;return body}
  if(!this.anchor&&body)this.anchor={...body,origin:{...body.origin},x:{...body.x},y:{...body.y}};
  if(!this.anchor)return null;
  if(body)this.origin={...body.origin};
  return {...this.anchor,origin:this.origin};
 }
}

const palmSize=h=>Math.max(distance(h[0],h[9]),distance(h[5],h[17]),.015);
const handCenter=h=>[0,5,9,13,17].reduce((a,i)=>({x:a.x+h[i].x/5,y:a.y+h[i].y/5}),{x:0,y:0});
const copyHand=h=>h.map(p=>({...p}));
// Pose wrists may swap at a crossing. Keep short-lived anatomical tracks and
// preserve held tracks through long occlusion and prefer their predicted motion; uncertain matches
// are missing observations, never a fabricated second hand.
// Recovery needs independent, unambiguous pose wrists. Screen-side alone is not identity.
export function poseConfirmsHand(hand,points,index){
 if(!hand)return false;
 const own=points?.[15+index],other=points?.[16-index];
 if(!own||!other||(own.visibility??1)<.75||(other.visibility??1)<.75)return false;
 const a=distance(hand[0],own),b=distance(hand[0],other);
 const separation=distance(own,other);
 return separation>.015&&a<.075&&b-a>Math.max(.008,Math.min(.025,separation*.3));
}
export class HandIdentityTracker{
 constructor(){this.reset()}
 reset(){this.tracks=[null,null];this.recovery=[null,null]}
 update(hands,points,time,{held=[false,false],stalled=[false,false]}={}){
  this.tracks=this.tracks.map((t,i)=>t&&(held[i]||time-t.time<=500)?t:null);
  const valid=(hands??[]).filter(h=>h?.length===21&&h.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).slice(0,2);
  if(!valid.length){this.recovery=[null,null];return [null,null]}
  const recovered=[0,1].map(i=>{
   const candidates=valid.filter(h=>poseConfirmsHand(h,points,i));
   if(!held[i]||!stalled[i]||candidates.length!==1){this.recovery[i]=null;return null}
   const h=candidates[0],old=this.recovery[i];
   if(!old||distance(h[0],old.hand[0])>.025||distance(handCenter(h),handCenter(old.hand))>.03)this.recovery[i]={hand:copyHand(h),since:time};
   return time-this.recovery[i].since>=300?h:null;
  });
  const predictions=this.tracks.map(t=>t?{x:t.hand[0].x+t.vx*(time-t.time>500?0:Math.min(100,time-t.time)),y:t.hand[0].y+t.vy*(time-t.time>500?0:Math.min(100,time-t.time))}:null);
  // Crossed wrists alone are not occlusion: compare palm centers and widths.
  const near=(a,b)=>a&&b&&distance(handCenter(a),handCenter(b))<Math.max(distance(a[5],a[17]),distance(b[5],b[17]),.015)*1.8;
  const overlap=near(valid[0],valid[1])||near(this.tracks[0]?.hand,this.tracks[1]?.hand);
  const continuous=valid.length===2&&predictions.every(p=>p&&valid.some(h=>distance(h[0],p)<Math.min(.025,palmSize(h)*.35)));
  const trustHistory=held.some(Boolean)||overlap||continuous;
  const cost=(h,i)=>{
   const anchor=points?.[15+i],hasPose=anchor&&(anchor.visibility??1)>=.65,old=this.tracks[i];
   const temporal=predictions[i]?distance(h[0],predictions[i]):null,poseCost=hasPose?distance(h[0],anchor):null;
   let value=temporal===null?(poseCost??1):poseCost===null?temporal:temporal*(trustHistory?.92:.25)+poseCost*(trustHistory?.08:.75);
   if(old){
    // Palm topology is steadier than fingertips during opening/closing.
    const shape=[5,9,13,17].reduce((sum,k)=>sum+Math.hypot((h[k].x-h[0].x)-(old.hand[k].x-old.hand[0].x),(h[k].y-h[0].y)-(old.hand[k].y-old.hand[0].y)),0)/4;
    value+=shape*.25;
   }
   return value;
  };
  let chosen;
  if(recovered.some(Boolean)){
   chosen=assignHands(valid,points,this.tracks.map(t=>t?.hand??null));
   recovered.forEach((h,i)=>{if(h)chosen[i]=h});
   if(chosen[0]&&chosen[0]===chosen[1])chosen[recovered[0]?1:0]=null;
  }else if(valid.length===1){
   const costs=[cost(valid[0],0),cost(valid[0],1)];
   if(this.tracks.every(Boolean)&&Math.abs(costs[0]-costs[1])<.008)return [null,null];
   chosen=costs[0]<=costs[1]?[valid[0],null]:[null,valid[0]];
  }else{
   const a=cost(valid[0],0)+cost(valid[1],1),b=cost(valid[1],0)+cost(valid[0],1);
   if(this.tracks.every(Boolean)&&Math.abs(a-b)<.008)return [null,null];
   if(distance(handCenter(valid[0]),handCenter(valid[1]))<Math.max(.012,Math.min(...valid.map(h=>distance(h[5],h[17])))*.55))return [null,null];
   chosen=a<=b?valid:[valid[1],valid[0]];
  }
  chosen.forEach((h,i)=>{
   if(!h)return;const old=recovered[i]?null:this.tracks[i],dt=old?Math.max(1,time-old.time):1;
   // Do not let a single distant detection poison the identity prediction.
   if(old&&distance(h[0],old.hand[0])>Math.max(.10,palmSize(old.hand)*2.5))return;
   const sampleVx=old?(h[0].x-old.hand[0].x)/dt:0,sampleVy=old?(h[0].y-old.hand[0].y)/dt:0;
   // Extrapolate only consistent motion. A single approach jump followed by a
   // stop must not predict through the other hand and swap their identities.
   const steady=old&&Math.hypot(sampleVx-(old.sampleVx??0),sampleVy-(old.sampleVy??0))<.00045;
   this.tracks[i]={hand:copyHand(h),time,sampleVx,sampleVy,vx:steady?Math.max(-.001,Math.min(.001,sampleVx)):0,vy:steady?Math.max(-.001,Math.min(.001,sampleVy)):0};
  });
  return chosen;
 }
}
// Display retention is separate from scoring validity. A short occlusion holds
// the last glove, but trackedAt returns null until observations are trusted.
export class HandStream{
 constructor(){this.filter=new LandmarkStream();this.reset()}
 reset(){this.filter.reset();this.accepted=null;this.lastSeen=null;this.observed=false;this.missingSince=null;this.bridge=null;this.recovery=null;this.fadeStarted=null;this.recoveryRevision=0}
 update(hand,time,{reacquire=false,held=false,poseConfirmed=false}={}){
  if(!hand){this.observed=false;this.recovery=null;this.missingSince??=time;return}
  // Free hands may reacquire after absence. A held hand retains its last trusted
  // location so a returned outlier cannot teleport the glove or cloth.
  if(!held&&this.missingSince!==null&&time-this.missingSince>600)this.reset();
  this.missingSince=null;
  const old=this.accepted,visible=this.at(time),size=old?palmSize(old):0;
  const step=Math.max(.035,Math.min(.05,size))*Math.min(1,Math.max(.5,(time-(this.lastSeen??time))/65));
  const jump=old&&(distance(hand[0],old[0])>step||distance(handCenter(hand),handCenter(old))>step*1.2);
  const oldRadius=old?Math.max(...old.map(p=>distance(p,old[0]))):0;
  const distorted=old&&hand.some(p=>distance(p,hand[0])>Math.max(.12,oldRadius*2.5));
  // Do not promote a repeated outlier to a valid fast movement.
  if(jump||distorted){
   this.observed=false;
   // Restore a held hand only after steady, independently matched pose input.
   // The revision tells the collar to rebase input without moving its cloth pin.
   const heldRecovery=held&&poseConfirmed;
   if((!reacquire&&!heldRecovery)||distorted){this.recovery=null;return}
   if(!this.recovery||distance(hand[0],this.recovery.hand[0])>.025||distance(handCenter(hand),handCenter(this.recovery.hand))>.03)this.recovery={hand:copyHand(hand),since:time};
   if(time-this.lastSeen<=(heldRecovery?450:900)||time-this.recovery.since<(heldRecovery?300:200))return;
   const revision=this.recoveryRevision+1;
   this.reset();this.recoveryRevision=revision;this.filter.update(hand,time);this.accepted=copyHand(hand);
   this.lastSeen=time;this.observed=true;this.fadeStarted=time;return;
  }
  this.recovery=null;
  const resume=old&&(!this.observed||this.lastSeen===null||time-this.lastSeen>150);
  if(resume){this.filter.reset();this.bridge=visible?{from:visible,time,duration:150}:null}
  this.filter.update(hand,time);this.accepted=copyHand(hand);this.lastSeen=time;this.observed=true;
 }
 at(time){
  if(this.lastSeen===null||time-this.lastSeen>350)return null;
  // Clamp only the display readback, never the observation timestamp.
  const target=this.filter.at(Math.min(time,this.filter.time+65));if(!target)return null;
  if(this.bridge){
   const t=Math.max(0,Math.min(1,(time-this.bridge.time)/this.bridge.duration)),u=t*t*(3-2*t);
   return target.map((p,i)=>{const a=this.bridge.from[i];return {...p,x:a.x+(p.x-a.x)*u,y:a.y+(p.y-a.y)*u,z:(a.z??0)+((p.z??0)-(a.z??0))*u}});
  }
  return target;
 }
 trackedAt(time){return (this.fadeStarted===null||time-this.fadeStarted>=200)&&this.observed&&time-this.lastSeen<=250&&(!this.bridge||time-this.bridge.time>=this.bridge.duration)?this.at(time):null}
 opacityAt(time){return this.observed?(this.fadeStarted===null?1:Math.min(1,Math.max(0,(time-this.fadeStarted)/200))):Math.max(.25,1-Math.max(0,time-this.lastSeen-100)/350)}
}
