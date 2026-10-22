// Fixed oblique side projection of the articulated 3D skeleton; no camera auto-fit.
export function drawDemo(canvas,pose){
 const ctx=canvas.getContext('2d'),width=960,height=540;
 if(canvas.width!==width){canvas.width=width;canvas.height=height;}
 const project=([x,y,z])=>[width*.53+(x+.35*z)*310,440+(-y+.18*z)*310];
 const bg=ctx.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#32444e');bg.addColorStop(1,'#172730');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
 const path=(points,fill,stroke)=>{ctx.beginPath();points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}};
 path([[-1.5,0,-.9],[1.25,0,-.9],[1.25,0,.9],[-1.5,0,.9]],'#536262','#6a7774');
 for(const x of [-1,-.5,0,.5,1]){ctx.beginPath();ctx.moveTo(...project([x,0,-.9]));ctx.lineTo(...project([x,0,.9]));ctx.strokeStyle='#73807a55';ctx.lineWidth=1;ctx.stroke();}
 ctx.save();ctx.translate(...project([-.12,.005,0]));ctx.scale(1,.12);ctx.beginPath();ctx.ellipse(0,0,245,80,0,0,Math.PI*2);ctx.fillStyle='#0c192b45';ctx.fill();ctx.restore();
 const segment=(a,b,r1,r2,light,dark)=>{
  const p=project(a),q=project(b),dx=q[0]-p[0],dy=q[1]-p[1],d=Math.hypot(dx,dy),nx=-dy/d,ny=dx/d;
  const g=ctx.createLinearGradient(p[0]-nx*r1,p[1]-ny*r1,p[0]+nx*r1,p[1]+ny*r1);g.addColorStop(0,dark);g.addColorStop(.55,light);g.addColorStop(1,dark);
  ctx.beginPath();ctx.moveTo(p[0]+nx*r1,p[1]+ny*r1);ctx.lineTo(q[0]+nx*r2,q[1]+ny*r2);ctx.quadraticCurveTo(q[0]+dx/d*r2,q[1]+dy/d*r2,q[0]-nx*r2,q[1]-ny*r2);ctx.lineTo(p[0]-nx*r1,p[1]-ny*r1);ctx.quadraticCurveTo(p[0]-dx/d*r1,p[1]-dy/d*r1,p[0]+nx*r1,p[1]+ny*r1);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#263d4a66';ctx.lineWidth=1;ctx.stroke();
 };
 const leg=(limb,far)=>{
  const bright=far?'#a3b4bd':'#edf1ef',shade=far?'#718795':'#a5b4bd';
  segment(limb.hip,limb.knee,28,19,bright,shade);segment(limb.knee,limb.ankle,19,12,bright,shade);
  segment(limb.ankle,limb.toe,11,8,far?'#ab9988':'#e0c4aa',far?'#877a6d':'#b99e85');
  const toe=project(limb.toe);ctx.fillStyle=far?'#a48d78':'#dac0a7';ctx.beginPath();ctx.ellipse(toe[0]-5,toe[1]-2,13,5,-.1,0,Math.PI*2);ctx.fill();
 };
 const arm=(limb,far)=>{
  segment(limb.shoulder,limb.elbow,22,17,far?'#aabac3':'#edf2f2',far?'#738b98':'#abbcc7');
  const cuff=limb.elbow.map((v,i)=>v*.22+limb.wrist[i]*.78);
  segment(limb.elbow,cuff,16,11,far?'#aabac3':'#eef3f3',far?'#738b98':'#acbcc7');
  segment(cuff,limb.wrist,9,8,far?'#ac9986':'#e5c9ac',far?'#8b796b':'#b99e85');
  segment(limb.wrist,limb.palm,8,9,far?'#bba38b':'#ebceb1',far?'#8b796b':'#b99e85');
  const palm=project(limb.palm);ctx.fillStyle=far?'#b29a82':'#e2c3a5';ctx.beginPath();ctx.ellipse(palm[0]-8,palm[1]-2,18,5,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=far?'#8b796b':'#ac8e75';ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(palm[0]-17,palm[1]-3+i*2);ctx.lineTo(palm[0]-6,palm[1]-3+i*2);ctx.stroke();}
 };
 const [far,near]=pose.limbs;leg(far,true);arm(far,true);leg(near,false);
 segment(pose.hip,pose.shoulder,30,38,'#f2f3ee','#a8b8c2');
 const torso=pose.shoulder.map((v,i)=>v-pose.hip[i]);
 const at=f=>pose.hip.map((v,i)=>v+torso[i]*f);
 const waist=project(at(.12)),chest=project(pose.shoulder),vx=chest[0]-waist[0],vy=chest[1]-waist[1],length=Math.hypot(vx,vy),ux=vx/length,uy=vy/length;
 ctx.beginPath();for(const [i,[along,across]] of [[-8,-31],[8,-31],[8,31],[-8,31]].entries()){const x=waist[0]+ux*along-uy*across,y=waist[1]+uy*along+ux*across;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fillStyle='#253138';ctx.fill();
 const collarA=project(at(.92)),collarB=project(at(.40));ctx.strokeStyle='#a4b3b9';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(collarA[0]-8,collarA[1]+6);ctx.lineTo(collarB[0],collarB[1]+9);ctx.stroke();ctx.strokeStyle='#fafbf6';ctx.lineWidth=4;ctx.stroke();
 segment(pose.shoulder,pose.neck,13,12,'#e3c5a7','#ba9d81');
 const head=project(pose.head),neck=project(pose.neck),rotation=Math.atan2(head[1]-neck[1],head[0]-neck[0])+Math.PI/2;
 ctx.save();ctx.translate(...head);ctx.rotate(rotation);ctx.fillStyle='#ddbea0';ctx.beginPath();ctx.ellipse(0,0,25,32,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#263039';ctx.beginPath();ctx.ellipse(3,-10,25,24,-.12,Math.PI,Math.PI*2+.3);ctx.lineTo(24,1);ctx.lineTo(15,9);ctx.lineTo(10,-5);ctx.closePath();ctx.fill();
 ctx.fillStyle='#d3ae8d';ctx.beginPath();ctx.moveTo(-22,-1);ctx.lineTo(-31,8);ctx.lineTo(-21,12);ctx.closePath();ctx.fill();ctx.fillStyle='#3d3933';ctx.beginPath();ctx.arc(-18,0,2,0,Math.PI*2);ctx.fill();ctx.restore();
 arm(near,false);
 canvas.dataset.progress=pose.progress.toFixed(4);canvas.dataset.elbow=near.elbowAngle.toFixed(1);canvas.dataset.phase=String(pose.phase);
}
