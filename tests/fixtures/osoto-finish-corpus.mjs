// Independent fixed-length anatomy and pinhole camera fixtures, not scoring targets.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=a=>mul(a,1/Math.hypot(...a));
function knee(root,foot,a,b){
 const delta=sub(foot,root),d=Math.hypot(...delta);
 if(d>=a+b||d<=Math.abs(a-b))return null;
 const axis=unit(delta),along=(a*a-b*b+d*d)/(2*d);
 const pole=unit(sub([0,0,1],mul(axis,axis[2])));
 return add(add(root,mul(axis,along)),mul(pole,Math.sqrt(a*a-along*along)));
}
export function finishFixture(options={}){
 const o={torso:.49,thigh:.46,shin:.45,lean:.30,lift:.20,back:.32,yaw:0,pitch:0,roll:0,distance:4,
  aspect:16/9,depthGain:1,noise:0,seed:0,kind:'finish',occluded:false,confidence:1,center:.5,...options};
 const leg=o.thigh+o.shin,py=leg*.95+.065,hip=.14,shoulder=.205;
 const p=Array(33).fill(null),left=[hip,.065,.06],right=[-hip,.065+o.lift,-o.back];
 if(o.kind==='standing'||o.kind==='entry'){right[1]=.065;right[2]=-.10;o.lean=o.kind==='entry'?.05:0;}
 if(o.kind==='grounded'){right[1]=.065;right[2]=-.10;}
 if(o.kind==='upright')o.lean=0;
 if(o.kind==='backward')o.lean=-.20;
 if(o.kind==='forward'){right[2]=.40;right[1]=.065+.45;o.lean=.05;}
 if(o.kind==='curl'){right[2]=-.05;right[1]=.065+.55;}
 if(o.kind==='left'){left[1]+=.20;left[2]=-.30;right[1]=.065;right[2]=.06;}
 const pelvis=[0,py,0],up=[0,Math.cos(o.lean),Math.sin(o.lean)];
 p[23]=[hip,py,0];p[24]=[-hip,py,0];p[27]=left;p[28]=right;
 p[25]=knee(p[23],left,o.thigh,o.shin);p[26]=knee(p[24],right,o.thigh,o.shin);
 if(!p[25]||!p[26])return null; // Do not hide unreachable fixtures by stretching/clamping.
 p[11]=add(add(pelvis,mul(up,o.torso)),[shoulder,0,0]);
 p[12]=add(add(pelvis,mul(up,o.torso)),[-shoulder,0,0]);p[0]=add(pelvis,mul(up,o.torso+.22));
 p[13]=add(p[11],[.05,-.25,.18]);p[15]=add(p[11],[.06,-.40,.42]);
 p[14]=add(p[12],[0,-.16,.25]);p[16]=add(p[12],[.08,.02,.35]);
 const cy=Math.cos(o.yaw),sy=Math.sin(o.yaw),cp=Math.cos(o.pitch),sp=Math.sin(o.pitch),cr=Math.cos(o.roll),sr=Math.sin(o.roll);
 const camera=v=>{const [x,y,z]=sub(v,pelvis),xx=cy*x+sy*z,zz=-sy*x+cy*z,yy=cp*y-sp*zz,depth=sp*y+cp*zz;return [cr*xx-sr*yy,sr*xx+cr*yy,depth];};
 const scale=.20*Math.min(o.aspect,.9),pixels=p.map((v,i)=>{
  if(!v)return null;const [x,y,z]=camera(v),k=o.distance/(o.distance-z),wave=Math.sin(o.seed*13+i*7),wave2=Math.cos(o.seed*17+i*11);
  return {x:o.center+x*scale*k+wave*o.noise*scale,y:o.aspect*.5-y*scale*k+wave2*o.noise*scale,
   z:-z*scale*o.depthGain+Math.sin(i*5+o.seed)*o.noise*scale+(o.depthOffsets?.[i]??0)*scale,visibility:o.confidence};
 });
 if(o.occluded)for(const i of [0,13,14,15,16])pixels[i]=null;
 if(o.kind==='lost')pixels[28]=null;
 return pixels;
}

export function* finishCorpus(){
 let id=0;
 for(const [thigh,shin]of [[.42,.43],[.46,.45],[.50,.48]])for(const torso of [.43,.49,.56])for(const lean of [.14,.28,.48])for(const lift of [.10,.18,.30])for(const back of [.16,.32,.48])
 for(const pitch of [-.20,0,.20])for(const yaw of [-.40,0,.40])for(const depthGain of [0,.08,.15,.4,1])for(const noise of [0,.008,.016]){
  const options={torso,thigh,shin,lean,lift,back,pitch,yaw,depthGain,noise,seed:id,roll:(id%3-1)*.12,
   aspect:id%2?16/9:9/16,distance:id%2?3.5:5,occluded:id%3===0,confidence:id%4===0?.4:1,center:id%2?.40:.60};
  const points=finishFixture(options),reference=finishFixture({...options,kind:'entry',noise:0,occluded:false,confidence:1});
  if(points&&reference)yield {id:id++,kind:'finish',points,reference,options,expected:true};
 }
 for(const kind of ['standing','entry','grounded','upright','backward','forward','left','lost','curl'])
 for(const pitch of [-.20,0,.20])for(const yaw of [-.40,0,.40])for(const depthGain of [0,.08,.15,.4,1])for(const noise of [0,.008,.016])for(let seed=0;seed<12;seed++){
  const options={kind,pitch,yaw,depthGain,noise,seed,roll:(seed%3-1)*.08,torso:[.43,.49,.56][seed%3],occluded:seed%2===0};
  const points=finishFixture(options),reference=finishFixture({...options,kind:'entry',noise:0,occluded:false});
  if(points&&reference)yield {id:id++,kind,points,reference,options,expected:false};
 }
}
