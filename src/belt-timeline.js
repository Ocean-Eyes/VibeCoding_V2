import {createTimeline} from '../assets/vendor/animejs/anime.esm.min.js';
// Timing is separate from cloth geometry. Inspect the insertion before moving
// on; no spring/bounce easing on the stiff belt or the camera.
export function createBeltTimeline({step,onUpdate=()=>{},onComplete=()=>{},caption=null,reduced=false}){
 const head={value:0},intro=reduced?0:350,move=step>=3&&step<=5?4400:2800,inspect=step>=3&&step<=5?950:350,hold=850;
 const first=move*.58,second=move-first;
 const timeline=createTimeline({autoplay:false,onUpdate:self=>onUpdate(head.value,self.currentTime>=intro+first&&self.currentTime<intro+first+inspect),onComplete});
 if(caption&&!reduced)timeline.add(caption,{opacity:[0,1],translateY:[8,0],duration:intro,ease:'outQuad'},0);
 timeline.add(head,{value:[0,.58],duration:first,ease:'inOutSine'},intro)
  .add(head,{value:[.58,1],duration:second,ease:'inOutSine'},intro+first+inspect)
  .add({duration:hold},intro+move+inspect);
 return {timeline,head};
}
