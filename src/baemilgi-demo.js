// Original side-view footage: Ricky Bennison, CC BY-SA 4.0. See assets/demos/README.md.
export function demoMarkup(t){return `
 <section id="bm-demo" class="bm-demo" aria-label="${t('배밀기 동작 시연','Hindu push-up demonstration')}">
 <div class="bm-stage-top"><span>HINDU PUSH-UP / DEMO</span><span>${t('옆모습 시연','SIDE VIEW')}</span></div>
 <video id="bm-demo-video" controls playsinline muted preload="metadata" poster="./assets/demos/hindu-push-up.jpg" aria-label="${t('배밀기 옆모습 시연 영상','Side-view Hindu push-up video')}"><source src="./assets/demos/hindu-push-up.webm" type="video/webm" /></video>
 <div class="bm-demo-controls"><button id="bm-demo-play" class="primary">${t('시연 재생','Play demo')}</button><button id="bm-demo-restart" class="outline">${t('처음부터','Restart')}</button><label for="bm-demo-speed">${t('재생 속도','Playback speed')} <select id="bm-demo-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option></select></label></div>
 <p id="bm-demo-note">${t('가슴을 낮춰 앞으로 통과하고, 바닥을 밀어 상체를 올리는 흐름을 확인하세요. 도전할 때는 먼저 가슴을 낮춘 자세를 잠깐 유지해 집계를 시작합니다.','Watch the chest lower and sweep forward, then rise as the arms push against the floor. To begin counting in the challenge, first hold the low position briefly.')}</p>
 <p class="bm-demo-credit"><a href="https://commons.wikimedia.org/wiki/File:Dand_(_Basic_version_).webm" target="_blank" rel="noopener noreferrer">Dand (Basic version) — Ricky Bennison</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> · ${t('원본 영상','Original footage')}</p>
 </section>`;}

export function mountDemo(t){
 const video=document.getElementById('bm-demo-video'),play=document.getElementById('bm-demo-play'),note=document.getElementById('bm-demo-note');
 const update=()=>{play.textContent=video.paused?t('시연 재생','Play demo'):t('일시정지','Pause');play.setAttribute('aria-pressed',String(!video.paused));};
 const start=()=>video.play().catch(()=>{note.textContent=t('영상을 재생하지 못했습니다. 다시 재생하거나 아래 원본 영상 링크를 열어 주세요.','Could not play the video. Try again or open the original footage link below.');});
 play.onclick=()=>{if(video.paused)void start();else video.pause();};
 document.getElementById('bm-demo-restart').onclick=()=>{video.currentTime=0;void start();};
 document.getElementById('bm-demo-speed').onchange=event=>{video.playbackRate=Number(event.target.value);};
 for(const event of ['play','pause','ended'])video.addEventListener(event,update);
 video.addEventListener('error',()=>{note.textContent=t('영상을 불러오지 못했습니다. 아래 원본 영상 링크에서 시연을 볼 수 있습니다.','Could not load the video. Use the original footage link below to watch the demonstration.');});
 const pause=()=>video.pause();
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 window.addEventListener('pagehide',pause);update();
 return {pause};
}
