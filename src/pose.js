// All geometry uses image pixels, avoiding aspect-ratio distortion.
export const POSES = [
  {name:'활짝 펼치기',short:'어깨 높이 · 손 펴기',description:'양팔을 어깨 높이로 벌리고 손바닥을 펼쳐 주세요.',angles:[0,0,Math.PI,Math.PI],gesture:'open'},
  {name:'머리 위로 V',short:'대각선 위 · 손 펴기',description:'양팔을 대각선 위로 올려 V자를 만들고 손을 펼쳐 주세요.',angles:[-Math.PI/3,-Math.PI/3,-2*Math.PI/3,-2*Math.PI/3],gesture:'open'},
  {name:'파워 포즈',short:'팔꿈치 굽히기 · 주먹',description:'팔꿈치를 어깨 높이로 들고 위로 굽힌 뒤 양손을 가볍게 쥐세요.',angles:[0,-Math.PI/2,Math.PI,-Math.PI/2],gesture:'fist'},
  {name:'대각선 리치',short:'왼손 위 · 오른손 옆',description:'왼팔은 대각선 위로, 오른팔은 옆으로 뻗고 양손을 펼쳐 주세요.',angles:[-Math.PI/3,-Math.PI/3,Math.PI,Math.PI],gesture:'open'},
];
export const BONES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24]];
export const HAND_BONES=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
export function bodyFrame(points){
  if(!points || [11,12,23,24].some(i=>!points[i] || (points[i].visibility??1)<.65))return null;
  const origin=mid(points[11],points[12]),scale=distance(points[11],points[12]);
  if(scale<30)return null;
  const x={x:(points[11].x-points[12].x)/scale,y:(points[11].y-points[12].y)/scale};
  let y={x:-x.y,y:x.x};const hips=mid(points[23],points[24]);
  if((hips.x-origin.x)*y.x+(hips.y-origin.y)*y.y<0)y={x:-y.x,y:-y.y};
  return {origin,scale,x,y};
}
export function targetPose(frame,pose){
  const p=Array(33).fill(null);
  const project=(x,y)=>({x:frame.origin.x+frame.scale*(x*frame.x.x+y*frame.y.x),y:frame.origin.y+frame.scale*(x*frame.x.y+y*frame.y.y),visibility:1});
  const putArm=(side,shoulder,elbow,wrist,a,b)=>{let x=side*.5,y=0;p[shoulder]=project(x,y);x+=Math.cos(a)*.68;y+=Math.sin(a)*.68;p[elbow]=project(x,y);x+=Math.cos(b)*.64;y+=Math.sin(b)*.64;p[wrist]=project(x,y)};
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
export function advanceHold(hold,dt,score,running){return running && score!==null && score>=80 ? Math.min(3,hold+Math.min(dt,.2)) : 0;}
export function fitRect(width,height,videoWidth,videoHeight){const s=Math.min(width/videoWidth,height/videoHeight);return {x:(width-videoWidth*s)/2,y:(height-videoHeight*s)/2,width:videoWidth*s,height:videoHeight*s,scale:s};}
