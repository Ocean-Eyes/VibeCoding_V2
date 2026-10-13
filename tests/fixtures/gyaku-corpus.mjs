import {CollarInteraction,graspCenter} from '../../src/collar-interaction.js';
import {gyakuHands} from './gyaku-hands.mjs';
import {collarArms} from './collar-hands.mjs';
const kinds=['roll','edge-open-estimate','collapsed-estimate','one-edge','alternating-loss','wrist-only','body-wrists-missing','clear-release','tilted-release','three-finger-release','wrong-face','open-only','one-arm','still','wide-pull','unseen'];
const finishes=new Set(kinds.slice(0,7)),releases=new Set(kinds.slice(7,10));
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
export function gyakuCorpus(split='train',samples=24){
 const cases=[];
 for(let n=0;n<samples;n++)for(const kind of kinds){
  const seed=(split==='train'?21000:split==='holdout-v3'?83000:51000)+n*47+kinds.indexOf(kind),rand=random(seed),fps=[10,15,24,30,60][n%5],period=1000/fps,mirror=n%2===0,scale=.75+rand()*.5;
  const roll=1.27+rand()*.24,collapse=.23+rand()*.14,openRoll=.2+rand()*.8,amplitude=.10+rand()*.05;
  const make=options=>gyakuHands({mirror,scale,...options});
  const closed=make({}),open=make({curl:.1}),frames=[];
  for(let time=period;time<=6100;time+=period){
   let hands=closed,arms=collarArms(),poseHands=hands;
   const releasing=time>=4600||releases.has(kind)&&time>=2100;
   if(time>650&&!releasing){
    const u=Math.min(1,(time-650)/650);
    hands=make({roll:roll*u});
    if(kind==='edge-open-estimate')hands=make({curl:0,roll});
    if(kind==='collapsed-estimate')hands=make({curl:0,roll:.2,collapsed:collapse});
    if(kind==='one-edge'){hands=make({curl:0,roll});hands[n%2]=make({roll:.3})[n%2]}
    if(kind==='body-wrists-missing')hands=make({curl:0,roll});
    if(kind==='still'||kind==='one-arm')hands=closed;
    if(kind==='wide-pull')hands=closed.map((h,i)=>h.map(p=>({...p,x:p.x+(i?-1:1)*(mirror?1:-1)*.23*u})));
    const lift=finishes.has(kind)&&time>2300?amplitude*Math.min(1,(time-2300)/500):0;
    arms=arms.map((a,i)=>({...a,elbow:{...a.elbow,y:a.elbow.y-(kind==='one-arm'&&i===n%2?.14:lift)}}));
    poseHands=hands;
    if(kind==='alternating-loss')hands=hands.map((h,i)=>(Math.floor(time/150)+i)%3?h:null);
    if(kind==='wrist-only'||kind==='unseen')hands=[null,null];
   }
   if(releasing){
    hands=make({curl:.1,roll:kind==='tilted-release'?openRoll:.15});
    if(kind==='three-finger-release')hands=hands.map((h,i)=>h.map((p,k)=>k>=18?closed[i][k]:p));
    poseHands=hands;
   }
   if(kind==='wrong-face'){hands=make({wrongFace:true});poseHands=hands}
   if(kind==='open-only'){hands=open;poseHands=hands}
   arms=arms.map((a,i)=>({...a,wrist:poseHands[i]?{...poseHands[i][0],visibility:.55+rand()*.4}:null}));
   if((kind==='body-wrists-missing'||kind==='unseen')&&time>650&&!releasing)arms=arms.map(a=>({...a,wrist:null}));
   frames.push({time,hands,arms,releasing});
  }
  cases.push({id:`${split}/${kind}/${seed}`,kind,fps,mirror,finish:finishes.has(kind),release:releases.has(kind),invalid:['wrong-face','open-only'].includes(kind),frames});
 }
 return cases;
}
export function evaluateGyaku(cases,tuning){
 const result={cases:cases.length,passed:0,gripLost:0,ghostLost:0,missedTap:0,falseTap:0,missedRelease:0,falseAcquire:0,failures:[]};
 for(const c of cases){
  const model=new CollarInteraction(tuning),flags=new Set();let tapped=false,state;
  for(const f of c.frames){
   state=model.update(f.hands,f.time,{active:true,mirrored:c.mirror,directions:['↑','↑'],bodyVisible:true,arms:f.arms,continuousHands:f.hands.map(Boolean)});
   if(state.tapped)tapped=true;
   if(c.invalid&&state.count)flags.add('falseAcquire');
   if(!c.invalid&&f.time>600&&!f.releasing&&state.count!==2)flags.add('gripLost');
   if(!c.invalid&&c.kind!=='unseen'&&f.time>1000&&!f.releasing){
    for(let i=0;i<2;i++)if(!model.hands[i].tracked&&!state.wristHands[i])flags.add('ghostLost');
   }
  }
  if(c.finish&&!tapped)flags.add('missedTap');if(!c.finish&&tapped)flags.add('falseTap');
  if(!c.invalid&&state.count!==0)flags.add('missedRelease');
  if(!flags.size)result.passed++;else {for(const flag of flags)result[flag]++;result.failures.push({id:c.id,flags:[...flags]})}
 }
 return result;
}
