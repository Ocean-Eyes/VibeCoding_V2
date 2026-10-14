export const BELT_SOURCE='https://www.britishjudo.org.uk/wp-content/uploads/2024/10/JudoKids-1st-Sho-Syllabus.pdf#page=4';
export const BELT_STEPS=[
 {title:'가운데를 배꼽에',cue:'띠의 가운데를 배꼽 앞에 대고 양끝 길이를 맞춥니다.',focus:'가운데 표시를 배꼽 앞에 맞추세요.'},
 {title:'등 뒤로 감기',cue:'양끝을 허리 뒤로 보내 교차한 뒤, 다시 앞으로 가져옵니다.',focus:'점선은 몸 뒤로 지나가는 띠입니다.'},
 {title:'앞에서 겹치기',cue:'앞으로 나온 양끝을 겹칩니다. 허리에 감긴 띠가 꼬이지 않았는지 확인하세요.',focus:'A 끝이 B 끝 위를 가로지릅니다.'},
 {title:'두 겹 밑으로 통과',cue:'A 끝을 허리에 감긴 띠 두 겹 모두의 아래로 넣고, 몸과 띠 사이로 위로 빼냅니다.',focus:'한 겹만 통과하지 않도록 확대 그림을 보세요.'},
 {title:'첫 조임',cue:'양끝을 당겨 허리 둘레를 정리합니다. A는 위쪽, B는 아래쪽에 둡니다.',focus:'두 겹을 함께 감싸는 첫 교차를 만듭니다.'},
 {title:'고리로 통과시키기',cue:'위쪽 A 끝을 B 위로 접고, 만들어진 고리 안으로 통과시킵니다.',focus:'접은 끝이 고리 안을 지나도록 확인하세요.'},
 {title:'양옆으로 조여 완성',cue:'양끝을 좌우로 당겨 평매듭을 조이고, 남은 양끝의 길이를 맞춥니다.',focus:'납작한 매듭과 가지런한 양끝을 확인하세요.'},
];
const poses=[
 {wrap:0,a:[[0,0],[-.18,0],[-.4,.01],[-.7,.03],[-.9,.12],[-.94,.4],[-.95,.72]],b:[[0,0],[.18,0],[.4,.01],[.7,.03],[.9,.12],[.94,.4],[.95,.72]]},
 {wrap:.5,a:[[0,0],[-.15,.04],[-.38,.09],[-.58,.16],[-.69,.26],[-.73,.47],[-.72,.68]],b:[[0,0],[.15,.04],[.38,.09],[.58,.16],[.69,.26],[.73,.47],[.72,.68]]},
 {wrap:1,a:[[0,0],[.13,.05],[.24,.15],[.27,.3],[.29,.45],[.31,.6],[.33,.76]],b:[[0,0],[-.13,.05],[-.24,.15],[-.27,.3],[-.29,.45],[-.31,.6],[-.33,.76]]},
 {wrap:1,a:[[0,0],[.13,.09],[.20,.22],[.06,.26],[-.04,.1],[.04,-.18],[.32,-.55]],b:[[0,0],[-.12,.04],[-.22,.12],[-.24,.28],[-.26,.44],[-.29,.59],[-.32,.74]]},
 {wrap:1,a:[[0,0],[.08,.02],[.13,-.05],[.23,-.17],[.37,-.23],[.53,-.3],[.72,-.33]],b:[[0,0],[-.09,.03],[-.19,.12],[-.32,.21],[-.47,.3],[-.61,.37],[-.72,.4]]},
 {wrap:1,a:[[0,0],[.12,-.12],[.36,-.07],[.36,.18],[.05,.24],[-.18,.11],[-.52,.37]],b:[[0,0],[-.12,.06],[-.16,.21],[.02,.1],[.2,.06],[.42,.19],[.63,.38]]},
 {wrap:1,a:[[0,0],[.11,-.05],[.19,.03],[.12,.14],[-.1,.1],[-.31,.28],[-.61,.48]],b:[[0,0],[-.11,.02],[-.19,.12],[-.08,.16],[.1,.05],[.31,.28],[.61,.48]]},
];
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export function beltPose(step,progress=1){
 step=Math.max(0,Math.min(BELT_STEPS.length-1,Math.floor(step)));const a=poses[Math.max(0,step-1)],b=poses[step],u=ease(progress);
 const wrap=a.wrap+(b.wrap-a.wrap)*u,angle=wrap*Math.PI*2;
 const tail=(key,index)=>{const x=(index?1:-1)*.51*Math.sin(angle),y=(index?.026:-.026)*wrap-.09*(1-Math.cos(angle));return b[key].map((p,i)=>p.map((v,k)=>(u===1?v:u===0?a[key][i][k]:a[key][i][k]+(v-a[key][i][k])*u)+(k?y:x)))};
 return {step,wrap,a:tail('a',0),b:tail('b',1)};
}
export function beltAnchor(width,height,vertical=58,size=32){return {x:width*.5,y:height*vertical/100,scale:width*size/100}}
function curve(ctx,points){
 ctx.beginPath();ctx.moveTo(...points[0]);
 for(let i=0;i<points.length-1;i++){
  const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
  ctx.bezierCurveTo(b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6,c[0]-(d[0]-b[0])/6,c[1]-(d[1]-b[1])/6,...c);
 }
}
function ribbon(ctx,points,color,behind=false){
 if(points.length<2)return;
 ctx.save();ctx.lineJoin='round';ctx.lineCap='butt';ctx.setLineDash(behind?[.045,.035]:[]);
 curve(ctx,points);ctx.strokeStyle=behind?'#e1ecf079':'#253c4980';ctx.lineWidth=.099;ctx.stroke();
 if(!behind){ctx.strokeStyle=color;ctx.lineWidth=.09;ctx.stroke();ctx.strokeStyle='#f8fcf4eb';ctx.lineWidth=.071;ctx.stroke();ctx.setLineDash([.015,.022]);ctx.strokeStyle='#6a87994d';ctx.lineWidth=.006;ctx.stroke()}
 ctx.restore();
}
export function drawGhostBelt(ctx,anchor,pose,{mirror=true,opacity=.86,labels=true}={}){
 const sign=mirror?1:-1;
 ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(anchor.scale*sign,anchor.scale);ctx.globalAlpha=opacity;
 // Each half starts at the shared midpoint, wraps around the waist and rejoins
 // its own free end. Front/back runs are authored separately for clear occlusion.
 for(const [index,key]of ['a','b'].entries()){
  const side=index?1:-1,color=index?'#e0bb78':'#91cee6';let run=[],behind=false;
  for(let n=0;n<=100;n++){
   const angle=pose.wrap*Math.PI*2*n/100,z=Math.cos(angle),p=[side*.51*Math.sin(angle),(index?.026:-.026)*pose.wrap-.09*(1-z)];
   const back=z<0;
   if(n&&back!==behind){run.push(p);ribbon(ctx,run,color,behind);run=[p]}
   else run.push(p);
   behind=back;
  }
  if(pose.wrap>.001)ribbon(ctx,run,color,behind);
 }
 // B lies beneath A at the first crossing. The inserted A section is masked
 // by both waist layers, and reappears above them rather than over the cloth.
 ribbon(ctx,pose.b,'#e0bb78',pose.step===1);
 ribbon(ctx,pose.a,'#91cee6',pose.step===1);
 if(pose.step===3){
  for(const y of [-.026,.026])ribbon(ctx,[[-.3,y],[0,y],[.3,y]],'#d5e6e8');
  ribbon(ctx,pose.a.slice(4),'#91cee6');
  ctx.save();ctx.setLineDash([.022,.022]);curve(ctx,pose.a.slice(3,6));ctx.strokeStyle='#72bbdce0';ctx.lineWidth=.014;ctx.stroke();ctx.restore();
 }
 if(pose.step>=5){
  // Repaint the short upper B bridge to show the alternating over/under knot.
  ribbon(ctx,pose.b.slice(2,5),'#e0bb78');
 }
 ctx.restore();
 if(labels){
  for(const [key,label,color]of [['a','A','#a7dcef'],['b','B','#ebcb93']]){
   const p=pose[key].at(-1),x=anchor.x+p[0]*anchor.scale*sign,y=anchor.y+p[1]*anchor.scale;
   ctx.save();ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fillStyle='#20313b';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 12px sans-serif';ctx.fillText(label,x,y);ctx.restore();
  }
 }
}
