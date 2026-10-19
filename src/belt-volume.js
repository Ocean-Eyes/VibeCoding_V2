// Character-native reconstructed 3D ribbon. Hidden depth is authored, not measured.
export const BELT_WIDTH=.09, BELT_THICKNESS=.008;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=a=>Math.hypot(...a),unit=a=>mul(a,1/(length(a)||1)),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),clamp=x=>Math.max(0,Math.min(1,x)),smooth=(t,a,b)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u)};
const rotate=(v,n,a)=>add(add(mul(v,Math.cos(a)),mul(cross(n,v),Math.sin(a))),mul(n,dot(n,v)*(1-Math.cos(a))));
const node=(point,widthAxis=[0,1,0],radius=.018)=>({point,widthAxis,radius});
function roundedPath(nodes,spacing=.009){
 const corners=nodes.map((p,i)=>{if(!i||i===nodes.length-1)return{start:p.point,end:p.point,axis:p.widthAxis};
  const before=nodes[i-1].point,after=nodes[i+1].point,incoming=unit(sub(p.point,before)),outgoing=unit(sub(after,p.point)),angle=Math.acos(Math.max(-1,Math.min(1,dot(incoming,outgoing)))),normal=unit(cross(incoming,outgoing));
  if(p.radius<=1e-7||angle<1e-5||angle>Math.PI-1e-4)return{start:p.point,end:p.point,axis:p.widthAxis};
  const trim=Math.min(p.radius*Math.tan(angle/2),length(sub(p.point,before))*.28,length(sub(after,p.point))*.28),radius=trim/Math.tan(angle/2),start=sub(p.point,mul(incoming,trim)),end=add(p.point,mul(outgoing,trim)),center=add(start,mul(unit(cross(normal,incoming)),radius));
  return{start,end,center,normal,angle,axis:p.widthAxis};});
 const out=[],nodeIndices=[0];function appendLine(a,b,na,nb){const n=Math.max(1,Math.ceil(length(sub(b,a))/spacing));for(let i=0;i<n;i++)out.push({center:mix(a,b,i/n),guide:unit(mix(na,nb,i/n))});}
 for(let i=0;i<corners.length-1;i++){const a=corners[i],b=corners[i+1];appendLine(a.end,b.start,a.axis,b.axis);if(b.center){const radial=sub(b.start,b.center),n=Math.max(4,2*Math.ceil(length(radial)*b.angle/(2*spacing)));nodeIndices[i+1]=out.length+n/2;for(let j=0;j<n;j++)out.push({center:add(b.center,rotate(radial,b.normal,b.angle*j/n)),guide:b.axis});}else nodeIndices[i+1]=out.length;}
 const last=corners.at(-1);out.push({center:last.end,guide:last.axis});
 let materialS=0,previousAxis=null;const samples=out.map((p,i)=>{if(i)materialS+=length(sub(p.center,out[i-1].center));const tangent=unit(sub(out[Math.min(i+1,out.length-1)].center,out[Math.max(0,i-1)].center));let widthAxis=sub(p.guide,mul(tangent,dot(p.guide,tangent)));if(length(widthAxis)<.1){const fallback=previousAxis??[1,0,0];widthAxis=sub(fallback,mul(tangent,dot(fallback,tangent)));if(length(widthAxis)<.01)widthAxis=cross(tangent,[0,0,1]);}widthAxis=unit(widthAxis);if(previousAxis&&dot(widthAxis,previousAxis)<0)widthAxis=mul(widthAxis,-1);previousAxis=widthAxis;return{center:p.center,tangent,widthAxis,normal:unit(cross(tangent,widthAxis)),materialS};});samples.nodeIndices=nodeIndices;return samples;
}
function visibleSamples(samples,maxS){if(maxS>=samples.at(-1).materialS)return samples;const out=[];for(let i=0;i<samples.length;i++){const p=samples[i];if(p.materialS<=maxS)out.push(p);else{const a=samples[i-1],q=(maxS-a.materialS)/(p.materialS-a.materialS),tangent=unit(mix(a.tangent,p.tangent,q)),raw=mix(a.widthAxis,p.widthAxis,q),widthAxis=unit(sub(raw,mul(tangent,dot(raw,tangent))));out.push({center:mix(a.center,p.center,q),tangent,widthAxis,normal:unit(cross(tangent,widthAxis)),materialS:maxS});break;}}return out;}
export function ribbonMesh(material,samples,{width=BELT_WIDTH,thickness=BELT_THICKNESS,maxS=Infinity}={}){
 const fullSamples=samples,shown=visibleSamples(samples,Math.max(.0001,maxS)),vertices3D=[],vertexMaterial=[],triangles=[];
 for(const p of shown)for(const [w,h]of[[-1,-1],[1,-1],[1,1],[-1,1]]){vertices3D.push(add(add(p.center,mul(p.widthAxis,w*width/2)),mul(p.normal,h*thickness/2)));vertexMaterial.push({materialS:p.materialS,v:w*width/2});}
 for(let i=0;i<shown.length-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+(j+1)%4,d=(i+1)*4+j;triangles.push([a,b,c],[a,c,d]);}
 triangles.push([0,2,1],[0,3,2]);const end=(shown.length-1)*4;triangles.push([end,end+1,end+2],[end,end+2,end+3]);
 const vertexData=[];for(const triangle of triangles){const [a,b,c]=triangle.map(i=>vertices3D[i]),normal=unit(cross(sub(b,a),sub(c,a)));for(const i of triangle){const p=vertices3D[i],m=vertexMaterial[i];vertexData.push(...p,...normal,m.v/width,m.materialS);}}
 return{material,width,thickness,samples:shown,fullSamples,vertices3D,triangles,vertexMaterial,vertexData:new Float32Array(vertexData),visibleMaterialS:shown.at(-1).materialS,totalMaterialS:fullSamples.at(-1).materialS};
}
export function contactpointByfraction(strip,fraction,{visible=true}={}){const samples=visible?strip.samples:strip.fullSamples,s=clamp(fraction)*samples.at(-1).materialS;let i=1;while(i<samples.length-1&&samples[i].materialS<s)i++;const a=samples[i-1],b=samples[i],q=(s-a.materialS)/(b.materialS-a.materialS||1);return{center:mix(a.center,b.center,q),widthAxis:unit(mix(a.widthAxis,b.widthAxis,q)),tangent:unit(mix(a.tangent,b.tangent,q)),materialS:s,fraction:clamp(fraction)};}
export function contactpointByMaterialS(strip,materialS,{visible=true}={}){const limit=visible?strip.visibleMaterialS:strip.totalMaterialS,s=Math.max(0,Math.min(limit,materialS));if(strip.sampleMaterialPoint)return strip.sampleMaterialPoint(s);const samples=visible?strip.samples:strip.fullSamples;return contactpointByfraction(strip,s/samples.at(-1).materialS,{visible});}
function attachSegments(strip,nodes,names){const indices=strip.fullSamples.nodeIndices;strip.segments=names.map((name,i)=>({name,fromS:strip.fullSamples[indices[i]].materialS,toS:strip.fullSamples[indices[i+1]].materialS}));strip.anchors=Object.fromEntries(names.map((name,i)=>[name,strip.fullSamples[indices[i+1]].materialS]));return strip;}
export function contactpointBySemantic(strip,name,fraction=.5,{visible=true}={}){const segment=strip.segments.find(s=>s.name===name);if(!segment)return null;const s=segment.fromS+(segment.toS-segment.fromS)*clamp(fraction);if(visible&&s>strip.visibleMaterialS)return null;return contactpointByMaterialS(strip,s,{visible});}
export function buildVolumeBelt(t,{gL=[.64,.195],gR=[-.64,.195],tailA=null,tailB=null}={}){
 const tight=smooth(t,18.25,19.5),p=(a,b)=>mix(a,b,tight),L=tailA??p([-.58,.30,.16],[-.64,.195,.16]),R=tailB??p([.60,.26,.17],[.64,.195,.17]);
 // The first A return goes behind BOTH waist layers. Its left return uses their gap.
 const waistDepth=x=>.17*(Math.sqrt(Math.max(.01,1-(x/.43)**2))-1),gapPoint=point=>[point[0],point[1],waistDepth(point[0])+.0175],gapAxis=x=>unit([1,0,-.17*x/(.43*.43*Math.sqrt(Math.max(.01,1-(x/.43)**2)))]);
 const standingPoint=point=>[point[0],point[1],waistDepth(point[0])+.035];
 const waistTangent=x=>unit([.43*Math.sqrt(1-(x/.43)**2),0,-.17*x/.43]),rootA=standingPoint(p([-.32,.04,0],[-.26,.04,0])),rootB=standingPoint(p([.32,.04,0],[.26,.04,0]));
 const wrapAxis=unit(p([.15,.98,0],[.87,.50,0]));
 const A=[node(rootA),node(add(rootA,mul(waistTangent(rootA[0]),.035)),[0,1,0],.008),node(p([.17,.17,.10],[.17,.04,.105])),node(p([.17,.195,.08],[.05,.11,.08]),[1,0,0],.012),node(p([.17,.195,-.035],[.05,.11,-.035]),[1,0,0],.012),node(p([.08,-.105,-.035],[.035,-.055,-.035]),[1,0,0],.012),node(p([.08,-.105,.19],[.035,-.055,.20]),wrapAxis,.018),node(p([-.18,-.065,.17],[-.065,.12,.20]),wrapAxis,.018),node(gapPoint(p([-.18,-.065,.006],[-.065,.12,.013])),gapAxis(p([-.18],[-.065])[0]),.012),node(gapPoint(p([-.21,.17,.006],[-.005,.12,.013])),gapAxis(p([-.21],[-.005])[0]),.012),node(p([-.23,.19,.14],[-.005,.12,.14]),[0,1,0],.012),node(L)];
 // B passes the aperture along its real depth normal, then turns toward the right tail.
 const aperture={center:p([-.005,.030,.125],[-.005,.022,.145]),normal:unit(p([.30,0,.954],[.96,0,.28])),longAxis:[0,1,0],shortAxis:unit(p([.954,0,-.30],[.28,0,-.96])),targetClearSpan:[.16,.085],clearanceStatus:'target only; not measured against mesh'};aperture.targetClearSpan=p([.20,.11],[.105,.018]);
 const approach=sub(aperture.center,mul(aperture.normal,.08)),emerge=add(aperture.center,mul(aperture.normal,p([.055],[.025])[0]));
 const bx=p([.28],[.16])[0];
 const B=[node(rootB),node(sub(rootB,mul(waistTangent(rootB[0]),.035)),[0,1,0],.008),node(gapPoint(p([.15,-.075,0],[.12,-.025,0])),gapAxis(p([.15],[.12])[0]),.008),node(gapPoint([bx,p([.17],[.14])[0],0]),gapAxis(bx),.012),node(p([.28,.17,.055],[.16,.14,.14]),gapAxis(bx),.012),node(approach,aperture.longAxis),node(aperture.center,aperture.longAxis,.01),node(emerge,aperture.longAxis,.014),node(p([.22,.10,.20],mix(emerge,R,.20)),[0,1,0]),node(R)];
 const fullA=roundedPath(A),fullB=roundedPath(B),entryIndex=fullB.nodeIndices[2],startS=fullB[entryIndex].materialS,feed=smooth(t,16.5,17.65),visibleB=startS+(fullB.at(-1).materialS-startS)*feed;
 let strips=[attachSegments(ribbonMesh('A',fullA),A,['waist-standing','low-front-run','underpass-entry','underpass-depth','underpass-rise','upper-exit','upper-return','left-gap-entry','left-gap-pass','outgoing-shoulder','outgoing-run']),attachSegments(ribbonMesh('B',fullB,{maxS:visibleB}),B,['waist-standing','waist-feed','between-layers','layer-exit','approach','aperture-entry','aperture-exit','outgoing-shoulder','outgoing-run'])],waist=[];
 if(t<16.5){
  const q=smooth(t,16,16.5),prefix=visibleSamples(fullB,startS),root=B[0].point,sourceHeld=[gR[0],gR[1],.18],sourceVector=sub(sourceHeld,root),sourceD=unit(sourceVector),sourceLength=length(sourceVector),guide=prefix[0].widthAxis,sourceN=unit(sub(guide,mul(sourceD,dot(guide,sourceD))));
  let materialS=0,lastCenter=null;
  const samples=prefix.map(p=>{const u=p.materialS/startS,center=mix(add(root,mul(sourceVector,u)),p.center,q),tangent=unit(add(mul(sourceD,(1-q)*sourceLength/startS),mul(p.tangent,q))),axis=mix(sourceN,p.widthAxis,q),widthAxis=unit(sub(axis,mul(tangent,dot(axis,tangent))));if(lastCenter)materialS+=length(sub(center,lastCenter));lastCenter=center;return{center,tangent,widthAxis,normal:unit(cross(tangent,widthAxis)),materialS};});
  const heldS=materialS,last=samples.at(-1),freeLength=.08*(1-q);
  if(freeLength>1e-10)samples.push({...last,center:add(last.center,mul(last.tangent,freeLength)),materialS:heldS+freeLength});
  const prep=ribbonMesh('B',samples);prep.segments=[{name:'lifted-feed',fromS:0,toS:heldS},{name:'waist-feed',fromS:0,toS:heldS},{name:'free-tip',fromS:heldS,toS:heldS+freeLength}];prep.anchors={'lifted-feed':heldS,'waist-feed':heldS,'free-tip':heldS+freeLength};strips[1]=prep;
 }
 for(let layer=0;layer<2;layer++){
  const start=layer?Math.asin(rootB[0]/.43):-Math.PI,end=layer?2*Math.PI+Math.asin(rootA[0]/.43):Math.PI,count=Math.ceil((end-start)/(2*Math.PI)*160),samples=[];let materialS=0,previous=null;
  for(let i=0;i<=count;i++){const angle=start+(end-start)*i/count,center=[.43*Math.sin(angle),.04,.17*(Math.cos(angle)-1)+layer*.035],tangent=unit([.43*Math.cos(angle),0,-.17*Math.sin(angle)]),widthAxis=[0,1,0];if(previous)materialS+=length(sub(center,previous));previous=center;samples.push({center,tangent,widthAxis,normal:unit(cross(tangent,widthAxis)),materialS});}
  waist.push(ribbonMesh('waist'+layer,samples));
 }

 const data=[...waist,...strips],vertexData=new Float32Array(data.reduce((n,s)=>n+s.vertexData.length,0));let offset=0;for(const strip of data){vertexData.set(strip.vertexData,offset);offset+=strip.vertexData.length;}
 return{originalPTS:t,strips,waist,vertexData,aperture,contacts:{A:contactpointBySemantic(strips[0],'outgoing-run',.65),B:contactpointBySemantic(strips[1],'outgoing-run',.65)},inference:{depth:'authored monocular reconstruction; not measured',firstUnderpass:'A behind both waist layers',leftPass:'A between waist layers',BTransit:'negative to positive aperture signed depth before tightening',status:'prototype; mesh clearance and visual review pending',standingConnection:'outer front central arc is replaced by A/B standing runs; root cross-sections match the open outer arc',backConnection:'local front reconstruction; back layer splice not yet reconstructed as a single material strip'}};
}
