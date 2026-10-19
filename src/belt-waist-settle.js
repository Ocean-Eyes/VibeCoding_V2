// Horizontal waist connections. Curvature is in depth around the torso, not
// a visible vertical fold. Their measured length is balanced by the free ends.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),mix=(a,b,q)=>a.map((v,i)=>v+(b[i]-v)*q),unit=a=>mul(a,1/(Math.hypot(...a)||1)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function fitWaistWrap(part,height){
 const positions=part.positions.map(v=>[v[0],v[1]+height-.03,v[2]]);
 return {...part,positions};
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
export function planStandingLead(strip,field){
 const join=strip.totalMaterialS;
 const sampleSource=(s,v=0,side=0)=>{
  const mid=strip.sampleMaterialPoint(s),slope=field(mid.center[0])[1],w=mid.widthAxis,scale=Math.hypot(w[0],w[1]+slope*w[0],w[2]);
  const p=v?strip.sampleMaterialPoint(s,v/scale):mid,[h,k]=field(p.center[0]),tangent=unit([p.tangent[0],p.tangent[1]+k*p.tangent[0],p.tangent[2]]),normal=unit([p.normal[0]-k*p.normal[1],p.normal[1],p.normal[2]]),widthAxis=unit([p.widthAxis[0],p.widthAxis[1]+k*p.widthAxis[0],p.widthAxis[2]]);
  return {...p,center:add([p.center[0],p.center[1]+h,p.center[2]],mul(normal,side*strip.thickness/2)),tangent,widthAxis,normal};
 };
 // Reparameterize the fitted centreline by measured arc distance. Contacts
 // retain their authored source coordinates through this mapping.
 const n=800,arc=[0];let prior=sampleSource(0).center;
 for(let i=1;i<=n;i++){const p=sampleSource(join*i/n).center;arc.push(arc.at(-1)+Math.hypot(...sub(p,prior)));prior=p;}
 const saved=join-arc.at(-1),toMaterial=s=>{if(s>=join)return s-saved;const x=Math.max(0,s/join*n),i=Math.min(n-1,Math.floor(x));return arc[i]+(arc[i+1]-arc[i])*(x-i)};
 const fromMaterial=s=>{if(s>=arc.at(-1))return s+saved;let lo=0,hi=n;while(hi-lo>1){const m=(lo+hi)>>1;if(arc[m]<=s)lo=m;else hi=m;}return (lo+(s-arc[lo])/(arc[hi]-arc[lo]))*join/n};
 return {saved,sampleSource,toMaterial,fromMaterial,root:sampleSource(0)};
}
export function fitStandingLead(part,reverse=false,field){
 const plan=planStandingLead(part.strip,field),length=part.length-plan.saved,positions=[],normals=[],uv=[];
 for(let i=0;i<part.positions.length;i++){
  const s=reverse?part.length-part.uv[i][0]:part.uv[i][0],v=reverse?-part.uv[i][1]:part.uv[i][1],p=plan.sampleSource(s,v);
  positions.push(p.center);normals.push(p.normal);uv.push([reverse?length-plan.toMaterial(s):plan.toMaterial(s),part.uv[i][1]]);
 }
 const sampleMaterialPoint=(s,v=0,side=0)=>({...plan.sampleSource(plan.fromMaterial(Math.max(0,Math.min(length,s))),v,side),materialS:s});
 const strip={...part.strip,totalMaterialS:length,visibleMaterialS:length,sourceMaterialLength:part.length,sourceToMaterial:plan.toMaterial,sampleMaterialPoint,samples:part.strip.samples.map(p=>sampleMaterialPoint(plan.toMaterial(p.materialS)))};
 return {...part,positions,normals,uv,length,strip,leadSaved:plan.saved};
}
export function buildWaistAdapter(part,reverse=false,root,height,rootSample){
 const first=root?{...root,widthAxis:mul(root.widthAxis,-1),tangent:mul(root.tangent,-1)}:part.strip.sampleMaterialPoint(0),last=part.strip.sampleMaterialPoint(part.length),sign=first.center[0]<0?-1:1;
 const a=first.center,e=[last.center[0],height,last.center[2]],b=add(a,mul(first.tangent,.04)),c=add(a,[sign*.23,0,-.04]),d=add(e,[-sign*.04,0,.06]);
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
