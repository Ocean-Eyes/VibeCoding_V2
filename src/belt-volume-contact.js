// Hands attach to actual 3D ribbon material coordinates; silhouettes are not reused.
import {handRig,RIG} from './retarget-rig.js';
import {contactpointBySemantic} from './belt-volume.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=(x,a,b)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u)},blend=(a,b,q)=>a.map((x,i)=>x+(b[i]-x)*q),length=a=>Math.hypot(...a),delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function volumeContactBinding(t,identity){
 const right=identity==='Right';
 if(t<14.8)return {material:right?'B':'A',semantic:'whole',fraction:right?(.70+.30*smooth(t,12.5,14.8))/1.3:(.97+.235626545564495*smooth(t,9.5,11)-.32*smooth(t,12.5,14.8))/1.245626545564495,span:right?'B-support':'A-feed',role:right?'support':'feed',weight:1};
 if(right&&t<17.05)return {material:'B',semantic:t<16.5?'lifted-feed':'waist-feed',fraction:1,span:'B-donor',role:'feed',weight:1-smooth(t,16.82,17.05)};
 if(!right&&t<16.85)return {material:'A',semantic:'upper-return',fraction:.65,span:'A-opening-holder',role:'support',weight:1-smooth(t,16.5,16.85)};
 return {material:right?'A':'B',semantic:'outgoing-run',fraction:.65,span:right?'A-tightening-holder':'B-receiver',role:'held',weight:smooth(t,right?17.05:16.85,right?17.55:17.5)};
}
function feasibleOrientation(orientation,point,identity){
 const dx=point[0]-(identity==='Left'?1:-1)*RIG.shoulderX,dy=point[1]-RIG.shoulderY,radius=Math.hypot(dx,dy),base=Math.atan2(dy,dx),cosLimit=(radius*radius+.125**2-(RIG.upperArm+RIG.forearm-.002)**2)/(2*radius*.125);
 if(cosLimit<=-1||!Number.isFinite(cosLimit))return orientation;
 const limit=Math.acos(clamp(cosLimit,-1,1)),turn=delta(base,orientation);if(Math.abs(turn)<=limit)return orientation;
 // Opposite-facing wrists have two feasible solutions. A circular sine
 // continuation avoids switching abruptly between opposite reach limits.
 return base+limit*clamp(Math.sin(turn)/Math.max(.01,Math.sin(limit)),-1,1);
}
export function applyVolumeContacts(frame,volume,inputRig){
 const t=frame.originalPTS;
 if(t<8.5)return preparationContacts(frame,volume,inputRig);
 const rig={...inputRig,hands:[...inputRig.hands]},contacts=[],activation=1,releasePosition=1-smooth(t,19.48,19.9),releaseCurl=1-smooth(t,19.48,19.6);
 for(let i=0;i<rig.hands.length;i++){
  const old=rig.hands[i],identity=old.identity,control=frame.hands?.[identity],raw=control?.resolved;if(!raw)continue;
  const binding=volumeContactBinding(t,identity),strip=volume.strips.find(s=>s.material===binding.material);
  let sample=strip?(binding.semantic==='whole'?strip.sampleMaterialPoint(strip.totalMaterialS*binding.fraction):contactpointBySemantic(strip,binding.semantic,binding.fraction,{visible:false})):null;
  // Acquire the late opening/support locations continuously on the same strip.
  if(sample&&t>=14.8&&t<15.5){const start=volumeContactBinding(14.8-1e-8,identity),s=strip.totalMaterialS*start.fraction,q=smooth(t,14.8,15.5);sample=strip.sampleMaterialPoint(s+(sample.materialS-s)*q);binding.semantic='whole';binding.fraction=sample.materialS/strip.totalMaterialS;}
  // Incoming material is sampled from the FULL strip. Never move the grasp along
  // the material merely because a larger interval has emerged from the aperture.
  const visible=sample?(binding.role==='held'?clamp(smooth(strip.visibleMaterialS,sample.materialS,sample.materialS+Math.min(.12,Math.max(1e-6,(strip.totalMaterialS-sample.materialS)*.8)))):Number(sample.materialS<=strip.visibleMaterialS+1e-8)):0,acquisition=binding.weight*visible,weight=acquisition*activation*releasePosition;
  const source=handRig(control,identity)??old,free=blend(old.grip,source.grip,activation),point=sample?.center.slice(0,2),target=point?blend(free,point,weight):free;
  const curl=(raw.curl??[.5,.5,.5,.5,.5]).map((v,j)=>{const held=v+(Math.max(v,j===0?.88:.86)-v)*acquisition*releaseCurl,relaxed=held+(.15-held)*smooth(t,19.48,19.9);return activation===1?relaxed:old.curl[j]+(relaxed-old.curl[j])*activation;});
  let orientation=raw.orientationRad;
  if(t<15.5){const start=identity==='Left'?2:Math.PI-2;orientation=start+delta(start,orientation)*smooth(t,14.8,15.5);}
  if(sample&&weight&&t<14.8){const across=Math.atan2(sample.tangent[1],sample.tangent[0])+Math.PI/2;orientation+=.4*Math.sin(2*(across-orientation))*weight*(1-smooth(t,14,14.8));}
  // Fixed arm reach may limit the requested wrist direction. It must never
  // separate the grasp from the sampled mesh surface.
  if(sample&&weight)orientation=feasibleOrientation(orientation,target,identity);
  orientation=old.angle-Math.PI/2+delta(old.angle-Math.PI/2,orientation)*activation;
  const fit=handRig({...control,resolved:{...raw,gripCenter:[(target[0]-RIG.waist[0])/RIG.waistWidth,(target[1]-RIG.waist[1])/RIG.waistWidth],orientationRad:orientation,curl}},identity);
  if(!fit)continue;fit.contactPose=t>=19.48?'authored relaxed fingers after observed release':weight?'3D mesh material attachment':'source free hand';fit.materialContactDepth=sample?.center[2]??null;rig.hands[i]=fit;
  if(!sample||weight===0)continue;
  contacts.push({identity,material:binding.material,semantic:binding.semantic,panel:`${binding.material}:${binding.semantic}`,materialS:sample.materialS,materialFraction:binding.fraction,contactSpan:binding.span,role:t>=19.48?'releasing':binding.role,sourceTarget:source.inputGrip,assignedPoint:point,point3D:[...sample.center],surfaceTangent:[...sample.tangent],actualContactPoint:fit.grip,feature:'grip',featureBlend:0,acquisitionWeight:weight,holdWeight:acquisition*activation*releaseCurl,correction:length(fit.grip.map((x,j)=>x-source.inputGrip[j])),certainty:'authored contact on reconstructed 3D mesh; hidden depth inferred'});
 }
 return {rig,contacts};
}

function preparationContacts(frame,volume,inputRig){
 const t=frame.originalPTS,rig={...inputRig,hands:[]},contacts=[];
 // The hands exchange ends behind the back, then acquire the crossed ends at
 // the front. Between contacts the fingers open; identity never follows x.
 const targets={};
 for(const strip of volume.strips){
  const approach=.34-.30*smooth(t,2.05,2.6)*(1-smooth(t,4,4.7));
  const stop=strip.totalMaterialS-(strip.material==='A'?1.245626545564495-.97:1.3-.70),s=Math.min(volume.preparation.laid+approach,stop);
  targets[strip.material]={sample:strip.sampleMaterialPoint(s),strip,s};
 }
 for(const identity of ['Left','Right']){
  const left=identity==='Left',a=targets[left?'A':'B'],b=targets[left?'B':'A'],q=smooth(t,left?3.3:3.65,left?3.65:4)*(1-smooth(t,left?5.8:6.3,left?6.3:6.8)),center=blend(a.sample.center,b.sample.center,q),control=frame.hands?.[identity],raw=control?.resolved??{};
  const target=center.slice(0,2),orientation=feasibleOrientation(left?2:Math.PI-2,target,identity),held=q===0||q===1,curl=Array(5).fill(.9-.55*Math.sin(Math.PI*q));
  const fit=handRig({resolved:{...raw,gripCenter:[target[0]/RIG.waistWidth,(target[1]-RIG.waist[1])/RIG.waistWidth],orientationRad:orientation,curl}},identity);
  fit.materialContactDepth=center[2];fit.contactPose=held?'continuous material grip':'open hand exchange';rig.hands.push(fit);
  if(held){const current=q?b:a;contacts.push({identity,material:current.strip.material,semantic:'preparation',materialS:current.s,point3D:center,assignedPoint:target,actualContactPoint:fit.grip,acquisitionWeight:1,role:'held',surfaceTangent:current.sample.tangent});}
 }
 return {rig,contacts};
}
