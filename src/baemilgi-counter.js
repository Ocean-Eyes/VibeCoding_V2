// Image-space measurements are aspect-corrected before computing joint angles.
// This is a repetition detector, not a technique/fitness certification.
export const COUNTER_VERSION = 'baemilgi-v1';
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const angle = (a,b,c) => {
  const ab=distance(a,b),bc=distance(b,c);
  return ab*bc ? Math.acos(Math.max(-1,Math.min(1,((a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y))/(ab*bc))))*180/Math.PI : 0;
};
const visible = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x>.01 && p.x<.99 && p.y>.01 && p.y<.99 && (p.visibility??0)>=.6;

export function measureBaemilgi(points,{width=16,height=9}={}) {
  if(!points || !(width>0&&height>0))return {valid:false,reason:'visibility'};
  const sides=[[11,13,15,23,25,27],[12,14,16,24,26,28]];
  const candidates=sides.filter(ids=>ids.every(i=>visible(points[i])));
  if(!candidates.length)return {valid:false,reason:'visibility'};
  candidates.sort((a,b)=>Math.min(...b.map(i=>points[i].visibility))-Math.min(...a.map(i=>points[i].visibility)));
  const ids=candidates[0], [s,e,w,h,k,a]=ids.map(i=>({...points[i],x:points[i].x*width/height}));
  const torso=distance(s,h);
  if(torso<.085)return {valid:false,reason:'distance'};
  const elbow=angle(s,e,w),knee=angle(h,k,a),hip=angle(s,h,k);
  // Standing is evaluated separately: hands may hang free, unlike floor reps.
  const standing=s.y<h.y&&h.y<k.y&&k.y<a.y && a.y-s.y>torso*2.1 &&
    Math.abs(s.x-h.x)<torso*.45 && Math.abs(h.x-a.x)<torso*.65 && knee>155 && hip>155;
  const separation=(i,j)=>visible(points[i])&&visible(points[j])?Math.abs(points[i].x-points[j].x)*width/height/torso:0;
  const sideOn=separation(11,12)<.65 && separation(23,24)<.6;
  const floor=(w.y+a.y)/2;
  const supported=Math.abs(w.y-a.y)<torso*.45 && Math.abs(w.x-a.x)>torso*1.45 && knee>125;
  const low=sideOn&&supported&&elbow<112&&(floor-s.y)<torso*.7;
  const up=sideOn&&supported&&elbow>150&&(h.y-s.y)>torso*.45&&(floor-h.y)<torso*.65;
  return {valid:true,reason:sideOn?'tracking':'side',sideOn,standing,low,up,torso,
    chest:(floor-s.y)/torso,elbow,ids};
}

export class BaemilgiCounter {
  constructor(){this.reset();}
  reset(){
    this.state='ready';this.count=0;this.armed=false;this.startedAt=null;this.finishedAt=null;
    this.lastTime=null;this.lastRep=null;this.lowChest=null;this.holdKind=null;this.holdSince=null;
    this.reps=[];this.reason='ready';
  }
  snapshot(){return {state:this.state,count:this.count,reason:this.reason,startedAt:this.startedAt,finishedAt:this.finishedAt,reps:[...this.reps]};}
  hold(kind,time,ms){
    if(this.holdKind!==kind){this.holdKind=kind;this.holdSince=time;}
    return time-this.holdSince>=ms;
  }
  interrupt(){this.armed=false;this.lowChest=null;this.holdKind=null;this.holdSince=null;this.reason='visibility';}
  update(points,time,dimensions){return this.observe(measureBaemilgi(points,dimensions),time);}
  observe(m,time){
    if(this.state==='finished'||!Number.isFinite(time)||(this.lastTime!==null&&time<=this.lastTime))return this.snapshot();
    if(this.lastTime!==null&&time-this.lastTime>600)this.interrupt();
    this.lastTime=time;
    if(!m.valid){this.interrupt();return this.snapshot();}
    if(m.standing){
      this.armed=false;this.lowChest=null;
      this.reason=this.state==='running'?'standing':'ready';
      if(this.state==='running'&&this.hold('standing',time,1200)){
        this.state='finished';this.finishedAt=time;this.reason='finished';
      }
      return this.snapshot();
    }
    if(!m.sideOn){this.interrupt();this.reason='side';return this.snapshot();}
    if(m.low){
      this.reason=this.state==='ready'?'preparing':'low';
      if(this.hold('low',time,this.state==='ready'?700:180)){
        if(this.state==='ready'){this.state='running';this.startedAt=time;}
        this.armed=true;this.lowChest=m.chest;this.reason='rise';
      }
    }else if(m.up&&this.armed&&m.chest-this.lowChest>.22){
      this.reason='rising';
      if(this.hold('up',time,180)&&(this.lastRep===null||time-this.lastRep>=650)){
        this.count++;this.lastRep=time;this.reps.push(Math.round(time-this.startedAt));this.armed=false;
        this.reason='counted';
      }
    }else{
      this.holdKind=null;this.holdSince=null;this.reason=this.state==='ready'?'ready':this.armed?'rise':'lower';
    }
    return this.snapshot();
  }
}
