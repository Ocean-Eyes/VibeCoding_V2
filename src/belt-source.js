import {normalizeTracking} from './belt-player.js';
// Independent review of these exact input hashes; this does not relabel model
// estimates as ground truth or manufacture a numerical detection confidence.
export const BELT_REVIEW=Object.freeze({
 status:'approved',scope:'visible front-view vector observations and short-tail teaching drawing',
 belt:'0f3d3c3e5815d967bd386cea735e1009bfedf02d0d92efaee1141fac5523e0c3',
 hands:'82ff12472ee6f714292abef10fcc89c93503b45fd48ae70f49a29de0439c0664',
 reviewedRenderer:'70f44cf424ab558831d2ee9d6b42d4c791d7287f042bfb7da0f5663ae7ba936d',
 packed:'12dd282461bd4397aad73cf6314304a97e015c7acaec6cd1f315f89fdf2513d9',
 registration:{status:'approved-fixed-registration',anchor:[.5,.5],width:.65,bodyScale:.74},
 teaching:{from:0,to:21.4,freeTailOnly:true,evidence:'independent v4 source and contour review; hand clearance >= .433 waist units'}
});
export const BELT_DATA_URL=new URL('../assets/belt/tracked-v4-12dd282461bd.json.gz',import.meta.url);
let cached=null;
export async function loadBeltSource({signal}={}){
 if(cached)return cached;
 const response=await fetch(BELT_DATA_URL,{signal});if(!response.ok)throw new Error('Tracking download failed');
 let bytes=new Uint8Array(await response.arrayBuffer());
 // Explicit .gz keeps the network payload small even on hosts without automatic
 // compression. A host which transparently decodes gzip is accepted too.
 if(bytes[0]===31&&bytes[1]===139){
  if(typeof DecompressionStream==='undefined')throw new Error('Gzip decoding unavailable');
  const decompressed=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  bytes=new Uint8Array(await new Response(decompressed).arrayBuffer());
 }
 signal?.throwIfAborted();
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==BELT_REVIEW.packed)throw new Error('Tracking integrity mismatch');
 const data=JSON.parse(new TextDecoder().decode(bytes)),sources=data.packing?.sourceHashes;
 if(sources?.belt!==BELT_REVIEW.belt||sources?.hands!==BELT_REVIEW.hands||data.frames.length!==1285)throw new Error('Unreviewed tracking source');
 signal?.throwIfAborted();
 cached=normalizeTracking(data,BELT_REVIEW);return cached;
}
