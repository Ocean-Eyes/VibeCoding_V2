// Render/collision coordinates have their own limits; camera filtering must not
// have to discard normal hand movement merely to protect the garment.
export const CLOTH_MAX_TRAVEL=.24;
export const CLOTH_SPEED=.35;
const length=p=>Math.hypot(p.dx,p.dy);
const clampTravel=g=>{
 const d=length(g),s=d>CLOTH_MAX_TRAVEL?CLOTH_MAX_TRAVEL/d:1;
 return {...g,dx:g.dx*s,dy:g.dy*s};
};
export class ClothMotion{
 constructor(){this.reset()}
 reset(){this.sides=new Map();this.time=null}
 update(targets,now){
  const dt=this.time===null?0:Math.min(.05,Math.max(0,(now-this.time)/1000));this.time=now;
  const result=[];
  for(const side of [-1,1]){
   const source=targets.find(g=>g.side===side),old=this.sides.get(side);
   if(!source&&!old)continue;
   const target=source?clampTravel(source):{...old,dx:0,dy:0,engagement:0};
   // Regripping recovering fabric must retain the rendered pose at contact.
   // With zero displacement, contact parameter can be changed invisibly.
   const current=old??{...target,dx:0,dy:0,engagement:0};
   const delta={dx:target.dx-current.dx,dy:target.dy-current.dy},d=length(delta),u=d?Math.min(1,CLOTH_SPEED*dt/d):1;
   const engagement=current.engagement??0,desired=target.engagement??0;
   const next={...target,t:source?target.t:current.t,dx:current.dx+delta.dx*u,dy:current.dy+delta.dy*u,
    engagement:engagement+Math.max(-dt*1.5,Math.min(dt*1.5,desired-engagement))};
   if(!source&&length(next)<1e-8&&next.engagement<1e-8){this.sides.delete(side);continue}
   this.sides.set(side,next);result.push({...next});
  }
  return result;
 }
}
