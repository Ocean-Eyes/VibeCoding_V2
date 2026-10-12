// Game input only: RGB positions cannot measure pressure or grip effectiveness.
export function crossedGrip(points, target, frame) {
  if (!frame || !points || [15,16].some(i=>!points[i] || (points[i].visibility??1)<.65)) return false;
  const a=points[15],b=points[16];
  return (a.x-b.x)*frame.x.x+(a.y-b.y)*frame.x.y < -frame.scale*.05 &&
    [15,16].every(i=>Math.hypot(points[i].x-target[i].x,points[i].y-target[i].y)<frame.scale*.45);
}

// Anatomical grip illustration. Flipping the palm also reverses the visible thumb side.
// Cache vector contours so the same artwork stays cheap in the live overlay.
const gripContours = new Map();
function gripContour(data) {
  if (!gripContours.has(data)) gripContours.set(data, new Path2D(data));
  return gripContours.get(data);
}
export function drawGripHand(ctx, x, y, size, palmUp, left=false, ghost=false) {
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(left === palmUp ? -size : size,size);
  ctx.lineJoin='round';ctx.lineCap='round';
  const gradient=(x1,y1,x2,y2,stops)=>{
    const g=ctx.createLinearGradient(x1,y1,x2,y2);
    stops.forEach(([offset,color])=>g.addColorStop(offset,ghost?(offset<.5?'#ffffff':'#cadde7'):color));return g;
  };
  const paint=(data,fill,stroke='#795641',width=.012)=>{
    const p=gripContour(data);ctx.fillStyle=ghost&&typeof fill==='string'?'#edf5f9':fill;ctx.fill(p);
    if(stroke){ctx.strokeStyle=ghost?'#a2b8c4':stroke;ctx.lineWidth=width;ctx.stroke(p)}
  };
  const line=(data,color='#986c53',width=.012)=>{
    ctx.strokeStyle=ghost?'#9eb4bf':color;ctx.lineWidth=width;ctx.stroke(gripContour(data));
  };
  const skin=gradient(-.4,0,.4,.15,[[0,'#bd8865'],[.22,'#e3b390'],[.52,'#f2c9a6'],[.8,'#dcaa84'],[1,'#ab7454']]);
  const palm=gradient(-.36,-.22,.33,.48,[[0,'#cf9877'],[.35,'#f5d2b4'],[.65,'#efc3a1'],[1,'#c18b68']]);
  // Wrist and hand have continuous, softly modelled contours, not rectangular fingers.
  paint('M -.21 .78 C -.21 .58 -.23 .45 -.3 .3 C -.36 .16 -.38 -.04 -.36 -.22 C -.35 -.38 -.27 -.48 -.14 -.51 C .02 -.56 .24 -.5 .32 -.38 C .39 -.28 .4 -.06 .36 .14 C .33 .3 .25 .42 .23 .58 L .22 .78 Z',palmUp?palm:skin);
  if(palmUp){
    // Thenar and hypothenar pads, the thumb crease, heart line and head line.
    paint('M -.29 -.06 C -.43 .08 -.3 .37 -.13 .47 C -.03 .37 -.02 .17 -.12 .04 C -.17 -.05 -.24 -.1 -.29 -.06 Z',gradient(-.32,0,-.04,.34,[[0,'#d89c7c'],[.45,'#f6d3b4'],[1,'#deb08d']]),null);
    paint('M .24 -.02 C .38 .12 .28 .36 .15 .45 C .23 .22 .15 .12 .24 -.02 Z','#c4937130',null);
    line('M -.22 -.08 C -.13 -.04 -.05 .1 -.08 .28 C -.09 .38 -.13 .45 -.13 .51','#a77359',.014);
    line('M -.25 -.13 C -.09 -.03 .1 -.03 .27 -.14','#a8755b',.014);
    line('M -.23 .02 C -.04 .12 .1 .16 .24 .25','#a8755b',.014);
    line('M .04 .4 C .06 .28 .01 .18 .01 .1 M -.22 .03 L -.28 .09 M .17 .2 L .18 .27','#bc8a6c',.009);
    line('M -.14 .54 Q .02 .58 .2 .53 M -.15 .6 Q .01 .64 .18 .6','#b88364',.01);
  }else{
    // Dorsal extensor tendons are long raised forms; there are no palm creases here.
    for(const [a,b]of [[-.21,-.12],[-.04,-.02],[.13,.07],[.27,.16]]){
      ctx.beginPath();ctx.moveTo(b,.52);ctx.bezierCurveTo(b-.015,.31,a,.1,a,-.14);
      ctx.strokeStyle='#996a4e40';ctx.lineWidth=.022;ctx.stroke();
      ctx.beginPath();ctx.moveTo(b+.018,.49);ctx.bezierCurveTo(b+.008,.29,a+.02,.09,a+.018,-.14);
      ctx.strokeStyle='#f9d8b355';ctx.lineWidth=.014;ctx.stroke();
    }
    line('M -.16 .57 Q .02 .54 .2 .58','#ae7959',.01);
  }
  // Four individually curved fingers: varying lengths, joint folds and soft edge shadows.
  const digits=[[-.32,-.5,.17],[-.14,-.57,.18],[.055,-.54,.17],[.235,-.44,.145]];
  for(const [fx,fy,w]of digits){
    ctx.save();ctx.translate(fx,fy);
    const finger=gradient(0,0,w,.36,[[0,'#d2a17f'],[.24,'#edc3a0'],[.55,'#efc6a4'],[.82,'#dfad88'],[1,'#bd8765']]);
    paint(`M 0 .1 C -.006 .02 .035 -.01 ${w*.53} 0 C ${w*.91} -.005 ${w+.01} .04 ${w} .12 L ${w-.008} .29 C ${w-.015} .37 .025 .38 .006 .29 Z`,finger,'#8b6047',.011);
    if(palmUp){
      line(`M .03 .13 Q ${w/2} .15 ${w-.027} .128 M .038 .153 Q ${w/2} .17 ${w-.036} .151`,'#b47c5b',.009);
      line(`M .037 .255 Q ${w/2} .275 ${w-.035} .25`,'#dba887',.008);
    }else{
      // Visible nail plates and cuticles make the back-of-hand view unambiguous.
      paint(`M .035 .235 Q ${w/2} .204 ${w-.033} .235 L ${w-.031} .292 Q ${w/2} .323 .034 .29 Z`,gradient(0,.22,0,.32,[[0,'#c99686'],[.4,'#edc8bb'],[1,'#f8e5d6']]),'#b48572',.007);
      line(`M .025 .092 Q ${w/2} .069 ${w-.023} .093 M .033 .119 Q ${w/2} .099 ${w-.03} .121`,'#9c6b50',.009);
      line(`M .044 .28 Q ${w/2} .295 ${w-.04} .278`,'#fff1df',.009);
    }
    ctx.restore();
  }
  // The opposable thumb wraps across the side of the fabric, with a rounded joint.
  paint('M -.26 .26 C -.39 .19 -.49 .04 -.48 -.1 C -.48 -.2 -.4 -.27 -.32 -.31 C -.25 -.35 -.18 -.34 -.16 -.29 C -.13 -.24 -.16 -.19 -.22 -.14 L -.3 -.05 C -.29 .04 -.2 .06 -.16 .12 C -.13 .18 -.17 .25 -.26 .26 Z',gradient(-.48,-.1,-.14,.12,[[0,'#b87f5d'],[.3,'#e9b693'],[.6,'#f5caa5'],[1,'#c38a66']]));
  if(palmUp){
    line('M -.39 -.04 Q -.32 -.08 -.27 -.04 M -.38 -.015 Q -.33 -.04 -.3 -.02','#a67458',.011);
  }else{
    paint('M -.33 -.263 Q -.27 -.321 -.216 -.3 Q -.176 -.279 -.22 -.236 L -.268 -.193 Q -.309 -.19 -.33 -.263 Z','#efd0bd','#b18069',.008);
    line('M -.4 -.045 Q -.35 -.077 -.31 -.056','#98694f',.011);
  }
  // A short sleeve cuff anchors the hand and preserves orientation at small sizes.
  paint('M -.23 .68 Q 0 .71 .25 .67 L .26 .83 L -.24 .83 Z',gradient(0,.67,0,.83,[[0,'#f9f7ef'],[1,'#d5d1c4']]),'#aaa494',.011);
  line('M -.2 .73 Q 0 .76 .22 .72','#c7c1b1',.009);
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
  shape([[-.2,.05],[-.3,.16],[.17,1.19],[.29,1.16]],'#e6e3d9');
  shape([[.2,.05],[.3,.16],[-.13,1.19],[-.27,1.16]],'#fffdf4');
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
export function drawGripGuides(ctx,frame,hands,directions,mirrored=true,targets=null){
  const sign=mirrored?-1:1;
  ctx.save();ctx.translate(frame.origin.x,frame.origin.y);ctx.scale(frame.scale,frame.scale);
  if(targets)for(const p of targets){
    ctx.beginPath();ctx.ellipse(sign*p.x,p.y,.075,.1,sign*p.x,0,Math.PI*2);
    ctx.fillStyle='#ffffff14';ctx.fill();ctx.strokeStyle='#e6f1f785';ctx.lineWidth=.012;ctx.setLineDash([.025,.025]);ctx.stroke();ctx.setLineDash([]);
  }
  for(const [i,p]of hands.entries()){
    const px=sign*p.x,base=sign*(i?-.56:.56);
    ctx.beginPath();ctx.moveTo(base,1.19);ctx.quadraticCurveTo(base*.95,.85,px,p.y+.1);
    ctx.strokeStyle='#edf7ff4d';ctx.lineWidth=.105;ctx.lineCap='round';ctx.stroke();
    ctx.save();ctx.translate(px,p.y);ctx.rotate(-sign*(i?-.15:.15));ctx.globalAlpha=.68;
    drawGripHand(ctx,0,0,.3,directions[i]==='↑',mirrored?i===0:i===1,true);ctx.restore();
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
