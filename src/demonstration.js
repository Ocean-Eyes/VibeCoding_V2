import {POSES,targetPose} from './pose.js';

const unit={origin:{x:0,y:0},scale:1,x:{x:1,y:0},y:{x:0,y:1}};
export const GRIP_STEPS=POSES.map(p=>{const target=targetPose(unit,p);return [target[15],target[16]].map(({x,y})=>({x,y}))});
// Upper collar positions for the visible practice guide, independent of body pose targets.
GRIP_STEPS[1][0]={x:-.17,y:.18};
GRIP_STEPS[2]=[{x:-.17,y:.18},{x:.17,y:.205}];
// Solve each forearm from its own hand axis; a waiting hand cannot bend back
// toward a fixed elbow. Shorter projected length depicts the elbow lifting in depth.
export function guideArm(hand,index,finish=0,mirrored=true){
 const sign=mirrored?-1:1,x=sign*hand.x,y=hand.y;
 const progress=((index?hand.x:-hand.x)+.55)/.72;
 const angle=-sign*(index?-1:1)*.95*ease(progress);
 const wrist={x:x-Math.sin(angle)*.219,y:y+Math.cos(angle)*.219};
 const placement={x,y,angle,wrist};
 const length=.78-.36*Math.max(0,Math.min(1,finish));
 const elbow={x:wrist.x-Math.sin(angle)*length,y:wrist.y+Math.cos(angle)*length};
 const side=(index?1:-1)*(mirrored?1:-1);
 return {...placement,elbow,shoulder:{x:elbow.x+side*.18,y:elbow.y+.50}};
}
export function guideElbow(index,finish=0,mirrored=true){return guideArm(GRIP_STEPS[2][index],index,finish,mirrored).elbow}
const REST=[{x:.55,y:1.05},{x:-.55,y:1.05}];
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10)};
const blend=(a,b,t)=>t===1?b:a.map((p,i)=>({x:p.x+(b[i].x-p.x)*t,y:p.y+(b[i].y-p.y)*t}));

// The partner's frame depends ONLY on viewport dimensions, never camera landmarks.
export function opponentFrame(width,height){
  return {origin:{x:width/2,y:height*.26},scale:Math.min(width/2.05,height/2.4),x:{x:1,y:0},y:{x:0,y:1}};
}
export function demonstrationAt(seconds,technique=null){
  const t=((seconds%12)+12)%12;
  if(t<2)return {step:0,label:'준비 · 가슴 앞에 양손 모으기',hands:blend(REST,GRIP_STEPS[0],ease(t/1.3))};
  if(t<5)return {step:1,label:technique?`왼손 · ${technique.directions[0]==='↑'?'네 손가락':'엄지'}를 깃 안으로`:'왼손 · 반대편 깃으로 이동',hands:blend(GRIP_STEPS[0],GRIP_STEPS[1],ease((t-2)/2))};
  if(t<8)return {step:2,label:technique?`오른손 · ${technique.directions[1]==='↑'?'네 손가락':'엄지'}를 깃 안으로`:'오른손 · 반대편 깃으로 이동',hands:blend(GRIP_STEPS[1],GRIP_STEPS[2],ease((t-5)/2))};
  if(t<10)return {step:2,label:technique?.finish??'교차 위치 유지 · 손바닥 방향 확인',hands:GRIP_STEPS[2],finish:Math.sin((t-8)/2*Math.PI)**2};
  return {step:0,label:'손 풀기 · 다시 시연합니다',hands:blend(GRIP_STEPS[2],REST,ease((t-10)/2))};
}
export function practiceGuide(step,seconds){
  const from=step?GRIP_STEPS[step-1]:REST;
  return blend(from,GRIP_STEPS[step],ease(seconds/1.4));
}
// Align the hand with the opposite branch of the V collar, then connect at its cuff.
export function gripPlacement(hand,index,mirrored=true){
  const sign=mirrored?-1:1;
  const cross=Math.max(0,Math.min(1,(index?hand.x:-hand.x)/.16));
  const angle=-sign*(index?-1:1)*(.35+.6*ease(cross)),x=sign*hand.x,y=hand.y;
  return {x,y,angle,wrist:{x:x-Math.sin(angle)*.3*.73,y:y+Math.cos(angle)*.3*.73}};
}
// Project camera wrists into the fixed scene. Correct target wrists coincide with the guide,
// even when the user's arm lengths differ from the illustrative partner's proportions.
export function sceneHands(points,frame,target,step){
  return [15,16].map((id,i)=>{
    if(!points?.[id]||(points[id].visibility??1)<.65)return null;
    const dx=points[id].x-target[id].x,dy=points[id].y-target[id].y;
    return {x:GRIP_STEPS[step][i].x+(dx*frame.x.x+dy*frame.x.y)/frame.scale,
      y:GRIP_STEPS[step][i].y+(dx*frame.y.x+dy*frame.y.y)/frame.scale};
  });
}
