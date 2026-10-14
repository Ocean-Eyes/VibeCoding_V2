export const BELT_SOURCE='https://www.youtube.com/watch?v=F-NJFRGi6ys';
export const BELT_REFERENCE_2='https://www.youtube.com/watch?v=IG5WBxopLJw';
// Authored from the supplied videos. A is the end threaded first; the second
// video's demonstrator uses the opposite hand, but the insertion order agrees.
export const BELT_STEPS=[
 {title:'가운데를 허리 앞에',cue:'띠 가운데를 허리 앞에 대고 양끝을 같은 길이로 늘어뜨립니다.',focus:'띠를 비틀지 않고 넓은 면이 몸에 닿게 놓습니다.',move:'양끝 준비',reference:[2,0]},
 {title:'등 뒤로 감아 교차',cue:'가운데를 허리 앞에 댄 채 양끝을 뒤로 보내 교차합니다.',focus:'뒤쪽 보기에서 등 뒤의 두 겹을 확인하세요.',move:'양끝을 등 뒤로',reference:[3.2,5.5]},
 {title:'앞으로 가져와 교차',cue:'뒤에서 교차한 양끝을 앞으로 가져옵니다. A를 B 위에 겹칩니다.',focus:'양끝을 위로 들어 올리지 않고 허리 앞에서 교차합니다.',move:'허리 앞에서 A를 B 위로',reference:[5.4,12.5]},
 {title:'A를 두 겹 밑으로',cue:'A를 교차한 띠와 허리에 감긴 두 겹 모두의 밑에서 위로 통과시킨 뒤 옆으로 빼냅니다.',focus:'A가 두 겹을 함께 감쌉니다. 이 끝을 다시 반대편으로 가져가 고리를 만듭니다.',move:'A 통과 · B 유지',reference:[12.5,15]},
 {title:'A를 끼워 고리 만들기',cue:'A를 다시 들어 반대편 허리띠의 겹 사이에 위에서 아래로 끼웁니다. 앞에는 고리를 남겨 둡니다.',focus:'이 단계에서는 A만 고리를 만듭니다. B는 아직 통과시키지 않습니다.',move:'A로 고리 · B 유지',reference:[15,20.5]},
 {title:'B를 겹 사이와 고리에 통과',cue:'B 끝을 반대편 띠 겹 사이로 내려 넣고, 남겨 둔 A의 고리 앞으로 빼냅니다.',focus:'새 고리를 두 개 만들지 않고, B 끝이 A의 고리를 지나갑니다.',move:'B 통과 · A 유지',reference:[17,24]},
 {title:'양끝 당겨 매듭 정리',cue:'양끝을 좌우로 당겨 고리를 줄이고 매듭을 납작하게 정리합니다. 양끝을 잡은 채 좌우로 당기는 모습을 확인하세요.',focus:'허리의 두 겹과 매듭이 꼬이지 않았는지 확인합니다.',move:'A · B 조이기',reference:[19.5,26]},
];
// A single inextensible, stiff obi. Coordinates are in waist-width units.
// The waist contact arc consumes material; only the remaining length is free.
// Insertion routes distinguish the approaching tip from cloth already fed through.
// Preserve the previous authored motion; reduce its physical dimensions together.
// Scale the generated geometry, not the camera or the mannequin.
const AUTHORED_LENGTH=7.6;
export const BELT_LENGTH=6.4;
const SIZE=BELT_LENGTH/AUTHORED_LENGTH;
export const BELT_WIDTH=.12*SIZE, BELT_THICKNESS=.006*SIZE;
const RX=.46,RZ=.24,TAU=Math.PI*2;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a),unit=a=>mul(a,1/(norm(a)||1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export const pathLength=points=>points.slice(1).reduce((s,p,i)=>s+norm(sub(p,points[i])),0);
// Threading is tip-led: lift the tip to the entry, feed it through the
// opening, then draw the remaining slack through. The idle end stays fixed.
const ROOT={a:[0,-.008,.267],b:[0,.008,.252]};
const CROSS={a:[ROOT.a,[-.12,.045,.32]],b:[ROOT.b,[.14,.045,.30]]};
// Authored in the old coordinate convention; rendered x is reflected to match
// the primary video's front view (A exits first on viewer-right).
const FIRST=[...CROSS.a,[-.04,.06,.244],[-.04,-.06,.244],[-.10,-.06,.31],[-.14,.02,.32]];
const A_LOOP_ENTRY=[.18,-.065,.2595],A_LOOP_EXIT=[.18,.065,.2595];
const DOWN={a:unit([-.15,1,0]),b:unit([.15,1,0])};
const FIRST_DOWN=unit([-.92,-.38,0]),LOOP_DOWN=unit([.85,.3,0]),SECOND_DOWN=unit([-1,.25,0]);
function resample(points,count){
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+norm(sub(points[i],points[i-1])));
 const total=lengths.at(-1);let j=1;
 return Array.from({length:count},(_,i)=>{const s=total*i/(count-1);while(j<lengths.length-1&&lengths[j]<s)j++;return lerp(points[j-1],points[j],(s-lengths[j-1])/(lengths[j]-lengths[j-1]||1))});
}
// One rounded fold stores slack; long spans remain straight and inextensible.
function roundBend(start,middle,end,radius=.07){
 const a=sub(start,middle),b=sub(end,middle),r=Math.min(radius,norm(a)*.24,norm(b)*.24);
 const p=add(middle,mul(unit(a),r)),q=add(middle,mul(unit(b),r)),out=[start,p];
 for(let i=1;i<=12;i++){const t=i/12;out.push(add(add(mul(p,(1-t)**2),mul(middle,2*t*(1-t))),mul(q,t*t)))}
 out.push(end);return out;
}
function bight(start,end,length,outward){
 const chord=sub(end,start),d=norm(chord);
 if(d>length+1e-7)throw new Error('Thread target exceeds available material');
 // An oblique bending plane avoids the singularity of projecting vertical
 // gravity onto an almost vertical strip as its tip rises toward the waist.
 const tangent=unit(chord);
 let side=sub(outward,mul(tangent,dot(outward,tangent)));
 if(norm(side)<1e-8)side=[1,0,0];
 side=unit(side);const center=lerp(start,end,.5);
 let low=0,high=length,route;
 for(let n=0;n<34;n++){const height=(low+high)/2;route=roundBend(start,add(center,mul(side,height)),end);if(pathLength(route)<length)low=height;else high=height}
 return route;
}
// A flat front span with two localized rounded folds. Solve fold depth from
// the available material; do not turn the whole opening into a circular arc.
function loopFold(start,end,length,outward){
 const axis=unit(sub(end,start)),d=norm(sub(end,start));
 if(d>length+1e-7)throw new Error('Loop target exceeds available material');
 const bend=unit(sub(outward,mul(axis,dot(outward,axis))));
 const route=height=>{
  const reach=mul(bend,height),cornerA=add(start,reach),cornerB=add(end,reach);
  const r=Math.min(.025,height*.24,d*.24);
  const entry=add(cornerA,mul(bend,-r)),exit=add(cornerA,mul(axis,r));
  const entryB=add(cornerB,mul(axis,-r)),exitB=add(cornerB,mul(bend,-r));
  const points=[start,entry];
  for(let i=1;i<=8;i++){const t=i/8;points.push(add(add(mul(entry,(1-t)**2),mul(cornerA,2*t*(1-t))),mul(exit,t*t)))}
  points.push(entryB);
  for(let i=1;i<=8;i++){const t=i/8;points.push(add(add(mul(entryB,(1-t)**2),mul(cornerB,2*t*(1-t))),mul(exitB,t*t)))}
  points.push(end);return points;
 };
 let lo=0,hi=length,points;
 for(let n=0;n<34;n++){const mid=(lo+hi)/2;points=route(mid);if(pathLength(points)<length)lo=mid;else hi=mid}
 return points;
}
function foldFrame(prefix,fold,outward){
 return {from:pathLength(prefix),to:pathLength(prefix)+pathLength(fold),axis:unit(cross(sub(fold.at(-1),fold[0]),outward))};
}
function finish(prefix,direction,length){
 const freeLength=length-pathLength(prefix);if(freeLength<=0)throw new Error('Belt route exceeds available cloth');
 return {local:[...prefix,add(prefix.at(-1),mul(direction,freeLength))],freeLength};
}
function sliceAtDistance(points,distance){
 const out=[points[0]];for(let i=1;i<points.length;i++){
  const n=norm(sub(points[i],points[i-1]));if(distance<=n){out.push(lerp(points[i-1],points[i],distance/(n||1)));break}
  out.push(points[i]);distance-=n;
 }return out;
}
function insert(prefix,passage,directionBefore,directionAfter,available,t,{slack=0,outward=[0,1,1],fold=bight,controlOffset=null,lockFold=false}={}){
 const start=prefix.at(-1),entry=passage[0],pLength=pathLength(prefix),remaining=available-pLength;
 const foldDirection=typeof outward==='function'?outward(t):outward;
 const before=add(start,mul(directionBefore,remaining));
 if(t<=.3){
  // The tip arrives at the opening before any of the cloth is threaded.
  const u=ease(t/.3),control=add(start,controlOffset??[Math.sign(entry[0]-start[0])*.4,.4,.15]);
  const tip=add(add(mul(before,(1-u)**2),mul(control,2*u*(1-u))),mul(entry,u*u));
  const incoming=fold(start,tip,remaining,foldDirection);
  return {local:[...prefix,...incoming.slice(1)],frames:lockFold?[foldFrame(prefix,incoming,foldDirection)]:[],freeLength:0,operation:'approach'};
 }
 const routeLength=pathLength(passage),approach=norm(sub(entry,start))+slack;
 const after=remaining-approach-routeLength;
 if(after<=0)throw new Error('Insufficient cloth after insertion');
 const fed=ease((t-.3)/.7)*(routeLength+after);
 const pending=remaining-fed;
 const incoming=fold(start,entry,pending,foldDirection);
 const frames=fold===loopFold?[{...foldFrame(prefix,incoming,foldDirection),strength:ease((t-.3)/.12)}]:lockFold?[foldFrame(prefix,incoming,foldDirection)]:[];
 if(fed<routeLength){
  return {local:[...prefix,...incoming.slice(1),...sliceAtDistance(passage,fed).slice(1)],frames,freeLength:0,operation:'tip-through'};
 }
 const exit=passage.at(-1),tail=fed-routeLength;
 return {local:[...prefix,...incoming.slice(1),...passage.slice(1),add(exit,mul(directionAfter,tail))],frames,freeLength:tail,operation:'draw-through'};
}
function waistPath(key,wrap){
 const side=key==='a'?-1:1,angle=TAU*wrap,n=Math.max(2,Math.ceil(angle*40));
 return Array.from({length:n},(_,i)=>{const t=angle*i/(n-1),layer=(key==='a'?.027:.012)*t/TAU;return [side*(RX+layer)*Math.sin(t),side*.008*t/TAU,(RZ+layer)*Math.cos(t)]});
}
function wrapRoute(key,phase){
 const side=key==='a'?-1:1,wrap=.25+.75*Math.min(1,phase/2),waist=waistPath(key,wrap),end=waist.at(-1);
 const remaining=AUTHORED_LENGTH/2-pathLength(waist),t=ease(Math.max(0,phase-1));
 const rest=[end,add(end,[side*Math.sin(TAU*wrap)*.03,.07,.04])];
 const cross=CROSS[key].map(p=>add(p,sub(end,ROOT[key])));
 const local=rest.map((p,i)=>lerp(p,cross[i],t));
 const direction=unit(lerp(unit([side*Math.sin(TAU*wrap)*.18,1,0]),DOWN[key],t));
 return {waist,...finish(local,direction,remaining),wrap,operation:phase<1?'wrap-back':'return-front'};
}
const A_PASS=FIRST.slice(CROSS.a.length),A_LOOP=[A_LOOP_ENTRY,A_LOOP_EXIT,[.20,.09,.33]];
const LOOP_SLACK=.24;
const LOOP_CURVE=loopFold(FIRST.at(-1),A_LOOP_ENTRY,norm(sub(A_LOOP_ENTRY,FIRST.at(-1)))+LOOP_SLACK,[0,.28,1]);
const A_LOOP_HELD=[...FIRST,...LOOP_CURVE.slice(1),...A_LOOP.slice(1)];
const bridge=lerp(LOOP_CURVE[0],LOOP_CURVE.at(-1),.5),loopAxis=unit(sub(LOOP_CURVE.at(-1),LOOP_CURVE[0]));
const low=LOOP_CURVE.reduce((best,p)=>norm(cross(sub(p,bridge),loopAxis))>norm(cross(sub(best,bridge),loopAxis))?p:best,bridge);
const loopCenter=lerp(bridge,low,.5);
let loopNormal=unit(cross(loopAxis,sub(low,bridge)));if(loopNormal[2]<0)loopNormal=mul(loopNormal,-1);
const B_GAP=[[-.16,-.065,.2595],[-.16,.065,.2595]];
const SECOND=[...CROSS.b,...B_GAP,add(loopCenter,mul(loopNormal,-.045)),add(loopCenter,mul(loopNormal,.06)),add(loopCenter,[0,.045,.12])];
const B_PASS=SECOND.slice(CROSS.b.length);
const compact=p=>[p[0],p[1],.2595+(p[2]-.2595)*.65];
const FINAL={a:A_LOOP_HELD.map((p,i)=>i?compact(p):p),b:SECOND.map((p,i)=>i?compact(p):p)};
// These guides expose aperture geometry for geometric checks, not a claim of
// exact hidden cloth geometry: the reference hands obscure the layer passage.
export const BELT_THREADING={
 opening:LOOP_CURVE.map(p=>[-p[0]*SIZE,p[1]*SIZE,p[2]*SIZE]),
 center:[-loopCenter[0]*SIZE,loopCenter[1]*SIZE,loopCenter[2]*SIZE],
 normal:[-loopNormal[0],loopNormal[1],loopNormal[2]],
 gap:B_GAP.map(p=>[-p[0]*SIZE,p[1]*SIZE,p[2]*SIZE])
};
export function beltOpening(phase){
 const depth=1-.35*ease(phase-5),pivot=.2595*SIZE;
 const flatten=p=>[p[0],p[1],pivot+(p[2]-pivot)*depth];
 return {opening:BELT_THREADING.opening.map(flatten),center:flatten(BELT_THREADING.center),normal:unit([BELT_THREADING.normal[0],BELT_THREADING.normal[1],BELT_THREADING.normal[2]/depth])};
}
function knotRoute(key,phase,length){
 if(key==='a'){
  if(phase<3)return insert(CROSS.a,A_PASS,DOWN.a,FIRST_DOWN,length,phase-2);
  if(phase<4)return insert(FIRST,A_LOOP,FIRST_DOWN,LOOP_DOWN,length,phase-3,{slack:LOOP_SLACK,fold:loopFold,outward:t=>lerp([0,.15,1],[0,.28,1],ease((t-.3)/.7)),controlOffset:[.15,-.4,.08]});
  if(phase<=5)return {...finish(A_LOOP_HELD,LOOP_DOWN,length),frames:[foldFrame(FIRST,LOOP_CURVE,[0,.28,1])],operation:'hold-loop'};
 }else{
  if(phase<=4){const held=finish(CROSS.b,DOWN.b,length);return {...held,frames:[foldFrame(CROSS.b,held.local.slice(CROSS.b.length-1),[0,1,1])],operation:'hold-end'}}
  if(phase<5)return insert(CROSS.b,B_PASS,DOWN.b,SECOND_DOWN,length,phase-4,{lockFold:true});
 }
 const before=key==='a'?A_LOOP_HELD:SECOND,after=FINAL[key],t=ease(phase-5);
 const held=key==='a'?LOOP_DOWN:SECOND_DOWN,out=unit([key==='a'?1:-1,.26,0]);
 const prefix=before.map((p,i)=>lerp(p,after[i],t));
 const frames=key==='a'?[foldFrame(prefix.slice(0,FIRST.length),prefix.slice(FIRST.length-1,FIRST.length+LOOP_CURVE.length-1),[0,.28,1-.35*t])]:[foldFrame(prefix.slice(0,CROSS.b.length),prefix.slice(CROSS.b.length-1,CROSS.b.length+1),[0,1,1-.35*t])];
 return {...finish(prefix,unit(lerp(held,out,t)),length),frames,operation:'tighten'};
}
function rollToward(across,target,tangent,weight){
 const angle=Math.atan2(dot(tangent,cross(across,target)),dot(across,target))*weight;
 return unit(add(mul(across,Math.cos(angle)),mul(cross(tangent,across),Math.sin(angle))));
}
// Average tangents over roughly half a strip width, not one mesh edge.
const FRAME_WINDOW=7;
function makeRibbon(points,key,frames=[],opening=BELT_THREADING){
 let transported=[0,1,0],lastTangent=unit(sub(points[FRAME_WINDOW],points[0]));
 return points.map((p,i)=>{
  let across=transported;
  const tangent=unit(sub(points[Math.min(points.length-1,i+FRAME_WINDOW)],points[Math.max(0,i-FRAME_WINDOW)]));
  const turn=cross(lastTangent,tangent),cos=dot(lastTangent,tangent);
  if(cos>-.9999)across=unit(add(add(across,cross(turn,across)),mul(cross(turn,cross(turn,across)),1/(1+cos))));
  across=unit(sub(across,mul(tangent,dot(across,tangent))));lastTangent=tangent;
  // Keep contact rolls local: feeding them into transport twists the whole tail.
  transported=across;
  // Carry the strip orientation around bends; roll only at authored contacts.
  const material=i/(points.length-1)*points.materialLength;

  for(const frame of frames){
   if(material<frame.from||material>frame.to)continue;
   let target=unit(sub(frame.axis,mul(tangent,dot(frame.axis,tangent))));
   const weight=(frame.strength??1)*ease(Math.min(material-frame.from,frame.to-material)/(.025*SIZE));
   across=rollToward(across,target,tangent,weight);
  }
  if(key==='b'){
   const center=opening.center,normal=opening.normal,distance=norm(sub(p,center));
   if(distance<.16&&Math.abs(dot(tangent,normal))>.4){
    const axis=unit(sub(opening.opening.at(-1),opening.opening[0]));
    let aligned=unit(sub(axis,mul(tangent,dot(axis,tangent))));if(aligned[0]<0)aligned=mul(aligned,-1);
    across=rollToward(across,aligned,tangent,ease((.16-distance)/.09)*ease((Math.abs(dot(tangent,normal))-.4)/.4));
   }
  }
  return {p,left:add(p,mul(across,BELT_WIDTH/2)),right:add(p,mul(across,-BELT_WIDTH/2)),normal:unit(cross(tangent,across)),s:material,key};
 });
}
function buildHalf(route,i,materialLength,opening){
 const path=[...route.waist,...route.local.slice(1)].map(p=>[-p[0]*SIZE,p[1]*SIZE,p[2]*SIZE]),points=resample(path,480);
 materialLength*=SIZE;points.materialLength=materialLength;
 const waistLength=pathLength(route.waist);
 const frames=(route.frames??[]).map(f=>({from:(waistLength+f.from)*SIZE,to:(waistLength+f.to)*SIZE,axis:[-f.axis[0],f.axis[1],f.axis[2]],strength:f.strength}));
 return {path,materialLength,freeLength:route.freeLength*SIZE,operation:route.operation,ribbon:makeRibbon(points,i?'b':'a',frames,opening)};
}
const inverseEase=value=>{
 let lo=0,hi=1;for(let n=0;n<40;n++){const mid=(lo+hi)/2;if(ease(mid)<value)lo=mid;else hi=mid}return (lo+hi)/2;
};
export function beltInspectionPoints(step){
 const entry=inverseEase(.3);
 if(step===5){
  const waistA=pathLength(waistPath('a',1)),waistB=pathLength(waistPath('b',1));
  const balance=(pathLength(FIRST)-pathLength(CROSS.b)+waistA-waistB)/2;
  const available=AUTHORED_LENGTH/2-balance-waistB;
  const feed=available-pathLength(CROSS.b)-norm(sub(B_PASS[0],CROSS.b.at(-1)));
  const emerging=pathLength(B_PASS.slice(0,4));
  return [entry,inverseEase(.3+.7*inverseEase(Math.min(1,emerging/feed)))];
 }
 return step>=3&&step<=4?[entry]:[];
}
const poseCache=new Map();
export function beltPose(step,progress=1){
 step=Math.max(0,Math.min(6,Math.floor(step)));const phase=Math.max(0,step-1)+ (step?ease(progress):0);
 const cacheKey=`${step}/${phase}`;if(poseCache.has(cacheKey))return poseCache.get(cacheKey);
 let halves,wrap;const opening=beltOpening(phase);
 if(phase<2){
  const routes=['a','b'].map(key=>wrapRoute(key,phase));wrap=routes[0].wrap;
  halves=routes.map((r,i)=>buildHalf(r,i,AUTHORED_LENGTH/2,opening));
 }else{
  const waists=['a','b'].map(key=>waistPath(key,1));wrap=1;
  const firstBalance=(pathLength(FIRST)-pathLength(CROSS.b)+pathLength(waists[0])-pathLength(waists[1]))/2;
  const lastBalance=(pathLength(FINAL.a)-pathLength(FINAL.b)+pathLength(waists[0])-pathLength(waists[1]))/2;
  const balance=ease(phase-2)*firstBalance+ease(phase-5)*(lastBalance-firstBalance);
  halves=['a','b'].map((key,i)=>{const materialLength=AUTHORED_LENGTH/2+(i?-balance:balance),waist=waists[i];return buildHalf({waist,...knotRoute(key,phase,materialLength-pathLength(waist))},i,materialLength,opening)});
 }
 const pose={step,phase,wrap,halves,a:halves[0].ribbon.map(v=>project(v.p)),b:halves[1].ribbon.map(v=>project(v.p))};
 if(poseCache.size>=4)poseCache.delete(poseCache.keys().next().value);poseCache.set(cacheKey,pose);return pose;
}
export function beltAnchor(width,height,vertical=36,size=14){return {x:width*.5,y:height*vertical/100,scale:width*size/100}}
export function project(p,view='front'){
 let [x,y,z]=p;if(view==='back'){x=-x;z=-z}else if(view==='side'){[x,z]=[x*.5+z*Math.sqrt(3)/2,-x*Math.sqrt(3)/2+z*.5]}
 return [x,y-z*.12];
}
export function beltBounds(pose,view='front'){
 const p=pose.halves.flatMap(h=>h.ribbon.flatMap(v=>[project(v.left,view),project(v.right,view)]));
 return {minX:Math.min(...p.map(p=>p[0])),maxX:Math.max(...p.map(p=>p[0])),minY:Math.min(...p.map(p=>p[1])),maxY:Math.max(...p.map(p=>p[1]))};
}
export function cinematicPlacement(w,h,pose){
 const start=demoPlacement(w,h,pose),zoom=ease(pose.phase-2);
 const target={x:w/2,y:h*.28,scale:Math.min((w-36)/2.4,h*.64/1.6)};
 return {x:start.x,y:start.y+(target.y-start.y)*zoom,scale:start.scale+(target.scale-start.scale)*zoom};
}
export function demoPlacement(w,h,pose){
 const b=beltBounds(pose),minY=-1.75,maxY=2.85,spanX=Math.max(2,b.maxX-b.minX);
 const scale=Math.min(w/(spanX+.5),h/(maxY-minY+.6));
 return {x:w/2,y:(h-(maxY-minY)*scale)/2-minY*scale,scale};
}
const layers=new WeakMap();
export function drawGhostBelt(ctx,anchor,pose,{mirror=true,opacity=.92,labels=true,view='front',bodyOcclusion=true}={}){
 if(!ctx.canvas.width||!ctx.canvas.height)return;
 const destination=ctx;let layer=layers.get(destination.canvas);if(!layer){layer=document.createElement('canvas');layers.set(destination.canvas,layer)}
 if(layer.width!==destination.canvas.width||layer.height!==destination.canvas.height){layer.width=destination.canvas.width;layer.height=destination.canvas.height}
 ctx=layer.getContext('2d');ctx.resetTransform();ctx.clearRect(0,0,layer.width,layer.height);ctx.setTransform(destination.getTransform());
 const sign=mirror?1:-1,pr=p=>project(p,view),depth=p=>view==='back'?-p[2]:view==='side'?-p[0]*Math.sqrt(3)/2+p[2]*.5:p[2];
 const faces=[];
 for(const half of pose.halves)for(let i=0;i<half.ribbon.length-1;i++){
  const a=half.ribbon[i],b=half.ribbon[i+1],p=lerp(a.p,b.p,.5),d=depth(p),x=pr(p)[0];
  // Waist/torso hides the rear cloth; never draw dotted strips through a body.
  if(bodyOcclusion&&Math.abs(x)<RX*SIZE-.005&&p[1]<2.45&&d<.02)continue;
  faces.push({a,b,d,tip:i>half.ribbon.length-5});
 }
 faces.sort((a,b)=>a.d-b.d);
 ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(anchor.scale*sign,anchor.scale);ctx.globalAlpha=1;
 for(const {a,b,tip}of faces){
  const overlap=mul(unit(sub(b.p,a.p)),.003),poly=[sub(a.left,overlap),add(b.left,overlap),add(b.right,overlap),sub(a.right,overlap)].map(pr),normal=a.normal;
  // The padded edge is a separate face; crossing strips retain their thickness.
  const lowA=mul(a.normal,-BELT_THICKNESS),lowB=mul(b.normal,-BELT_THICKNESS);
  ctx.fillStyle='#111416';
  for(const edge of ['left','right']){
   const side=[a[edge],b[edge],add(b[edge],lowB),add(a[edge],lowA)].map(pr);
   ctx.beginPath();side.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();
  }
  const light=.38+.4*Math.abs(depth(normal))+.22*Math.max(0,-normal[1]),shade=Math.round(18+light*30);
  ctx.fillStyle=tip?(a.key==='a'?'#718e9b':'#aa936b'):`rgb(${shade},${shade+2},${shade+3})`;
  ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();
  // Overdraw shared edges in the same tone to avoid seams between mesh faces.
  ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.002;ctx.stroke();
  ctx.strokeStyle='#adb1b160';ctx.lineWidth=.004;
  for(const side of ['left','right']){ctx.beginPath();ctx.moveTo(...pr(a[side]));ctx.lineTo(...pr(b[side]));ctx.stroke()}
  ctx.strokeStyle='#8e96964a';ctx.lineWidth=.0013;
  for(const t of [.16,.32,.5,.68,.84]){ctx.beginPath();ctx.moveTo(...pr(lerp(a.left,a.right,t)));ctx.lineTo(...pr(lerp(b.left,b.right,t)));ctx.stroke()}
 }
 ctx.restore();
 if(labels)for(const half of pose.halves){
  const end=half.ribbon.at(-1),p=pr(end.p);if(bodyOcclusion&&Math.abs(p[0])<RX*SIZE&&end.p[1]<2.45&&depth(end.p)<.02)continue;
  const x=anchor.x+p[0]*anchor.scale*sign,y=anchor.y+p[1]*anchor.scale,color=end.key==='a'?'#a7dcef':'#ebcb93';
  ctx.save();ctx.beginPath();ctx.arc(x,y,11,0,TAU);ctx.fillStyle='#20313b';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.stroke();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 11px sans-serif';ctx.fillText(end.key.toUpperCase(),x,y);ctx.restore();
 }
 // Composite the opaque cloth once; overlapping mesh faces must not create
 // repeated alpha bands that make a flat belt look corrugated.
 destination.save();destination.resetTransform();destination.globalAlpha=opacity;destination.drawImage(layer,0,0);destination.restore();
}
