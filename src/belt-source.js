import {normalizeControls} from './belt-controls.js';
// Exact reviewed control data. Hidden contacts remain authored inference.
export const BELT_REVIEW=Object.freeze({
 "status": "reference-reviewed",
 "scope": "authored chest-to-waist continuous material preparation; unchanged Blender tying from 8.5s; material-attached hands; front body occlusion and oblique surface review; hidden depth authored",
 "controlSHA256": "ebcf8e7605ad0c46e4c5067bab2406c3a7d1ed8f68f9fea213316df20f83f86a",
 "sourceVideoSHA256": "661ed0670e8afbadd42a0c3cc21eb9ae86f171c0d5f5c826272b471f4b689822",
 "rigSHA256": "374ee28feaf898b97d5a6b374336af3f39e101bd1409099b2eebbacfeebfb70b",
 "paperMotionSHA256": "15492048402cc326906e0e371daeb002527c7ddf58c1fef40ca0fbfc174e9850",
 "paperSceneSHA256": "6eeb89b7d25f2f18331c77ed5722d6b1c80b8e914f28603cab916eb30c235fb5",
 "paperLabelsSHA256": "f8f0e5a646da3d8e2cc4985c6d64c823e5005d0c5bf6c5b02d8edb691da0bd64",
 "paperInspectionSHA256": "572fb118f64ceffc6c0553c3cfb067b9ba932374c686b998a506a6a177ce3896",
 "wrapMotionSHA256": "4126ee15cf70a6c806d46fbf27d9c43a937d47df39e71240df861fa7481f0b4c",
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
