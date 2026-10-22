import {language} from './i18n.js';

const KEY='just-judo-visitor-v1',EXCLUDE='just-judo-visitor-excluded';
const english=language==='en';
const words=(ko,en)=>english?en:ko;
export function readVisitor(storage){
  let value;try{value=JSON.parse(storage.getItem(KEY))}catch{}
  if(!value||typeof value.id!=='string'||!(/^[0-9a-f-]{36}$/i).test(value.id))value={id:crypto.randomUUID(),synced:null};
  storage.setItem(KEY,JSON.stringify(value));return value;
}
export function exclusionRequested(search){return new URLSearchParams(search).get('exclude_visits')==='1';}
export async function visitorRequest(body){
  const response=await fetch('/api/visitors',{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('visitors_unavailable');return response.json();
}
export function initVisitorStats(){
  const root=document.getElementById('visitor-stats');if(!root)return;
  root.setAttribute('aria-label',words('방문자 통계','Visitor statistics'));
  root.innerHTML=`<div class="visitor-total"><span>${words('전체 이용자 수','Total visitors')}</span><strong id="visitor-total" aria-live="polite">—</strong></div><ul id="visitor-countries" aria-label="${words('국가별 방문자 수','Visitors by country')}"></ul>`;
  const total=root.querySelector('#visitor-total'),list=root.querySelector('#visitor-countries');
  const preference=new URLSearchParams(location.search).get('exclude_visits');
  let storage,visitor,excluded=exclusionRequested(location.search);
  root.dataset.ready='false';
  try{
    storage=localStorage;if(['0','1'].includes(preference))storage.setItem(EXCLUDE,preference);excluded=storage.getItem(EXCLUDE)==='1';visitor=readVisitor(storage);
    // Consume the setup link so undo remains effective after a reload.
    if(['0','1'].includes(preference)){const url=new URL(location.href);url.searchParams.delete('exclude_visits');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}
  }catch{storage=null;}
  const format=value=>value.toLocaleString(english?'en-US':'ko-KR');
  function draw(data){
    if(!Number.isInteger(data.total))return;
    total.textContent=words(`${format(data.total)}명`,format(data.total));list.replaceChildren();
    const names=new Intl.DisplayNames([english?'en':'ko'],{type:'region'});
    for(const {country,count} of data.countries){
      const row=document.createElement('li'),flag=document.createElement('span'),name=document.createElement('span'),number=document.createElement('strong');
      flag.className='visitor-flag';flag.setAttribute('aria-hidden','true');flag.textContent=country==='ZZ'?'🌐':country;
      if(/^[A-Z]{2}$/.test(country)&&country!=='ZZ'){
        const img=document.createElement('img');img.src=new URL(`../assets/flags/${country.toLowerCase()}.svg`,import.meta.url).href;img.width=24;img.height=18;img.alt='';img.onload=()=>flag.replaceChildren(img);
      }
      name.textContent=country==='ZZ'?words('미확인','Unknown'):names.of(country);name.title=name.textContent;
      number.textContent=words(`${format(count)}명`,format(count));row.append(flag,name,number);list.append(row);
    }
  }
  function note(){root.title=excluded?words('이 브라우저의 방문은 집계에서 제외됩니다.','Visits from this browser are excluded.'):words('새 집계 시작 이후 · 브라우저별 1회 집계','Since tracking began · each browser counted once');}
  async function sync(action){
    const data=await visitorRequest({id:visitor.id,action});
    visitor.synced=action==='exclude'?'excluded':'counted';storage.setItem(KEY,JSON.stringify(visitor));draw(data);
  }
  (async()=>{
    try{
      const canCount=storage&&visitor&&!navigator.webdriver&&['justjudo.app','www.justjudo.app'].includes(location.hostname);
      if(canCount&&((excluded&&visitor.synced!=='excluded')||(!excluded&&visitor.synced!=='counted')))await sync(excluded?'exclude':visitor.synced==='excluded'?'include':'visit');
      else draw(await visitorRequest());
      note();if(!storage)root.title=words('저장 공간을 사용할 수 없어 이 방문은 집계하지 않습니다.','Browser storage unavailable; this visit is not counted.');
    }catch{root.title=words('방문 통계를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.','Could not load statistics. Please reload in a moment.');total.setAttribute('aria-label',root.title);}
    finally{root.dataset.ready='true';}
  })();
}
