import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as T from '../public/assets/three.module.js';
// Geometry-only audit: no browser, renderer, network, or user data.
globalThis.ProgressEvent=class {constructor(type,props){Object.assign(this,{type},props);}};
globalThis.fetch=async input=>{let u=input?.url||String(input);if(u.startsWith('file:')){const bytes=await readFile(fileURLToPath(u));return new Response(bytes,{headers:{'content-length':String(bytes.length)}});}throw Error('Network disabled for audit: '+u);};
const {loadPartnerScene}=await import('../public/partner-scene.js');
const started=performance.now(),p=await loadPartnerScene();
if(p.errors.length)throw Error('Missing landmarks: '+JSON.stringify(p.errors));
if(!p.rows.length||!p.shade.count)throw Error('Missing walk network or occlusion geometry');
const samples=[];for(const row of p.rows.filter((_,i)=>i%80===0))for(const c of row.c.slice(0,1)){const pos=[(c[0]-120.142)*96400/40,p.height(...c),(30.248-c[1])*111320/40];const time=Date.parse('2026-06-21T12:00:00+08:00');const s=p.shade.sample(pos,time);samples.push({c,shade:s.shade});}
const components=new Map();for(const n of p.network.nodes)components.set(n.component,(components.get(n.component)||0)+1);
const checkpoints=[['断桥南端',120.1466496,30.2604573],['断桥北端',120.1474111,30.2613444],['苏堤北端',120.1308621,30.2539615],['苏堤南端',120.1397001,30.2309416]];
const anchors=checkpoints.map(([name,lon,lat])=>({name,...p.network.snap(p.atSource(lon,lat))}));
const crossings=[[0,1],[2,3],[0,2]].map(([a,b])=>({from:anchors[a].name,to:anchors[b].name,connected:!!p.network.route(anchors[a],anchors[b])}));
let trunks=0,maxRootGap=-Infinity,maxRootDepth=Infinity;const matrix=new T.Matrix4(),pos=new T.Vector3(),scale=new T.Vector3(),q=new T.Quaternion();
p.root.traverse(mesh=>{if(!mesh.isInstancedMesh||mesh.name!=='Regional tree trunks')return;for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);matrix.decompose(pos,q,scale);const bottom=pos.y-scale.y*.5;const expected=p.landscape.roadsideHeight(pos.x,pos.z);const gap=(bottom-expected)*100;trunks++;maxRootGap=Math.max(maxRootGap,gap);maxRootDepth=Math.min(maxRootDepth,gap);}});
const ray=new T.Raycaster(),roadCoverage=[];
for(const [name,lon,lat]of [...checkpoints,['断桥中部',120.14703,30.26090],['苏堤中部',120.13421,30.24384]]){
 const point=p.network.snap(p.atSource(lon,lat));const source=new T.Vector3(point.x,100,point.z),origin=p.root.localToWorld(source),direction=new T.Vector3(0,-1,0);ray.set(origin,direction);ray.near=0;ray.far=1000;const hits=ray.intersectObjects(p.roadMeshes,true);roadCoverage.push({name,hasVisibleDeck:hits.length>0});
}
if(roadCoverage.some(p=>!p.hasVisibleDeck))throw Error('Walkable bridge/causeway without visible paving: '+JSON.stringify(roadCoverage));
const bridgeRoute=p.network.route(anchors[0],anchors[1]);let bridgeSamples=0,unsupported=0,heightError=0;
for(const n of bridgeRoute||[]){const point=p.root.localToWorld(new T.Vector3(n.x,0,n.z)),deckY=p.deck.height(point.x,point.z);bridgeSamples++;if(deckY==null)unsupported++;else {const c=p.landscape.scene.worldToLocal(point.clone()),lon=120.140+c.x/(111320*Math.cos(30.245*Math.PI/180)*.01),lat=30.245-c.z/(111320*.01);heightError=Math.max(heightError,Math.abs(p.height(lon,lat)-deckY));}}
if(unsupported)throw Error('Bridge route lost deck support');
const repairs={bridgeSamples,unsupported,maxBridgeHeightErrorM:heightError*40,roadCoverage,components:[...components.values()].sort((a,b)=>b-a).slice(0,8),stitched:p.network.stitched,crossings,trunks,maxRootGapM:maxRootGap,maxRootDepthM:maxRootDepth};
await writeFile('verification/path-tree-repair.json',JSON.stringify(repairs,null,2));console.log('REPAIRS '+JSON.stringify(repairs));
if(crossings.some(c=>!c.connected))throw Error('Bridge/causeway not connected');if(maxRootGap>.05)throw Error('Floating trunks remain');
const summary={loadedMs:Math.round(performance.now()-started),roadPaths:p.rows.length,occlusionInstances:p.shade.count,landmarkGroups:p.focus.size,errors:p.errors,sourceStats:p.landscape.contextStats,samples};
await writeFile('verification/partner-scene.json',JSON.stringify(summary,(k,v)=>typeof v==='function'?undefined:v,2));console.log(JSON.stringify({loadedMs:summary.loadedMs,roadPaths:summary.roadPaths,occlusionInstances:summary.occlusionInstances,landmarkGroups:summary.landmarkGroups,shadeValues:[...new Set(samples.map(s=>s.shade))]}));
