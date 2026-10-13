const images=new Map(),armLayers=new WeakMap();let loading;
export function prepareHands(){
 return loading??=Promise.all(['left','right'].flatMap(side=>['palm','back'].flatMap(face=>(face==='back'?['skin','glove','skin-grip','glove-grip']:['skin','glove']).map(material=>{
  const key=`${side}-${face}-${material}`;
  return new Promise((resolve,reject)=>{
   const image=new Image();image.onload=()=>{images.set(key,image);resolve()};
   image.onerror=()=>reject(new Error(`Unable to load anatomical hand: ${key}`));
   image.src=new URL(`../assets/hands-aah-v1/${key}.png${new URL(import.meta.url).search}`,import.meta.url).href;
  });
 }))));
}
// Anatomical identity comes from the limb index, never its current screen coordinate.
// A mirror is applied to the complete arm AFTER choosing its anatomical identity.
export function drawAnatomicalArm(ctx,wrist,angle,left,palmUp,ghost=false,mirrored=false,gripped=false,elbow=null,shoulder=null){
 const key=`${left?'left':'right'}-${palmUp?'palm':'back'}-${ghost?'glove':'skin'}${gripped&&!palmUp?'-grip':''}`,sprite=images.get(key);
 if(!sprite)return;
 if(ghost&&elbow){
  shoulder??={x:elbow.x,y:elbow.y+.5};
  const points=[shoulder,elbow,wrist],radii=[.13,.095,.048];
  const sides=[1,-1].map(sign=>points.map((p,i)=>{
   const a=points[Math.max(0,i-1)],b=points[Math.min(2,i+1)],length=Math.max(.001,Math.hypot(b.x-a.x,b.y-a.y));
   return {x:p.x-sign*(b.y-a.y)/length*radii[i],y:p.y+sign*(b.x-a.x)/length*radii[i]};
  }));
  const path=new Path2D(),mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const [outer,inner]=sides;path.moveTo(outer[0].x,outer[0].y);
  const a=mid(outer[0],outer[1]),b=mid(outer[1],outer[2]);path.lineTo(a.x,a.y);path.quadraticCurveTo(outer[1].x,outer[1].y,b.x,b.y);path.lineTo(outer[2].x,outer[2].y);
  path.lineTo(inner[2].x,inner[2].y);const c=mid(inner[2],inner[1]),d=mid(inner[1],inner[0]);path.lineTo(c.x,c.y);path.quadraticCurveTo(inner[1].x,inner[1].y,d.x,d.y);path.lineTo(inner[0].x,inner[0].y);path.closePath();
  let layer=armLayers.get(ctx.canvas);
  if(!layer){layer=document.createElement('canvas');armLayers.set(ctx.canvas,layer)}
  if(layer.width!==ctx.canvas.width||layer.height!==ctx.canvas.height){layer.width=ctx.canvas.width;layer.height=ctx.canvas.height}
  const ink=layer.getContext('2d');ink.resetTransform();ink.clearRect(0,0,layer.width,layer.height);ink.setTransform(ctx.getTransform());
  const nx=Math.cos(angle),ny=Math.sin(angle),g=ink.createLinearGradient(wrist.x-nx*.10,wrist.y-ny*.10,wrist.x+nx*.10,wrist.y+ny*.10);
  for(const [t,color]of [[0,'#a9bac5'],[.32,'#eef5fa'],[.62,'#ffffff'],[1,'#aebfc9']])g.addColorStop(t,color);
  ink.fillStyle=g;ink.fill(path);
  const fade=ink.createLinearGradient(shoulder.x,shoulder.y,elbow.x,elbow.y);
  fade.addColorStop(0,'#ffffff00');fade.addColorStop(.85,'#ffffffff');
  ink.globalCompositeOperation='destination-in';ink.fillStyle=fade;ink.fill(path);ink.globalCompositeOperation='source-over';
  ctx.save();ctx.resetTransform();ctx.drawImage(layer,0,0);ctx.restore();

 }
 ctx.save();ctx.translate(wrist.x,wrist.y);ctx.rotate(angle);if(mirrored)ctx.scale(-1,1);
 const scale=2.55;
 if(ghost&&elbow)ctx.drawImage(sprite,0,0,320,240,-.12*scale,-.15*scale,.24*scale,.18*scale);
 else ctx.drawImage(sprite,-.12*scale,-.15*scale,.24*scale,.48*scale);
 ctx.restore();
}
