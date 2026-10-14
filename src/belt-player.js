// Continuous observation player. No video/image pixels or authored knot paths.
// Input points are normalized to source width/height; PTS is in seconds.
// This module deliberately cannot certify occluded material or 3D topology.
const finite=Number.isFinite;
const point=p=>Array.isArray(p)&&p.length===2&&p.every(finite);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const confidence=v=>finite(v)?clamp(v,0,1):null;
const eligible=(r,min,review)=>['observed','model-estimated','image-edge-observed','image-shading-observed'].includes(r.visibility)&&(finite(r.confidence)?r.confidence>=min:r.renderEligibility===true)&&(review||r.validationStatus==='approved');
const contour=points=>Array.isArray(points)&&points.length>=3&&points.every(point);
function regionAt(region,index){
 const boundary=region.contour??region.polygon;
 if(!contour(boundary))return null;
 const visibility=region.visibility??'unknown';
 return {...region,id:String(region.id??region.regionId??index),materialIdentity:['a','b'].includes(region.materialIdentity)?region.materialIdentity:'unknown',
  contour:boundary.map(p=>p.slice()),holes:(region.holes??[]).filter(contour).map(r=>r.map(p=>p.slice())),
  confidence:confidence(region.confidence),visibility,method:region.method??'unspecified',
  depthOrder:finite(region.depthOrder)?region.depthOrder:null,
  depthEvidence:region.depthEvidence??'unknown'};
}
function endAt(end){
 if(!end)return null;
 return {tip:point(end.tip)?end.tip.slice():null,widthEdge0:point(end.widthEdge0)?end.widthEdge0.slice():null,widthEdge1:point(end.widthEdge1)?end.widthEdge1.slice():null,
  visible:end.visible===true,confidence:confidence(end.confidence),identityConfidence:confidence(end.identityConfidence),method:end.method??'unspecified'};
}
export function normalizeTracking(input,review=null){
 const width=input.source?.width,height=input.source?.height;
 if(!finite(width)||!finite(height)||width<=0||height<=0)throw new Error('Source dimensions are required');
 if(!Array.isArray(input.frames)||!input.frames.length)throw new Error('Continuous source frames are required');
 if(finite(input.source.decodedFrames)&&input.source.decodedFrames!==input.frames.length)throw new Error('Decoded frame coverage mismatch');
 let previous=-Infinity;
 const frames=input.frames.map((frame,index)=>{
  const pts=frame.originalPTS??frame.timestamp;
  if(finite(input.source.decodedFrames)&&(frame.frameIndex??index)!==index)throw new Error('Decoded frame index gap');
  if(!finite(pts)||pts<0||pts<=previous)throw new Error(`Frame ${index} must have strictly increasing original PTS`);previous=pts;
  const rawWaist=frame.waistAnchor?.xy??frame.waistAnchor;
  const waist=point(rawWaist)?rawWaist:rawWaist&&finite(rawWaist.x)&&finite(rawWaist.y)?[rawWaist.x,rawWaist.y]:null;
  const waistWidth=frame.waistWidth;
  const bodyValid=point(waist)&&finite(waistWidth)&&waistWidth>0;
  return {frameIndex:frame.frameIndex??index,originalPTS:pts,waistAnchor:bodyValid?waist.slice():null,waistWidth:bodyValid?waistWidth:null,
   waistConfidence:confidence(frame.waistConfidence??frame.waistAnchor?.confidence),
   beltRegions:(frame.beltRegions??frame.beltVisibleRegions??[]).map(regionAt).filter(Boolean),
   handRegions:(frame.handRegions??[]).map(regionAt).filter(Boolean),
   beltShading:(frame.beltShading??[]).map(regionAt).filter(Boolean),
   beltEdges:(frame.beltEdges??[]).filter(e=>Array.isArray(e.points)&&e.points.length>=2&&e.points.every(point)).map(e=>({...e,points:e.points.map(p=>p.slice()),confidence:confidence(e.confidence),visibility:e.visibility??'unknown'})),
   beltEnds:{a:endAt(frame.beltEnds?.a??frame.beltEnds?.A),b:endAt(frame.beltEnds?.b??frame.beltEnds?.B)},
   hands:frame.hands??[],crossings:frame.crossings??[],observations:frame.observations??[],
   sourceImage:frame.sourceImage??null};
 });
 return {schemaVersion:1,review,source:{...input.source,width,height},frames,startPTS:frames[0].originalPTS,endPTS:frames.at(-1).originalPTS};
}
// Choose the last observed frame at the playback time. Do not interpolate a
// hidden tip through a belt layer, or use future observations before their PTS.
export function sampleTracking(track,pts){
 if(!finite(pts))throw new Error('Playback PTS must be finite');
 const frames=track.frames;
 let lo=0,hi=frames.length-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].originalPTS<=pts)lo=mid;else hi=mid-1}
 const frame=frames[lo];
 return {frame,index:lo,requestedPTS:pts,age:Math.max(0,pts-frame.originalPTS),clamped:pts<track.startPTS||pts>track.endPTS};
}
// Source x and y must first use their own pixel dimensions. A uniform waist
// scale then preserves the observed surface silhouette and strip proportions.
export function toWaistPoint(track,frame,p){
 if(!point(p)||!frame.waistAnchor)return null;
 const pixelsPerWaist=frame.waistWidth*track.source.width;
 return [(p[0]-frame.waistAnchor[0])*track.source.width/pixelsPerWaist,(p[1]-frame.waistAnchor[1])*track.source.height/pixelsPerWaist];
}
export function trackingPose(track,pts,{minimumConfidence=.45,maxObservationAge=.1,minimumWaistConfidence=.5,allowUnreviewed=false}={}){
 const sampled=sampleTracking(track,pts),{frame}=sampled,stale=sampled.age>maxObservationAge&&!sampled.clamped;
 const approved=track.review?.status==='approved';
 const mapped=regions=>regions.filter(r=>eligible(r,minimumConfidence,allowUnreviewed||approved)).map(r=>({...r,
  contour:r.contour.map(p=>toWaistPoint(track,frame,p)),holes:r.holes.map(h=>h.map(p=>toWaistPoint(track,frame,p)))}));
 const registration=track.review?.registration;
 const registered=approved&&registration?.status==='approved-fixed-registration'&&frame.waistAnchor?.[0]===registration.anchor[0]&&frame.waistAnchor?.[1]===registration.anchor[1]&&frame.waistWidth===registration.width;
 const bodyValid=!!frame.waistAnchor&&(registered||allowUnreviewed||frame.waistConfidence>=minimumWaistConfidence);
 return {format:'tracked-belt-2d',originalPTS:frame.originalPTS,requestedPTS:pts,frameIndex:frame.frameIndex,
  sourceMirrored:!!track.source.mirrored,bodyValid,stale,clamped:sampled.clamped,reviewMode:allowUnreviewed,
  beltRegions:bodyValid&&!stale?mapped(frame.beltRegions):[],handRegions:bodyValid&&!stale?mapped(frame.handRegions):[],
  beltShading:bodyValid&&!stale?mapped(frame.beltShading):[],
  beltEdges:bodyValid&&!stale?frame.beltEdges.filter(e=>eligible(e,minimumConfidence,allowUnreviewed||approved)).map(e=>({...e,points:e.points.map(p=>toWaistPoint(track,frame,p))})):[],
  ends:Object.fromEntries(['a','b'].map(key=>{const end=frame.beltEnds[key];return [key,end?{...end,tip:end.visible&&end.confidence>=minimumConfidence&&bodyValid&&!stale?toWaistPoint(track,frame,end.tip):null}:null]})),
  evidence:{observedBeltRegions:frame.beltRegions.filter(r=>r.visibility==='observed').length,unknownBeltRegions:frame.beltRegions.filter(r=>r.visibility!=='observed').length,waistConfidence:frame.waistConfidence,depth:'unobserved-2d',interpolation:'none'}};
}
function addRing(ctx,points,project){points.forEach((p,i)=>{const q=project(p);if(i)ctx.lineTo(q[0],q[1]);else ctx.moveTo(q[0],q[1])});ctx.closePath()}
export function drawTrackedBelt(ctx,anchor,pose,{mirror=false,opacity=1,labels=true,view='front',drawHands=true,drawImageEdges=false}={}){
 if(view!=='front')return {rendered:false,reason:'Continuous source observations only establish the front view'};
 if(!pose.beltRegions.length)return {rendered:false,reason:'No approved visible belt regions'};
 if(!pose.bodyValid||pose.stale)return {rendered:false,reason:pose.stale?'Observation gap':'No observed waist anchor'};
 const sign=mirror?-1:1,project=p=>[anchor.x+p[0]*anchor.scale*sign,anchor.y+p[1]*anchor.scale];
 ctx.save();ctx.globalAlpha=opacity;
 // Paint the actual observed 2D area. No centerline thickening and no guessed
 // local normals: both can turn a flat belt into wire or a swollen tube.
 for(const region of pose.beltRegions){
  ctx.beginPath();addRing(ctx,region.contour,project);for(const hole of region.holes)addRing(ctx,hole,project);
  ctx.fillStyle='#181a1c';ctx.fill('evenodd');ctx.strokeStyle='#555a5e';ctx.lineWidth=.65;ctx.stroke();
 }
 // Fixed low-frequency source shading is vector area evidence, not a claim
 // of material layer identity. No source image pixels are copied.
 for(const region of pose.beltShading??[]){
  if(!/^#[0-9a-f]{6}$/i.test(region.fill??''))continue;
  ctx.beginPath();addRing(ctx,region.contour,project);for(const hole of region.holes)addRing(ctx,hole,project);ctx.fillStyle=region.fill;ctx.fill('evenodd');
 }
 // Interior image boundaries remain observed lines, not invented layer depth.
 // Clip them to measured belt area so skin/background edges never become cloth.
 if(drawImageEdges&&pose.beltEdges?.length){
  for(const region of pose.beltRegions){ctx.save();ctx.beginPath();addRing(ctx,region.contour,project);for(const hole of region.holes)addRing(ctx,hole,project);ctx.clip('evenodd');
   ctx.strokeStyle='#707573';ctx.lineWidth=.8;for(const edge of pose.beltEdges){ctx.beginPath();edge.points.forEach((p,i)=>{const q=project(p);if(i)ctx.lineTo(...q);else ctx.moveTo(...q)});ctx.stroke()}ctx.restore();}
 }
 // Optional observed hand silhouettes occlude exactly the same source areas.
 // Landmark-derived hands must not be passed as observed segmentation regions.
 if(drawHands)for(const region of pose.handRegions){ctx.beginPath();addRing(ctx,region.contour,project);for(const hole of region.holes)addRing(ctx,hole,project);ctx.fillStyle='#eef0ed';ctx.fill('evenodd');ctx.strokeStyle='#c4cbc8';ctx.lineWidth=.8;ctx.stroke()}
 if(labels)for(const key of ['a','b']){
  const end=pose.ends[key];if(!end?.tip||end.identityConfidence<.6)continue;
  const [x,y]=project(end.tip),color=key==='a'?'#a7dcef':'#ebcb93';ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fillStyle='#20313b';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=color;ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(key.toUpperCase(),x,y);
 }
 ctx.restore();return {rendered:true,regions:pose.beltRegions.length,originalPTS:pose.originalPTS};
}
// Events delimit lessons, not geometry: every source frame in each interval
// remains eligible for rendering. Holds repeat an observed frame unchanged.
export function createTrackedTimeline(createTimeline,{track,startPTS,endPTS,onFrame=()=>{},onComplete=()=>{},holds=[],speed=1,reduced=false}){
 if(!finite(startPTS)||!finite(endPTS)||endPTS<startPTS||startPTS<track.startPTS||endPTS>track.endPTS)throw new Error('Timeline interval must lie within observed PTS');
 const cursor={pts:startPTS},pauses=[],timeline=createTimeline({autoplay:false,onUpdate:self=>{const hold=pauses.find(p=>self.currentTime>=p.begin&&self.currentTime<p.end);onFrame(trackingPose(track,hold?hold.pts:cursor.pts),!!hold)},onComplete});
 const stops=[...holds.filter(h=>finite(h.pts)&&h.pts>startPTS&&h.pts<endPTS).sort((a,b)=>a.pts-b.pts),{pts:endPTS,milliseconds:0}];
 let previous=startPTS,at=0;
 for(const stop of stops){
  const duration=reduced?0:(stop.pts-previous)*1000;timeline.add(cursor,{pts:[previous,stop.pts],duration,ease:'linear'},at);at+=duration;
  const pause=reduced?0:Math.max(0,stop.milliseconds??0);if(pause){pauses.push({begin:at,end:at+pause,pts:stop.pts});timeline.add({duration:pause},at);at+=pause}previous=stop.pts;
 }
 timeline.speed=speed;
 return {timeline,cursor,pauses,seekSource:pts=>{cursor.pts=clamp(pts,startPTS,endPTS);onFrame(trackingPose(track,cursor.pts),false)}};
}

// Strict PTS merge keeps independently extracted hand observations aligned.
export function mergeHandTracking(source,handTracking){
 const indexed=new Map(handTracking.frames.map(frame=>[frame.frameIndex,frame]));
 return {...source,frames:source.frames.map(frame=>{
  const hand=indexed.get(frame.frameIndex);
  if(!hand||Math.abs(hand.originalPTS-frame.originalPTS)>1e-6)throw new Error(`Hand observation PTS mismatch at frame ${frame.frameIndex}`);
  return {...frame,handRegions:hand.handRegions??[]};
 })};
}

// Explicit teaching-only tail shortening. The caller must supply a reviewed
// source interval proving everything below the cut is free tail, with no hand
// contact. This never changes raw observations, hand shapes or torso scale.
function clipBelow(points,y){
 const out=[];
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],ai=a[1]<=y,bi=b[1]<=y;
  if(ai)out.push(a.slice());
  if(ai!==bi){const t=(y-a[1])/(b[1]-a[1]);out.push([a[0]+(b[0]-a[0])*t,y])}
 }
 return out;
}
export function shortenTeachingTails(pose,{cutY=1.1,reviewedInterval=null,contactClearance=.12}={}){
 if(!reviewedInterval||pose.originalPTS<reviewedInterval.from||pose.originalPTS>reviewedInterval.to||reviewedInterval.freeTailOnly!==true)return {...pose,teachingTransform:{applied:false,reason:'No reviewed free-tail interval'}};
 const contact=pose.handRegions.some(r=>r.contour.some(p=>p[1]>=cutY-contactClearance));
 if(contact)return {...pose,teachingTransform:{applied:false,reason:'Visible hand contact reaches cut'}};
 const clip=regions=>regions.map(r=>({...r,contour:clipBelow(r.contour,cutY),holes:r.holes.map(h=>clipBelow(h,cutY)).filter(h=>h.length>=3)})).filter(r=>r.contour.length>=3);
 const beltRegions=clip(pose.beltRegions),beltShading=clip(pose.beltShading??[]);
 const ends=Object.fromEntries(['a','b'].map(key=>[key,pose.ends[key]?.tip&&pose.ends[key].tip[1]>cutY?{...pose.ends[key],tip:null,hiddenByTeachingCut:true}:pose.ends[key]]));
 return {...pose,beltRegions,beltShading,beltEdges:[],ends,teachingTransform:{applied:true,kind:'shortened-free-tail-drawing',cutY,sourceObservationUnchanged:true,capMeaning:'derived illustration end; not observed material endpoint',evidence:reviewedInterval.evidence??null}};
}
