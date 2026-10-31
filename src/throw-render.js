import {add,sub,mul,unit,cross,dot} from './throw-motion.js';
import {BODY_SIZE,JACKET_ROWS} from './throw-body.js';

const WHITE=[.88,.91,.91],BLUE=[.23,.48,.62],SKIN=[.78,.61,.46],BELT=[.075,.09,.10],GOLD=[.91,.68,.32];
const circle=Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8),Math.sin(i*Math.PI/8)]);
function triangle(out,a,b,c,color,normals){
 const n=unit(cross(sub(b,a),sub(c,a)));
 for(const [i,p] of [a,b,c].entries())out.push(...p,...(normals?.[i]??n),...color);
}
function tube(out,a,b,r1,r2,color,sides=12){
 const axis=unit(sub(b,a)),u=unit(cross(axis,Math.abs(axis[2])<.9?[0,0,1]:[0,1,0])),v=cross(axis,u);
 const normals=Array.from({length:sides},(_,i)=>add(mul(u,Math.cos(i/sides*2*Math.PI)),mul(v,Math.sin(i/sides*2*Math.PI))));
 const aa=normals.map(n=>add(a,mul(n,r1))),bb=normals.map(n=>add(b,mul(n,r2)));
 for(let i=0;i<sides;i++){const j=(i+1)%sides;triangle(out,aa[i],bb[i],bb[j],color,[normals[i],normals[i],normals[j]]);triangle(out,aa[i],bb[j],aa[j],color,[normals[i],normals[j],normals[j]]);triangle(out,a,aa[j],aa[i],color);triangle(out,b,bb[i],bb[j],color);}
}
function ellipsoid(out,center,radii,basis,color){
 const rows=8,sides=12,points=[],normals=[];
 for(let i=0;i<=rows;i++){points[i]=[];normals[i]=[];const phi=i/rows*Math.PI;
  for(let j=0;j<sides;j++){const theta=j/sides*2*Math.PI,raw=[Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)];
   points[i][j]=add(center,raw.reduce((p,k,n)=>add(p,mul(basis[n],k*radii[n])),[0,0,0]));
   normals[i][j]=unit(raw.reduce((p,k,n)=>add(p,mul(basis[n],k/radii[n])),[0,0,0]));
  }
 }
 for(let i=1;i<=rows;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides;triangle(out,points[i-1][j],points[i][j],points[i][k],color,[normals[i-1][j],normals[i][j],normals[i][k]]);triangle(out,points[i-1][j],points[i][k],points[i-1][k],color,[normals[i-1][j],normals[i][k],normals[i-1][k]]);}
}
function ribbon(out,points,width,normal,color){
 for(let i=1;i<points.length;i++){const side=mul(unit(cross(sub(points[i],points[i-1]),normal)),width/2),a=sub(points[i-1],side),b=add(points[i-1],side),c=add(points[i],side),d=sub(points[i],side);triangle(out,a,b,c,color,[normal,normal,normal]);triangle(out,a,c,d,color,[normal,normal,normal]);tube(out,a,d,.003,.003,color.map(v=>v*.84),6);tube(out,b,c,.003,.003,color.map(v=>v*.84),6);}
}
function jacket(out,rig,color){
 const rows=JACKET_ROWS,rings=rows.map(([y,rx,rz])=>circle.map(([c,s])=>rig.at(rx*c,y,rz*s))),normals=rows.map(([,rx,rz])=>circle.map(([c,s])=>unit(add(mul(rig.right,c/rx),mul(rig.forward,s/rz)))));
 for(let i=1;i<rows.length;i++)for(let j=0;j<16;j++){const k=(j+1)%16;triangle(out,rings[i-1][j],rings[i][j],rings[i][k],color,[normals[i-1][j],normals[i][j],normals[i][k]]);triangle(out,rings[i-1][j],rings[i][k],rings[i-1][k],color,[normals[i-1][j],normals[i][k],normals[i-1][k]]);}
 for(let j=0;j<16;j++){const k=(j+1)%16;triangle(out,rig.at(0,.49),rings[3][j],rings[3][k],color);}
 // Lapels follow the same rigid torso frame rather than floating in screen space.
 for(const path of [[[-.10,.55,.09],[-.10,.40,.153],[.02,.22,.153],[.12,.08,.148]],[[.10,.55,.09],[.08,.40,.157],[-.02,.22,.16],[-.12,.08,.15]]])ribbon(out,path.map(p=>rig.at(...p)),.052,rig.forward,color.map(v=>Math.min(1,v+.075)));
 // Connected overlap, hem and seams make the judogi readable as clothing.
 ribbon(out,[[.12,.08,.148],[.13,-.10,.15]].map(p=>rig.at(...p)),.012,rig.forward,color.map(v=>v*.86));
 for(let j=0;j<16;j++)tube(out,rings[0][j],rings[0][(j+1)%16],.003,.003,color.map(v=>v*.82),6);
 const waist=circle.map(([c,s])=>rig.at(.19*c,.055,.145*s));
 for(let j=0;j<16;j++){const k=(j+1)%16;const p=waist[j],q=waist[k],up=mul(rig.up,.045);triangle(out,p,q,add(q,up),BELT);triangle(out,p,add(q,up),add(p,up),BELT);}
 ellipsoid(out,rig.at(0,.075,.16),[.042,.038,.025],[rig.right,rig.up,rig.forward],BELT);
 tube(out,rig.at(0,.06,.16),rig.at(-.09,-.11,.17),.019,.018,BELT,6);tube(out,rig.at(0,.06,.16),rig.at(.10,-.10,.17),.019,.018,BELT,6);
}
function hand(out,arm,rig,grasp,side){
 const forearm=unit(sub(arm.end,arm.joint));
 // Orient the palm towards the held material, independently of the character's
 // torso and the camera. The same grasp survives a crossed arm or shoulder roll.
 const freeNormal=unit(sub(rig.forward,mul(forearm,dot(rig.forward,forearm))));
 const gripWeight=grasp?(grasp.orientationWeight??grasp.held):0;
 const normal=unit(add(mul(freeNormal,1-gripWeight),mul(grasp?.normal??freeNormal,-gripWeight)));
 let along=unit(sub(forearm,mul(normal,dot(forearm,normal))));
 if(Math.hypot(...along)<.5)along=unit(cross(rig.right,normal));
 const across=unit(cross(along,normal)),basis=[across,along,normal];
 const at=(x,y,z)=>add(arm.end,add(mul(across,x),add(mul(along,y),mul(normal,z))));
 ellipsoid(out,arm.end,[.029,.031,.020],basis,SKIN);
 // Four curled fingers and an opposing thumb surround the grasp, within the
 // conservative .052 m hand envelope used by contact QA.
 for(let i=0;i<4;i++){const x=(i-1.5)*.013,a=at(x,.012,-.006),b=at(x,.030,.008),c=at(x,.024,.030),d=at(x,.006,.041);tube(out,a,b,.008,.0075,SKIN,8);tube(out,b,c,.0075,.007,SKIN,8);tube(out,c,d,.007,.006,SKIN,8);ellipsoid(out,b,[.008,.008,.008],basis,SKIN);}
 const thumb=side==='right'?-1:1;
 tube(out,at(thumb*.026,-.010,0),at(thumb*.033,-.009,.023),.010,.009,SKIN,8);tube(out,at(thumb*.033,-.009,.023),at(thumb*.012,-.008,.040),.009,.007,SKIN,8);
}
function person(out,rig,color,performer=false,grasps=null){
 const basis=[rig.right,rig.up,rig.forward];
 for(const [side,leg] of Object.entries(rig.legs)){
  tube(out,leg.root,leg.joint,...BODY_SIZE.thigh,color);tube(out,leg.joint,leg.end,...BODY_SIZE.shin,color);ellipsoid(out,leg.joint,[.085,.085,.085],basis,color);
  const flatForward=[Math.sin(rig.yaw),0,Math.cos(rig.yaw)];
  const foot=add(leg.end,add(mul(flatForward,.065),[0,-.027,0]));
  ellipsoid(out,foot,BODY_SIZE.foot,[rig.right,[0,1,0],flatForward],SKIN);
 }
 jacket(out,rig,color);
 tube(out,rig.at(0,.48),rig.neck,.065,.06,SKIN);
 ellipsoid(out,rig.head,BODY_SIZE.head,basis,SKIN);
 ellipsoid(out,add(rig.head,mul(rig.up,.072)),[.108,.075,.103],basis,[.13,.15,.15]);
 const nose=add(rig.head,add(mul(rig.forward,.102),mul(rig.up,-.01)));
 ellipsoid(out,nose,[.022,.026,.025],basis,SKIN);
 for(const side of [-1,1])ellipsoid(out,add(rig.head,add(mul(rig.right,side*.041),add(mul(rig.up,.025),mul(rig.forward,.091)))),[.009,.008,.007],basis,BELT);
 for(const [side,arm] of Object.entries(rig.arms)){
  tube(out,arm.root,arm.joint,...BODY_SIZE.upperArm,color);ellipsoid(out,arm.root,[.081,.081,.081],basis,color);ellipsoid(out,arm.joint,[.067,.067,.067],basis,color);
  const cuff=add(arm.joint,mul(sub(arm.end,arm.joint),.82));tube(out,arm.joint,cuff,...BODY_SIZE.sleeve,color);
  tube(out,cuff,arm.end,...BODY_SIZE.wrist,SKIN);
  if(performer)tube(out,add(cuff,mul(unit(sub(arm.joint,cuff)),.012)),cuff,.049,.048,side==='right'?GOLD:[.42,.73,.83]);
  hand(out,arm,rig,grasps?.[side],side);
 }
}
function disk(out,center,rx,rz,color){for(let i=0;i<16;i++){const j=(i+1)%16;triangle(out,center,add(center,[circle[i][0]*rx,0,circle[i][1]*rz]),add(center,[circle[j][0]*rx,0,circle[j][1]*rz]),color);}}
function scene(pose,solo){
 const out=[],mat=[.25,.33,.32];
 triangle(out,[-2.8,-.006,-2.8],[2.8,-.006,-2.8],[2.8,-.006,2.8],mat);triangle(out,[-2.8,-.006,-2.8],[2.8,-.006,2.8],[-2.8,-.006,2.8],mat);
 for(let x=-2.5;x<=2.5;x+=.5){tube(out,[x,-.002,-2.5],[x,-.002,2.5],.002,.002,[.36,.43,.40],4);tube(out,[-2.5,-.002,x],[2.5,-.002,x],.002,.002,[.36,.43,.40],4);}
 for(const who of solo?['tori']:['tori','uke']){const rig=pose[who];disk(out,[rig.pelvis[0],.001,rig.pelvis[2]],.30,.38,[.20,.27,.27]);}
 // A gold sole ring distinguishes the working right foot from the supporting left.
 const r=pose.tori.legs.right.end;disk(out,[r[0],.004,r[2]],.09,.15,GOLD);
 person(out,pose.tori,WHITE,true,pose.grips);if(!solo){person(out,pose.uke,BLUE);
  const grasp=pose.grips?.left;if(grasp){
   const base=add(grasp.centre,mul(grasp.normal,.0585)),half=mul(grasp.axis,.032);
   ribbon(out,[sub(base,half),grasp.surface,add(base,half)],.027,grasp.normal,BLUE.map(v=>v*1.12));
  }
 }
 return new Float32Array(out);
}
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
export function createThrowRenderer(canvas){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});
 if(!gl)throw Error('WebGL unavailable');
 const program=gl.createProgram(),vs=shader(gl,gl.VERTEX_SHADER,`
 attribute vec3 position;attribute vec3 normal;attribute vec3 color;
 uniform vec3 cameraRight;uniform vec3 cameraUp;uniform vec3 cameraDepth;uniform vec2 scale;
 varying vec3 litColor;
 void main(){vec3 p=position-vec3(0.,.84,0.);gl_Position=vec4(dot(p,cameraRight)*scale.x,dot(p,cameraUp)*scale.y,-dot(p,cameraDepth)/8.,1.);
 float light=.63+.37*max(0.,dot(normalize(normal),normalize(vec3(-.4,.85,.6))));litColor=color*light;}`),fs=shader(gl,gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 litColor;void main(){gl_FragColor=vec4(litColor,1.);}`);
 gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const buffer=gl.createBuffer();gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 for(const [i,name] of ['position','normal','color'].entries()){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,36,i*12);}
 const uniforms=Object.fromEntries(['cameraRight','cameraUp','cameraDepth','scale'].map(n=>[n,gl.getUniformLocation(program,n)]));
 gl.enable(gl.DEPTH_TEST);gl.clearColor(.105,.15,.175,1);
 let current=null,data=null;
 return {
  draw(pose,{yaw=1.05,pitch=.22,solo=false}={}){
   const size=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,1.5),w=Math.max(1,Math.round(size.width*ratio)),h=Math.max(1,Math.round(size.height*ratio));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
   const key=pose.id+':'+pose.time+':'+solo;if(current!==key){data=scene(pose,solo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);current=key;}
   const depth=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)],right=[Math.cos(yaw),0,-Math.sin(yaw)],up=cross(depth,right);
   gl.uniform3fv(uniforms.cameraRight,right);gl.uniform3fv(uniforms.cameraUp,up);gl.uniform3fv(uniforms.cameraDepth,depth);
   const extent=Math.max(2.75,3.7*h/w);gl.uniform2f(uniforms.scale,2/(extent*w/h),2/extent);
   gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,data.length/9);
   canvas.dataset.time=pose.time.toFixed(4);canvas.dataset.technique=pose.id;canvas.dataset.solo=String(solo);
  },
  dispose(){gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);gl.getExtension('WEBGL_lose_context')?.loseContext();},
 };
}

export function drawFootMap(canvas,pose,labels){
 const ctx=canvas.getContext('2d');canvas.width=300;canvas.height=230;ctx.fillStyle='#ecebe1';ctx.fillRect(0,0,300,230);
 const point=p=>[150+p[0]*92,145-p[2]*70];
 ctx.strokeStyle='#b8bdb1';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(150,12);ctx.lineTo(150,218);ctx.stroke();ctx.setLineDash([]);
 for(const [who,color] of [['uke','#4c839e'],['tori','#383f3e']])for(const [side,leg] of Object.entries(pose[who].legs)){
  const [x,y]=point(leg.end);ctx.save();ctx.translate(x,y);ctx.rotate(pose[who].yaw);ctx.fillStyle=who==='tori'&&side==='right'?'#ad7429':color;
  ctx.globalAlpha=leg.end[1]>.12?.48:1;ctx.beginPath();ctx.ellipse(0,0,7,13,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.font='bold 11px sans-serif';ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(side==='right'?labels.right:labels.left,x+16,y+4);
 }
 ctx.fillStyle='#50594f';ctx.font='11px sans-serif';ctx.textAlign='left';ctx.fillText(labels.top,12,20);
 ctx.fillText(labels.lifted,12,215);
}
