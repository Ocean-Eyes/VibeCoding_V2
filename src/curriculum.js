import {tr} from './i18n.js';
export const TECHNIQUES = [
  {id:'nami',video:'k2cHry9HByQ',name:tr('십자조르기'),roman:'Nami-juji-jime',kanji:'並十字絞',grip:tr('양 손바닥 아래'),answer:0,description:tr('교차한 양손의 손바닥이 아래를 향하는 기본 십자조르기입니다.'),detail:tr('엄지 2개는 깃 안쪽, 나머지 네 손가락은 바깥쪽입니다. 역십자와 손바닥 방향·깃 안에 넣는 손가락이 다릅니다.'),source:'https://judo.ijf.org/techniques/Nami-juji-jime',directions:['↓','↓'],actions:['press','press'],finish:tr('손 모양과 위치 유지'),cues:[tr('금색 가이드처럼 왼손을 쥐고 표시된 위치로 옮기세요.'),tr('오른손도 쥐고 반대쪽 가이드 위치로 옮기세요. 순서는 상관없습니다.'),tr('양손의 모양과 방향을 맞추고 1.2초 유지하세요. 비틀거나 당길 필요는 없습니다.')]},
  {id:'gyaku',video:'t3tQriIPdlI',name:tr('역십자 조르기'),roman:'Gyaku-juji-jime',kanji:'逆十字絞',grip:tr('양 손바닥 위'),answer:1,description:tr('교차한 양손의 손바닥이 위를 향하는 십자조르기입니다.'),detail:tr('양손의 네 손가락은 깃 안쪽, 엄지는 바깥쪽입니다. 십자조르기와 손바닥 방향·깃 안에 넣는 손가락이 반대입니다.'),source:'https://judo.ijf.org/techniques/gyaku-juji-jime',directions:['↑','↑'],actions:['draw','draw'],finish:tr('손 모양과 위치 유지'),cues:[tr('금색 가이드처럼 왼손을 쥐고 표시된 위치로 옮기세요.'),tr('오른손도 쥐고 반대쪽 가이드 위치로 옮기세요. 순서는 상관없습니다.'),tr('양손의 모양과 방향을 맞추고 1.2초 유지하세요. 비틀거나 당길 필요는 없습니다.')]},
  {id:'kata',video:'3VZVUAmiMD8',name:tr('외십자 조르기'),roman:'Kata-juji-jime',kanji:'片十字絞',grip:tr('한 손 위 · 한 손 아래'),answer:2,description:tr('교차한 두 손의 손바닥 방향이 서로 다른 십자조르기입니다.'),detail:tr('한쪽은 엄지, 다른 쪽은 손가락이 깃 안으로 들어가는 혼합 그립입니다.'),source:'https://judo.ijf.org/techniques/Kata-juji-jime',directions:['↑','↓'],actions:['draw','press'],finish:tr('손 모양과 위치 유지'),cues:[tr('금색 가이드처럼 왼손을 쥐고 표시된 위치로 옮기세요.'),tr('오른손도 쥐고 반대쪽 가이드 위치로 옮기세요. 순서는 상관없습니다.'),tr('양손의 모양과 방향을 맞추고 1.2초 유지하세요. 비틀거나 당길 필요는 없습니다.')]},
];
export const QUIZ_CHOICES=[tr('양 손바닥 아래'),tr('양 손바닥 위'),tr('한 손 위 · 한 손 아래')];
export const GROUNDWORK_GROUPS=[
 {id:'shime-waza',name:tr('조르기'),label:'SHIME-WAZA',title:tr('굳히기본 / 조르기'),description:tr('십자 · 역십자 · 외십자 조르기'),available:true},
 {id:'kansetsu-waza',name:tr('꺾기'),label:'KANSETSU-WAZA',title:tr('굳히기본 / 꺾기'),description:tr('팔얽어비틀기'),available:true},
 {id:'osaekomi-waza',name:tr('누르기'),label:'OSAEKOMI-WAZA',title:tr('굳히기본 / 누르기'),description:tr('곁누르기'),available:true},
];
export const FOUNDATIONS=[{id:'belt',name:tr('띠 매는 법'),label:'OBI · GHOST BELT',kanji:'帯',available:true,description:tr('반투명 띠의 움직임을 보고, 카메라 위 가이드에 맞춰 매듭을 따라 만듭니다.')},{id:'baemilgi',name:tr('배밀기 도전'),label:'HINDU PUSH-UP · HIGH SCORE',kanji:'挑戦',available:true,description:tr('옆모습으로 배밀기 횟수를 자동 집계합니다. 완전히 일어서면 종료하고 닉네임으로 최고 기록을 남기세요.')},{id:'ukemi',name:tr('낙법'),label:'UKEMI',kanji:'受身',available:false,description:tr('지도자 시범을 보며 익힐 낙법 기초 레슨')},{id:'taping',name:tr('테이핑 하는 법'),label:'TAPING',kanji:'貼',available:false,description:tr('테이핑 기초 레슨을 준비하고 있습니다.')}];
export function readProgress(storage){
  try{const raw=JSON.parse(storage.getItem('just-judo-progress-v1')||'{}');return Object.fromEntries(TECHNIQUES.map(t=>[t.id,{quiz:raw?.[t.id]?.quiz===true,practice:raw?.[t.id]?.practice===true}]))}catch{return {}}
}
export function progressTotals(progress){return TECHNIQUES.reduce((r,t)=>{const p=progress[t.id]||{};r.xp+=(p.quiz?10:0)+(p.practice?20:0);r.completed+=p.practice?1:0;return r},{xp:0,completed:0})}
