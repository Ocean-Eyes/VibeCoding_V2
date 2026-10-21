import {FIRST_PERSON_CAMERA,cameraPoint} from './belt-view-camera.js';
import {drawBeltVolume} from './belt-volume-render.js';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,n)=>a.map(v=>v*n),unit=a=>mul(a,1/(Math.hypot(...a)||1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const cache=new WeakMap();
function triangle(out,a,b,c,material,normals){const n=unit(cross(sub(b,a),sub(c,a)));for(const [i,p] of [a,b,c].entries())out.push(...p,...(normals?.[i]??n),0,material)}
function tube(out,points,radii,material,sides=12,capStart=true){
 const rings=points.map((p,i)=>{
  const tangent=unit(sub(points[Math.min(points.length-1,i+1)],points[Math.max(0,i-1)])),u=unit(cross(tangent,Math.abs(tangent[2])<.9?[0,0,1]:[0,1,0])),v=cross(tangent,u),r=Array.isArray(radii)?radii[i]:radii;
  return Array.from({length:sides},(_,j)=>add(p,add(mul(u,r*Math.cos(j/sides*Math.PI*2)),mul(v,r*Math.sin(j/sides*Math.PI*2)))));
 });
 const n=(i,j)=>unit(sub(rings[i][j],points[i]));
 for(let i=1;i<rings.length;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides;triangle(out,rings[i-1][j],rings[i][j],rings[i][k],material,[n(i-1,j),n(i,j),n(i,k)]);triangle(out,rings[i-1][j],rings[i][k],rings[i-1][k],material,[n(i-1,j),n(i,k),n(i-1,k)])}
 for(let j=0;j<sides;j++){const k=(j+1)%sides;if(capStart)triangle(out,points[0],rings[0][k],rings[0][j],material);triangle(out,points.at(-1),rings.at(-1)[j],rings.at(-1)[k],material)}
}
function torso(out){
 // A judogi volume matching the established waist ellipse. The wearer's own
 // head and upper chest are outside this downward view; no front-view cutout.
 const rows=[[-1.15,.40,.23],[-.6,.40,.23],[-.3,.414,.234],[.03,.432,.235],[.36,.445,.24],[.65,.46,.245]],rings=rows.map(([y,rx,rz])=>Array.from({length:64},(_,j)=>{const a=j/64*Math.PI*2;return [-.008+rx*Math.sin(a),y,-.225+rz*Math.cos(a)]}));
 const n=(i,j)=>unit([Math.sin(j/64*Math.PI*2)/rows[i][1],0,Math.cos(j/64*Math.PI*2)/rows[i][2]]);
 for(let i=1;i<rings.length;i++)for(let j=0;j<64;j++){const k=(j+1)%64;triangle(out,rings[i-1][j],rings[i][j],rings[i][k],-100,[n(i-1,j),n(i,j),n(i,k)]);triangle(out,rings[i-1][j],rings[i][k],rings[i-1][k],-100,[n(i-1,j),n(i,k),n(i-1,k)])}
 for(let j=0;j<64;j++){const k=(j+1)%64;triangle(out,[-.008,-1.15,-.225],rings[0][j],rings[0][k],-100);triangle(out,[-.008,.65,-.225],rings.at(-1)[k],rings.at(-1)[j],-100)}
 // Two trouser legs continue below the judogi, visible when looking down.
 for(const x of [-.22,.22])tube(out,[[x,.60,-.23],[x,1.5,-.23],[x,2.2,-.23]],[.20,.17,.15],-100,20);
}
export function firstPersonScene(state){
 if(cache.has(state))return cache.get(state);
 const out=[];torso(out);const grips=[];
 for(const hand of state.rig.hands){
  const contact=state.contacts.find(c=>c.identity===hand.identity),depth=hand.materialContactDepth??.12,grip=[...hand.grip,depth];
  const tangent=contact?.surfaceTangent??[1,0,0],den=tangent[0]**2+tangent[1]**2;
  const slope=den>.1?[tangent[0]*tangent[2]/den,tangent[1]*tangent[2]/den]:[0,0];
  const lift=(p,offset=0)=>[p[0],p[1],depth+Math.max(-.06,Math.min(.06,slope[0]*(p[0]-hand.grip[0])+slope[1]*(p[1]-hand.grip[1])))+offset];
  const wrist=lift(hand.arm.wrist,-.016),shoulder=[...hand.arm.shoulder,-.20],elbow=[...hand.arm.elbow,(depth-.20)/2];
  tube(out,[shoulder,elbow,wrist],[.115,.10,.066],-100,20,false);
  const center=mul(hand.palm.reduce((sum,p)=>add(sum,lift(p,-.019)),[0,0,0]),1/hand.palm.length),front=hand.palm.map(p=>lift(p,-.004)),back=hand.palm.map(p=>lift(p,-.034));
  for(let i=0;i<front.length;i++){const j=(i+1)%front.length;triangle(out,add(center,[0,0,.015]),front[i],front[j],-101);triangle(out,add(center,[0,0,-.015]),back[j],back[i],-101);triangle(out,front[i],back[i],back[j],-101);triangle(out,front[i],back[j],front[j],-101)}
  for(const digit of hand.digits)tube(out,digit.map((p,i)=>lift(p,.013+Math.sin(i/(digit.length-1)*Math.PI)*.012)),[.014,.014,.012,.008],-101);
  tube(out,hand.thumb.map(p=>lift(p,.018)),[.018,.017,.014,.010],-101);
  grips.push({identity:hand.identity,point:grip,contact:contact?.point3D??null});
 }
 const data=new Float32Array(state.volume.vertexData.length+out.length);data.set(out);data.set(state.volume.vertexData,out.length);
 const scene={vertexData:data,source:'first-person-scene',grips};cache.set(state,scene);return scene;
}
export function drawFirstPerson(ctx,w,h,state){
 const camera=FIRST_PERSON_CAMERA,anchor={x:w/2,y:h*.53,scale:Math.min(w/2.6,h/1.8)},viewport=[-anchor.x/anchor.scale,-anchor.y/anchor.scale,(w-anchor.x)/anchor.scale,(h-anchor.y)/anchor.scale];
 drawBeltVolume(ctx,anchor,firstPersonScene(state),{...camera,viewport,bodyOcclusion:false});
 ctx.save();ctx.font='600 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const [material,end] of Object.entries(state.guideEnds)){
  const p=end.position3D;if(!p)continue;
  // Rear tails remain behind the torso, just as they do in the depth buffer.
  if(p[2]<-.20&&Math.abs(p[0])<.44)continue;
  const q=cameraPoint(p,camera);if(!q.visible)continue;
  const x=anchor.x+q.position[0]*anchor.scale,y=anchor.y+q.position[1]*anchor.scale;if(x<12||x>w-12||y<12||y>h-30)continue;
  ctx.fillStyle='#20313ce8';ctx.strokeStyle=material==='A'?'#a7dcef':'#ebcb93';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(x,y+18,10,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.fillText(material,x,y+18);
 }
 ctx.restore();return anchor;
}
