import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {DEST} from '../public/destinations.js';
globalThis.fetch=async input=>new Response(await readFile(fileURLToPath(String(input))));
const {loadGeoData,createGeoLandscape}=await import('../verification/donor-baseline/geo-landscape.js');
const {createWalkNetwork}=await import('../verification/donor-baseline/walk-network.js');
const {latLonToScene}=await import('../verification/donor-baseline/projection.js');
const raw=await loadGeoData(),spots=Object.fromEntries(Object.values(DEST).filter(d=>!d.kind).map(d=>[d.zh,{lat:d.c[1],lon:d.c[0]}]));
Object.assign(spots,{'北山街':{lat:30.2632,lon:120.145},'湖滨':{lat:30.2514,lon:120.162},'白堤':{lat:30.258,lon:120.145},'杨公堤':{lat:30.245,lon:120.127},'保俶塔':{lat:30.2665,lon:120.1438}});
const landscape=createGeoLandscape({...raw,spots}),paths=[...landscape.paths,...landscape.supplementPaths],ids=[...landscape.pathNodeIds,...landscape.supplementNodeIds];
const network=createWalkNetwork(paths,ids,(a,b)=>[.12,.28,.5,.72,.88].every(t=>!landscape.wet(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)));
const sizes=new Map();for(const node of network.nodes)sizes.set(node.component,(sizes.get(node.component)||0)+1);
const destinations=Object.entries(DEST).map(([key,d])=>{const p=latLonToScene(d.c[1],d.c[0]),snap=network.snap(p);return {key,name:d.zh,distanceM:snap?Math.hypot(p.x-snap.x,p.z-snap.z)*100:null,component:snap?.edge.a.component,main:snap?.edge.a.component===network.mainComponent};});
const result={scope:'Unmodified donor geometry and navigation, import/fetch path adaptation only; same destination inputs as host adapter. Not a collider or rendering acceptance.',paths:paths.length,nodes:network.nodes.length,edges:network.edges.filter(e=>!e.inactive).length,components:[...sizes.values()].sort((a,b)=>b-a),destinations};
await writeFile('verification/donor-navigation-baseline.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

