// All geometry uses image pixels, avoiding aspect-ratio distortion.
export const PASS_SCORE = 50;
export const POSES = [
  {name:'첫 깃 잡기',short:'왼손을 반대편 깃으로',description:'왼손으로 반대편 위쪽 깃을 바로 잡습니다.',angles:[1.8,-2.5,Math.PI/2,Math.PI/2],gesture:'fist'},
  {name:'반대 깃 잡기',short:'오른손을 교차해 잡기',description:'첫 손의 그립을 유지하고 오른손으로 반대편 깃을 잡아 교차합니다.',angles:[1.8,-2.5,Math.PI-1.8,-Math.PI+2.5],gesture:'fist'},
  {name:'교차한 팔 비틀기',short:'그립 유지 · 양 전완 회전',description:'양손의 교차와 깃 위치를 유지하며 손목과 전완을 함께 회전하는 시연을 확인합니다.',angles:[1.8,-2.5,Math.PI-1.8,-Math.PI+2.5],gesture:'fist'},
];
export const BONES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24]];
export const HAND_BONES=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
export function bodyFrame(points){
  if(!points || [11,12].some(i=>!points[i] || (points[i].visibility??1)<.65))return null;
  const origin=mid(points[11],points[12]),scale=distance(points[11],points[12]);
  if(scale<30)return null;
  const x={x:(points[11].x-points[12].x)/scale,y:(points[11].y-points[12].y)/scale};
  let y={x:-x.y,y:x.x};
  // Laptop webcams often crop the pelvis. Shoulders still define an upper-body frame.
  const hasHips=[23,24].every(i=>points[i]&&(points[i].visibility??1)>=.65);
  const down=hasHips?mid(points[23],points[24]):{x:origin.x,y:origin.y+scale};
  if((down.x-origin.x)*y.x+(down.y-origin.y)*y.y<0)y={x:-y.x,y:-y.y};
  return {origin,scale,x,y};
}
export function targetPose(frame,pose,observed=null){
  const p=Array(33).fill(null);
  const project=(x,y)=>({x:frame.origin.x+frame.scale*(x*frame.x.x+y*frame.y.x),y:frame.origin.y+frame.scale*(x*frame.x.y+y*frame.y.y),visibility:1});
  // Fit segment lengths to the visible user, while keeping the prescribed directions.
  const length=(a,b,fallback)=>{
    if(!observed||[a,b].some(i=>!observed[i]||(observed[i].visibility??1)<.65))return fallback;
    const ratio=distance(observed[a],observed[b])/frame.scale;
    return ratio>=.2&&ratio<=2?ratio:fallback;
  };
  const putArm=(side,shoulder,elbow,wrist,a,b)=>{let x=side*.5,y=0;p[shoulder]=project(x,y);const upper=length(shoulder,elbow,.68),lower=length(elbow,wrist,.64);x+=Math.cos(a)*upper;y+=Math.sin(a)*upper;p[elbow]=project(x,y);x+=Math.cos(b)*lower;y+=Math.sin(b)*lower;p[wrist]=project(x,y)};
  putArm(1,11,13,15,...pose.angles.slice(0,2));putArm(-1,12,14,16,...pose.angles.slice(2));
  p[23]=project(.39,1.2);p[24]=project(-.39,1.2);p[0]=project(0,-.58);return p;
}
export function armMatch(points,target,scale){
  const indices=[11,12,13,14,15,16];
  if(!points || indices.some(i=>!points[i] || (points[i].visibility??1)<.65))return null;
  const errors=[13,14,15,16].map(i=>distance(points[i],target[i])/scale);
  const score=Math.round(100*Math.exp(-3.5*errors.reduce((a,b)=>a+b,0)/errors.length));
  return {score,errors};
}
export function handOpenness(hand){
  const fingers=[[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
  return fingers.reduce((sum,ids)=>{const length=ids.slice(1).reduce((v,id,j)=>v+distance(hand[ids[j]],hand[id]),0);return sum+distance(hand[ids[0]],hand[ids[3]])/Math.max(length,.001)},0)/4;
}
export function handMatch(hands,points,scale,gesture){
  if(!points || !hands || hands.length<2)return null;
  // Associate by image-space wrist location, independent of mirror/handedness labels.
  const candidates=hands.map(h=>[distance(h[0],points[15]),distance(h[0],points[16])]);
  const direct=candidates[0][0]+candidates[1][1]<=candidates[0][1]+candidates[1][0];
  const assigned=direct?[0,1]:[1,0];
  if(assigned.some((j,i)=>candidates[j][i]>scale*.55))return null;
  const values=assigned.map(i=>handOpenness(hands[i]));
  return Math.round(values.reduce((sum,v)=>sum+Math.max(0,Math.min(1,gesture==='open'?(v-.5)/.4:(.85-v)/.4)),0)*50);
}
export function advanceHold(hold,dt,score,running){return running && score!==null && score>=PASS_SCORE ? Math.min(3,hold+Math.min(dt,.2)) : 0;}
export function fitRect(width,height,videoWidth,videoHeight){const s=Math.min(width/videoWidth,height/videoHeight);return {x:(width-videoWidth*s)/2,y:(height-videoHeight*s)/2,width:videoWidth*s,height:videoHeight*s,scale:s};}
