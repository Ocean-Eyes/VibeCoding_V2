import {language} from './i18n.js';
import {cameraConstraints,listCameras,preferredWideCamera,minimizeCameraZoom} from './baemilgi-camera.js';
import {createCameraPlayback} from './camera-playback.js';
import {cameraSignal,createCameraPeer,randomCameraKey} from './phone-camera-peer.js';
import {createOrientedCamera} from './phone-camera-video.js';
const t=(ko,en)=>language==='en'?en:ko,$=id=>document.getElementById(id);
document.documentElement.lang=language;
const fragment=new URLSearchParams(location.hash.slice(1)),room=fragment.get('room'),key=fragment.get('key');
const valid=/^[\w-]{24}$/.test(room??'')&&/^[\w-]{32}$/.test(key??'');
const credential={room,token:key,role:'phone',client:randomCameraKey()};
const initialOrientation=new URLSearchParams(location.search).get('orientation')==='portrait'?'portrait':'landscape';
let stream,peer,orientedCamera,generation=0,connected=false,wakeLock,reusable=true;
$('phone-camera-root').innerHTML=`
<header><span class="eyebrow">JUST JUDO / PHONE CAMERA</span><h1>${t('스마트폰을 카메라로','Use your phone as a camera')}</h1><p id="phone-orientation-guide"></p></header>
<div class="phone-preview"><video id="phone-video" autoplay muted playsinline hidden></video><canvas id="phone-frame" hidden></canvas><video id="phone-preview-video" autoplay muted playsinline hidden></video><div id="phone-placeholder"></div></div>
<div class="phone-controls"><p id="phone-status" role="status"></p>
<label class="phone-lens-label" for="phone-orientation">${t('촬영 방향','Framing')}<select id="phone-orientation"><option value="landscape">${t('가로 (16:9)','Landscape (16:9)')}</option><option value="portrait">${t('세로 (9:16)','Portrait (9:16)')}</option></select></label>
<label class="phone-lens-label" for="phone-lens">${t('카메라','Camera')}<select id="phone-lens"><option value="auto">${t('광각 우선 (자동)','Prefer wide angle (auto)')}</option><option value="user">${t('전면 카메라','Front camera')}</option></select></label>
<div class="phone-actions"><button id="phone-start" class="primary">${t('카메라 켜고 연결','Start camera & connect')}</button><button id="phone-stop" class="outline" hidden>${t('촬영 종료','Stop camera')}</button><button id="phone-resume" class="outline" hidden>${t('카메라 영상 시작','Start camera video')}</button></div>
<p class="phone-help">${t('PC와 폰을 같은 Wi-Fi에 연결하세요. 촬영 중에는 이 화면을 켜 두세요.','Use the same Wi-Fi. Keep this screen open while filming.')}</p></div>
<p class="phone-privacy">${t('연결하면 이 폰의 영상이 QR을 띄운 PC로 실시간 전송됩니다. 영상은 연결한 PC에서 처리하며 녹화하거나 보관하지 않습니다.','Connecting sends live video from this phone to the PC that displayed the QR code. Video is processed on the connected PC and is not recorded or stored.')}</p>`;
$('phone-orientation').value=initialOrientation;
function updateOrientation(){
 const portrait=$('phone-orientation').value==='portrait';$('phone-camera-root').dataset.orientation=portrait?'portrait':'landscape';
 $('phone-orientation-guide').textContent=portrait?t('폰을 세로로 두고 머리부터 발끝까지 보여 주세요. PC에서 시연과 내 동작을 볼 수 있습니다.','Hold your phone upright and show your whole body. Watch the demonstration and your movement on the PC.'):t('폰을 가로로 두고 촬영하세요. PC에서 시연과 내 동작을 볼 수 있습니다.','Film with your phone in landscape. Watch the demonstration and your movement on the PC.');
 $('phone-placeholder').textContent=portrait?t('세로 촬영 · 후면 광각 우선','Portrait · prefer rear wide angle'):t('가로 촬영 · 후면 광각 우선','Landscape · prefer rear wide angle');
 orientedCamera?.setOrientation(portrait?'portrait':'landscape');
}
updateOrientation();$('phone-orientation').onchange=updateOrientation;
const status=message=>{$('phone-status').textContent=message;};
const preview=$('phone-preview-video');
const playback=createCameraPlayback($('phone-video'),$('phone-resume'),{
 onBlocked:()=>status(t('영상 재생을 허용하려면 카메라 영상 시작을 눌러 주세요.','Tap Start camera video to allow playback.')),
 onRetryFailed:()=>status(t('영상 재생을 다시 눌러 주세요.','Please tap Start camera video again.')),
});
function stop(message){
 if(peer)reusable=false;
 generation++;connected=false;playback.cancel();peer?.close();peer=null;orientedCamera?.stop();orientedCamera=null;stream?.getTracks().forEach(track=>track.stop());stream=null;
 preview.pause();preview.srcObject=null;preview.hidden=true;
 $('phone-video').srcObject=null;$('phone-video').hidden=true;$('phone-frame').hidden=true;$('phone-placeholder').hidden=false;$('phone-stop').hidden=true;$('phone-lens').disabled=false;
 $('phone-start').disabled=!valid||!reusable;$('phone-start').hidden=false;wakeLock?.release().catch(()=>{});wakeLock=null;if(message)status(message);
}
async function keepAwake(){const current=generation;try{const acquired=await navigator.wakeLock?.request('screen');if(current!==generation||!connected){await acquired?.release();return;}wakeLock=acquired;}catch{}}
function renderCameras(devices){const select=$('phone-lens'),selected=select.value;for(const option of [...select.options].slice(2))option.remove();devices.forEach((device,i)=>{const option=document.createElement('option');option.value=device.deviceId;option.textContent=device.label||t(`카메라 ${i+1}`,`Camera ${i+1}`);select.append(option);});select.value=[...select.options].some(option=>option.value===selected)?selected:'auto';}
async function acquire(selection,current){
 const acquired=await navigator.mediaDevices.getUserMedia(cameraConstraints(selection,$('phone-orientation').value));if(current!==generation){acquired.getTracks().forEach(track=>track.stop());return false;}stream=acquired;return true;
}
async function capture(selection,current){
 if(!await acquire(selection,current))return false;
 const devices=await listCameras();if(current!==generation)return false;renderCameras(devices);
 const wide=selection==='auto'?preferredWideCamera(devices):null;
 if(wide&&wide.deviceId!==stream.getVideoTracks()[0].getSettings?.().deviceId){stream.getTracks().forEach(track=>track.stop());stream=null;try{if(!await acquire(wide.deviceId,current))return false;}catch(error){if(current!==generation)return false;if(error.name==='NotAllowedError')throw error;if(!await acquire('auto',current))return false;}}
 await minimizeCameraZoom(stream.getVideoTracks()[0]);if(current!==generation)return false;
 stream.getVideoTracks()[0].addEventListener('ended',()=>{if(current===generation)stop(t('카메라 연결이 끝났습니다. PC에서 새 QR을 열어 주세요.','Camera ended. Open a new QR code on the PC.'));});
 $('phone-video').srcObject=stream;$('phone-placeholder').hidden=true;
 if(!await playback.start(()=>current===generation))return false;
 if(orientedCamera)orientedCamera.reset();else orientedCamera=createOrientedCamera($('phone-video'),$('phone-frame'),{orientation:$('phone-orientation').value,autoRotate:new URLSearchParams(location.search).get('autoRotate')==='1'});
 // Preview the exact outgoing stream through a video decoder, just like the PC.
 // Keep the capture canvas out of the visible mobile compositing path.
 preview.srcObject=orientedCamera.stream;preview.muted=true;preview.hidden=false;
 try{await preview.play();}catch{preview.hidden=true;$('phone-frame').hidden=false;}
 return true;
}
function failure(error){return error.name==='NotAllowedError'?t('카메라 권한이 거부됐습니다. 브라우저와 기기 설정에서 카메라를 허용한 뒤 다시 눌러 주세요.','Camera access was denied. Allow it in browser and device settings, then try again.'):error.code==='already_joined'?t('이 QR은 다른 폰이 사용 중입니다. PC에서 새 QR을 열어 주세요.','Another phone is using this QR code. Open a new one on the PC.'):error.code==='expired'||error.code==='closed'?t('QR 연결이 끝났습니다. PC에서 새 QR을 열어 주세요.','This QR connection ended. Open a new QR code on the PC.'):t('연결하지 못했습니다. 같은 Wi-Fi인지 확인하고 PC에서 새 QR을 열어 주세요.','Could not connect. Check the Wi-Fi and open a new QR code on the PC.');}
$('phone-start').onclick=async()=>{
 if(!valid||!reusable)return;stop();const current=generation;$('phone-start').disabled=true;$('phone-stop').hidden=false;$('phone-lens').disabled=true;
 status(t('카메라 권한을 허용해 주세요.','Please allow camera access.'));
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('unavailable');
  if(!await capture($('phone-lens').value,current))return;
  const session=await cameraSignal({...credential,action:'join'});if(current!==generation){void cameraSignal({...credential,action:'close'},{keepalive:true}).catch(()=>{});return;}
  history.replaceState(null,'',location.pathname+location.search);status(t('PC에 연결 중…','Connecting to the PC…'));
  peer=createCameraPeer({role:'phone',session:{...session,...credential},stream:orientedCamera.stream,onRotate:()=>orientedCamera?.rotate(),onConnected:()=>{
   if(current!==generation)return;connected=true;$('phone-start').hidden=true;$('phone-lens').disabled=false;status(t('PC에 연결됐습니다 · 촬영 중','Connected to PC · camera on'));void keepAwake();
  },onClose:reason=>{if(current===generation&&reason!=='local')stop(t('PC와 연결이 종료됐습니다. 다시 연결하려면 PC에서 새 QR을 여세요.','The PC connection ended. Open a new QR code on the PC to reconnect.'));}});
  await peer.start();
 }catch(error){if(current===generation){if(['already_joined','expired','closed'].includes(error.code))reusable=false;stop(failure(error));}}
};
$('phone-lens').onchange=async()=>{
 if(!connected)return;const current=generation;$('phone-lens').disabled=true;status(t('카메라 전환 중…','Switching cameras…'));stream?.getTracks().forEach(track=>track.stop());
 try{if(!await capture($('phone-lens').value,current))return;if(current===generation)status(t('PC에 연결됐습니다 · 촬영 중','Connected to PC · camera on'));}
 catch(error){if(current===generation)stop(failure(error));}finally{if(current===generation)$('phone-lens').disabled=false;}
};
$('phone-stop').onclick=()=>{reusable=false;stop(t('촬영을 종료했습니다. 다시 연결하려면 PC에서 새 QR을 여세요.','Camera stopped. Open a new QR code on the PC to reconnect.'));};
window.addEventListener('pagehide',()=>stop());
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&connected)void keepAwake();});
status(valid?t('연결하면 QR을 띄운 PC에서 영상을 볼 수 있습니다.','Connect to show your camera on the PC that displayed the QR code.'):t('PC의 스마트폰 카메라 연결에서 QR을 먼저 스캔해 주세요.','First scan the QR code under Connect phone camera on the PC.'));
$('phone-start').disabled=!valid;if(valid)void listCameras().then(renderCameras);
