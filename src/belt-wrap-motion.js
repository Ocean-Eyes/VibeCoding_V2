// Instructional wrap routing. Hidden rear exchange is inferred, never measured.
// The visible front uses two continuous strips connected to their holding hands.
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(t,a,b)=>{const q=clamp((t-a)/(b-a));return q*q*(3-2*q)};
const blend=(a,b,q)=>a.map((v,i)=>v+(b[i]-v)*q);
const extend=(root,p,n)=>{const x=p[0]-root[0],y=p[1]-root[1],d=Math.hypot(x,y)||1;return[p[0]+x/d*n,p[1]+y/d*n]};

export function wrapPhase(t){
 const rear=smooth(t,2.55,2.95)*(1-smooth(t,3.55,3.95));
 const front=smooth(t,4.15,5.35);
 return {
  phase:t<2.55?'center-front':t<3.95?'rear-wrap':t<5.35?'front-cross':'wrapped',
  // One center band is present initially. The second wrap advances from the hips.
  waistBands:[{from:-.43,to:.43,y:.035,layer:0},
   ...(front>0?[{from:-.43,to:-.43+.43*front,y:.072,layer:1},{from:.43-.43*front,to:.43,y:.072,layer:1}]:[])],
  completedLayers:front===1?2:1,secondLayerProgress:front,rearProgress:rear,
  behindBody:t>=2.8&&t<3.95,
  frontMaterialProgress:1-smooth(t,2.55,2.8)+smooth(t,3.95,4.4),
  contactWeight:(1-smooth(t,2.55,2.8))+smooth(t,3.95,4.4),
  // While completely occluded, the two front routes exchange sides; physical hand ownership is not measured.
  rearRoutingConfidence:'authored rear-path inference; source rear exchange is occluded',
 };
}

export function earlyWrapMotion(t,hands,makeStrip){
 if(t>=9)return null;
 const phase=wrapPhase(t),left=hands.Left?.grip??[.4,.08],right=hands.Right?.grip??[-.4,.08];
 const exchange=smooth(t,2.95,3.5);
 // No interpolation between opposite hands in the visible 7–8s section.
 const holders={A:blend(right,left,exchange),B:blend(left,right,exchange)};
 const strips=['A','B'].map(material=>{
  const canonicalRoot=material==='A'?[-.43,.06]:[.43,.07],returnRoot=blend(canonicalRoot,[-canonicalRoot[0],canonicalRoot[1]],exchange);
  const crossing=smooth(t,4.15,5.0),root=blend(returnRoot,canonicalRoot,crossing),sourceGrip=holders[material];
  // Returning cloth emerges at the hip. Only the visible material interval grows;
  // a complete crossed front route is never switched on at the rear/front boundary.
  // The attachment advances with the second waist layer while the held front
  // crossing settles below the standing band, rather than disappearing inside it.
  const settle=crossing*(1-smooth(t,5.35,5.8));
  const grip=[sourceGrip[0],sourceGrip[1]+Math.max(0,.245-sourceGrip[1])*settle];
  const raise=smooth(t,5.5,6.15),tailLength=.46;
  const down=[grip[0]+(material==='A'?-.18:.18)*crossing,Math.min(.85,grip[1]+tailLength)];
  const straight=extend(root,grip,.12),tip=blend(down,straight,raise);
  const startTip=[grip[0],Math.min(.85,grip[1]+.62)];
  // Do not interpolate a crease through the interior of an opposing face.
  // Before returning there is one broad hanging face; afterwards the held bend
  // itself is the material boundary, so frames238-243 cannot collapse edge-on.
  let targets=t<3.95?[root,startTip]:[root,grip,tip];
  let names=t<3.95?['rear-return']:material==='A'?['front-cross','held-end']:['waist-run','held-end'];
  // Standing waist cloth occludes the returning attachment. Its cap is not a free end.
  let layers=t<3.95?[material==='A'?6:2]:[-4,6];
  // B is still held broad in the source through 9.3s. Do not begin its drop
  // while the hand remains stationary (the old 8s transition twisted the tail).
  if(material==='B'&&t>=8){const q=0,oldTip=extend(root,grip,.12),pickup=blend(blend(root,oldTip,.75),grip,q);targets=[root,pickup,blend(oldTip,[grip[0]-.035,Math.min(.90,grip[1]+.43)],q)];names=['waist-run','hanging-end'];layers=[2,4];}
  const strip=makeStrip(material,targets,names,layers,{behind:phase.behindBody,tipProgress:Math.min(1,phase.frontMaterialProgress)});
  return strip;
 });
 return {strips,phase,behindBody:phase.behindBody,
  contactCandidates:{Right:['A','B'],Left:['A','B']},
  contactWeight:Math.min(1,phase.contactWeight),
  notes:['Rear ownership is an authored inference. Both visible ends remain held throughout 7–8s.']};
}
