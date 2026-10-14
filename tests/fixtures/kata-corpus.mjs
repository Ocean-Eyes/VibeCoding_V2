import {CollarInteraction} from '../../src/collar-interaction.js';
import {kataHands,kataArms,rotateKataHand} from './kata-hands.mjs';
const positive=['forearm','opposite-view','elbows','wrists','mixed-evidence','staggered','one-hidden','both-hidden','brief-joint-loss'];
const kinds=[...positive,'still','one-forearm','one-wrist','one-elbow','whole-arm','lateral','elbow-slide','jitter','short-pulse','missing-joints','wrong-face','open'];
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
export function kataCorpus(samples=24){
 const cases=[];
 for(let n=0;n<samples;n++)for(const kind of kinds){
  const seed=141000+n*47+kinds.indexOf(kind),rand=random(seed),mirror=n%2===0,reverse=Math.floor(n/2)%2===0,fps=[10,15,30,60][Math.floor(n/4)%4],period=1000/fps;
  const scale=.8+rand()*.4,angle=.29+rand()*.13,noise=.001+rand()*.002,visibility=.7+rand()*.3;
  const closed=kataHands({mirror,reverse,scale}),opened=kataHands({mirror,reverse,scale,curl:0}),frames=[],sign=mirror?1:-1;
  for(let time=period;time<=6200;time+=period){
   const u=Math.max(0,Math.min(1,(time-750)/1000)),a=angle*u*sign,angles=[0,0],lift=[0,0];let hands=closed;
   if(positive.includes(kind)&&!['elbows','wrists','mixed-evidence'].includes(kind))angles.fill(kind==='opposite-view'?-a:a);
   if(kind==='elbows')lift.fill(.13*u);
   if(kind==='wrists')hands=closed.map((h,i)=>rotateKataHand(h,(i?-1:1)*a));
   if(kind==='mixed-evidence'){angles[n%2]=a;hands=closed.map((h,i)=>i===n%2?h:rotateKataHand(h,(i?-1:1)*a))}
   if(kind==='staggered')angles[1]=angle*sign*Math.max(0,Math.min(1,(time-1300)/900));
   if(kind==='one-forearm')angles[n%2]=a;
   if(kind==='one-elbow')lift[n%2]=.14*u;
   if(kind==='one-wrist')hands=closed.map((h,i)=>i===n%2?rotateKataHand(h,(i?-1:1)*a):h);
   if(kind==='jitter')angles.forEach((_,i)=>angles[i]=Math.sin(time*.018+i)*.065);
   if(kind==='short-pulse'&&time>750)angles.fill(time%1600<450?.36*sign:0);
   let arms=kataArms(hands,{mirror,angles,lift,visibility});
   if(kind==='whole-arm'){
    hands=hands.map(h=>h.map(p=>({...p,x:p.x+.08*u,y:p.y-.12*u})));
    arms=arms.map(a=>Object.fromEntries(Object.entries(a).map(([k,p])=>[k,{...p,x:p.x+.08*u,y:p.y-.12*u}])));
   }
   if(kind==='lateral'){
    hands=hands.map((h,i)=>h.map(p=>({...p,x:p.x+(i?-1:1)*sign*.22*u})));
    arms=arms.map((a,i)=>({...a,wrist:{...hands[i][0],visibility}}));
   }
   if(kind==='elbow-slide')arms=arms.map(a=>({...a,elbow:{...a.elbow,x:a.elbow.x+.23*u}}));
   arms=arms.map((a,i)=>({...a,elbow:{...a.elbow,x:a.elbow.x+Math.sin(time*.01+i)*noise,y:a.elbow.y+Math.cos(time*.013+i)*noise}}));
   if(time>750){
    if(kind==='one-hidden')hands=hands.map((h,i)=>i===n%2?null:h);
    if(kind==='both-hidden')hands=[null,null];
    if(kind==='brief-joint-loss'&&Math.floor(time/period)%17===0){hands=[null,null];arms=arms.map(a=>({...a,wrist:null,elbow:null}))}
    if(kind==='missing-joints'){hands=[null,null];arms=arms.map(a=>({...a,wrist:null,elbow:null}))}
   }
   if(kind==='wrong-face')hands=kataHands({mirror,reverse:!reverse,scale});
   if(kind==='open')hands=opened;
   if(time>=5200){hands=opened;arms=kataArms(hands,{mirror})}
   frames.push({time,hands,arms});
  }
  cases.push({id:`kata/${kind}/${seed}`,kind,mirror,reverse,fps,expected:positive.includes(kind),frames});
 }
 return cases;
}
export function evaluateKata(c){
 const model=new CollarInteraction();let state,tapped=false,gripLost=false,ghostLost=false,maxCloth=0;
 for(const f of c.frames){
  state=model.update(f.hands,f.time,{active:true,mirrored:c.mirror,directions:c.reverse?['↓','↑']:['↑','↓'],bodyVisible:true,arms:f.arms,continuousHands:f.hands.map(Boolean)});
  tapped||=state.tapped;
  if(c.expected&&f.time>700&&f.time<5200){
   gripLost||=state.count!==2;
   if(c.kind!=='brief-joint-loss')ghostLost||=model.hands.some((h,i)=>!h.tracked&&!state.wristHands[i]);
   maxCloth=Math.max(maxCloth,...state.deformation.map(g=>Math.hypot(g.dx,g.dy)));
  }
 }
 return {tapped,gripLost,ghostLost,released:state.count===0,maxCloth};
}
