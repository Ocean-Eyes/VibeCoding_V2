import {posedHand,handViewPoint} from '../../src/hand-rig.js';
import {graspCenter,lapelRest} from '../../src/collar-interaction.js';
// Flex the interphalangeal joints independently of the knuckles. The old
// fixture tied every joint to one curl value and missed collar-hook grips.
export function acquisitionHands({hook=.6,curl=0,scale=1,mirror=true,palmUp=true,contact='knuckles',offset=0,depth=1}={}){
 return [0,1].map(i=>{
  const joints={};for(let d=2;d<=5;d++){joints[`ra_pip${d}_e_f`]=hook;joints[`ra_dip${d}_e_f`]=hook*.6}
  const a=i?-.95:.95,c=Math.cos(a),s=Math.sin(a);
  const h=posedHand(curl,joints).landmarks.map(p=>{const [x,y,z]=handViewPoint(p,i===0,palmUp);return {x:2.55*scale*(x*c-y*s)*(mirror?1:-1),y:2.55*scale*(x*s+y*c),z:z*2.55*scale*depth}});
  const anchor=contact==='fingers'?[6,10,14,18].reduce((a,k)=>({x:a.x+h[k].x/4,y:a.y+h[k].y/4}),{x:0,y:0}):graspCenter(h);
  const target=lapelRest((i?-1:1)*(mirror?1:-1),i?.20:.12);
  return h.map(p=>({...p,x:p.x+target.x-anchor.x+offset*(i?-1:1)*(mirror?1:-1),y:p.y+target.y-anchor.y}));
 });
}
