import {drawOpponent} from './opponent.js';
// Full-length silhouette provides a stable reference for obi length.
export function drawBeltMannequin(ctx,anchor,{arms=true}={}){
 ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(anchor.scale*.90,anchor.scale*.76);
 const fabric=ctx.createLinearGradient(-.5,0,.5,0);fabric.addColorStop(0,'#aab2bb');fabric.addColorStop(.3,'#f0f2f3');fabric.addColorStop(.65,'#d7dde1');fabric.addColorStop(1,'#9fa8b2');
 for(const side of [-1,1]){
  ctx.save();ctx.scale(side,1);
  ctx.fillStyle='#c39d7c';ctx.beginPath();ctx.moveTo(.18,2.91);ctx.lineTo(.37,2.91);ctx.quadraticCurveTo(.39,3.05,.53,3.09);ctx.quadraticCurveTo(.60,3.18,.42,3.18);ctx.lineTo(.14,3.17);ctx.quadraticCurveTo(.10,3.09,.18,2.91);ctx.fill();
  ctx.fillStyle=fabric;ctx.strokeStyle='#8b959f';ctx.lineWidth=.008;
  ctx.beginPath();ctx.moveTo(.01,.24);ctx.lineTo(.43,.25);ctx.quadraticCurveTo(.50,.53,.46,1.22);ctx.lineTo(.42,2.94);ctx.quadraticCurveTo(.29,2.99,.13,2.94);ctx.lineTo(.10,1.2);ctx.quadraticCurveTo(.03,.97,0,.87);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#9ea8b15c';ctx.lineWidth=.012;ctx.beginPath();ctx.moveTo(.38,.59);ctx.lineTo(.32,1.31);ctx.moveTo(.15,1.78);ctx.lineTo(.37,1.65);ctx.moveTo(.15,1.88);ctx.lineTo(.36,1.85);ctx.moveTo(.16,2.84);ctx.lineTo(.42,2.84);ctx.stroke();
  ctx.restore();
 }
 ctx.restore();
 ctx.save();ctx.translate(anchor.x,0);ctx.scale(.9,1);ctx.translate(-anchor.x,0);
 drawOpponent(ctx,{origin:{x:anchor.x,y:anchor.y-anchor.scale*1.13},scale:anchor.scale,x:{x:1,y:0},y:{x:0,y:1}},null,{belt:false,arms});ctx.restore();
}
