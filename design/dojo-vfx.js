// Shared with the existing dust animation: one frame loop, no extra renderer.
(() => {
  let enabled = true;
  let strokes = [], waves = [], elapsed = 0, accent = 0;
  const scene = document.querySelector('.scene');
  const position = element => {
    const a = element.getBoundingClientRect(), b = scene.getBoundingClientRect();
    return {x:a.left-b.left+a.width*.45,y:a.top-b.top+a.height*.5};
  };
  document.addEventListener('click', event => {
    if (!enabled) return;
    const button = event.target.closest('button');
    if (!button) return;
    if (button.matches('[data-course], [data-lesson]')) {
      accent = 1;
      strokes.push({...position(button),age:0});
      strokes = strokes.slice(-3);
    }
    if (button.id === 'start' || button.id === 'switch-view') {
      waves.push({age:0});
      waves = waves.slice(-2);
      const preview = document.querySelector('.preview');
      preview?.getAnimations().forEach(a=>a.cancel());
      preview?.animate([
        {boxShadow:'inset 0 0 60px rgba(193,131,77,.18)'},
        {boxShadow:'inset 0 0 100px rgba(193,131,77,0)'}
      ], {duration:850,easing:'ease-out'});
    }
  });
  function draw(ctx,w,h,dt,particles) {
    if (enabled) elapsed += dt;
    accent=Math.max(0,accent-dt*.85);
    ctx.save();
    // Backlit brushwork, built from irregular fibres rather than a perfect circle.
    // It is a graphic ink gesture, not a person or a technique demonstration.
    const cx=w*.755,cy=h*.395,r=Math.min(w*.235,h*.20);
    const inkOpacity=w<=800?.12:1;
    const rotation=-.23+elapsed*.13;
    ctx.save();ctx.globalAlpha=inkOpacity;ctx.translate(cx,cy);ctx.rotate(rotation);
    const halo=ctx.createRadialGradient(-r*.4,-r*.4,r*.1,0,0,r*1.6);
    halo.addColorStop(0,`rgba(167,157,134,${.12+accent*.045})`);
    halo.addColorStop(.55,'rgba(112,129,132,.035)');halo.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=halo;ctx.fillRect(-r*1.7,-r*1.7,r*3.4,r*3.4);
    function brushPath(offset,start=.18,end=6.10){
      ctx.beginPath();
      for(let i=0;i<=100;i++){
        const a=start+(end-start)*i/100,t=i/100;
        const taper=Math.sin(Math.PI*t)**.34;
        const radius=r+offset*taper+Math.sin(a*7+offset*.12+elapsed*.6)*4*taper+Math.sin(a*19+offset+elapsed*.9)*1.5*taper;
        const x=Math.cos(a)*radius,y=Math.sin(a)*radius*.91;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
    }
    ctx.lineCap='round';
    ctx.beginPath();
    for(const direction of [1,-1])for(let step=0;step<=100;step++){
      const t=direction===1?step/100:1-step/100,a=.18+t*5.92;
      const width=r*.085*Math.sin(Math.PI*t)**.45;
      const radius=r+direction*width+Math.sin(a*17)*2*Math.sin(Math.PI*t);
      const x=Math.cos(a)*radius,y=Math.sin(a)*radius*.91;
      direction===1&&step===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.fillStyle='rgba(4,7,9,.82)';ctx.fill();
    const rim=ctx.createLinearGradient(-r,-r,r,r);
    rim.addColorStop(0,'rgba(220,207,176,.54)');rim.addColorStop(.35,'rgba(158,170,167,.22)');
    rim.addColorStop(.65,'rgba(50,62,66,.15)');rim.addColorStop(1,'rgba(182,119,76,.38)');
    for(let strand=0;strand<23;strand++){
      const offset=(strand-11)*r*.007;
      brushPath(offset,.18,6.10);
      ctx.strokeStyle=rim;ctx.globalAlpha=(.12+(strand%5)*.09)*inkOpacity;
      ctx.lineWidth=strand%6===0?1.5:.5;ctx.stroke();
    }
    ctx.globalAlpha=.6*inkOpacity;
    brushPath(-r*.082,.68,3.9);ctx.lineWidth=.65;ctx.strokeStyle=rim;ctx.stroke();
    ctx.restore();
    // Long soft shafts from the upper right, kept behind all text.
    for(let ray=0;ray<3;ray++){
      const shift=Math.sin(elapsed*.18+ray)*w*.025;
      const x=w*(.91+ray*.035)+shift;
      const light=ctx.createLinearGradient(x,-50,w*.46,h);
      light.addColorStop(0,'rgba(202,196,174,.006)');light.addColorStop(.7,'rgba(157,170,170,.002)');light.addColorStop(1,'rgba(157,170,170,0)');
      ctx.fillStyle=light;
      for(let feather=0;feather<9;feather++){
        const inset=feather*.006*w;
        ctx.beginPath();ctx.moveTo(x+inset*.2,-50);ctx.lineTo(x+w*.025-inset*.2,-50);ctx.lineTo(w*(.47+ray*.065)-inset,h);ctx.lineTo(w*(.31+ray*.065)+inset,h);ctx.closePath();ctx.fill();
      }
    }
    // Low drifting haze, lit from the right: soft layers instead of a flat overlay.
    for (let i=0;i<5;i++) {
      const x=w*(.38+i*.13)+Math.sin(elapsed*.20+i*1.7)*w*.11;
      const y=h*(.56+i*.045)+Math.cos(elapsed*.16+i)*h*.055;
      ctx.save();ctx.translate(x,y);ctx.scale(1,.20+i*.025);
      const radius=w*(.28+i*.025),fog=ctx.createRadialGradient(0,0,0,0,0,radius);
      fog.addColorStop(0,`rgba(159,169,167,${.050+i*.005})`);
      fog.addColorStop(.45,'rgba(123,146,151,.012)');fog.addColorStop(1,'rgba(123,146,151,0)');
      ctx.fillStyle=fog;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    // The tatami plane is only suggested by distant seams and a warm edge light.
    const horizon=h*.72,vanishX=w*.70;
    ctx.lineWidth=.6;ctx.strokeStyle='rgba(168,155,125,.07)';
    for(let i=-4;i<=5;i++) {
      ctx.beginPath();ctx.moveTo(vanishX+i*w*.018,horizon);ctx.lineTo(vanishX+i*w*.22,h);ctx.stroke();
    }
    for(const depth of [.10,.24,.49,.85]) {
      const y=horizon+(h-horizon)*depth;
      ctx.beginPath();ctx.moveTo(w*.3,y);ctx.lineTo(w,y);ctx.stroke();
    }
    if (enabled) {
      // Each selection draws a tapered, imperfect brush gesture then lets it disperse.
      for(const s of strokes) {
        s.age+=dt;const progress=Math.min(1,s.age/.30),fade=Math.pow(Math.max(0,1-s.age/1.15),2);
        for(let strand=0;strand<7;strand++) {
          ctx.beginPath();ctx.strokeStyle=`rgba(212,166,116,${fade*(strand===3?.28:.09)})`;
          ctx.lineWidth=strand===3?1.2:.5;
          const startX=s.x-115,startY=s.y+23+(strand-3)*1.7;
          ctx.moveTo(startX,startY);
          ctx.quadraticCurveTo(startX+100*progress,startY-12*progress,startX+330*progress,startY-23*progress+strand*.5);
          ctx.stroke();
        }
        // Stir the existing dust, rather than generating sparks or extra particles.
        for(const p of particles) {
          const distance=Math.hypot(p.x-s.x,p.y-s.y);
          if(distance<240){const gust=(1-distance/240)*fade*dt;p.dx+=gust*75;p.dy-=gust*18;}
        }
      }
      for(const wave of waves) {
        wave.age+=dt;const t=Math.min(1,wave.age/.9),radius=(.05+.43*(1-(1-t)**3))*w;
        ctx.strokeStyle=`rgba(220,183,132,${.17*(1-t)**2})`;ctx.lineWidth=1;
        ctx.beginPath();ctx.ellipse(w*.72,h*.82,radius,radius*.17,0,0,Math.PI*2);ctx.stroke();
      }
    }
    strokes=strokes.filter(s=>s.age<1.15);waves=waves.filter(w=>w.age<.9);
    ctx.restore();
    scene.dataset.vfxStrokes=String(strokes.length);
    scene.dataset.vfxTime=elapsed.toFixed(3);
  }
  window.dojoVfx={draw,setEnabled(value){enabled=value;if(!value){strokes=[];waves=[];accent=0;document.querySelector('.preview')?.getAnimations().forEach(a=>a.cancel());}}};
})();
