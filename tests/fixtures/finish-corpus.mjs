import {CollarInteraction,graspCenter} from '../../src/collar-interaction.js';
import {collarHands,collarArms,handAt} from './collar-hands.mjs';
const kinds=['elbow','wrist','mixed','occluded','recovery','threshold','idle','jitter','one-elbow','one-wrist','lateral','whole-arm','open','uncertain','teleport','missing','small-motion','short-pulse','recover-only','wrist-jitter'];
const positive=new Set(kinds.slice(0,6));
const rotate=(hand,angle)=>{const c=graspCenter(hand),cs=Math.cos(angle),sn=Math.sin(angle);return hand.map(p=>({...p,x:c.x+(p.x-c.x)*cs-(p.y-c.y)*sn,y:c.y+(p.x-c.x)*sn+(p.y-c.y)*cs}))};
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
export function finishCorpus(split='train',samples=12){
 const cases=[];
 for(let sample=0;sample<samples;sample++)for(const kind of kinds){
  const seed=(split==='train'?1000:9000)+sample*31+kinds.indexOf(kind),rand=random(seed);
  const fps=[10,15,24,30,60][sample%5],period=1000/fps,mirrored=sample%2===0;
  const directions=[['↓','↓'],['↑','↑'],['↑','↓']][sample%3];
  const size=.8+rand()*.4,amplitude=.085+rand()*.065,angle=.26+rand()*.24,visibility=.50+rand()*.28,noise=.001+rand()*.003;
  const closed=collarHands('close').map((h,i)=>{
   const c=graspCenter(h),hand=handAt(c,1,i===0,directions[i]==='↑');
   return hand.map(p=>({...p,x:(mirrored?1:-1)*(c.x+(p.x-c.x)*size),y:c.y+(p.y-c.y)*size,z:p.z*size}));
  });
  const open=closed.map((h,i)=>{const c=graspCenter(h),hand=handAt({x:(mirrored?1:-1)*c.x,y:c.y},0,i===0,directions[i]==='↑');return hand.map(p=>({...p,x:p.x*(mirrored?1:-1)}))});
  const frames=[];
  for(let time=period;time<=7000;time+=period){
   const action=Math.max(0,Math.min(1,(time-800)/800));
   let hands=closed,arms=collarArms(),poseHands=hands,bodyVisible=true;
   if(time>800){
    const angles=[0,0],lift=[0,0];
    if(['elbow','occluded','threshold','recovery'].includes(kind))lift.fill(amplitude*action);
    if(kind==='wrist')angles.forEach((_,i)=>angles[i]=angle*action*(i?-1:1)*(mirrored?1:-1));
    if(kind==='mixed'){angles[sample%2]=angle*action*(sample%2?-1:1)*(mirrored?1:-1);lift[1-sample%2]=amplitude*action}
    if(kind==='one-elbow')lift[sample%2]=amplitude*action;
    if(kind==='one-wrist')angles[sample%2]=angle*action*(sample%2?-1:1)*(mirrored?1:-1);
    if(kind==='small-motion')lift.fill((.025+rand()*.02)*action);
    if(kind==='short-pulse')lift.fill(time%1200<350?.14:0);
    if(kind==='wrist-jitter')angles.forEach((_,i)=>angles[i]=Math.sin(time*.03+i)*.12);
    if(kind==='uncertain')lift.fill(amplitude*action);
    if(kind==='jitter')lift.forEach((_,i)=>lift[i]=Math.sin(time*.035+i)*.025);
    if(kind==='threshold'&&Math.floor(time/period)%8===0)lift.forEach((v,i)=>lift[i]=v*.72);
    if(kind==='recovery'||kind==='recover-only'){
     angles.forEach((_,i)=>angles[i]=.68*(i?-1:1)*(mirrored?1:-1));
     if(kind==='recovery')lift.fill(amplitude*Math.max(0,Math.min(1,(time-2300)/800)));
    }
    hands=closed.map((h,i)=>rotate(h,angles[i]));
    if(kind==='lateral')hands=hands.map((h,i)=>h.map(p=>({...p,x:p.x+(i?-1:1)*(mirrored?1:-1)*.22*action})));
    if(kind==='whole-arm'){hands=hands.map(h=>h.map(p=>({...p,y:p.y-.12*action})));lift.fill(.12*action)}
    arms=arms.map((a,i)=>({...a,elbow:{...a.elbow,y:a.elbow.y-lift[i]+(rand()-.5)*noise}}));
    poseHands=hands;
    if(kind==='open')hands=open;
    if(['occluded','recovery','uncertain','teleport','missing','recover-only'].includes(kind))hands=[null,null];
    if(kind==='wrist'||kind==='mixed')hands=hands.map((h,i)=>(Math.floor(time/180)+i)%3?h:null);
    if(kind==='wrist')arms=arms.map(a=>({...a,elbow:null}));
    if(kind==='mixed')arms[sample%2]={...arms[sample%2],elbow:null};
    if(kind==='missing'){arms=[null,null];poseHands=[null,null];bodyVisible=false}
   }
   arms=arms.map((a,i)=>a?{...a,wrist:poseHands[i]?{...poseHands[i][0],x:poseHands[i][0].x+(rand()-.5)*noise,y:poseHands[i][0].y+(rand()-.5)*noise,visibility:kind==='uncertain'&&time>800?.2:visibility}:null}:null);
   if(time>800&&kind==='teleport')arms=arms.map((a,i)=>({...a,elbow:{...a.elbow,y:.55},wrist:{...a.wrist,x:closed[i][0].x+(Math.floor(time/120)%2?.18:-.18)}}));
   if(time>1800&&kind==='occluded'&&Math.floor(time/period)%13<2){hands=[null,null];arms=arms.map(a=>({...a,wrist:null}))}
   frames.push({hands,arms,time,bodyVisible});
  }
  cases.push({id:`${split}/${kind}/${seed}`,kind,expected:positive.has(kind),fps,mirrored,directions,frames});
 }
 return cases;
}
export function evaluateFinish(cases,tuning){
 let positive=0,negative=0,success=0,falseTap=0,latency=0;const failures=[];
 for(const c of cases){
  const model=new CollarInteraction(tuning);let tappedAt=null;
  for(const f of c.frames){
   const state=model.update(f.hands,f.time,{active:true,mirrored:c.mirrored,directions:c.directions,arms:f.arms,bodyVisible:f.bodyVisible,continuousHands:f.hands.map(Boolean)});
   if(state.tapped){tappedAt=f.time;break}
  }
  if(c.expected){positive++;if(tappedAt!==null){success++;latency+=tappedAt}else failures.push(c.id)}
  else {negative++;if(tappedAt!==null){falseTap++;failures.push(c.id)}}
 }
 return {cases:cases.length,positive,negative,success,falseTap,missed:positive-success,meanTapMs:success?Math.round(latency/success):null,failures};
}
