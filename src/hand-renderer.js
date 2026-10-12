const images=new Map();let loading;
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
export function drawAnatomicalArm(ctx,wrist,angle,left,palmUp,ghost=false,mirrored=false,gripped=false){
 const key=`${left?'left':'right'}-${palmUp?'palm':'back'}-${ghost?'glove':'skin'}${gripped&&!palmUp?'-grip':''}`,sprite=images.get(key);
 if(!sprite)return;
 ctx.save();ctx.translate(wrist.x,wrist.y);ctx.rotate(angle);if(mirrored)ctx.scale(-1,1);
 const scale=2.55;ctx.drawImage(sprite,-.12*scale,-.15*scale,.24*scale,.48*scale);ctx.restore();
}
