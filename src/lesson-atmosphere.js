// Ambient layer stays behind the lesson; it never changes camera or canvas geometry.
const scene=document.createElement('div');scene.className='scene lesson-atmosphere';scene.setAttribute('aria-hidden','true');document.body.prepend(scene);
await import('../design/ink-shader.js');
let frame=0,last=0,time=0;const pointer={x:-9999,y:-9999};
function tick(now){if(document.hidden)return;frame=requestAnimationFrame(tick);if(now-last<66)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;time+=dt;window.inkShader?.draw(time,pointer,.62,true);}
function resume(){cancelAnimationFrame(frame);last=0;if(!document.hidden)frame=requestAnimationFrame(tick);}
document.addEventListener('visibilitychange',resume);window.addEventListener('pageshow',resume);window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));
window.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;pointer.x=event.clientX;pointer.y=event.clientY;},{passive:true});
resume();
