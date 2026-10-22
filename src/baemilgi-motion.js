// Authored from the user's reference, GG8J-0QsDeA, correct example at 5–7 s.
// Metres, +Y up, performer faces -X. Fixed palm/toe contacts, bilateral anatomy.
export const DEMO_SECONDS=8;
export const LENGTHS={upperArm:.30,forearm:.29,torso:.68,thigh:.50,shin:.49};
export const DEMO_KEYS=[
 {t:0,hip:53,reach:.585},{t:.12,hip:42,reach:.48},
 {t:.30,hip:10,reach:.32},{t:.48,hip:2,reach:.585},
 {t:.60,hip:2,reach:.585},{t:.80,hip:30,reach:.585},{t:1,hip:53,reach:.585},
];
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(v,s)=>v.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const distance=(a,b)=>Math.hypot(...sub(a,b));
const unit=v=>mul(v,1/Math.hypot(...v));
// Intersection of two spheres in the plane specified by the anatomical pole.
export function joint(a,b,first,second,pole){
 const d=distance(a,b);if(d>first+second+1e-8||d<Math.abs(first-second)-1e-8)throw new Error('Unreachable demonstration pose');
 const axis=unit(sub(b,a)),along=(first*first-second*second+d*d)/(2*d);
 const perpendicular=unit(sub(pole,mul(axis,dot(pole,axis))));
 return add(add(a,mul(axis,along)),mul(perpendicular,Math.sqrt(Math.max(0,first*first-along*along))));
}
export function sampleDemo(progress){
 const t=Math.max(0,Math.min(1,progress));let i=0;while(i<DEMO_KEYS.length-2&&t>DEMO_KEYS[i+1].t)i++;
 const a=DEMO_KEYS[i],b=DEMO_KEYS[i+1],u=(t-a.t)/(b.t-a.t),s=u*u*u*(10+u*(-15+6*u));
 const angle=(a.hip+(b.hip-a.hip)*s)*Math.PI/180,reach=a.reach+(b.reach-a.reach)*s;
 const legPlanar=Math.sqrt(.975**2-.27**2);
 const hip=[.80-legPlanar*Math.cos(angle),.14+legPlanar*Math.sin(angle),0];
 const shoulder=joint([-.62,.065,0],hip,Math.sqrt(reach*reach-.04**2),LENGTHS.torso,[-1,1,0]);
 const spine=unit(sub(shoulder,hip)),neck=add(shoulder,mul(spine,.09)),head=add(neck,mul(spine,.13));
 const limbs=[-1,1].map(side=>{
  const wrist=[-.62,.065,side*.22],palm=[-.69,.018,side*.22];
  const armRoot=add(shoulder,[0,0,side*.18]);
  const elbow=joint(armRoot,wrist,LENGTHS.upperArm,LENGTHS.forearm,[1,0,0]);
  const legRoot=add(hip,[0,0,side*.13]),ankle=[.80,.14,side*.40],toe=[.72,.015,side*.40];
  const knee=joint(legRoot,ankle,LENGTHS.thigh,LENGTHS.shin,[-1,-1,0]);
  const elbowAngle=Math.acos(Math.max(-1,Math.min(1,dot(unit(sub(armRoot,elbow)),unit(sub(wrist,elbow))))))*180/Math.PI;
  return {side,shoulder:armRoot,elbow,wrist,palm,hip:legRoot,knee,ankle,toe,elbowAngle};
 });
 return {progress:t,hip,shoulder,neck,head,limbs,phase:t<.07?0:t<.34?1:t<.64?2:3};
}
