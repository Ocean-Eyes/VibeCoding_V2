import {HeldWrist,wristTurn,gloveAtWrist} from './held-wrist.js';
import {ClothMotion} from './cloth-motion.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
export const GRIP_PASS_SCORE=85;
export const GRIP_HOLD_SECONDS=1.2;
export const GRIP_OCCLUSION_MS=800;
export const GRIP_RELEASE_MS=200;
export function lapelRest(side,t){
 const points=side>0?[[.215,.065],[.34,.20],[-.10,.69],[-.285,1.14]]:[[-.215,.065],[-.34,.20],[-.13,.44],[.01,.52]];
 const u=1-t,w=[u*u*u,3*u*u*t,3*u*t*t,t*t*t];
 return {x:points.reduce((a,p,i)=>a+p[0]*w[i],0),y:points.reduce((a,p,i)=>a+p[1]*w[i],0)};
}
// Continuous sewn-edge coordinates shared by collision and illustrated fronts.
// The coat itself uses authored drawings, not an image warped by this field.
export function clothPoint(point,deformation=[]){
 const envelope=y=>ease((y-.065)/.11)*ease((1.10-y)/.30);
 const kernel=(p,g)=>{
  const pin=lapelRest(g.side,g.t),r=Math.hypot(p.x-pin.x,p.y-pin.y)/.58;
  return r>=1?0:(1-r)**4*(1+4*r)*Math.min(1,envelope(p.y)/Math.max(.001,envelope(pin.y)));
 };
 const grips=deformation.slice(0,2);
 if(!grips.length)return {...point};
 let coefficients=grips.map(g=>({x:g.dx,y:g.dy}));
 if(grips.length===2){
  const a=kernel(lapelRest(grips[0].side,grips[0].t),grips[1]),b=kernel(lapelRest(grips[1].side,grips[1].t),grips[0]),det=Math.max(.001,1-a*b);
  coefficients=coefficients.map((v,i)=>({x:(v.x-(i?b:a)*grips[1-i].dx)/det,y:(v.y-(i?b:a)*grips[1-i].dy)/det}));
 }
 const delta=grips.reduce((p,g,i)=>{const w=kernel(point,g);return {x:p.x+w*coefficients[i].x,y:p.y+w*coefficients[i].y}}, {x:0,y:0});
 // A fixed neck anchor must attenuate motion, never amplify it. Also bound
 // the combined field where the two sewn-edge influences overlap.
 const limit=Math.max(...grips.map(g=>Math.hypot(g.dx,g.dy))),length=Math.hypot(delta.x,delta.y),scale=length>limit?limit/length:1;
 return {x:point.x+delta.x*scale,y:point.y+delta.y*scale};
}
export function lapelPoint(side,t,deformation=[]){return clothPoint(lapelRest(side,t),deformation)}
export function lapelRibbon(side,deformation=[]){
 return Array.from({length:49},(_,i)=>{
  const t=i/48,p=lapelPoint(side,t,deformation),a=lapelPoint(side,Math.max(0,t-.002),deformation),b=lapelPoint(side,Math.min(1,t+.002),deformation),d=Math.max(.001,Math.hypot(b.x-a.x,b.y-a.y));
  return {...p,t,nx:-(b.y-a.y)/d,ny:(b.x-a.x)/d,width:.046};
 });
}
export function collarHit(point,deformation=[],excluded=[]){
 let best=null;
 for(const side of [-1,1]){
  if(excluded.includes(side))continue;
  for(let k=0;k<=120;k++){
   const t=k/120,rest=lapelRest(side,t);if(rest.y<.065||rest.y>.46)continue;
   const p=lapelPoint(side,t,deformation),d=Math.hypot(point.x-p.x,point.y-p.y);
   if(d<.13&&(!best||d<best.distance))best={side,t,point:p,distance:d};
  }
 }
 return best;
}
// MCP positions remain stable as the fingers close, unlike the moving fingertips.
export function graspCenter(hand){return [5,9,13,17].reduce((p,i)=>({x:p.x+hand[i].x/4,y:p.y+hand[i].y/4}),{x:0,y:0})}
function fingerExtensions(hand){
 if(!hand||hand.length!==21)return null;
 const ratios=[5,9,13,17].map(i=>{
  const length=distance(hand[0],hand[i])+distance(hand[i],hand[i+1])+distance(hand[i+1],hand[i+2])+distance(hand[i+2],hand[i+3]);
  return length>.00001?distance(hand[0],hand[i+3])/length:1;
 });
 return ratios;
}
export function fingerExtension(hand){const ratios=fingerExtensions(hand);return ratios?ratios.reduce((a,b)=>a+b,0)/4:null}
// Measure fingers from their own knuckles, so a spread hand does not have to
// form four ruler-straight lines from the wrist. The thumb is irrelevant to release.
export function openFingers(hand){
 if(!hand||hand.length!==21)return [];
 return [5,9,13,17].filter(i=>{
  const a=hand[i],b=hand[i+3],w=hand[0],length=distance(a,hand[i+1])+distance(hand[i+1],hand[i+2])+distance(hand[i+2],b);
  const reach=distance(a,b),palm=distance(w,a);
  const forward=((b.x-a.x)*(a.x-w.x)+(b.y-a.y)*(a.y-w.y)+((b.z??0)-(a.z??0))*((a.z??0)-(w.z??0)))/Math.max(.00001,reach*palm);
  return length>.00001&&reach/length>.97&&forward>.70;
 });
}
// Camera-facing normal only: gravity/vertical tilt must not swap palm and back.
// In projected mirrored coordinates a positive value means palm toward camera.
export function cameraPalmNormal(hand,index,mirrored=true){
 const w=hand[0],a=hand[5],b=hand[17];
 const u={x:a.x-w.x,y:a.y-w.y,z:(a.z??0)-(w.z??0)},v={x:b.x-w.x,y:b.y-w.y,z:(b.z??0)-(w.z??0)};
 const nx=u.y*v.z-u.z*v.y,ny=u.z*v.x-u.x*v.z,nz=u.x*v.y-u.y*v.x,length=Math.hypot(nx,ny,nz);
 return length<.00001?0:nz*(index?-1:1)*(mirrored?-1:1)/length;
}
export function gripPosture(hand,index,side,mirrored,direction){
 if(side!==(index?-1:1)*(mirrored?1:-1))return 'opposite';
 const normal=cameraPalmNormal(hand,index,mirrored);
 // Allow broad tilt, but an edge-on hand supplies no reliable front/back signal.
 if(Math.abs(normal)<.20)return 'turn';
 if((normal>0)!==(direction==='↓'))return 'palm';
 return null;
}
// A wrist/forearm covering the palm makes finger extension unreliable.
function pointCovered(p,hand,other,arm){
 if(!hand||!other)return false;
 const w=other[0],radius=Math.min(.11,Math.max(.035,Math.hypot(hand[5].x-hand[17].x,hand[5].y-hand[17].y)*.55));
 const near=q=>Math.hypot(p.x-q.x,p.y-q.y)<radius+.035;
 if(near(w)||near(graspCenter(other)))return true;
 const e=arm?.elbow;if(!e||(e.visibility??1)<.65)return false;
 const dx=e.x-w.x,dy=e.y-w.y,l=dx*dx+dy*dy,t=l?clamp(((p.x-w.x)*dx+(p.y-w.y)*dy)/l):0;
 return near({x:w.x+t*dx,y:w.y+t*dy});
}
function palmCovered(hand,other,arm){return pointCovered(graspCenter(hand),hand,other,arm)}
function fingersVisible(hand,indices,other,arm){
 return indices.filter(i=>!pointCovered(hand[i+2],hand,other,arm)&&!pointCovered(hand[i+3],hand,other,arm)).length>=3;
}
const emptyHand=()=>({armed:false,closed:false,pending:null,grip:null,releaseSince:null,hover:null,posture:null,missingSince:null,tracked:false,wasOccluded:false,resumeSince:null,openObserved:false});
// Camera posture exercise only: neither collar depth behind the neck nor pressure is observable.
export class CollarInteraction{
 constructor(){this.reset()}
 reset(){this.clothMotion=new ClothMotion();this.hands=[emptyHand(),emptyHand()];this.released=[];this.lastTime=null;this.hold=0;this.tapped=false;this.lastMirror=null;this.elbowBaseline=null;this.armMissingSince=null}
 release(i,now){
  const h=this.hands[i];if(h.grip)this.released.push({...h.grip,releasedAt:now});
  this.hands[i]=emptyHand();this.hold=0;this.tapped=false;
 }
 deformation(now){
  this.released=this.released.filter(g=>now-g.releasedAt<700);
  const live=this.hands.map(h=>h.grip).filter(Boolean);
  const targets=[...live,...this.released.filter(g=>!live.some(l=>l.side===g.side)).map(g=>({...g,dx:g.dx*Math.exp(-(now-g.releasedAt)/110),dy:g.dy*Math.exp(-(now-g.releasedAt)/110),engagement:(g.engagement??0)*Math.exp(-(now-g.releasedAt)/110)}))];
  return this.clothMotion.update(targets,now);
 }
 update(observations,now,{active=false,mirrored=true,directions=['↓','↓'],arms=[null,null],bodyVisible=null,continuousHands=[false,false],recoveredHands=[false,false]}={}){
  if(this.lastMirror!==null&&this.lastMirror!==mirrored)this.reset();
  const dt=this.lastTime===null?0:Math.min(.1,Math.max(0,(now-this.lastTime)/1000));
  if(this.lastTime!==null&&now-this.lastTime>GRIP_OCCLUSION_MS)this.reset();
  this.lastMirror=mirrored;this.lastTime=now;
  const visibleBody=bodyVisible??arms.some(a=>a?.shoulder&&(a.shoulder.visibility??1)>=.65);
  const preserveGrip=visibleBody&&this.hands.every(h=>h.grip);
  const suspend=i=>{
   const h=this.hands[i];h.releaseSince=null;h.resumeSince=null;h.wasOccluded=true;
   if(preserveGrip||(h.grip&&arms[i]?.wrist&&(arms[i].wrist.visibility??1)>=.65)){h.missingSince=null;return}
   h.missingSince??=now;if(now-h.missingSince>=GRIP_OCCLUSION_MS)this.release(i,now);
  };
  for(let i=0;i<2;i++){
   const hand=observations[i],h=this.hands[i],extension=fingerExtension(hand);
   h.tracked=false;h.openObserved=false;
   if(extension===null){
    h.releaseSince=null;h.pending=null;
    if(h.grip)suspend(i)
    else this.hands[i]=emptyHand();
    continue;
   }
   const center=graspCenter(hand);
   const extended=openFingers(hand),open=extended.length>=3;
   if(open)h.closed=false;else if(extension<.92)h.closed=true;
   if(h.grip){
    if(recoveredHands[i]&&!open){
     // Reacquisition changes the input origin, never the already attached cloth.
     const g=h.grip,previousWrist=g.wrist;
     g.start={...center};g.center={...center};g.offset={x:g.dx,y:g.dy};g.travelX=0;g.wrist={...hand[0]};h.wristTrack=new HeldWrist(hand[0]);h.wristStart={...hand[0]};
     const pin=lapelPoint(g.side,g.t,this.deformation(now));g.contactOffset={x:pin.x-center.x,y:pin.y-center.y};
     if(this.elbowBaseline&&previousWrist)this.elbowBaseline[i].gap+=previousWrist.y-hand[0].y;
    }
    // Unfiltered teleports cannot release a grip. A continuously tracked open
    // hand CAN release after leaving the frozen cloth pin during occlusion;
    // opening never drags that pin to its new position.
    if(Math.hypot(center.x-h.grip.center.x,center.y-h.grip.center.y)>.12&&!(open&&continuousHands[i])){suspend(i);continue}
    const covered=palmCovered(hand,observations[1-i],arms[1-i]);
    // Crossed palms can obscure one another while extended fingers remain visible.
    // Clear finger extension wins over palm overlap; actual hidden fingers stay held.
    h.openObserved=open&&(!covered||fingersVisible(hand,extended,observations[1-i],arms[1-i]));
    if(covered&&!h.openObserved){suspend(i);continue}
    // A returned hand must be continuously visible before an open estimate
    // can release an existing grip. A closed hand can resume immediately.
    if(open&&h.wasOccluded){
     h.resumeSince??=now;
     if(now-h.resumeSince<300){h.releaseSince=null;continue}
    }
    if(open){
     h.releaseSince??=now;if(now-h.releaseSince>=GRIP_RELEASE_MS)this.release(i,now);
     continue;
    }else{h.releaseSince=null;h.closed=true;h.wasOccluded=false;h.resumeSince=null}
    const dx=center.x-h.grip.start.x,dy=center.y-h.grip.start.y;
    h.missingSince=null;h.tracked=h.releaseSince===null;
    h.grip.dx=h.grip.offset.x+dx;h.grip.dy=h.grip.offset.y+dy;h.grip.travelX=dx;h.grip.center=center;h.grip.wrist={...hand[0]};h.shape=hand.map(p=>({...p}));h.wristTrack=new HeldWrist(hand[0]);continue;
   }
   h.missingSince=null;h.tracked=true;
   h.hover=collarHit(center,this.deformation(now),this.hands.map(s=>s.grip?.side).filter(Boolean));
   h.posture=h.hover?gripPosture(hand,i,h.hover.side,mirrored,directions[i]):null;
   h.armed=!!h.hover&&!h.posture;
   // Bent fingers may enter already prepared: no fully-open gesture is required.
   // Stable contact + correct opposite lapel and camera-facing palm orientation
   // prevent an arbitrary fist or a flat open hand from attaching to the coat.
   if(!h.closed||!h.armed){h.pending=null;continue}
   if(!h.pending||h.pending.side!==h.hover.side)h.pending={...h.hover,since:now};
   if(now-h.pending.since>=100){
    // Keep the fabric where contact occurred; acquisition tolerance is not a pull.
    const hit=h.hover,rest=lapelRest(hit.side,hit.t),offset={x:hit.point.x-rest.x,y:hit.point.y-rest.y},contactOffset={x:hit.point.x-center.x,y:hit.point.y-center.y};
    h.grip={side:hit.side,t:hit.t,start:center,center,wrist:{...hand[0]},offset,contactOffset,dx:offset.x,dy:offset.y,travelX:0};h.pending=null;h.shape=hand.map(p=>({...p}));h.wristTrack=new HeldWrist(hand[0]);h.wristStart={...hand[0]};
   }
  }
  const grips=this.hands.map(h=>h.grip),count=grips.filter(Boolean).length;
  const crossed=count===2&&grips.every((g,i)=>g.side===(i?-1:1)*(mirrored?1:-1));
  const armVisible=a=>a&&[a.elbow,a.shoulder].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>=.65);
  const armsTracked=arms.length===2&&arms.every(armVisible);
  // Finger occlusion does not hide the whole limb. Accept a continuous pose
  // wrist independently of elbow visibility, keeping finger evidence separate.
  const scoringWrists=this.hands.map((h,i)=>{
   if(!h.grip||h.openObserved||h.releaseSince!==null)return null;
   const pose=arms[i]?.wrist;
   if(h.tracked){
    const wrist=observations[i]?.[0];
    // Hand and body detectors place the wrist joint slightly differently.
    // Calibrate while both are visible, so switching sources is not an action.
    if(wrist&&pose&&(pose.visibility??1)>=.65&&Math.hypot(wrist.x-pose.x,wrist.y-pose.y)<.12)h.poseOffset={x:wrist.x-pose.x,y:wrist.y-pose.y};
    return wrist??null;
   }
   const wrist=pose?{...pose,x:pose.x+(h.poseOffset?.x??0),y:pose.y+(h.poseOffset?.y??0)}:null;
   return h.wristTrack?.update(wrist,now)??null;
  });
  const wristTurns=this.hands.map((h,i)=>h.grip?wristTurn(h.wristStart,scoringWrists[i],h.grip.center,h.grip.start):null);
  // Opposing turns around the held grips approximate the crossed-forearm action
  // in 2D. Lateral pulling, translation and one moving wrist cannot complete it.
  const wristTravel=this.hands.map((h,i)=>scoringWrists[i]&&h.wristStart?scoringWrists[i].x-h.grip.center.x-(h.wristStart.x-h.grip.start.x):0);
  const wristRise=this.hands.map((h,i)=>scoringWrists[i]&&h.wristStart?scoringWrists[i].y-h.grip.center.y-(h.wristStart.y-h.grip.start.y):0);
  const wristCompletion=wristRise.every(v=>Math.abs(v)>.015)&&wristTravel[0]*wristTravel[1]<0&&wristTravel.every(v=>Math.abs(v)>.015)&&wristTurns.every(v=>v!==null)&&wristTurns[0]*wristTurns[1]<0?clamp(Math.min(...wristTurns.map(Math.abs))/.40):0;
  const trackingPaused=count>0&&(this.hands.some((h,i)=>h.grip&&!scoringWrists[i])||(count===2&&!armsTracked&&wristCompletion===0));
  const wristHands=this.hands.map((h,i)=>!h.tracked&&h.grip?gloveAtWrist(h.shape,scoringWrists[i]):null);
  const measures=count===2&&scoringWrists.every(Boolean)&&armsTracked?arms.map((a,i)=>({height:a.elbow.y-a.shoulder.y,gap:a.elbow.y-scoringWrists[i].y})):null;
  if(count!==2){this.elbowBaseline=null;this.armMissingSince=null}
  if(count===2&&measures&&!this.elbowBaseline)this.elbowBaseline=measures;
  const elbowLift=measures&&this.elbowBaseline?measures.map((m,i)=>Math.max(0,Math.min(this.elbowBaseline[i].height-m.height,this.elbowBaseline[i].gap-m.gap))):[null,null];
  const elbowLevels=elbowLift.map(v=>v===null?null:clamp(v/.15));
  // An upper-collar location is a visible proxy, NOT a claim to see a grip
  // behind the neck. Lateral separation is never a positive scoring signal.
  const upper=count===2&&grips.every(g=>g.center.y>=-.025&&g.center.y<=.255&&Math.abs(g.center.x)>=.10&&Math.abs(g.center.x)<=.36);
  const stable=count===2&&grips.every(g=>Math.hypot(g.center.x-g.start.x,g.center.y-g.start.y)<=.16);
  // Palm orientation is checked at acquisition. Rotating a held grip is the
  // intended finish and must not require showing the same face to the camera.
  const aligned=crossed&&upper&&stable;
  const completion=aligned&&!trackingPaused?Math.max(wristCompletion,Math.min(...elbowLevels.map(v=>v??0))):0;
  const issue=trackingPaused?'tracking':!stable?'spread':!upper?'height':completion<.7?'lift':'hold';
  // A small illustrated gather responds to the arm action without moving the
  // collar pins away from the hands or depicting the neck as stretching.
  grips.forEach(g=>{if(g){const previous=g.engagement??0;g.engagement=previous+clamp(completion-previous,-dt*3,dt*3)}});
  if(!this.tapped){
   if(!active||!crossed)this.hold=0;
   else if(trackingPaused){this.armMissingSince??=now;if(now-this.armMissingSince>=GRIP_OCCLUSION_MS)this.hold=0}
   else if(completion>=.7)this.hold=Math.min(GRIP_HOLD_SECONDS,this.hold+dt);
   else this.hold=0;
  }
  if(!trackingPaused)this.armMissingSince=null;
  if(this.hold>=GRIP_HOLD_SECONDS)this.tapped=true;
  const score=Math.round(count*25+50*completion);
  return {grips,trackingPaused,scoringWrists,wristHands,wristCompletion,issue,elbowLift,elbowLevels,completion,aligned,deformation:this.deformation(now),count,crossed,score,hold:this.hold,tapped:this.tapped,visible:observations.filter(Boolean).length,
   posture:this.hands.map(h=>h.posture),hover:this.hands.map(h=>h.hover),armed:this.hands.map(h=>h.armed),closed:this.hands.map(h=>h.closed)};
 }
}
