import {TECHNIQUES,FOUNDATIONS,readProgress,progressTotals} from './curriculum.js';
const $=id=>document.getElementById(id);
let progress;try{progress=readProgress(localStorage)}catch{progress={}}
let active=null,category='katame',lessonRequest=0,practiceModule;
async function launchPractice(t){
  const request=++lessonRequest;
  $('notice').textContent='연습 화면을 준비하고 있습니다…';$('notice').classList.remove('error');$('reload-practice').hidden=true;
  try{
    practiceModule??=import('./app.js');await practiceModule;
    if(request!==lessonRequest||$('practice-screen').hidden)return;
    document.dispatchEvent(new CustomEvent('judo-lesson',{detail:t}));
  }catch(error){
    if(request!==lessonRequest)return;
    $('notice').textContent='연습 화면을 불러오지 못했습니다. 새로고침하여 다시 연결해 주세요.';$('notice').classList.add('error');$('reload-practice').hidden=false;
    console.error('Practice initialization failed',error);
  }
}
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
    const done=progress[t.id]?.practice;
    card.innerHTML=`<span class="lesson-index">${['一','二','三'][i]}</span><div class="lesson-title-group"><small>${t.roman||t.label}</small><h3>${t.name}</h3><span class="tag">${category==='katame'?(done?'수련 기록 있음':'조르기 · 입문'):'준비 중'}</span></div><span class="lesson-kanji" lang="ja" aria-hidden="true">${category==='katame'?t.kanji:['衣','帯','受身'][i]}</span><p>${t.description}</p>`;
    const button=document.createElement('button');button.className='lesson-enter';button.disabled=category!=='katame';button.textContent=category==='katame'?(done?'다시 수련 →':'수련하기 →'):'콘텐츠 준비 중';if(category==='katame'){button.dataset.lesson=t.id;button.onclick=()=>openLesson(t)}card.append(button);$('course-grid').append(card);
  }
}
function openLesson(t){
  active=t;
  $('lesson-title').textContent=t.name;$('lesson-roman').textContent=t.roman;$('lesson-description').textContent=t.description;$('grip-note').textContent=t.detail;
  $('grip-left').textContent=`왼손 · ${t.directions[0]==='↑'?'손바닥 ↑':'손등 ↑'}`;$('grip-right').textContent=`오른손 · ${t.directions[1]==='↑'?'손바닥 ↑':'손등 ↑'}`;$('grip-caption').textContent=t.grip;$('source-link').href=t.source;
  $('home-screen').hidden=true;$('practice-screen').hidden=false;$('back-menu').hidden=false;
  $('practice-title').textContent=t.name;$('practice-roman').textContent=t.roman;$('practice-grip').textContent=t.grip;
  document.title=`${t.name} · Just Judo`;void launchPractice(t);window.scrollTo(0,0);
}
function home(){lessonRequest++;document.dispatchEvent(new Event('judo-exit'));$('practice-screen').hidden=true;$('home-screen').hidden=false;$('back-menu').hidden=true;document.title='Just Judo — 나의 유도 도장';renderProgress();window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>selectCategory(b.dataset.category));
$('featured-start').onclick=()=>selectCategory('katame');$('brand-home').onclick=e=>{e.preventDefault();home()};$('back-menu').onclick=home;
document.addEventListener('judo-complete',event=>{const {demo}=event.detail;if(!active)return;if(!demo){progress[active.id]={...progress[active.id],practice:true};save()}$('result-title').textContent=demo?'데모 미리보기 완료':'TAP! 미션 완료!';$('result-copy').textContent=demo?'데모 점수는 XP와 완료 기록에 반영하지 않습니다.':`${active.name} · 손 위치 연습 20 XP (최초 1회). 실제 기술의 숙련도 인증은 아닙니다.`;$('result-dialog').showModal()});
$('result-home').onclick=()=>{$('result-dialog').close();home()};$('result-again').onclick=()=>{$('result-dialog').close();void launchPractice(active)};renderProgress();

$('reload-practice').onclick=()=>window.location.reload();
$('help').onclick=()=>$('guide').showModal();$('close-help').onclick=()=>$('guide').close();
