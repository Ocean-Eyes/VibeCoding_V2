import {CONTACT_SHAPES} from './belt-contact-pull-data.js';

const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const cubic=(a,b,c,d,t)=>b.map((v,k)=>.5*(2*v+(-a[k]+c[k])*t+(2*a[k]-5*v+4*c[k]-d[k])*t*t+(-a[k]+3*v-3*c[k]+d[k])*t*t*t));
const smoothCubic=(a,b,c,d,t)=>{
 const w0=(1-t)**3,w1=3*t**3-6*t*t+4,w2=-3*t**3+3*t*t+3*t+1,w3=t**3;
 return [(a[0]*w0+b[0]*w1+c[0]*w2+d[0]*w3)/6,(a[1]*w0+b[1]*w1+c[1]*w2+d[1]*w3)/6,(a[2]*w0+b[2]*w1+c[2]*w2+d[2]*w3)/6];
};
const gridCaches=new Map();
const sampleCaches=new Map();

// These local corrections close the marked folds while retaining the accepted
// lower A and both crossings. The caller measures the resulting arc
// and releases the saved material into the held ends; it never scales the belt.
export function contactPullSampler(strip,rawSample,tension){
 const shape=CONTACT_SHAPES[strip.material];
 if(!tension||!shape)return rawSample;
 const finish=sample=>{
  if(strip.material!=='A')return sample;
  const u=Math.max(0,Math.min(1,(tension-.75)/.25));
  return contactPullSampler({...strip,material:'A-upper'},sample,u*u*(3-2*u));
 };
 const {rows,columns,start,end}=shape;
 const cinch=Math.max(0,Math.min(1,(tension-.65)/.35)),blend=cinch*cinch*(3-2*cinch);
 let offsets=shape.approachOffsets?shape.offsets.map((p,i)=>add(shape.approachOffsets[i],mul(sub(p,shape.approachOffsets[i]),blend))):shape.offsets;
 if(shape.priorOffsets){
  // Finish the extra rightward take-up after A has reached its retained pose.
  const q=Math.max(0,Math.min(1,(tension-.94)/.06)),w=q*q*(3-2*q);
  offsets=shape.offsets.map((p,i)=>add(add(shape.approachOffsets[i],mul(sub(shape.priorOffsets[i],shape.approachOffsets[i]),blend)),mul(sub(p,shape.priorOffsets[i]),w)));
 }
 // Length balancing moves only the terminal crease, beyond this contact patch.
 // It cannot affect points before its bend starts; including it in the key
 // discarded identical contact grids and samples on every solver iteration.
 const contactCreases=strip.creases.filter(c=>c.at-c.half*c.n-Math.abs(c.k)*strip.width/2<=end);
 const cacheKey=JSON.stringify([tension,strip.width,strip.thickness,contactCreases,rawSample(start).center,rawSample(end).center]);
 if(sampleCaches.get(strip.material)?.key!==cacheKey)sampleCaches.set(strip.material,{key:cacheKey,values:new Map(),centers:new Map()});
 const {values:cache,centers}=sampleCaches.get(strip.material);
 const rawCenter=(s,v=0)=>rawSample.centerAt?rawSample.centerAt(s,v):rawSample(s,v).center;
 // Arc-length solving needs positions, not the finite-difference surface frame.
 // Keep the exact same position function, including nested A-upper contact.
 const memoized=(sample,center)=>{
  const result=(s,v=0,side=0)=>{
   if(s<=start||s>=end)return rawSample(s,v,side);
   const key=s+':'+v+':'+side;
   if(!cache.has(key))cache.set(key,sample(s,v,side));
   return cache.get(key);
  };
  result.centerAt=(s,v=0)=>{
   if(s<=start||s>=end)return rawCenter(s,v);
   const key=s+':'+v;
   if(!centers.has(key))centers.set(key,center(s,v));
   return centers.get(key);
  };
  result.frameMeta=rawSample.frameMeta;
  return result;
 };
 const offsetAt=(s,v)=>{
  // Follow the authored crease as material feeds through it. A displacement
  // tied to the final S coordinate alone pinches the moving inner surface.
  if(strip.material!=='B')return interpolate(s,v);
  const current=[start,...strip.creases.slice(0,2).map(c=>c.at+c.k*v),end];
  const target=[start,.40009257090681544-.7297211887733918*v,.5667362329028055+.6900505394176525*v,end];
  let k=0;while(k<2&&s>current[k+1])k++;
  const slopes=current.slice(0,3).map((x,i)=>(target[i+1]-target[i])/(current[i+1]-x));
  const m0=k?2*slopes[k-1]*slopes[k]/(slopes[k-1]+slopes[k]):slopes[0],m1=k<2?2*slopes[k]*slopes[k+1]/(slopes[k]+slopes[k+1]):slopes[2];
  const h=current[k+1]-current[k],q=(s-current[k])/h;
  const mapped=(2*q**3-3*q*q+1)*target[k]+(q**3-2*q*q+q)*h*m0+(-2*q**3+3*q*q)*target[k+1]+(q**3-q*q)*h*m1;
  const phase=Math.max(0,Math.min(1,(tension-.65)/.15)),w=phase*phase*(3-2*phase);
  return interpolate(s+(mapped-s)*w,v);
 };
 const columnCaches=new Map();
 const interpolate=(s,v,values=offsets)=>{

  const row=Math.max(0,Math.min(rows-1,(s-start)/(end-start)*(rows-1))),column=(v/strip.width+.5)*(columns-1);
  const i=Math.min(rows-2,Math.floor(row)),j=Math.max(0,Math.min(columns-2,Math.floor(column))),r=row-i,c=column-j;
  const at=(a,b)=>{
   a=Math.max(0,Math.min(rows-1,a));
   // Extrapolate across the edge for the normal derivative, rather than
   // clamping it and halving the edge tangent.
   if(b<0)return sub(mul(values[a*columns],2),values[a*columns+1]);
   if(b>=columns)return sub(mul(values[a*columns+columns-1],2),values[a*columns+columns-2]);
   return values[a*columns+b];
  };
  const curve=values===offsets?cubic:smoothCubic;
  // Mesh rows and normal differences revisit the same transverse spline.
  // Reuse its evaluated rows without changing the interpolation arithmetic.
  let byWidth=columnCaches.get(values);if(!byWidth){byWidth=new Map();columnCaches.set(values,byWidth);}
  let columnRows=byWidth.get(v);if(!columnRows){if(byWidth.size>=32)byWidth.delete(byWidth.keys().next().value);columnRows=new Map();byWidth.set(v,columnRows);}
  const columnAt=a=>{if(!columnRows.has(a))columnRows.set(a,curve(at(a,j-1),at(a,j),at(a,j+1),at(a,j+2),c));return columnRows.get(a)};
  return curve(columnAt(i-1),columnAt(i),columnAt(i+1),columnAt(i+2),r);
 };
 if((strip.material==='B'&&tension>.4)||strip.material==='A-upper'){
  // Interpolate the deformed blue surface as a whole. Adding a final-pose
  // displacement to an independently moving crease can fold the inner skin
  // back on itself between grid rows during the pull, despite a clear endpoint.
  if(cacheKey!==gridCaches.get(strip.material)?.key){
   let points=offsets.map((offset,i)=>{
    const s=start+(end-start)*Math.floor(i/columns)/(rows-1),v=strip.width*((i%columns)/(columns-1)-.5),p=add(rawCenter(s,v),mul(offsetAt(s,v),tension));
    if(strip.material==='B'){
     // Keep the standing edge above A and the outgoing edge below A while
     // contact slides. These depth clearances vanish at the held endpoint.
     const edge=Math.max(0,Math.min(1,-v/.025)),weight=edge*edge*(3-2*edge),along=Math.exp(-(((s-.345)/.042)**4)),q=Math.max(0,Math.min(1,(tension-.78)/.22));
     p[2]+=.001*4*q*(1-q)*weight*along;
     p[2]-=.008*4*q*(1-q)*weight*Math.exp(-(((s-.66)/.028)**4));
    }
    if(strip.material==='A-upper'){
     const edge=Math.max(0,Math.min(1,v/.025)),weight=edge*edge*(3-2*edge);
     p[2]-=.0015*4*tension*(1-tension)*weight*Math.exp(-(((s-.825)/.025)**4));
    }
    return p;
   });
   // Resolve the inner radius without changing the anchored boundaries.
   if(strip.material==='A-upper')for(let pass=0;pass<8;pass++){const old=points;points=points.map((p,i)=>{const r=Math.floor(i/columns);return r<3||r>=rows-3?p:add(mul(p,.5),mul(add(old[i-columns],old[i+columns]),.25));});}
   gridCaches.set(strip.material,{key:cacheKey,points});
  }
  const points=gridCaches.get(strip.material).points,u=strip.material==='A-upper'?tension:Math.min(1,(tension-.4)/.3),weight=u*u*(3-2*u);
  const position=(s,v)=>{
   const smoothed=interpolate(s,v,points);
   if(weight===1)return smoothed;
   const direct=add(rawCenter(s,v),mul(offsetAt(s,v),tension));
   return add(direct,mul(sub(smoothed,direct),weight));
  };
  return finish(memoized((s,v=0,side=0)=>{
   if(s<=start||s>=end)return rawSample(s,v,side);
   const p=rawSample.frameMeta?rawSample.frameMeta(s,v):rawSample(s,v),e=.00001,center=position(s,v);
   const tangent=unit(sub(position(s+e,v),position(s-e,v))),widthAxis=unit(sub(position(s,v+e),position(s,v-e))),normal=unit(cross(widthAxis,tangent));
   return {...p,center:add(center,mul(normal,side*strip.thickness/2)),tangent,widthAxis,normal};
  },position));
 }
 const displacement=offsetAt;
 return finish(memoized((s,v=0,side=0)=>{
  if(s<=start||s>=end)return rawSample(s,v,side);
  const p=rawSample(s,v),e=.00001;
  const ds=sub(rawCenter(s+e,v),rawCenter(s-e,v)),dv=sub(rawCenter(s,v+e),rawCenter(s,v-e));
  const tangent=unit(add(ds,mul(sub(displacement(s+e,v),displacement(s-e,v)),tension)));
  const widthAxis=unit(add(dv,mul(sub(displacement(s,v+e),displacement(s,v-e)),tension)));
  // Apply only the change of surface normal, preserving the authored frame at
  // zero correction and retaining the full thickness on both sides.
  const surfaceNormal=unit(cross(widthAxis,tangent));
  const normal=unit(add(p.normal,sub(surfaceNormal,unit(cross(unit(dv),unit(ds))))));
  const center=add(p.center,mul(displacement(s,v),tension));
  return {...p,center:add(center,mul(normal,side*strip.thickness/2)),tangent,widthAxis,normal};
 },(s,v)=>add(rawCenter(s,v),mul(displacement(s,v),tension))));
}
