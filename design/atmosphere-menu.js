const catalog={
 basics:[['띠 매는 법','OBI','매듭 시연을 보고 띠 매는 순서를 따라 합니다.'],['배밀기','BAEMILGI','가로 카메라로 자세를 확인하고 배밀기를 연습합니다.'],['낙법','UKEMI','낙법 기초 · 준비 중']],
 throws:[['밭다리 후리기','O-SOTO-GARI','초기자세부터 세 단계 동작을 따라 합니다.'],['안다리 후리기','O-UCHI-GARI','3D 시연으로 동작의 흐름을 확인합니다.'],['한팔 업어치기','IPPON-SEOI-NAGE','3D 시연으로 몸의 회전과 동작을 확인합니다.']]
};
const groundwork={
 shime:{name:'조르기',lessons:[['십자조르기','NAMI-JUJI-JIME','목표 손 모양과 위치를 따라 합니다.'],['외십자조르기','KATA-JUJI-JIME','목표 손 모양과 위치를 따라 합니다.'],['역십자조르기','GYAKU-JUJI-JIME','목표 손 모양과 위치를 따라 합니다.']]},
 kansetsu:{name:'꺾기',lessons:[['팔얽어비틀기','UDE-GARAMI','손목 잡기, 팔 연결, 들어 올리기를 순서대로 연습합니다.']]},
 osaekomi:{name:'누르기',lessons:[['곁누르기','KESA-GATAME','3D 시연을 보고 화면 우측 하단의 자세를 따라 합니다.']]}
};
const liveMenu=document.body.dataset.live==='true';
if(liveMenu)catalog.basics.push(['테이핑 하는 법','TAPING','테이핑 기초 레슨 · 준비 중']);
const destinations={OBI:'/basics/belt',BAEMILGI:'/basics/hindu-push-up','NAMI-JUJI-JIME':'/katame-waza/shime-waza/nami-juji-jime','KATA-JUJI-JIME':'/katame-waza/shime-waza/kata-juji-jime','GYAKU-JUJI-JIME':'/katame-waza/shime-waza/gyaku-juji-jime','UDE-GARAMI':'/katame-waza/kansetsu-waza/ude-garami','KESA-GATAME':'/katame-waza/osaekomi-waza/kesa-gatame','O-SOTO-GARI':'/throws/o-soto-gari','O-UCHI-GARI':'/throws/o-uchi-gari','IPPON-SEOI-NAGE':'/throws/ippon-seoi-nage'};
let course='katame',group='shime',selected=0,lightTarget=.62,light=.62;
if(liveMenu){if(location.pathname.includes('/basics'))course='basics';if(location.pathname.includes('/throws'))course='throws';if(location.pathname.includes('kansetsu-waza'))group='kansetsu';if(location.pathname.includes('osaekomi-waza'))group='osaekomi';}
const courseButtons=[...document.querySelectorAll('[data-course]')],dialog=document.querySelector('dialog');
const lessons=()=>course==='katame'?groundwork[group].lessons:catalog[course];
function chooseLesson(i){
 selected=i;const items=lessons(),item=items[i];
 const start=document.querySelector('#start');start.disabled=liveMenu&&!destinations[item[1]];if(liveMenu)start.innerHTML=start.disabled?'준비 중':'수련하기 <span>→</span>';
 document.querySelector('#lesson-title').textContent=item[0];document.querySelector('#lesson-roman').textContent=item[1];
 document.querySelector('#description').textContent=item[2];
 document.querySelector('#lesson-index').textContent=`${String(i+1).padStart(2,'0')} / ${String(items.length).padStart(2,'0')}`;
 document.querySelectorAll('[data-lesson]').forEach((b,j)=>{b.classList.toggle('selected',i===j);b.setAttribute('aria-current',String(i===j));});
 lightTarget=.53+i*.10;renderStill();
}
function showLessons(){
 document.querySelector('#group').textContent=course==='katame'?groundwork[group].name:{basics:'기초',throws:'메치기본'}[course];
 document.querySelector('#tech-list').innerHTML=lessons().map((v,i)=>`<button data-lesson="${i}">${v[0]}<span>${v[1]}</span></button>`).join('');
 document.querySelectorAll('[data-lesson]').forEach((b,i)=>b.onclick=()=>chooseLesson(i));chooseLesson(0);
}
function chooseGroup(key){group=key;document.querySelectorAll('[data-group]').forEach(b=>{b.classList.toggle('selected',b.dataset.group===key);b.setAttribute('aria-current',String(b.dataset.group===key));});showLessons();}
function chooseCourse(c){
 course=c;courseButtons.forEach(b=>{b.classList.toggle('active',b.dataset.course===c);b.setAttribute('aria-current',String(b.dataset.course===c));});
 document.querySelector('#ground-groups').hidden=c!=='katame';
 if(c==='katame')chooseGroup(group);else showLessons();
}
courseButtons.forEach(b=>b.onclick=()=>chooseCourse(b.dataset.course));
document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>chooseGroup(b.dataset.group));
function preview(title){document.querySelector('#preview-title').textContent=title;document.querySelector('#preview-mode').textContent='3D 시연 영역';document.querySelector('.target').hidden=true;document.querySelector('#switch-view').textContent='연습 화면 보기';dialog.showModal();}
document.querySelector('#start').onclick=()=>{const item=lessons()[selected];if(liveMenu){if(destinations[item[1]])location.assign(new URL(destinations[item[1]].slice(1),document.baseURI).pathname+location.search);}else preview(item[0]);};
if(dialog)document.querySelector('.close').onclick=()=>dialog.close();
if(dialog)document.querySelector('#switch-view').onclick=function(){const t=document.querySelector('.target');t.hidden=!t.hidden;document.querySelector('#preview-mode').textContent=t.hidden?'3D 시연 영역':'카메라 영상 영역';this.textContent=t.hidden?'연습 화면 보기':'시연 화면 보기';};
document.querySelectorAll('nav').forEach(nav=>nav.addEventListener('keydown',e=>{
 if(!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(e.key))return;
 const buttons=[...nav.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(i<0)return;e.preventDefault();
 const next=buttons[(i+(['ArrowDown','ArrowRight'].includes(e.key)?1:-1)+buttons.length)%buttons.length];next.focus();next.click();
}));
