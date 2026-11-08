import {language} from './i18n.js';
import {cameraSignal,createCameraPeer} from './phone-camera-peer.js';
import {qrcodegen} from './qr-code.js';
const t=(ko,en)=>language==='en'?en:ko;
const owners=new WeakMap();let pending;
export function releaseCamera(stream){const owner=stream&&owners.get(stream);if(owner){owners.delete(stream);owner.peer.close();}stream?.getTracks().forEach(track=>track.stop());}
export function onCameraEnded(stream,callback){const owner=owners.get(stream);if(owner){owner.onEnd=callback;if(owner.ended)queueMicrotask(callback);}else stream.getVideoTracks()[0].addEventListener('ended',callback);}
export function cancelPhoneCamera(){pending?.cancel();}
function drawQR(canvas,text){
 const qr=qrcodegen.QrCode.encodeText(text,qrcodegen.QrCode.Ecc.MEDIUM),scale=Math.max(4,Math.floor(300/(qr.size+8))),size=(qr.size+8)*scale;
 canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,size,size);ctx.fillStyle='#14252d';
 for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))ctx.fillRect((x+4)*scale,(y+4)*scale,scale,scale);
}
export async function connectPhoneCamera({isCurrent=()=>true,orientation='landscape'}={}){
 cancelPhoneCamera();
 if(!window.isSecureContext||typeof RTCPeerConnection==='undefined')throw Object.assign(new Error(t('이 브라우저에서는 스마트폰 카메라 연결을 시작할 수 없습니다.','This browser cannot connect a phone camera.')),{name:'PhoneCameraError'});
 let dialog=document.getElementById('phone-camera-dialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='phone-camera-dialog';dialog.className='phone-pair-dialog';document.body.append(dialog);}
 dialog.innerHTML=`<div class="eyebrow">PHONE CAMERA</div><h2>${t('스마트폰 카메라 연결','Connect your phone camera')}</h2><p>${t('PC와 폰을 같은 Wi-Fi에 연결하고, 폰 카메라로 QR을 스캔하세요.','Connect both devices to the same Wi-Fi, then scan this QR code with your phone.')}</p><canvas id="phone-camera-qr" aria-label="${t('스마트폰 카메라 연결 QR 코드','Phone camera pairing QR code')}" hidden></canvas><p id="phone-pair-status" role="status">${t('연결을 준비하고 있습니다…','Preparing connection…')}</p><a id="phone-camera-link" target="_blank" rel="noopener noreferrer" hidden>${t('연결 주소 열기','Open connection link')}</a><button id="phone-pair-cancel" class="outline">${t('취소','Cancel')}</button>`;
 const status=dialog.querySelector('#phone-pair-status'),canvas=dialog.querySelector('canvas'),link=dialog.querySelector('a');
 let peer,paired=false,settled=false,session,owner;
 let resolveResult,rejectResult;const result=new Promise((resolve,reject)=>{resolveResult=resolve;rejectResult=reject;});void result.catch(()=>{});
 const attempt={cancel(){peer?.close();if(session&&!peer)void cameraSignal({...session,role:'host',action:'close'},{keepalive:true}).catch(()=>{});if(!settled){settled=true;resolveResult(null);}if(dialog.open)dialog.close();if(pending===attempt)pending=null;}};
 pending=attempt;dialog.querySelector('button').onclick=()=>attempt.cancel();dialog.oncancel=()=>attempt.cancel();dialog.onclose=()=>{if(!dialog.open&&!paired)attempt.cancel();};if(!dialog.open)dialog.showModal();
 try{
  session=await cameraSignal({action:'create'});
  if(settled||!isCurrent()){attempt.cancel();return result;}
  const url=new URL('../phone-camera',import.meta.url);url.searchParams.set('lang',language);url.searchParams.set('orientation',orientation==='portrait'?'portrait':'landscape');url.hash=new URLSearchParams({room:session.room,key:session.phoneToken}).toString();
  peer=createCameraPeer({role:'host',session,onStream:stream=>{
   if(settled||!isCurrent()){peer.close();return;}
   paired=settled=true;owner={peer,onEnd:null};owners.set(stream,owner);pending=null;dialog.close();link.removeAttribute('href');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);resolveResult(stream);
  },onClose:reason=>{
   if(reason==='local')return;
   if(paired){if(reason!=='local'){owner.ended=true;owner.onEnd?.();}return;}
   if(settled)return;
   settled=true;if(pending===attempt)pending=null;status.textContent=reason==='expired'?t('QR 연결 시간이 만료됐습니다. 취소 후 새 QR을 열어 주세요.','This QR code expired. Cancel and open a new one.'):t('연결하지 못했습니다. 같은 Wi-Fi인지 확인하고 다시 시도해 주세요.','Could not connect. Check that both devices use the same Wi-Fi and try again.');
   if(dialog.open)dialog.close();rejectResult(Object.assign(new Error(status.textContent),{name:'PhoneCameraError'}));
  }});
  await peer.start();if(settled||!isCurrent()){attempt.cancel();return result;}
  drawQR(canvas,url.href);canvas.hidden=false;link.href=url.href;link.hidden=false;
  status.textContent=t('QR 스캔 후 폰에서 카메라 켜고 연결을 누르세요. QR은 5분 동안 유효합니다.','After scanning, tap Start camera & connect on your phone. This QR code expires in 5 minutes.');
  if(orientation==='portrait')status.textContent+=' '+t('폰을 세로로 두고 전신을 촬영하세요.','Hold your phone upright to capture your whole body.');
 }catch(error){if(!settled){settled=true;if(pending===attempt)pending=null;peer?.close();if(dialog.open)dialog.close();rejectResult(Object.assign(new Error(error.code==='not_configured'?t('스마트폰 연결 서버가 준비되지 않았습니다. PC 카메라는 계속 사용할 수 있습니다.','Phone pairing is not configured. You can still use the PC camera.'):t('스마트폰 연결을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.','Could not prepare phone pairing. Please try again shortly.')),{name:'PhoneCameraError'}));}}
 return result;
}
