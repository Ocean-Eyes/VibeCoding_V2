import {normalizeControls} from './belt-controls.js';
// Exact reviewed control data. Hidden contacts remain authored inference.
export const BELT_REVIEW=Object.freeze({
 "status": "approved",
 "scope": "character-native instructional flat panels; hidden contact inferred",
 "controlSHA256": "ebcf8e7605ad0c46e4c5067bab2406c3a7d1ed8f68f9fea213316df20f83f86a",
 "sourceVideoSHA256": "661ed0670e8afbadd42a0c3cc21eb9ae86f171c0d5f5c826272b471f4b689822",
 "rigSHA256": "374ee28feaf898b97d5a6b374336af3f39e101bd1409099b2eebbacfeebfb70b",
 "reviewedPaperMotionSHA256": "311f98802e90aa03cb82fc702b8fa89e929fa8df793b91b1d25b2b88151c7e90",
 "paperMotionSHA256": "4e176b335a3ece236800f15d87db724ff61bb2952208d355434224ad5dfd935c",
 "reviewedPaperSceneSHA256": "957e8277d11b472c2e5a9ed9f8573cbe5ab7a7f165706074064f7ff427b4fad3",
 "paperSceneSHA256": "999181b754f6169f6cafd15ef70666a93acb414929df289b88172426cb69910e",
 "reviewedPaperLabelsSHA256": "2ab620e2a08265cd967cbddbf1f9117cacd9aa922f922582b36dec211fb48b4b",
 "paperLabelsSHA256": "f8f0e5a646da3d8e2cc4985c6d64c823e5005d0c5bf6c5b02d8edb691da0bd64",
 "reviewedPaperInspectionSHA256": "3a9f9d5f7d50cb1a6758649f57671a09fe0cef0c4139425caaba07fb18c2e192",
 "paperInspectionSHA256": "f7815f0ae0ddcad627b381e992b0f93189c24e7e668e157c92604efb05bef7d7",
 "originalFrames": 1285,
 "fps": 60,
 "registration": "fixed native character rig; authored contact projection, not source confidence"
});
export const BELT_DATA_URL=new URL('../assets/belt/controls-ebcf8e7605ad.json.gz',import.meta.url);
let cached=null;
export async function loadBeltSource({signal}={}){
 signal?.throwIfAborted();if(cached)return cached;
 const response=await fetch(BELT_DATA_URL,{signal});if(!response.ok)throw new Error('Control download failed');
 let bytes=new Uint8Array(await response.arrayBuffer());
 // Explicit gzip avoids depending on hosting compression. Decoded responses work too.
 if(bytes[0]===31&&bytes[1]===139){
  if(typeof DecompressionStream==='undefined')throw new Error('Gzip decoding unavailable');
  bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 }
 signal?.throwIfAborted();
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==BELT_REVIEW.controlSHA256)throw new Error('Control integrity mismatch');
 const data=JSON.parse(new TextDecoder().decode(bytes));
 if(data.source?.sourceVideoSHA256!==BELT_REVIEW.sourceVideoSHA256||data.frames?.length!==BELT_REVIEW.originalFrames)throw new Error('Unreviewed control source');
 const normalized=normalizeControls(data);signal?.throwIfAborted();cached=normalized;return cached;
}
