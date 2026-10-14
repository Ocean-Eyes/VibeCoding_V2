import {createTimeline} from '../assets/vendor/animejs/anime.esm.min.js';
import {beltInspectionPoints} from './belt-geometry.js';
// Pause at actual tip arrival and B emergence. Timing does not change geometry.
export function createBeltTimeline({step,onUpdate=()=>{},onComplete=()=>{},caption=null,reduced=false}){
 const head={value:0},intro=reduced?0:350,move=step>=3&&step<=5?4400:2800,hold=850;
 const checkpoints=beltInspectionPoints(step),stops=[...checkpoints,1],holds=[];
 const timeline=createTimeline({autoplay:false,onUpdate:self=>{const inspection=holds.find(([a,b])=>self.currentTime>=a&&self.currentTime<b);onUpdate(inspection?inspection[2]:head.value,!!inspection)},onComplete});
 if(caption&&!reduced)timeline.add(caption,{opacity:[0,1],translateY:[8,0],duration:intro,ease:'outQuad'},0);
 let previous=0,cursor=intro;
 for(const stop of stops){
  const duration=move*(stop-previous);
  timeline.add(head,{value:[previous,stop],duration,ease:'inOutSine'},cursor);cursor+=duration;
  if(stop<1){const pause=950;holds.push([cursor,cursor+pause,stop]);cursor+=pause}
  previous=stop;
 }
 timeline.add({duration:hold},cursor);
 return {timeline,head};
}
