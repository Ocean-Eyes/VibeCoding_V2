import {sampleThrow} from './throw-motion.js';
import {JACKET_ROWS} from './throw-body.js';

export const throwPracticeYaw=id=>id==='ippon-seoi-nage'?Math.PI/2:0;
export const PROFILE_TORSO_DEPTH=JACKET_ROWS.at(-1)[2]*2/.49;

// Project the existing animation without changing its limbs or handedness.
export function throwGuidePose(body,yaw=0){
 const c=Math.cos(yaw),s=Math.sin(yaw);
 const points=Array(33).fill(null),put=(i,v)=>{const x=v[0]-body.pelvis[0],z=v[2]-body.pelvis[2];points[i]={x:(x*c-z*s)/.49,y:-(v[1]-body.pelvis[1])/.49,z:-(x*s+z*c)/.49,visibility:1};};
 put(0,body.head);
 for(const [side,a,e,w,h,k,f]of [['left',11,13,15,23,25,27],['right',12,14,16,24,26,28]]){
  put(a,body.shoulders[side]);put(e,body.arms[side].joint);put(w,body.arms[side].end);put(h,body.legs[side].root);put(k,body.legs[side].joint);put(f,body.legs[side].end);
 }
 return points;
}
export function createThrowGuide(id){
 const yaw=throwPracticeYaw(id),pose=body=>throwGuidePose(body,yaw);
 const all=Array.from({length:121},(_,i)=>pose(sampleThrow(id,i/40).tori)).flat().filter(Boolean);
 const minX=Math.min(-1.85,...all.map(p=>p.x))-.25,maxX=Math.max(1.85,...all.map(p=>p.x))+.25;
 const minY=Math.min(-2.25,...all.map(p=>p.y))-.25,maxY=Math.max(2.1,...all.map(p=>p.y))+.25;
 const scale=Math.min(276/(maxX-minX),396/(maxY-minY)),ox=150-(minX+maxX)*scale/2,oy=210-(minY+maxY)*scale/2;
 return {scale,yaw,pose,project:(points,offset=0)=>points?.map(p=>p?{...p,x:offset+300-(ox+p.x*scale),y:oy+p.y*scale}:null)??null};
}
