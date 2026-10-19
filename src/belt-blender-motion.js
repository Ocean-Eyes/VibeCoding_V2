// Material-space playback of the Blender-authored belt. No image tracing or
// per-panel painter order: both crossing regions use the actual surface depth.
import {BLENDER_BELT as data} from './belt-blender-data.js';
import {foldMaterialStrip} from './belt-material-folds.js';
const DISPLAY_WIDTH=.078,DISPLAY_THICKNESS=.006;
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
  const strip=foldMaterialStrip(name,{...options,width:DISPLAY_WIDTH,thickness:DISPLAY_THICKNESS,across:4,step:.02});
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
  return {vertexData,midsurface:positions,materialUV:uv,midTriangles:triangles,length:offset,maxJoin,parts};
}
export function buildBlenderBelt(time){
  const pose=blenderPose(time),a=foldPart('A',pose.A,true),b=foldPart('B',pose.B),
    adapterA=foldPart('adapter-A',pose.adapterA),adapterB=foldPart('adapter-B',pose.adapterB,true);
  const standing=fixed.map(p=>({...p,positions:p.positions.map(v=>[v[0],v[1]-2*pose.waist.dropM,v[2]])}));
  const parts=[a,adapterA,arcPart('outer-left',-pose.thetaA,-1.25,pose.waist.dropM),...standing,
    arcPart('outer-right',-2*Math.PI-5,-4*Math.PI+pose.thetaB,pose.waist.dropM),adapterB,b];
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
      [{name:'lifted-feed',fromS:0,toS:strip.totalMaterialS-.04},{name:'waist-feed',fromS:0,toS:strip.totalMaterialS-.04},
       {name:'outgoing-run',fromS:pose.B.creases[1]?.s??0,toS:strip.totalMaterialS}];
  }
  return {...mesh,strips:[a.strip,b.strip],waist:[],pose,source:'blender-material-sequence-v1',displayWidth:DISPLAY_WIDTH,displayThickness:DISPLAY_THICKNESS,
    inference:{geometry:'Blender material-space folds retargeted to the character belt width; depth tested on the actual mesh',hiddenDepth:'authored',crossings:data.crossings}};
}
