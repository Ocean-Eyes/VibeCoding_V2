export const TECHNIQUES = [
  {id:'nami',video:'k2cHry9HByQ',name:'십자조르기',roman:'Nami-juji-jime',kanji:'並十字絞',grip:'양 손바닥 아래',answer:0,description:'교차한 양손의 손바닥이 아래를 향하는 기본 십자조르기입니다.',detail:'양쪽 모두 엄지가 깃 안으로 들어가는 그립을 구분해 보세요.',source:'https://judo.ijf.org/techniques/nami-juji-jime',directions:['↓','↓']},
  {id:'gyaku',video:'t3tQriIPdlI',name:'역십자 조르기',roman:'Gyaku-juji-jime',kanji:'逆十字絞',grip:'양 손바닥 위',answer:1,description:'교차한 양손의 손바닥이 위를 향하는 십자조르기입니다.',detail:'양쪽 모두 손가락이 깃 안으로 들어가는 그립을 구분해 보세요.',source:'https://judo.ijf.org/techniques/gyaku-juji-jime',directions:['↑','↑']},
  {id:'kata',video:'3VZVUAmiMD8',name:'외십자 조르기',roman:'Kata-juji-jime',kanji:'片十字絞',grip:'한 손 위 · 한 손 아래',answer:2,description:'교차한 두 손의 손바닥 방향이 서로 다른 십자조르기입니다.',detail:'한쪽은 엄지, 다른 쪽은 손가락이 깃 안으로 들어가는 혼합 그립입니다.',source:'https://judo.ijf.org/techniques/Kata-juji-jime',directions:['↑','↓']},
];
export const QUIZ_CHOICES=['양 손바닥 아래','양 손바닥 위','한 손 위 · 한 손 아래'];
export const FOUNDATIONS=[{name:'도복 입는 법',label:'JUDOGI',description:'도복을 갖춰 입는 순서를 따라할 기초 레슨'},{name:'띠 매는 법',label:'OBI',description:'띠를 두르고 매듭을 만드는 단계별 레슨'},{name:'낙법',label:'UKEMI',description:'지도자 시범을 보며 익힐 낙법 기초 레슨'}];
export function readProgress(storage){
  try{const raw=JSON.parse(storage.getItem('just-judo-progress-v1')||'{}');return Object.fromEntries(TECHNIQUES.map(t=>[t.id,{quiz:raw?.[t.id]?.quiz===true,practice:raw?.[t.id]?.practice===true}]))}catch{return {}}
}
export function progressTotals(progress){return TECHNIQUES.reduce((r,t)=>{const p=progress[t.id]||{};r.xp+=(p.quiz?10:0)+(p.practice?20:0);r.completed+=p.practice?1:0;return r},{xp:0,completed:0})}
