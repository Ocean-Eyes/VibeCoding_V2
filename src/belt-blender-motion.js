// Material-space playback of the Blender-authored belt. No image tracing or
// per-panel painter order: both crossing regions use the actual surface depth.
import {BLENDER_BELT as data} from './belt-blender-data.js';
import {foldMaterialStrip} from './belt-material-folds.js';
import {FINAL_PULL_FOLDS,FINAL_PULL_CENTER_X} from './belt-final-pull.js';
import {buildWaistAdapter,planStandingLead,fitStandingLead,fitWaistWrap,standingField,waistTakeupProfile} from './belt-waist-settle.js';
const DISPLAY_WIDTH=.078,DISPLAY_THICKNESS=.006;
let pullStartReach;
const mix=(a,b,q)=>a+(b-a)*q, lerp=(a,b,q)=>a.map((v,i)=>mix(v,b[i],q));
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a);return a.map(v=>v/l)};
function basisBetween(a,b,q){
  // Polar interpolation of these nearby root frames preserves width and reach.
  const x=unit(lerp(a[0],b[0],q)),raw=lerp(a[1],b[1],q),d=dot(raw,x);
  const y=unit(raw.map((v,i)=>v-d*x[i]));return [x,y,cross(x,y)];
}
function optionsBetween(a,b,q){
  const creases=Array.from({length:Math.max(a.creases.length,b.creases.length)},(_,i)=>{
    const first=a.creases[i]??{...b.creases[i],angle:0},last=b.creases[i]??{...a.creases[i],angle:0};
    return Object.fromEntries(['s','k','angle','radius'].map(k=>[k,mix(first[k]??first.at??0,last[k]??last.at??0,q)]));
  });
  return {...a,origin:lerp(a.origin,b.origin,q),basis:basisBetween(a.basis,b.basis,q),creases};
}
export function blenderPose(time){
  const keys=data.keys,t=Math.max(keys[0].t,Math.min(keys.at(-1).t,time));
  let hi=keys.findIndex(k=>k.t>=t);if(hi<=0)hi=1;
  const a=keys[hi-1],b=keys[hi],q=(t-a.t)/(b.t-a.t);
  const pose={t};for(const name of ['A','B','adapterA','adapterB'])pose[name]=optionsBetween(a[name],b[name],q);
  for(const k of ['thetaA','thetaB'])pose[k]=mix(a[k],b[k],q);
  pose.waist={tiltDegrees:0,dropM:mix(a.waist.dropM,b.waist.dropM,q)};return pose;
}
function foldPart(name,options,reverse=false){
  const longitudinalCuts=['A','B'].includes(name)?Array.from({length:Math.floor(options.length/.02)},(_,i)=>(i+1)*.02):[];
  if(options.pullTension>0){
    const extent=c=>Math.abs(c.k)*DISPLAY_WIDTH/2+Math.abs(c.angle)*c.radius/2*Math.hypot(1,c.k);
    const entry=options.creases[0].s-extent(options.creases[0]),exit=options.creases[1].s+extent(options.creases[1]);
    const ranges=[[exit,exit+.04],[exit+.24,exit+.26]];
    if(name==='A')ranges.push([entry-.10,entry]);
    // Resolve the contact bends in the rendered surface as well as the arc
    // length sampler; coarse triangles otherwise shortcut the tightened curve.
    for(const [a,b] of ranges)for(let s=a;s<=b+1e-9;s+=.002)if(s>0&&s<options.length)longitudinalCuts.push(s);
  }
  longitudinalCuts.sort((a,b)=>a-b);
  const strip=foldMaterialStrip(name,{...options,width:DISPLAY_WIDTH,thickness:DISPLAY_THICKNESS,across:4,step:.02,longitudinalCuts});
  // Preparation bends the initially straight ends. Keep longitudinal rows in
  // that reference surface so a long triangle cannot shortcut a gravity bend.
  if(options.creases.every(c=>Math.abs(c.angle)<1e-12)){
    const rows=Math.ceil(options.length/.02)+1,positions=[],normals=[];
    for(let row=0;row<rows;row++)for(let column=0;column<5;column++){
      const p=strip.sampleMaterialPoint(options.length*row/(rows-1),DISPLAY_WIDTH*(column/4-.5));positions.push(p.center);normals.push(p.normal);
    }
    const part=gridPart(name,options.length,rows,positions,normals);
    if(reverse)part.uv=part.uv.map(([s,v])=>[options.length-s,-v]);
    return {...part,strip};
  }
  const n=strip.vertices3D.length/2,positions=[],normals=[],uv=[];
  for(let i=0;i<n;i++){
    positions.push(lerp(strip.vertices3D[i],strip.vertices3D[i+n],.5));
    normals.push(unit(sub(strip.vertices3D[i+n],strip.vertices3D[i])));
    const v=strip.vertexMaterial[i];uv.push([reverse?strip.totalMaterialS-v.materialS:v.materialS,reverse?-v.v:v.v]);
  }
  const triangles=strip.triangles.filter(t=>t.every(i=>i>=n)).map(t=>t.map(i=>i-n));
  return {name,length:options.length,positions,normals,uv,triangles,strip};
}
function gridPart(name,length,rows,positions,normals){
  const uv=[],triangles=[];
  for(let i=0;i<rows;i++)for(let j=0;j<5;j++){
    uv.push([length*i/(rows-1),-DISPLAY_WIDTH/2+j*DISPLAY_WIDTH/4]);
    if(i&&j){const k=i*5+j;triangles.push([k-6,k-5,k],[k-6,k,k-1]);}
  }
  return {name,length,positions,normals,uv,triangles};
}
const fixed=data.standing.map(p=>{
  // The Blender export is denser than the screen can display. Keep complete
  // width rows and both seams while reducing only longitudinal sampling.
  const sourcePositions=Array.from({length:p.positions.length/3},(_,i)=>p.positions.slice(i*3,i*3+3));
  const sourceNormals=Array.from({length:p.normals.length/3},(_,i)=>p.normals.slice(i*3,i*3+3));
  const rowIds=[];for(let row=0;row<p.rows;row+=3)rowIds.push(row);if(rowIds.at(-1)!==p.rows-1)rowIds.push(p.rows-1);
  const positions=[],normals=[];for(const row of rowIds){
    const center=sourcePositions[row*5+2];
    for(let column=0;column<5;column++){
    positions.push(center.map((value,i)=>value+(sourcePositions[row*5+column][i]-value)*DISPLAY_WIDTH/data.width));normals.push(sourceNormals[row*5+column]);
    }
  }
  return gridPart(p.name,p.length,rowIds.length,positions,normals);
});
const takeupProfile=waistTakeupProfile(fixed);
function arcPart(name,start,end,drop){
  const rows=Math.max(2,Math.ceil(Math.abs(end-start)*.456/.004)),positions=[],normals=[],ss=[0];
  let last=null;
  for(let i=0;i<rows;i++){
    const th=mix(start,end,i/(rows-1)),p=[.456*Math.sin(th),.03-2*drop,-.225+.256*Math.cos(th)];
    if(last)ss.push(ss.at(-1)+Math.hypot(...sub(p,last)));last=p;
    const tangent=unit([-.456*Math.cos(th),0,.256*Math.sin(th)]),normal=cross([0,1,0],tangent);
    for(let j=0;j<5;j++){positions.push([p[0],p[1]-DISPLAY_WIDTH/2+j*DISPLAY_WIDTH/4,p[2]]);normals.push(normal);}
  }
  const part=gridPart(name,ss.at(-1),rows,positions,normals);
  for(let i=0;i<rows;i++)for(let j=0;j<5;j++)part.uv[i*5+j][0]=ss[i];return part;
}
export function assembleBelt(parts){
  const positions=[],normals=[],uv=[],triangles=[],lookup=new Map();let offset=0,maxJoin=0;
  for(const part of parts){
    const ids=part.positions.map((p,i)=>{
      const material=[part.uv[i][0]+offset,part.uv[i][1]],key=material.map(v=>v.toFixed(8)).join(':');
      if(lookup.has(key)){const id=lookup.get(key);maxJoin=Math.max(maxJoin,Math.hypot(...sub(p,positions[id])));return id;}
      const id=positions.length;lookup.set(key,id);positions.push(p);normals.push(part.normals[i]);uv.push(material);return id;
    });
    for(const face of part.triangles)triangles.push(face.map(i=>ids[i]));offset+=part.length;
  }
  const boundary=new Map();
  for(const f of triangles)for(let i=0;i<3;i++){
    const a=f[i],b=f[(i+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
    if(boundary.has(key))boundary.delete(key);else boundary.set(key,[a,b]);
  }
  const vertexData=new Float32Array((triangles.length*2+boundary.size*2)*24);let cursor=0;
  function emit(ids,sides,edgeNormal){for(let j=0;j<3;j++){
    const i=ids[j],side=sides[j],p=positions[i],n=normals[i];
    for(let k=0;k<3;k++)vertexData[cursor++]=p[k]+side*n[k]*DISPLAY_THICKNESS/2;
    for(let k=0;k<3;k++)vertexData[cursor++]=edgeNormal?.[k]??side*n[k];
    vertexData[cursor++]=uv[i][1]/DISPLAY_WIDTH;vertexData[cursor++]=uv[i][0];
  }}
  for(const f of triangles){emit(f,[1,1,1]);emit([...f].reverse(),[-1,-1,-1]);}
  for(const[a,b]of boundary.values()){
    const n=unit(cross(sub(positions[b],positions[a]),normals[a]));
    emit([a,b,b],[-1,-1,1],n);emit([a,b,a],[-1,1,1],n);
  }
  return {vertexData,midsurface:positions,normals,materialUV:uv,midTriangles:triangles,length:offset,maxJoin,parts};
}
export function buildBlenderBelt(time){
  // Straighten the standing leads with one shared height field. Applying it to
  // every passing layer keeps their relative depth and avoids new collisions.
  const smooth=(a,b)=>{const u=Math.max(0,Math.min(1,(time-a)/(b-a)));return u*u*(3-2*u)};
  const pose=blenderPose(time),tighten=smooth(18.8,19.8),height=.03-2*pose.waist.dropM;
  if(time>18){
    const authored=blenderPose(19.5);
    for(const name of ['A','B'])for(let i=0;i<2;i++)for(const key of ['s','k','radius']){
      pose[name].creases[i][key]+=tighten*(FINAL_PULL_FOLDS[name][i][key]-authored[name].creases[i][key]);
    }
  }
  const field=standingField(pose,height);
  pose.A.creases[0].k-=.16*smooth(10.35,10.65)*(1-smooth(11,11.4));
  pose.A.creases[0].radius-=.0065*smooth(10.65,10.95)*(1-smooth(11.1,11.35));
  // After B has passed through, material can slide between the two free ends.
  // Its small terminal bend travels with the tip, not with the knot's folds.
  const endOptions=(name,length=pose[name].length)=>({...pose[name],length,pullTension:tighten,
    creases:pose[name].creases.map((c,i)=>i>=2&&time>18?{...c,s:c.s+length-pose[name].length}:c)});
  const centerOffset=FINAL_PULL_CENTER_X*tighten;
  const plan=(name,length=pose[name].length)=>planStandingLead(foldMaterialStrip(name,{...endOptions(name,length),width:DISPLAY_WIDTH,thickness:DISPLAY_THICKNESS,sampleOnly:true}),field,centerOffset,tighten);
  const leadA=plan('A'),leadB=plan('B'),
    adapterA=buildWaistAdapter(foldPart('adapter-A',pose.adapterA),false,leadA.root,height,leadA.sampleSource,tighten),adapterB=buildWaistAdapter(foldPart('adapter-B',pose.adapterB,true),true,leadB.root,height,leadB.sampleSource,tighten);
  const standing=fixed.map(p=>fitWaistWrap(p,height,tighten,takeupProfile));
  const left=arcPart('outer-left',-pose.thetaA,-1.25,pose.waist.dropM),right=arcPart('outer-right',-2*Math.PI-5,-4*Math.PI+pose.thetaB,pose.waist.dropM);
  const available=data.length-[adapterA,left,...standing,right,adapterB].reduce((sum,p)=>sum+p.length,0);
  const aFeed=smooth(8.5,9)*(1-smooth(12,14)),bFeed=smooth(14,15.5),shareA=.5*(1-aFeed)*(1-bFeed)+bFeed;
  let releasedA=0,releasedB=0;
  for(let i=0;i<5;i++){
    const la=pose.A.length+releasedA,lb=pose.B.length+releasedB,pa=plan('A',la),pb=plan('B',lb),error=available-(la-pa.saved+lb-pb.saved);
    if(Math.abs(error)<1e-9)break;
    const speed=(name,length)=>{const p=foldMaterialStrip(name,{...pose[name],length,width:DISPLAY_WIDTH,thickness:DISPLAY_THICKNESS,sampleOnly:true}).sampleMaterialPoint(length),k=field(p.center[0])[1];return Math.hypot(p.tangent[0],p.tangent[1]+k*p.tangent[0],p.tangent[2])};
    releasedA+=shareA*error/speed('A',la);releasedB+=(1-shareA)*error/speed('B',lb);
  }
  const pull=smooth(18,19.5);
  if(pull){
    const end=(name,length)=>{const p=plan(name,length);return {length:length-p.saved,x:p.sampleSource(length).center[0]}};
    let la=pose.A.length+releasedA,lb=pose.B.length+releasedB;
    if(pullStartReach===undefined)pullStartReach=buildBlenderBelt(18).strips.reduce((sum,s)=>sum+s.sampleMaterialPoint(s.totalMaterialS).center[0],0);
    const targetX=pullStartReach*(1-pull);
    // Solve measured length and balanced reach together; do not scale the belt
    // or move the accepted knot crossings to make its tips look symmetrical.
    for(let i=0;i<4;i++){
      const a=end('A',la),b=end('B',lb),dl=available-a.length-b.length,dx=targetX-a.x-b.x;
      if(Math.max(Math.abs(dl),Math.abs(dx))<1e-9)break;
      const h=1e-4,aa=end('A',la+h),bb=end('B',lb+h),al=(aa.length-a.length)/h,bl=(bb.length-b.length)/h,ax=(aa.x-a.x)/h,bx=(bb.x-b.x)/h,det=al*bx-bl*ax;
      la+=(dl*bx-dx*bl)/det;lb+=(al*dx-ax*dl)/det;
    }
    releasedA=la-pose.A.length;releasedB=lb-pose.B.length;
  }
  const a=fitStandingLead(foldPart('A',endOptions('A',pose.A.length+releasedA),true),true,field,centerOffset,tighten),b=fitStandingLead(foldPart('B',endOptions('B',pose.B.length+releasedB)),false,field,centerOffset,tighten);
  const parts=[a,adapterA,left,...standing,right,adapterB,b];
  // Keep the fitted waist at the character's established belt height.
  const verticalOffset=.03-height;
  for(const part of parts){
    part.positions=part.positions.map(p=>[p[0],p[1]+verticalOffset,p[2]]);
    if(part.strip){
      const sample=part.strip.sampleMaterialPoint;
      part.strip.sampleMaterialPoint=(...args)=>{const p=sample(...args);return {...p,center:[p.center[0],p.center[1]+verticalOffset,p.center[2]]}};
      if(part.strip.samples)part.strip.samples=part.strip.samples.map(p=>({...p,center:[p.center[0],p.center[1]+verticalOffset,p.center[2]]}));
    }
  }
  // The two short waist arcs exchange a fixed amount of material. Interpolating
  // their angles introduces sub-micrometre chord-length drift; correct only the
  // material coordinates, leaving every center-path position unchanged.
  const arcs=parts.filter(part=>part.name.startsWith('outer-'));
  const budget=data.length-parts.filter(part=>!arcs.includes(part)).reduce((sum,part)=>sum+part.length,0);
  const measured=arcs.reduce((sum,part)=>sum+part.length,0);
  for(const part of arcs){const length=part.length*budget/measured;
    for(const uv of part.uv)uv[0]*=length/part.length;
    part.length=length;
  }
  const mesh=assembleBelt(parts);
  for(const strip of [a.strip,b.strip]){
    strip.segments=strip.material==='A'?[{name:'standing',fromS:0,toS:pose.A.creases[0].s},
      {name:'upper-return',fromS:pose.A.creases[0].s,toS:pose.A.creases[1]?.s??strip.totalMaterialS},
      {name:'outgoing-run',fromS:pose.A.creases[1]?.s??0,toS:strip.totalMaterialS}]:
      [{name:'lifted-feed',fromS:0,toS:strip.sourceMaterialLength-.04},{name:'waist-feed',fromS:0,toS:strip.sourceMaterialLength-.04},
       {name:'outgoing-run',fromS:pose.B.creases[1]?.s??0,toS:strip.totalMaterialS}];
    for(const segment of strip.segments){
      if(segment.toS!==strip.totalMaterialS)segment.toS=strip.sourceToMaterial(segment.toS);
      segment.fromS=strip.sourceToMaterial(segment.fromS);
    }
    strip.segments.push({name:'whole',fromS:0,toS:strip.totalMaterialS});
  }
  return {...mesh,strips:[a.strip,b.strip],waist:[],pose,settling:{releasedA,releasedB},source:'blender-material-sequence-v1',displayWidth:DISPLAY_WIDTH,displayThickness:DISPLAY_THICKNESS,
    inference:{geometry:'Blender material-space folds retargeted to the character belt width; depth tested on the actual mesh',hiddenDepth:'authored',crossings:data.crossings}};
}
