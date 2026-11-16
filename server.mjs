import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {api,getWeather,telemetry} from './api.mjs';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const port=Number(process.env.PORT||8791);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.webp':'image/webp'};
// Each stream contains only the virtual positions supplied by its own browser.
const streams=new Map();
const gzCache=new Map();
async function tick(){const cache=await getWeather();for(const [res,people]of streams){try{res.write('data: '+JSON.stringify(telemetry(cache,people))+'\n\n');}catch{streams.delete(res);}}}
const service=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost:'+port);
 if(url.pathname==='/api/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,sse:true,backgroundIntervalSeconds:5}));return;}
 if(url.pathname==='/api/events'){
  let people;try{people=JSON.parse(url.searchParams.get('people')||'[]');telemetry(null,people);}catch{res.writeHead(400).end('Invalid people');return;}
  res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write(': connected\n\n');streams.set(res,people);req.on('close',()=>streams.delete(res));void tick();return;
 }
 if(url.pathname.startsWith('/api/')){
  const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>16000){res.writeHead(413).end();return;}chunks.push(c);}
  const body=Buffer.concat(chunks);const r=await api(new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}: {})}),process.env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 const requested=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
 const file=path.resolve(root,'.'+requested);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await readFile(file);const ext=path.extname(file);
 const headers={'content-type':types[ext]||'application/octet-stream','cache-control':/^\/(assets|rag|partner)\//.test(requested)?'public, max-age=86400':'no-cache'};
 let body=bytes;
 if(['.js','.json','.css','.html','.geojson'].includes(ext)&&(req.headers['accept-encoding']||'').includes('gzip')){const st=await stat(file);let c=gzCache.get(file);if(!c||c.m!==st.mtimeMs){c={m:st.mtimeMs,b:gzipSync(bytes)};gzCache.set(file,c);}body=c.b;headers['content-encoding']='gzip';headers['vary']='accept-encoding';}
 res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404).end('Not found');}
});
service.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
const timer=setInterval(()=>void tick(),5000);timer.unref();void getWeather();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);for(const r of streams.keys())r.end();service.close(()=>process.exit(0));});
