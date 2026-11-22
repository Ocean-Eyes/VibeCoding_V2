import {sampleThrow} from './throw-motion.js';

// Project the existing animation without changing its limbs or handedness.
export function throwGuidePose(body){
 const points=Array(33).fill(null),put=(i,v)=>points[i]={x:(v[0]-body.pelvis[0])/.49,y:-(v[1]-body.pelvis[1])/.49,z:-(v[2]-body.pelvis[2])/.49,visibility:1};
 put(0,body.head);
 for(const [side,a,e,w,h,k,f]of [['left',11,13,15,23,25,27],['right',12,14,16,24,26,28]]){
  put(a,body.shoulders[side]);put(e,body.arms[side].joint);put(w,body.arms[side].end);put(h,body.legs[side].root);put(k,body.legs[side].joint);put(f,body.legs[side].end);
 }
 return points;
}
export function createThrowGuide(id){
 const all=Array.from({length:61},(_,i)=>throwGuidePose(sampleThrow(id,i/20).tori)).flat().filter(Boolean);
 const minX=Math.min(-1.85,...all.map(p=>p.x))-.25,maxX=Math.max(1.85,...all.map(p=>p.x))+.25;
 const minY=Math.min(-2.25,...all.map(p=>p.y))-.25,maxY=Math.max(2.1,...all.map(p=>p.y))+.25;
 const scale=Math.min(276/(maxX-minX),396/(maxY-minY)),ox=150-(minX+maxX)*scale/2,oy=210-(minY+maxY)*scale/2;
 return {scale,pose:throwGuidePose,project:(points,offset=0)=>points.map(p=>p?{...p,x:offset+300-(ox+p.x*scale),y:oy+p.y*scale}:null)};
}
