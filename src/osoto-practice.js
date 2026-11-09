import {sampleThrow} from './throw-motion.js';
export const OSOTO_TIMES=[0,1.45,2,2.60];
export const OSOTO_JOINTS=[0,11,12,13,14,15,16,23,24,25,26,27,28];
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:((a.z??0)+(b.z??0))/2});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function cameraPose(points,aspect){
 return points?.map(p=>p?{...p,x:1-p.x,y:p.y*aspect,visibility:p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1?(p.visibility??1):0}:null)??null;
}
export function normalizeBody(points){
 if(!points||OSOTO_JOINTS.some(i=>!points[i]||(points[i].visibility??1)<.45||!Number.isFinite(points[i].x)||!Number.isFinite(points[i].y)))return null;
 const origin=mid(points[23],points[24]),shoulder=mid(points[11],points[12]),scale=Math.hypot(origin.x-shoulder.x,origin.y-shoulder.y,origin.z-shoulder.z);
 if(scale<.035)return null;
 return {origin,scale,points:points.map(p=>p?{x:(p.x-origin.x)/scale,y:(p.y-origin.y)/scale,z:Number.isFinite(p.z)?(p.z-origin.z)/scale:null}:null)};
}
export function osotoPose(time){
 const b=sampleThrow('o-soto-gari',time).tori,p=Array(33).fill(null);
 // Frontal perspective: the foot closer to the camera appears slightly lower/larger.
 const put=(i,v)=>{const z=v[2]-b.pelvis[2],perspective=1/(1-z*.30);p[i]={x:-(v[0]-b.pelvis[0])*perspective,y:-(v[1]-b.pelvis[1])*perspective,z:-z,visibility:1};};
 put(0,b.head);
 for(const [side,a,e,w,h,k,f]of [['left',11,13,15,23,25,27],['right',12,14,16,24,26,28]]){
  put(a,b.shoulders[side]);put(e,b.arms[side].joint);put(w,b.arms[side].end);
  put(h,b.legs[side].root);put(k,b.legs[side].joint);put(f,b.legs[side].end);
 }
 return normalizeBody(p).points;
}
export const OSOTO_TARGETS=OSOTO_TIMES.map(osotoPose);
export const OSOTO_DEMO_DURATION=14;
// Hold each requested pose, then smoothly play the existing authored motion.
const DEMO_KEYS=[[0,0],[2,0],[4,1.45],[5.5,1.45],[7.5,2],[9,2],[11.5,2.6],[14,2.6]];
export function osotoAnimation(elapsed){
 const seconds=Math.max(0,Math.min(OSOTO_DEMO_DURATION,elapsed));
 let i=0;while(i<DEMO_KEYS.length-2&&seconds>DEMO_KEYS[i+1][0])i++;
 const [a,ta]=DEMO_KEYS[i],[b,tb]=DEMO_KEYS[i+1],u=(seconds-a)/(b-a),time=ta+(tb-ta)*u;
 const stage=time<.7?0:time<1.7?1:time<2.2?2:3;
 return {points:osotoPose(time),stage,time};
}
export function assessOsoto(points,stage){
 const body=normalizeBody(points);if(!body)return {score:0,matched:false,issue:'tracking'};
 const p=body.points,t=OSOTO_TARGETS[stage],ids=stage===0?[11,12,25,26,27,28]:[11,12,13,14,15,16,25,26,27,28];
 const error=ids.reduce((n,i)=>n+Math.min(1.5,dist(p[i],t[i])),0)/ids.length;
 const score=Math.round(Math.max(0,1-error/1.35)*100);
 // Separate critical leg and torso gates prevent an unchanged standing pose
 // or a left-leg lift from clearing later stages through an average score.
 const left=dist(p[27],t[27])<.6;
 const right=dist(p[28],t[28])<.65;
 const torso=dist(mid(p[11],p[12]),mid(t[11],t[12]))<.5;
 const arms=stage===0||[15,16].every(i=>dist(p[i],t[i])<.85);
 const depthReady=[11,12,23,24,27,28].every(i=>Number.isFinite(p[i].z));
 const front=depthReady&&p[12].x-p[11].x>.35&&Math.abs(p[11].z-p[12].z)<.65;
 const depth=depthReady&&(stage===0?p[28].z<p[27].z-.10:stage===1?p[27].z<p[28].z-.10:stage===2?p[28].z<-.35:p[28].z>.35&&(p[11].z+p[12].z)/2<-.25);
 const matched=score>=65&&left&&right&&torso&&arms&&front&&depth;
 return {score,matched,body,issue:!front?'front':!depth?'depth':!left?'left':!right?'right':!torso?'torso':!arms?'arms':matched?'hold':'position'};
}
export class OsotoProgress{
 constructor(){this.reset()}
 reset(){this.stage=0;this.hold=0;this.done=false;this.last=null;this.until=0}
 update(points,now,active=true){
  const dt=this.last===null?0:Math.min(.1,Math.max(0,(now-this.last)/1000));this.last=now;
  if(this.done)return {done:true,stage:3,hold:1,score:100,matched:true};
  if(now<this.until)return {stage:this.stage,hold:0,score:100,transition:true};
  const result=assessOsoto(points,this.stage);
  this.hold=active&&result.matched?this.hold+dt:0;
  if(this.hold>=1){this.hold=0;if(this.stage===3)this.done=true;else{this.stage++;this.until=now+1100;}return {...result,stage:this.stage,hold:1,transition:!this.done,done:this.done};}
  return {...result,stage:this.stage,hold:this.hold,done:false};
 }
}
export function drawOsotoBody(ctx,p,color,bodyScale=null){
 if(!p)return;
 const scale=bodyScale??dist(mid(p[11],p[12]),mid(p[23],p[24]));
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
