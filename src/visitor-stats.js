import {language} from './i18n.js';
const words=(ko,en)=>language==='en'?en:ko;
export async function visitorRequest(){
  const response=await fetch('/api/visitors',{signal:AbortSignal.timeout(12000)});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'analytics_unavailable');}
  const data=await response.json();
  if(!Number.isSafeInteger(data.total)||data.total<0||data.source!=='vercel'||data.metric!=='visitors'||data.period!=='all-time')throw new Error('analytics_unavailable');
  return data;
}
export function initVisitorStats(){
  const root=document.getElementById('visitor-stats');if(!root)return;
  root.setAttribute('aria-label',words('누적 방문자 통계','Cumulative visitor statistics'));
  root.innerHTML=`<div class="visitor-total"><span>${words('누적 방문자 수','Total visitors')}</span><strong id="visitor-total" aria-live="polite">—</strong></div>`;
  root.dataset.ready='false';
  const total=root.querySelector('#visitor-total');
  // Owner opt-out remains in index.html's Vercel beforeSend hook. It affects future
  // analytics events only; this read-only widget never subtracts historical counts.
  (async()=>{
    try{
      const data=await visitorRequest();
      total.textContent=language==='en'?data.total.toLocaleString('en-US'):`${data.total.toLocaleString('ko-KR')}명`;
      root.title=words('Vercel Visitors · 수집 시작부터 누적 · 최대 약 6분 갱신 지연','Vercel Visitors · since tracking began · up to about 6 minutes refresh delay');
    }catch(error){
      root.title=error.message==='analytics_not_configured'?words('Vercel 통계 연결 설정이 필요합니다.','Vercel Analytics connection needs configuration.'):words('Vercel 방문 통계를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.','Could not load Vercel visitor statistics. Please reload later.');
      total.setAttribute('aria-label',root.title);
    }finally{root.dataset.ready='true';}
  })();
}
