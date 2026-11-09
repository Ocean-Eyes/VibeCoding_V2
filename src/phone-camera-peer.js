export function randomCameraKey(){const bytes=crypto.getRandomValues(new Uint8Array(24));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export async function cameraSignal(body,{keepalive=false}={}){
 const response=await fetch('/api/phone-camera',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000),keepalive,cache:'no-store'});
 const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'connection_failed'),{code:data.error,status:response.status});return data;
}
export function createCameraPeer({role,session,stream,onStream,onConnected,onClose,onRotate,signal=cameraSignal}){
 const pc=new RTCPeerConnection({iceServers:session.iceServers}),auth={room:session.room,token:session.token,role,...(session.client?{client:session.client}:{})};
 let closed=false,connected=false,remote,channel,pollTimer,disconnectTimer,connectionTimer,cursor=0,polls=0,outgoing=Promise.resolve();
 const pendingCandidates=[];
 const expiryTimer=setTimeout(()=>end('expired'),Math.max(0,session.expiresAt-Date.now()));
 function end(reason='local'){
  if(closed)return;closed=true;clearTimeout(expiryTimer);clearTimeout(pollTimer);clearTimeout(disconnectTimer);clearTimeout(connectionTimer);
  if(channel?.readyState==='open'){try{channel.send('close');}catch{}}
  pc.close();void signal({...auth,action:'close'},{keepalive:true}).catch(()=>{});onClose?.(reason);
 }
 const fail=error=>end(error?.code||'connection_failed');
 function attachChannel(value){channel=value;channel.onmessage=event=>{if(event.data==='close')end('remote');else if(event.data==='rotate'&&role==='phone')onRotate?.();};channel.onclose=()=>{if(connected&&!closed)end('remote');};}
 function send(message){outgoing=outgoing.then(()=>closed?undefined:signal({...auth,action:'send',message}));void outgoing.catch(fail);return outgoing;}
 function checkConnected(){
  if(closed||connected||pc.connectionState!=='connected'||role==='host'&&!remote)return;
  connected=true;clearTimeout(expiryTimer);clearTimeout(pollTimer);clearTimeout(connectionTimer);onConnected?.();if(role==='host')onStream?.(remote);
 }
 pc.onicecandidate=event=>{if(event.candidate&&!closed&&!connected)void send({type:'candidate',candidate:event.candidate.toJSON()});};
 pc.ontrack=event=>{remote=event.streams[0]||new MediaStream([event.track]);checkConnected();};
 pc.ondatachannel=event=>attachChannel(event.channel);
 pc.onconnectionstatechange=()=>{
  if(closed)return;
  if(pc.connectionState==='connected'){clearTimeout(disconnectTimer);checkConnected();}
  else if(pc.connectionState==='failed'||pc.connectionState==='closed')end('connection_failed');
  else if(pc.connectionState==='disconnected'){clearTimeout(disconnectTimer);disconnectTimer=setTimeout(()=>end('connection_lost'),10000);}
 };
 async function candidates(){for(const candidate of pendingCandidates.splice(0))await pc.addIceCandidate(candidate);}
 async function receive(message){
  if(message.type==='offer'&&role==='phone'){
   await pc.setRemoteDescription({type:'offer',sdp:message.sdp});await candidates();
   await pc.setLocalDescription(await pc.createAnswer());await send({type:'answer',sdp:pc.localDescription.sdp});
  }else if(message.type==='answer'&&role==='host'){
   connectionTimer=setTimeout(()=>end('connection_failed'),35000);
   await pc.setRemoteDescription({type:'answer',sdp:message.sdp});await candidates();
  }else if(message.type==='candidate'){
   if(pc.remoteDescription)await pc.addIceCandidate(message.candidate);else pendingCandidates.push(message.candidate);
  }
 }
 async function poll(){
  if(closed||connected)return;
  try{
   const data=await signal({...auth,action:'poll',cursor});if(closed||connected)return;
   if(data.closed){end('remote');return;}
   for(const message of data.messages){if(closed)return;await receive(message);}
   cursor=data.cursor;if(!closed&&!connected)pollTimer=setTimeout(poll,++polls<10?800:2200);
  }catch(error){if(!closed&&!connected)fail(error);}
 }
 return {async start(){
  try{
   if(role==='host'){
    pc.addTransceiver('video',{direction:'recvonly'});attachChannel(pc.createDataChannel('camera-control'));
    await pc.setLocalDescription(await pc.createOffer());await send({type:'offer',sdp:pc.localDescription.sdp});
   }else{connectionTimer=setTimeout(()=>end('connection_failed'),35000);for(const track of stream.getVideoTracks())pc.addTrack(track,stream);}
   if(!closed)void poll();
  }catch(error){fail(error);throw error;}
 },rotate(){if(closed||channel?.readyState!=='open')return false;channel.send('rotate');return true;},close:()=>end('local'),get connection(){return pc;}};
}
