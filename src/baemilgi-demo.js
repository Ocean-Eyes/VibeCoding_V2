import {sampleDemo,DEMO_SECONDS} from './baemilgi-motion.js';
import {drawDemo} from './baemilgi-draw.js';
const labels=t=>[
 [t('01 · 준비','01 · Ready'),t('손과 발을 짚고 엉덩이를 높입니다.','Plant your hands and feet, and raise your hips.')],
 [t('02 · 팔꿈치 굽혀 내려가기','02 · Bend the elbows and lower'),t('팔꿈치를 굽혀 가슴을 낮추며 몸을 앞으로 보냅니다.','Bend the elbows, lowering your chest as your body moves forward.')],
 [t('03 · 바닥을 밀어 올라오기','03 · Push against the floor'),t('손으로 바닥을 밀고 팔을 펴며 상체를 올립니다.','Push through your hands and extend your arms to raise your chest.')],
 [t('04 · 뒤로 돌아오기','04 · Return'),t('손과 발을 유지한 채 엉덩이를 뒤로, 위로 보냅니다.','Keep hands and feet planted; move your hips back and up.')],
];
export function demoMarkup(t){return `
 <section id="bm-demo" class="bm-demo" aria-label="${t('배밀기 동작 시연','Hindu push-up demonstration')}">
 <div class="bm-stage-top"><span>HINDU PUSH-UP / DEMO</span><span>${t('옆모습 애니메이션','SIDE-VIEW ANIMATION')}</span></div>
 <canvas id="bm-demo-canvas" width="960" height="540" role="img" aria-label="${t('팔꿈치를 굽혀 내려갔다가 팔을 펴며 올라오는 배밀기 캐릭터 시연','Animated Hindu push-up: bend the elbows to lower, then extend the arms to rise')}"></canvas>
 <div class="bm-demo-caption"><strong id="bm-demo-phase"></strong><span id="bm-demo-cue"></span></div>
 <div class="bm-demo-controls"><button id="bm-demo-play" class="primary">${t('시연 재생','Play demo')}</button><button id="bm-demo-restart" class="outline">${t('처음부터','Restart')}</button><label for="bm-demo-speed">${t('재생 속도','Playback speed')} <select id="bm-demo-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option></select></label></div>
 <div class="bm-demo-timeline"><label for="bm-demo-seek">${t('동작 살펴보기','Explore the motion')}</label><input id="bm-demo-seek" type="range" min="0" max="1000" value="0" step="1" /></div>
 <div class="bm-demo-poses" role="group" aria-label="${t('시연 자세 선택','Choose a demonstration pose')}"><button data-bm-pose="0">${t('준비','Ready')}</button><button data-bm-pose="300">${t('팔 굽히기','Bend elbows')}</button><button data-bm-pose="540">${t('밀어 올리기','Push up')}</button><button data-bm-pose="850">${t('돌아오기','Return')}</button></div>
 <p id="bm-demo-note">${t('도전할 때는 먼저 가슴을 낮춘 자세를 잠깐 유지해 집계를 시작합니다.','To begin counting in the challenge, first hold the low position briefly.')}</p>
 <p class="bm-demo-credit"><a href="https://www.youtube.com/watch?v=GG8J-0QsDeA" target="_blank" rel="noopener noreferrer">${t('동작 참고 · 유도 윤현지 — 배밀기 올바른 자세','Motion reference · Judo Yoon Hyun-ji — Hindu push-up form')}</a></p>
 </section>`;}
export function mountDemo(t){
 const canvas=document.getElementById('bm-demo-canvas'),play=document.getElementById('bm-demo-play'),seek=document.getElementById('bm-demo-seek'),phases=labels(t);
 let progress=0,playing=false,speed=1,frame=0,last=0;
 const render=()=>{
  const pose=sampleDemo(progress);drawDemo(canvas,pose);canvas.dataset.playing=String(playing);canvas.dataset.speed=String(speed);
  seek.value=String(Math.round(progress*1000));seek.setAttribute('aria-valuetext',Math.round(progress*100)+'% · '+phases[pose.phase][0]);
  document.getElementById('bm-demo-phase').textContent=phases[pose.phase][0];document.getElementById('bm-demo-cue').textContent=phases[pose.phase][1];
  play.textContent=playing?t('일시정지','Pause'):t('시연 재생','Play demo');play.setAttribute('aria-pressed',String(playing));
 };
 const pause=()=>{playing=false;cancelAnimationFrame(frame);last=0;render();};
 const tick=now=>{if(!playing)return;if(last)progress=Math.min(1,progress+(now-last)/1000/DEMO_SECONDS*speed);last=now;if(progress>=1){pause();return;}render();frame=requestAnimationFrame(tick);};
 const start=()=>{if(playing)return;if(progress>=1)progress=0;playing=true;last=0;render();frame=requestAnimationFrame(tick);};
 play.onclick=()=>playing?pause():start();document.getElementById('bm-demo-restart').onclick=()=>{pause();progress=0;start();};
 document.getElementById('bm-demo-speed').onchange=event=>{speed=Number(event.target.value);render();};
 seek.oninput=event=>{const value=Number(event.target.value);pause();progress=value/1000;render();};
 document.querySelectorAll('[data-bm-pose]').forEach(button=>button.onclick=()=>{pause();progress=Number(button.dataset.bmPose)/1000;render();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',pause);render();
 return {pause};
}
