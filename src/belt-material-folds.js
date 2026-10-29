// Isometric material-space ribbon: finite cylindrical bends, no centreline miter.
// Coordinates: u across width, s along material. A crease is s = at + k*u.
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.hypot(...a));
// Explicit three-component arithmetic avoids short-lived arrays in the dense
// contact mesh while retaining the same operation order and material geometry.
const I=[[1,0,0],[0,1,0],[0,0,1]],mv=(m,v)=>[m[0][0]*v[0]+m[1][0]*v[1]+m[2][0]*v[2],m[0][1]*v[0]+m[1][1]*v[1]+m[2][1]*v[2],m[0][2]*v[0]+m[1][2]*v[1]+m[2][2]*v[2]],mm=(a,b)=>b.map(c=>mv(a,c)),rotate=(v,h,a)=>{const c=Math.cos(a),s=Math.sin(a),d=dot(h,v)*(1-c);return [v[0]*c+(h[1]*v[2]-h[2]*v[1])*s+h[0]*d,v[1]*c+(h[2]*v[0]-h[0]*v[2])*s+h[1]*d,v[2]*c+(h[0]*v[1]-h[1]*v[0])*s+h[2]*d]};
export function foldMaterialStrip(material,{length,width=.09,thickness=.008,creases=[],origin=[0,0,0],basis=I,step=.006,across=12,sampleOnly=false,surfaceOnly=false,visibleMaterialS=length,longitudinalCuts=[]}={}){
 if(!(length>0&&width>0&&thickness>0&&step>0&&across>=2)||!Number.isInteger(across))throw Error('Positive material dimensions and mesh resolution required');
 if(![length,width,thickness,step,...origin,...basis.flat()].every(Number.isFinite))throw Error('Finite material transform required');
 if(basis.some(v=>Math.abs(Math.hypot(...v)-1)>1e-6)||Math.abs(dot(cross(basis[0],basis[1]),basis[2])-1)>1e-6)throw Error('Right-handed orthonormal material basis required');
 const folds=creases.filter(c=>Math.abs(c.angle??0)>1e-12).map((c,i)=>{const at=c.s??c.at,k=c.k??0,angle=c.angle??0,radius=c.radius??.008,n=Math.hypot(1,k),half=Math.abs(angle)*radius/2,H=[1/n,k/n,0],K=[-k/n,1/n,0];if(![at,k,angle,radius].every(Number.isFinite)||Math.abs(angle)>2*Math.PI+1e-9)throw Error('Finite single crease angle within plus/minus two pi required: '+i);if(!(radius>thickness/2))throw Error('Bend inner radius must remain positive: '+i);return{...c,at,k,angle,radius,n,half,H,K};});
 for(const u of[-width/2,width/2]){let end=0;for(const [i,f]of folds.entries()){const a=f.at+f.k*u-f.half*f.n,b=f.at+f.k*u+f.half*f.n;if(a<end-1e-9||b>length+1e-9)throw Error('Material bend domains overlap or escape strip at crease '+i+', u='+u);end=b;}}
 let M=basis.map(v=>[...v]),T=[...origin];
 for(const f of folds){f.M=M;f.T=T;const O=[0,f.at,0],r=f.radius*Math.sign(f.angle),rot=I.map(v=>rotate(v,f.H,f.angle)),RK=mv(rot,f.K),offset=add(sub(O,mv(rot,O)),add(add(mul(f.K,-f.half+r*Math.sin(f.angle)),[0,0,r*(1-Math.cos(f.angle))]),mul(RK,-f.half)));T=add(T,mv(M,offset));M=mm(M,rot);f.outM=M;f.outT=T;}
 const sample=(s,u=0,side=0,positionOnly=false)=>{s=Math.max(0,Math.min(length,s));let m=basis,t=origin,p=[u,s,0],normal=[0,0,1],tangent=[0,1,0],widthAxis=[1,0,0];for(const f of folds){const v=(s-f.at-f.k*u)/f.n;if(v< -f.half)break;if(v<=f.half&&f.half>1e-12){const a=(v+f.half)/f.radius*Math.sign(f.angle),r=f.radius*Math.sign(f.angle),h=(u+f.k*(s-f.at))/f.n;p=add(add([0,f.at,0],mul(f.H,h)),add(mul(f.K,-f.half+r*Math.sin(a)),[0,0,r*(1-Math.cos(a))]));if(!positionOnly){const ca=Math.cos(a),sa=Math.sin(a),hx=f.H[0],hy=f.H[1],dx=hx*(1-ca),dy=hy*(1-ca);normal=[hy*sa,-hx*sa,ca];tangent=[hx*dy,ca+hy*dy,hx*sa];widthAxis=[ca+hx*dx,hy*dx,-hy*sa];}m=f.M;t=f.T;break;}m=f.outM;t=f.outT;}
  if(positionOnly)return add(t,mv(m,p));const n=mv(m,normal);return{center:add(add(t,mv(m,p)),mul(n,side*thickness/2)),normal:n,tangent:mv(m,tangent),widthAxis:mv(m,widthAxis),materialS:s,u};};
 const segments=[];let start=0;for(const [i,f]of folds.entries()){segments.push({name:f.before??'panel-'+i,fromS:start,toS:f.at});start=f.at;}segments.push({name:'outgoing-run',fromS:start,toS:length});
 const common={material,width,thickness,segments,visibleMaterialS:Math.max(1e-6,Math.min(length,visibleMaterialS)),totalMaterialS:length,sampleMaterialPoint:sample,sampleCenter:(s,u=0)=>sample(s,u,0,true),creases:folds.map(({M,T,outM,outT,...f})=>f),model:'isometric finite-radius cylindrical crease bands'};
 if(sampleOnly)return common;
 const sValues=new Set([0,length]);for(let s=step;s<length;s+=step)sValues.add(s);for(const f of folds)for(const u of[-width/2,0,width/2])for(const sign of[-1,0,1])sValues.add(Math.max(0,Math.min(length,f.at+f.k*u+sign*f.half*f.n)));const allS=[...sValues].sort((a,b)=>a-b),ss=allS.filter(s=>s<common.visibleMaterialS);ss.push(common.visibleMaterialS);const vertices3D=[],vertexMaterial=[],vertexNormals=[],triangles=[];
 // Tessellate in material crease coordinates. Flat patches remain exact planes;
 // only cylindrical bend patches need angular subdivision.
 const uv=[],uvMap=new Map(),frontTriangles=[];
 const vertex=(u,s)=>{u=Math.max(-width/2,Math.min(width/2,u));s=Math.max(0,Math.min(common.visibleMaterialS,s));const uk=Math.round(u*1e11),sk=Math.round(s*1e11);let row=uvMap.get(uk);if(!row){row=new Map();uvMap.set(uk,row)}if(row.has(sk))return row.get(sk);const i=uv.length;uv.push([u,s]);row.set(sk,i);return i;};
 const clip=(poly,k,b,keepAbove)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length],da=(a[1]-k*a[0]-b)*(keepAbove?1:-1),dc=(c[1]-k*c[0]-b)*(keepAbove?1:-1),ina=da>=-1e-12,inc=dc>=-1e-12;if(ina)out.push(a);if(ina!==inc){const t=da/(da-dc);out.push([a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t]);}}return out;};
 function patch(lower,upper){for(let j=0;j<across;j++){const lo=-width/2+width*j/across,hi=-width/2+width*(j+1)/across;let poly=[[lo,0],[hi,0],[hi,common.visibleMaterialS],[lo,common.visibleMaterialS]];if(lower)poly=clip(poly,lower.k,lower.b,true);if(upper&&poly.length)poly=clip(poly,upper.k,upper.b,false);if(poly.length<3)continue;
  // Most cuts are outside this narrow crease patch. Those clips would only
  // copy the same polygon (or consume it whole), without adding any geometry.
  const minS=Math.min(...poly.map(p=>p[1])),maxS=Math.max(...poly.map(p=>p[1]));
  const pieces=[];for(const cut of longitudinalCuts){if(!poly.length)break;if(cut<minS-1e-12)continue;if(cut>maxS+1e-12)break;const before=clip(poly,0,cut,false);if(before.length>=3)pieces.push(before);poly=clip(poly,0,cut,true);}if(poly.length>=3)pieces.push(poly);
  for(const piece of pieces){const ids=piece.map(([u,s])=>vertex(u,s));for(let i=1;i<ids.length-1;i++){const a=uv[ids[0]],b=uv[ids[i]],c=uv[ids[i+1]],area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(area)>1e-14)frontTriangles.push([ids[0],ids[i],ids[i+1]]);}}
 }}
 let prior=null;for(const f of folds){const lower={k:f.k,b:f.at-f.half*f.n},upper={k:f.k,b:f.at+f.half*f.n};patch(prior,lower);const count=Math.max(1,Math.ceil(Math.abs(f.angle)/(Math.PI/16)));for(let i=0;i<count;i++)patch({k:f.k,b:lower.b+(upper.b-lower.b)*i/count},{k:f.k,b:lower.b+(upper.b-lower.b)*(i+1)/count});prior=upper;}patch(prior,null);
 const plane=uv.length,grid=uv.map(([u,s])=>sample(s,u));
 // The assembled belt adds thickness once, after fitting and seam welding.
 if(surfaceOnly)return {...common,surfacePositions:grid.map(p=>p.center),surfaceNormals:grid.map(p=>p.normal),surfaceUV:uv.map(([u,s])=>[s,u]),surfaceTriangles:frontTriangles,samples:ss.map(s=>sample(s)),fullSamples:allS.map(s=>sample(s))};
 for(const side of[-1,1])for(const point of grid){vertices3D.push(add(point.center,mul(point.normal,side*thickness/2)));vertexNormals.push(mul(point.normal,side));vertexMaterial.push({materialS:point.materialS,v:point.u});}
 const boundaries=new Map();for(const ids of frontTriangles){triangles.push([ids[2],ids[1],ids[0]],ids.map(i=>i+plane));for(let i=0;i<3;i++){const a=ids[i],b=ids[(i+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);if(boundaries.has(key))boundaries.delete(key);else boundaries.set(key,[a,b]);}}
 for(const[a,b]of boundaries.values())triangles.push([a,b,b+plane],[a,b+plane,a+plane]);
 const data=new Float32Array(triangles.length*24);let cursor=0;for(const ids of triangles){const broad=ids.every(i=>i<plane)||ids.every(i=>i>=plane);let normal=null;if(!broad){const[a,b,c]=ids.map(i=>vertices3D[i]),raw=cross(sub(b,a),sub(c,a));normal=Math.hypot(...raw)>1e-14?unit(raw):[0,0,1];}for(const id of ids){const v=vertexMaterial[id],p=vertices3D[id],n=broad?vertexNormals[id]:normal;data[cursor++]=p[0];data[cursor++]=p[1];data[cursor++]=p[2];data[cursor++]=n[0];data[cursor++]=n[1];data[cursor++]=n[2];data[cursor++]=v.v/width;data[cursor++]=v.materialS;}}
 const samples=ss.map(s=>sample(s));
 return{...common,vertices3D,vertexMaterial,triangles,vertexData:data,samples,fullSamples:allS.map(s=>sample(s))};
}

export const planMaterialStrip=(material,options={})=>foldMaterialStrip(material,{...options,sampleOnly:true});
