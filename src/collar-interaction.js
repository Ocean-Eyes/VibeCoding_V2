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
function deliberatelyOpen(hand){return fingerExtensions(hand)?.every(r=>r>.94)??false}
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
function palmCovered(hand,other,arm){
 if(!hand||!other)return false;
 const p=graspCenter(hand),w=other[0],radius=Math.min(.11,Math.max(.035,Math.hypot(hand[5].x-hand[17].x,hand[5].y-hand[17].y)*.55));
 const near=q=>Math.hypot(p.x-q.x,p.y-q.y)<radius+.035;
 if(near(w)||near(graspCenter(other)))return true;
 const e=arm?.elbow;if(!e||(e.visibility??1)<.65)return false;
 const dx=e.x-w.x,dy=e.y-w.y,l=dx*dx+dy*dy,t=l?clamp(((p.x-w.x)*dx+(p.y-w.y)*dy)/l):0;
 return near({x:w.x+t*dx,y:w.y+t*dy});
}
const emptyHand=()=>({armed:false,closed:false,pending:null,grip:null,releaseSince:null,hover:null,posture:null,missingSince:null,tracked:false,wasOccluded:false,resumeSince:null});
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
 update(observations,now,{active=false,mirrored=true,directions=['↓','↓'],arms=[null,null],bodyVisible=null}={}){
  if(this.lastMirror!==null&&this.lastMirror!==mirrored)this.reset();
  const dt=this.lastTime===null?0:Math.min(.1,Math.max(0,(now-this.lastTime)/1000));
  if(this.lastTime!==null&&now-this.lastTime>GRIP_OCCLUSION_MS)this.reset();
  this.lastMirror=mirrored;this.lastTime=now;
  const visibleBody=bodyVisible??arms.some(a=>a?.shoulder&&(a.shoulder.visibility??1)>=.65);
  const preserveGrip=visibleBody&&this.hands.every(h=>h.grip);
  const suspend=i=>{
   const h=this.hands[i];h.releaseSince=null;h.resumeSince=null;h.wasOccluded=true;
   if(preserveGrip){h.missingSince=null;return}
   h.missingSince??=now;if(now-h.missingSince>=GRIP_OCCLUSION_MS)this.release(i,now);
  };
  for(let i=0;i<2;i++){
   const hand=observations[i],h=this.hands[i],extension=fingerExtension(hand);
   h.tracked=false;
   if(extension===null){
    h.releaseSince=null;h.pending=null;
    if(h.grip)suspend(i)
    else this.hands[i]=emptyHand();
    continue;
   }
   const center=graspCenter(hand);
   if(extension>.96)h.closed=false;else if(extension<.92)h.closed=true;
   if(h.grip){
    const open=deliberatelyOpen(hand),covered=palmCovered(hand,observations[1-i],arms[1-i]);
    // A hidden/overlapped palm cannot establish a deliberate release or score.
    if(covered){suspend(i);continue}
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
    // A rejected observation never becomes an implicit release of both grips.
    if(Math.hypot(center.x-h.grip.center.x,center.y-h.grip.center.y)>.12){
     suspend(i);continue;
    }
    h.missingSince=null;h.tracked=h.releaseSince===null;
    h.grip.dx=h.grip.offset.x+dx;h.grip.dy=h.grip.offset.y+dy;h.grip.travelX=dx;h.grip.center=center;continue;
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
    h.grip={side:hit.side,t:hit.t,start:center,center,offset,contactOffset,dx:offset.x,dy:offset.y,travelX:0};h.pending=null;
   }
  }
  const grips=this.hands.map(h=>h.grip),count=grips.filter(Boolean).length;
  const crossed=count===2&&grips.every((g,i)=>g.side===(i?-1:1)*(mirrored?1:-1));
  const handsTracked=this.hands.every(h=>h.grip&&h.tracked);
  const armVisible=a=>a&&[a.elbow,a.shoulder].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>=.65);
  const armsTracked=arms.length===2&&arms.every(armVisible);
  const trackingPaused=count>0&&(this.hands.some(h=>h.grip&&!h.tracked)||(count===2&&!armsTracked));
  // Measure the elbow relative to BOTH its shoulder and its held wrist. Body
  // translation, a shrug, or lifting the whole arm together cannot earn credit.
  const measures=handsTracked&&armsTracked?arms.map((a,i)=>({height:a.elbow.y-a.shoulder.y,gap:a.elbow.y-observations[i][0].y})):null;
  if(count!==2){this.elbowBaseline=null;this.armMissingSince=null}
  if(count===2&&measures&&!this.elbowBaseline)this.elbowBaseline=measures;
  const elbowLift=measures&&this.elbowBaseline?measures.map((m,i)=>Math.max(0,Math.min(this.elbowBaseline[i].height-m.height,this.elbowBaseline[i].gap-m.gap))):[null,null];
  const elbowLevels=elbowLift.map(v=>v===null?null:clamp(v/.15));
  // An upper-collar location is a visible proxy, NOT a claim to see a grip
  // behind the neck. Lateral separation is never a positive scoring signal.
  const upper=count===2&&grips.every(g=>g.center.y>=-.025&&g.center.y<=.255&&Math.abs(g.center.x)>=.10&&Math.abs(g.center.x)<=.36);
  const stable=count===2&&grips.every(g=>Math.hypot(g.center.x-g.start.x,g.center.y-g.start.y)<=.16);
  const facing=handsTracked&&grips.every((g,i)=>!gripPosture(observations[i],i,g.side,mirrored,directions[i]));
  const aligned=crossed&&upper&&stable&&facing;
  const completion=aligned&&!trackingPaused?Math.min(...elbowLevels.map(v=>v??0)):0;
  const issue=trackingPaused?'tracking':!stable?'spread':!upper?'height':!facing?'orientation':completion<.7?'lift':'hold';
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
  return {grips,trackingPaused,issue,elbowLift,elbowLevels,completion,aligned,deformation:this.deformation(now),count,crossed,score,hold:this.hold,tapped:this.tapped,visible:observations.filter(Boolean).length,
   posture:this.hands.map(h=>h.posture),hover:this.hands.map(h=>h.hover),armed:this.hands.map(h=>h.armed),closed:this.hands.map(h=>h.closed)};
 }
}
