import {tr} from './i18n.js';
import {BELT_STEPS as previous,BELT_SOURCE,BELT_REFERENCE_2} from './belt-geometry.js';
export {BELT_SOURCE,BELT_REFERENCE_2};
export const BELT_INTERVALS=[
 {from:2,to:2,holds:[]},
 {from:2,to:4.1,holds:[3]},
 {from:4.1,to:5.4,holds:[]},
 {from:5.4,to:12.5,holds:[9.5,11.5]},
 {from:12.5,to:15.5,holds:[13.75]},
 {from:15.5,to:18,holds:[16.25,17.5]},
 {from:18,to:19.8,holds:[]},
];
export const BELT_STEPS=previous.map((item,index)=>({...item,...[
 {cue:tr('띠 가운데를 허리 앞에 댑니다. 양끝은 짧게 단순화한 그림입니다.')},
 {focus:tr('등 뒤에 가려진 교차는 참고 영상에서 함께 확인하세요.')},
 {focus:tr('양끝을 앞쪽으로 가져와 겹치는 움직임을 확인하세요.')},
 {focus:tr('A가 두 겹을 함께 감쌉니다. 중간의 양끝 정리 동작은 이어서 재생됩니다.')},
 {focus:tr('A 끝을 겹 사이로 내리고 앞쪽 고리는 느슨하게 남겨 둡니다.')},
 {focus:tr('B 끝이 겹 사이를 지나 남겨 둔 A의 고리로 나옵니다. 확대 화면에서 확인하세요.')},
 {cue:tr('B가 통과한 다음 양끝을 좌우로 당겨 매듭을 납작하게 정리합니다.')},
 ][index]}));
export function sourcePTS(step,progress){const s=BELT_INTERVALS[step];return s.from+(s.to-s.from)*Math.max(0,Math.min(1,progress))}
export function trackedPlacement(w,h,step,progress){
 const scale=Math.min(w/2.5,h/5.2),base={x:w/2,y:(h-4.6*scale)/2+1.75*scale,scale};
 const t=step<3?0:step===3?Math.min(1,Math.max(0,progress)*4):1,zoom=t*t*(3-2*t);
 const target={y:h*.49,scale:Math.min((w-36)/2.4,h*.64/1.6)};
 return {x:base.x,y:base.y+(target.y-base.y)*zoom,scale:base.scale+(target.scale-base.scale)*zoom};
}
