import {tr} from './i18n.js';
// Bounded numeric diagnostics stay in this tab; export is a user-initiated download.
export class PracticeTrace{
 constructor(){this.clear()}
 clear(){this.frames=[];this.lastTime=-Infinity}
 record(time,hands,options,state,baselines){
  if(time-this.lastTime<100)return;
  this.lastTime=time;
  this.frames.push(structuredClone({time,hands,options,baselines,result:{count:state.count,grips:state.grips,wristStatus:state.wristStatus,forearmStatus:state.forearmStatus,forearmAngles:state.forearmAngles,elbowLevels:state.elbowLevels,wristLevels:state.wristLevels,forearmLevels:state.forearmLevels,finishLevels:state.finishLevels,trackingPaused:state.trackingPaused,issue:state.issue,hold:state.hold,tapped:state.tapped}}));
  this.frames=this.frames.filter(f=>time-f.time<=30000).slice(-300);
 }
 snapshot(technique,version){return structuredClone({format:'just-judo-trace',schema:1,technique,version,frames:this.frames})}
}
const pct=v=>v===null||v===undefined?tr('미확인'):`${Math.round(v*100)}%`;
export function motionDiagnostic(state,index){
 const side=index?tr('오른쪽'):tr('왼쪽');
 if(!state?.grips[index])return tr`${side}: 깃 잡기 전`;
 const reason={ungripped:tr('깃 잡기 전'),'not-used':tr('전완 회전 대상 아님'),wrist:tr('손목 인식 대기'),elbow:tr('팔꿈치 인식 대기'),reference:tr('손목 기준 연결 대기'),geometry:tr('팔 길이·방향 확인 불가'),tracked:tr('전완 추적 중'),translation:tr('양팔 평행 이동')}[state.forearmStatus[index]];
 const angle=state.forearmAngles[index],degrees=angle===null?'—':`${Math.round(Math.abs(angle)*180/Math.PI)}°`;
 return tr`${side}: ${reason} · 회전 ${degrees} · 팔꿈치 ${pct(state.elbowLevels[index])} / 손목 ${pct(state.wristLevels[index])} / 전완 ${pct(state.forearmLevels[index])}`;
}
