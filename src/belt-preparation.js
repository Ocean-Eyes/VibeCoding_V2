// Unroll the first Blender pose from its material midpoint. Material laid on
// the waist stays put; the remaining material hangs from the moving grip.
import {buildBlenderBelt,assembleBelt} from './belt-blender-motion.js';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/(Math.hypot(...a)||1)),mix=(a,b,q)=>add(mul(a,1-q),mul(b,q));
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=(t,a,b)=>{const q=clamp((t-a)/(b-a));return q*q*(3-2*q)};
const reference=buildBlenderBelt(8.5),L=reference.length,M=L/2;
// The final preparation grips must meet the first threading pose on the same
// material, including any waist slack already transferred to the free ends.
const gripStops=Object.fromEntries(reference.strips.map(s=>[s.material,M-s.totalMaterialS+s.sourceToMaterial(s.sourceMaterialLength*(s.material==='A'?.97/1.245626545564495:.70/1.3))]));
const rows=[];let offset=0;
for(const part of reference.parts){
 for(let i=0;i<part.uv.length;i++)if(Math.abs(part.uv[i][1])<1e-9)rows.push({s:offset+part.uv[i][0],center:part.positions[i],normal:part.normals[i]});
 offset+=part.length;
}
rows.sort((a,b)=>a.s-b.s);
const unique=rows.filter((r,i)=>!i||r.s-rows[i-1].s>1e-8);
function source(s){
 s=Math.max(0,Math.min(L,s));let lo=0,hi=unique.length-1;
 while(hi-lo>1){const m=(lo+hi)>>1;if(unique[m].s<=s)lo=m;else hi=m;}
 const a=unique[lo],b=unique[hi],q=(s-a.s)/(b.s-a.s),tangent=unit(sub(b.center,a.center)),normal=unit(mix(a.normal,b.normal,q));
 return {center:mix(a.center,b.center,q),tangent,normal,widthAxis:unit(cross(normal,tangent)),materialS:s};
}
const mid=source(M);
function rotate(v,axis,angle){return add(add(mul(v,Math.cos(angle)),mul(cross(axis,v),Math.sin(angle))),mul(axis,dot(axis,v)*(1-Math.cos(angle))))}
export function preparationProgress(t){
 // The back crossing is laid before either end returns to the front.
 if(t<=2)return 0;
 if(t<3.3){const q=smooth(t,2,3.3);return 1.18*(q+.035*Math.sin(2*Math.PI*q));}
 if(t<4)return 1.18; // Both exchanges occur behind the back, before returning.
 if(t<5)return 1.18+.86*smooth(t,4,5);
 return 2.04+(Math.max(M,L-M)-2.04)*smooth(t,5,8.5);
}
export function buildPreparationBelt(t){
 if(t>=8.5)return buildBlenderBelt(t);
 const laid=preparationProgress(t),lower=smooth(t,.35,2),shift=[0,-.62*(1-lower),.17*(1-lower)],frames={};
 for(const sign of [-1,1]){
  const end=sign<0?0:L,rootS=Math.max(0,Math.min(L,M+sign*laid)),root=source(rootS);
  // A moving grip must not inherit the discontinuous chord direction of an
  // exported triangle row. The wide held span needs a broader average until
  // it reaches the back; taper to the original window for the authored join.
  const tangentWindow=.22-.165*smooth(laid,.9,1.5);
  root.tangent=unit(sub(source(rootS+tangentWindow).center,source(rootS-tangentWindow).center));
  // At the front crossing, follow the unlaid end's tangent. Averaging across
  // the curved waist connector would turn the free span into the other end.
  const freeTangent=mul(unit(sub(source(rootS+sign*.18).center,root.center)),sign);
  root.tangent=unit(mix(root.tangent,freeTangent,smooth(laid,1.9,2.3)));
  // A free span leaving a convex waist must depart tangentially or outward.
  // The smoothed chord can point inward near the front-to-side transition.
  if(t<3.3){
   const outward=unit([root.center[0]/(.456*.456),0,(root.center[2]+.225)/(.256*.256)]),inward=Math.min(0,dot(mul(root.tangent,sign),outward));
   root.tangent=unit(sub(root.tangent,mul(outward,sign*inward*(1-smooth(t,2.65,2.8)))));
  }
  // Stagger the depth of the two hanging spans during the rear exchange.
  // Turning their departure directions preserves material length.
  root.tangent=rotate(root.tangent,[0,1,0],-.35*smooth(t,2.65,2.78)*(1-smooth(t,2.9,3.1)));
  root.widthAxis=unit(cross(root.normal,root.tangent));
  const tangent=mul(root.tangent,sign),down=[0,1,0],axis=unit(cross(tangent,down)),angle=Math.acos(Math.max(-1,Math.min(1,dot(tangent,down))));
  frames[sign]={rootS,root,tangent,axis,angle,end};
 }
 function sample(s){
  const sign=s<M?-1:1,f=frames[sign],distance=Math.abs(s-M)-laid,original=source(s);
  if(distance<=0)return {...original,center:add(original.center,shift)};
  // A straight held span, a finite-radius gravity bend, then a hanging end.
  // Arc distance is material distance; no shortening/fading of hidden tails.
  // Spend the initial length in the visible held span, not in a floor turn.
  // Lowering is a rigid translation; wrapping then consumes this same span.
  const straight=Math.max(.38,1.12-laid), radius=.12,bend=f.angle*radius,x=Math.max(0,distance-straight),a=Math.min(f.angle,x/radius),axis=f.axis;
  let p=add(f.root.center,mul(f.tangent,Math.min(straight,distance)));
  if(x>0)p=add(p,add(mul(f.tangent,radius*Math.sin(a)),mul(cross(axis,f.tangent),radius*(1-Math.cos(a)))));
  let tangent=mul(rotate(f.tangent,axis,a),sign),widthAxis=rotate(f.root.widthAxis,axis,a);
  if(x>bend)p=add(p,[0,x-bend,0]);
  const normal=unit(cross(tangent,widthAxis));
  return {center:add(p,shift),tangent,widthAxis,normal,materialS:s};
 }
 const positions=[],normals=[],uv=reference.materialUV.map(v=>[...v]);
 for(let i=0;i<reference.midsurface.length;i++){
  const s=uv[i][0],now=sample(s);
  // Preserve the source surface exactly on laid material, including its seam
  // cross sections. The unlaid section uses the transported material frame.
  const remaining=Math.abs(s-M)-laid,blend=smooth(remaining,0,.06);
  const offset=mix(sub(reference.midsurface[i],source(s).center),mul(now.widthAxis,-uv[i][1]),blend);
  const p=remaining<=0?add(reference.midsurface[i],shift):add(now.center,offset);
  positions.push(p);normals.push(remaining<=0?reference.normals[i]:unit(mix(reference.normals[i],now.normal,blend)));
 }
 const mesh=assembleBelt([{name:'continuous-preparation',length:L,positions,normals,uv,triangles:reference.midTriangles}]);
 const strips=['A','B'].map((material,i)=>{
  const length=i?L-M:M,sign=i?1:-1,point=s=>{const p=sample(M+sign*s);return {...p,tangent:mul(p.tangent,sign),materialS:s}};
  return {material,totalMaterialS:length,visibleMaterialS:length,samples:Array.from({length:81},(_,j)=>point(length*j/80)),sampleMaterialPoint:point,segments:[{name:'preparation',fromS:0,toS:length}],triangles:[],width:.078,thickness:.006};
 });
 return {...mesh,strips,waist:[],displayWidth:.078,displayThickness:.006,source:'continuous-material-preparation',preparation:{laid,lower,gripStops,midpoint:add(mid.center,shift)},sampleMaterialPoint:sample,
  inference:{geometry:'progressive unrolling of the first Blender material pose; finite-radius hanging ends',hiddenDepth:'authored rear crossing from Blender'}};
}
