import {createPavingSurface} from './road-paving.js';
import {unpackRoadGrades} from './road-grade-codec.js';
import {gradeRoadSurfaces,applyRoadGrades} from './road-grading.js';
import {applyMeshClearances} from './mesh-clearance.js';
import {addRoadSeams} from './road-seams.js';
import {createNavigationCollision} from './navigation-collision.js';
import {createGroundContact} from './ground-contact.js';
import {createWalkSurface} from './walk-surface.js';
import {createWalkNetwork} from './partner/walk-network.js';
import * as T from './assets/three.module.js';
import {createGeoLandscape,loadGeoData} from './partner/geo-landscape.js';
import {latLonToScene,sceneToLatLon} from './partner/projection.js';
import {GLTFLoader} from './assets/GLTFLoader.js';
import {MeshoptDecoder} from './assets/meshopt_decoder.module.js';
import {buildStreetKits} from './partner/spot-streetscape.js';
import {createLandmarkPlinth} from './partner/spot-streetscape.js';
import {createBaidiScenery} from './partner/baidi-scenery.js';
import {createHuagangScenery} from './partner/huagang-scenery.js';
import {createHubinScenery} from './partner/hubin-scenery.js';
import {addCausewayGreenery} from './partner/causeways.js';

import {createParkScenery,createQuyuanPavilion,createLotusBeds} from './partner/scenic-craft.js';
import {createXiaoyingzhou} from './partner/xiaoyingzhou-model.js';
import {createSceneShade} from './scene-shade.js';
import {DEST} from './destinations.js';
import {createPierHouse} from './landmarks.js';
const UNIT=40,LON=120.142,LAT=30.248;
export async function loadPartnerScene({deferShade=false,onProgress=()=>{},clearanceEdits=undefined,gradeCache=undefined}={}){
 const breathe=()=>new Promise(r=>setTimeout(r,0));
 onProgress('loading');
 if(gradeCache===undefined)gradeCache=await fetch(new URL('./assets/road-grades.json.gz',import.meta.url)).then(async r=>{if(!r.ok)return null;return JSON.parse(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text());}).catch(()=>null);
 if(clearanceEdits===undefined)clearanceEdits=await fetch(new URL('./assets/road-clearances.json',import.meta.url)).then(r=>r.ok?r.json():null).catch(()=>null);

 const raw=await loadGeoData();await breathe();const spots=Object.fromEntries(Object.values(DEST).filter(d=>d.kind!=='pier').map(d=>[d.zh,{lat:d.c[1],lon:d.c[0]}]));
 Object.assign(spots,{'北山街':{lat:30.2632,lon:120.145},'湖滨':{lat:30.2514,lon:120.162},'白堤':{lat:30.258,lon:120.145},'杨公堤':{lat:30.245,lon:120.127},'保俶塔':{lat:30.2665,lon:120.1438}});
 const landscape=createGeoLandscape({...raw,spots}),root=landscape.scene;onProgress('landscape');await breathe();
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),focus=new Map(),errors=[];
 const loads=[];for(const [name,plan] of landscape.scenicPlans)for(const placement of plan.placements||[]){
  loads.push((async()=>{try{
   if(placement.asset==='santan'&&landscape.island){root.add(createXiaoyingzhou(landscape,m=>m));return;}
   const model=['quyuan','liulang'].includes(placement.asset)?createQuyuanPavilion(placement.asset==='liulang'?'willow':'lotus'):(await loader.loadAsync(new URL('./partner/models/'+placement.asset+'.glb',import.meta.url).href)).scene;
   const bounds=new T.Box3().setFromObject(model);model.scale.setScalar(.01);model.rotation.y=placement.yaw||0;
   const yaw=placement.yaw||0,leveled=landscape.causewayAt?.(placement.x,placement.z,.13);
   const floor=placement.onWater?Math.max(.052,landscape.walkHeight(placement.station.x,placement.station.z)-.012):leveled?leveled.model.grassY:Math.max(.05,Math.min(landscape.roadsideHeight(placement.x,placement.z)+.015,landscape.walkHeight(placement.x,placement.z)));
   model.position.set(placement.x,floor-bounds.min.y*.01,placement.z);model.name=name;
   model.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});root.add(model);const plinth=createLandmarkPlinth(bounds,{...placement,yaw},floor,landscape.roadsideHeight);if(plinth){plinth.name='Landmark foundation '+name;root.add(plinth);}if(!focus.has(name))focus.set(name,model);
  }catch(error){errors.push({asset:placement.asset,error:String(error)});}})());
 }
 await Promise.all(loads);root.add(buildStreetKits(landscape.scenicPlans,landscape),createParkScenery(landscape));onProgress('models');await breathe();
 addCausewayGreenery(root,landscape.rebuiltCauseways,landscape);root.add(createLotusBeds(landscape.wet,landscape.parks.lotus,landscape.nearRoad));
 const special=[createBaidiScenery(landscape,m=>m),createHuagangScenery(landscape,m=>m),createHubinScenery(landscape,m=>m)];root.add(...special);
 if(landscape.corridor){focus.set('平湖秋月',special[0].getObjectByName('御书楼')||special[0]);}
 // Match our established scene projection and metre scale; preserve donor geometry.
 root.scale.set(2.5*96400/(111320*Math.cos(30.245*Math.PI/180)),2.5,2.5);
 root.position.set((120.140-LON)*96400/UNIT,0,(LAT-30.245)*111320/UNIT);root.updateMatrixWorld(true);
 const sourcePoint=(lon,lat)=>latLonToScene(lat,lon);
 let deck,waterDeck;
 const visibleHeight=(x,z,reference)=>{let y=deck?.height(x,z,reference);const water=waterDeck?.height(x,z);if(y!=null&&water!=null&&y<water-.0005){const top=deck.height(x,z);y=top>=water-.0005?top:null;}return y;};
 const worldPoint=(x,z)=>root.localToWorld(new T.Vector3(x,0,z));
 const height=(lon,lat)=>{const p=sourcePoint(lon,lat),v=worldPoint(p.x,p.z);return visibleHeight(v.x,v.z)??landscape.terrainSurfaceY(p.x,p.z)*2.5;};
 const paths=[...landscape.paths,...landscape.supplementPaths],pathIds=[...landscape.pathNodeIds,...landscape.supplementNodeIds];
 const rows=paths.map((path,i)=>({path,index:i,c:path.map(([x,z])=>{const q=sceneToLatLon(x,z);return [q.lon,q.lat];}),ids:pathIds[i]}));
 // Road names are inherited from the nearest source line, preserving actual names.
 for(const row of rows){const p=row.c[Math.floor(row.c.length/2)];let best=null,d=Infinity;for(const feature of raw.roads.features){if(feature.geometry.type!=='LineString')continue;for(const q of feature.geometry.coordinates){const dist=(q[0]-p[0])**2+(q[1]-p[1])**2;if(dist<d){d=dist;best=feature;}}}row.road={name:best?.properties.name||'',kind:best?.properties.highway||'footway',c:row.c,walk:true};}
 // Register exposed special walk platforms; roofs and walls stay collidable.
 for(const group of special)group.traverse(mesh=>{if(!mesh.isMesh)return;if(/望月平台与贴水曲桥|北里湖T形木栈桥|木曲廊与西岸 Z 形木栈道|牡丹山双圈鹅卵石花径|湖滨三公园花岗岩涟漪广场与阶梯|连续水墨石板/.test(mesh.name))landscape.roadMeshes.push(mesh);});
 root.traverse(mesh=>{if(mesh.isMesh&&(mesh.userData.walkable||/· 台基/.test(mesh.name))&&!landscape.roadMeshes.includes(mesh))landscape.roadMeshes.push(mesh);});
 for(const mesh of landscape.roadMeshes)mesh.userData.navigationCollision=false;
 deck=createWalkSurface(landscape.roadMeshes,.125,{topsOnly:true});waterDeck=createWalkSurface(landscape.waterMeshes,5);
 // Preserve the donor's OSM node identities and original stitching rules.
 const canConnect=(a,b)=>[.12,.28,.50,.72,.88].every(t=>!landscape.wet(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t));
 const network=createWalkNetwork(paths,pathIds,canConnect),connectors=[];
 const seamDiagnostics=addRoadSeams(root,landscape,paths,network,deck);deck=createWalkSurface(landscape.roadMeshes,.125,{topsOnly:true});waterDeck=createWalkSurface(landscape.waterMeshes,5);
 const gradeDiagnostics=gradeCache?(gradeCache.pavingGrid?createPavingSurface(root,landscape,network,unpackRoadGrades(gradeCache)):applyRoadGrades(root,landscape,network,unpackRoadGrades(gradeCache))):gradeRoadSurfaces(root,landscape,network,deck);deck=createWalkSurface(landscape.roadMeshes,.125,{topsOnly:true});
 for(const n of network.nodes){n.worldPosition=worldPoint(n.x,n.z);n.worldY=(visibleHeight(n.worldPosition.x,n.worldPosition.z,landscape.tourHeight(n.x,n.z)*2.5)??landscape.terrainSurfaceY(n.x,n.z)*2.5)+.0005;n.worldPosition.y=n.worldY;}
 onProgress('donor network '+network.nodes.length+' nodes');await breathe();
 const pierHouses=new Map();
 for(const [key,d]of Object.entries(DEST).filter(([,d])=>d.kind==='pier')){const origin=sourcePoint(...d.c),house=createPierHouse(100,d.zh);let best=null;
  for(const r of [8,12,16,20,24,28]){for(let k=0;k<16;k++){const a=k*Math.PI/8,x=origin.x+Math.cos(a)*r/100,z=origin.z+Math.sin(a)*r/100;
   let clear=true;for(const dx of [-.06,0,.06])for(const dz of [-.05,0,.05]){const w=worldPoint(x+dx,z+dz);if(deck.height(w.x,w.z)!=null)clear=false;}
   if(clear){best={x,z};break;}}if(best)break;}
  best??=origin;const floor=Math.max(.052,landscape.terrainSurfaceY(best.x,best.z));house.position.set(best.x,floor,best.z);house.name=d.zh+' · 码头房';house.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});root.add(house);pierHouses.set(key,house);
 }
 root.updateMatrixWorld(true);
 const clearanceDiagnostics=applyMeshClearances(root,clearanceEdits?.edits||[]);
 const collision=createNavigationCollision(root,{cellMeters:10}),contact=createGroundContact(deck,collision,{waterDeck});
 for(const node of network.nodes){const result=contact.trace(node.worldPosition,node.worldPosition);node.walkable=result.ok;if(result.ok){node.worldPosition.copy(result.position);node.worldY=result.position.y;}}
 await breathe();
 const targets={};for(const [key,d]of Object.entries(DEST)){const source=sourcePoint(...d.c);let snap=network.snap(source);if(!d.island&&snap?.edge.a.component!==network.mainComponent)snap=network.snap(source,.85,network.mainComponent)||snap;if(!snap)continue;let node=snap.t<.5?snap.edge.a:snap.edge.b;if(!node.walkable){const candidates=network.nodes.filter(n=>n.walkable&&n.component===node.component).sort((a,b)=>Math.hypot(a.x-source.x,a.z-source.z)-Math.hypot(b.x-source.x,b.z-source.z));if(candidates.length)node=candidates[0];}targets[key]={nodeId:node.id,position:node.worldPosition.toArray(),anchor:worldPoint(source.x,source.z).toArray(),distanceM:Math.hypot(node.x-source.x,node.z-source.z)*100,component:node.component};}
 const navigation={targets,diagnostics:{mode:'osm-mesh-contact',paths:paths.length,sourceNodeIds:true,edgesRejected:0,stitched:network.stitched,seams:seamDiagnostics,grades:gradeDiagnostics,clearances:clearanceDiagnostics,collision:collision.counts},canWalk:contact.canWalk};
 const shade=deferShade?null:createSceneShade(root);
 return {root,landscape,rows,height,focus,shade,network,connectors,deck,collision,contact,contactHeight:contact.height,pierHouses,navigationTargets:navigation.targets,navigationDiagnostics:navigation.diagnostics,canWalk:navigation.canWalk,roadMeshes:landscape.roadMeshes,errors,
  atSource(lon,lat){return sourcePoint(lon,lat);},
  update(seconds,wind,month,night){landscape.update(seconds,wind,month,night,'current');},
  setLight(sun,daylight){landscape.setLakeLight(new T.Color('#9dbcc8'),new T.Color('#e3e4d2'),new T.Vector3().fromArray(sun.direction),daylight);},
  pickRoad(point){const local=root.worldToLocal(point.clone());let best=null,d=Infinity;for(const row of rows)for(let i=1;i<row.path.length;i++){const a=row.path[i-1],b=row.path[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((local.x-a[0])*dx+(local.z-a[1])*dz)/(dx*dx+dz*dz||1))),distance=(local.x-a[0]-t*dx)**2+(local.z-a[1]-t*dz)**2;if(distance<d){d=distance;best=row.road;}}return best;}
 };
}

