const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
function tube(path,points,radii){
 const sides=[[],[]];
 for(let i=0;i<points.length;i++){
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],length=Math.max(.001,distance(a,b));
  const nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
  for(let side=0;side<2;side++){const r=radii[i]*(side?-1:1);sides[side].push({x:points[i].x+nx*r,y:points[i].y+ny*r})}
 }
 roundedHull(path,[...sides[0],...sides[1].reverse()]);
}
function roundedHull(path,points){
 const area=points.reduce((v,p,i)=>{const q=points[(i+1)%points.length];return v+p.x*q.y-p.y*q.x},0);
 if(area<0)points=[...points].reverse();
 const start=mix(points.at(-1),points[0],.5);path.moveTo(start.x,start.y);
 for(let i=0;i<points.length;i++){const q=mix(points[i],points[(i+1)%points.length],.5);path.quadraticCurveTo(points[i].x,points[i].y,q.x,q.y)}path.closePath();
}
// A single softly shaded silhouette has no drawn joint spheres, nails or knuckle lines.
// All five finger curves come directly from the 21 live landmarks, including partial curls.
function paintGlove(ctx,hand,palm,elbow=null){
 if(!hand||hand.length!==21)return;
 const wrist=hand[0],size=Math.max(distance(wrist,hand[9]),distance(hand[5],hand[17])),r=size*.115;
 if(size<2)return;
 const path=new Path2D(),axis={x:hand[9].x-wrist.x,y:hand[9].y-wrist.y},len=Math.max(.001,Math.hypot(axis.x,axis.y));
 const nx=-axis.y/len,ny=axis.x/len;
 const cuff=[{x:wrist.x+nx*size*.22,y:wrist.y+ny*size*.22},{x:wrist.x-nx*size*.22,y:wrist.y-ny*size*.22}];
 // Order the wrist edges by proximity to the thumb side; this survives hand rotation.
 if(distance(cuff[0],hand[1])>distance(cuff[1],hand[1]))cuff.reverse();
 roundedHull(path,[cuff[0],hand[1],hand[2],hand[5],hand[9],hand[13],hand[17],cuff[1]]);
 for(let digit=0;digit<5;digit++){
   const start=1+digit*4,ids=[start,start+1,start+2,start+3],radius=r*(digit===0?1.16:digit===4?.83:1);
   tube(path,ids.map(i=>hand[i]),[radius*1.08,radius,radius*.87,radius*.78]);
 }
 // A short, tapering cuff meets the tracked forearm instead of ending in a stick.
 const end=elbow?mix(wrist,elbow,.8):{x:wrist.x-axis.x*.7,y:wrist.y-axis.y*.7};
 const arm=new Path2D();tube(arm,[end,wrist,mix(wrist,hand[9],.25)],[size*.34,size*.23,size*.27]);
 ctx.save();
 const g=ctx.createLinearGradient(wrist.x-nx*size*.65,wrist.y-ny*size*.65,wrist.x+nx*size*.65,wrist.y+ny*size*.65);
 g.addColorStop(0,'#a9bac5');g.addColorStop(.32,palm?'#e1e8ea':'#eef5fa');g.addColorStop(.62,'#ffffff');g.addColorStop(1,'#aebfc9');
 const fade=ctx.createLinearGradient(end.x,end.y,wrist.x,wrist.y);
 fade.addColorStop(0,'#c7d7e000');fade.addColorStop(.45,'#dce8efcc');fade.addColorStop(1,'#e6eff5');
 ctx.fillStyle=fade;ctx.fill(arm);
 ctx.fillStyle=g;ctx.shadowColor='#344d6250';ctx.shadowBlur=Math.max(1,size*.06);ctx.fill(path);ctx.shadowBlur=0;
 ctx.clip(path);
 if(palm){
   const center=mix(hand[1],hand[9],.4),pad=ctx.createRadialGradient(center.x,center.y,0,center.x,center.y,size*.5);
   pad.addColorStop(0,'#a3b4c140');pad.addColorStop(1,'#bccbd000');ctx.fillStyle=pad;ctx.fillRect(center.x-size,center.y-size,size*2,size*2);
   // One broad palm fold, not per-joint markings.
   const a=mix(hand[5],wrist,.35),b=mix(hand[17],wrist,.35),c=mix(hand[9],wrist,.64);
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(c.x,c.y,b.x,b.y);ctx.strokeStyle='#8097a43a';ctx.lineWidth=Math.max(.7,size*.025);ctx.stroke();
 }
 ctx.restore();
}

let surface;
// Composite the complete glove once so overlapping fingers never become brighter blobs.
export function drawLiveGlove(ctx,hand,palm,elbow=null){
 if(!hand)return;
 surface??=Object.assign(document.createElement('canvas'),{width:512,height:512});
 const all=elbow?[...hand,elbow]:hand,pad=Math.max(12,distance(hand[0],hand[9])*.5);
 const x=Math.min(...all.map(p=>p.x))-pad,y=Math.min(...all.map(p=>p.y))-pad;
 const w=Math.max(...all.map(p=>p.x))-x+pad,h=Math.max(...all.map(p=>p.y))-y+pad,s=Math.min(2,512/Math.max(w,h));
 const paint=surface.getContext('2d');paint.setTransform(1,0,0,1,0,0);paint.clearRect(0,0,512,512);
 paint.setTransform(s,0,0,s,-x*s,-y*s);paintGlove(paint,hand,palm,elbow);
 ctx.save();ctx.globalAlpha=.78;ctx.drawImage(surface,0,0,w*s,h*s,x,y,w,h);ctx.restore();
}
