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
export function lapelPoint(side,t,deformation=[]){
 const p=lapelRest(side,t),grip=deformation.find(g=>g.side===side);
 if(grip){
  const weight=t<=grip.t?ease(t/grip.t):ease((1-t)/(1-grip.t));
  p.x+=grip.dx*weight;p.y+=grip.dy*weight;
 }
 return p;
}
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
const emptyHand=()=>({armed:false,closed:false,pending:null,grip:null,openSince:null,releaseSince:null,hover:null});
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
 update(observations,now,{active=false,mirrored=true}={}){
  if(this.lastMirror!==null&&this.lastMirror!==mirrored)this.reset();
  const dt=this.lastTime===null?0:Math.min(.1,Math.max(0,(now-this.lastTime)/1000));
  if(this.lastTime!==null&&now-this.lastTime>250)this.reset();
  this.lastMirror=mirrored;this.lastTime=now;
  for(let i=0;i<2;i++){
   const hand=observations[i],h=this.hands[i],extension=fingerExtension(hand);
   if(extension===null){this.release(i,now);continue}
   const center=graspCenter(hand),wasClosed=h.closed;
   if(extension>.90)h.closed=false;else if(extension<.76)h.closed=true;
   if(h.grip){
    if(!h.closed){h.releaseSince??=now;if(now-h.releaseSince>=65){this.release(i,now);continue}}else h.releaseSince=null;
    const dx=center.x-h.grip.start.x,dy=center.y-h.grip.start.y;
    if(Math.hypot(dx,dy)>.65){this.release(i,now);continue}
    h.grip.dx=h.grip.offset.x+dx;h.grip.dy=h.grip.offset.y+dy;h.grip.travelX=dx;h.grip.center=center;continue;
   }
   h.hover=collarHit(center,this.deformation(now),this.hands.map(s=>s.grip?.side).filter(Boolean));
   if(!h.closed){h.openSince??=now;if(now-h.openSince>=80)h.armed=true;h.pending=null}
   else{
    h.openSince=null;
    if(!wasClosed){
     h.pending=h.armed&&h.hover?{...h.hover,since:now}:null;h.armed=false;
    }
    if(h.pending){
     if(!h.hover||h.hover.side!==h.pending.side){h.pending=null;continue}
     if(now-h.pending.since>=90){
      const hit=h.hover,rest=lapelRest(hit.side,hit.t),offset={x:center.x-rest.x,y:center.y-rest.y};h.grip={side:hit.side,t:hit.t,start:center,center,offset,dx:offset.x,dy:offset.y,travelX:0};h.pending=null;
     }
    }
   }
  }
  const grips=this.hands.map(h=>h.grip),count=grips.filter(Boolean).length;
  const crossed=count===2&&grips.every((g,i)=>g.side===(i?-1:1)*(mirrored?1:-1));
  const pulls=grips.map(g=>g?clamp(g.side*g.travelX/.20):0),tension=crossed?Math.min(...pulls):0;
  if(!this.tapped){if(active&&crossed&&tension>=.7)this.hold=Math.min(GRIP_HOLD_SECONDS,this.hold+dt);else this.hold=0;}
  if(this.hold>=GRIP_HOLD_SECONDS)this.tapped=true;
  const score=Math.round(count*25+50*tension);
  return {grips,deformation:this.deformation(now),count,crossed,pulls,tension,score,hold:this.hold,tapped:this.tapped,visible:observations.filter(Boolean).length,
   hover:this.hands.map(h=>h.hover),armed:this.hands.map(h=>h.armed),closed:this.hands.map(h=>h.closed)};
 }
}
