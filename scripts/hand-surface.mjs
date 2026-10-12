import {handCapsules} from '../src/hand-rig.js';
let renderer;const sprites=new Map();
const vertex=`attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision highp float;
uniform vec4 boneA[15];uniform vec4 boneB[15];
uniform float handed;uniform float turn;uniform float glove;
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float ellipsoid(vec3 p,vec3 center,vec3 size){vec3 q=p-center;float a=length(q/size),b=length(q/(size*size));return a*(a-1.)/max(b,.00001);}
float capsule(vec3 p,vec3 a,vec3 b,float r){vec3 ab=b-a;return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.))-r;}
float shape(vec3 world){
 vec3 p=vec3(world.x*handed*turn,world.y,world.z*turn);
 float d=ellipsoid(p,vec3(-.001,-.041,-.002),vec3(.037,.055,.019));
 d=smin(d,ellipsoid(p,vec3(.024,-.026,-.016),vec3(.021,.036,.019)),.009);
 d=smin(d,ellipsoid(p,vec3(-.025,-.034,-.013),vec3(.016,.044,.015)),.007);
 // Skin envelope around a short wrist and the supplied ~24 cm forearm, not a thin shaft.
 float y=clamp(p.y,0.,.32),t=clamp(y/.242,0.,1.);
 float rx=mix(.025,.043,sin(t*1.5708)),rz=mix(.019,.034,sin(t*1.5708));
 vec3 q=vec3(p.x,p.y-y,p.z);
 float arm=(length(vec3(q.x/rx,q.y/rx,q.z/rz))-1.)*min(rx,rz);
 d=smin(d,arm,.011);
 for(int i=0;i<15;i++)d=smin(d,capsule(world,boneA[i].xyz,boneB[i].xyz,boneA[i].w),.0055);
 return d;
}
vec3 normalAt(vec3 p){vec2 e=vec2(.0004,0.);return normalize(vec3(shape(p+e.xyy)-shape(p-e.xyy),shape(p+e.yxy)-shape(p-e.yxy),shape(p+e.yyx)-shape(p-e.yyx)));}
void main(){
 vec2 uv=gl_FragCoord.xy/vec2(320.,640.);vec3 p=vec3((uv.x-.5)*.24,(1.-uv.y)*.48-.15,.24);
 float depth=0.;bool hit=false;
 for(int i=0;i<88;i++){float d=shape(p);if(d<.00022){hit=true;break;}p.z-=max(d*.85,.00018);depth+=d;if(depth>.5)break;}
 if(!hit){gl_FragColor=vec4(0.);return;}
 vec3 n=normalAt(p),light=normalize(vec3(-.5,-.65,1.));float diffuse=max(dot(n,light),0.);
 float occ=1.;for(int j=1;j<=3;j++){float h=float(j)*.003;occ-=max(0.,h-shape(p+n*h))*.07/h;}
 vec3 skin=mix(vec3(.71,.46,.30),vec3(.93,.71,.52),.45+diffuse*.4);
 vec3 base=mix(skin,vec3(.88,.94,.98),glove);
 vec3 color=base*(.53+.47*diffuse)*occ;
 color+=vec3(1.,.96,.88)*pow(max(dot(reflect(-light,n),vec3(0.,0.,1.)),0.),25.)*.1;
 // Broad palmar folds; no nails or joint marks on the translucent glove.
 vec3 local=vec3(p.x*handed*turn,p.y,p.z*turn);
 if(glove<.5&&local.z<-.017){
  float wrist=exp(-pow((local.y-.002+local.x*.05)/.0012,2.));
  float crease=exp(-pow((local.y+.039+local.x*.24)/.0011,2.));
  color*=1.-.10*max(wrist,crease)*(1.-smoothstep(.014,.028,abs(local.x)));
 }
 float alpha=glove>.5?1.-smoothstep(.13,.29,p.y):1.;
 gl_FragColor=vec4(color,alpha);
}`;
function init(){
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=640;
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:true,preserveDrawingBuffer:true});
 if(!gl)throw new Error('3D hand renderer requires WebGL');
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const location=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
 return {canvas,gl,program};
}
export function drawAnatomicalArm(ctx,wrist,angle,left,palmUp,ghost=false,mirrored=false){
 const key=`${left}/${palmUp}/${ghost}`;
 if(!sprites.has(key)){
  renderer??=init();const {canvas,gl,program}=renderer,segments=handCapsules(left,palmUp);
  gl.uniform4fv(gl.getUniformLocation(program,'boneA[0]'),new Float32Array(segments.flatMap(b=>[...b.a,b.r])));
  gl.uniform4fv(gl.getUniformLocation(program,'boneB[0]'),new Float32Array(segments.flatMap(b=>[...b.b,0])));
  gl.uniform1f(gl.getUniformLocation(program,'handed'),left?1:-1);gl.uniform1f(gl.getUniformLocation(program,'turn'),palmUp?-1:1);gl.uniform1f(gl.getUniformLocation(program,'glove'),ghost?1:0);
  gl.drawArrays(gl.TRIANGLES,0,6);
  const sprite=document.createElement('canvas');sprite.width=320;sprite.height=640;sprite.getContext('2d').drawImage(canvas,0,0);sprites.set(key,sprite);
 }
 ctx.save();ctx.translate(wrist.x,wrist.y);ctx.rotate(angle);if(mirrored)ctx.scale(-1,1);
 const scale=2.55;ctx.drawImage(sprites.get(key),-.12*scale,-.15*scale,.24*scale,.48*scale);ctx.restore();
}

export function renderedHandSprites(){return [...sprites.entries()].map(([key,canvas])=>({key,data:canvas.toDataURL('image/png')}))}
