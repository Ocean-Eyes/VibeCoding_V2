import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {resolveRoute} from '../src/routes.js';
import baemilgiAPI from '../api/baemilgi.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webm':'video/webm'};
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path==='/api/baemilgi'){await baemilgiAPI(req,res);return;}
    if(path.startsWith('/api/')){res.writeHead(404);res.end('Not found');return;}
    const base=path==='/dist'||path.startsWith('/dist/')?'/dist/':'/';
    const file=resolve(root,'.'+(resolveRoute(path,base)?base+'index.html':path));
    if(!file.startsWith(root.endsWith(sep)?root:root+sep)||path.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return}
    let data=await readFile(file);
    if(extname(file)==='.webm'){
      const headers={'Content-Type':'video/webm','Accept-Ranges':'bytes','Cache-Control':'no-store'};
      if(req.headers.range){
        const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
        const start=Number(match?.[1]),end=match?.[2]?Math.min(Number(match[2]),data.length-1):data.length-1;
        if(!match||!Number.isSafeInteger(start)||start>end){res.writeHead(416,{...headers,'Content-Range':`bytes */${data.length}`});res.end();return;}
        res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});res.end(data.subarray(start,end+1));return;
      }
      res.writeHead(200,{...headers,'Content-Length':data.length});res.end(data);return;
    }
    if(extname(file)==='.html'&&base==='/dist/')data=data.toString('utf8').replace('<base href="/" />','<base href="/dist/" />');
    res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found')}
});
const port=Number(process.env.PORT)||5173;
server.listen(port,'127.0.0.1',()=>console.log(`Just Judo: http://localhost:${port}`));
