// Finish-only judging. Coordinates are in image-width units; Z is inferred,
// not a measured distance. Compare to the user's own planted stance when available.
const mean=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:Number.isFinite(a.z)&&Number.isFinite(b.z)?(a.z+b.z)/2:null});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const joints=[11,12,23,24,25,26,27,28];
const confidence=(p,min)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>=min;
export function finishMeasurements(points){
 if(!points||joints.some(i=>!confidence(points[i],i===28?.20:.25)))return null;
 const hip=mean(points[23],points[24]),shoulder=mean(points[11],points[12]);
 const span=distance(points[23],points[25])+distance(points[25],points[27]);
 if(span<.04)return null;
 const hx=points[23].x-points[24].x,hy=points[23].y-points[24].y,hw=Math.hypot(hx,hy);
 if(hw<span*.04)return null;
 const down={x:-hy/hw,y:hx/hw},along=(a,b)=>((a.x-b.x)*down.x+(a.y-b.y)*down.y)/span;
 const z=p=>Number.isFinite(p.z)&&Number.isFinite(hip.z)?(p.z-hip.z)/span:null;
 const rightLength=distance(points[24],points[26])+distance(points[26],points[28]);
 return {span,hip,shoulder,down,points,
  torsoRatio:distance(hip,shoulder)/span,torsoDepth:z(shoulder),rearDepth:z(points[28]),kneeDepth:z(points[26]),
  footDifference:along(points[27],points[28]),leftReach:along(points[27],points[23]),leftKnee:along(points[25],points[23]),
  rightKnee:along(points[26],points[24]),extension:distance(points[24],points[28])/(rightLength||1),
  shoulderWidth:(points[11].x-points[12].x)/span,footDepthDifference:Number.isFinite(points[27].z)&&Number.isFinite(points[28].z)?(points[28].z-points[27].z)/span:null};
}
export function createFinishReference(points){
 const m=finishMeasurements(points);if(!m)return null;
 return {torsoRatio:m.torsoRatio,torsoDepth:m.torsoDepth,rearDepth:m.rearDepth,kneeDepth:m.kneeDepth,leftReach:m.leftReach,footDifference:m.footDifference,footDepthDifference:m.footDepthDifference};
}
export function assessOsotoFinish(points,reference=null){
 const m=finishMeasurements(points);
 if(!m)return {score:0,matched:false,critical:false,recoverable:false,issue:'tracking'};
 const ref=Array.isArray(reference)?createFinishReference(reference):reference;
 let ground=ref?.footDifference??0;
 // Anchor the floor correction to the user's measured stance. Attenuate it
 // when the reference feet have almost the same inferred depth.
 if(ref&&Math.abs(ref.footDepthDifference)>.008&&Number.isFinite(m.footDepthDifference)){
  const slope=Math.max(-1.5,Math.min(1.5,ref.footDifference/ref.footDepthDifference));
  const weight=Math.min(1,Math.abs(ref.footDepthDifference)/.08);
  ground=ref.footDifference+slope*(m.footDepthDifference-ref.footDepthDifference)*weight;
 }
 const lift=m.footDifference-ground;
 const leanDepth=Number.isFinite(m.torsoDepth)?(ref?.torsoDepth??0)-m.torsoDepth:0;
 const leanImage=ref?Math.abs(m.torsoRatio/ref.torsoRatio-1):Math.max(0,.54-m.torsoRatio);
 const supported=m.leftReach>Math.max(.65,(ref?.leftReach??0)*.90)&&m.leftKnee>.12;
 const raised=lift>.035;
 let legDown=m.rightKnee>.10&&m.extension>.64;
 const forward=m.rearDepth!==null&&m.rearDepth-(ref?.rearDepth??0)<-.15&&m.kneeDepth-(ref?.kneeDepth??0)<-.10;
 const depthUnit=Math.max(Math.abs(ref?.footDepthDifference??0),Math.abs((m.rearDepth??0)-(ref?.rearDepth??0))*.4,.008);
 const leanRatio=leanDepth/depthUnit;
 const rearChange=Math.abs((m.rearDepth??0)-(ref?.rearDepth??0));
 const depthAvailable=!ref||(ref.depthReliable!==false&&(Math.abs(ref.footDepthDifference??0)>.003||Math.abs(ref.torsoDepth??0)>.003))||leanDepth>.012||rearChange>Math.max(.008,3*(ref?.depthNoise??.003));
 if(lift>.45&&m.kneeDepth!==null&&(ref?.kneeDepth??0)-m.kneeDepth>depthUnit*.8)legDown=false;
 const leaning=ref?depthAvailable&&(leanRatio>.12||(leanRatio>.035&&leanImage>.03)):
  (m.torsoDepth??0)<0&&(-(m.torsoDepth??0)/m.torsoRatio>.10||m.torsoRatio<.50&&(m.torsoDepth??0)<-.01);
 const backward=leanRatio<-.12;
 const front=m.shoulderWidth>.08;
 const critical=supported&&raised&&legDown&&!forward&&!backward&&front&&leaning;
 const score=Math.round((supported?25:0)+(raised?25:0)+(legDown&&!forward?25:0)+(leaning&&!backward?25:0));
 const scale=m.span*.54,body={scale,origin:m.hip,points:points.map(p=>p?{...p,x:(p.x-m.hip.x)/scale,y:(p.y-m.hip.y)/scale,z:Number.isFinite(p.z)&&Number.isFinite(m.hip.z)?(p.z-m.hip.z)/scale:null}:null)};
 return {score:critical?score:Math.min(score,44),matched:critical,critical,recoverable:supported&&front&&!forward&&leanRatio>-.8&&lift>-.01,body,
  issue:!front?'front':!supported?'left':!raised||!legDown||forward?'right':!leaning||backward?'torso':'hold',
  measurements:{lift,leanDepth,leanRatio,leanImage,extension:m.extension,knee:m.rightKnee}};
}

const median=values=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:null;};
const average=values=>{const a=values.filter(Number.isFinite);return a.length?a.reduce((s,n)=>s+n,0)/a.length:null;};
const trimmedAverage=values=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return average(a.length>=5?a.slice(1,-1):a);};
export class OsotoFinishJudge{
 constructor(){this.reference=null;this.referenceSamples=[];this.neutralSamples=[];this.frames=[];this.lastReference=null;this.lastInput=null;this.lastValid=-Infinity;this.lastResult=null;}
 observeReference(points,stage=1){
  if(points===this.lastReference)return;this.lastReference=points;
  const sample=createFinishReference(points);if(!sample)return;
  this.referenceSamples.push(sample);if(this.referenceSamples.length>15)this.referenceSamples.shift();
  if(stage===0){this.neutralSamples.push(sample);if(this.neutralSamples.length>15)this.neutralSamples.shift();}
  const samplesFor=key=>key.startsWith('torso')&&this.neutralSamples.length?this.neutralSamples:this.referenceSamples;
  this.reference=Object.fromEntries(Object.keys(sample).map(key=>[key,average(samplesFor(key).map(s=>s[key]))]));
  const errors=[];const meaningful=key=>{
   const values=samplesFor(key).map(s=>s[key]).filter(Number.isFinite),mean=average(values);
   if(mean===null)return false;
   const error=Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/Math.max(1,values.length-1)/values.length);
   errors.push(error);
   return Math.abs(mean)>Math.max(.003,1.5*error);
  };
  const footReliable=meaningful('footDepthDifference'),torsoReliable=meaningful('torsoDepth');
  this.reference.depthReliable=footReliable||torsoReliable;this.reference.depthNoise=Math.max(0,...errors);
 }
 update(points,now){
  const usable=finishMeasurements(points);
  if(!usable){
   if(this.lastResult&&now-this.lastValid<=250)return {...this.lastResult,matched:false,critical:false,recoverable:true,grace:true,issue:'tracking'};
   this.frames=[];this.lastInput=null;this.lastResult=null;return {score:0,matched:false,critical:false,recoverable:false,issue:'tracking'};
  }
  this.lastValid=now;
  if(points!==this.lastInput){
   this.lastInput=points;
   this.frames.push({time:now,points:points.map(p=>p?{...p}:null)});
  }else if(this.frames.length)this.frames.at(-1).time=now;
  this.frames=this.frames.filter(f=>now-f.time<=450).slice(-7);
  const filtered=points.map((p,i)=>p?{...p,...Object.fromEntries(['x','y','z'].map(key=>[key,(key==='z'?trimmedAverage:median)(this.frames.map(f=>f.points[i]?.[key]))]))}:null);
  const result=assessOsotoFinish(filtered,this.reference);
  this.lastResult=result;return result;
 }
}
