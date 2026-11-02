import {PHASE_SECONDS} from './throw-motion.js';

// These are existing authored timing intervals, not named teaching stages.
export const THROW_DURATION=PHASE_SECONDS.reduce((sum,seconds)=>sum+seconds,0);
export function throwTimeAtElapsed(elapsed){
 let remaining=Math.max(0,Math.min(THROW_DURATION,elapsed));
 for(let i=0;i<PHASE_SECONDS.length;i++){
  if(remaining<=PHASE_SECONDS[i])return i+remaining/PHASE_SECONDS[i];
  remaining-=PHASE_SECONDS[i];
 }
 return PHASE_SECONDS.length;
}
