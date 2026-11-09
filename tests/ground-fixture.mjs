export function groundFixture(id,phase=0,aspect=9/16){
 const normalized=Array.from({length:33},()=>({x:0,y:.5}));
 const set=(i,x,y)=>normalized[i]={x,y};
 set(0,0,-.4);set(11,.5,0);set(12,-.5,0);set(13,.55,.45);set(14,-.65,.3);
 set(23,.3,.95);set(24,-.3,.95);
 set(25,.7,1.25);set(26,-.7,1.25);set(27,.95,.95);set(28,-.95,.95);
 if(id==='ude-garami'){set(16,-.35,.65);set(15,...(phase===0?[.5,.7]:phase===1?[-.15,1.0]:[-.44,.545]));}
 else{set(16,-.52,.15);set(15,.05,.65);}
 if(id==='ude-garami'&&phase===3)set(13,.55,.20);
 const points=normalized.map(p=>({x:.5+p.x*.22,y:(.14+p.y*.22)/aspect,z:0,visibility:1}));
 const hands=[15,16].map(i=>Array.from({length:21},(_,j)=>({x:points[i].x+(j===0?0:(j%4-1)*.002),y:points[i].y+(j===0?0:[8,12,16,20].includes(j)?.015:.035),z:0})));
 return {points,hands};
}
