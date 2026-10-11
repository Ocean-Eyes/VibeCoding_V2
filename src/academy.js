import './app.js';
import {TECHNIQUES,FOUNDATIONS,QUIZ_CHOICES,readProgress,progressTotals} from './curriculum.js';
const $=id=>document.getElementById(id);
let progress;try{progress=readProgress(localStorage)}catch{progress={}}
let active=null,category='katame';
function save(){try{localStorage.setItem('just-judo-progress-v1',JSON.stringify(progress));$('storage-note').textContent='진행도는 이 브라우저에 저장됩니다.'}catch{$('storage-note').textContent='저장 공간을 사용할 수 없어 이번 방문 동안만 기록됩니다.'}renderProgress()}
function renderProgress(){const totals=progressTotals(progress);$('xp').textContent=`${totals.xp} XP`;$('completion-count').textContent=`${totals.completed} / 3`;document.querySelector('.journey-stamp').textContent=totals.completed===3?'조르기 예비 연습 3종 완료':totals.completed?`${totals.completed}개 미션 완료`:'첫 미션부터 시작해요';$('journey-fill').style.width=`${totals.completed/3*100}%`;if(!$('course-shelf').hidden)renderCourses()}
function selectCategory(id){category=id;$('course-shelf').hidden=false;document.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('selected',b.dataset.category===id);b.setAttribute('aria-pressed',String(b.dataset.category===id))});renderCourses();$('course-shelf').scrollIntoView({behavior:'smooth',block:'start'})}
function renderCourses(){
  $('course-title').textContent={basics:'기초를 차근차근',katame:'굳히기본 / 조르기',throws:'매치기본'}[category];
  $('course-count').textContent=category==='katame'?'3개 미션 · 모두 선택 가능':'레슨 준비 중';
  $('course-grid').replaceChildren();
  if(category==='throws'){$('course-grid').innerHTML='<div class="coming-panel"><span>03 / NEXT CHAPTER</span><h3>매치기본은 다음 순서입니다.</h3><p>지금은 굳히기본의 조르기 3종부터 구성하고 있어요.</p><button class="outline" id="go-katame">조르기 둘러보기 →</button></div>';$('go-katame').onclick=()=>selectCategory('katame');return}
  const items=category==='katame'?TECHNIQUES:FOUNDATIONS;
  for(const [i,t]of items.entries()){
    const card=document.createElement('article');card.className='lesson-card';
    const done=progress[t.id]?.quiz&&progress[t.id]?.practice;
    card.innerHTML=`<span class="lesson-index">${['一','二','三'][i]}</span><div class="lesson-title-group"><small>${t.roman||t.label}</small><h3>${t.name}</h3><span class="tag">${category==='katame'?(done?'수련 기록 있음':'조르기 · 입문'):'준비 중'}</span></div><span class="lesson-kanji" lang="ja" aria-hidden="true">${category==='katame'?t.kanji:['衣','帯','受身'][i]}</span><p>${t.description}</p>`;
    const button=document.createElement('button');button.className='lesson-enter';button.disabled=category!=='katame';button.textContent=category==='katame'?(done?'다시 수련 →':'수련하기 →'):'콘텐츠 준비 중';if(category==='katame'){button.dataset.lesson=t.id;button.onclick=()=>openLesson(t)}card.append(button);$('course-grid').append(card);
  }
}
function openLesson(t){
  active=t;$('lesson-characters').textContent=t.kanji;$('lesson-title').textContent=t.name;$('lesson-roman').textContent=t.roman;$('lesson-description').textContent=t.description;$('grip-note').textContent=t.detail;$('grip-left').textContent=t.directions[0];$('grip-right').textContent=t.directions[1];$('grip-caption').textContent=t.grip;
  $('source-link').href=t.source;$('quiz-question').textContent=`${t.name}의 손바닥 방향은?`;$('quiz-feedback').textContent=progress[t.id]?.quiz?'이전에 확인한 그립입니다. 바로 손 위치 연습을 시작할 수 있어요.':'그립을 확인하면 손 위치 연습이 열립니다.';$('enter-practice').disabled=!progress[t.id]?.quiz;
  $('quiz-choices').replaceChildren();QUIZ_CHOICES.forEach((text,i)=>{const b=document.createElement('button');b.className='quiz-choice';b.textContent=text;b.onclick=()=>{if(i!==t.answer){$('quiz-feedback').textContent='위의 그립 설명을 다시 살펴보세요.';b.classList.add('incorrect');return}progress[t.id]={...progress[t.id],quiz:true};save();$('quiz-feedback').textContent='정답! 그립 확인 완료 · 10 XP (최초 1회)';$('enter-practice').disabled=false;[...$('quiz-choices').children].forEach(c=>c.classList.remove('correct'));b.classList.add('correct')};$('quiz-choices').append(b)});
  $('lesson-dialog').showModal();
}
function home(){document.dispatchEvent(new Event('judo-exit'));$('practice-screen').hidden=true;$('home-screen').hidden=false;$('back-menu').hidden=true;document.title='Just Judo — 나의 유도 도장';renderProgress();window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>selectCategory(b.dataset.category));
$('featured-start').onclick=()=>selectCategory('katame');$('brand-home').onclick=e=>{e.preventDefault();home()};$('back-menu').onclick=home;
$('close-lesson').onclick=()=>$('lesson-dialog').close();
$('enter-practice').onclick=()=>{if(!active||!progress[active.id]?.quiz)return;$('lesson-dialog').close();$('home-screen').hidden=true;$('practice-screen').hidden=false;$('back-menu').hidden=false;$('practice-title').textContent=active.name;$('practice-roman').textContent=active.roman;$('practice-grip').textContent=active.grip;document.title=`${active.name} · Just Judo`;document.dispatchEvent(new CustomEvent('judo-lesson',{detail:active}));window.scrollTo(0,0)};
document.addEventListener('judo-complete',event=>{const {demo}=event.detail;if(!active)return;if(!demo){progress[active.id]={...progress[active.id],practice:true};save()}$('result-title').textContent=demo?'데모 미리보기 완료':'손 위치 미션 완료!';$('result-copy').textContent=demo?'데모 점수는 XP와 완료 기록에 반영하지 않습니다.':`${active.name} · 손 위치 연습 20 XP (최초 1회). 실제 기술의 숙련도 인증은 아닙니다.`;$('result-dialog').showModal()});
$('result-home').onclick=()=>{$('result-dialog').close();home()};$('result-again').onclick=()=>{$('result-dialog').close();document.dispatchEvent(new CustomEvent('judo-lesson',{detail:active}))};renderProgress();
