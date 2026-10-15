// Immutable source controls; inferred values retain their observation provenance.
const finite=Number.isFinite;
export function normalizeControls(input){
 if(!input?.source||!Array.isArray(input.frames)||!input.frames.length||input.frames.length!==input.source.frameCount)throw new Error('Control frame coverage mismatch');
 if(input.source.fps!==60||input.source.allOriginalPTSRetained!==true)throw new Error('All native source frames are required');
 const prohibited=new Set(['contour','contours','polygon','polygons','beltShading','handRegions','beltRegions','sourceImage','imagePixels']);
 function audit(value){if(Array.isArray(value)){for(const x of value)audit(x)}else if(value&&typeof value==='object')for(const [key,x]of Object.entries(value)){if(prohibited.has(key))throw new Error('Source silhouette is not a retargeting control: '+key);audit(x)}}
 audit(input);
 let previous=-Infinity;
 input.frames.forEach((frame,index)=>{
  if(frame.frameIndex!==index||!finite(frame.originalPTS)||frame.originalPTS<=previous||Math.abs(frame.originalPTS-index/60)>1e-6)throw new Error('Original frame/PTS discontinuity');
  previous=frame.originalPTS;
  for(const id of ['Left','Right']){
   const state=frame.hands?.[id]?.resolved;if(!state)continue;
   if(!Array.isArray(state.gripCenter)||state.gripCenter.length!==2||!state.gripCenter.every(finite)||!finite(state.orientationRad))throw new Error('Invalid resolved hand control');
   if(!Array.isArray(state.curl)||state.curl.length!==5||!state.curl.every(v=>finite(v)&&v>=0&&v<=1))throw new Error('Invalid finger curl control');
  }
 });
 // Metadata and null observations remain untouched: resolved controls include
 // explicitly inferred/filtered motion and are not raw anatomical measurements.
 return {source:input.source,contract:input.contract,frames:input.frames,startPTS:input.frames[0].originalPTS,endPTS:input.frames.at(-1).originalPTS};
}
export function sampleControlFrame(track,pts){
 if(!finite(pts))throw new Error('Invalid source PTS');let lo=0,hi=track.frames.length-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(track.frames[mid].originalPTS<=pts)lo=mid;else hi=mid-1}
 return track.frames[lo];
}
