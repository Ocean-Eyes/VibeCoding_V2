import {sampleOsotoMotion} from './osoto-motion.js';
export const OSOTO_TIMES=[0,1,2,3];
export const OSOTO_JOINTS=[0,11,12,13,14,15,16,23,24,25,26,27,28];
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:((a.z??0)+(b.z??0))/2});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function cameraPose(points,aspect){
 return points?.map(p=>p?{...p,x:p.x,y:p.y*aspect,visibility:p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1?(p.visibility??1):0}:null)??null;
}
export function normalizeBody(points,required=OSOTO_JOINTS,minVisibility=.35){
 if(!points||required.some(i=>!points[i]||(points[i].visibility??1)<minVisibility||!Number.isFinite(points[i].x)||!Number.isFinite(points[i].y)))return null;
 const origin=mid(points[23],points[24]),shoulder=mid(points[11],points[12]);
 return normalizeGuideBody(points,Math.hypot(origin.x-shoulder.x,origin.y-shoulder.y,origin.z-shoulder.z));
}
const visible=p=>p&&(p.visibility??1)>=.35&&Number.isFinite(p.x)&&Number.isFinite(p.y);
export function normalizeGuideBody(points,referenceScale=null){
 if(!points||[11,12,23,24].some(i=>!visible(points[i])))return null;
 const origin=mid(points[23],points[24]),shoulder=mid(points[11],points[12]),scale=referenceScale??dist(origin,shoulder);
 if(!Number.isFinite(scale)||scale<.035)return null;
 return {origin,scale,points:points.map(p=>p?{x:(p.x-origin.x)/scale,y:(p.y-origin.y)/scale,z:Number.isFinite(p.z)&&Number.isFinite(origin.z)?(p.z-origin.z)/scale:null,visibility:p.visibility??1}:null)};
}
export class OsotoGuideScale{
 constructor(){this.reset()}
 reset(){this.samples=[];this.scale=null}
 update(points,calibrating=false){
  const body=normalizeGuideBody(points);if(!body)return null;
  // Use image-space torso size during preparation, then retain it. Per-frame
  // inferred depth or torso foreshortening must not resize the whole avatar.
  if(this.scale===null||calibrating){
   this.samples.push(body.scale/OSOTO_GUIDE_TORSO);if(this.samples.length>15)this.samples.shift();
   const sorted=[...this.samples].sort((a,b)=>a-b);this.scale=sorted[Math.floor(sorted.length/2)];
  }
  return normalizeGuideBody(points,this.scale);
 }
}
export function projectOsotoCameraPose(points,width,height,videoWidth,videoHeight){
 if(!points||videoWidth<=0||videoHeight<=0)return null;
 const factor=Math.min(width/videoWidth,height/videoHeight),imageWidth=videoWidth*factor,imageHeight=videoHeight*factor;
 const ox=(width-imageWidth)/2,oy=(height-imageHeight)/2;
 // cameraPose uses image-width units for both X and Y. Match object-fit:contain
 // including its letterbox offsets; do not mirror or rotate the coordinates.
 return points.map(p=>p?{...p,x:ox+p.x*imageWidth,y:oy+p.y*imageWidth}:null);
}
export function drawOsotoTracking(ctx,points){
 if(!points)return 0;
 const edges=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[27,31],[28,30],[30,32],[28,32]];
 const segments=edges.filter(([a,b])=>visible(points[a])&&visible(points[b])).map(([a,b])=>[points[a],points[b]]);
 if(visible(points[0])&&visible(points[11])&&visible(points[12]))segments.push([mid(points[11],points[12]),points[0]]);
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 for(const [color,width]of [['#132a3a',5],['#80e7f0',2.5]]){
  ctx.strokeStyle=color;ctx.lineWidth=width;
  for(const [a,b]of segments){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 }
 ctx.fillStyle='#dffaff';ctx.strokeStyle='#163a4c';ctx.lineWidth=1.25;
 for(const i of [...OSOTO_JOINTS,29,30,31,32])if(visible(points[i])){ctx.beginPath();ctx.arc(points[i].x,points[i].y,3,0,Math.PI*2);ctx.fill();ctx.stroke();}
 ctx.restore();return segments.length;
}
export function osotoPose(time){
 const b=sampleOsotoMotion(time),p=Array(33).fill(null);
 // Frontal perspective: the foot closer to the camera appears slightly lower/larger.
 const put=(i,v)=>{const z=v[2]-b.pelvis[2],perspective=1/(1-z*.30);p[i]={x:(v[0]-b.pelvis[0])*perspective,y:-(v[1]-b.pelvis[1])*perspective,z:-z,visibility:1};};
 put(0,b.head);
 for(const [side,a,e,w,h,k,f]of [['left',11,13,15,23,25,27],['right',12,14,16,24,26,28]]){
  put(a,b.shoulders[side]);put(e,b.arms[side].joint);put(w,b.arms[side].end);
  put(h,b.legs[side].root);put(k,b.legs[side].joint);put(f,b.legs[side].end);
 }
 return normalizeBody(p).points;
}
export const OSOTO_TARGETS=OSOTO_TIMES.map(osotoPose);
const OSOTO_GUIDE_TORSO=dist(mid(OSOTO_TARGETS[0][11],OSOTO_TARGETS[0][12]),mid(OSOTO_TARGETS[0][23],OSOTO_TARGETS[0][24]));
export function createOsotoGuideProjection(width=300,height=420,offsetX=0){
 const all=OSOTO_TARGETS.flat().filter(Boolean);
 // One fixed viewport includes outstretched arms as well as all target poses.
 // The target must not move or shrink when the tracked user changes posture.
 const minX=Math.min(-1.85,...all.map(p=>p.x))-.15,maxX=Math.max(1.85,...all.map(p=>p.x))+.15;
 const minY=Math.min(-2.25,...all.map(p=>p.y))-.15,maxY=Math.max(2.1,...all.map(p=>p.y))+.15;
 const scale=Math.min((width-24)/(maxX-minX),(height-24)/(maxY-minY));
 const ox=offsetX+width/2-(minX+maxX)*scale/2,oy=height/2-(minY+maxY)*scale/2;
 // Mirror both panels within their own bounds; anatomical labels stay readable.
 return {scale,project:points=>points.map(p=>p?{...p,x:offsetX+width-(ox-offsetX+p.x*scale),y:oy+p.y*scale}:null)};
}
export const OSOTO_DEMO_DURATION=14;
// Hold each requested pose, then smoothly play the reference-based solo motion.
const DEMO_KEYS=[[0,0],[2,0],[4,1],[5.5,1],[7.5,2],[9,2],[11.5,3],[14,3]];
export function osotoAnimation(elapsed){
 const seconds=Math.max(0,Math.min(OSOTO_DEMO_DURATION,elapsed));
 let i=0;while(i<DEMO_KEYS.length-2&&seconds>DEMO_KEYS[i+1][0])i++;
 const [a,ta]=DEMO_KEYS[i],[b,tb]=DEMO_KEYS[i+1],u=(seconds-a)/(b-a),time=ta+(tb-ta)*u;
 const stage=time<.5?0:time<1.5?1:time<2.5?2:3;
 return {points:osotoPose(time),stage,time};
}
export function assessOsoto(points,stage){
 const finish=stage===3,finishJoints=[11,12,23,24,25,26,27,28];
 // Leaning forward often hides the face or hands. The finish is a torso/leg
 // pose; hidden wrists and fingertip positions must not block completion.
 const body=finish?normalizeBody(points,finishJoints,.25):normalizeBody(points);if(!body)return {score:0,matched:false,critical:false,issue:'tracking'};
 const p=body.points,t=OSOTO_TARGETS[stage],ids=finish?finishJoints:stage===0?[11,12,25,26,27,28]:[11,12,13,14,15,16,25,26,27,28];
 const error=ids.reduce((n,i)=>n+Math.min(1.5,dist(p[i],t[i])),0)/ids.length;
 const positionScore=Math.round(Math.max(0,1-error/1.7)*100);
 // Separate critical leg and torso gates prevent an unchanged standing pose
 // or a left-leg lift from clearing later stages through an average score.
 const left=finish||dist(p[27],t[27])<(stage===0?1.15:.85);
 const right=finish||dist(p[28],t[28])<(stage===0?1.15:.90);
 const torso=finish||dist(mid(p[11],p[12]),mid(t[11],t[12]))<.70;
 const arms=finish||stage===0||[15,16].every(i=>dist(p[i],t[i])<1.15);
 const depthReady=[11,12,23,24,25,26,27,28].every(i=>Number.isFinite(p[i].z));
 const reliableFeet=finish?(p[27].visibility??1)>=.35&&(p[28].visibility??1)>=.25:[27,28].every(i=>(p[i].visibility??1)>=.45);
 const front=depthReady&&p[11].x-p[12].x>(finish?.12:.28)&&Math.abs(p[11].z-p[12].z)<(finish?1.8:.90);
 const planted=(knee,ankle)=>p[ankle].y>1&&p[ankle].y-p[knee].y>.32&&p[knee].y>.30;
 const support=finish?p[27].y>.85&&p[27].y-p[25].y>.18&&p[25].y>.20:planted(25,27)&&(stage>=2||planted(26,28));
 const shoulder=mid(p[11],p[12]),upright=-shoulder.y;
 const hipX=p[23].x-p[24].x,hipY=p[23].y-p[24].y,hipWidth=Math.hypot(hipX,hipY)||1;
 const imageAdvance=((p[28].y-p[27].y)*hipX-(p[28].x-p[27].x)*hipY)/hipWidth,depthAdvance=p[27].z-p[28].z;
 const length=(a,b)=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y,p[a].z-p[b].z);
 const extension=depthReady?length(24,28)/(length(24,26)+length(26,28)):0;
 // A small visible stagger is enough. Inferred RGB depth may be near zero;
 // use it to reject a clearly reversed step, not to demand a measured stride.
 // Level feet still fail even when inferred depth claims a large step.
 const stepDirection=stage===0?1:-1;
 const stance=stepDirection*imageAdvance>.025&&stepDirection*depthAdvance>-.08&&upright>.70;
 const phase=depthReady&&(stage<2?stance:
  stage===2?p[27].y-p[28].y>.35&&p[26].y<.45&&p[25].y-p[26].y>.30&&p[26].z<-.30&&p[28].z<-.20&&extension<.92&&upright>.80:
  p[28].z>.02&&p[26].z>-.15&&extension>.75&&p[27].y-p[28].y>.08&&shoulder.z<-.035&&(upright<.995||p[27].y-p[28].y>.35));
 const critical=reliableFeet&&front&&support&&phase;
 const passScore=finish?45:55,score=critical?positionScore:Math.min(positionScore,passScore-1);
 const matched=critical&&positionScore>=passScore&&left&&right&&torso&&arms;
 const recoverable=reliableFeet&&front&&support&&(stage<2?upright>.70&&stepDirection*imageAdvance>.01&&stepDirection*depthAdvance>-.12:finish&&p[28].z>-.08&&p[27].y-p[28].y>.025&&shoulder.z<.02&&extension>.65);
 return {score,matched,critical,recoverable,body,issue:!reliableFeet?'tracking':!front?'front':!support?(stage<2?'support':'left'):!phase?(stage<2?'depth':finish&&shoulder.z>=-.035?'torso':'right'):!left?'left':!right?'right':!torso?'torso':!arms?'arms':matched?'hold':'position'};
}
export class OsotoProgress{
 constructor(){this.reset()}
 reset(){this.stage=0;this.hold=0;this.done=false;this.last=null;this.until=0}
 update(points,now,active=true){
  const dt=this.last===null?0:Math.min(.1,Math.max(0,(now-this.last)/1000));this.last=now;
  if(this.done)return {done:true,stage:3,hold:1,score:100,matched:true};
  if(now<this.until)return {stage:this.stage,hold:0,score:100,transition:true};
  const result=assessOsoto(points,this.stage);
  // Brief pose jitter reduces progress instead of discarding the entire hold.
  this.hold=!active||!result.body||(!result.critical&&!result.recoverable)?0:result.matched?this.hold+dt:Math.max(0,this.hold-dt*.5);
  if(this.hold>=1){this.hold=0;if(this.stage===3)this.done=true;else{this.stage++;this.until=now+1100;}return {...result,stage:this.stage,hold:1,transition:!this.done,done:this.done};}
  return {...result,stage:this.stage,hold:this.hold,done:false};
 }
}
export function drawOsotoBody(ctx,p,color,bodyScale=null,{outline='#49371f',belt='#4c3823'}={}){
 if(!p||[11,12,23,24].some(i=>!visible(p[i])))return;
 const scale=bodyScale??dist(mid(p[11],p[12]),mid(p[23],p[24]));
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.fillStyle=color;
 for(const [a,b,width]of [[23,25,.22],[25,27,.17],[24,26,.22],[26,28,.17]]){
  if(!visible(p[a])||!visible(p[b]))continue;
  ctx.lineWidth=scale*width;ctx.beginPath();ctx.moveTo(p[a].x,p[a].y);ctx.lineTo(p[b].x,p[b].y);ctx.stroke();
 }
 ctx.beginPath();for(const [n,i]of [11,12,24,23].entries())n?ctx.lineTo(p[i].x,p[i].y):ctx.moveTo(p[i].x,p[i].y);ctx.closePath();ctx.fill();
 // Pulling forearms are in front of the chest, not hidden behind its fill.
 for(const [a,b,width]of [[11,13,.15],[12,14,.15],[13,15,.12],[14,16,.12]]){
  if(!visible(p[a])||!visible(p[b]))continue;
  ctx.beginPath();ctx.moveTo(p[a].x,p[a].y);ctx.lineTo(p[b].x,p[b].y);
  ctx.strokeStyle=outline;ctx.lineWidth=scale*width+Math.max(1,scale*.018);ctx.stroke();
  ctx.strokeStyle=color;ctx.lineWidth=scale*width;ctx.stroke();
 }
 if(visible(p[0])){
  const shoulders=mid(p[11],p[12]);ctx.lineWidth=scale*.16;ctx.beginPath();ctx.moveTo(shoulders.x,shoulders.y);ctx.lineTo(p[0].x,p[0].y);ctx.stroke();
  ctx.beginPath();ctx.arc(p[0].x,p[0].y,scale*.21,0,Math.PI*2);ctx.fill();
 }
 for(const i of [15,16,27,28])if(visible(p[i])){ctx.beginPath();ctx.arc(p[i].x,p[i].y,scale*(i<20?.085:.10),0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle=belt;ctx.lineWidth=scale*.07;ctx.beginPath();ctx.moveTo(p[23].x,p[23].y);ctx.lineTo(p[24].x,p[24].y);ctx.stroke();
 ctx.font=`bold ${Math.max(12,scale*.16)}px sans-serif`;ctx.textAlign='center';ctx.fillStyle='#fff';
 for(const [i,label]of [[27,'L'],[28,'R']])if(visible(p[i]))ctx.fillText(label,p[i].x,p[i].y+scale*.05);
 ctx.restore();
}
