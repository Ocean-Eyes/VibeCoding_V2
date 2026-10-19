// Tightening releases the folded standing connections into the free ends.
// Their measured arc-length difference is transferred, never discarded.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),mix=(a,b,q)=>a.map((v,i)=>v+(b[i]-v)*q),unit=a=>mul(a,1/(Math.hypot(...a)||1)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function waistSettleWeight(t){const q=Math.max(0,Math.min(1,(t-18)/1.5));return q*q*(3-2*q)}
export function settleStandingWaist(part,drop,q){
 const positions=part.positions.map(v=>[v[0],v[1]-2*drop*(1-q),v[2]]);
 if(!q||part.name!=='middle-inner')return {...part,positions};
 // The inner wrap stays below the knot's return fold. Only the exposed
 // shoulders rise to the flat waist band; lifting the hidden centre would
 // drive it through A's folded core.
 const centres=[];
 for(let i=2;i<positions.length;i+=5){
  const p=positions[i],u=Math.max(0,Math.min(1,(Math.abs(p[0])-.17)/.12));
  centres.push([p[0],p[1]-2*drop*q*(1-u*u*(3-2*u)),p[2]]);
 }
 const arc=[0],oldArc=[0],normals=[],uv=[];
 for(let row=0;row<centres.length;row++){
  if(row){arc.push(arc.at(-1)+Math.hypot(...sub(centres[row],centres[row-1])));oldArc.push(oldArc.at(-1)+Math.hypot(...sub(part.positions[row*5+2],part.positions[(row-1)*5+2])));}
  const tangent=unit(sub(centres[Math.min(row+1,centres.length-1)],centres[Math.max(0,row-1)]));
  const width=unit([tangent[0]*tangent[1],-(tangent[0]**2+tangent[2]**2),tangent[2]*tangent[1]]).map(v=>-v);
  let normal=unit(cross(width,tangent));if(normal.reduce((s,v,i)=>s+v*part.normals[row*5+2][i],0)<0)normal=mul(normal,-1);
  for(let j=0;j<5;j++){positions[row*5+j]=add(centres[row],mul(width,part.uv[row*5+j][1]));normals.push(normal);}
 }
 const length=part.length+arc.at(-1)-oldArc.at(-1);
 for(let row=0;row<centres.length;row++)for(let j=0;j<5;j++)uv.push([arc[row]*length/arc.at(-1),part.uv[row*5+j][1]]);
 return {...part,positions,normals,uv,length};
}
export function settleWaistAdapter(part,q,reverse=false){
 if(!q)return part;
 const L=part.length,first=part.strip.sampleMaterialPoint(0),last=part.strip.sampleMaterialPoint(L),sign=first.center[0]<0?-1:1;
 const a=first.center,d=[last.center[0],.03,last.center[2]],b=add(a,[sign*.06,0,0]),c=add(d,[-sign*.04,0,.06]);
 b[1]=a[1];c[1]=d[1];
 const curve=u=>add(add(mul(a,(1-u)**3),mul(b,3*(1-u)**2*u)),add(mul(c,3*(1-u)*u*u),mul(d,u**3)));
 const derivative=u=>add(add(mul(sub(b,a),3*(1-u)**2),mul(sub(c,b),6*(1-u)*u)),mul(sub(d,c),3*u*u));
 const center=u=>mix(part.strip.sampleMaterialPoint(u*L).center,curve(u),q);
 const count=600,arc=[0];let previous=center(0);
 for(let i=1;i<=count;i++){const p=center(i/count);arc.push(arc.at(-1)+Math.hypot(...sub(p,previous)));previous=p;}
 const length=arc.at(-1),at=u=>{const x=Math.max(0,Math.min(count,u*count)),i=Math.min(count-1,Math.floor(x));return arc[i]+(arc[i+1]-arc[i])*(x-i)};
 const positions=[],normals=[],uv=[];
 for(let i=0;i<part.positions.length;i++){
  const s=reverse?L-part.uv[i][0]:part.uv[i][0],u=s/L,v=reverse?-part.uv[i][1]:part.uv[i][1],f=Math.min(1,u/.3),ease=f*f*(3-2*f),width=unit(mix(first.widthAxis,last.widthAxis,ease));
  positions.push(mix(part.positions[i],add(curve(u),mul(width,v)),q));
  const normal=unit(cross(width,unit(derivative(u))));
  normals.push(unit(mix(part.normals[i],normal,q)));
  uv.push([reverse?length-at(u):at(u),part.uv[i][1]]);
 }
 const sampleMaterialPoint=(s,v=0,side=0)=>{
  s=Math.max(0,Math.min(length,s));let lo=0,hi=count;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(arc[mid]<=s)lo=mid;else hi=mid;}
  const u=(lo+(s-arc[lo])/(arc[hi]-arc[lo]))/count,old=part.strip.sampleMaterialPoint(u*L,v),f=Math.min(1,u/.3),width=unit(mix(first.widthAxis,last.widthAxis,f*f*(3-2*f)));
  const normal=unit(mix(old.normal,unit(cross(width,unit(derivative(u)))),q));
  return {center:add(mix(old.center,add(curve(u),mul(width,v)),q),mul(normal,side*part.strip.thickness/2)),normal,materialS:s,u:v};
 };
 const strip={material:part.strip.material,width:part.strip.width,thickness:part.strip.thickness,totalMaterialS:length,sampleMaterialPoint};
 return {...part,positions,normals,uv,length,strip,releasedMaterial:L-length};
}
