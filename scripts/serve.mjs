import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {resolveRoute} from '../src/routes.js';
import baemilgiAPI from '../api/baemilgi.js';
import visitorsAPI from '../api/visitors.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path==='/api/baemilgi'){await baemilgiAPI(req,res);return;}
    if(path==='/api/visitors'){await visitorsAPI(req,res);return;}
    if(path.startsWith('/api/')){res.writeHead(404);res.end('Not found');return;}
    const base=path==='/dist'||path.startsWith('/dist/')?'/dist/':'/';
    const file=resolve(root,'.'+(resolveRoute(path,base)?base+'index.html':path));
    if(!file.startsWith(root.endsWith(sep)?root:root+sep)||path.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return}
    let data=await readFile(file);
    if(extname(file)==='.html'&&base==='/dist/')data=data.toString('utf8').replace('<base href="/" />','<base href="/dist/" />');
    res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found')}
});
const port=Number(process.env.PORT)||5173;
server.listen(port,'127.0.0.1',()=>console.log(`Just Judo: http://localhost:${port}`));
