import {contactPullSampler} from './belt-contact-pull.js';
// Horizontal waist connections. Curvature is in depth around the torso, not
// a visible vertical fold. Their measured length is balanced by the free ends.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),mix=(a,b,q)=>a.map((v,i)=>v+(b[i]-v)*q),unit=a=>mul(a,1/(Math.hypot(...a)||1)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function waistTakeupProfile(parts){
 // Both rear passes use the same radial displacement. Their authored order
 // changes around the back, so projecting them onto separate fixed ellipses
 // would cross the layers. Keep their radial separation and the front seams.
 const curves=parts.filter(p=>p.name.startsWith('rear-smooth')).map(p=>{
  const rows=[];for(let i=2;i<p.positions.length;i+=5){const [x,,z]=p.positions[i];rows.push([Math.atan2(x/.44,-(z+.225)/.24),Math.hypot(x/.44,(z+.225)/.24)]);}
  return rows.sort((a,b)=>a[0]-b[0]);
 });
 const at=(curve,t)=>{let lo=0,hi=curve.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(curve[m][0]<t)lo=m;else hi=m;}const q=Math.max(0,Math.min(1,(t-curve[lo][0])/(curve[hi][0]-curve[lo][0])));return curve[lo][1]+q*(curve[hi][1]-curve[lo][1])};
 // The reference torso and the tilted ribbon edges both fit inside this
 // clearance envelope. The retained margin includes the actual belt thickness.
 return p=>{const theta=Math.atan2(p[0]/.44,-(p[2]+.225)/.24);return Math.max(0,Math.min(...curves.map(c=>at(c,theta)))-1.06)};
}
export function fitWaistWrap(part,height,tension=0,profile=()=>0){
 const positions=part.positions.map(v=>[v[0],v[1]+height-.03,v[2]]);
 if(!tension||!part.name.startsWith('rear-smooth'))return {...part,positions};
 const warp=p=>{
  const q=Math.max(0,Math.min(1,(-p[2]-.16)/.11)),a=tension*q*q*(3-2*q);
  const radius=Math.hypot(p[0]/.44,(p[2]+.225)/.24),scale=1-a*profile(p)/radius;
  return [p[0]*scale,p[1],-.225+(p[2]+.225)*scale];
 };
 // Release only the measured change in centerline length into the held ends.
 // Reconstruct each width row at its original width after the radial move.
 const fitted=[],normals=[],uv=[];let before=0,after=0,prior=null,nextPrior=null;
 for(let row=0;row<positions.length/5;row++){
  const center=positions[row*5+2],target=warp(center);
  const first=positions[row*5],last=positions[row*5+4],width=Math.hypot(...sub(last,first)),axis=unit(sub(warp(last),warp(first)));
  if(prior){before+=Math.hypot(...sub(center,prior));after+=Math.hypot(...sub(target,nextPrior));}
  for(let col=0;col<5;col++){
   const index=row*5+col;
   fitted.push(add(target,mul(axis,(col/4-.5)*width)));
   normals.push(part.normals[index]);
   uv.push([part.uv[index][0]+after-before,part.uv[index][1]]);
  }
  prior=center;nextPrior=target;
 }
 for(let row=1;row<fitted.length/5-1;row++){
  const tangent=sub(fitted[(row+1)*5+2],fitted[(row-1)*5+2]),width=sub(fitted[row*5+4],fitted[row*5]),n=unit(cross(width,tangent));
  for(let col=0;col<5;col++){const at=row*5+col;normals[at]=mul(n,n.reduce((sum,v,k)=>sum+v*part.normals[at][k],0)<0?-1:1);}
 }
 return {...part,positions:fitted,normals,uv,length:part.length+after-before};
}
export function standingField(pose,height){
 // The original waist changes height relative to the knot while tightening. Flatten
 // only the leads that would stand above that wrap; use the same displacement
 // for every passing layer, and taper it before the free ends.
 return x=>{
  if(height<=.04)return [0,0];
  const ratio=(height-.04)/.058,p=x<0?pose.A:pose.B,k=p.basis[1][1]/p.basis[1][0],d=height-p.origin[1]-k*(x-p.origin[0]),eps=.004*ratio;
  const lo=d<=-eps?[0,0]:d>=eps?[d,-k]:[(d+eps)**2/(4*eps),-k*(d+eps)/(2*eps)],cap=.078*ratio,edge=.008*ratio;
  if(lo[0]>=cap+edge)return [cap,0];
  if(lo[0]<=cap-edge)return lo;
  return [cap-(cap+edge-lo[0])**2/(4*edge),lo[1]*(cap+edge-lo[0])/(2*edge)];
 };
}
export function planStandingLead(strip,field,centerOffset=0,tension=0){
 const join=strip.totalMaterialS;
 // Retain the verified contact route through the knot. Only after the outgoing
 // span clears the last loop may it aim at the wider, equally high hand grips.
 const fold=strip.creases[1],exit=fold?fold.at+fold.half*fold.n+Math.abs(fold.k)*strip.width/2:join;
 const h0=tension&&exit<join?field(strip.sampleMaterialPoint(exit).center[0])[0]:0;
 const rootPoint=strip.sampleMaterialPoint(0).center,waistHeight=rootPoint[1]+field(rootPoint[0])[0];
 // Material lengths of the validated contact pose before taking up rear slack.
 // Holding this slope fixed keeps extending the ends from moving a crossing.
 const tautEnd=strip.material==='A'?1.4604853546891405:1.3822023681875153;
 // Retain the accepted free-span heading as contact take-up feeds more length
 // into each end. A fixed end height would flatten the longer span into the wrap.
 const referenceJoin=strip.material==='A'?1.3456725433515904:1.3155529429896746;
 const h1=tension?field(strip.sampleMaterialPoint(referenceJoin).center[0])[0]:0;
 const targetH=tension?.25+waistHeight-.03-strip.sampleMaterialPoint(join).center[1]:0;
 const first=strip.creases[0],entry=first?first.at-first.half*first.n-Math.abs(first.k)*strip.width/2:0;
 const contactStart=entry-.10,contactEnd=tension?strip.sampleMaterialPoint(entry):null;
 const contactSlope=contactEnd?(contactEnd.center[1]+field(contactEnd.center[0])[0]-waistHeight)/.10:0;
 const fittedField=(s,x)=>{
  const [h,k]=field(x);
  if(!tension||s<=exit||exit>=join)return [h,k,0];
  const q=Math.min(1,(s-exit)/.04),w=tension*q*q*(3-2*q),dw=tension*6*q*(1-q)/.04;
  const slope=(h1-h0)/(referenceJoin-exit),line=h0+slope*(s-exit),anchor=exit+.24;
  let correction=0,derivative=0;
  if(join>anchor+.02&&s>anchor){
   const a=Math.min(1,(s-anchor)/.02),weight=tension*a*a*(3-2*a),dv=tension*6*a*(1-a)/.02;
   const anchorH=h0+slope*(anchor-exit),nextSlope=(1-tension)*(targetH-anchorH)/(join-anchor)+tension*(.25+waistHeight-.03-strip.sampleMaterialPoint(tautEnd).center[1]-anchorH)/((tautEnd)-anchor),next=anchorH+nextSlope*(s-anchor);
   correction=weight*(next-line);derivative=dv*(next-line)+weight*(nextSlope-slope);
  }
  return [h+w*(line-h)+correction,(1-w)*k,dw*(line-h)+w*slope+derivative];
 };
 const rawSample=(s,v=0,side=0)=>{
  const mid=strip.sampleMaterialPoint(s),slope=fittedField(s,mid.center[0])[1],w=mid.widthAxis,scale=Math.hypot(w[0],w[1]+slope*w[0],w[2]);
  let extra=0,derivative=0;
  if(tension&&strip.material==='A'&&s<entry){
   // Connect the waist contact to the first bend with a straight span. The
   // former short smoothstep made an S-shaped kink in this exposed panel.
   // Ease only the initial contact; retain the finite under-waist bend.
   const q=Math.max(0,Math.min(1,(s-contactStart)/.006)),w=q*q*(3-2*q),dw=6*q*(1-q)/.006;
   const target=waistHeight+w*contactSlope*(s-contactStart),dy=dw*contactSlope*(s-contactStart)+w*contactSlope;
   const [h,k]=field(mid.center[0]);
   extra=tension*(target-mid.center[1]-h);derivative=tension*(dy-mid.tangent[1]-k*mid.tangent[0]);
  }
  const p=v?strip.sampleMaterialPoint(s,v/scale):mid,[h,k,ds]=fittedField(s,p.center[0]),tangent=unit([p.tangent[0],p.tangent[1]+k*p.tangent[0]+ds+derivative,p.tangent[2]]),widthAxis=unit([p.widthAxis[0],p.widthAxis[1]+k*p.widthAxis[0],p.widthAxis[2]]),normal=ds||derivative?unit(cross(widthAxis,tangent)):unit([p.normal[0]-k*p.normal[1],p.normal[1],p.normal[2]]);
  return {...p,center:add([p.center[0]+centerOffset,p.center[1]+h+extra,p.center[2]],mul(normal,side*strip.thickness/2)),tangent,widthAxis,normal};
 };
 const sampleSource=contactPullSampler(strip,rawSample,tension);
 // Reparameterize the fitted centreline by measured arc distance. Contacts
 // retain their authored source coordinates through this mapping.
 // A fixed source grid lets the length iterations reuse the expensive contact
 // samples. Changing the end length does not change those interior contacts.
 const step=tension?.002:join/800,n=tension?Math.ceil(join/step):800,arc=[0],source=i=>tension?Math.min(join,i*step):join*i/n;let prior=sampleSource(0).center;
 for(let i=1;i<=n;i++){const p=sampleSource(source(i)).center;arc.push(arc.at(-1)+Math.hypot(...sub(p,prior)));prior=p;}
 const saved=join-arc.at(-1),toMaterial=s=>{if(s>=join)return s-saved;if(!tension){const x=Math.max(0,s/join*n),i=Math.min(n-1,Math.floor(x));return arc[i]+(arc[i+1]-arc[i])*(x-i)}const i=Math.max(0,Math.min(n-1,Math.floor(s/step)));return arc[i]+(arc[i+1]-arc[i])*(s-source(i))/(source(i+1)-source(i))};
 const fromMaterial=s=>{if(s>=arc.at(-1))return s+saved;let lo=0,hi=n;while(hi-lo>1){const m=(lo+hi)>>1;if(arc[m]<=s)lo=m;else hi=m;}if(!tension)return (lo+(s-arc[lo])/(arc[hi]-arc[lo]))*join/n;return source(lo)+(s-arc[lo])/(arc[hi]-arc[lo])*(source(hi)-source(lo))};
 return {saved,sampleSource,toMaterial,fromMaterial,root:sampleSource(0)};
}
export function fitStandingLead(part,reverse=false,field,centerOffset=0,tension=0,preparedPlan){
 const plan=preparedPlan??planStandingLead(part.strip,field,centerOffset,tension),length=part.length-plan.saved,positions=[],normals=[],uv=[];
 for(let i=0;i<part.positions.length;i++){
  const s=reverse?part.length-part.uv[i][0]:part.uv[i][0],v=reverse?-part.uv[i][1]:part.uv[i][1],p=plan.sampleSource(s,v);
  positions.push(p.center);normals.push(p.normal);uv.push([reverse?length-plan.toMaterial(s):plan.toMaterial(s),part.uv[i][1]]);
 }
 const sampleMaterialPoint=(s,v=0,side=0)=>({...plan.sampleSource(plan.fromMaterial(Math.max(0,Math.min(length,s))),v,side),materialS:s});
 const strip={...part.strip,totalMaterialS:length,visibleMaterialS:length,sourceMaterialLength:part.length,sourceToMaterial:plan.toMaterial,sampleMaterialPoint,samples:part.strip.samples.map(p=>sampleMaterialPoint(plan.toMaterial(p.materialS)))};
 return {...part,positions,normals,uv,length,strip,leadSaved:plan.saved};
}
export function buildWaistAdapter(part,reverse=false,root,height,rootSample,tighten=0){
 const first=root?{...root,widthAxis:mul(root.widthAxis,-1),tangent:mul(root.tangent,-1)}:part.strip.sampleMaterialPoint(0),last=part.strip.sampleMaterialPoint(part.length),sign=first.center[0]<0?-1:1;
 // Remove the shoulder lead's excess curvature only during the final pull.
 // Its measured length is released into the held ends by the length solver.
 const a=first.center,e=[last.center[0],height,last.center[2]],b=add(a,mul(first.tangent,.04)),c=add(a,[sign*(.23-.20*tighten),0,-.04]),d=add(e,[-sign*.04,0,.06]);
 b[1]=Math.max(e[1],Math.min(a[1],b[1]));
 const curve=u=>add(add(add(mul(a,(1-u)**4),mul(b,4*(1-u)**3*u)),add(mul(c,6*(1-u)**2*u*u),mul(d,4*(1-u)*u**3))),mul(e,u**4));
 const derivative=u=>add(add(mul(sub(b,a),4*(1-u)**3),mul(sub(c,b),12*(1-u)**2*u)),add(mul(sub(d,c),12*(1-u)*u*u),mul(sub(e,d),4*u**3)));
 const frame=u=>{const f=Math.min(1,u/.3),width=mix(first.widthAxis,last.widthAxis,f*f*(3-2*f));return {width,normal:unit(cross(width,unit(derivative(u))))}};
 const section=(u,v)=>{
  const f=Math.min(1,u/.3),weight=1-f*f*(3-2*f),{width,normal}=frame(u),source=rootSample(0,-v),offset=sub(source.center,add(a,mul(first.widthAxis,v)));
  return {center:add(add(curve(u),mul(width,v)),mul(offset,weight)),normal:unit(mix(normal,source.normal,weight))};
 };
 const count=160,arc=[0];let previous=curve(0);
 for(let i=1;i<=count;i++){const p=curve(i/count);arc.push(arc.at(-1)+Math.hypot(...sub(p,previous)));previous=p;}
 const length=arc.at(-1),positions=[],normals=[],uv=[],triangles=[];
 for(let row=0;row<=count;row++){
  const u=row/count;
  for(let column=0;column<5;column++){
   const v=(column/4-.5)*part.strip.width;
   const point=section(u,v);positions.push(point.center);normals.push(point.normal);uv.push([reverse?length-arc[row]:arc[row],reverse?-v:v]);
   if(row&&column){const k=row*5+column;triangles.push([k-6,k-5,k],[k-6,k,k-1]);}
  }
 }
 const sampleMaterialPoint=(s,v=0,side=0)=>{
  s=Math.max(0,Math.min(length,s));let lo=0,hi=count;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(arc[mid]<=s)lo=mid;else hi=mid;}
  const u=(lo+(s-arc[lo])/(arc[hi]-arc[lo]))/count,{width}=frame(u),point=section(u,v);
  return {...point,center:add(point.center,mul(point.normal,side*part.strip.thickness/2)),tangent:unit(derivative(u)),widthAxis:width,materialS:s,u:v};
 };
 const strip={material:part.strip.material,width:part.strip.width,thickness:part.strip.thickness,totalMaterialS:length,sampleMaterialPoint};
 return {...part,positions,normals,uv,triangles,length,strip};
}
