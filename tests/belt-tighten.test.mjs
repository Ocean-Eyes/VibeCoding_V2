import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBlenderBelt,blenderPose} from '../src/belt-blender-motion.js';

test('final tension keeps the authored root frames and fold directions',()=>{
 for(const time of [18,18.8,18.9,19,19.3,19.5,19.8]){
  const actual=buildBlenderBelt(time).pose,authored=blenderPose(time);
  for(const name of ['A','B']){
   assert.deepEqual(actual[name].origin,authored[name].origin);
   assert.deepEqual(actual[name].basis,authored[name].basis);
   for(let i=0;i<2;i++){
    assert.equal(actual[name].creases[i].angle,authored[name].creases[i].angle);
    assert.ok(actual[name].creases[i].radius>=.006);
   }
  }
  assert.equal(actual.A.creases[0].radius,authored.A.creases[0].radius,'the under-waist fold must retain its depth');
 }
});

function crossing(a,b,c,d){
 const dx=b[0]-a[0],dy=b[1]-a[1],ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;
 if(Math.abs(den)<1e-10)return null;
 const q=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/den,r=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/den;
 if(q<0||q>1||r<0||r>1)return null;
 return {q,r,gap:a[2]+q*(b[2]-a[2])-c[2]-r*(d[2]-c[2])};
}

test('tightening preserves the same material crossings throughout the pull',()=>{
 // Follow named material spans, not the nearest screen intersection: another
 // crossing can move into that screen position while the real one reverses.
 for(let frame=0;frame<=108;frame++){
  const t=18+frame/60,m=buildBlenderBelt(t),N=300;
  const points=m.strips.map(s=>Array.from({length:N+1},(_,i)=>s.sampleMaterialPoint(s.totalMaterialS*i/N).center));
  const limits=m.strips.map(s=>m.pose[s.material].creases.slice(0,2).map(c=>s.sourceToMaterial(c.s)));
  const central=[],left=[];
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
   const h=crossing(points[0][i],points[0][i+1],points[1][j],points[1][j+1]);if(!h)continue;
   const a=(i+h.q)/N*m.strips[0].totalMaterialS,b=(j+h.r)/N*m.strips[1].totalMaterialS;
   if(a>limits[0][1]&&b>limits[1][1])central.push(h.gap);
   if(a<limits[0][0]&&b>limits[1][0]&&b<limits[1][1])left.push(h.gap);
  }
  assert.equal(central.length,1,`central outgoing A/B crossing lost at ${t}`);
  assert.equal(left.length,1,`left standing A/middle B crossing lost at ${t}`);
  assert.ok(central[0]>.0075,`central B must stay behind A at ${t}: ${central[0]}`);
  assert.ok(left[0]<-.0075,`left B must stay in front of A at ${t}: ${left[0]}`);
  const a=m.strips[0],c=m.pose.A.creases;
  const under=a.sampleMaterialPoint(a.sourceToMaterial((c[0].s+c[1].s)/2)).center;
  assert.ok(under[2]<.025,`A's under-wrap span came in front of the waist layers at ${t}`);
 }
});

function knotBounds(m){
 const points=[];
 for(const strip of m.strips){
  const p=m.pose[strip.material];
  for(let s=p.creases[0].s-.05;s<=p.creases[1].s+.07;s+=.002){
   for(const v of [-.039,.039])points.push(strip.sampleMaterialPoint(strip.sourceToMaterial(s),v).center);
  }
 }
 return [0,1,2].map(k=>[Math.min(...points.map(p=>p[k])),Math.max(...points.map(p=>p[k]))]);
}

test('the maximum pull compacts and centers the knot while pulling both held ends taut',()=>{
 const start=buildBlenderBelt(18),finish=buildBlenderBelt(19.8);
 const [before]=knotBounds(start),[x,y]=knotBounds(finish);
 assert.ok(x[1]-x[0]<(before[1]-before[0])*.83,'hands moved without sufficiently closing the knot');
 assert.ok(x[1]-x[0]<.35,'knot still spread too widely');
 assert.ok(Math.abs((x[0]+x[1])/2)<.01,'knot is off the body center');
 assert.ok(Math.abs((y[0]+y[1])/2-.03)<.01,'knot is off the waist height');
 for(const strip of finish.strips){
  const end=strip.sampleMaterialPoint(strip.totalMaterialS).center;
  const grip=strip.sampleMaterialPoint(strip.totalMaterialS-.045).center;
  // The illustrated waist silhouette reaches x=-.440 and x=.424.
  assert.ok(Math.abs(grip[0])>.60,'pull stopped before the held ends spread fully outside the torso');
  const inner=strip.sampleMaterialPoint(strip.totalMaterialS-.15).center;
  const d=end.map((v,i)=>v-inner[i]),length=Math.hypot(...d);
  assert.ok(Math.abs(d[1]/d[0])<.5,'free end is not being pulled laterally');
  for(let i=1;i<15;i++){
   const p=strip.sampleMaterialPoint(strip.totalMaterialS-.15+i*.01).center;
   const q=p.map((v,k)=>v-inner[k]),projection=q.reduce((sum,v,k)=>sum+v*d[k],0)/(length*length);
   assert.ok(Math.hypot(...q.map((v,k)=>v-projection*d[k]))<.001,'held free span remains bent');
  }
  const fold=finish.pose[strip.material].creases[1];
  // The outgoing span is still in contact with the opposing loop inside the
  // knot. Require a straight free span after that contact, all the way to the hand.
  const exit=fold.s+Math.abs(fold.k)*.039+Math.abs(fold.angle)*fold.radius/2*Math.hypot(1,fold.k)+.26;
  const from=strip.sourceToMaterial(exit),base=strip.sampleMaterialPoint(from).center;
  const run=end.map((v,i)=>v-base[i]),square=run.reduce((sum,v)=>sum+v*v,0);
  for(let s=from;s<=strip.totalMaterialS;s+=.01){
   const delta=strip.sampleMaterialPoint(s).center.map((v,i)=>v-base[i]);
   const projection=delta.reduce((sum,v,i)=>sum+v*run[i],0)/square;
   assert.ok(Math.hypot(...delta.map((v,i)=>v-projection*run[i]))<.001,'waist fitting bends the outgoing span');
  }
 }
 const grips=finish.strips.map(s=>s.sampleMaterialPoint(s.totalMaterialS-.045).center);
 assert.ok(Math.abs(grips[0][0]+grips[1][0])<.005,'the two hands must pull equally far to opposite sides');
 assert.ok(Math.abs(grips[0][1]-grips[1][1])<.005,'the two grips must finish at the same height');
 assert.ok(Math.abs(start.length-finish.length)<1e-9,'pull stretched the belt');
});

test('the central knot window closes instead of exposing the waist layer through a gap',()=>{
 const mesh=buildBlenderBelt(19.8),d=mesh.vertexData;
 const endA=mesh.strips[0].totalMaterialS,startB=mesh.length-mesh.strips[1].totalMaterialS;
 // This is the user-marked window in the front view. Check the frontmost
 // triangle's material identity: a rear wrap visible here is still an aperture,
 // even though a black-on-black screenshot could conceal it.
 for(let iy=0;iy<=12;iy++)for(let ix=0;ix<=16;ix++){
  const x=-.025+.05*ix/16,y=.012+.04*iy/12;let front=-Infinity,material=-1;
  for(let i=0;i<d.length;i+=24){
   if(x<Math.min(d[i],d[i+8],d[i+16])||x>Math.max(d[i],d[i+8],d[i+16])||y<Math.min(d[i+1],d[i+9],d[i+17])||y>Math.max(d[i+1],d[i+9],d[i+17]))continue;
   const den=(d[i+9]-d[i+17])*(d[i]-d[i+16])+(d[i+16]-d[i+8])*(d[i+1]-d[i+17]);
   if(Math.abs(den)<1e-12)continue;
   const u=((d[i+9]-d[i+17])*(x-d[i+16])+(d[i+16]-d[i+8])*(y-d[i+17]))/den;
   const v=((d[i+17]-d[i+1])*(x-d[i+16])+(d[i]-d[i+16])*(y-d[i+17]))/den,w=1-u-v;
   if(u<0||v<0||w<0)continue;
   const z=u*d[i+2]+v*d[i+10]+w*d[i+18];
   if(z>front){front=z;material=u*d[i+7]+v*d[i+15]+w*d[i+23];}
  }
  assert.ok(material>=0&&(material<endA||material>startB),`central opening remains at ${x}, ${y}`);
 }
});

test('both retained grips keep moving outward through the end of tightening',()=>{
 let previous=null;
 for(let frame=0;frame<=60;frame++){
  const mesh=buildBlenderBelt(18.8+frame/60);
  const reach=mesh.strips.map(s=>Math.abs(s.sampleMaterialPoint(s.totalMaterialS-.045).center[0]));
  if(previous)for(let i=0;i<2;i++)assert.ok(reach[i]>=previous[i]-.0005,`hand ${i} stopped pulling outward at frame ${frame}`);
  previous=reach;
 }
});

test('the exposed central standing panel is straight between its contacts',()=>{
 const mesh=buildBlenderBelt(19.8),strip=mesh.strips[0],fold=mesh.pose.A.creases[0];
 const entry=fold.s-Math.abs(fold.k)*.039-Math.abs(fold.angle)*fold.radius/2*Math.hypot(1,fold.k);
 const sample=(s,v)=>strip.sampleMaterialPoint(strip.sourceToMaterial(s),v).center;
 // Inspect both material edges as well as the centre, not only its end-to-end
 // chord. This catches the visible S even when length and crossing tests pass.
 for(const v of [-.039,0,.039]){
  const start=entry-.085,end=entry-.002,a=sample(start,v),b=sample(end,v);
  const d=b.map((x,i)=>x-a[i]),dd=d.reduce((sum,x)=>sum+x*x,0);
  for(let i=1;i<30;i++){
   const p=sample(start+(end-start)*i/30,v).map((x,k)=>x-a[k]);
   const q=p.reduce((sum,x,k)=>sum+x*d[k],0)/dd;
   assert.ok(Math.hypot(...p.map((x,k)=>x-q*d[k]))<.0001,'central panel still has an S-shaped deviation');
  }
 }
});
