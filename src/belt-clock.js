// The one rapid passage gets +0.817 seconds, not a longer whole lesson.
export const SLOW_PASSAGE={from:10.65,to:11,rate:.3};
export function clockSegments(interval,step){
 const span=interval.to-interval.from,baseRate=step===4||step===5?.65:1;
 if(!span)return [{from:0,to:1,sourceFrom:interval.from,sourceTo:interval.to,duration:1200,hold:0,rate:baseRate}];
 const knots=new Set([interval.from,interval.to,...interval.holds]);
 for(const value of [SLOW_PASSAGE.from,SLOW_PASSAGE.to])if(value>interval.from&&value<interval.to)knots.add(value);
 const sorted=[...knots].sort((a,b)=>a-b),segments=[];
 for(let i=1;i<sorted.length;i++){
  const a=sorted[i-1],b=sorted[i],middle=(a+b)/2,rate=middle>=SLOW_PASSAGE.from&&middle<SLOW_PASSAGE.to?SLOW_PASSAGE.rate:baseRate;
  segments.push({from:(a-interval.from)/span,to:(b-interval.from)/span,sourceFrom:a,sourceTo:b,duration:(b-a)*1000/rate,hold:interval.holds.includes(b)?950:0,rate});
 }
 return segments;
}
