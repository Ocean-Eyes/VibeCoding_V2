// Longitudinal depth contact is shared by every view. X/Y and width offsets
// stay on the approved Blender route; the material-length solver transfers
// the recovered arc length to the free ends. Thickness uses the new normal.
import {DEPTH_CONTACT_KEYS} from './belt-depth-contact-data.js';
const unit=a=>{const n=Math.hypot(...a)||1;return a.map(x=>x/n)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
let lastTime,lastCoefficients;
function coefficients(time){
 if(time===lastTime)return lastCoefficients;
 let hi=DEPTH_CONTACT_KEYS.findIndex(k=>k.t>=time),values;
 if(hi<=0)values=DEPTH_CONTACT_KEYS[hi===0?0:DEPTH_CONTACT_KEYS.length-1].values;
 else{const a=DEPTH_CONTACT_KEYS[hi-1],b=DEPTH_CONTACT_KEYS[hi],q=(time-a.t)/(b.t-a.t);values=a.values.map((v,i)=>v+(b.values[i]-v)*q)}
 lastTime=time;lastCoefficients=values;return values;
}
export function depthSampler(raw,strip,weight,time){
 if(!weight)return raw;
 const c=coefficients(time),start=strip.material==='A'?0:31;
 function offset(s){
  const q=Math.max(0,Math.min(30,s/.05)),i=Math.floor(q),u=q-i;
  const w=[-.5*u+u*u-.5*u**3,1-2.5*u*u+1.5*u**3,.5*u+2*u*u-1.5*u**3,-.5*u*u+.5*u**3];
  const dw=[-.5+2*u-1.5*u*u,-5*u+4.5*u*u,.5+4*u-4.5*u*u,-u+1.5*u*u];
  let z=0,d=0;for(let j=0;j<4;j++){const v=c[start+Math.max(0,Math.min(30,i+j-1))];z+=w[j]*v;d+=dw[j]*v}
  return [z*weight,s>1.5?0:d*weight/.05];
 }
 const sample=(s,v=0,side=0)=>{
  const p=raw(s,v),[z,dz]=offset(s),h=.0001,lo=Math.max(0,s-h),hi=Math.min(strip.totalMaterialS,s+h),a=raw(lo,v).center,b=raw(hi,v).center;
  const tangent=unit([(b[0]-a[0])/(hi-lo),(b[1]-a[1])/(hi-lo),(b[2]-a[2])/(hi-lo)+dz]),normal=unit(cross(p.widthAxis,tangent));
  return {...p,center:p.center.map((x,i)=>x+(i===2?z:0)+side*strip.thickness/2*normal[i]),normal,tangent,referenceTangent:p.tangent};
 };
 // Arc-length planning needs positions only; retain the full differential
 // sampler for the rendered cross sections and hand-contact frames.
 sample.centerAt=s=>{const p=raw(s).center,z=offset(s)[0];return [p[0],p[1],p[2]+z]};
 return sample;
}
