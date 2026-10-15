import {tr} from './i18n.js';
// The waiting hand stays at the side while the first hand goes straight to its lapel.
const REST=[{x:.55,y:1.05},{x:-.55,y:1.05}];
const CROSSED=[{x:-.17,y:.18},{x:.17,y:.205}];
export const GRIP_STEPS=[[CROSSED[0],REST[1]],CROSSED,CROSSED];
// Keep forearm length constant. Opposing rotations pivot around the two held
// grips, moving the crossed wrists and elbows together instead of telescoping.
export function guideArm(hand,index,finish=0,mirrored=true){
 const sign=mirrored?-1:1,x=sign*hand.x,y=hand.y;
 const progress=((index?hand.x:-hand.x)+.55)/.72;
 const twist=.30*Math.max(0,Math.min(1,finish));
 const angle=-sign*(index?-1:1)*(.95*ease(progress)+twist);
 const wrist={x:x-Math.sin(angle)*.219,y:y+Math.cos(angle)*.219};
 const placement={x,y,angle,wrist};
 const length=.78;
 const elbow={x:wrist.x-Math.sin(angle)*length,y:wrist.y+Math.cos(angle)*length};
 const side=(index?1:-1)*(mirrored?1:-1);
 return {...placement,elbow,shoulder:{x:elbow.x+side*.18,y:elbow.y+.50}};
}
export function guideElbow(index,finish=0,mirrored=true){return guideArm(GRIP_STEPS[2][index],index,finish,mirrored).elbow}
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10)};
const blend=(a,b,t)=>t===1?b:a.map((p,i)=>({x:p.x+(b[i].x-p.x)*t,y:p.y+(b[i].y-p.y)*t}));

// The partner's frame depends ONLY on viewport dimensions, never camera landmarks.
export function opponentFrame(width,height){
  return {origin:{x:width/2,y:height*.26},scale:Math.min(width/2.05,height/2.4),x:{x:1,y:0},y:{x:0,y:1}};
}
export function demonstrationAt(seconds,technique=null){
  const t=((seconds%12)+12)%12;
  if(t<3)return {step:0,label:technique?tr`왼손 · ${technique.directions[0]==='↑'?tr('네 손가락'):tr('엄지')}를 깃 안으로`:tr('왼손 · 반대편 깃으로 이동'),hands:blend(REST,GRIP_STEPS[0],ease(t/2))};
  if(t<6)return {step:1,label:technique?tr`오른손 · ${technique.directions[1]==='↑'?tr('네 손가락'):tr('엄지')}를 깃 안으로`:tr('오른손 · 반대편 깃으로 이동'),hands:blend(GRIP_STEPS[0],GRIP_STEPS[1],ease((t-3)/2))};
  if(t<10)return {step:2,label:technique?.finish??tr('교차한 그립 유지 · 양 전완 함께 비틀기'),hands:GRIP_STEPS[2],finish:finishAt(t-6)};
  return {step:0,label:tr('손 풀기 · 다시 시연합니다'),hands:blend(GRIP_STEPS[2],REST,ease((t-10)/2))};
}
// Rotate, briefly hold the crossed position, then unwind before releasing.
export function finishAt(seconds){return seconds<1.4?ease(seconds/1.4):seconds<2.6?1:1-ease((seconds-2.6)/1.4)}
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
