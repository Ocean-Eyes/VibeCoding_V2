import {sampleControlFrame} from './belt-controls.js';
const finite=Number.isFinite;
export const shortestAngle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
function blendVector(a,b,t){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every(finite)&&b.every(finite)?a.map((x,i)=>x+(b[i]-x)*t):a}
export function sampleRenderFrame(track,requestedPTS){
 if(!finite(requestedPTS))throw new Error('Invalid render PTS');
 const pts=Math.max(track.startPTS,Math.min(track.endPTS,requestedPTS)),a=sampleControlFrame(track,pts),b=track.frames[Math.min(a.frameIndex+1,track.frames.length-1)];
 if(pts===a.originalPTS||a===b)return {frame:a,sourceFrame:a,nextFrame:b,renderPTS:a.originalPTS,alpha:0,interpolated:false};
 const alpha=(pts-a.originalPTS)/(b.originalPTS-a.originalPTS),hands={};
 for(const identity of ['Left','Right']){
  const first=a.hands?.[identity],next=b.hands?.[identity],u=first?.resolved,v=next?.resolved;
  if(!u||!v){hands[identity]=first;continue}
  const resolved={...u};
  for(const key of ['gripCenter','wrist','curl','elbowHint'])if(key in u)resolved[key]=blendVector(u[key],v[key],alpha);
  for(const key of ['orientationRad','forearmAngleRad'])if(finite(u[key])&&finite(v[key]))resolved[key]=shortestAngle(u[key],v[key],alpha);
  if(finite(u.gripAmount)&&finite(v.gripAmount))resolved.gripAmount=u.gripAmount+(v.gripAmount-u.gripAmount)*alpha;
  hands[identity]={...first,resolved};
 }
 // Only a render-time copy receives interpolated resolved controls. Observed
 // measurements, visibility, physical tips and the stored source are unchanged.
 const frame={...a,originalPTS:pts,hands,renderInference:{kind:'linear resolved-control interpolation; shortest angular arc',sourcePTS:a.originalPTS,nextSourcePTS:b.originalPTS,sourceFrameIndex:a.frameIndex,nextFrameIndex:b.frameIndex,alpha}};
 return {frame,sourceFrame:a,nextFrame:b,renderPTS:pts,alpha,interpolated:true};
}
