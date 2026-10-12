import {GRIP_STEPS,gripPlacement} from './demonstration.js';
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
export function drawGripHand(ctx,x,y,size,palmUp,left=false,ghost=false,collar=false){
  ctx.save();ctx.translate(x,y);ctx.scale(left===palmUp?-size:size,size);
  ctx.lineJoin='round';ctx.lineCap='round';
  const edge=ghost?'#87a2b0':'#88664f';
  const paint=(d,fill,stroke=edge,width=.012)=>{
    const p=gripContour(d);ctx.fillStyle=fill;ctx.fill(p);
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke(p)}
  };
  const line=(d,color=edge,width=.012)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke(gripContour(d))};
  const shade=(a,b)=>{const g=ctx.createLinearGradient(-.34,-.3,.3,.5);g.addColorStop(0,a);g.addColorStop(.55,ghost?'#f8fcff':'#ebc5a6');g.addColorStop(1,b);return g};
  const skin=shade(ghost?'#ffffff':'#d7ad8d',ghost?'#c1d4df':'#c09574');
  const thumb='M -.22 .33 C -.38 .28 -.45 .1 -.43 -.05 C -.42 -.15 -.35 -.22 -.24 -.25 L -.04 -.3 C .05 -.3 .08 -.22 .01 -.17 L -.19 -.05 C -.19 .03 -.1 .07 -.1 .17 C -.1 .26 -.15 .32 -.22 .33 Z';
  const lapel=()=>{
    // Reveal the real, continuous V-shaped collar through the local grip window.
    // The clip remains in device space when the callback restores the scene transform.
    if(typeof collar!=='function')return;
    ctx.save();ctx.clip(gripContour('M -.49 -.51 L .4 -.51 L .4 -.12 L -.49 -.12 Z'));
    collar(ctx);ctx.restore();
  };
  if(!palmUp){
    // Thumb is behind the lapel. The dorsal surface runs uninterrupted to MCP knuckles.
    if(collar){paint(thumb,skin);lapel()}
    paint('M -.19 .72 L -.2 .49 C -.22 .35 -.3 .23 -.32 .05 L -.34 -.24 C -.35 -.34 -.28 -.4 -.2 -.36 C -.18 -.45 -.06 -.46 -.01 -.39 C .04 -.45 .16 -.43 .18 -.35 C .25 -.39 .33 -.32 .33 -.23 L .31 .07 C .3 .24 .23 .38 .21 .5 L .21 .72 Z',skin);
    if(!ghost){
      // Tendons end at the knuckle ridge; the curled finger tips are occluded behind it.
      line('M -.12 .38 Q -.15 .12 -.23 -.24 M -.01 .39 Q -.01 .1 -.07 -.29 M .1 .39 Q .13 .1 .1 -.27','#b98c6b',.012);
      line('M -.27 -.23 Q -.22 -.27 -.18 -.23 M -.11 -.28 Q -.05 -.32 0 -.27 M .065 -.27 Q .13 -.3 .17 -.24 M .21 -.2 Q .25 -.23 .29 -.19','#a67a5b',.009);
    }
    if(!collar)paint('M -.3 .24 C -.41 .13 -.43 -.02 -.38 -.12 C -.34 -.18 -.3 -.16 -.28 -.11 L -.24 .08 C -.19 .16 -.23 .24 -.3 .24 Z',skin);
  }else{
    // Palmar view: flexed fingers fold down toward the palm, never onto the hand's back.
    paint('M -.2 .72 L -.2 .46 C -.25 .32 -.33 .22 -.34 .03 L -.33 -.26 Q -.31 -.4 -.2 -.38 Q -.1 -.49 .02 -.41 Q .15 -.46 .23 -.33 Q .34 -.31 .33 -.19 L .3 .14 C .26 .32 .21 .39 .2 .49 L .21 .72 Z',skin);
    paint('M -.23 .04 C -.1 -.09 .15 -.03 .23 .1 C .26 .23 .13 .38 .01 .41 C -.16 .35 -.27 .22 -.23 .04 Z',ghost?'#b7cedb':'#ddb08f',null);
    if(!ghost){
      for(const [x,y,w]of [[-.32,-.3,.16],[-.155,-.36,.17],[.02,-.34,.165],[.19,-.25,.13]]){
        paint(`M ${x} ${y+.1} Q ${x} ${y-.015} ${x+w/2} ${y} Q ${x+w} ${y} ${x+w} ${y+.1} L ${x+w-.01} ${y+.23} Q ${x+w/2} ${y+.3} ${x+.01} ${y+.23} Z`,skin);
      }
      line('M -.16 .19 Q -.02 .24 .15 .13 M -.17 .28 Q -.08 .33 -.02 .38','#af8061',.012);
    }
    // All four fingers pass behind the fold, while the thumb lies on its outer face.
    if(collar)lapel();
    paint(thumb,skin);
    if(!ghost)line('M -.29 .02 Q -.23 .1 -.2 .19','#bd8e6c',.01);
  }
  paint('M -.205 .59 Q 0 .62 .22 .59 L .23 .75 Q 0 .78 -.22 .75 Z',ghost?'#edf5f9':'#f1efe5',ghost?'#97b0bd':'#aaa494');
  ctx.restore();
}

function drawLapels(ctx){
  for(const [path,fill]of [
    ['M -.2 .05 L -.3 .16 L .17 1.19 L .29 1.16 Z','#c6d3d7'],
    ['M .2 .05 L .3 .16 L -.13 1.19 L -.27 1.16 Z','#dce5e7']
  ]){
    const p=gripContour(path);ctx.fillStyle=fill;ctx.fill(p);ctx.strokeStyle='#81949b';ctx.lineWidth=.012;ctx.stroke(p);
  }
}

// One shared V collar and crossed forearms, seen from the practitioner's side.
export function drawGripStudy(ctx,width,height,directions){
  ctx.clearRect(0,0,width,height);ctx.save();
  ctx.translate(width/2,-height*.025);ctx.scale(height*.85,height*.85);
  const paint=(d,fill,stroke='#b7b3a7')=>{const p=gripContour(d);ctx.fillStyle=fill;ctx.fill(p);ctx.strokeStyle=stroke;ctx.lineWidth=.012;ctx.stroke(p)};
  paint('M -.2 .05 L -.3 .16 L -.7 .29 L -.78 1.2 L .78 1.2 L .7 .29 L .3 .16 L .2 .05 L .13 .39 L 0 .5 L -.13 .39 Z','#e8e5db');
  paint('M -.2 -.05 L .2 -.05 L .18 .19 L 0 .49 L -.18 .19 Z','#dfb99a');
  drawLapels(ctx);
  const sceneTransform=ctx.getTransform();
  for(const [i,p]of GRIP_STEPS[2].entries()){
    const {x:px,angle,wrist}=gripPlacement(p,i),base=i?.62:-.62;
    ctx.beginPath();ctx.moveTo(base,1.13);ctx.lineTo(wrist.x,wrist.y);
    ctx.strokeStyle='#ad876b';ctx.lineWidth=.133;ctx.lineCap='round';ctx.stroke();
    ctx.strokeStyle='#e6bd9b';ctx.lineWidth=.115;ctx.stroke();
    ctx.save();ctx.translate(px,p.y);ctx.rotate(angle);
    drawGripHand(ctx,0,0,.3,directions[i]==='↑',i===0,false,c=>{c.setTransform(sceneTransform);drawLapels(c)});
    ctx.restore();
  }
  ctx.restore();
}

export function drawOpponent(ctx, frame) {
  const {origin,scale,x,y}=frame;
  ctx.save();ctx.transform(scale*x.x,scale*x.y,scale*y.x,scale*y.y,origin.x,origin.y);
  const shape=(points,fill,stroke='#9c998f',width=.014)=>{ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()};
  const ellipse=(a,b,rx,ry,fill)=>{ctx.beginPath();ctx.ellipse(a,b,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()};
  ctx.save();
  // Broad sleeves, layered lapels and a black belt make the partner readable without bones.
  shape([[-.34,.14],[-.69,.28],[-.86,.92],[-.57,1.02],[-.35,.57]],'#deded8');
  shape([[.34,.14],[.69,.28],[.86,.92],[.57,1.02],[.35,.57]],'#deded8');
  ellipse(-.71,1,.105,.13,'#c9a387');ellipse(.71,1,.105,.13,'#c9a387');
  shape([[-.42,.16],[-.19,.08],[.19,.08],[.42,.16],[.52,1.49],[-.52,1.49]],'#f4f1e8');
  shape([[-.18,.06],[.18,.06],[.13,.42],[0,.55],[-.13,.42]],'#c9a387');
  drawLapels(ctx);
  shape([[-.49,1.13],[.49,1.13],[.5,1.25],[-.5,1.25]],'#292a2c','#292a2c');
  shape([[-.055,1.19],[.1,1.2],[.2,1.65],[.08,1.68]],'#333438');
  shape([[.055,1.19],[-.1,1.2],[-.16,1.57],[-.05,1.59]],'#292a2c');
  ellipse(0,-.22,.235,.3,'#c9a387');
  shape([[-.225,-.24],[-.23,-.43],[-.12,-.54],[.12,-.54],[.23,-.41],[.225,-.24],[.15,-.4],[-.13,-.4]],'#343231','#343231');
  ellipse(-.085,-.22,.019,.014,'#393635');ellipse(.085,-.22,.019,.014,'#393635');
  shape([[-.055,-.09],[.055,-.09],[0,-.075]],'#896952','#896952',.006);
  ctx.restore();
  ctx.restore();
}

// White translucent instructor hands belong to the demonstration, not to the partner.
export function drawGripGuides(ctx,frame,hands,directions,mirrored=true,targets=null,{actions=[],finish=0}={}){
  const sign=mirrored?-1:1;
  ctx.save();ctx.translate(frame.origin.x,frame.origin.y);ctx.scale(frame.scale,frame.scale);
  if(targets)for(const p of targets){
    ctx.beginPath();ctx.ellipse(sign*p.x,p.y,.075,.1,sign*p.x,0,Math.PI*2);
    ctx.fillStyle='#ffffff14';ctx.fill();ctx.strokeStyle='#e6f1f785';ctx.lineWidth=.012;ctx.setLineDash([.025,.025]);ctx.stroke();ctx.setLineDash([]);
  }
  const sceneTransform=ctx.getTransform();
  for(const [i,p]of hands.entries()){
    const {x:px,angle,wrist}=gripPlacement(p,i,mirrored),press=actions[i]==='press',base=sign*(i?-1:1)*(.56+(press?.09:-.09)*finish);
    const gripped=Math.hypot(p.x-GRIP_STEPS[2][i].x,p.y-GRIP_STEPS[2][i].y)<.025;
    ctx.beginPath();ctx.moveTo(base,1.19+(press?-.13:.1)*finish);ctx.quadraticCurveTo(base*.6,.85,wrist.x,wrist.y);
    ctx.strokeStyle='#edf7ff4d';ctx.lineWidth=.105;ctx.lineCap='round';ctx.stroke();
    ctx.save();ctx.translate(px,p.y);
    ctx.rotate(angle);ctx.globalAlpha=.68;
    drawGripHand(ctx,0,0,.3,directions[i]==='↑',mirrored?i===0:i===1,true,gripped?(c=>{c.setTransform(sceneTransform);drawLapels(c)}):false);ctx.restore();
  }
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
