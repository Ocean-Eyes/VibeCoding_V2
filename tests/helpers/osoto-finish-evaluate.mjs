import {finishFixture} from '../fixtures/osoto-finish-corpus.mjs';
import {OsotoProgress} from '../../src/osoto-practice.js';
export function evaluateFinishSequence(sample,{Engine=OsotoProgress,frames=55,interval=65,dropouts=false,spike=false}={}){
 const game=new Engine();game.stage=3;
 for(let n=0;n<15;n++)game.finishJudge?.observeReference(finishFixture({...sample.options,kind:'entry',noise:sample.options.noise,seed:sample.options.seed+n,occluded:false,confidence:1}));
 let steps=0,state;
 for(let frame=0;frame<frames&&!game.done;frame++){
  let points=finishFixture({...sample.options,seed:sample.options.seed+frame*3});
  if(dropouts&&frame>=8&&frame<=9)points=null;
  if(spike&&frame===10)for(const i of [11,12,26,28])if(points?.[i])points[i].z+=.4;
  state=game.update(points,frame*interval);steps++;
 }
 return {done:game.done,steps,state,hold:game.hold};
}
