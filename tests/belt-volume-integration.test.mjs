import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {normalizeControls} from '../src/belt-controls.js';
import {lessonMotion} from '../src/belt-volume-motion.js';
import {buildBlenderBelt} from '../src/belt-blender-motion.js';
import {BLENDER_BELT} from '../src/belt-blender-data.js';
import {foldMaterialStrip} from '../src/belt-material-folds.js';
import {paperMotion} from '../src/paper-motion.js';

const frames=normalizeControls(JSON.parse(gunzipSync(readFileSync(new URL('../assets/belt/controls-ebcf8e7605ad.json.gz',import.meta.url))))).frames;
const distance=(a,b)=>Math.hypot(...a.map((value,i)=>value-b[i]));

test('the product uses one finite, fixed-length Blender belt from the first authored pose',()=>{
  const expected=BLENDER_BELT.length;
  for(const frame of frames.filter((_,i)=>i%6===0||[510,888,990,1032,1170].includes(i))){
    const state=lessonMotion(frame);
    if(frame.originalPTS<8.5){assert.deepEqual(state,paperMotion(frame));continue;}
    assert.equal(state.volume.source,'blender-material-sequence-v1');
    assert.ok(state.volume.vertexData.every(Number.isFinite),`non-finite mesh at ${frame.originalPTS}`);
    assert.ok(Math.abs(state.volume.length-expected)<2e-8,`length changed at ${frame.originalPTS}`);
    // Assembly welds shared material vertices. Interpolated adapter frames have
    // a measured pre-weld mismatch below one eighth of the display thickness.
    assert.ok(state.volume.maxJoin<.006/8,`excessive seam correction at ${frame.originalPTS}`);
  }
});

test('display cross section shrinks without changing authored center paths or material reach',()=>{
  for(const key of BLENDER_BELT.keys){
    const mesh=buildBlenderBelt(key.t);
    assert.equal(mesh.displayWidth,.078);assert.equal(mesh.displayThickness,.006);
    assert.ok(Math.abs(mesh.length-BLENDER_BELT.length)<1e-12);
    assert.ok(mesh.maxJoin<1e-7,`authored seam at ${key.t}`);
    for(const name of ['A','B','adapterA','adapterB']){
      const part=mesh.parts.find(p=>p.name===name.replace('adapter','adapter-'));
      const original=foldMaterialStrip(name,{...key[name],sampleOnly:true});
      assert.equal(part.strip.width,.078);assert.equal(part.strip.thickness,.006);
      for(let j=0;j<=20;j++){
        const s=part.length*j/20,p=part.strip.sampleMaterialPoint(s);
        assert.ok(distance(p.center,original.sampleMaterialPoint(s).center)<1e-10);
        assert.ok(Math.abs(distance(part.strip.sampleMaterialPoint(s,0,1).center,part.strip.sampleMaterialPoint(s,0,-1).center)-.006)<1e-10);
      }
    }
    for(const source of BLENDER_BELT.standing){
      const part=mesh.parts.find(p=>p.name===source.name);
      for(let i=0;i<part.positions.length;i+=5){
        const row=Math.min(i/5*3,source.rows-1),center=source.positions.slice(row*15+6,row*15+9);
        center[1]-=2*mesh.pose.waist.dropM;
        assert.ok(distance(part.positions[i+2],center)<1e-10);
        const sourceWidth=distance(source.positions.slice(row*15,row*15+3),source.positions.slice(row*15+12,row*15+15));
        assert.ok(Math.abs(distance(part.positions[i],part.positions[i+4])-sourceWidth*.078/.09)<1e-10);
      }
    }
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
  return {point:[a[0]+q*(b[0]-a[0]),a[1]+q*(b[1]-a[1])],aMinusB:(a[2]+q*(b[2]-a[2]))-(c[2]+r*(d[2]-c[2]))};
}
test('the two user-marked crossings keep their separate front/back relationships',()=>{
 for(const [time,circlePoint,squarePoint] of [
  [17.208333333333336,[-.208,.075],[-.009,-.015]],
  [18.125,[-.165,.090],[.017,-.002]],
  [19.5,[-.096,.115],[.026,.036]],
  [19.8,[-.096,.115],[.026,.036]],
 ]){
  const mesh=buildBlenderBelt(time),[A,B]=mesh.strips,samples=strip=>{
    const out=[];for(let s=0;s<=strip.totalMaterialS;s+=.003)out.push(strip.sampleMaterialPoint(s).center);return out;
  },a=samples(A),b=samples(B),hits=[];
  for(let i=0;i<a.length-1;i++)for(let j=0;j<b.length-1;j++){const hit=crossing(a[i],a[i+1],b[j],b[j+1]);if(hit)hits.push(hit);}
  const nearest=target=>hits.reduce((best,hit)=>distance(hit.point,target)<distance(best.point,target)?hit:best);
  const circle=nearest(circlePoint),square=nearest(squarePoint);
  assert.ok(circle.aMinusB<-.01,'circle: blue B must remain in front of yellow A');
  assert.ok(square.aMinusB>.01,'square: blue B must pass behind yellow A');
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
