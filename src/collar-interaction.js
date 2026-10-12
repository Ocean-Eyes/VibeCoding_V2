const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
export const GRIP_PASS_SCORE=85;
export const GRIP_HOLD_SECONDS=1.2;
export function lapelRest(side,t){
 const points=side>0?[[.215,.065],[.34,.20],[-.10,.69],[-.285,1.14]]:[[-.215,.065],[-.34,.20],[-.13,.44],[.01,.52]];
 const u=1-t,w=[u*u*u,3*u*u*t,3*u*t*t,t*t*t];
 return {x:points.reduce((a,p,i)=>a+p[0]*w[i],0),y:points.reduce((a,p,i)=>a+p[1]*w[i],0)};
}
// One continuous deformation field for the sewn collar AND the entire coat.
// Compact radial constraints move surrounding fabric; neckline and belt remain fixed.
export function clothPoint(point,deformation=[]){
 const envelope=y=>ease((y-.065)/.11)*ease((1.10-y)/.30);
 const kernel=(p,g)=>{
  const pin=lapelRest(g.side,g.t),r=Math.hypot(p.x-pin.x,p.y-pin.y)/.58;
  return r>=1?0:(1-r)**4*(1+4*r)*envelope(p.y)/Math.max(.001,envelope(pin.y));
 };
 const grips=deformation.slice(0,2);
 if(!grips.length)return {...point};
 let coefficients=grips.map(g=>({x:g.dx,y:g.dy}));
 if(grips.length===2){
  const a=kernel(lapelRest(grips[0].side,grips[0].t),grips[1]),b=kernel(lapelRest(grips[1].side,grips[1].t),grips[0]),det=1-a*b;
  coefficients=coefficients.map((v,i)=>({x:(v.x-(i?b:a)*grips[1-i].dx)/det,y:(v.y-(i?b:a)*grips[1-i].dy)/det}));
 }
 return grips.reduce((p,g,i)=>{const w=kernel(point,g);return {x:p.x+w*coefficients[i].x,y:p.y+w*coefficients[i].y}}, {...point});
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
   const t=k/120,rest=lapelRest(side,t);if(rest.y<.145||rest.y>.43)continue;
   const p=lapelPoint(side,t,deformation),d=Math.hypot(point.x-p.x,point.y-p.y);
   if(d<.092&&(!best||d<best.distance))best={side,t,point:p,distance:d};
  }
 }
 return best;
}
// MCP positions remain stable as the fingers close, unlike the moving fingertips.
export function graspCenter(hand){return [5,9,13,17].reduce((p,i)=>({x:p.x+hand[i].x/4,y:p.y+hand[i].y/4}),{x:0,y:0})}
export function fingerExtension(hand){
 if(!hand||hand.length!==21)return null;
 const ratios=[5,9,13,17].map(i=>{
  const length=distance(hand[0],hand[i])+distance(hand[i],hand[i+1])+distance(hand[i+1],hand[i+2])+distance(hand[i+2],hand[i+3]);
  return length>.00001?distance(hand[0],hand[i+3])/length:1;
 });
 return ratios.reduce((a,b)=>a+b,0)/4;
}
// Use the 3D palm normal, including depth: a natural grip may be edge-on
// to the webcam. A 2D projected-area test would force the user to flatten it.
export function gripPosture(hand,index,side,mirrored,direction){
 const center=graspCenter(hand),wrist=hand[0],dx=center.x-wrist.x,dy=center.y-wrist.y,length=Math.hypot(dx,dy);
 if(side!==(index?-1:1)*(mirrored?1:-1))return 'opposite';
 if(length<.025||side*dx/length<.25||dy/length>-.12)return 'diagonal';
 const a=hand[5],b=hand[17],u={x:a.x-wrist.x,y:a.y-wrist.y,z:(a.z??0)-(wrist.z??0)},v={x:b.x-wrist.x,y:b.y-wrist.y,z:(b.z??0)-(wrist.z??0)};
 const nx=u.y*v.z-u.z*v.y,ny=u.z*v.x-u.x*v.z,nz=u.x*v.y-u.y*v.x;
 const length3D=Math.hypot(nx,ny,nz);
 if(length3D<.00001)return 'turn';
 // Downward and toward-camera components form the expected grip hemisphere.
 const normal=(ny-nz)*(index?-1:1)*(mirrored?1:-1)/(Math.SQRT2*length3D);
 if(Math.abs(normal)<.10)return 'turn';
 if((normal>0)!==(direction==='↓'))return 'palm';
 return null;
}
const emptyHand=()=>({armed:false,closed:false,pending:null,grip:null,releaseSince:null,hover:null,posture:null});
// Geometric game interaction only: this measures virtual displacement, not physical pressure.
export class CollarInteraction{
 constructor(){this.reset()}
 reset(){this.hands=[emptyHand(),emptyHand()];this.released=[];this.lastTime=null;this.hold=0;this.tapped=false;this.lastMirror=null}
 release(i,now){
  const h=this.hands[i];if(h.grip)this.released.push({...h.grip,releasedAt:now});
  this.hands[i]=emptyHand();this.hold=0;this.tapped=false;
 }
 deformation(now){
  this.released=this.released.filter(g=>now-g.releasedAt<700);
  const live=this.hands.map(h=>h.grip).filter(Boolean);
  return [...live,...this.released.filter(g=>!live.some(l=>l.side===g.side)).map(g=>({...g,dx:g.dx*Math.exp(-(now-g.releasedAt)/110),dy:g.dy*Math.exp(-(now-g.releasedAt)/110)}))];
 }
 update(observations,now,{active=false,mirrored=true,directions=['↓','↓']}={}){
  if(this.lastMirror!==null&&this.lastMirror!==mirrored)this.reset();
  const dt=this.lastTime===null?0:Math.min(.1,Math.max(0,(now-this.lastTime)/1000));
  if(this.lastTime!==null&&now-this.lastTime>250)this.reset();
  this.lastMirror=mirrored;this.lastTime=now;
  for(let i=0;i<2;i++){
   const hand=observations[i],h=this.hands[i],extension=fingerExtension(hand);
   if(extension===null){this.release(i,now);continue}
   const center=graspCenter(hand);
   if(extension>.90)h.closed=false;else if(extension<.86)h.closed=true;
   if(h.grip){
    if(!h.closed){h.releaseSince??=now;if(now-h.releaseSince>=65){this.release(i,now);continue}}else h.releaseSince=null;
    const dx=center.x-h.grip.start.x,dy=center.y-h.grip.start.y;
    if(Math.hypot(dx,dy)>.65){this.release(i,now);continue}
    h.grip.dx=h.grip.offset.x+dx;h.grip.dy=h.grip.offset.y+dy;h.grip.travelX=dx;h.grip.center=center;continue;
   }
   h.hover=collarHit(center,this.deformation(now),this.hands.map(s=>s.grip?.side).filter(Boolean));
   h.posture=h.hover?gripPosture(hand,i,h.hover.side,mirrored,directions[i]):null;
   h.armed=!!h.hover&&!h.posture;
   // Bent fingers may enter already prepared: no fully-open gesture is required.
   // Stable contact + correct opposite lapel, diagonal wrist and palm orientation
   // prevent an arbitrary fist or a flat open hand from attaching to the coat.
   if(!h.closed||!h.armed){h.pending=null;continue}
   if(!h.pending||h.pending.side!==h.hover.side)h.pending={...h.hover,since:now};
   if(now-h.pending.since>=120){
    const hit=h.hover,rest=lapelRest(hit.side,hit.t),offset={x:center.x-rest.x,y:center.y-rest.y};
    h.grip={side:hit.side,t:hit.t,start:center,center,offset,dx:offset.x,dy:offset.y,travelX:0};h.pending=null;
   }
  }
  const grips=this.hands.map(h=>h.grip),count=grips.filter(Boolean).length;
  const crossed=count===2&&grips.every((g,i)=>g.side===(i?-1:1)*(mirrored?1:-1));
  const pulls=grips.map(g=>g?clamp(g.side*g.travelX/.20):0),tension=crossed?Math.min(...pulls):0;
  if(!this.tapped){if(active&&crossed&&tension>=.7)this.hold=Math.min(GRIP_HOLD_SECONDS,this.hold+dt);else this.hold=0;}
  if(this.hold>=GRIP_HOLD_SECONDS)this.tapped=true;
  const score=Math.round(count*25+50*tension);
  return {grips,deformation:this.deformation(now),count,crossed,pulls,tension,score,hold:this.hold,tapped:this.tapped,visible:observations.filter(Boolean).length,
   posture:this.hands.map(h=>h.posture),hover:this.hands.map(h=>h.hover),armed:this.hands.map(h=>h.armed),closed:this.hands.map(h=>h.closed)};
 }
}
