import {GROUND_LESSONS} from './ground-lessons.js';
import {tr,initLanguage} from './i18n.js';
import {TECHNIQUES,FOUNDATIONS,readProgress,progressTotals} from './curriculum.js';
import {resolveRoute,routeURL} from './routes.js';
import {THROW_LESSONS,throwText} from './throw-lessons.js';
initLanguage();
const $=id=>document.getElementById(id);
let progress;try{progress=readProgress(localStorage)}catch{progress={}}
let active=null,lessonRequest=0,practiceModule,beltModule,baemilgiModule,throwModule,groundModule;
const routeBase=new URL('../',import.meta.url).pathname;
function navigate(path){
  const url=routeURL(path,routeBase,location.search);
  if(location.pathname+location.search===url)return;
  if(resolveRoute(path)?.screen!=='lesson'){document.dispatchEvent(new Event('judo-exit'));location.assign(url);return;}
  history.pushState(null,'',url);renderRoute();
}
function renderRoute(){
  const route=resolveRoute(location.pathname,routeBase);
  lessonRequest++;document.dispatchEvent(new Event('judo-exit'));active=null;$('baemilgi-screen').hidden=true;$('throw-screen').hidden=true;
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  if(route?.screen==='lesson'){
    openLesson([...TECHNIQUES,...FOUNDATIONS,...THROW_LESSONS,...GROUND_LESSONS].find(t=>t.id===route.lesson));return;
  }
  location.replace(routeURL(route?.path??'/',routeBase,location.search));return;
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
function save(){try{localStorage.setItem('just-judo-progress-v1',JSON.stringify(progress))}catch{}renderProgress()}
function renderProgress(){$('xp').textContent=`${progressTotals(progress).xp} XP`}
async function openBelt(t){
  active=t;const request=++lessonRequest;document.dispatchEvent(new Event('judo-exit'));
  $('practice-screen').hidden=true;$('belt-screen').hidden=false;$('back-menu').hidden=false;
  document.title=tr('띠 매는 법 · Just Judo');$('belt-notice').textContent=tr('띠 시연을 준비하고 있습니다…');window.scrollTo(0,0);
  try{beltModule??=import('./belt-lesson.js');const module=await beltModule;if(request===lessonRequest&&!$('belt-screen').hidden)module.openBeltLesson()}
  catch(error){beltModule=null;if(request===lessonRequest)$('belt-notice').textContent=tr('시연을 불러오지 못했습니다. 기술 메뉴로 돌아간 뒤 다시 열어 주세요.');console.error(error)}
}
function openLesson(t){
  if(GROUND_LESSONS.some(lesson=>lesson.id===t.id)){void openGround(t);return}
  if(THROW_LESSONS.some(lesson=>lesson.id===t.id)){void openThrow(t);return}
  if(t.id==='baemilgi'){void openBaemilgi(t);return}
  if(t.id==='belt'){void openBelt(t);return}
  active=t;$('belt-screen').hidden=true;

  $('grip-left').textContent=tr('왼손 → 오른쪽 깃');$('grip-right').textContent=tr('오른손 → 왼쪽 깃');$('grip-caption').textContent=t.grip;$('source-link').href=t.source;
  $('practice-screen').hidden=false;$('back-menu').hidden=false;
  $('practice-title').textContent=t.name;$('practice-roman').textContent=t.roman;$('practice-grip').textContent=t.grip;
  document.title=`${t.name} · Just Judo`;void launchPractice(t);window.scrollTo(0,0);
}
async function openThrow(t){
  active=t;const request=++lessonRequest;
  $('practice-screen').hidden=true;$('belt-screen').hidden=true;$('baemilgi-screen').hidden=true;$('throw-screen').hidden=false;$('back-menu').hidden=false;
  document.title=`${t.name} · Just Judo`;window.scrollTo(0,0);
  $('throw-screen').textContent=throwText('시연을 준비하고 있습니다…','Preparing the demonstration…');
  try{throwModule??=import('./throw-lesson.js');const module=await throwModule;if(request===lessonRequest&&!$('throw-screen').hidden)module.openThrowLesson(t)}
  catch(error){throwModule=null;if(request===lessonRequest)$('throw-screen').textContent=throwText('시연을 불러오지 못했습니다. 메뉴로 돌아가 다시 열어 주세요.','Could not load the demonstration. Return to the menu and try again.');console.error(error)}
}
async function openGround(t){
 active=t;const request=++lessonRequest;
 $('practice-screen').hidden=$('belt-screen').hidden=$('baemilgi-screen').hidden=true;$('throw-screen').hidden=false;$('back-menu').hidden=false;
 document.title=`${t.name} · Just Judo`;window.scrollTo(0,0);
 $('throw-screen').textContent=throwText('준비 중…','Loading…');
 try{groundModule??=import('./ground-lesson.js');const module=await groundModule;if(request===lessonRequest&&!$('throw-screen').hidden)module.openGroundLesson(t);}
 catch(error){groundModule=null;if(request===lessonRequest)$('throw-screen').textContent=throwText('화면을 불러오지 못했습니다. 다시 열어 주세요.','Could not load the lesson. Please reopen it.');console.error(error);}
}
async function openBaemilgi(t){
  active=t;const request=++lessonRequest;
  $('practice-screen').hidden=true;$('belt-screen').hidden=true;$('baemilgi-screen').hidden=false;$('back-menu').hidden=false;
  document.title=tr('배밀기 도전 · Just Judo');window.scrollTo(0,0);
  try{baemilgiModule??=import('./baemilgi-lesson.js');const module=await baemilgiModule;if(request===lessonRequest&&!$('baemilgi-screen').hidden)module.openBaemilgi()}
  catch{baemilgiModule=null;if(request===lessonRequest)$('baemilgi-screen').textContent=tr('화면을 불러오지 못했습니다. 메뉴로 돌아가 다시 열어 주세요.')}
}
function home(){navigate('/')}
$('brand-home').onclick=e=>{e.preventDefault();home()};$('back-menu').onclick=()=>navigate(resolveRoute(location.pathname,routeBase)?.parent??'/');
document.addEventListener('judo-complete',event=>{const {demo}=event.detail;if(!active)return;if(!demo){progress[active.id]={...progress[active.id],practice:true};save()}$('result-title').textContent=demo?tr('데모 미리보기 완료'):tr('TAP! 미션 완료!');$('result-copy').textContent=demo?tr('데모 점수는 XP와 완료 기록에 반영하지 않습니다.'):tr`${active.name} · 깃 위치·교차 동작 연습 20 XP (최초 1회). 실제 기술의 숙련도 인증은 아닙니다.`;$('result-dialog').showModal()});
$('result-home').onclick=()=>{$('result-dialog').close();home()};$('result-again').onclick=()=>{$('result-dialog').close();void launchPractice(active)};renderProgress();

$('reload-practice').onclick=()=>window.location.reload();
$('help').onclick=()=>$('guide').showModal();$('close-help').onclick=()=>$('guide').close();
history.scrollRestoration='manual';
window.addEventListener('popstate',renderRoute);
renderRoute();
