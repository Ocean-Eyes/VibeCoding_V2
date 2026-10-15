// Reviewed character-native flat panels; hidden material paths are authored inference.
import {rigFrame,handRig} from './retarget-rig.js';
export const WIDTH=.09;
const T=.008,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),phase=(t,a,b)=>clamp((t-a)/(b-a)),smooth=(t,a,b)=>{const u=phase(t,a,b);return u*u*(3-2*u)},mix=(a,b,t)=>a+(b-a)*t;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len=a=>Math.hypot(...a),unit=a=>mul(a,1/(len(a)||1)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],blend=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t)),v3=p=>[p[0],p[1],p[2]??0];
const rotate=(v,axis,a)=>add(add(mul(v,Math.cos(a)),mul(cross(axis,v),Math.sin(a))),mul(axis,dot(axis,v)*(1-Math.cos(a))));
function poly(ctx,vs){ctx.beginPath();vs.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();}
function extend(a,g,n=.10){return add(g,mul(unit(sub(g,a)),n));}
function shortestDelta(a,b){return Math.atan2(Math.sin(b-a),Math.cos(b-a));}
// A crease is a single material edge shared by adjacent rigid flat panels.
// Its diagonal slope is bounded in material coordinates. Partial hinge rotation
// provides foreshortening instead of a singular 2D bisector near a straight pose.
function nextBasis(D,N,wanted,preferredSign=-1){
 const desired=unit(v3(wanted)),dp=unit([D[0],D[1],0]),angle=shortestDelta(Math.atan2(dp[1],dp[0]),Math.atan2(desired[1],desired[0]));
 if(Math.abs(angle)<.015)return {D,N,k:0,phi:0};
 const normal=unit(cross(D,N)),h0=unit(add(dp,desired)),den=dot(h0,N),raw=Math.abs(den)>.001?dot(h0,D)/den:Math.sign(angle)*2.4,k=clamp(raw,-2.4,2.4),axis=unit(add(mul(D,k),N));
 // A phase-continuous fold, not a per-frame argmin that may jump between roots.
 const turn=Math.abs(angle),limit=2*Math.atan(1/2.4),u=clamp(turn/limit),phi=preferredSign*Math.PI*u*u*(3-2*u);

 return {D:rotate(D,axis,phi),N:rotate(N,axis,phi),k,phi,normal};
}
function clipMaterial(vs,maxS){const out=[];for(let i=0;i<vs.length;i++){const a=vs[i],b=vs[(i+1)%vs.length],ai=a.s<=maxS,bi=b.s<=maxS;if(ai)out.push(a);if(ai!==bi){const q=(maxS-a.s)/(b.s-a.s);out.push({s:maxS,v:mix(a.v,b.v,q),world:blend(a.world,b.world,q),cut:true});}}return out;}
export function makePaperStrip(material,targets,names,layers,{tipProgress=1,tipStart=0,behind=false}={}){
 targets=targets.map(v3);let D=unit(sub(targets[1],targets[0])),N=unit([-D[1],D[0],0]),center=targets[0],s=0,previousK=0;const panels=[],edges=[],frames=[];
 let currentEdge={id:material+':waist',kind:'waist-attachment',center,ends:[add(center,mul(N,WIDTH/2)),add(center,mul(N,-WIDTH/2))],materialS:0};edges.push(currentEdge);
 for(let i=1;i<targets.length;i++){
  const wanted=sub(targets[Math.min(i+1,targets.length-1)],targets[i]),hasFold=i<targets.length-1,after=hasFold?nextBasis(D,N,wanted,i%2?-1:1):{D,N,k:0,phi:0};
  const minL=WIDTH/2*Math.abs(after.k-previousK)+.012,delta=sub(targets[i],center),den=D[0]*D[0]+D[1]*D[1],projected=(delta[0]*D[0]+delta[1]*D[1])/Math.max(.08,den),L=Math.max(minL,Math.min(len(delta)*1.25+.02,Math.max(0,projected))),end=add(center,mul(D,L)),hinge=add(mul(D,after.k),N),nextEdge={id:material+':'+(names[i-1]??i),kind:hasFold?(Math.abs(after.phi)<.02?'coplanar-boundary':'true-crease'):'free-end',center:end,ends:[add(end,mul(hinge,WIDTH/2)),add(end,mul(hinge,-WIDTH/2))],materialS:s+L,slope:after.k,dihedral:after.phi};
  const coords=[{s:s+previousK*WIDTH/2,v:WIDTH/2,world:currentEdge.ends[0]},{s:s-previousK*WIDTH/2,v:-WIDTH/2,world:currentEdge.ends[1]},{s:s+L-after.k*WIDTH/2,v:-WIDTH/2,world:nextEdge.ends[1]},{s:s+L+after.k*WIDTH/2,v:WIDTH/2,world:nextEdge.ends[0]}];
  const p={id:material+':'+names[i-1],material,semantic:names[i-1],from:currentEdge,to:nextEdge,vertices3D:coords.map(x=>x.world),vertices:coords.map(x=>x.world.slice(0,2)),materialCoordinates:coords,width:WIDTH,thickness:T,D,N,normal:unit(cross(D,N)),length:L,layer:layers[i-1]??4,behind,hidden:(layers[i-1]??4)<0};panels.push(p);frames.push({center,D,N,length:L,s});edges.push(nextEdge);center=end;s+=L;D=after.D;N=after.N;previousK=after.k;currentEdge=nextEdge;
 }
 const start=tipStart<=0?0:(edges[Math.min(tipStart,edges.length-1)]?.materialS??0),visibleS=mix(start,s,tipProgress),active=panels.map(p=>{const clipped=clipMaterial(p.materialCoordinates,visibleS);return {...p,vertices3D:clipped.map(x=>x.world),vertices:clipped.map(x=>x.world.slice(0,2)),exposed:clipped.length>=3,tipClipped:clipped.some(x=>x.cut)};}).filter(p=>p.exposed);
 const crossing=panels.find(p=>visibleS>=p.from.materialS&&visibleS<=p.to.materialS)??panels.at(-1),position=add(crossing.from.center,mul(crossing.D,clamp(visibleS-crossing.from.materialS,0,crossing.length))),guideEnd=position.slice(0,2);
 return {material,edges,panels:active,fullPanels:panels,guideEnd,visibleMaterialS:visibleS,totalMaterialS:s,tipProgress,behind,materialWidth:WIDTH};
}
function nearestContact(strip,wanted,semantic=null){let best=null;for(const p of strip.panels){if(semantic&&!semantic(p))continue;const a=p.from.center,b=p.to.center,d=sub(b,a),q=clamp(((wanted[0]-a[0])*d[0]+(wanted[1]-a[1])*d[1])/(d[0]*d[0]+d[1]*d[1]||1),0,clamp((strip.visibleMaterialS-p.from.materialS)/(p.to.materialS-p.from.materialS||1))),point=add(a,mul(d,q)),distance=Math.hypot(wanted[0]-point[0],wanted[1]-point[1]);if(!best||distance<best.distance)best={point:point.slice(0,2),distance,panel:p.id,materialS:mix(p.from.materialS,p.to.materialS,q)};}return best;}
function frameRig(frame){const styled=rigFrame(frame);return {originalPTS:frame.originalPTS,hands:styled.hands.map(h=>{const raw=frame.hands[h.identity].resolved,support=h.identity==='Right'?smooth(frame.originalPTS,16.6,17)* (1-smooth(frame.originalPTS,17.65,18.1)):0,curl=h.curl.map((v,i)=>mix(v,raw.curl[i],support));return handRig({...frame.hands[h.identity],resolved:{...raw,curl}},h.identity)}).filter(Boolean)};}
export function paperMotion(frame){
 const t=frame.originalPTS,rig=frameRig(frame),hands=Object.fromEntries(rig.hands.map(h=>[h.identity,h])),gL=hands.Left?.grip??[.4,.1],gR=hands.Right?.grip??[-.4,.1],handoff=smooth(t,7,8),activeA=blend(gR,gL,handoff),activeB=blend(gL,gR,handoff),rootA=[-.43,.06],rootB=[.43,.07],behind=t>2.15&&t<4.1,tight=smooth(t,18.25,19.5);let A,B,events=[];
 const crossPoint=blend([.14,.125],[.22,.19],smooth(t,11.1,12.5)),upperExit=blend([.13,-.04],[.22,-.015],smooth(t,11.1,12.5));
 if(t<9){const tip=blend([activeA[0],Math.min(.85,activeA[1]+.62)],extend(rootA,activeA,.12),smooth(t,4.2,5.4));A=makePaperStrip('A',[rootA,tip],['front-cross'],[6],{behind});}
 else if(t<10.7){const oldTip=extend(rootA,gL,.12),regrip=smooth(t,9,10),hold=blend(blend(rootA,oldTip,.72),[.14,.125],regrip),tip=blend(oldTip,[.24,.475],regrip);A=makePaperStrip('A',[rootA,hold,tip],['front-cross','feeding-end'],[6,6]);}
 else if(t<10.78){const q=smooth(t,10.70,10.78),u=1-q,tip=[u*u*u*.24+3*u*u*q*.30+3*u*q*q*.25+q*q*q*upperExit[0],u*u*u*.475+3*u*u*q*.16+3*u*q*q*.04+q*q*q*upperExit[1]];A=makePaperStrip('A',[rootA,crossPoint,tip],['front-cross','feeding-end'],[6,t<10.75?6:-4]);events.push('Existing A end enters below both waist layers; hidden interval inferred');}
 else if(t<11.1){const tip=blend(upperExit,extend(crossPoint,gL,.10),smooth(t,10.78,10.95));A=makePaperStrip('A',[rootA,crossPoint,tip],['front-cross','raised-underpass'],[6,-4]);events.push('Same A end emerges upward and is received');}
 else if(t<13.5){A=makePaperStrip('A',[rootA,crossPoint,extend(crossPoint,gL,.10)],['front-cross','raised-underpass'],[6,-4]);}
 else if(t<14.35){const fold=smooth(t,13.5,14.35),startTip=extend(crossPoint,gL,.10),tip=blend(startTip,[-.18,.105],fold),newCrease=blend(blend(crossPoint,startTip,.50),upperExit,fold);A=makePaperStrip('A',[rootA,crossPoint,newCrease,tip],['front-cross','first-underpass','upper-return'],[6,-4,4]);}
 else {const c=blend([.22,.19],[.14,.13],tight),u=blend([.22,-.015],[.06,-.015],tight),entry=blend([-.18,.105],[-.06,.14],tight),tail=blend([-.55,.216],extend(entry,gR,.09),tight);A=makePaperStrip('A',[rootA,c,u,entry,tail],['front-cross','first-underpass','upper-return','outgoing-end'],[6,-4,4,7],{tipStart:3,tipProgress:smooth(t,14.35,15.25)});}
 if(t<8){const tip=blend([activeB[0],Math.min(.85,activeB[1]+.62)],extend(rootB,activeB,.12),smooth(t,4.2,5.4));B=makePaperStrip('B',[rootB,tip],['incoming-end'],[2],{behind});}
 else if(t<15){const released=smooth(t,9.3,10)*(1-smooth(t,11.1,11.7)),hold=blend(gR,[-.34,.12],released),oldTip=extend(rootB,gR,.12),q=smooth(t,8,9),pickup=blend(blend(rootB,oldTip,.75),hold,q),tip=blend(oldTip,[hold[0]-.035,Math.min(.90,hold[1]+.43)],q);B=makePaperStrip('B',[rootB,pickup,tip],['waist-run','hanging-end'],[2,4]);}
 else if(t<16.5){const lift=smooth(t,15,15.5),pickup=blend(gR,[-.35,.12],lift),raised=extend(pickup,gR,.10),tip=blend([gR[0]-.035,Math.min(.90,gR[1]+.43)],raised,lift),approach=smooth(t,16,16.5),feedingTip=blend(tip,[.15,-.025],approach),movingPickup=blend(pickup,blend(rootB,[.15,-.025],.55),smooth(t,16.15,16.5));B=makePaperStrip('B',[rootB,movingPickup,feedingTip],['waist-run','lifted-feed'],[2,4]);}
 else {const entry=blend([.15,-.025],[.10,.015],tight),exit=blend([.15,.13],[.10,.125],tight),opening=blend([.025,.08],[.025,.075],tight),tail=extend(opening,gL,.10);B=makePaperStrip('B',[rootB,entry,exit,opening,tail],['waist-feed','between-layer','hidden-return','outgoing-end'],[2,-3,4,7],{tipStart:1,tipProgress:smooth(t,16.5,17)});events.push('B tip first through retained A opening; hidden return authored');}
 for(const p of A.panels)if(p.semantic==='upper-return')p.wrapFrontFraction=tight;
 const strips=[A,B],contacts=[];for(const st of strips){const p=st.fullPanels.find(p=>st.visibleMaterialS<=p.to.materialS+1e-8)??st.fullPanels.at(-1),tip=st.guideEnd;st.freeEndVisible=!st.behind&&!(p.hidden&&tip[0]>=-.43&&tip[0]<=.43&&tip[1]>=-.011&&tip[1]<=.118);}

 // All source frames contribute targets. Only projected panel contacts are fitted.
 // Record the resulting correction instead of relabeling it as a measurement.
 for(const h of [...rig.hands]){let material,weight=1;const right=h.identity==='Right';
  if(t<7)material=right?'A':'B';else if(t<8)material=null;else if(t>=9.5&&t<10.78)material=right?'A':null;else if(t>=10.78&&t<10.95)material='A';else if(t<16.75)material=right?'B':'A';else if(right){material=t<17.15?'B':'A';weight=t<17.15?1-smooth(t,16.85,17.15):smooth(t,17.15,17.45);}else material='B';
  if(!material||behind||weight===0)continue;const strip=material==='A'?A:B,late=t>=18.25,support=right?smooth(t,16.6,17)*(1-smooth(t,17.65,18.1)):0,pad=mul(add(h.digits[0].at(-1),h.thumb.at(-1)),.5),feature=blend(h.grip,pad,support),filter=late?p=>p===strip.panels.at(-1):t>=15.25&&t<16.75&&material==='A'?p=>p.semantic==='first-underpass'||p.semantic==='upper-return':null,c=nearestContact(strip,feature,filter);if(!c)continue;
  const correction=(t<9?.65:1)*weight,delta=mul(sub(c.point,feature),correction),target=add(h.grip,delta),control=frame.hands[h.identity],adapted={...control,resolved:{...control.resolved,gripCenter:[target[0]/.86,(target[1]-.04)/.86],curl:h.curl}},fit=handRig(adapted,h.identity);let actualContact=feature;if(fit){fit.contactRetargetDelta=len(sub(fit.grip,h.inputGrip));fit.contactPose='source control projected to authored paper contact';rig.hands[rig.hands.indexOf(h)]=fit;const fittedPad=mul(add(fit.digits[0].at(-1),fit.thumb.at(-1)),.5);actualContact=blend(fit.grip,fittedPad,support);}
  contacts.push({identity:h.identity,material,panel:c.panel,materialS:c.materialS,sourceTarget:h.inputGrip,assignedPoint:c.point,actualContactPoint:actualContact,feature:support>0?'blend grip to index-thumb pads':'grip',featureBlend:support,role:support>0?'support':'held',acquisitionWeight:weight,correction:c.distance,certainty:'inferred character contact; source controls unchanged'});
 }

 return {sourceFrame:frame,frameIndex:frame.frameIndex,originalPTS:t,rig,strips,contacts,behindBody:behind,tightening:tight,guideEnds:Object.fromEntries(strips.map(s=>[s.material,{position:s.guideEnd,kind:'authored shortened display end',freeEndVisible:s.freeEndVisible,sourceObservedTip:frame.beltEnds?.[s.material]?.observedTip??null}])),inference:{kind:'native shared-edge panels with source-controlled contacts',events,failures:[],originalFramesRetained:true}};
}
