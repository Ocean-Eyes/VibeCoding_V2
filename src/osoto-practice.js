import {sampleThrow} from './throw-motion.js';
export const OSOTO_TIMES=[1.45,2,2.60];
export const OSOTO_JOINTS=[0,11,12,13,14,15,16,23,24,25,26,27,28];
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function cameraPose(points,aspect){
 return points?.map(p=>p?{...p,x:1-p.x,y:p.y*aspect,visibility:p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1?(p.visibility??1):0}:null)??null;
}
export function normalizeBody(points){
 if(!points||OSOTO_JOINTS.some(i=>!points[i]||(points[i].visibility??1)<.45||!Number.isFinite(points[i].x)||!Number.isFinite(points[i].y)))return null;
 const origin=mid(points[23],points[24]),shoulder=mid(points[11],points[12]),scale=dist(origin,shoulder);
 if(scale<.035)return null;
 return {origin,scale,points:points.map(p=>p?{x:(p.x-origin.x)/scale,y:(p.y-origin.y)/scale}:null)};
}
export function osotoTarget(stage){
 const b=sampleThrow('o-soto-gari',OSOTO_TIMES[stage]).tori,p=Array(33).fill(null);
 const put=(i,v)=>p[i]={x:-(.6*v[0]-.8*v[2]),y:-v[1],visibility:1};
 put(0,b.head);
 for(const [side,a,e,w,h,k,f]of [['left',11,13,15,23,25,27],['right',12,14,16,24,26,28]]){
  put(a,b.shoulders[side]);put(e,b.arms[side].joint);put(w,b.arms[side].end);
  put(h,b.legs[side].root);put(k,b.legs[side].joint);put(f,b.legs[side].end);
 }
 return normalizeBody(p).points;
}
export const OSOTO_TARGETS=OSOTO_TIMES.map((_,i)=>osotoTarget(i));
export function assessOsoto(points,stage){
 const body=normalizeBody(points);if(!body)return {score:0,matched:false,issue:'tracking'};
 const p=body.points,t=OSOTO_TARGETS[stage],ids=[11,12,13,14,15,16,25,26,27,28];
 const error=ids.reduce((n,i)=>n+Math.min(1.5,dist(p[i],t[i])),0)/ids.length;
 const score=Math.round(Math.max(0,1-error/1.35)*100);
 // Separate critical leg and torso gates prevent an unchanged standing pose
 // or a left-leg lift from clearing later stages through an average score.
 const left=dist(p[27],t[27])<.6;
 const right=dist(p[28],t[28])<.65;
 const torso=dist(mid(p[11],p[12]),mid(t[11],t[12]))<.5;
 const arms=[15,16].every(i=>dist(p[i],t[i])<.85);
 const matched=score>=65&&left&&right&&torso&&arms;
 return {score,matched,body,issue:!left?'left':!right?'right':!torso?'torso':!arms?'arms':matched?'hold':'position'};
}
export class OsotoProgress{
 constructor(){this.reset()}
 reset(){this.stage=0;this.hold=0;this.done=false;this.last=null;this.until=0}
 update(points,now,active=true){
  const dt=this.last===null?0:Math.min(.1,Math.max(0,(now-this.last)/1000));this.last=now;
  if(this.done)return {done:true,stage:2,hold:1,score:100,matched:true};
  if(now<this.until)return {stage:this.stage,hold:0,score:100,transition:true};
  const result=assessOsoto(points,this.stage);
  this.hold=active&&result.matched?this.hold+dt:0;
  if(this.hold>=1){this.hold=0;if(this.stage===2)this.done=true;else{this.stage++;this.until=now+1100;}return {...result,stage:this.stage,hold:1,transition:!this.done,done:this.done};}
  return {...result,stage:this.stage,hold:this.hold,done:false};
 }
}
export function drawOsotoBody(ctx,p,color){
 if(!p)return;
 const scale=dist(mid(p[11],p[12]),mid(p[23],p[24]));
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.fillStyle=color;
 for(const [a,b,width]of [[23,25,.22],[25,27,.17],[24,26,.22],[26,28,.17],[11,13,.15],[13,15,.12],[12,14,.15],[14,16,.12]]){
  ctx.lineWidth=scale*width;ctx.beginPath();ctx.moveTo(p[a].x,p[a].y);ctx.lineTo(p[b].x,p[b].y);ctx.stroke();
 }
 ctx.beginPath();for(const [n,i]of [11,12,24,23].entries())n?ctx.lineTo(p[i].x,p[i].y):ctx.moveTo(p[i].x,p[i].y);ctx.closePath();ctx.fill();
 const shoulders=mid(p[11],p[12]);ctx.lineWidth=scale*.16;ctx.beginPath();ctx.moveTo(shoulders.x,shoulders.y);ctx.lineTo(p[0].x,p[0].y);ctx.stroke();
 for(const i of [15,16,27,28]){ctx.beginPath();ctx.arc(p[i].x,p[i].y,scale*(i<20?.085:.10),0,Math.PI*2);ctx.fill();}
 ctx.beginPath();ctx.arc(p[0].x,p[0].y,scale*.21,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#4c3823';ctx.lineWidth=scale*.07;ctx.beginPath();ctx.moveTo(p[23].x,p[23].y);ctx.lineTo(p[24].x,p[24].y);ctx.stroke();
 ctx.font=`bold ${Math.max(12,scale*.16)}px sans-serif`;ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('L',p[27].x,p[27].y+scale*.05);ctx.fillText('R',p[28].x,p[28].y+scale*.05);ctx.restore();
}
