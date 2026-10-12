// Hand identity is assigned before filtering; detector array order can change at a crossing.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function assignHands(hands,points,previous=[null,null]){
  const valid=hands.filter(h=>h?.length===21&&h.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  const cost=(h,side)=>{
    const wrist=points?.[15+side],old=previous[side]?.[0];
    if(wrist&&(wrist.visibility??1)>=.65)return distance(h[0],wrist)+(old?.x!==undefined?distance(h[0],old)*.08:0);
    return old?distance(h[0],old):1;
  };
  if(!valid.length)return [null,null];
  if(valid.length===1){const side=cost(valid[0],0)<=cost(valid[0],1)?0:1;return side?[null,valid[0]]:[valid[0],null]}
  return cost(valid[0],0)+cost(valid[1],1)<=cost(valid[1],0)+cost(valid[0],1)?valid.slice(0,2):[valid[1],valid[0]];
}
const alpha=(cutoff,dt)=>1/(1+1/(2*Math.PI*cutoff*dt));
// Adaptive low-pass in normalized camera coordinates: quiet hands are stabilized,
// deliberate motion raises the cutoff. Confidence and tracking loss are never held over.
export class LandmarkStream{
  constructor(){this.reset()}
  reset(){this.previous=null;this.filtered=null;this.velocity=[];this.from=null;this.time=null;this.period=0}
  update(points,time){
    if(!points){this.reset();return null}
    if(this.time===null||time-this.time>250||time<=this.time){
      this.previous=points.map(p=>p?{...p}:null);this.filtered=this.previous;this.from=this.filtered;
      this.velocity=points.map(()=>0);this.time=time;this.period=0;return this.filtered;
    }
    const dt=Math.max(.001,(time-this.time)/1000),from=this.at(time);
    this.filtered=points.map((p,i)=>{
      if(!p||(p.visibility??1)<.65){this.velocity[i]=0;return p?{...p}:null}
      const old=this.previous[i],f=this.filtered[i];
      if(!old||!f||(old.visibility??1)<.65){this.velocity[i]=0;return {...p}}
      const speed=distance(p,old)/dt;
      this.velocity[i]=(this.velocity[i]||0)+alpha(1,dt)*(speed-(this.velocity[i]||0));
      const a=alpha(1.8+12*this.velocity[i],dt),out={...p};
      for(const key of ['x','y','z'])if(Number.isFinite(p[key])&&Number.isFinite(f[key]))out[key]=f[key]+a*(p[key]-f[key]);
      return out;
    });
    this.from=from;this.previous=points.map(p=>p?{...p}:null);this.period=Math.min(65,time-this.time);this.time=time;
    return this.filtered;
  }
  at(time){
    if(!this.filtered||time-this.time>250)return null;
    const t=this.period?Math.max(0,Math.min(1,(time-this.time)/this.period)):1;
    return this.filtered.map((p,i)=>{
      const a=this.from?.[i];if(!p||!a||(p.visibility??1)<.65||(a.visibility??1)<.65)return p;
      return {...p,x:a.x+(p.x-a.x)*t,y:a.y+(p.y-a.y)*t,z:(a.z??0)+((p.z??0)-(a.z??0))*t};
    });
  }
}
export function projectHand(hand,body,scene,mirrored=true){
  const sign=mirrored?-1:1;
  return hand.map(p=>{
    const dx=p.x-body.origin.x,dy=p.y-body.origin.y;
    return {x:scene.origin.x+sign*(dx*body.x.x+dy*body.x.y)/body.scale*scene.scale,
      y:scene.origin.y+(dx*body.y.x+dy*body.y.y)/body.scale*scene.scale,z:(p.z??0)/body.scale*scene.scale};
  });
}
// Signed palm normal in image space. Mirroring changes the projection, not identity.
export function palmFacing(hand,left,mirrored=true){
  const a=hand[5],b=hand[17],w=hand[0];
  const cross=(a.x-w.x)*(b.y-w.y)-(a.y-w.y)*(b.x-w.x);
  return cross*(left?1:-1)*(mirrored?-1:1)>0;
}
