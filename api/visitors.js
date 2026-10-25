// Read Vercel's cumulative production Visitors metric. Never maintain a second counter.
export function analyticsURL(env=process.env){
  const project=env.VERCEL_ANALYTICS_PROJECT_ID||env.VERCEL_PROJECT_ID;
  if(!project||!env.VERCEL_ANALYTICS_TOKEN)throw Object.assign(new Error('analytics_not_configured'),{status:503});
  const url=new URL('https://api.vercel.com/v1/query/web-analytics/visits/count');
  url.searchParams.set('projectId',project);
  if(env.VERCEL_ANALYTICS_TEAM_ID)url.searchParams.set('teamId',env.VERCEL_ANALYTICS_TEAM_ID);
  // No since/until: count since Web Analytics was enabled, rather than a reporting window.
  return url;
}
export function parseVisitors(payload){
  const total=payload?.data?.visitors;
  if(!Number.isSafeInteger(total)||total<0)throw new Error('invalid_analytics_response');
  return {total,source:'vercel',metric:'visitors',period:'all-time',since:payload.query?.since??null,until:payload.query?.until??null};
}
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
  if(req.method!=='GET'){res.setHeader('Allow','GET');return send(405,{error:'method'});}
  try{
    const url=analyticsURL();
    const response=await fetch(url,{headers:{Authorization:`Bearer ${process.env.VERCEL_ANALYTICS_TOKEN}`},signal:AbortSignal.timeout(10000)});
    if(!response.ok)return send(503,{error:response.status===401||response.status===403?'analytics_access_denied':'analytics_unavailable'});
    const result=parseVisitors(await response.json());
    res.setHeader('Cache-Control','public, max-age=0, s-maxage=300, stale-while-revalidate=60');
    send(200,result);
  }catch(error){send(503,{error:error.message==='analytics_not_configured'?'analytics_not_configured':'analytics_unavailable'});}
}
