import {createTimeline} from '../assets/vendor/animejs/anime.esm.min.js';
import {BELT_INTERVALS} from './belt-sequence.js';
import {clockSegments} from './belt-clock.js';
export function createBeltTimeline({step,onUpdate=()=>{},onComplete=()=>{},caption=null,reduced=false}){
 const head={value:0},intro=reduced?0:350,holds=[];
 const timeline=createTimeline({autoplay:false,onUpdate:self=>{const inspection=holds.find(([a,b])=>self.currentTime>=a&&self.currentTime<b);onUpdate(inspection?inspection[2]:head.value,!!inspection)},onComplete});
 if(caption&&!reduced)timeline.add(caption,{opacity:[0,1],translateY:[8,0],duration:intro,ease:'outQuad'},0);
 let cursor=intro;
 for(const part of clockSegments(BELT_INTERVALS[step],step)){
  timeline.add(head,{value:[part.from,part.to],duration:part.duration,ease:'linear'},cursor);cursor+=part.duration;
  if(part.hold){holds.push([cursor,cursor+part.hold,part.to]);cursor+=part.hold}
 }
 timeline.add({duration:850},cursor);return {timeline,head,holds};
}
