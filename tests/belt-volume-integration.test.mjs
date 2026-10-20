import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {normalizeControls} from '../src/belt-controls.js';
import {lessonMotion} from '../src/belt-volume-motion.js';
import {buildBlenderBelt} from '../src/belt-blender-motion.js';
import {BLENDER_BELT} from '../src/belt-blender-data.js';
import {foldMaterialStrip} from '../src/belt-material-folds.js';

const frames=normalizeControls(JSON.parse(gunzipSync(readFileSync(new URL('../assets/belt/controls-ebcf8e7605ad.json.gz',import.meta.url))))).frames;
const distance=(a,b)=>Math.hypot(...a.map((value,i)=>value-b[i]));

test('the product uses one finite, fixed-length Blender belt from the first authored pose',()=>{
  const expected=BLENDER_BELT.length;
  for(const frame of frames.filter((_,i)=>i%6===0||[510,888,990,1032,1170].includes(i))){
    const state=lessonMotion(frame);
    assert.equal(state.volume.source,frame.originalPTS<8.5?'continuous-material-preparation':'blender-material-sequence-v1');
    assert.ok(state.volume.vertexData.every(Number.isFinite),`non-finite mesh at ${frame.originalPTS}`);
    assert.ok(Math.abs(state.volume.length-expected)<2e-8,`length changed at ${frame.originalPTS}`);
    // Assembly welds shared material vertices. Interpolated adapter frames have
    // a measured pre-weld mismatch below one eighth of the display thickness.
    assert.ok(state.volume.maxJoin<.006/8,`excessive seam correction at ${frame.originalPTS}`);
  }
});

test('display cross section and relative knot geometry survive fitting to a flat waist',()=>{
  for(const key of BLENDER_BELT.keys){
    const mesh=buildBlenderBelt(key.t);
    assert.equal(mesh.displayWidth,.078);assert.equal(mesh.displayThickness,.006);
    assert.ok(Math.abs(mesh.length-BLENDER_BELT.length)<1e-12);
    assert.ok(mesh.maxJoin<1e-7,`authored seam at ${key.t}`);
    for(const name of ['A','B','adapterA','adapterB']){
      const part=mesh.parts.find(p=>p.name===name.replace('adapter','adapter-'));
      const original=foldMaterialStrip(name,{...key[name],sampleOnly:true});
      assert.equal(part.strip.width,.078);assert.equal(part.strip.thickness,.006);
      if(name.startsWith('adapter'))continue; // The user's marked shoulders are explicitly refitted.
      for(let j=0;j<=20;j++){
        const sourceS=Math.min(key[name].length,part.strip.sourceMaterialLength)*j/20,s=part.strip.sourceToMaterial(sourceS),p=part.strip.sampleMaterialPoint(s);
        const expected=original.sampleMaterialPoint(sourceS).center;
        // Preserve authored geometry before the final tension adjustment.
        // A's earlier under-wrap bend has a clearance correction; B's small
        // tip bend travels with its redistributed end after threading.
        const movingTip=name==='B'&&key.t>18&&sourceS>part.strip.sourceMaterialLength-.08;
        if(key.t<=18.8&&!movingTip&&(name!=='A'||key.t<=10.35||key.t>=11.4)){assert.ok(Math.abs(p.center[0]-expected[0])<1e-9);assert.ok(Math.abs(p.center[2]-expected[2])<1e-9);if(Math.abs(expected[0])<.04)assert.ok(Math.abs(p.center[1]-(expected[1]+2*mesh.pose.waist.dropM))<1e-9);}
        assert.ok(Math.abs(distance(part.strip.sampleMaterialPoint(s,0,1).center,part.strip.sampleMaterialPoint(s,0,-1).center)-.006)<1e-10);
      }
    }
    for(const source of BLENDER_BELT.standing){
      const part=mesh.parts.find(p=>p.name===source.name);
      for(let i=0;i<part.positions.length;i+=5){
        const row=Math.min(i/5*3,source.rows-1),center=source.positions.slice(row*15+6,row*15+9);
        const pulledRear=key.t>18.8&&source.name.startsWith('rear-smooth');
        if(pulledRear){
          const actual=part.positions[i+2];
          assert.ok(Math.abs(actual[0]*(center[2]+.225)-center[0]*(actual[2]+.225))<1e-10,'rear take-up changed the wrap direction');
          assert.ok(Math.hypot(actual[0]/.44,(actual[2]+.225)/.24)<=Math.hypot(center[0]/.44,(center[2]+.225)/.24)+1e-10,'rear wrap grew instead of tightening');
        }else assert.ok(Math.abs(part.positions[i+2][0]-center[0])<1e-10);
        assert.ok(Math.abs(part.positions[i+2][1]-center[1])<1e-10);
        if(!pulledRear)assert.ok(Math.abs(part.positions[i+2][2]-center[2])<1e-10);
        const sourceWidth=distance(source.positions.slice(row*15,row*15+3),source.positions.slice(row*15+12,row*15+15));
        assert.ok(Math.abs(distance(part.positions[i],part.positions[i+4])-sourceWidth*.078/.09)<1e-10);
      }
    }
  }
});

test('stages four through seven keep horizontal waist edges and conserve actual surface length',()=>{
 for(let t=8.5;t<=19.8+1e-8;t+=.1){
  const mesh=buildBlenderBelt(t);let measured=0;
  for(const part of mesh.parts){
   const rows=part.uv.map((uv,i)=>({s:uv[0],v:uv[1],p:part.positions[i]})).filter(row=>Math.abs(row.v)<1e-9).sort((a,b)=>a.s-b.s);
   for(let i=1;i<rows.length;i++)measured+=distance(rows[i].p,rows[i-1].p);
  }
  assert.ok(Math.abs(measured-BLENDER_BELT.length)<.003,`actual surface length at ${t}: ${measured}`);
 for(const name of ['adapter-A','adapter-B']){
  const part=mesh.parts.find(p=>p.name===name);
  for(let i=0;i<part.positions.length;i++){
   // The user marked the shoulders, not the retained folded knot core.
   assert.ok(part.positions[i][1]>=-.01&&part.positions[i][1]<=.08,'raised shoulder remains');
   if(Math.abs(part.uv[i][1])<1e-9)assert.ok(part.positions[i][1]>=.03-1e-9&&part.positions[i][1]<=.04+1e-9,'waist connection is not horizontal');
  }
 }
 const inner=mesh.parts.find(p=>p.name==='middle-inner');
 for(let i=0;i<inner.positions.length;i++){
  assert.ok(Math.abs(inner.positions[i][1]-(.03+inner.uv[i][1]))<1e-10,`waist edge dips at ${t}`);
 }
 }
});

test('connection fitting does not advance or retract the tip while it is threading',()=>{
 for(let t=10;t<=12;t+=.1)assert.ok(Math.abs(buildBlenderBelt(t).strips[0].sourceMaterialLength-BLENDER_BELT.keys[0].A.length)<1e-12);
 for(let t=15.5;t<=18;t+=.1)assert.ok(Math.abs(buildBlenderBelt(t).strips[1].sourceMaterialLength-BLENDER_BELT.keys[0].B.length)<1e-12);
});

test('the finished belt has equal lateral end reach without changing its total length',()=>{
 for(const t of [19.5,19.65,19.8]){
  const mesh=buildBlenderBelt(t),[a,b]=mesh.strips.map(s=>s.sampleMaterialPoint(s.totalMaterialS).center);
  assert.ok(a[0]<-.4&&b[0]>.4,'ends were not pulled clear of the knot');
  assert.ok(Math.abs(a[0]+b[0])<1e-8,'one end remains longer in the finish');
  assert.ok(Math.abs(a[1]-b[1])<.035,'ends finish at different heights');
  assert.ok(Math.abs(mesh.length-BLENDER_BELT.length)<1e-10);
 }
});

test('the rendered thick surface stays closed through keys and intervening folds',()=>{
  for(const t of [8.5,14.8,16,16.75,16.8833333333,17.2083333333,18.125,19.8]){
    const {vertexData:v}=buildBlenderBelt(t),edges=new Map();
    const point=i=>[v[i],v[i+1],v[i+2]].map(x=>x.toFixed(7)).join(',');
    for(let i=0;i<v.length;i+=24){
      const ids=[point(i),point(i+8),point(i+16)];
      for(let j=0;j<3;j++){
        const edge=[ids[j],ids[(j+1)%3]].sort().join('|');
        edges.set(edge,(edges.get(edge)??0)+1);
      }
    }
    assert.ok([...edges.values()].every(count=>count===2),`open/non-manifold surface at ${t}`);
  }
});

function crossing(a,b,c,d){
  const den=(b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0]);if(Math.abs(den)<1e-9)return null;
  const q=((c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0]))/den;
  const r=((c[0]-a[0])*(b[1]-a[1])-(c[1]-a[1])*(b[0]-a[0]))/den;
  if(q<0||q>1||r<0||r>1)return null;
  return {q,r,point:[a[0]+q*(b[0]-a[0]),a[1]+q*(b[1]-a[1])],aMinusB:(a[2]+q*(b[2]-a[2]))-(c[2]+r*(d[2]-c[2]))};
}
test('the two user-marked crossings keep their separate front/back relationships',()=>{
 for(const time of [17.208333333333336,18.125,19.5,19.8]){
  const mesh=buildBlenderBelt(time),[A,B]=mesh.strips,samples=strip=>{
    const out=[];for(let s=0;s<=strip.totalMaterialS;s+=.003)out.push(strip.sampleMaterialPoint(s).center);return out;
  },a=samples(A),b=samples(B),hits=[];
  for(let i=0;i<a.length-1;i++)for(let j=0;j<b.length-1;j++){const hit=crossing(a[i],a[i+1],b[j],b[j+1]);if(hit)hits.push({...hit,a:(i+hit.q)*.003,b:(j+hit.r)*.003});}
  const [a0,a1]=mesh.pose.A.creases.map(c=>A.sourceToMaterial(c.s)),[b0,b1]=mesh.pose.B.creases.map(c=>B.sourceToMaterial(c.s));
  // The knot moves and contracts. Follow the marked material spans rather
  // than whichever unrelated crossing is nearest their former screen position.
  const circle=hits.filter(h=>h.a<a0&&h.b>b0&&h.b<b1),square=hits.filter(h=>h.a>a1&&h.b>b1);
  assert.equal(circle.length,1);assert.equal(square.length,1);
  const clearance=mesh.displayThickness+.0015;
  assert.ok(circle[0].aMinusB<-clearance,'circle: blue B must remain in front of yellow A');
  assert.ok(square[0].aMinusB>clearance,'square: blue B must pass behind yellow A');
 }
});

test('dense knot keys are ordered and keep the same authored material dimensions',()=>{
  let previous=-Infinity;
  for(const key of BLENDER_BELT.keys){
    assert.ok(key.t>previous,`duplicate or reversed key at ${key.t}`);previous=key.t;
    for(const name of ['A','B','adapterA','adapterB']){
      assert.equal(key[name].width,.09);assert.equal(key[name].thickness,.007);
      assert.ok(key[name].creases.every(crease=>Math.abs(crease.angle)<=2*Math.PI));
    }
  }
});
