// Hands attach to actual 3D ribbon material coordinates; silhouettes are not reused.
import {handRig,RIG} from './retarget-rig.js';
import {contactpointBySemantic} from './belt-volume.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=(x,a,b)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u)},blend=(a,b,q)=>a.map((x,i)=>x+(b[i]-x)*q),length=a=>Math.hypot(...a),delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function volumeContactBinding(t,identity){
 if(t<14.8)return null;
 const right=identity==='Right';
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
 const t=frame.originalPTS;if(t<14.8)return {rig:inputRig,contacts:[]};
 const rig={...inputRig,hands:[...inputRig.hands]},contacts=[],activation=smooth(t,14.8,15.5),releasePosition=1-smooth(t,19.48,19.9),releaseCurl=1-smooth(t,19.48,19.6);
 for(let i=0;i<rig.hands.length;i++){
  const old=rig.hands[i],identity=old.identity,control=frame.hands?.[identity],raw=control?.resolved;if(!raw)continue;
  const binding=volumeContactBinding(t,identity),strip=volume.strips.find(s=>s.material===binding.material),sample=strip?contactpointBySemantic(strip,binding.semantic,binding.fraction,{visible:false}):null;
  // Incoming material is sampled from the FULL strip. Never move the grasp along
  // the material merely because a larger interval has emerged from the aperture.
  const visible=sample?(binding.role==='held'?clamp(smooth(strip.visibleMaterialS,sample.materialS,sample.materialS+Math.min(.12,Math.max(1e-6,(strip.totalMaterialS-sample.materialS)*.8)))):Number(sample.materialS<=strip.visibleMaterialS+1e-8)):0,acquisition=binding.weight*visible,weight=acquisition*activation*releasePosition;
  const source=handRig(control,identity)??old,free=blend(old.grip,source.grip,activation),point=sample?.center.slice(0,2),target=point?blend(free,point,weight):free;
  const curl=(raw.curl??[.5,.5,.5,.5,.5]).map((v,j)=>{const held=v+(Math.max(v,j===0?.88:.86)-v)*acquisition*releaseCurl,relaxed=held+(.15-held)*smooth(t,19.48,19.9);return activation===1?relaxed:old.curl[j]+(relaxed-old.curl[j])*activation;});
  let orientation=raw.orientationRad;
  // Preserve source wrist direction; only the arm's fixed reach constraint may
  // limit it so IK cannot separate the grasp from the sampled mesh surface.
  if(sample&&weight)orientation=feasibleOrientation(orientation,target,identity);
  // Activation interpolates the previously displayed wrist too, so the 14.8s
  // renderer boundary does not introduce a pose change before material acquisition.
  orientation=old.angle-Math.PI/2+delta(old.angle-Math.PI/2,orientation)*activation;
  const fit=handRig({...control,resolved:{...raw,gripCenter:[(target[0]-RIG.waist[0])/RIG.waistWidth,(target[1]-RIG.waist[1])/RIG.waistWidth],orientationRad:orientation,curl}},identity);
  if(!fit)continue;fit.contactPose=t>=19.48?'authored relaxed fingers after observed release':weight?'3D mesh material attachment':'source free hand';fit.materialContactDepth=sample?.center[2]??null;rig.hands[i]=fit;
  if(!sample||weight===0)continue;
  contacts.push({identity,material:binding.material,semantic:binding.semantic,panel:`${binding.material}:${binding.semantic}`,materialS:sample.materialS,materialFraction:binding.fraction,contactSpan:binding.span,role:t>=19.48?'releasing':binding.role,sourceTarget:source.inputGrip,assignedPoint:point,point3D:[...sample.center],surfaceTangent:[...sample.tangent],actualContactPoint:fit.grip,feature:'grip',featureBlend:0,acquisitionWeight:weight,holdWeight:acquisition*activation*releaseCurl,correction:length(fit.grip.map((x,j)=>x-source.inputGrip[j])),certainty:'authored contact on reconstructed 3D mesh; hidden depth inferred'});
 }
 return {rig,contacts};
}
