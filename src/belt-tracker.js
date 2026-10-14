// Color marker tracking only. A tracked end is not evidence of a correct knot.
export function hsv(r,g,b){
 r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 let h=0;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h*60+360)%360}
 return {h,s:max?d/max:0,v:max};
}
export const hueDistance=(a,b)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));
export function sampleMarker(frame,x,y,other=null){
 const px=Math.round(x*(frame.width-1)),py=Math.round(y*(frame.height-1)),samples=[];
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
  const xx=px+dx,yy=py+dy;if(xx<0||yy<0||xx>=frame.width||yy>=frame.height)continue;
  const i=(yy*frame.width+xx)*4,c=hsv(...frame.data.slice(i,i+3));if(c.s>=.42&&c.v>=.25)samples.push(c);
 }
 if(samples.length<9)return {error:'흰색·검정 대신 선명한 색 테이프의 가운데를 선택하세요.'};
 const center=samples[Math.floor(samples.length/2)],close=samples.filter(c=>hueDistance(c.h,center.h)<15);
 if(close.length<samples.length*.7)return {error:'여러 색이 섞였습니다. 색 표시를 더 크게 보여 주고 가운데를 선택하세요.'};
 const h=(Math.atan2(close.reduce((s,c)=>s+Math.sin(c.h*Math.PI/180),0),close.reduce((s,c)=>s+Math.cos(c.h*Math.PI/180),0))*180/Math.PI+360)%360;
 if(other&&hueDistance(h,other.h)<42)return {error:'A·B에는 서로 확실히 다른 색을 사용하세요.'};
 return {color:{h,s:close.reduce((s,c)=>s+c.s,0)/close.length,v:close.reduce((s,c)=>s+c.v,0)/close.length}};
}
export function markerCandidates(frame,colors){
 const {width:w,height:h,data}=frame,masks=colors.map(()=>new Uint8Array(w*h));
 for(let n=0;n<w*h;n++){
  const c=hsv(data[n*4],data[n*4+1],data[n*4+2]);
  for(let k=0;k<colors.length;k++){const t=colors[k];if(t&&c.s>=Math.max(.3,t.s-.3)&&c.v>=Math.max(.18,t.v*.45)&&hueDistance(c.h,t.h)<=17)masks[k][n]=1}
 }
 return masks.map(mask=>{
  const found=[],queue=new Int32Array(w*h);
  for(let n=0;n<mask.length;n++)if(mask[n]){
   let head=0,tail=1,sx=0,sy=0;queue[0]=n;mask[n]=0;
   while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);sx+=x;sy+=y;
    for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&mask[q]){mask[q]=0;queue[tail++]=q}
   }
   if(tail>=9&&tail<=w*h*.06)found.push({x:sx/tail/(w-1),y:sy/tail/(h-1),area:tail});
  }
  return found.sort((a,b)=>b.area-a.area);
 });
}
export function newBeltTrack(){return {point:null,lastSeen:-Infinity,lastUpdate:null,pending:null,hits:0,state:'unregistered'}}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function updateBeltTrack(track,candidates,now,registered=true){
 if(!registered)return newBeltTrack();
 const next={...track,lastUpdate:now},age=now-track.lastSeen;
 // Reject distant objects while a recently seen marker is occluded. Reacquire
 // only a consistent, unambiguous candidate, never a one-frame color flash.
 let choices=candidates;
 if(track.point&&age<1800)choices=candidates.filter(c=>distance(c,track.point)<.18).sort((a,b)=>distance(a,track.point)-distance(b,track.point));
 const candidate=choices[0];
 const ambiguous=choices.length>1&&(!track.point||age>=1800)&&choices[1].area>candidate.area*.6;
 if(candidate&&!ambiguous){
  const near=track.point&&age<500&&distance(candidate,track.point)<.18;
  next.hits=track.pending&&distance(candidate,track.pending)<.07?track.hits+1:1;next.pending=candidate;
  if(near||next.hits>=3){
   const dt=Math.min(.1,Math.max(0,(now-(track.lastUpdate??now))/1000));
   if(track.point&&age<1800){const d=distance(candidate,track.point),alpha=Math.min(1,dt*10),f=d?Math.min(alpha,.8*dt/d):1;next.point={x:track.point.x+(candidate.x-track.point.x)*f,y:track.point.y+(candidate.y-track.point.y)*f}}
   else next.point={x:candidate.x,y:candidate.y};
   next.lastSeen=now;next.state='tracked';return next;
  }
 }else{next.hits=0;next.pending=null}
 next.state=track.point&&age<1200?'occluded':'searching';return next;
}
export function videoRect(w,h,vw,vh){const scale=Math.min(w/vw,h/vh);return {x:(w-vw*scale)/2,y:(h-vh*scale)/2,w:vw*scale,h:vh*scale}}
export function videoToScreen(p,rect,mirror){return {x:rect.x+(mirror?1-p.x:p.x)*rect.w,y:rect.y+p.y*rect.h}}
export function screenToVideo(p,rect,mirror){let x=(p.x-rect.x)/rect.w,y=(p.y-rect.y)/rect.h;if(x<0||x>1||y<0||y>1)return null;return {x:mirror?1-x:x,y}}
