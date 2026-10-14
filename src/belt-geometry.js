export const BELT_SOURCE='https://www.youtube.com/watch?v=F-NJFRGi6ys';
export const BELT_REFERENCE_2='https://www.youtube.com/watch?v=IG5WBxopLJw';
// Authored from the supplied videos. A is the end threaded first; the second
// video's demonstrator uses the opposite hand, but the insertion order agrees.
export const BELT_STEPS=[
 {title:'가운데를 허리 앞에',cue:'띠 가운데를 허리 앞에 대고 양끝을 손에 듭니다. 아래로 접힌 띠를 등 뒤로 감습니다.',focus:'띠를 비틀지 않고 넓은 면이 몸에 닿게 놓습니다.',move:'양끝 준비',reference:[2,0]},
 {title:'등 뒤로 감아 교차',cue:'가운데를 허리 앞에 댄 채 양끝을 뒤로 보내 교차합니다.',focus:'뒤쪽 보기에서 등 뒤의 두 겹을 확인하세요.',move:'양끝을 등 뒤로',reference:[3.2,5.5]},
 {title:'앞으로 가져와 교차',cue:'뒤에서 교차한 양끝을 앞으로 가져옵니다. A를 B 위에 겹칩니다.',focus:'양끝을 위로 들어 올리지 않고 허리 앞에서 교차합니다.',move:'허리 앞에서 A를 B 위로',reference:[5.4,12.5]},
 {title:'A를 두 겹 밑으로',cue:'A를 교차한 띠와 허리에 감긴 두 겹 모두의 밑에서 위로 통과시킨 뒤 아래로 내립니다.',focus:'A가 두 겹을 함께 감쌉니다. 끝을 계속 위로 세워 두지 않습니다.',move:'A 통과 · B 유지',reference:[9.6,15]},
 {title:'A를 끼워 고리 만들기',cue:'A를 다시 들어 반대편 허리띠의 겹 사이에 위에서 아래로 끼웁니다. 앞에는 고리를 남겨 둡니다.',focus:'이 단계에서는 A만 고리를 만듭니다. B는 아직 통과시키지 않습니다.',move:'A로 고리 · B 유지',reference:[14,20.5]},
 {title:'B를 겹 사이와 고리에 통과',cue:'B를 오른쪽 허리띠 겹 사이에 위에서 아래로 넣고, 앞에 남긴 A 고리 안으로 빼냅니다.',focus:'B는 먼저 허리띠 겹 사이를 내려온 뒤 A의 고리를 통과합니다.',move:'B는 겹 사이 → A 고리',reference:[17,24]},
 {title:'양끝 당겨 매듭 정리',cue:'양끝을 좌우로 당겨 고리를 줄이고 매듭을 납작하게 정리합니다. 끝은 아래로 향하게 둡니다.',focus:'허리의 두 겹과 매듭이 꼬이지 않았는지 확인합니다.',move:'A · B 조이기',reference:[19.3,26]},
];
// A single inextensible, stiff obi. Coordinates are in waist-width units.
// The waist contact arc consumes material; only the remaining length is free.
// Insertion routes distinguish the approaching tip from cloth already fed through.
export const BELT_WIDTH=.075, BELT_LENGTH=6.4, BELT_THICKNESS=.008;
const RX=.405,RZ=.18,TAU=Math.PI*2;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a),unit=a=>mul(a,1/(norm(a)||1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export const pathLength=points=>points.slice(1).reduce((s,p,i)=>s+norm(sub(p,points[i])),0);
// Threading is tip-led: lift the tip to the entry, feed it through the
// opening, then draw the remaining slack through. The idle end stays fixed.
// Front-to-back order: body .18, underpass .19, inner wrap .202,
// layer passage .214, outer wrap .226. Each insertion has real clearance.
export const BELT_LAYERS={body:.18,under:.19,inner:.202,gap:.214,outer:.226};
const ROOT={a:[0,-.008,.226],b:[0,.008,.202]};
const CROSS={a:[ROOT.a,[.085,.025,.255]],b:[ROOT.b,[-.085,.025,.248]]};
const FIRST=[...CROSS.a,[.025,.06,.19],[.025,-.06,.19],[.075,-.06,.255],[.095,.005,.27]];
// A returns on the right, crosses in front to the LEFT layer passage and
// leaves a U-shaped opening in front of the waist. B is held on the left.
const LOOP=[...FIRST,[.015,.11,.31],[-.115,-.06,.214],[-.115,.06,.214],[-.13,.09,.275]];
// Crucial order from F-NJFRGi6ys 16–18s: B goes DOWN the right layer gap,
// then FORWARD through the opening left by A. It never enters A first.
const DOWN={a:unit([.12,1,0]),b:unit([-.12,1,0])};
const FIRST_DOWN=unit([.12,1,0]),LOOP_DOWN=unit([-.24,1,0]),SECOND_DOWN=unit([.8,.6,0]);
function resample(points,count){
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+norm(sub(points[i],points[i-1])));
 const total=lengths.at(-1);let j=1;
 return Array.from({length:count},(_,i)=>{const s=total*i/(count-1);while(j<lengths.length-1&&lengths[j]<s)j++;return lerp(points[j-1],points[j],(s-lengths[j-1])/(lengths[j]-lengths[j-1]||1))});
}
// A stiff strip folds into two straight legs joined by one rounded turn.
// For a small opening the turn flattens to an ellipse; it never becomes a V.
function bight(start,end,length,outward){
 const chord=sub(end,start),d=norm(chord),axis=unit(chord),center=lerp(start,end,.5);
 if(d>length+1e-7)throw new Error('Thread target exceeds available material');
 let bend=sub(outward,mul(axis,dot(outward,axis)));if(norm(bend)<1e-8)bend=[1,0,0];bend=unit(bend);
 const radius=d/2;
 function route(height){
  const leg=Math.max(0,height-radius),turn=Math.min(height,radius),points=[start];
  for(let i=0;i<=24;i++){const angle=Math.PI*i/24;points.push(add(add(center,mul(axis,-radius*Math.cos(angle))),mul(bend,leg+turn*Math.sin(angle))))}
  points.push(end);return points;
 }
 let low=0,high=length,points;
 for(let n=0;n<34;n++){const height=(low+high)/2;points=route(height);if(pathLength(points)<length)low=height;else high=height}
 return points;
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
function insert(prefix,passage,directionBefore,directionAfter,available,t,{slack=0,outward=[0,1,1]}={}){
 const start=prefix.at(-1),entry=passage[0],pLength=pathLength(prefix),remaining=available-pLength;
 const before=add(start,mul(directionBefore,remaining));
 if(t<=.3){
  // The tip arrives at the opening before any of the cloth is threaded.
  const u=ease(t/.3),control=add(start,[Math.sign(entry[0]-start[0])*.4,.4,.15]);
  const tip=add(add(mul(before,(1-u)**2),mul(control,2*u*(1-u))),mul(entry,u*u));
  return {local:[...prefix,...bight(start,tip,remaining,outward).slice(1)],freeLength:0,operation:'approach'};
 }
 const routeLength=pathLength(passage),approach=norm(sub(entry,start))+slack;
 const after=remaining-approach-routeLength;
 if(after<=0)throw new Error('Insufficient cloth after insertion');
 const fed=ease((t-.3)/.7)*(routeLength+after);
 const pending=remaining-fed;
 const incoming=bight(start,entry,pending,outward);
 if(fed<routeLength){
  return {local:[...prefix,...incoming.slice(1),...sliceAtDistance(passage,fed).slice(1)],freeLength:0,operation:'tip-through'};
 }
 const exit=passage.at(-1),tail=fed-routeLength;
 return {local:[...prefix,...incoming.slice(1),...passage.slice(1),add(exit,mul(directionAfter,tail))],freeLength:tail,operation:'draw-through'};
}
function waistPath(key,wrap){
 const side=key==='a'?-1:1,angle=TAU*wrap,n=Math.max(2,Math.ceil(angle*40));
 return Array.from({length:n},(_,i)=>{const t=angle*i/(n-1),layer=(key==='a'?.046:.022)*t/TAU;return [side*(RX+layer)*Math.sin(t),side*.008*t/TAU,(RZ+layer)*Math.cos(t)]});
}
function wrapRoute(key,phase){
 const side=key==='a'?-1:1,wrap=.25+.75*Math.min(1,phase/2),waist=waistPath(key,wrap),end=waist.at(-1);
 const remaining=BELT_LENGTH/2-pathLength(waist),t=ease(Math.max(0,phase-1));
 const rest=[end,add(end,[side*Math.sin(TAU*wrap)*.03,.07,.04])];
 const cross=CROSS[key].map(p=>add(p,sub(end,ROOT[key])));
 const local=rest.map((p,i)=>lerp(p,cross[i],t));
 const direction=unit(lerp(unit([side*Math.sin(TAU*wrap)*.18,1,0]),DOWN[key],t));
 if(phase<1){
  // Hold the tips by the hands before wrapping. The unused material hangs in
  // one stiff U fold on each side, instead of extending below the feet.
  const hanging=add(local.at(-1),mul(direction,remaining-pathLength(local)));
  const held=[side*.64,.08,.06],tip=lerp(held,hanging,ease(phase));
  const folded=bight(local.at(-1),tip,remaining-pathLength(local),[side*.06,1,.08]);
  return {waist,local:[...local,...folded.slice(1)],freeLength:0,wrap,operation:'wrap-back'};
 }
 return {waist,...finish(local,direction,remaining),wrap,operation:'return-front'};
}
const A_PASS=FIRST.slice(CROSS.a.length),A_LOOP=LOOP.slice(FIRST.length+1);
const LOOP_SLACK=pathLength([FIRST.at(-1),LOOP[FIRST.length],A_LOOP[0]])-norm(sub(A_LOOP[0],FIRST.at(-1)));
const LOOP_CURVE=bight(FIRST.at(-1),A_LOOP[0],norm(sub(A_LOOP[0],FIRST.at(-1)))+LOOP_SLACK,[0,1,1]);
const A_LOOP_HELD=[...FIRST,...LOOP_CURVE.slice(1),...A_LOOP.slice(1)];
const bridge=lerp(LOOP_CURVE[0],LOOP_CURVE.at(-1),.5),chord=unit(sub(LOOP_CURVE.at(-1),LOOP_CURVE[0]));
const farthest=LOOP_CURVE.reduce((best,p)=>norm(cross(sub(p,bridge),chord))>norm(cross(sub(best,bridge),chord))?p:best,bridge);
const openingCenter=lerp(bridge,farthest,.5);
let openingNormal=unit(cross(chord,sub(farthest,bridge)));if(openingNormal[2]<0)openingNormal=mul(openingNormal,-1);
export const BELT_LOOP_OPENING={boundary:LOOP_CURVE,center:openingCenter,normal:openingNormal};
const B_GAP=[[.085,-.06,.214],[.085,.06,.214]];
const B_BEHIND=add(openingCenter,mul(openingNormal,-.045)),B_FRONT=add(openingCenter,mul(openingNormal,.06));
const SECOND=[...CROSS.b,...B_GAP,B_BEHIND,B_FRONT,add(B_FRONT,[.04,.02,.01])];
const B_PASS=SECOND.slice(CROSS.b.length);
function compact(points,key){return points.map((p,i)=>i===0?p:[p[0]*.94,p[1]*.94,.214+(p[2]-.214)*.94])}
const FINAL={a:compact(A_LOOP_HELD,'a'),b:compact(SECOND,'b')};
function knotRoute(key,phase,length){
 if(key==='a'){
  if(phase<3)return insert(CROSS.a,A_PASS,DOWN.a,FIRST_DOWN,length,phase-2);
  if(phase<4)return insert(FIRST,A_LOOP,FIRST_DOWN,LOOP_DOWN,length,phase-3,{slack:LOOP_SLACK});
  if(phase<=5)return {...finish(A_LOOP_HELD,LOOP_DOWN,length),operation:'hold-loop'};
 }else{
  if(phase<=4)return {...finish(CROSS.b,DOWN.b,length),operation:'hold-end'};
  if(phase<5)return insert(CROSS.b,B_PASS,DOWN.b,SECOND_DOWN,length,phase-4,{outward:[0,1,1]});
 }
 const a=key==='a'?A_LOOP_HELD:SECOND,b=FINAL[key],t=ease(phase-5);
 const sign=key==='a'?-1:1,held=key==='a'?LOOP_DOWN:SECOND_DOWN,out=unit([sign,.24,0]),rest=unit([sign*.24,1,0]);
 const direction=t<.55?unit(lerp(held,out,ease(t/.55))):unit(lerp(out,rest,ease((t-.55)/.45)));
 return {...finish(a.map((p,i)=>lerp(p,b[i],t)),direction,length),operation:'tighten'};
}
function makeRibbon(points,key,waistLength,operation){
 let across=[0,1,0];
 return points.map((p,i)=>{
  const tangent=unit(sub(points[Math.min(points.length-1,i+1)],points[Math.max(0,i-1)]));
  across=unit(sub(across,mul(tangent,dot(across,tangent))));
  if(norm(across)<.5)across=unit(cross([0,0,1],tangent));
  // Face the camera only after leaving the waist, via a gradual cloth roll.
  const material=i/(points.length-1)*points.materialLength;
  if(material>waistLength+.08){let front=unit(cross([0,0,1],tangent));if(dot(front,across)<0)front=mul(front,-1);across=unit(lerp(across,front,.16))}
  if(key==='b'&&['tip-through','draw-through','tighten'].includes(operation)&&material>waistLength+.2){
   const proximity=norm(sub(p,openingCenter));
   if(proximity<.14&&Math.abs(dot(tangent,openingNormal))>.65){
    let alignment=unit(sub(chord,mul(tangent,dot(chord,tangent))));if(dot(alignment,across)<0)alignment=mul(alignment,-1);
    across=unit(lerp(across,alignment,ease((.14-proximity)/.065)));
   }
  }
  return {p,left:add(p,mul(across,BELT_WIDTH/2)),right:add(p,mul(across,-BELT_WIDTH/2)),normal:unit(cross(tangent,across)),s:material,key};
 });
}
function buildHalf(route,i,materialLength){
 const path=[...route.waist,...route.local.slice(1)],points=resample(path,480);points.materialLength=materialLength;
 return {path,materialLength,waistLength:pathLength(route.waist),freeLength:route.freeLength,operation:route.operation,ribbon:makeRibbon(points,i?'b':'a',pathLength(route.waist),route.operation)};
}
const poseCache=new Map();
export function beltPose(step,progress=1){
 step=Math.max(0,Math.min(6,Math.floor(step)));const phase=Math.max(0,step-1)+ (step?ease(progress):0);
 const cacheKey=`${step}/${phase}`;if(poseCache.has(cacheKey))return poseCache.get(cacheKey);
 let halves,wrap;
 if(phase<2){
  const routes=['a','b'].map(key=>wrapRoute(key,phase));wrap=routes[0].wrap;
  halves=routes.map((r,i)=>buildHalf(r,i,BELT_LENGTH/2));
 }else{
  const waists=['a','b'].map(key=>waistPath(key,1));wrap=1;
  const firstBalance=(pathLength(FIRST)-pathLength(CROSS.b)+pathLength(waists[0])-pathLength(waists[1]))/2;
  const finalBalance=(pathLength(FINAL.a)-pathLength(FINAL.b)+pathLength(waists[0])-pathLength(waists[1]))/2;
  const balance=ease(phase-2)*firstBalance+ease(phase-5)*(finalBalance-firstBalance);
  halves=['a','b'].map((key,i)=>{const materialLength=BELT_LENGTH/2+(i?-balance:balance),waist=waists[i];return buildHalf({waist,...knotRoute(key,phase,materialLength-pathLength(waist))},i,materialLength)});
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
 const b=beltBounds(pose),minY=-1.75,maxY=2.65,spanX=Math.max(2,b.maxX-b.minX);
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
  if(bodyOcclusion&&Math.abs(x)<RX-.005&&p[1]<2.45&&d<.02)continue;
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
  ctx.strokeStyle='#9aa0a05c';ctx.lineWidth=.0025;
  for(const side of ['left','right']){ctx.beginPath();ctx.moveTo(...pr(a[side]));ctx.lineTo(...pr(b[side]));ctx.stroke()}
  ctx.strokeStyle='#8e96964a';ctx.lineWidth=.0013;
  for(const t of [.16,.32,.5,.68,.84]){ctx.beginPath();ctx.moveTo(...pr(lerp(a.left,a.right,t)));ctx.lineTo(...pr(lerp(b.left,b.right,t)));ctx.stroke()}
 }
 ctx.restore();
 if(labels)for(const half of pose.halves){
  const end=half.ribbon.at(-1),p=pr(end.p);if(bodyOcclusion&&Math.abs(p[0])<RX&&end.p[1]<2.45&&depth(end.p)<.02)continue;
  const x=anchor.x+p[0]*anchor.scale*sign,y=anchor.y+p[1]*anchor.scale,color=end.key==='a'?'#a7dcef':'#ebcb93';
  ctx.save();ctx.beginPath();ctx.arc(x,y,11,0,TAU);ctx.fillStyle='#20313b';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.stroke();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 11px sans-serif';ctx.fillText(end.key.toUpperCase(),x,y);ctx.restore();
 }
 // Composite the opaque cloth once; overlapping mesh faces must not create
 // repeated alpha bands that make a flat belt look corrugated.
 destination.save();destination.resetTransform();destination.globalAlpha=opacity;destination.drawImage(layer,0,0);destination.restore();
}
