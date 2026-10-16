import {normalizeControls} from './belt-controls.js';
// Exact reviewed control data. Hidden contacts remain authored inference.
export const BELT_REVIEW=Object.freeze({
 "status": "reference-reviewed",
 "scope": "source-aligned wrap and layer entry corrections; hidden depth/contact inferred",
 "controlSHA256": "ebcf8e7605ad0c46e4c5067bab2406c3a7d1ed8f68f9fea213316df20f83f86a",
 "sourceVideoSHA256": "661ed0670e8afbadd42a0c3cc21eb9ae86f171c0d5f5c826272b471f4b689822",
 "rigSHA256": "374ee28feaf898b97d5a6b374336af3f39e101bd1409099b2eebbacfeebfb70b",
 "paperMotionSHA256": "0eec1f6b2cbfb6c2731a7e39c0e6f61c2944e9ebb56f782044c8dcebaca10513",
 "paperSceneSHA256": "8eea03972e5fac9e56289fe6225dda521b0a1c317c431c9f0a926d7c081e5cdb",
 "paperLabelsSHA256": "f8f0e5a646da3d8e2cc4985c6d64c823e5005d0c5bf6c5b02d8edb691da0bd64",
 "paperInspectionSHA256": "d669def6bf8b45dd350ac72adf9c50136ce0983ee8b98e2cddc349cf6a9b78b7",
 "wrapMotionSHA256": "d701181942b65142f50720eedb2ff9b466eee0d8d7f374209daa0548ce47dd42",
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
