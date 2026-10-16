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
  behindBody:t>=2.8&&t<=3.75,
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
  const root=material==='A'?[-.43,.06]:[.43,.07],grip=holders[material];
  const front=smooth(t,3.8,4.5),raise=smooth(t,5.5,6.15),tailLength=.46;
  const down=[grip[0]+(material==='A'?.025:-.025),Math.min(.85,grip[1]+tailLength)];
  const straight=extend(root,grip,.12),tip=blend(down,straight,raise);
  // The grasp bend becomes a coplanar material boundary when the end is lifted.
  const startTip=[grip[0],Math.min(.85,grip[1]+.62)];
  let targets=[root,blend(startTip,tip,front)],names=['front-cross'],layers=[material==='A'?6:2];
  if(front>0){const bend=blend(blend(root,startTip,.35),grip,front);targets=[root,bend,blend(startTip,tip,front)];names=material==='A'?['front-cross','held-end']:['waist-run','held-end'];layers=[material==='A'?6:2,6];}
  // Match the existing B hanging-end pose at 9s without changing ownership.
  if(material==='B'&&t>=8){const q=smooth(t,8,9),oldTip=extend(root,grip,.12),pickup=blend(blend(root,oldTip,.75),grip,q);targets=[root,pickup,blend(oldTip,[grip[0]-.035,Math.min(.90,grip[1]+.43)],q)];names=['waist-run','hanging-end'];layers=[2,4];}
  const strip=makeStrip(material,targets,names,layers,{behind:phase.behindBody});
  return strip;
 });
 return {strips,phase,behindBody:phase.behindBody,
  contactCandidates:{Right:['A','B'],Left:['A','B']},
  contactWeight:phase.behindBody?0:1,
  notes:['Rear ownership is an authored inference. Both visible ends remain held throughout 7–8s.']};
}
