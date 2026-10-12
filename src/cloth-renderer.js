import {clothPoint} from './collar-interaction.js';

// Warp the complete coat as one sewn surface: color, weave, folds and collar
// share the same vertices. No independent ribbon is painted over a fixed shirt.
const bounds={x:-1.18,y:0,width:2.36,height:1.72},size=640,rows=28,columns=34;
const textures=new Map();
let cached=null;
function canvas(){const c=document.createElement('canvas');c.width=size;c.height=Math.round(size*bounds.height/bounds.width);return c}
function triangle(ctx,texture,source,dest){
 const [a,b,c]=source,[p,q,r]=dest;
 const det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
 const u=(q.x-p.x),v=(r.x-p.x),w=(q.y-p.y),z=(r.y-p.y);
 const A=(u*(c.y-a.y)-v*(b.y-a.y))/det,C=(v*(b.x-a.x)-u*(c.x-a.x))/det;
 const B=(w*(c.y-a.y)-z*(b.y-a.y))/det,D=(z*(b.x-a.x)-w*(c.x-a.x))/det;
 const center={x:(p.x+q.x+r.x)/3,y:(p.y+q.y+r.y)/3};
 ctx.save();ctx.beginPath();
 // Subpixel overlap avoids antialiased cracks along triangle seams.
 dest.forEach((p,i)=>{const dx=p.x-center.x,dy=p.y-center.y,d=Math.hypot(dx,dy),x=p.x+dx/d*.45,y=p.y+dy/d*.45;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
 ctx.closePath();ctx.clip();ctx.setTransform(A,B,C,D,p.x-A*a.x-C*a.y,p.y-B*a.x-D*a.y);ctx.drawImage(texture,0,0);ctx.restore();
}
export function drawDeformedCoat(ctx,deformation,tapped,drawRest){
 const variant=!!tapped;
 if(!textures.has(variant)){
  const texture=canvas(),paint=texture.getContext('2d'),scale=size/bounds.width;
  paint.setTransform(scale,0,0,scale,-bounds.x*scale,0);drawRest(paint);textures.set(variant,texture);
 }
 const texture=textures.get(variant),moving=deformation.some(g=>Math.abs(g.dx)+Math.abs(g.dy)>.0005);
 const key=JSON.stringify([variant,...deformation.map(g=>[g.side,g.t,Math.round(g.dx*500),Math.round(g.dy*500)])]);
 let output=texture;
 if(moving){
  if(cached?.key!==key){
   const warped=cached?.canvas||canvas(),paint=warped.getContext('2d');paint.clearRect(0,0,warped.width,warped.height);
   const grid=Array.from({length:rows+1},(_,row)=>Array.from({length:columns+1},(_,col)=>{
    const source={x:col/columns*texture.width,y:row/rows*texture.height};
    const world={x:bounds.x+source.x/size*bounds.width,y:source.y/size*bounds.width},p=clothPoint(world,deformation);
    return {source,dest:{x:(p.x-bounds.x)/bounds.width*size,y:p.y/bounds.width*size}};
   }));
   for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const a=grid[row][col],b=grid[row][col+1],c=grid[row+1][col],d=grid[row+1][col+1];
    for(const points of [[a,b,c],[b,d,c]])triangle(paint,texture,points.map(p=>p.source),points.map(p=>p.dest));
   }
   cached={key,canvas:warped};
  }
  output=cached.canvas;
 }
 ctx.drawImage(output,bounds.x,bounds.y,bounds.width,texture.height/size*bounds.width);
}
