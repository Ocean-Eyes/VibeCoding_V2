import {sampleThrow} from './throw-motion.js';
import {throwGuidePose,throwPracticeYaw} from './throw-guide.js';
import {throwText as t} from './throw-lessons.js';

export const THROW_PRACTICE={
 'o-uchi-gari':{
  times:[0,1.45,2,2.65],
  titles:[t('초기자세 오른발 앞','Starting stance: right foot forward'),t('오른발 안쪽으로 딛기','Step inside with the right foot'),t('왼발로 지지하기','Plant the left foot'),t('오른다리 안쪽으로 후리기','Reap inside with the right leg')],
  cues:[t('정면을 보고 오른발을 조금 앞으로 놓으세요.','Face the camera with the right foot slightly forward.'),t('오른발을 앞으로 내밀어 안쪽으로 들어가세요.','Step forward and inside with the right foot.'),t('왼발을 따라 딛고 오른다리는 앞에 두세요.','Bring the left foot forward, keeping the right leg in front.'),t('왼발로 지지하며 오른다리를 바깥으로 돌리고 상체를 조금 숙이세요.','Support on the left foot, sweep the right leg outward and lean slightly forward.')],
 },
 'ippon-seoi-nage':{
  times:[0,1.55,2,2.6],
  titles:[t('초기자세 측면으로 서기','Starting stance: stand sideways'),t('왼쪽으로 몸 돌리기','Turn to the left'),t('돌아서 무릎 굽히기','Finish the turn and bend the knees'),t('다리 펴며 상체 숙이기','Extend the legs and lean forward')],
  cues:[t('왼쪽 어깨가 카메라를 향하게 옆으로 서세요.','Stand sideways with your left shoulder toward the camera.'),t('양손을 올리고 왼쪽으로 돌아 카메라 쪽을 보세요.','Raise the hands and turn left toward the camera.'),t('반대 방향까지 돌아 양발을 딛고 무릎을 굽히세요.','Complete the turn, plant both feet and bend the knees.'),t('양발을 딛고 다리를 조금 펴며 상체를 앞으로 숙이세요.','Keep both feet planted, extend the legs slightly and lean forward.')],
 },
};
export function throwPracticePose(id,time){
 const points=throwGuidePose(sampleThrow(id,time).tori,throwPracticeYaw(id));
 // Frontal practice needs the visible perspective stagger of grounded feet.
 // The existing paired 3D animation and its coordinates remain untouched.
 return throwPracticeYaw(id)===0?points.map(p=>p?{...p,x:p.x/(1+p.z*.49*.25),y:p.y/(1+p.z*.49*.25)}:null):points;
}
export const THROW_TARGETS=Object.fromEntries(Object.entries(THROW_PRACTICE).map(([id,c])=>[id,c.times.map(time=>throwPracticePose(id,time))]));
const required=[11,12,23,24,25,26,27,28];
const visible=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>=.25;
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:Number.isFinite(a.z)&&Number.isFinite(b.z)?(a.z+b.z)/2:null});
const median=a=>{a=a.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:null};
const average=a=>{a=a.filter(Number.isFinite);return a.length?a.reduce((s,n)=>s+n,0)/a.length:null};
export function measureThrowPose(points,reference=null){
 if(!points||required.some(i=>!visible(points[i])))return null;
 const hip=mid(points[23],points[24]),shoulder=mid(points[11],points[12]);
 const rawScale=Math.hypot(hip.x-shoulder.x,hip.y-shoulder.y),hipWidthRaw=Math.hypot(points[23].x-points[24].x,points[23].y-points[24].y);
 // Front-facing hip width compensates distance changes without erasing a
 // forward lean or knee bend. Side-on hips have no reliable image width.
 const distanceRatio=reference&&reference.width>.30&&reference.hipWidthRaw>.015?hipWidthRaw/reference.hipWidthRaw:1;
 const scale=reference?reference.scale*distanceRatio:rawScale;
 if(!Number.isFinite(scale)||scale<.035)return null;
 const down=reference?.down??{x:(hip.x-shoulder.x)/rawScale,y:(hip.y-shoulder.y)/rawScale},right={x:down.y,y:-down.x};
 const p=points.map(v=>v?{...v,x:((v.x-hip.x)*right.x+(v.y-hip.y)*right.y)/scale,y:((v.x-hip.x)*down.x+(v.y-hip.y)*down.y)/scale,z:Number.isFinite(v.z)&&Number.isFinite(hip.z)?(v.z-hip.z)/scale:null}:null);
 const sh=mid(p[11],p[12]),ankle=mid(p[27],p[28]),knee=mid(p[25],p[26]);
 return {scale:reference?scale:rawScale,hipWidthRaw,down,points:p,
  width:p[11].x-p[12].x,shoulderDepth:Number.isFinite(p[11].z)&&Number.isFinite(p[12].z)?p[11].z-p[12].z:null,
  torsoX:sh.x,torsoY:-sh.y,torsoDepth:sh.z,advance:p[28].y-p[27].y,
  footDepth:Number.isFinite(p[27].z)&&Number.isFinite(p[28].z)?p[27].z-p[28].z:null,
  spread:p[27].x-p[28].x,leftX:p[27].x,rightX:p[28].x,leftReach:p[27].y,rightReach:p[28].y,
  reach:ankle.y,kneeForward:knee.x-ankle.x,
  wristX:average([15,16].filter(i=>visible(p[i])).map(i=>p[i].x)),
 };
}
export function assessThrow(points,id,stage,references=[]){
 if(!THROW_PRACTICE[id])throw new Error('Unsupported practice technique: '+id);
 const m=measureThrowPose(points,references[0]);
 if(!m)return {score:0,matched:false,critical:false,recoverable:false,issue:'tracking'};
 const neutral=references[0]??m,entry=references[1],support=references[2],p=m.points;
 const front=m.width>.30&&Math.abs(m.shoulderDepth??0)<Math.max(.9,m.width*1.3);
 const side=Math.abs(m.width)<.50;
 const feet=m.leftReach>.75&&m.rightReach>.65&&p[25].y>.08&&p[26].y>.08;
 // A 180-degree turn swaps the feet's camera depths. Their image heights
 // change on the same floor; compare against the user's calibrated floor.
 const floorAdvance=Math.abs(neutral.footDepth??0)>.05&&m.footDepth!==null?neutral.advance*m.footDepth/neutral.footDepth:null;
 const grounded=floorAdvance===null?Math.abs(Math.abs(m.advance)-Math.abs(neutral.advance))<.30:Math.abs(m.advance-floorAdvance)<.30;
 let orientation=true,movement=false,issue='position';
 if(id==='o-uchi-gari'){
  orientation=front;
  if(stage===0){movement=m.torsoY>.65&&m.spread<1.25&&Math.abs(m.advance)<.4&&(m.advance>.018||(m.footDepth??0)>.08&&m.advance>-.08);issue='stance';}
  if(stage===1){
   const imageEntry=m.advance-neutral.advance>.035||m.advance-neutral.advance>.012&&m.spread<neutral.spread-.05;
   movement=!!references[0]&&(imageEntry||m.footDepth!==null&&neutral.footDepth!==null&&m.footDepth-neutral.footDepth>.18&&m.advance-neutral.advance>-.08);issue='entry';
  }
  if(stage===2){
   const followed=!!entry&&m.leftX>neutral.leftX+.08&&Math.abs(m.rightX-entry.rightX)<.35;
   const entered=followed||m.advance-neutral.advance>.025||m.spread>neutral.spread+.10||(m.footDepth!==null&&neutral.footDepth!==null&&m.footDepth-neutral.footDepth>.12);
   movement=!!entry&&entered&&m.spread>entry.spread+.06&&(m.advance<entry.advance-.018||m.footDepth!==null&&entry.footDepth!==null&&m.footDepth<entry.footDepth-.15);issue='left';
  }
  if(stage===3){
   const leaning=neutral.torsoY-m.torsoY>.025||m.width>neutral.width*1.025||(m.torsoDepth!==null&&neutral.torsoDepth!==null&&neutral.torsoDepth-m.torsoDepth>.06);
   movement=!!support&&m.spread>support.spread+.15&&m.rightX<support.rightX-.10&&Math.abs(m.leftX-support.leftX)<.70&&m.leftReach>neutral.leftReach*.65&&leaning;issue=leaning?'right':'torso';
  }
 }else{
  if(stage===0){orientation=side&&(m.shoulderDepth===null||m.shoulderDepth<.2);movement=m.torsoY>.65&&Math.abs(m.down.x)<.4&&m.kneeForward<.10&&Math.abs(m.advance)<.40&&m.reach>1.05;issue='side';}
  if(stage===1){orientation=m.width>.28;movement=!!references[0]&&m.width>neutral.width+.20&&m.reach>.85;issue='turn';}
  if(stage===2){orientation=side;movement=!!entry&&grounded&&neutral.reach-m.reach>.10&&m.kneeForward>.10&&m.torsoX>.06&&(m.shoulderDepth===null||m.shoulderDepth>-.12);issue='bend';}
  if(stage===3){orientation=side;movement=!!support&&grounded&&m.kneeForward>.06&&m.torsoX>support.torsoX+.12&&m.torsoX>.25&&m.reach>support.reach+.10;issue='torso';}
 }
 const ids=[11,12,13,14,15,16,25,26,27,28].filter(i=>visible(p[i]));
 const target=THROW_TARGETS[id][stage],error=ids.reduce((sum,i)=>sum+Math.min(2,Math.hypot(p[i].x-target[i].x,p[i].y-target[i].y)),0)/ids.length;
 const positionScore=Math.round(Math.max(0,1-error/2)*100),critical=orientation&&feet&&movement,matched=critical&&positionScore>=55;
 return {score:critical?positionScore:Math.min(44,positionScore),critical,matched,recoverable:orientation&&feet,body:{points:p,scale:m.scale},measurements:m,
  issue:!orientation?(id==='o-uchi-gari'?'front':stage===1?'turn':'side'):!feet?'tracking':!movement?issue:matched?'hold':'position'};
}

export class ThrowProgress{
 constructor(id){if(!THROW_PRACTICE[id])throw new Error('Unsupported practice technique: '+id);this.id=id;this.reset();}
 reset(){this.stage=0;this.done=false;this.references=[];this.referenceSamples=[];this.hold=0;this.last=null;this.until=0;this.frames=[];this.lastInput=null;this.lastSeen=-Infinity;this.lastResult=null;}
 pause(){this.hold=0;this.last=null;this.frames=[];this.lastInput=null;this.lastSeen=-Infinity;this.lastResult=null;this.referenceSamples=[];}
 observe(m){
  this.referenceSamples.push(m);if(this.referenceSamples.length>15)this.referenceSamples.shift();
 }
 finishReference(){
  const samples=this.referenceSamples,last=samples.at(-1);if(!last)return;
  const reference={...last};for(const key of Object.keys(last))if(typeof last[key]==='number'||last[key]===null)reference[key]=median(samples.map(s=>s[key]));
  const down={x:median(samples.map(s=>s.down.x)),y:median(samples.map(s=>s.down.y))},length=Math.hypot(down.x,down.y);reference.down={x:down.x/length,y:down.y/length};
  this.references[this.stage]=reference;this.referenceSamples=[];
 }
 update(points,now,active=true){
  if(this.done)return {stage:3,done:true,score:100,matched:true,hold:1};
  const dt=this.last===null?0:Math.max(0,Math.min(.1,(now-this.last)/1000));this.last=now;
  if(!active){this.pause();return {stage:this.stage,done:false,score:0,hold:0,issue:'tracking'};}
  if(now<this.until)return {stage:this.stage,done:false,transition:true,score:100,hold:0};
  if(!points||required.some(i=>!visible(points[i]))){
   if(this.lastResult&&now-this.lastSeen<=200)return {...this.lastResult,stage:this.stage,done:false,hold:this.hold,matched:false,grace:true,issue:'tracking'};
   this.hold=0;this.frames=[];this.lastInput=null;this.lastResult=null;return {stage:this.stage,done:false,score:0,hold:0,issue:'tracking'};
  }
  this.lastSeen=now;const newInput=points!==this.lastInput;
  if(newInput){this.lastInput=points;this.frames.push({now,points:points.map(p=>p?{...p}:null)});}
  this.frames=this.frames.filter(f=>now-f.now<=250).slice(-5);
  const filtered=points.map((p,i)=>p?{...p,...Object.fromEntries(['x','y','z'].map(k=>[k,median(this.frames.map(f=>f.points[i]?.[k]))]))}:null);
  const result=assessThrow(filtered,this.id,this.stage,this.references);this.lastResult=result;
  if(newInput&&result.matched)this.observe(result.measurements);
  this.hold=!result.critical&&!result.recoverable?0:result.matched?this.hold+dt:Math.max(0,this.hold-dt*.5);
  if(this.hold>=1){
   this.finishReference();this.hold=0;this.frames=[];this.lastInput=null;this.lastResult=null;
   if(this.stage===3)this.done=true;else{this.stage++;this.until=now+1100;}
   return {...result,stage:this.stage,done:this.done,transition:!this.done,hold:1};
  }
  return {...result,stage:this.stage,done:false,hold:this.hold};
 }
}
