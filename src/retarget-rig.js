// Character-authored geometry. Source controls drive angles and contacts, never contours.
export const RIG={waist:[0,.04],waistWidth:.86,beltWidth:.09,shoulderY:-.96,shoulderX:.36,upperArm:.65,forearm:.60,palmWidth:.13,palmLength:.14,fingerLengths:[[.048,.034,.026],[.052,.032,.024],[.057,.035,.026],[.052,.032,.024],[.041,.027,.020]],tailMaxY:1.02};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t;
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,n)=>a.map(x=>x*n),length=a=>Math.hypot(...a),unit=a=>mul(a,1/(length(a)||1));
function transform(p,origin,angle){return [origin[0]+p[0]*Math.cos(angle)-p[1]*Math.sin(angle),origin[1]+p[0]*Math.sin(angle)+p[1]*Math.cos(angle)];}
export function solveArm(wrist,identity){
 const side=identity==='Left'?1:-1,shoulder=[side*RIG.shoulderX,RIG.shoulderY],delta=sub(wrist,shoulder),rawDistance=length(delta),distance=clamp(rawDistance,.08,RIG.upperArm+RIG.forearm-.002),direction=unit(delta),target=add(shoulder,mul(direction,distance));
 const along=(RIG.upperArm**2-RIG.forearm**2+distance**2)/(2*distance),off=Math.sqrt(Math.max(0,RIG.upperArm**2-along**2)),base=add(shoulder,mul(direction,along)),normal=[-direction[1],direction[0]],candidates=[add(base,mul(normal,off)),add(base,mul(normal,-off))],elbow=candidates.sort((a,b)=>side*(b[0]-a[0]))[0];
 return {shoulder,elbow,wrist:target,reachCorrection:length(sub(target,wrist)),identity};
}
export function handRig(control,identity){
 const state=control?.resolved??control;if(!state?.gripCenter||state.orientationRad==null)return null;
 const grip=[RIG.waist[0]+state.gripCenter[0]*RIG.waistWidth,RIG.waist[1]+state.gripCenter[1]*RIG.waistWidth],angle=state.orientationRad+Math.PI/2,desiredWrist=transform([0,.125],grip,angle),arm=solveArm(desiredWrist,identity),origin=arm.wrist,side=identity==='Left'?1:-1,curl=state.curl??[.5,.5,.5,.5,.5];
 const palm=[[-.045,0],[-.065,-.087],[-.052,-.14],[.052,-.14],[.065,-.087],[.045,0]],digits=[];
 for(let d=1;d<=4;d++){
  const x=(-.048+(d-1)*.032)*side,c=clamp(curl[d]??.5,0,1),bones=RIG.fingerLengths[d],points=[[x,-.128,0]];let a=.12+c*.74;
  for(let j=0;j<3;j++){if(j)a+=c*(j===1?1.15:.85);const p=points.at(-1);points.push([p[0]+side*(d-2.5)*.0015,p[1]-bones[j]*Math.cos(a),p[2]+bones[j]*Math.sin(a)]);}
  digits.push(points);
 }
 const c=clamp(curl[0]??.5,0,1),thumb=[[-side*.048,-.040]];let thumbAngle=mix(.9,.30,c);for(let j=0;j<3;j++){if(j)thumbAngle-=mix(.20,j===1?1.2:.40,c);const p=thumb.at(-1),bone=RIG.fingerLengths[0][j];thumb.push([p[0]-side*bone*Math.sin(thumbAngle),p[1]-bone*Math.cos(thumbAngle)]);}
 return {identity,origin,angle,arm,palm:palm.map(p=>transform(p,origin,angle)),digits:digits.map(ps=>ps.map(p=>transform(p,origin,angle))),thumb:thumb.map(p=>transform(p,origin,angle)),grip:transform([0,-.125],origin,angle),inputGrip:grip,curl,status:control?.status??'unknown'};
}
function path(ctx,points,close=false){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));if(close)ctx.closePath();}
function smoothPolygon(ctx,points){ctx.beginPath();let first=points[0],last=points.at(-1);ctx.moveTo(...mul(add(first,last),.5));for(let i=0;i<points.length;i++){const p=points[i],next=points[(i+1)%points.length];ctx.quadraticCurveTo(...p,...mul(add(p,next),.5));}ctx.closePath();}
export function drawSleeve(ctx,rig,{foregroundOnly=false}={}){
 ctx.save();
 const {shoulder:s,elbow:e,wrist:w}=rig.arm,upper=unit(sub(e,s)),lower=unit(sub(w,e)),n1=[-upper[1],upper[0]],n2=[-lower[1],lower[0]],cuff=add(w,mul(lower,.012));

 const clothRoot=add(s,mul(upper,-.115)),jointNormal=unit(add(n1,n2)),jointWidth=.12;const outline=foregroundOnly?[add(add(e,mul(lower,-.05)),mul(n2,.11)),add(cuff,mul(n2,.080)),add(cuff,mul(n2,-.080)),add(add(e,mul(lower,-.05)),mul(n2,-.11))]:[add(clothRoot,mul(n1,.135)),add(e,mul(jointNormal,jointWidth)),add(cuff,mul(n2,.080)),add(cuff,mul(n2,-.080)),add(e,mul(jointNormal,-jointWidth)),add(clothRoot,mul(n1,-.135))];
 const shade=ctx.createLinearGradient(e[0]-.18,e[1],e[0]+.18,e[1]);shade.addColorStop(0,'#a4aeba');shade.addColorStop(.43,'#f2f4f6');shade.addColorStop(1,'#b9c1cb');smoothPolygon(ctx,outline);ctx.fillStyle=shade;ctx.fill();ctx.strokeStyle='#88939e';ctx.lineWidth=.006;if(!foregroundOnly)ctx.stroke();
 ctx.save();smoothPolygon(ctx,outline);ctx.clip();path(ctx,[add(cuff,mul(n2,.075)),add(cuff,mul(n2,-.075))]);ctx.strokeStyle='#8e98a4';ctx.lineWidth=.006;ctx.stroke();ctx.restore();
 if(foregroundOnly){ctx.beginPath();ctx.moveTo(...add(e,mul(n2,-.065)));ctx.quadraticCurveTo(...add(e,mul(lower,.025)),...add(e,mul(n2,.055)));ctx.strokeStyle='#a3acb748';ctx.lineWidth=.005;ctx.stroke();}ctx.restore();
}
function addTube(out,points,radius){
 for(let i=0;i<points.length;i++){const p=points[i];out.moveTo(p[0]+radius,p[1]);out.arc(p[0],p[1],radius,0,Math.PI*2);out.closePath();if(!i)continue;const a=points[i-1],d=unit(sub(p,a)),n=[-d[1]*radius,d[0]*radius];out.moveTo(a[0]+n[0],a[1]+n[1]);out.lineTo(a[0]-n[0],a[1]-n[1]);out.lineTo(p[0]-n[0],p[1]-n[1]);out.lineTo(p[0]+n[0],p[1]+n[1]);out.closePath();}
}
export function drawHand(ctx,rig,{part='all'}={}){
 ctx.save();const shade=ctx.createLinearGradient(rig.origin[0]-.08,rig.origin[1],rig.origin[0]+.08,rig.origin[1]);shade.addColorStop(0,'#b9c8cf');shade.addColorStop(.45,'#f8fcff');shade.addColorStop(1,'#d6e1e7');
 const outline=new Path2D();if(part!=='palm'){for(const digit of rig.digits)addTube(outline,digit,.013);addTube(outline,rig.thumb,.016);}
 if(part!=='digits'){const lower=unit(sub(rig.arm.wrist,rig.arm.elbow));addTube(outline,[add(rig.origin,mul(lower,-.075)),rig.origin],.044);let palm=[...rig.palm];let area=palm.reduce((a,p,i)=>{const q=palm[(i+1)%palm.length];return a+p[0]*q[1]-p[1]*q[0]},0);if(area<0)palm.reverse();outline.moveTo(...mul(add(palm[0],palm.at(-1)),.5));for(let i=0;i<palm.length;i++){outline.quadraticCurveTo(...palm[i],...mul(add(palm[i],palm[(i+1)%palm.length]),.5));}outline.closePath();}ctx.fillStyle=shade;ctx.fill(outline);ctx.restore();
}
// Flat, constant-width ribbon strips. No source silhouettes or pixel texture.
export function drawStrip(ctx,points,{width=RIG.beltWidth,fill='#24272a',edge='#0e1012',stitches=true,caps=true}={}){
 if(points.length<2)return;const left=[],right=[];
 for(let i=0;i<points.length;i++){const tangent=unit(sub(points[Math.min(i+1,points.length-1)],points[Math.max(0,i-1)])),n=[-tangent[1],tangent[0]];left.push(add(points[i],mul(n,width/2)));right.push(add(points[i],mul(n,-width/2)));}
 path(ctx,[...left,...right.toReversed()],true);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=edge;ctx.lineWidth=.006;ctx.lineJoin='round';if(caps)ctx.stroke();else{path(ctx,left);ctx.stroke();path(ctx,right);ctx.stroke();}
 if(stitches){ctx.strokeStyle='#62676d';ctx.lineWidth=.002;for(const side of[-.32,.32]){const line=left.map((p,i)=>add(mul(p,.5+side),mul(right[i],.5-side)));path(ctx,line);ctx.stroke();}}
}
export function waistPaths(){return [0,1].map(layer=>Array.from({length:37},(_,i)=>{const x=-.43+i*.86/36;return [x,.035+layer*.025+.022*(1-(x/.43)**2)];}));}
export function drawWaist(ctx){for(const [i,p]of waistPaths().entries())drawStrip(ctx,p,{fill:i?'#282b2f':'#181b1e'});}
const phase=(t,a,b)=>clamp((t-a)/(b-a),0,1),bell=(t,a,b,c,d)=>Math.min(phase(t,a,b),1-phase(t,c,d));
export function rigFrame(frame){
 const t=frame.originalPTS,hands=['Left','Right'].map(id=>{const control=frame.hands?.[id];if(!control?.resolved)return null;const state={...control.resolved},raw=state.gripCenter,originalWorld=[raw[0]*.86,raw[1]*.86+.04];let target=originalWorld;
 // Explicit illustrative donor/receiver constraints, not measured monocular depth.
 // The donor holds the lower mouth while the receiver waits at the upper exit.
 if(id==='Right'){const w=bell(t,10.2,10.7,11.1,11.5);target=target.map((v,j)=>mix(v,[0,.115][j],w));}
 if(id==='Left'){const w=bell(t,10.7,10.9,10.95,11.5);target=target.map((v,j)=>mix(v,[.13,-.04][j],w));}
 state.gripCenter=[target[0]/.86,(target[1]-.04)/.86];
 const receivingOpen=id==='Left'&&t>=10.75&&t<10.9,held=t>=2&&t<=19.8&&!frame.constraints?.handsBehindBody&&!receivingOpen,pointing=id==='Left'&&t>=13.5&&t<14.5,curl=[...(state.curl??[.5,.5,.5,.5,.5])];if(held){curl[0]=Math.max(curl[0],.88);for(let d=1;d<5;d++)if(!(pointing&&d===1))curl[d]=Math.max(curl[d],d===1?.90:.86);}if(receivingOpen)for(let d=0;d<5;d++)curl[d]=Math.min(curl[d],.45);const h=handRig({...control,resolved:{...state,curl}},id);if(h){h.contactPose=held?'inferred belt grip constraint, raw curls retained separately':'source curl / receiving hand';h.contactRetargetDelta=length(sub(target,originalWorld));}return h;}).filter(Boolean);return {originalPTS:t,hands};
}
