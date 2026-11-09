// Original GLSL atmosphere. OGL supplies the fullscreen GPU rendering primitives.
import {Renderer,Program,Triangle,Mesh} from './ogl.js';

const vertex=`
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position,0.0,1.0);}`;
const fragment=`
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uAspect;
uniform vec2 uMouse;
uniform float uInfluence;
uniform float uLight;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
float fbm(vec2 p){float v=0.0,a=.5;mat2 turn=mat2(.8,-.6,.6,.8);for(int i=0;i<5;i++){v+=a*noise(p);p=turn*p*2.03+vec2(2.7,7.3);a*=.5;}return v;}
void main(){
 vec2 uv=vUv,aspect=vec2(uAspect,1.0);
 float t=uTime*.22;
 vec2 d=(uv-uMouse)*aspect;
 float influence=exp(-dot(d,d)*9.0)*uInfluence;
 vec2 p=uv*aspect*2.65;
 p+=vec2(-d.y,d.x)*influence*1.85;
 p+=normalize(d+vec2(.001))*influence*.14;
 // Large turbulent advection carries smaller wisps at a different depth.
 vec2 warp=vec2(fbm(p*.78+vec2(-t*.6,t*.25)),fbm(p*.72+vec2(4.2,t*.45)));
 float body=fbm(p+warp*2.8+vec2(-t*.65,t*.35));
 float detail=noise(p*10.0+warp*13.0+vec2(-t,t*.7));
 float density=smoothstep(.25,.78,body);
 float folds=pow(max(0.0,1.0-abs(body-.52)*7.0),5.0);
 float veil=pow(density,1.8)*(.6+.4*detail);
 float right=smoothstep(.10,.72,uv.x);
 float shaft=exp(-pow((uv.x+uv.y*.30-uLight-.28)*2.5,2.0));
 vec3 cool=vec3(.24,.28,.29),warm=vec3(.29,.25,.20);
 vec3 smoke=mix(cool,warm,smoothstep(.25,.85,warp.y)*.40);
 vec3 color=vec3(.88,.87,.83);
 color-=smoke*veil*right*(.65+shaft*.45);
 color-=vec3(.20,.23,.23)*folds*right*.20;
 color+=vec3(.05,.055,.06)*influence*veil*.25;
 // Preserve the dark left menu and readable fixed calligraphy.
 float vignette=1.0-smoothstep(.30,.90,length((uv-.52)*vec2(.85,1.0)));
 color*=.92+.08*vignette;
 gl_FragColor=vec4(color,1.0);
}`;

const scene=document.querySelector('.scene');
const canvas=document.createElement('canvas');canvas.id='ink-fluid';canvas.setAttribute('aria-hidden','true');
canvas.style.zIndex='-3';scene.prepend(canvas);
let renderer,program,geometry,mesh,lost=false,previous=-1;
const mouse=new Float32Array([.72,.55]);
function setup(){
 renderer=new Renderer({canvas,dpr:1,alpha:false,depth:false,antialias:false,webgl:1,powerPreference:'low-power'});
 const gl=renderer.gl;if(!gl)throw Error('WebGL unavailable');
 program=new Program(gl,{vertex,fragment,depthTest:false,depthWrite:false,cullFace:null,uniforms:{uTime:{value:0},uAspect:{value:1},uMouse:{value:mouse},uInfluence:{value:0},uLight:{value:.62}}});
 if(!gl.getProgramParameter(program.program,gl.LINK_STATUS))throw Error('Shader link failed');
 geometry=new Triangle(gl);mesh=new Mesh(gl,{geometry,program});
 resize();scene.dataset.shader='ready';
}
function resize(){
 if(!renderer||lost)return;
 const box=scene.getBoundingClientRect(),scale=Math.min(1,1000/box.width,650/box.height);
 renderer.setSize(Math.max(1,Math.round(box.width*scale)),Math.max(1,Math.round(box.height*scale)));
 // Renderer sets pixel CSS sizes; the canvas must still fill the scene.
 canvas.style.width='100%';canvas.style.height='100%';program.uniforms.uAspect.value=box.width/box.height;
 renderer.render({scene:mesh});
}
try{
 setup();const observer=new ResizeObserver(resize);observer.observe(scene);
 window.inkShader={draw(time,pointer,light,running){
  if(lost)return;
  const dt=previous<0?0:Math.min(.1,Math.max(0,time-previous));previous=time;
  if(running){
   const box=scene.getBoundingClientRect(),inside=pointer.x>=0&&pointer.x<=box.width&&pointer.y>=0&&pointer.y<=box.height;
   const blend=1-Math.exp(-dt*7);
   if(inside){mouse[0]+=(pointer.x/box.width-mouse[0])*blend;mouse[1]+=(1-pointer.y/box.height-mouse[1])*blend;}
   program.uniforms.uInfluence.value+=((inside?1:0)-program.uniforms.uInfluence.value)*blend;
  }
  program.uniforms.uTime.value=time;program.uniforms.uLight.value=light;
  renderer.render({scene:mesh});canvas.dataset.time=time.toFixed(3);
 }};
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;canvas.style.visibility='hidden';scene.dataset.shader='fallback';});
 canvas.addEventListener('webglcontextrestored',()=>{try{lost=false;setup();canvas.style.visibility='visible';}catch{lost=true;scene.dataset.shader='fallback';}});
 window.addEventListener('pagehide',event=>{if(event.persisted)return;observer.disconnect();geometry?.remove();program?.remove();});
}catch{
 canvas.remove();scene.dataset.shader='fallback';
}
