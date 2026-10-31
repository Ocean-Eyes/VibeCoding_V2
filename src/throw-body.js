// Shared visible body dimensions (metres). Contact checks must not use thinner
// substitutes than the cylinders, jacket and ellipsoids shown to the learner.
export const JACKET_ROWS=[[-.12,.22,.15],[.05,.18,.135],[.32,.23,.15],[.49,.22,.135]];
export const BODY_SIZE={thigh:[.105,.085],shin:[.084,.053],upperArm:[.082,.068],sleeve:[.067,.047],wrist:[.038,.034],hand:[.052,.052,.052],head:[.105,.137,.10],foot:[.055,.038,.115]};
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/(Math.hypot(...a)||1));
function axesUnique(values){const map=new Map();for(let n of values){if(Math.hypot(...n)<1e-9)continue;n=unit(n);if(n.find(v=>Math.abs(v)>1e-8)<0)n=mul(n,-1);const key=n.map(v=>Math.round(v*1e6)).join(',');if(!map.has(key))map.set(key,n);}return [...map.values()];}
function shape(id,points,faces){
 const normals=[],edges=[];for(const f of faces){normals.push(cross(sub(points[f[1]],points[f[0]]),sub(points[f[2]],points[f[0]])));for(let i=0;i<f.length;i++)edges.push(sub(points[f[(i+1)%f.length]],points[f[i]]));}
 const bounds=[0,1,2].map(i=>[Math.min(...points.map(p=>p[i])),Math.max(...points.map(p=>p[i]))]);
 return {id,points,faces,axes:axesUnique(normals),edges:axesUnique(edges),bounds};
}
export function tubeBody(id,a,b,r1,r2,sides=12){
 const axis=unit(sub(b,a)),u=unit(cross(axis,Math.abs(axis[2])<.9?[0,0,1]:[0,1,0])),v=cross(axis,u),points=[],faces=[];
 for(const [center,r] of [[a,r1],[b,r2]])for(let i=0;i<sides;i++)points.push(add(center,add(mul(u,r*Math.cos(i/sides*2*Math.PI)),mul(v,r*Math.sin(i/sides*2*Math.PI)))));
 for(let i=0;i<sides;i++){const j=(i+1)%sides;faces.push([i,j,j+sides,i+sides]);}
 faces.push(Array.from({length:sides},(_,i)=>i),Array.from({length:sides},(_,i)=>i+sides));return shape(id,points,faces);
}
export function ellipsoidBody(id,center,radii,basis){
 const points=[],faces=[],rows=8,sides=12;
 for(let i=0;i<=rows;i++)for(let j=0;j<sides;j++){const phi=i/rows*Math.PI,theta=j/sides*2*Math.PI,raw=[Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)];points.push(add(center,raw.reduce((p,k,n)=>add(p,mul(basis[n],k*radii[n])),[0,0,0])));}
 for(let i=1;i<=rows;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides;faces.push([(i-1)*sides+j,i*sides+j,i*sides+k],[(i-1)*sides+j,i*sides+k,(i-1)*sides+k]);}
 return shape(id,points,faces);
}
export function bodyShapes(rig){
 const out=[],basis=[rig.right,rig.up,rig.forward];
 for(let row=1;row<JACKET_ROWS.length;row++){
  const points=[],faces=[];for(const [y,rx,rz] of JACKET_ROWS.slice(row-1,row+1))for(let i=0;i<16;i++){const a=i*Math.PI/8;points.push(rig.at(rx*Math.cos(a),y,rz*Math.sin(a)));}
  for(let i=0;i<16;i++){const j=(i+1)%16;faces.push([i,j,j+16,i+16]);}faces.push(Array.from({length:16},(_,i)=>i),Array.from({length:16},(_,i)=>i+16));out.push(shape('torso.'+row,points,faces));
 }
 out.push(ellipsoidBody('head',rig.head,BODY_SIZE.head,basis));
 out.push(ellipsoidBody('head.hair',add(rig.head,mul(rig.up,.072)),[.108,.075,.103],basis));
 out.push(tubeBody('neck',rig.at(0,.48),rig.neck,.065,.06));
 for(const [side,leg] of Object.entries(rig.legs)){
  out.push(tubeBody('leg.'+side+'.thigh',leg.root,leg.joint,...BODY_SIZE.thigh),tubeBody('leg.'+side+'.shin',leg.joint,leg.end,...BODY_SIZE.shin));
  out.push(ellipsoidBody('leg.'+side+'.knee',leg.joint,[.085,.085,.085],basis));
  const f=[Math.sin(rig.yaw),0,Math.cos(rig.yaw)];out.push(ellipsoidBody('foot.'+side,add(leg.end,add(mul(f,.065),[0,-.027,0])),BODY_SIZE.foot,[rig.right,[0,1,0],f]));
 }
 for(const [side,arm] of Object.entries(rig.arms)){
  const cuff=add(arm.joint,mul(sub(arm.end,arm.joint),.82));
  out.push(tubeBody('arm.'+side+'.upper',arm.root,arm.joint,...BODY_SIZE.upperArm),tubeBody('arm.'+side+'.sleeve',arm.joint,cuff,...BODY_SIZE.sleeve),tubeBody('arm.'+side+'.wrist',cuff,arm.end,...BODY_SIZE.wrist),ellipsoidBody('hand.'+side,arm.end,BODY_SIZE.hand,basis));
  out.push(ellipsoidBody('arm.'+side+'.elbow',arm.joint,[.067,.067,.067],basis),ellipsoidBody('arm.'+side+'.shoulder',arm.root,[.081,.081,.081],basis));
 }
 return out;
}
// Exact separating-axis test for the convex pieces of the displayed meshes.
// The returned vector translates A out of B; no intentional-grip exclusions.
export function bodyOverlap(a,b,tolerance=0){
 if(a.bounds.some(([lo,hi],i)=>hi<=b.bounds[i][0]+tolerance||lo>=b.bounds[i][1]-tolerance))return null;
 let depth=Infinity,direction=null;
 const test=axis=>{const length=Math.hypot(...axis);if(length<1e-9)return true;const n=mul(axis,1/length);let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;for(const p of a.points){const d=dot(p,n);amin=Math.min(amin,d);amax=Math.max(amax,d)}for(const p of b.points){const d=dot(p,n);bmin=Math.min(bmin,d);bmax=Math.max(bmax,d)}
  const positive=bmax-amin,negative=amax-bmin,value=Math.min(positive,negative);if(value<=tolerance)return false;if(value<depth){depth=value;direction=mul(n,positive<negative?1:-1);}return true;};
 for(const axis of [...a.axes,...b.axes])if(!test(axis))return null;
 for(const u of a.edges)for(const v of b.edges)if(!test(cross(u,v)))return null;
 return {a:a.id,b:b.id,depth,direction};
}
export function bodyIntersections(pose,tolerance=.0001){const a=bodyShapes(pose.tori),b=bodyShapes(pose.uke),hits=[];for(const x of a)for(const y of b){const hit=bodyOverlap(x,y,tolerance);if(hit)hits.push(hit);}return hits.sort((a,b)=>b.depth-a.depth);}
