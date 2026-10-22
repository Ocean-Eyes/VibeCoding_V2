// Hand-authored side-view joint positions, in a 1000 × 700 camera frame.
// These exercise inference boundaries; they are not recordings of real people.
export const dimensions={width:1000,height:700};
const positions={
 low:[[300,300],[330,350],[280,380],[530,330],[650,365],[790,380]],
 up:[[320,170],[300,270],[280,380],[510,325],[650,365],[790,380]],
 standing:[[520,140],[530,250],[530,355],[520,330],[520,475],[520,620]],
 kneeling:[[380,230],[350,305],[310,380],[520,340],[540,380],[700,380]],
 plank:[[300,210],[290,290],[280,380],[510,270],[650,330],[790,380]],
};
export function pose(name,{mirror=false,scale=1,offsetX=0,offsetY=0,visibility=.99}={}){
 const result=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
 const coords=positions[name];if(!coords)throw new Error(name);
 for(const [j,index] of [11,13,15,23,25,27].entries()){
  const [x,y]=coords[j];const point={x:(mirror?1000-x:x)/1000,y:y/700,z:0,visibility};
  result[index]={...point,x:(point.x-.5)*scale+.5+offsetX,y:(point.y-.5)*scale+.5+offsetY};
  result[index+1]={...result[index],x:result[index].x+.008*scale,visibility:Math.min(visibility,.85)};
 }
 return result;
}
export function mix(a,b,amount){return a.map((p,i)=>({...p,x:p.x+(b[i].x-p.x)*amount,y:p.y+(b[i].y-p.y)*amount}));}
