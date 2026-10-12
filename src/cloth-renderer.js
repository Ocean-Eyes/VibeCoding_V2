import {lapelRibbon,lapelPoint} from './collar-interaction.js';

// Four separately authored drawings per front panel. Coordinates are drawing
// controls, not a mesh applied to an image. The two sides select independently.
// Each ridge is [start x/y, first control x/y, second control x/y, width].
export const CLOTH_DRAWINGS=[
 {name:'rest',at:0,bulge:0,ridges:[
  [.35,.66,.28,.56,.29,.41,.004], [.11,.95,.20,.81,.25,.47,.003], [.39,.43,.34,.37,.29,.31,.003]],
  gather:[.31,.37,.27,.43,.25,.50]},
 {name:'gather',at:.3,bulge:.008,ridges:[
  [.36,.65,.29,.50,.30,.37,.009], [.10,.99,.19,.74,.26,.42,.007], [.41,.45,.39,.37,.32,.31,.006]],
  gather:[.35,.38,.30,.44,.27,.53]},
 {name:'pull',at:.65,bulge:.019,ridges:[
  [.35,.69,.30,.48,.37,.35,.016], [.08,1.03,.19,.72,.34,.39,.013], [.43,.48,.44,.37,.40,.30,.011]],
  gather:[.42,.37,.34,.47,.31,.58]},
 {name:'taut',at:1,bulge:.03,ridges:[
  [.34,.73,.29,.50,.43,.32,.022], [.055,1.075,.20,.70,.41,.35,.019], [.44,.51,.47,.38,.46,.285,.015]],
  gather:[.47,.34,.39,.47,.34,.63]}
];
const clamp=v=>Math.max(0,Math.min(1,v));
const blend=(a,b,t)=>a+(b-a)*t;
function drawingAt(amount){
 let index=CLOTH_DRAWINGS.findIndex(p=>p.at>=amount);if(index<1)index=1;
 const a=CLOTH_DRAWINGS[index-1],b=CLOTH_DRAWINGS[index],t=clamp((amount-a.at)/(b.at-a.at));
 return {bulge:blend(a.bulge,b.bulge,t),ridges:a.ridges.map((r,i)=>r.map((v,j)=>blend(v,b.ridges[i][j],t))),gather:a.gather.map((v,i)=>blend(v,b.gather[i],t))};
}
function gradient(ctx,x0,y0,x1,y1,colors){
 const g=ctx.createLinearGradient(x0,y0,x1,y1);colors.forEach(([at,color])=>g.addColorStop(at,color));return g;
}
function paint(ctx,path,fill,stroke=null,width=.005){ctx.fillStyle=fill;ctx.fill(path);if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke(path)}}
export function frontPanel(side,deformation=[]){
 const grip=deformation.find(g=>g.side===side),amount=clamp(Math.max(Math.hypot(grip?.dx??0,grip?.dy??0)/.24,(grip?.engagement??0)*.55)),drawing=drawingAt(amount);
 const edge=lapelRibbon(side,deformation),pin=lapelPoint(side,grip?.t??(side>0?.29:.48),deformation);
 const path=new Path2D(),start=edge[0],end=edge.at(-1),bulge=drawing.bulge;
 path.moveTo(start.x,start.y);
 path.bezierCurveTo(side*(.28+amount*.07),.105,side*(.34+amount*.12),.12,side*(.40+amount*.10),.17);
 const rim=Math.max(.44+bulge,side*pin.x+.09),height=Math.max(.22,Math.min(.48,pin.y));
 path.quadraticCurveTo(side*rim,height-.075,side*rim,height);
 path.bezierCurveTo(side*rim,height+.16,side*.44,.62,side*.44,.70);
 path.lineTo(side*.48,1.10);path.quadraticCurveTo(side*.48,1.35,side*.53,1.55);
 if(side<0){path.quadraticCurveTo(-.28,1.63,.02,1.60);path.lineTo(.22,1.53);path.quadraticCurveTo(.20,1.03,end.x,end.y)}
 else{path.quadraticCurveTo(.18,1.63,-.16,1.56);path.lineTo(-.45,1.52);path.quadraticCurveTo(-.36,1.27,end.x,end.y)}
 // This is the actual inner edge of the front, sewn under the lapel: no gap.
 edge.toReversed().forEach(p=>path.lineTo(p.x,p.y));path.closePath();
 return {path,edge,pin,drawing,amount,side};
}
function weave(ctx,panel){
 const {side,amount}=panel,path=new Path2D();
 // Fresh constant-size sashiko stitches, clipped to this drawing's silhouette.
 // Drawn thread density never grows with the pull as it would in a bitmap warp.
 for(let row=0;row<62;row++)for(let col=0;col<40;col++){
  const y=.075+row*.025,x=-.50+col*.025+(row%2)*.0125;
  const turn=amount*Math.exp(-Math.pow((y-.45)/.30,2))*side*.40;
  path.moveTo(x,y);path.lineTo(x+Math.cos(.9+turn)*.011,y+Math.sin(.9+turn)*.011);
 }
 ctx.strokeStyle='#73808b12';ctx.lineWidth=.0025;ctx.stroke(path);
}
function drawFolds(ctx,panel){
 const {side:s,amount,pin,drawing}=panel;
 // Relaxed vertical drape disappears as three distinct tension ridges converge
 // on the grip. These shapes were authored for rest/gather/pull/taut above.
 ctx.save();ctx.globalAlpha=1-amount*.85;
 let path=new Path2D(`M ${s*.38} .25 Q ${s*.28} .39 ${s*.30} .65 Q ${s*.34} .46 ${s*.40} .36 Z`);
 paint(ctx,path,'#8995a42b');ctx.restore();
 ctx.save();ctx.globalAlpha=.18+.82*amount;
 drawing.ridges.forEach((r,i)=>{
  const [x,y,cx,cy,dx,dy,width]=r,tip={x:pin.x-s*(.025+i*.006),y:pin.y+.025+i*.011};
  const path=new Path2D();path.moveTo(s*x,y);path.bezierCurveTo(s*cx,cy,s*dx,dy,tip.x,tip.y);
  path.bezierCurveTo(s*(dx-width),dy+.027,s*(cx-width),cy+.05,s*x,y);path.closePath();
  paint(ctx,path,gradient(ctx,s*x,y,tip.x,tip.y,[[0,'#8793a000'],[.3,'#8c99a329'],[1,'#7c899b70']]));
  ctx.beginPath();ctx.moveTo(s*x,y);ctx.bezierCurveTo(s*(cx+width*.35),cy-.012,s*(dx+width*.35),dy-.008,tip.x,tip.y);
  ctx.strokeStyle='#ffffffb8';ctx.lineWidth=.006;ctx.stroke();
 });
 ctx.restore();
 // Short folds bunch immediately below the closed grip, instead of stretching
 // the same old vertical wrinkle over a longer distance.
 ctx.save();ctx.globalAlpha=amount;
 for(let i=0;i<3;i++){
  const [ax,ay,bx,by,cx,cy]=drawing.gather,p=new Path2D();
  p.moveTo(pin.x-s*.015,pin.y+.025+i*.024);p.quadraticCurveTo(s*(ax-i*.02),ay+i*.03,s*(bx-i*.025),by+i*.038);
  p.quadraticCurveTo(s*(cx-i*.02),cy+i*.013,pin.x-s*.015,pin.y+.025+i*.024);
  paint(ctx,p,i%2?'#ffffff8f':'#78879a25');
 }
 ctx.restore();
 // Waist gathers remain attached to the fixed belt.
 for(const y of [.87,1.02]){
  const p=new Path2D();p.moveTo(s*.40,y);p.quadraticCurveTo(s*.28,y+.12,s*.07,1.15);p.quadraticCurveTo(s*.25,y+.18,s*.40,y+.07);p.closePath();paint(ctx,p,'#8691a124');
 }
}
function drawLapel(ctx,panel){
 const {edge,side}=panel,path=new Path2D();
 const outline=[...edge.map(p=>({x:p.x+p.nx*p.width,y:p.y+p.ny*p.width})),...edge.toReversed().map(p=>({x:p.x-p.nx*p.width,y:p.y-p.ny*p.width}))];
 outline.forEach((p,i)=>i?path.lineTo(p.x,p.y):path.moveTo(p.x,p.y));path.closePath();
 paint(ctx,path,gradient(ctx,side*.38,.22,side*.08,.46,[[0,'#b6bec8'],[.3,'#f7f9fb'],[.7,'#e1e6eb'],[1,'#d5dde5']]),'#9aa5b1',.004);
 for(const offset of [-.030,-.015,0,.015,.030]){
  ctx.beginPath();edge.forEach((p,i)=>{const x=p.x+p.nx*offset,y=p.y+p.ny*offset;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
  ctx.lineWidth=.0027;ctx.strokeStyle='#8995a77d';ctx.stroke();
 }
}
export function drawIllustratedCoat(ctx,deformation=[]){
 for(const side of [-1,1]){
  const panel=frontPanel(side,deformation);
  paint(ctx,panel.path,gradient(ctx,side*.48,.45,-side*.06,.75,[[0,'#aeb8c4'],[.23,'#dce2e8'],[.64,'#f9fafb'],[1,'#e9edf1']]),'#a5afba',.005);
  ctx.save();ctx.clip(panel.path);weave(ctx,panel);drawFolds(ctx,panel);ctx.restore();
  drawLapel(ctx,panel);
 }
}
