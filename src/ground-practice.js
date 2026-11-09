const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function normalize(points,aspect,seated=false){
 const ids=[11,12,13,14,15,16,23,24];
 if(!points||ids.some(i=>!points[i]||(points[i].visibility??1)<.35||!Number.isFinite(points[i].x)||!Number.isFinite(points[i].y)||points[i].x<0||points[i].x>1||points[i].y<0||points[i].y>1))return null;
 const c={x:(points[11].x+points[12].x)/2,y:(points[11].y+points[12].y)*aspect/2};
 const shoulders=Math.hypot(points[11].x-points[12].x,(points[11].y-points[12].y)*aspect);
 const torso=Math.hypot((points[23].x+points[24].x)/2-c.x,(points[23].y+points[24].y)*aspect/2-c.y);
 const scale=seated?Math.max(shoulders,torso*.9):shoulders;
 if(scale<.08)return null;
 return {points:points.map(p=>p?{x:(p.x-c.x)/scale,y:(p.y*aspect-c.y)/scale}:null),scale,c};
}
function gripping(hands,wrist){
 const hand=hands?.filter(h=>h?.length>=21).sort((a,b)=>distance(a[0],wrist)-distance(b[0],wrist))[0];
 if(!hand||distance(hand[0],wrist)>.16)return false;
 const size=distance(hand[0],hand[9]);if(size<.008)return false;
 return [8,12,16,20].filter(i=>distance(hand[i],hand[0])<distance(hand[i-2],hand[0])*1.25).length>=2;
}
export class GroundProgress{
 constructor(id){this.id=id;this.reset();}
 reset(){this.stage=0;this.hold=0;this.last=null;this.under=false;this.done=false;this.until=0;this.leverBase=null;}
 update(points,hands,aspect,now,active=true){
  const dt=this.last===null?0:Math.min(.1,Math.max(0,(now-this.last)/1000));this.last=now;
  const body=normalize(points,aspect,this.id==='kesa-gatame');
  if(this.done)return {stage:this.stage,done:true,hold:1,score:100};
  if(!active||!body){this.hold=0;this.under=false;return {stage:this.stage,hold:0,score:0,issue:'tracking'};}
  if(now<this.until)return {stage:this.stage,hold:0,score:100,transition:true};
  const p=body.points,r=p[16],l=p[15];
  let matched=false,issue='position',error=1;
  if(this.id==='ude-garami'){
   const rightDistance=distance(r,{x:-.35,y:.65}),right=rightDistance<.42&&gripping(hands,points[16]);
   if(!right)this.under=false;
   if(this.stage===0){matched=right;error=rightDistance;issue=right?'hold':'right';}
   else{
    if(right&&l.y>r.y+.12&&l.y<r.y+.8&&Math.abs(l.x-r.x)<.65)this.under=true;
    const forearm={x:r.x+(p[14].x-r.x)*.30,y:r.y+(p[14].y-r.y)*.30};
    error=Math.max(rightDistance,distance(l,forearm));
    const rightHand=hands?.findIndex(h=>h?.length>=21&&gripping([h],points[16]));
    const leftGrip=hands?.some((h,i)=>i!==rightHand&&gripping([h],points[15]));
    matched=right&&this.under&&distance(l,forearm)<.32&&leftGrip;
    issue=!right?'right':!this.under?'under':matched?'hold':'connect';
    if(this.stage===2&&matched){matched=this.leverBase!==null&&p[13].y<this.leverBase-.12;issue=matched?'hold':'lift';}
   }
  }else{
   // Seated pose proxy only; a webcam cannot measure pinning pressure.
   const hips={x:(p[23].x+p[24].x)/2,y:(p[23].y+p[24].y)/2};
   const kneeIds=[25,26,27,28],legs=points&&kneeIds.every(i=>points[i]&&(points[i].visibility??0)>.35&&points[i].y>=0&&points[i].y<=1&&points[i].x>=0&&points[i].x<=1);
   const bent=(h,k,a)=>{const u={x:h.x-k.x,y:h.y-k.y},v={x:a.x-k.x,y:a.y-k.y};return (u.x*v.x+u.y*v.y)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y)||1)>-.80;};
   const seated=legs&&hips.y>.25&&bent(p[24],p[26],p[28])&&Math.abs(p[25].x-p[26].x)>.45;
   const wrap=distance(r,{x:-.52,y:.15})<.50&&distance(l,{x:.05,y:.65})<.5;
   matched=seated&&(this.stage===0||wrap);error=matched?.1:.8;issue=!seated?'sit':!wrap?'wrap':'hold';
  }
  this.hold=matched?this.hold+dt:Math.max(0,this.hold-dt);
  const duration=this.id==='kesa-gatame'&&this.stage===2?1.5:1;
  const score=Math.round(Math.max(0,1-error/1.2)*100);
  if(this.hold>=duration){this.hold=0;if(this.stage===2)this.done=true;else{if(this.id==='ude-garami'&&this.stage===1)this.leverBase=p[13].y;this.stage++;this.until=now+700;}return {stage:this.stage,hold:1,score:100,done:this.done,transition:!this.done};}
  return {stage:this.stage,hold:this.hold/duration,score,issue,under:this.under,matched};
 }
}
