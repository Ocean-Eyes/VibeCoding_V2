import {THROW_PHASES,throwText as t} from './throw-lessons.js';
import {sampleThrow,PHASE_SECONDS} from './throw-motion.js';
import {createThrowRenderer,drawFootMap} from './throw-render.js';

let cleanup=()=>{};
export function openThrowLesson(lesson){
 cleanup();const root=document.getElementById('throw-screen');
 root.innerHTML=`
  <header class="throw-heading"><div><div class="eyebrow">NAGE-WAZA / ${lesson.roman.toUpperCase()}</div><h1>${lesson.name}</h1><p>${lesson.description}</p></div><span class="throw-kanji" lang="ja" aria-hidden="true">${lesson.kanji}</span></header>
  <nav class="throw-steps" aria-label="${t('동작 단계','Movement phases')}">${THROW_PHASES.map((phase,i)=>`<button data-throw-phase="${i}" aria-pressed="false"><small>0${i+1} / ${phase.roman}</small><strong>${phase.name}</strong><span>${phase.meaning}</span></button>`).join('')}</nav>
  <div class="throw-layout">
   <section class="throw-demo" aria-label="${t('기술 시연','Technique demonstration')}">
    <div class="throw-toolbar"><span>${t('오른손잡이 기준 · 반전 없음','Right-handed · Not mirrored')}</span><div role="group" aria-label="${t('카메라 방향','Camera angle')}"><button data-throw-view="oblique" aria-pressed="true">${t('입체','Oblique')}</button><button data-throw-view="front" aria-pressed="false">${t('정면','Front')}</button><button data-throw-view="side" aria-pressed="false">${t('측면','Side')}</button></div></div>
    <div class="throw-stage"><canvas id="throw-canvas" width="960" height="620" role="img" aria-label="${lesson.name} · ${t('단계별 동작 애니메이션','Step-by-step animation')}"></canvas><span id="throw-status" class="throw-status" role="status"></span></div>
    <div class="throw-legend"><span><i class="throw-white"></i>${t('흰 도복 · 따라 할 동작','White · Your movement')}</span><span><i class="throw-blue"></i>${t('파란 도복 · 상대','Blue · Partner')}</span><label><input id="throw-solo" type="checkbox"> ${t('혼자 보기','Solo view')}</label></div>
    <div class="throw-caption"><span id="throw-number"></span><div><h2 id="throw-title"></h2><p id="throw-cue"></p></div></div>
    <div class="throw-controls"><button id="throw-play" class="primary"></button><button id="throw-all" class="outline">${t('전체 연결 재생','Play full sequence')}</button><label>${t('속도','Speed')} <select id="throw-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option></select></label><label><input id="throw-repeat" type="checkbox"> ${t('이 단계 반복','Repeat this step')}</label></div>
    <label class="throw-scrub" for="throw-seek"><span>${t('동작 살펴보기','Explore the movement')}</span><input id="throw-seek" type="range" min="0" max="1000" step="1" value="0"></label>
    <p class="throw-help">${t('단계 끝에서 멈춥니다. 자세를 따라 해 본 뒤 다음 단계로 이동하세요.','Each step pauses at its end. Try the position, then move to the next step.')}</p>
   </section>
   <aside class="throw-coach">
    <section class="throw-foot-panel"><div class="eyebrow">FOOTWORK</div><h2>${t('위에서 본 발 위치','Foot positions from above')}</h2><canvas id="throw-feet" width="300" height="230" role="img" aria-label="${t('거는 사람과 받는 사람의 좌우 발 위치','Left and right foot positions of both partners')}"></canvas><p>${t('금색은 내가 움직이는 오른발입니다.','Gold marks your working right foot.')}</p></section>
    <section class="throw-focus"><small>${t('이번 단계의 핵심','Focus for this step')}</small><h3 id="throw-focus"></h3><label class="throw-check"><input id="throw-check" type="checkbox"><span id="throw-check-label"></span></label><p>${t('직접 따라 한 뒤 체크하세요.','Check after trying the movement yourself.')}</p></section>
    <div class="throw-next"><button id="throw-prev" class="outline">${t('← 이전 단계','← Previous')}</button><button id="throw-next" class="primary">${t('다음 단계 →','Next →')}</button></div>
    <p id="throw-practice-status" class="throw-practice-status" role="status"></p>
    <p class="throw-solo-note">${t('혼자 할 때는 발 이동과 몸 돌리기만 천천히 따라 하세요. 상대를 메치는 연습은 매트 위에서 지도자와 진행하세요.','Practise the footwork and turns slowly on your own. Practise throwing a partner on mats with an instructor.')}</p>
    <a class="throw-source" href="${lesson.source}" target="_blank" rel="noopener noreferrer">${t('동작 참고 · 강도관 / IJF ↗','Reference · Kodokan / IJF ↗')}</a>
   </aside>
  </div>`;
 const $=id=>root.querySelector('#'+id),canvas=$('throw-canvas');
 let renderer;try{renderer=createThrowRenderer(canvas)}catch(error){$('throw-status').textContent=t('3D 시연을 시작하지 못했습니다. WebGL을 지원하는 브라우저에서 다시 열어 주세요.','Could not start the 3D demonstration. Open in a browser with WebGL support.');throw error;}
 let phase=0,progress=0,playing=false,all=false,speed=1,repeat=false,solo=false,yaw=1.05,pitch=.22,raf=0,last=0,disposed=false;
 const checked=[false,false,false];let currentPose=null,poseTime=-1;
 const abort=new AbortController(),on=(target,name,fn)=>target.addEventListener(name,fn,{signal:abort.signal});
 function render(){
  if(disposed)return;
  const time=phase+progress;if(time!==poseTime){currentPose=sampleThrow(lesson.id,time);poseTime=time;}
  renderer.draw(currentPose,{yaw,pitch,solo});
  drawFootMap($('throw-feet'),currentPose,{left:t('왼','L'),right:t('오','R'),top:t('↑ 준비 자세의 앞쪽','↑ Forward at preparation'),lifted:t('연한 발자국: 들어 올린 발','Faded footprint: lifted foot')});
  canvas.dataset.playing=String(playing);canvas.dataset.phase=String(phase);canvas.dataset.progress=progress.toFixed(4);
  $('throw-seek').value=String(Math.round(progress*1000));$('throw-seek').setAttribute('aria-valuetext',`${THROW_PHASES[phase].name} ${Math.round(progress*100)}%`);
  $('throw-number').textContent=`0${phase+1} / 03`;$('throw-title').textContent=lesson.phases[phase].title;$('throw-cue').textContent=lesson.phases[phase].cue;
  $('throw-focus').textContent=lesson.phases[phase].focus;$('throw-check-label').textContent=lesson.phases[phase].check;$('throw-check').checked=checked[phase];
  $('throw-play').textContent=playing?t('일시정지','Pause'):progress>=1?t('이 단계 다시 보기','Replay this step'):t('이 단계 재생','Play this step');$('throw-play').setAttribute('aria-pressed',String(playing));
  $('throw-status').textContent=playing?`${THROW_PHASES[phase].name} · ${t('재생 중','Playing')}`:progress>=1?t('자세를 따라 해 보세요','Try this position'):t('준비되면 재생하세요','Play when ready');
  $('throw-prev').disabled=phase===0;$('throw-next').disabled=phase===2;
  root.querySelectorAll('[data-throw-phase]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.throwPhase)===phase)));
  $('throw-practice-status').textContent=checked.every(Boolean)?t('세 단계 따라 하기 완료. 전체 동작으로 연결해 보세요.','All three steps practised. Try connecting the full sequence.'):`${checked.filter(Boolean).length} / 3 · ${t('직접 따라 한 단계','Steps practised')}`;
 }
 function pause(){playing=false;last=0;cancelAnimationFrame(raf);render();}
 function selectPhase(next){playing=false;last=0;cancelAnimationFrame(raf);phase=next;progress=0;all=false;render();}
 function tick(now){
  if(!playing||disposed)return;
  if(last)progress=Math.min(1,progress+Math.min(now-last,100)/1000/PHASE_SECONDS[phase]*speed);last=now;
  if(progress>=1){
   render();
   if(all&&phase<2){phase++;progress=0;}
   else if(repeat&&!all){progress=0;}
   else {pause();return;}
  }
  render();raf=requestAnimationFrame(tick);
 }
 function start(full=false){cancelAnimationFrame(raf);all=full;if(full){phase=0;progress=0;}else if(progress>=1)progress=0;playing=true;last=0;render();raf=requestAnimationFrame(tick);}
 on($('throw-play'),'click',()=>playing?pause():start());on($('throw-all'),'click',()=>start(true));
 on($('throw-speed'),'change',e=>{speed=Number(e.target.value);});on($('throw-repeat'),'change',e=>{repeat=e.target.checked;});
 on($('throw-solo'),'change',e=>{solo=e.target.checked;render();});
 on($('throw-seek'),'input',e=>{playing=false;cancelAnimationFrame(raf);last=0;progress=Number(e.target.value)/1000;render();});
 on($('throw-prev'),'click',()=>selectPhase(Math.max(0,phase-1)));on($('throw-next'),'click',()=>selectPhase(Math.min(2,phase+1)));
 on($('throw-check'),'change',e=>{checked[phase]=e.target.checked;render();});
 root.querySelectorAll('[data-throw-phase]').forEach(b=>on(b,'click',()=>selectPhase(Number(b.dataset.throwPhase))));
 root.querySelectorAll('[data-throw-view]').forEach(b=>on(b,'click',()=>{yaw={front:0,side:Math.PI/2,oblique:1.05}[b.dataset.throwView];pitch=.22;root.querySelectorAll('[data-throw-view]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));render();}));
 on(document,'visibilitychange',()=>{if(document.hidden)pause();});on(window,'pagehide',pause);on(window,'resize',render);
 cleanup=()=>{if(disposed)return;disposed=true;playing=false;cancelAnimationFrame(raf);abort.abort();renderer.dispose();};
 on(document,'judo-exit',cleanup);render();
}
