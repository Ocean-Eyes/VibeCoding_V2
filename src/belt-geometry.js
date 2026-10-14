export const BELT_SOURCE='https://www.youtube.com/watch?v=poG-fDcqUA0';
export const BELT_REFERENCE_2='https://www.youtube.com/watch?v=IG5WBxopLJw';
// Authored from the supplied videos. A is the end threaded first; the second
// video's demonstrator uses the opposite hand, but the insertion order agrees.
export const BELT_STEPS=[
 {title:'가운데를 허리 앞에',cue:'띠 가운데를 허리 앞에 대고 양끝을 같은 길이로 늘어뜨립니다.',focus:'띠를 비틀지 않고 넓은 면이 몸에 닿게 놓습니다.',move:'양끝 준비',reference:[5,0]},
 {title:'뒤에서 교차해 앞으로',cue:'양끝을 등 뒤에서 교차해 앞으로 가져옵니다. 두 겹을 포개 허리에 밀착시킵니다.',focus:'뒤쪽 보기에서 교차와 겹침을 확인하세요.',move:'A · B 함께 이동',reference:[6.5,5.5]},
 {title:'양끝 길이 맞추기',cue:'앞으로 나온 양끝을 들어 끝 위치를 맞춥니다. 긴 쪽을 조정해 길이를 같게 합니다.',focus:'매듭을 만들기 전에 양끝 길이를 확인합니다.',move:'A · B 길이 확인',reference:[8.5,11]},
 {title:'A를 두 겹 밑으로',cue:'A를 교차한 띠와 허리에 감긴 두 겹 모두의 밑에서 위로 통과시킨 뒤 아래로 내립니다.',focus:'A가 두 겹을 함께 감쌉니다. 끝을 계속 위로 세워 두지 않습니다.',move:'A 통과 · B 유지',reference:[11,15]},
 {title:'A를 끼워 고리 만들기',cue:'A를 다시 들어 반대편 허리띠의 겹 사이에 위에서 아래로 끼웁니다. 앞에는 고리를 남겨 둡니다.',focus:'이 단계에서는 A만 고리를 만듭니다. B는 아직 통과시키지 않습니다.',move:'A로 고리 · B 유지',reference:[13.5,20.5]},
 {title:'B를 고리에 통과',cue:'남겨 둔 A의 고리와 띠 겹 사이의 통로로 B를 통과시킵니다. 고리를 놓치지 않고 양끝을 잡습니다.',focus:'새 고리를 두 개 만들지 않고, B 끝이 A의 고리를 지나갑니다.',move:'B 통과 · A 유지',reference:[15,24]},
 {title:'양끝 당겨 매듭 정리',cue:'양끝을 좌우로 당겨 고리를 줄이고 매듭을 납작하게 정리합니다. 끝은 아래로 향하게 둡니다.',focus:'허리의 두 겹과 매듭이 꼬이지 않았는지 확인합니다.',move:'A · B 조이기',reference:[16.5,26]},
];
// A single inextensible, stiff obi. Coordinates are in waist-width units.
// The waist contact arc consumes material; only the remaining length is free.
// Knot guides are folds in 3D, not independent 2D drawings morphed into loops.
export const BELT_WIDTH=.105, BELT_LENGTH=8.2;
const RX=.46,RZ=.24,TAU=Math.PI*2;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a),unit=a=>mul(a,1/(norm(a)||1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export const pathLength=points=>points.slice(1).reduce((s,p,i)=>s+norm(sub(p,points[i])),0);
// Local route after one full wrap: thread A beneath both standing layers,
// return A downward, tuck A between the layers, then thread B through its loop.
// Reference 1: 8.5s ends aligned, 12s A returned downward, 14s A tucked
// between the waist layers with a loop left open, 15s B entering that loop.
const guides={
 a:[
 [[0,0,.30],[.13,.08,.36],[.20,.16,.38],[.16,-.08,.40]],
 [[0,0,.30],[.04,.07,.34],[.03,.08,.266],[.02,-.07,.266],[-.06,-.08,.34],[-.12,.10,.38]],
 [[0,0,.30],[.04,.07,.34],[.03,.08,.266],[.02,-.07,.266],[-.06,-.08,.34],[-.18,.01,.45],[-.05,.16,.50],[.13,.09,.44],[.16,-.04,.282],[.16,.08,.282],[.17,.11,.38]],
 [[0,0,.30],[.04,.07,.34],[.03,.08,.266],[.02,-.07,.266],[-.06,-.08,.34],[-.18,.01,.45],[-.05,.16,.50],[.13,.09,.44],[.16,-.04,.282],[.16,.08,.282],[.17,.11,.38]],
 [[0,0,.30],[.04,.08,.38],[.03,.09,.266],[.02,-.08,.266],[-.06,-.09,.37],[-.14,.04,.45],[-.04,.13,.48],[.09,.07,.44],[.12,-.03,.282],[.12,.08,.282],[.15,.13,.42]],
 ],
 b:[
 [[0,0,.29],[-.13,.08,.35],[-.20,.16,.37],[-.16,-.08,.39]],
 [[0,0,.29],[.13,.06,.35],[.28,.18,.36]],
 [[0,0,.29],[.13,.06,.35],[.28,.18,.36]],
 [[0,0,.29],[.12,.08,.36],[.20,-.08,.40],[.05,.03,.45],[-.04,.10,.53],[-.17,.16,.60]],
 [[0,0,.29],[.08,.05,.36],[.11,-.05,.40],[.01,.01,.44],[-.04,.09,.51],[-.14,.13,.54]],
 ]
};
const directions={a:[[-.30,-1,0],[-.08,1,0],[.90,.18,0],[.90,.18,0],[.42,.91,0]],b:[[.30,-1,0],[.48,1,0],[.48,1,0],[-.9,.18,0],[-.42,.91,0]]};
// Short, bounded bend radius at folds; long spans remain straight.
function folded(points,radius=.025){
 const out=[points[0]];
 for(let i=1;i<points.length-1;i++){
  const p=points[i],before=sub(points[i-1],p),after=sub(points[i+1],p),r=Math.min(radius,norm(before)*.22,norm(after)*.22);
  const a=add(p,mul(unit(before),r)),b=add(p,mul(unit(after),r));out.push(a);
  for(let n=1;n<=4;n++){const t=n/4;out.push(add(add(mul(a,(1-t)**2),mul(p,2*t*(1-t))),mul(b,t*t)))}
 }
 out.push(points.at(-1));return out;
}
function resample(points,count){
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+norm(sub(points[i],points[i-1])));
 const total=lengths.at(-1);let j=1;
 return Array.from({length:count},(_,i)=>{const s=total*i/(count-1);while(j<lengths.length-1&&lengths[j]<s)j++;return lerp(points[j-1],points[j],(s-lengths[j-1])/(lengths[j]-lengths[j-1]||1))});
}
function knotRoute(key,phase){
 const v=Math.max(0,Math.min(4,phase-2)),index=Math.floor(v),t=ease(v-index),next=Math.min(4,index+1);
 const a=resample(guides[key][index],48),b=resample(guides[key][next],48);
 return {points:a.map((p,i)=>lerp(p,b[i],t)),direction:unit(lerp(directions[key][index],directions[key][next],t))};
}
function halfRoute(key,phase){
 const side=key==='a'?-1:1,wrap=phase<1?.25+.75*phase:1;
 const angle=TAU*wrap;
 const waist=Array.from({length:Math.max(2,Math.ceil(angle*40))},(_,i)=>{
  const t=angle*i/(Math.max(2,Math.ceil(angle*40))-1),layer=(key==='a'?.027:.012)*t/TAU;
  return [side*(RX+layer)*Math.sin(t),side*.008*t/TAU,(RZ+layer)*Math.cos(t)];
 });
 const end=waist.at(-1);let local,direction;
 if(phase<1){
  const outward=side*Math.sin(angle);
  const hanging=[end,add(end,[outward*.06,.055,.07]),add(end,[outward*.10,.18,.10])];
  // Once the ends have returned around the hips, bring them to the front.
  const t=ease(phase),target={points:resample([[0,0,key==='a'?.30:.29],[side*-.12,.06,.35],[side*-.22,.18,.36]],48),direction:unit([side*-.18,1,0])};
  const a=resample(hanging,48),delta=sub(end,target.points[0]);
  local=a.map((p,i)=>lerp(p,add(target.points[i],delta),t));direction=unit(lerp(unit([outward*.55,1,0]),target.direction,t));
 }else{const route=knotRoute(key,Math.max(2,phase));if(phase<2){const rest=[[0,0,key==='a'?.30:.29],[side*-.12,.06,.35],[side*-.22,.18,.36]],t=ease(phase-1);route.points=resample(rest,48).map((p,i)=>lerp(p,route.points[i],t));route.direction=unit(lerp([side*-.18,1,0],route.direction,t))}const delta=sub(end,route.points[0]);local=route.points.map(p=>add(p,delta));direction=route.direction}
 return {waist,local:folded(local),direction,wrap};
}
function makeRibbon(points,key,waistLength){
 let across=[0,1,0];
 return points.map((p,i)=>{
  const tangent=unit(sub(points[Math.min(points.length-1,i+1)],points[Math.max(0,i-1)]));
  across=unit(sub(across,mul(tangent,dot(across,tangent))));
  if(norm(across)<.5)across=unit(cross([0,0,1],tangent));
  // Face the camera only after leaving the waist, via a gradual cloth roll.
  const material=i/(points.length-1)*points.materialLength;
  if(material>waistLength+.08){let front=unit(cross([0,0,1],tangent));if(dot(front,across)<0)front=mul(front,-1);across=unit(lerp(across,front,.16))}
  return {p,left:add(p,mul(across,BELT_WIDTH/2)),right:add(p,mul(across,-BELT_WIDTH/2)),normal:unit(cross(tangent,across)),s:material,key};
 });
}
const poseCache=new Map();
export function beltPose(step,progress=1){
 step=Math.max(0,Math.min(6,Math.floor(step)));const phase=Math.max(0,step-1)+ (step?ease(progress):0);
 const cacheKey=`${step}/${phase}`;if(poseCache.has(cacheKey))return poseCache.get(cacheKey);
 const routes=['a','b'].map(key=>halfRoute(key,phase));
 const bases=routes.map(r=>[...r.waist,...r.local.slice(1)]),lengths=bases.map(pathLength);
 // Pulling the two ends adjusts the midpoint inside the wrap; total material
 // stays fixed while free ends become equal as the final interlocking knot tightens.
 const balance=ease(Math.max(0,Math.min(1,phase-5)))*(lengths[0]-lengths[1])/2;
 const halves=bases.map((base,i)=>{
  const materialLength=BELT_LENGTH/2+(i?-balance:balance),remaining=materialLength-lengths[i];
  if(remaining<=0)throw new Error('Belt route exceeds available cloth');
  const path=[...base,add(base.at(-1),mul(routes[i].direction,remaining))];
  const points=resample(path,360);points.materialLength=materialLength;
  return {path,materialLength,freeLength:remaining,ribbon:makeRibbon(points,i?'b':'a',pathLength(routes[i].waist))};
 });
 const pose={step,phase,wrap:routes[0].wrap,halves,a:halves[0].ribbon.map(v=>project(v.p)),b:halves[1].ribbon.map(v=>project(v.p))};
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
 const start=demoPlacement(w,h,pose),b=beltBounds(pose),zoom=ease(pose.phase-2);
 const target={x:w/2,y:h*.36,scale:Math.min((w-36)/(2*Math.max(.95,Math.abs(b.minX),Math.abs(b.maxX))),h*.55/Math.max(.8,b.maxY),h*.32/Math.max(.1,-b.minY))};
 return {x:start.x,y:start.y+(target.y-start.y)*zoom,scale:start.scale+(target.scale-start.scale)*zoom};
}
export function demoPlacement(w,h,pose){
 const b=beltBounds(pose),minY=Math.min(-1.75,b.minY),maxY=Math.max(.45,b.maxY),spanX=Math.max(1.9,b.maxX-b.minX);
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
  if(bodyOcclusion&&Math.abs(x)<RX-.005&&p[1]<.42&&d<.02)continue;
  faces.push({a,b,d,tip:i>half.ribbon.length-12});
 }
 faces.sort((a,b)=>a.d-b.d);
 ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(anchor.scale*sign,anchor.scale);ctx.globalAlpha=1;
 for(const {a,b,tip}of faces){
  const overlap=mul(unit(sub(b.p,a.p)),.003),poly=[sub(a.left,overlap),add(b.left,overlap),add(b.right,overlap),sub(a.right,overlap)].map(pr),normal=a.normal,light=.55+.45*Math.abs(depth(normal));
  const shade=Math.round(173+light*65);ctx.fillStyle=tip?(a.key==='a'?'#91bbcc':'#c8ac78'):`rgb(${shade+5},${shade+3},${shade-5})`;
  ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();
  // Overdraw shared edges in the same tone to avoid seams between mesh faces.
  ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.002;ctx.stroke();
  ctx.strokeStyle='#59554780';ctx.lineWidth=.0025;
  for(const side of ['left','right']){ctx.beginPath();ctx.moveTo(...pr(a[side]));ctx.lineTo(...pr(b[side]));ctx.stroke()}
  ctx.strokeStyle='#a69e8880';ctx.lineWidth=.0013;
  for(const t of [.16,.32,.5,.68,.84]){ctx.beginPath();ctx.moveTo(...pr(lerp(a.left,a.right,t)));ctx.lineTo(...pr(lerp(b.left,b.right,t)));ctx.stroke()}
 }
 ctx.restore();
 if(labels)for(const half of pose.halves){
  const end=half.ribbon.at(-1),p=pr(end.p);if(bodyOcclusion&&Math.abs(p[0])<RX&&end.p[1]<.42&&depth(end.p)<.02)continue;
  const x=anchor.x+p[0]*anchor.scale*sign,y=anchor.y+p[1]*anchor.scale,color=end.key==='a'?'#a7dcef':'#ebcb93';
  ctx.save();ctx.beginPath();ctx.arc(x,y,11,0,TAU);ctx.fillStyle='#20313b';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.stroke();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 11px sans-serif';ctx.fillText(end.key.toUpperCase(),x,y);ctx.restore();
 }
 // Composite the opaque cloth once; overlapping mesh faces must not create
 // repeated alpha bands that make a flat belt look corrugated.
 destination.save();destination.resetTransform();destination.globalAlpha=opacity;destination.drawImage(layer,0,0);destination.restore();
}
