import {openFingers} from './collar-interaction.js';
// The grip latch may retain a closed hand through ambiguous finger evidence.
// That stored shape is only a display fallback when fresh landmarks are absent.
function plausibleFingers(hand,reference){
 if(!reference)return true;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
 const palm=h=>Math.max(distance(h[0],h[9]),distance(h[5],h[17]),.00001);
 const chain=(h,k)=>distance(h[k],h[k+1])+distance(h[k+1],h[k+2])+distance(h[k+2],h[k+3]);
 return [5,9,13,17].every(k=>{
  const ratio=(chain(hand,k)/palm(hand))/Math.max(.00001,chain(reference,k)/palm(reference));
  return ratio>=.45&&ratio<=2.2;
 });
}
export function selectGlove(observed,retained,wristFallback){
 // Clear curls preserve bone lengths. Collapsed hidden-joint estimates do not;
 // they should not replace the last usable shape with shrunken fingers.
 if(observed&&plausibleFingers(observed,wristFallback))return {hand:observed,source:'live'};
 if(wristFallback)return {hand:wristFallback,source:'wrist'};
 return {hand:retained,source:retained?'retained':'missing'};
}
export function hideCollarThumb(hand,requested){
 if(!requested||!hand||openFingers(hand).length>=3)return false;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const size=Math.max(distance(hand[0],hand[9]),distance(hand[5],hand[17]));
 // A stretched thumb outside the grip must stay visible. Merely retaining a
 // Nami/Kata grip during release does not put the user's whole thumb in cloth.
 return size>0&&[3,4].every(k=>distance(hand[k],hand[5])<size*.6);
}

// Hand and body filters can disagree during initialization, identity swaps or
// occlusion. Never draw a long forearm to a pose wrist somewhere else on screen.
// All inputs are in the same shoulder-width scene coordinates.
export function gloveElbow(hand,arm){
 if(!hand||!arm?.wrist||!arm?.elbow)return null;
 if((arm.wrist.visibility??1)<.65||(arm.elbow.visibility??1)<.65)return null;
 const wrist=hand[0],distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const palm=Math.max(distance(wrist,hand[9]),distance(hand[5],hand[17]));
 const tolerance=Math.min(.12,Math.max(.035,palm*.5));
 return distance(wrist,arm.wrist)<=tolerance?arm.elbow:null;
}
