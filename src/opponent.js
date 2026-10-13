import {drawIllustratedCoat} from './cloth-renderer.js';
import {lapelPoint} from './collar-interaction.js';
import {drawAnatomicalArm} from './hand-renderer.js';
import {GRIP_STEPS,gripPlacement,guideArm} from './demonstration.js';
// Game input only: RGB positions cannot measure pressure or grip effectiveness.
export function crossedGrip(points, target, frame) {
  if (!frame || !points || [15,16].some(i=>!points[i] || (points[i].visibility??1)<.65)) return false;
  const a=points[15],b=points[16];
  return (a.x-b.x)*frame.x.x+(a.y-b.y)*frame.x.y < -frame.scale*.05 &&
    [15,16].every(i=>Math.hypot(points[i].x-target[i].x,points[i].y-target[i].y)<frame.scale*.45);
}

// The view is from the practitioner toward their hands, with wrists at the bottom.
// In a closed dorsal grip the distal phalanges curl AWAY from the viewer: no nails.
const gripContours = new Map();
function gripContour(data) {
  if (!gripContours.has(data)) gripContours.set(data, new Path2D(data));
  return gripContours.get(data);
}
function giPaint(ctx,data,fill,stroke='#8e9397',width=.008){
  const path=gripContour(data);ctx.fillStyle=fill;ctx.fill(path);
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke(path)}
}
function giLine(ctx,data,color='#a0a5aa',width=.006){
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke(gripContour(data));
}
function clothGradient(ctx,x1,y1,x2,y2){
  const g=ctx.createLinearGradient(x1,y1,x2,y2);
  for(const [t,c]of [[0,'#959ca6'],[.16,'#d3d7dd'],[.45,'#fafbfc'],[.7,'#e5e8ed'],[1,'#aeb5bf']])g.addColorStop(t,c);
  return g;
}
function drawLapels(ctx,interaction=null){
  // Wearer's right lapel disappears beneath the left front. Only the upper edges form a V.
  // The upper left front continues diagonally to the belt, not into an exposed X.
  const under='M -.19 .04 C -.235 .075 -.27 .11 -.29 .16 C -.22 .33 -.13 .48 -.035 .555 L .055 .47 C -.055 .31 -.14 .14 -.19 .04 Z';
  const over='M .19 .04 C .24 .075 .275 .12 .29 .16 C .195 .37 .10 .54 -.01 .74 C -.10 .91 -.19 1.08 -.22 1.16 L -.34 1.14 C -.275 .935 -.16 .73 -.04 .51 C .067 .3 .15 .14 .19 .04 Z';
  ctx.save();ctx.translate(.009,.014);giPaint(ctx,under,'#6f747b30',null);giPaint(ctx,over,'#6f747b40',null);ctx.restore();
  giPaint(ctx,under,clothGradient(ctx,-.3,.2,-.12,.16));
  // Several parallel stitch rows communicate the dense, padded collar from the reference.
  for(let i=0;i<4;i++){
    const d=i*.012;
    giLine(ctx,`M ${-.209-d} .105 Q ${-.15-d} .3 ${.005-d} .49`,'#a0a5ad9c',.004);
  }
  giPaint(ctx,over,clothGradient(ctx,-.05,.3,.24,.45));
  for(let i=0;i<5;i++){
    const d=i*.012;
    giLine(ctx,`M ${.196+d} ${.081+d} C ${.125+d} .28 ${-.005+d} .52 ${-.1+d} .71 Q ${-.246+d} .98 ${-.292+d} 1.13`,'#9da5ae9e',.004);
  }
  giLine(ctx,'M .19 .055 Q .09 .32 -.042 .523 Q -.25 .92 -.325 1.135','#ffffffc9',.007);
}
export function drawCollarTargets(ctx,frame,state){
 ctx.save();ctx.translate(frame.origin.x,frame.origin.y);ctx.scale(frame.scale,frame.scale);
 for(const side of [-1,1]){
  const grabbed=state.grips?.some(g=>g?.side===side);if(grabbed)continue;
  const hovered=state.hover?.some(h=>h?.side===side),p=lapelPoint(side,side>0?.12:.20,state.deformation||[]);
  ctx.beginPath();ctx.ellipse(p.x,p.y,.07,.10,side*.5,0,Math.PI*2);
  ctx.strokeStyle=hovered?'#8ef0c8':'#efd49ca0';ctx.lineWidth=.009;ctx.setLineDash([.025,.018]);ctx.stroke();
 }
 ctx.restore();
}
// The gripped lapel stays connected to the V collar and bends over the inserted digits.
function drawGrippedLapels(ctx,contacts){
  for(const [side,amount]of contacts){
    if(amount<=0)continue;
    ctx.save();ctx.scale(side,1);ctx.globalAlpha*=amount;
    const band='M .19 .04 Q .255 .08 .29 .16 C .24 .245 .27 .32 .235 .38 Q .165 .475 .035 .55 L -.035 .51 Q .105 .365 .13 .28 Q .165 .10 .19 .04 Z';
    giPaint(ctx,band,clothGradient(ctx,.10,.28,.245,.35),'#9da5ae',.005);
    for(let j=0;j<4;j++){
      const d=j*.012;
      giLine(ctx,`M ${.195+d} .10 Q ${.165+d} .25 ${.165+d} .315 Q ${.19+d} .385 ${.015+d} .52`,'#a3aab39a',.003);
    }
    giLine(ctx,'M .19 .065 Q .153 .22 .13 .28 Q .105 .365 -.035 .51','#ffffffcb',.006);
    ctx.restore();
  }
}
function drawCollarFront(ctx,wrist,angle,left,palmUp,mirrored=false,amount=1){
  if(amount<=0)return;
  ctx.save();ctx.translate(wrist.x,wrist.y);ctx.rotate(angle);if(mirrored)ctx.scale(-1,1);
  // Cover the inserted digit with the continuous cloth edge, not a digit-shaped mask.
  const side=left?1:-1;
  ctx.beginPath();
  if(palmUp)ctx.ellipse(0,-.108*2.55,.041*2.55,.025*2.55,0,0,Math.PI*2);
  else ctx.ellipse(side*.045*2.55,-.066*2.55,.018*2.55,.031*2.55,0,0,Math.PI*2);
  ctx.clip();if(mirrored)ctx.scale(-1,1);ctx.rotate(-angle);ctx.translate(-wrist.x,-wrist.y);
  ctx.globalAlpha=amount;drawGrippedLapels(ctx,[[side*(mirrored?-1:1),1]]);ctx.restore();
}
function collarContact(p,index){
  const target=GRIP_STEPS[2][index],distance=Math.hypot(p.x-target.x,p.y-target.y);
  const t=Math.max(0,Math.min(1,1-distance/.085));return t*t*(3-2*t);
}
let weaveContour;
function drawJudogi(ctx,belt=true,interaction=null){
  const body='M -.2 .055 Q -.285 .11 -.40 .17 Q -.47 .38 -.44 .66 L -.48 1.1 Q -.48 1.35 -.53 1.55 Q -.27 1.64 .02 1.6 Q .32 1.65 .53 1.55 L .46 1.1 Q .42 .65 .44 .4 Q .44 .26 .39 .17 L .2 .055 L .14 .3 L 0 .55 L -.14 .3 Z';
  // Loose sleeves hang from sloping shoulders, with fabric volume at elbow and cuff.
  for(const side of [-1,1]){
    if(side===1&&interaction?.tapped)continue;
    ctx.save();ctx.scale(side,1);
    giPaint(ctx,'M .32 .15 Q .49 .15 .59 .27 Q .67 .35 .70 .51 C .72 .67 .82 .83 .84 .98 L .64 1.07 Q .57 .91 .56 .76 Q .52 .63 .47 .5 L .37 .4 Z',clothGradient(ctx,.38,.4,.79,.48));
    giPaint(ctx,'M .43 .31 Q .53 .5 .53 .67 Q .47 .53 .4 .48 Z','#858d9b3d',null);
    giPaint(ctx,'M .6 .56 Q .60 .70 .73 .79 Q .65 .75 .58 .68 Z','#858e9f33',null);
    giPaint(ctx,'M .66 .83 Q .76 .92 .79 .92 L .66 1.03 Q .72 .94 .66 .83 Z','#fdfdff85',null);
    giLine(ctx,'M .45 .205 Q .515 .24 .52 .35 M .49 .49 Q .56 .53 .60 .5 M .58 .76 Q .66 .8 .71 .785','#929aa58a',.007);
    giPaint(ctx,'M .635 1.045 Q .73 1.035 .835 .975 L .846 1.012 Q .73 1.08 .649 1.087 Z','#777b83','#969ca5',.006);
    giLine(ctx,'M .641 1.015 Q .73 1.001 .821 .949','#c4c9d1',.008);
    ctx.restore();
  }
  if(interaction)drawIllustratedCoat(ctx,interaction.deformation||[]);
  else{
  giPaint(ctx,body,clothGradient(ctx,-.49,.65,.5,.8));
  // The upper front is one continuous overlapping fabric panel, held closed at the waist.
  giPaint(ctx,'M .2 .055 L .39 .17 Q .47 .5 .43 .86 L .46 1.12 L .5 1.51 Q .19 1.58 -.16 1.52 L -.45 1.52 Q -.36 1.05 -.21 .82 Q .065 .34 .2 .055 Z',clothGradient(ctx,-.3,.7,.45,.9),'#bcc1c8',.005);
  giPaint(ctx,'M -.38 .3 Q -.26 .43 -.22 .72 Q -.31 .56 -.38 .49 Z','#848c9c26',null);
  giPaint(ctx,'M .38 .29 Q .30 .43 .31 .65 Q .38 .50 .4 .41 Z','#89929f24',null);
  // Soft gathers converge on the belt. Avoid hard polygonal creases across the chest.
  for(const [path,color]of [
    ['M -.40 .76 Q -.32 .96 -.12 1.14 Q -.28 1.04 -.4 .91 Z','#929aa72c'],
    ['M -.35 1.05 Q -.23 1.04 -.035 1.15 Q -.18 1.12 -.35 1.10 Z','#ffffffa0'],
    ['M .39 .82 Q .28 1.04 .1 1.13 Q .29 1.035 .40 .96 Z','#8992a12b'],
    ['M .40 1.04 Q .22 1.025 .04 1.16 Q .22 1.10 .4 1.09 Z','#ffffffa8'],
    ['M -.39 1.27 Q -.28 1.38 -.27 1.54 L -.34 1.55 Z','#8e96a22c'],
    ['M .29 1.27 Q .23 1.42 .34 1.54 Q .27 1.52 .22 1.37 Z','#8b94a126']
  ])giPaint(ctx,path,color,null);
  // Very fine sashiko-like weave, clipped to the coat, remains subtle at mobile sizes.
  if(!weaveContour){
    weaveContour=new Path2D();
    for(let row=0;row<61;row++)for(let col=0;col<43;col++){
      const x=-.53+col*.025+(row%2)*.0125,y=.06+row*.025;
      weaveContour.moveTo(x,y);weaveContour.lineTo(x+.007,y+.011);
    }
  }
  ctx.save();ctx.clip(gripContour(body));ctx.strokeStyle='#74808b12';ctx.lineWidth=.003;ctx.stroke(weaveContour);ctx.restore();
  giLine(ctx,'M -.43 .44 Q -.405 .85 -.45 1.09 M .43 .44 Q .405 .85 .44 1.09','#aab1ba8f',.005);
  giLine(ctx,'M -.48 1.52 Q -.23 1.60 .02 1.56 Q .27 1.61 .49 1.52','#969faa88',.005);
  drawLapels(ctx,interaction);
  }
  if(belt){
    giPaint(ctx,'M -.485 1.105 Q 0 1.15 .462 1.097 L .478 1.246 Q 0 1.31 -.49 1.25 Z','#222326','#111215',.01);
    giLine(ctx,'M -.463 1.137 Q 0 1.185 .443 1.13 M -.468 1.218 Q 0 1.27 .455 1.213','#515257',.006);
    giPaint(ctx,'M -.075 1.21 C -.17 1.26 -.26 1.42 -.32 1.63 L -.21 1.665 Q -.145 1.40 .055 1.26 Z','#242528','#121316',.008);
    giPaint(ctx,'M .02 1.2 Q .16 1.26 .29 1.405 L .235 1.50 Q .085 1.35 -.055 1.29 Z','#303135','#151619',.008);
    giLine(ctx,'M -.052 1.278 Q -.20 1.47 -.25 1.632 M .045 1.26 L .257 1.426','#55565b',.005);
    giPaint(ctx,'M -.085 1.153 L .045 1.16 L .115 1.243 L .015 1.325 L -.106 1.27 Z','#35363a','#151619',.009);
    giPaint(ctx,'M -.088 1.166 L -.007 1.173 L .07 1.275 L .012 1.307 Z','#242528',null);
    giLine(ctx,'M -.07 1.177 L -.02 1.181 L .056 1.275','#55565a',.005);
  }
}

// One shared V collar and crossed forearms, seen from the practitioner's side.
export function drawGripStudy(ctx,width,height,directions){
  ctx.clearRect(0,0,width,height);ctx.save();
  ctx.translate(width/2,-height*.025);ctx.scale(height*1.18,height*1.18);
  giPaint(ctx,'M -.2 -.05 L .2 -.05 L .18 .19 L 0 .55 L -.18 .19 Z','#dfb99a');
  drawJudogi(ctx,false);
  drawGrippedLapels(ctx,[[1,1],[-1,1]]);
  for(const [i,p]of GRIP_STEPS[2].entries()){
    const {angle,wrist}=gripPlacement(p,i);
    drawAnatomicalArm(ctx,wrist,angle,i===0,directions[i]==='↑',false,false,true);
    if(directions[i]==='↑')drawCollarFront(ctx,wrist,angle,i===0,true);

  }
  ctx.restore();
}

export function drawOpponent(ctx, frame,interaction=null) {
  const {origin,scale,x,y}=frame;
  ctx.save();ctx.transform(scale*x.x,scale*x.y,scale*y.x,scale*y.y,origin.x,origin.y);
  const shape=(points,fill,stroke='#9c998f',width=.014)=>{ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()};
  const ellipse=(a,b,rx,ry,fill)=>{ctx.beginPath();ctx.ellipse(a,b,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()};
  ctx.save();
  ellipse(-.74,1.055,.078,.12,'#c9a387');if(!interaction?.tapped)ellipse(.74,1.055,.078,.12,'#c9a387');
  shape([[-.18,.06],[.18,.06],[.48,.20],[.40,.66],[-.40,.66],[-.48,.20]],'#c9a387');
  drawJudogi(ctx,true,interaction);
  if(interaction?.tapped){
    const beat=Math.sin((interaction.time??0)/95)*.018;
    giPaint(ctx,'M .37 .17 Q .59 .15 .66 .32 Q .67 .45 .52 .58 L .25 .42 L .31 .28 Q .41 .35 .46 .37 L .37 .17 Z',clothGradient(ctx,.25,.25,.6,.5));
    ellipse(.235+beat,.34,.085,.11,'#c9a387');
  }
  ctx.save();
  ellipse(0,-.22,.235,.3,'#c9a387');
  shape([[-.225,-.24],[-.23,-.43],[-.12,-.54],[.12,-.54],[.23,-.41],[.225,-.24],[.15,-.4],[-.13,-.4]],'#343231','#343231');
  const eyeHeight=.014;
  ellipse(-.085,-.22,.019,eyeHeight,'#393635');ellipse(.085,-.22,.019,eyeHeight,'#393635');
  shape([[-.055,-.09],[.055,-.09],[0,-.075]],'#896952','#896952',.006);
  ctx.restore();
  ctx.restore();
  ctx.restore();
}

const guideLayers=new WeakMap();
// White translucent instructor hands belong to the demonstration, not to the partner.
export function drawGripGuides(ctx,frame,hands,directions,mirrored=true,targets=null,{actions=[],finish=0}={}){
  const sign=mirrored?-1:1;
  ctx.save();ctx.translate(frame.origin.x,frame.origin.y);ctx.scale(frame.scale,frame.scale);
  if(targets)for(const p of targets){
    ctx.beginPath();ctx.ellipse(sign*p.x,p.y,.075,.1,sign*p.x,0,Math.PI*2);
    ctx.fillStyle='#ffffff14';ctx.fill();ctx.strokeStyle='#e6f1f785';ctx.lineWidth=.012;ctx.setLineDash([.025,.025]);ctx.stroke();ctx.setLineDash([]);
  }
  drawGrippedLapels(ctx,hands.map((p,i)=>[(i?-1:1)*(mirrored?1:-1),collarContact(p,i)]));
  // Composite the pair once: the nearer limb hides the rear limb internally,
  // while the pair remains translucent over the opponent.
  let layer=guideLayers.get(ctx.canvas);
  if(!layer){layer=document.createElement('canvas');layer.id='guide-arms';guideLayers.set(ctx.canvas,layer)}
  if(layer.width!==ctx.canvas.width||layer.height!==ctx.canvas.height){layer.width=ctx.canvas.width;layer.height=ctx.canvas.height}
  const ink=layer.getContext('2d');ink.resetTransform();ink.clearRect(0,0,layer.width,layer.height);ink.setTransform(ctx.getTransform());
  for(const [i,p]of hands.entries()){
    const {angle,wrist,elbow,shoulder}=guideArm(p,i,finish,mirrored);
    const contact=collarContact(p,i);
    drawAnatomicalArm(ink,wrist,angle,i===0,directions[i]==='↑',true,!mirrored,contact>.8,elbow,shoulder);
    if(directions[i]==='↑')drawCollarFront(ink,wrist,angle,i===0,true,!mirrored,contact);
  }
  ctx.save();ctx.resetTransform();ctx.globalAlpha=.7;ctx.drawImage(layer,0,0);ctx.restore();
  ctx.restore();
}
export function drawTrackedHands(ctx,frame,hands,mirrored=true){
  const sign=mirrored?-1:1;
  ctx.save();
  for(const [i,p]of hands.entries())if(p){
    const x=frame.origin.x+sign*p.x*frame.scale,y=frame.origin.y+p.y*frame.scale;
    ctx.beginPath();ctx.arc(x,y,Math.max(4,frame.scale*.048),0,Math.PI*2);
    ctx.fillStyle='#80caff';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#e8f6ff';ctx.stroke();
    ctx.fillStyle='#b8e5ff';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText(i?'R':'L',x,y-11);
  }
  ctx.restore();
}
