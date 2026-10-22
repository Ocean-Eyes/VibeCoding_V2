import {tr,initLanguage} from './i18n.js';
import {TECHNIQUES,FOUNDATIONS,GROUNDWORK_GROUPS,readProgress,progressTotals} from './curriculum.js';
import {resolveRoute,routeURL,categoryPath,lessonPath} from './routes.js';
initLanguage();
const $=id=>document.getElementById(id);
let progress;try{progress=readProgress(localStorage)}catch{progress={}}
let active=null,category='katame',group=null,lessonRequest=0,practiceModule,beltModule,baemilgiModule;
const routeBase=new URL('../',import.meta.url).pathname;
function navigate(path){
  const url=routeURL(path,routeBase,location.search);
  if(location.pathname+location.search===url)return;
  history.pushState(null,'',url);renderRoute();
}
function renderRoute(){
  const route=resolveRoute(location.pathname,routeBase);
  lessonRequest++;document.dispatchEvent(new Event('judo-exit'));active=null;$('baemilgi-screen').hidden=true;
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  if(route?.screen==='lesson'){
    category=route.category;openLesson([...TECHNIQUES,...FOUNDATIONS].find(t=>t.id===route.lesson));return;
  }
  showHome();
  if(route?.screen==='category'){showCategory(route.category,route.group);$('back-menu').hidden=false}
}
async function launchPractice(t){
  const request=++lessonRequest;
  $('notice').textContent=tr('연습 화면을 준비하고 있습니다…');$('notice').classList.remove('error');$('reload-practice').hidden=true;
  try{
    practiceModule??=import('./app.js');await practiceModule;
    if(request!==lessonRequest||$('practice-screen').hidden)return;
    document.dispatchEvent(new CustomEvent('judo-lesson',{detail:t}));
  }catch(error){
    if(request!==lessonRequest)return;
    $('notice').textContent=tr('연습 화면을 불러오지 못했습니다. 새로고침하여 다시 연결해 주세요.');$('notice').classList.add('error');$('reload-practice').hidden=false;
    console.error('Practice initialization failed',error);
  }
}
function save(){try{localStorage.setItem('just-judo-progress-v1',JSON.stringify(progress));$('storage-note').textContent=tr('진행도는 이 브라우저에 저장됩니다.')}catch{$('storage-note').textContent=tr('저장 공간을 사용할 수 없어 이번 방문 동안만 기록됩니다.')}renderProgress()}
function renderProgress(){const totals=progressTotals(progress);$('xp').textContent=`${totals.xp} XP`;$('completion-count').textContent=`${totals.completed} / 3`;document.querySelector('.journey-stamp').textContent=totals.completed===3?tr('조르기 예비 연습 3종 완료'):totals.completed?tr`${totals.completed}개 미션 완료`:tr('첫 미션부터 시작해요');$('journey-fill').style.width=`${totals.completed/3*100}%`;if(!$('course-shelf').hidden)renderCourses()}
function selectCategory(id){navigate(categoryPath(id))}
function showCategory(id,section=null){category=id;group=section;$('course-shelf').hidden=false;document.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('selected',b.dataset.category===id);b.setAttribute('aria-pressed',String(b.dataset.category===id))});renderCourses();document.title=`${$('course-title').textContent} · Just Judo`;$('course-shelf').scrollIntoView({block:'start'})}
function renderCourses(){
  const section=category==='katame'?GROUNDWORK_GROUPS.find(g=>g.id===group):null;
  $('course-title').textContent=section?.title??{basics:tr('기초를 차근차근'),katame:tr('굳히기본'),throws:tr('메치기본')}[category];
  $('course-count').textContent=category==='katame'&&!section?tr('조르기 · 꺾기 · 누르기'):section?.available?tr('3개 미션 · 모두 선택 가능'):category==='basics'?tr('띠 매기 · 배밀기 도전'):tr('레슨 준비 중');
  $('course-grid').replaceChildren();
  if(category==='katame'&&!section){
    for(const [i,g] of GROUNDWORK_GROUPS.entries()){
      const card=document.createElement('article');card.className='lesson-card';
      card.innerHTML=`<span class="lesson-index">${['一','二','三'][i]}</span><div class="lesson-title-group"><small>${g.label}</small><h3>${g.name}</h3><span class="tag">${g.available?tr('조르기 3종 열림'):tr('준비 중')}</span></div><p>${g.description}</p>`;
      const button=document.createElement('button');button.className='lesson-enter';button.dataset.groundwork=g.id;button.textContent=tr('분류 보기 →');button.onclick=()=>navigate('/katame-waza/'+g.id);card.append(button);$('course-grid').append(card);
    }return;
  }
  if(section&&!section.available){
    const panel=document.createElement('div');panel.className='coming-panel';
    const label=document.createElement('span');label.textContent=tr('레슨 준비 중');const title=document.createElement('h3');title.textContent=section.name;const copy=document.createElement('p');copy.textContent=section.description;
    const back=document.createElement('button');back.className='outline';back.textContent=tr('굳히기본 분류로 →');back.onclick=()=>selectCategory('katame');panel.append(label,title,copy,back);$('course-grid').append(panel);return;
  }
  if(category==='throws'){$('course-grid').innerHTML=tr('<div class="coming-panel"><span>03 / NEXT CHAPTER</span><h3>메치기본은 다음 순서입니다.</h3><p>지금은 굳히기본의 조르기 3종부터 구성하고 있어요.</p><button class="outline" id="go-katame">조르기 둘러보기 →</button></div>');$('go-katame').onclick=()=>navigate('/katame-waza/shime-waza');return}
  const items=category==='katame'?TECHNIQUES:FOUNDATIONS;
  for(const [i,t]of items.entries()){
    const card=document.createElement('article');card.className='lesson-card';
    const done=progress[t.id]?.practice,available=category==='katame'||t.available;
    card.innerHTML=`<span class="lesson-index">${['一','二','三'][i]}</span><div class="lesson-title-group"><small>${t.roman||t.label}</small><h3>${t.name}</h3><span class="tag">${category==='katame'?(done?tr('수련 기록 있음'):tr('조르기 · 입문')):available?tr('시연 · 카메라 가이드'):tr('준비 중')}</span></div><span class="lesson-kanji" lang="ja" aria-hidden="true">${t.kanji}</span><p>${t.description}</p>`;
    if(t.id==='baemilgi')card.querySelector('.tag').textContent=tr('횟수 도전 · 리더보드');
    const button=document.createElement('button');button.className='lesson-enter';button.disabled=!available;button.textContent=available?(done?tr('다시 수련 →'):tr('수련하기 →')):tr('콘텐츠 준비 중');if(available){button.dataset.lesson=t.id;button.onclick=()=>navigate(lessonPath(t.id))}card.append(button);$('course-grid').append(card);
  }
}
async function openBelt(t){
  active=t;const request=++lessonRequest;document.dispatchEvent(new Event('judo-exit'));
  $('home-screen').hidden=true;$('practice-screen').hidden=true;$('belt-screen').hidden=false;$('back-menu').hidden=false;
  document.title=tr('띠 매는 법 · Just Judo');$('belt-notice').textContent=tr('띠 시연을 준비하고 있습니다…');window.scrollTo(0,0);
  try{beltModule??=import('./belt-lesson.js');const module=await beltModule;if(request===lessonRequest&&!$('belt-screen').hidden)module.openBeltLesson()}
  catch(error){beltModule=null;if(request===lessonRequest)$('belt-notice').textContent=tr('시연을 불러오지 못했습니다. 기술 메뉴로 돌아간 뒤 다시 열어 주세요.');console.error(error)}
}
function openLesson(t){
  if(t.id==='baemilgi'){void openBaemilgi(t);return}
  if(t.id==='belt'){void openBelt(t);return}
  active=t;$('belt-screen').hidden=true;
  $('lesson-title').textContent=t.name;$('lesson-roman').textContent=t.roman;$('lesson-description').textContent=t.description;$('grip-note').textContent=t.detail;
  $('grip-left').textContent=tr('왼손 → 오른쪽 깃');$('grip-right').textContent=tr('오른손 → 왼쪽 깃');$('grip-caption').textContent=t.grip;$('source-link').href=t.source;
  $('home-screen').hidden=true;$('practice-screen').hidden=false;$('back-menu').hidden=false;
  $('practice-title').textContent=t.name;$('practice-roman').textContent=t.roman;$('practice-grip').textContent=t.grip;
  document.title=`${t.name} · Just Judo`;void launchPractice(t);window.scrollTo(0,0);
}
async function openBaemilgi(t){
  active=t;const request=++lessonRequest;
  $('home-screen').hidden=true;$('practice-screen').hidden=true;$('belt-screen').hidden=true;$('baemilgi-screen').hidden=false;$('back-menu').hidden=false;
  document.title=tr('배밀기 도전 · Just Judo');window.scrollTo(0,0);
  try{baemilgiModule??=import('./baemilgi-lesson.js');const module=await baemilgiModule;if(request===lessonRequest&&!$('baemilgi-screen').hidden)module.openBaemilgi()}
  catch{baemilgiModule=null;if(request===lessonRequest)$('baemilgi-screen').textContent=tr('화면을 불러오지 못했습니다. 메뉴로 돌아가 다시 열어 주세요.')}
}
function showHome(){$('practice-screen').hidden=true;$('belt-screen').hidden=true;$('home-screen').hidden=false;$('back-menu').hidden=true;$('course-shelf').hidden=true;document.querySelectorAll('[data-category]').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false')});document.title=tr('Just Judo — 나의 유도 도장');renderProgress();window.scrollTo(0,0)}
function home(){navigate('/')}
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>selectCategory(b.dataset.category));
$('featured-start').onclick=()=>navigate('/katame-waza/shime-waza');$('brand-home').onclick=e=>{e.preventDefault();home()};$('back-menu').onclick=()=>navigate(resolveRoute(location.pathname,routeBase)?.parent??'/');
document.addEventListener('judo-complete',event=>{const {demo}=event.detail;if(!active)return;if(!demo){progress[active.id]={...progress[active.id],practice:true};save()}$('result-title').textContent=demo?tr('데모 미리보기 완료'):tr('TAP! 미션 완료!');$('result-copy').textContent=demo?tr('데모 점수는 XP와 완료 기록에 반영하지 않습니다.'):tr`${active.name} · 깃 위치·교차 동작 연습 20 XP (최초 1회). 실제 기술의 숙련도 인증은 아닙니다.`;$('result-dialog').showModal()});
$('result-home').onclick=()=>{$('result-dialog').close();home()};$('result-again').onclick=()=>{$('result-dialog').close();void launchPractice(active)};renderProgress();

$('reload-practice').onclick=()=>window.location.reload();
$('help').onclick=()=>$('guide').showModal();$('close-help').onclick=()=>$('guide').close();
history.scrollRestoration='manual';
window.addEventListener('popstate',renderRoute);
renderRoute();
