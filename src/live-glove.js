const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
// Union of tapered segments with round ends. Tangents across a folded finger
// can reverse; building one outline from those tangents creates bow-ties/spikes.
function tube(path,points,radii){
 for(let i=0;i<points.length;i++){
  const p=points[i],r=radii[i];path.moveTo(p.x+r,p.y);path.arc(p.x,p.y,r,0,Math.PI*2);path.closePath();
  if(!i)continue;
  const a=points[i-1],length=distance(a,p);if(length<.001)continue;
  const nx=-(p.y-a.y)/length,ny=(p.x-a.x)/length,ra=radii[i-1];
  // Same winding as the circular caps, so overlapping folds stay solid.
  path.moveTo(a.x+nx*ra,a.y+ny*ra);path.lineTo(a.x-nx*ra,a.y-ny*ra);
  path.lineTo(p.x-nx*r,p.y-ny*r);path.lineTo(p.x+nx*r,p.y+ny*r);path.closePath();
 }
}
function palmHull(points){
 const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const half=items=>{const out=[];for(const p of items){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p)}return out};
 return [...half(sorted).slice(0,-1),...half(sorted.toReversed()).slice(0,-1)];
}
function roundedHull(path,points){
 const area=points.reduce((v,p,i)=>{const q=points[(i+1)%points.length];return v+p.x*q.y-p.y*q.x},0);
 if(area<0)points=[...points].reverse();
 const start=mix(points[0],points.at(-1),.18);path.moveTo(start.x,start.y);
 for(let i=0;i<points.length;i++){
  const p=points[i],before=mix(p,points[(i+points.length-1)%points.length],.18),after=mix(p,points[(i+1)%points.length],.18);
  path.lineTo(before.x,before.y);path.quadraticCurveTo(p.x,p.y,after.x,after.y);
 }path.closePath();
}
// A single softly shaded silhouette has no drawn joint spheres, nails or knuckle lines.
// All five finger curves come directly from the 21 live landmarks, including partial curls.
function paintGlove(ctx,hand,palm,elbow=null,thumbInside=false){
 if(!hand||hand.length!==21)return;
 const wrist=hand[0],size=Math.max(distance(wrist,hand[9]),distance(hand[5],hand[17])),r=size*.115;
 if(size<2)return;
 const path=new Path2D(),axis={x:hand[9].x-wrist.x,y:hand[9].y-wrist.y},len=Math.max(.001,Math.hypot(axis.x,axis.y));
 const nx=-axis.y/len,ny=axis.x/len;
 const cuff=[{x:wrist.x+nx*size*.22,y:wrist.y+ny*size*.22},{x:wrist.x-nx*size*.22,y:wrist.y-ny*size*.22}];
 // Order the wrist edges by proximity to the thumb side; this survives hand rotation.
 if(distance(cuff[0],hand[1])>distance(cuff[1],hand[1]))cuff.reverse();
 roundedHull(path,palmHull(thumbInside?[cuff[0],mix(hand[1],hand[5],.5),hand[5],hand[9],hand[13],hand[17],cuff[1]]:[cuff[0],hand[1],hand[2],hand[5],hand[9],hand[13],hand[17],cuff[1]]));
 // When the thumb folds across the index base, its pad covers the web space.
 // Join that contact area so a closed glove cannot acquire a triangular hole.
 if(!thumbInside&&distance(hand[3],hand[5])<size*.55)roundedHull(path,palmHull([hand[1],hand[2],hand[3],hand[5],hand[9]]));
 for(let digit=thumbInside?1:0;digit<5;digit++){
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
export function drawLiveGlove(ctx,hand,palm,elbow=null,thumbInside=false,opacity=.78){
 if(!hand)return;
 surface??=Object.assign(document.createElement('canvas'),{width:512,height:512});
 const all=elbow?[...hand,elbow]:hand,pad=Math.max(12,distance(hand[0],hand[9])*.5);
 const x=Math.min(...all.map(p=>p.x))-pad,y=Math.min(...all.map(p=>p.y))-pad;
 const w=Math.max(...all.map(p=>p.x))-x+pad,h=Math.max(...all.map(p=>p.y))-y+pad,s=Math.min(2,512/Math.max(w,h));
 const paint=surface.getContext('2d');paint.setTransform(1,0,0,1,0,0);paint.clearRect(0,0,512,512);
 paint.setTransform(s,0,0,s,-x*s,-y*s);paintGlove(paint,hand,palm,elbow,thumbInside);
 ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(surface,0,0,w*s,h*s,x,y,w,h);ctx.restore();
}
