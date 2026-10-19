// Render actual ribbon surfaces with a depth buffer; semantic painter layers are not used.
const bounds=[-.92,-.38,.92,.70];
// Match the illustrated judogi at belt height. A flat front clipping plane hid
// the side wraps before they reached the character's waist silhouette.
export function waistFrontDepth(x,y){
 const u=(x+.008)/.432;
 return Math.abs(u)<1&&y>-.34&&y<.36?-.225+.235*Math.sqrt(1-u*u):-Infinity;
}
// The hanging rear tails must also disappear behind the judogi skirt and legs.
// Dimensions follow drawBeltMannequin's .90 x / .76 y trouser transform.
export function bodyFrontDepth(x,y){
 const waist=waistFrontDepth(x,y);if(Number.isFinite(waist))return waist;
 const ax=Math.abs(x);
 if(y>=.36&&y<.70&&ax<.43)return .012;
 if(y>=.70&&y<2.25){const inner=.09*Math.min(1,(y-.66)/.25),outer=.414-.036*Math.max(0,(y-.93)/1.32);if(ax>inner&&ax<outer)return .005;}
 return -Infinity;
}
let renderer,softwareCanvas;
function createRenderer(){
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true});
 if(!gl)return null;
 const compile=(type,code)=>{const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
 const program=gl.createProgram();
 gl.attachShader(program,compile(gl.VERTEX_SHADER,`attribute vec3 position;attribute vec3 normal;attribute vec2 uv;uniform vec4 bounds;uniform float yaw;varying vec3 n;varying vec3 world;varying vec2 tex;
 void main(){float c=cos(yaw),s=sin(yaw);vec3 p=vec3(c*position.x+s*position.z,position.y,-s*position.x+c*position.z);world=p;n=vec3(c*normal.x+s*normal.z,normal.y,-s*normal.x+c*normal.z);tex=uv;gl_Position=vec4((p.x-bounds.x)/(bounds.z-bounds.x)*2.-1.,1.-(p.y-bounds.y)/(bounds.w-bounds.y)*2.,-p.z*.5,1.);}`));
 gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`precision mediump float;uniform float bodyOcclusion;varying vec3 n;varying vec3 world;varying vec2 tex;
 void main(){float u=(world.x+.008)/.432;float ax=abs(world.x);if(bodyOcclusion>.5){if(abs(u)<1.&&world.y>-.34&&world.y<.36&&world.z<-.225+.235*sqrt(max(0.,1.-u*u)))discard;if(world.y>=.36&&world.y<.70&&ax<.43&&world.z<.012)discard;float inner=.09*min(1.,(world.y-.66)/.25);float outer=.414-.036*max(0.,(world.y-.93)/1.32);if(world.y>=.70&&world.y<2.25&&ax>inner&&ax<outer&&world.z<.005)discard;}vec3 normal=normalize(n);if(!gl_FrontFacing)normal=-normal;float light=.48+.52*abs(dot(normal,normalize(vec3(-.35,-.65,1.))));float edge=smoothstep(.44,.5,abs(tex.x));float stitch=1.-smoothstep(.003,.012,abs(abs(tex.x)-.38));float weave=.012*sin(tex.y*1600.)*sin(tex.x*130.);vec3 color=vec3(.19,.20,.21)*light+vec3(.042)*stitch+weave;gl_FragColor=vec4(color*(1.-.34*edge),1.);}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 for(const [name,size,offset] of [['position',3,0],['normal',3,12],['uv',2,24]]){const at=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,32,offset)}
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
 return {canvas,gl,program,buffer,yaw:gl.getUniformLocation(program,'yaw'),bounds:gl.getUniformLocation(program,'bounds'),bodyOcclusion:gl.getUniformLocation(program,'bodyOcclusion')};
}
export function projectBeltPoint(point,yaw=0){return [Math.cos(yaw)*point[0]+Math.sin(yaw)*point[2],point[1]]}
export function drawBeltVolume(ctx,anchor,volume,{mirror=false,yaw=0,bodyOcclusion=true}={}){
 if(!Number.isFinite(anchor.scale)||anchor.scale<=0)return true; // A hidden lesson has no drawable viewport.
 const bounds=volume.source==='continuous-material-preparation'?[-1.5,-.85,1.5,3.15]:[-1.1,-.38,1.1,.70];
 if(renderer===undefined)renderer=createRenderer();if(!renderer){
 softwareCanvas??=document.createElement("canvas");softwareCanvas.width=552;softwareCanvas.height=324;const c=softwareCanvas.getContext("2d"),pixels=rasterVolume(volume.vertexData,552,324,yaw,bodyOcclusion,bounds);c.putImageData(new ImageData(pixels,552,324),0,0);ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(anchor.scale*(mirror?-1:1),anchor.scale);ctx.drawImage(softwareCanvas,bounds[0],bounds[1],bounds[2]-bounds[0],bounds[3]-bounds[1]);ctx.restore();return true;
 }
 const {canvas,gl}=renderer,ratio=Math.min(globalThis.devicePixelRatio||1,2),scale=Math.min(anchor.scale*ratio,900),w=Math.ceil((bounds[2]-bounds[0])*scale),h=Math.ceil((bounds[3]-bounds[1])*scale);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(renderer.program);gl.bindBuffer(gl.ARRAY_BUFFER,renderer.buffer);gl.bufferData(gl.ARRAY_BUFFER,volume.vertexData,gl.DYNAMIC_DRAW);gl.uniform4fv(renderer.bounds,bounds);gl.uniform1f(renderer.yaw,yaw);gl.uniform1f(renderer.bodyOcclusion,bodyOcclusion?1:0);gl.drawArrays(gl.TRIANGLES,0,volume.vertexData.length/8);
 ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(anchor.scale*(mirror?-1:1),anchor.scale);ctx.drawImage(canvas,bounds[0],bounds[1],bounds[2]-bounds[0],bounds[3]-bounds[1]);ctx.restore();return true;
}

// Same 3D depth test on devices without WebGL; no painter-order fallback.
export function rasterVolume(data,w,h,yaw=0,bodyOcclusion=false,viewport=bounds){
 const bounds=viewport;
 const pixels=new Uint8ClampedArray(w*h*4),depth=new Float32Array(w*h).fill(-Infinity),c=Math.cos(yaw),s=Math.sin(yaw),project=i=>{const x=c*data[i]+s*data[i+2],y=data[i+1],z=-s*data[i]+c*data[i+2];return [(x-bounds[0])/(bounds[2]-bounds[0])*w,(y-bounds[1])/(bounds[3]-bounds[1])*h,z]};
 for(let i=0;i<data.length;i+=24){
  const a=project(i),b=project(i+8),d=project(i+16),den=(b[1]-d[1])*(a[0]-d[0])+(d[0]-b[0])*(a[1]-d[1]);if(Math.abs(den)<1e-8)continue;
  const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],d[0]))),x1=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],d[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],d[1]))),y1=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],d[1])));
  const nx=c*data[i+3]+s*data[i+5],ny=data[i+4],nz=-s*data[i+3]+c*data[i+5],light=.48+.52*Math.abs((-.35*nx-.65*ny+nz)/1.243),color=[.19,.20,.21].map(v=>255*v*light);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const u=((b[1]-d[1])*(x+.5-d[0])+(d[0]-b[0])*(y+.5-d[1]))/den,v=((d[1]-a[1])*(x+.5-d[0])+(a[0]-d[0])*(y+.5-d[1]))/den,r=1-u-v;if(u<0||v<0||r<0)continue;const z=u*a[2]+v*b[2]+r*d[2],worldX=bounds[0]+(x+.5)/w*(bounds[2]-bounds[0]),worldY=bounds[1]+(y+.5)/h*(bounds[3]-bounds[1]),j=y*w+x;if(bodyOcclusion&&z<bodyFrontDepth(worldX,worldY)||z<=depth[j])continue;depth[j]=z;pixels[j*4]=color[0];pixels[j*4+1]=color[1];pixels[j*4+2]=color[2];pixels[j*4+3]=255;}
 }return pixels;
}
