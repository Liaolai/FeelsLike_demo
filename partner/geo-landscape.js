import {createWalkNetwork} from './walk-network.js';
import {createWalkSurface} from '../walk-surface.js';
import {mapCauseways} from './causeways.js';
import {FLOWER_WATER_RINGS,planWaterfronts,tuneWaterfrontPlans,waterfrontGrade} from './waterfront-sites.js';
import {mapBaidi,placeBaidiPlans} from './baidi-corridor.js';
import {createBaidiEmbankment} from './baidi-embankment.js';
import {mapWaterRings,mapXiaoyingzhou,placeSantanPlan,ISLAND_BRIDGE_Y,STONE_TOWERS} from './xiaoyingzhou.js';
import {PARK_SITES,mapParkSites,placeParkPlans} from './park-sites.js';
import {BOUNDS,clampX,clampZ,clipRing,clipRoad} from './sandbox-bounds.js';
import {bakeLakeField,createLakeMaterial,hideSubmergedGround} from './lake-material.js';
import {planScenicKits} from './spot-kits.js';
import {textureSurface} from './surface-materials.js';
import {addBridgeBalustrade, flushBridgeDetails} from './scenic-craft.js';
import {populate} from './geo-context.js';
import * as T from '../assets/three.module.js';
import {latLonToScene,sceneToLatLon} from './projection.js';
export async function loadGeoData(){
 const urls=['westlake-shoreline.json','westlake-walkways.geojson','westlake-dem.json',
   'westlake-vegetation-buildings.json','spot-alignment-roads.geojson'];
 const [water,roads,dem,context,alignment]=await Promise.all(urls.map(async url=>{
  const response=await fetch(new URL(url,import.meta.url));
  if(!response.ok)throw Error('无法读取 '+url);
  return response.json();
 }));
 return {water,roads,dem,context,alignment};
}
export function createGeoLandscape(data){
const scene=new T.Group(),project=p=>{const q=latLonToScene(p[1],p[0]);return [q.x,q.z]},rings=data.water.rings.map(r=>({...r,coordinates:clipRing(r.coordinates.map(project))})).filter(r=>r.coordinates.length);
const baseWater=mapWaterRings(rings);
const waterfronts=planWaterfronts(baseWater.isWater,data.context?.elements);
rings.push(...FLOWER_WATER_RINGS);
const {layers,isWater}=mapWaterRings(rings);
const island=mapXiaoyingzhou(layers,data.roads.features,project);
const corridor=mapBaidi(data.roads.features,project,isWater);
const rebuiltCauseways=mapCauseways([...data.roads.features,...(data.alignment?.features||[])],project,isWater);
function causewayAt(x,z,radius=.14){
 for(const model of rebuiltCauseways){const q=model.sampleNear(x,z);if(q&&q.distance<radius&&q.s>.001&&q.s<model.length-.001)return {model,...q};}
 return null;
}
const outer=layers.filter(r=>r.role==='outer'),inner=layers.filter(r=>r.role==='inner');
const shoreWater=(x,z)=>isWater(x,z)&&!island?.embankment(x,z);
const lakeSurface=(x,z)=>Boolean(corridor?.depression(x,z)>.82)||shoreWater(x,z);
const wet=(x,z)=>!causewayAt(x,z,.11)&&corridor?.ownGround(x,z)==null&&lakeSurface(x,z)&&!island?.bridgeFootprint(x,z);
const parks=mapParkSites(wet);
const mat={land:new T.MeshStandardMaterial({color:0x8d9e75,roughness:1}),road:new T.MeshStandardMaterial({color:0xd7ccb4}),bridge:new T.MeshStandardMaterial({color:0xb9b6a4}),ink:new T.MeshStandardMaterial({color:0xcfcbc0})};
function shape(p){return new T.Shape(p.map(([x,z])=>new T.Vector2(x,-z)));}
function add(g,m){const o=new T.Mesh(g,m);o.receiveShadow=true;scene.add(o);return o;}
const dykes=data.roads.features.filter(f=>f.geometry?.type==='LineString'&&
 f.properties.name==='苏堤').map(f=>f.geometry.coordinates.map(project));
const lakeField=bakeLakeField(outer,inner,dykes,layers,island,corridor);
const lake=createLakeMaterial(lakeField);
lake.uniforms.lakeFountainPoint.value.set(waterfronts.hubin.fountain.x,waterfronts.hubin.fountain.z);
if(island)STONE_TOWERS.forEach(({x,z},i)=>lake.uniforms.lakeTowerLights.value[i].set(x,z));
mat.water=lake.material;
const gardenWater=createLakeMaterial(lakeField);
gardenWater.material.transparent=true;
gardenWater.material.opacity=.63;
gardenWater.material.depthWrite=false;
gardenWater.uniforms.lakeShallow.value.setHex(0x6db39c);
gardenWater.uniforms.lakeDeep.value.setHex(0x367770);
const pondBed=new T.MeshStandardMaterial({color:0x537a62,roughness:.91});
// Preserve the elevation datum used by the walking network.
function walkingGround(x,z){
 const embankment=causewayAt(x,z);
 if(embankment)return embankment.model.grassHeight?.(embankment.s)??embankment.model.grassY;
 const grade=corridor?.ownGround(x,z);
 if(grade!=null)return grade;
 if(shoreWater(x,z))return -.03;const q=sceneToLatLon(x,z),d=data.dem,u=Math.max(0,Math.min(d.width-1,(q.lon-d.bounds[0])/(d.bounds[2]-d.bounds[0])*(d.width-1))),v=Math.max(0,Math.min(d.height-1,(d.bounds[3]-q.lat)/(d.bounds[3]-d.bounds[1])*(d.height-1)));const x0=Math.floor(u), z0=Math.floor(v), x1=Math.min(x0+1,d.width-1), z1=Math.min(z0+1,d.height-1);
const tx=u-x0, tz=v-z0;
const h=(d.values[z0][x0]*(1-tx)+d.values[z0][x1]*tx)*(1-tz)+(d.values[z1][x0]*(1-tx)+d.values[z1][x1]*tx)*tz;
let base=Number.isFinite(h)?Math.max(.06,(h-7)*.01):.06;
const waterfront=waterfrontGrade(waterfronts,x,z);
if(waterfront)base=T.MathUtils.lerp(base,waterfront.elevation,waterfront.blend);
const terrace=corridor?.terraceGrade(x,z);
if(terrace)base=T.MathUtils.lerp(base,Math.min(base,terrace.y),terrace.weight);
if(island?.contains(x,z)){
 if(island.embankment(x,z))return .064;
 return .067+Math.min(.036,Math.max(0,base-.062)*.32);
}
const lotus=parks.lotus?.hero,willow=parks.willow.hero;
if(lotus&&Math.abs(x-lotus.x)<.82&&Math.abs(z-lotus.z)<.82){
 const distance=Math.hypot(x-lotus.x,z-lotus.z);
 base=T.MathUtils.lerp(Math.min(base,.077),base,T.MathUtils.smoothstep(distance,.28,.81));
}
if(willow&&Math.abs(x-willow.x)<.62&&Math.abs(z-willow.z)<1.12){
 let distance=Math.hypot(x-willow.x,z-willow.z);
 for(const [a,b] of parks.willow.path)distance=Math.min(distance,Math.hypot(x-a,z-b));
 base=T.MathUtils.lerp(Math.min(base,.081),base,T.MathUtils.smoothstep(distance,.18,.54));
}
const r=Math.hypot((x-PARK_SITES.hill.x)/1.11,(z-PARK_SITES.hill.z)/1.23);
if(r>=1)return base;
const bell=(1-r*r)**2;
return base+Math.max(0,.458-base)*bell;
}
function ground(x,z){
 const water=shoreWater(x,z),interior=water&&shoreWater(x+.06,z)&&shoreWater(x-.06,z)&&shoreWater(x,z+.06)&&shoreWater(x,z-.06);
 let y=water?(interior?-.25:-.13):walkingGround(x,z);
 const fade=corridor?.depression(x,z)||0;
 y=T.MathUtils.lerp(y,-.18,fade);
 for(const model of rebuiltCauseways)y=model.underlying(x,z,y);
 return y;
}
const shoreCells=new Map();
const revetmentPositions=[],revetmentUV=[];
let shoreRun=0;
for(const ring of rings){
 const p=ring.coordinates;
 for(let i=1;i<p.length;i++){
  const [ax,az]=p[i-1],[bx,bz]=p[i],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
  if(len<1e-6)continue;
  if([.20,.50,.80].some(t=>causewayAt(ax+dx*t,az+dz*t,.47)||corridor?.isReplacement(ax+dx*t,az+dz*t)))continue;
  const xl=Math.floor(Math.min(ax,bx)),xr=Math.floor(Math.max(ax,bx));
  const zl=Math.floor(Math.min(az,bz)),zr=Math.floor(Math.max(az,bz));
  for(let x=xl;x<=xr;x++)for(let z=zl;z<=zr;z++){
   const key=x+','+z;
   if(!shoreCells.has(key))shoreCells.set(key,[]);
   shoreCells.get(key).push([ax,az,dx,dz,len*len]);
  }
  const bankWidth=ring.key?.010:.012,bankTop=ring.key?.055:.065;
  const ox=dz*bankWidth/len,oz=-dx*bankWidth/len;
  const u=shoreRun/.019,v=(shoreRun+len)/.019;
  const a=[ax,bankTop,az,u],b=[bx,bankTop,bz,v];
  for(const side of [-1,1]){
   const c=[ax+ox*side,.030,az+oz*side,u],d=[bx+ox*side,.030,bz+oz*side,v];
   for(const point of [a,c,b,b,c,d]){
    revetmentPositions.push(clampX(point[0]),point[1],clampZ(point[2]));revetmentUV.push(point[3],0,0);
   }
  }
  shoreRun+=len;
 }
}
function shoreDistanceAt(x,z){
 let best=.45*.45;
 const xi=Math.floor(x),zi=Math.floor(z);
 for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
  for(const [ax,az,dx,dz,length] of shoreCells.get((xi+i)+','+(zi+j))||[]){
   const t=Math.min(1,Math.max(0,((x-ax)*dx+(z-az)*dz)/length));
   best=Math.min(best,(x-ax-dx*t)**2+(z-az-dz*t)**2);
  }
 }
 return Math.sqrt(best);
}
const width=BOUNDS.maxX-BOUNDS.minX,depth=BOUNDS.maxZ-BOUNDS.minZ;
function terrainAxis(min,max,centers){
 const values=Array.from({length:257},(_,i)=>min+(max-min)*i/256);
 for(const [center,radius,step=.024] of centers){
  if(!Number.isFinite(center))continue;
  for(let x=center-radius;x<=center+radius;x+=step)
   if(x>min&&x<max)values.push(x);
 }
 return values.sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>.002||i===a.length-1);
}
const xAxis=terrainAxis(BOUNDS.minX,BOUNDS.maxX,[[parks.lotus?.hero.x,.58],[parks.willow.hero?.x,.35],[island?.center.x,1.68,.035],[corridor?.pinghuAnchor.x,.89,.035],[corridor?.duanqiao[1].x,.61,.038],[waterfronts.flower.center.x,1.09,.038],[waterfronts.hubin.plaza.x,.56,.047]]);
const zAxis=terrainAxis(BOUNDS.minZ,BOUNDS.maxZ,[[parks.lotus?.hero.z,.66],[parks.willow.hero?.z,.81],[island?.center.z,1.75,.035],[corridor?.pinghuAnchor.z,.58,.035],[corridor?.duanqiao[1].z,.66,.038],[waterfronts.flower.center.z,.85,.038],[waterfronts.hubin.plaza.z,.57,.047]]);
const terrain=new T.PlaneGeometry(width,depth,xAxis.length-1,zAxis.length-1);
terrain.rotateX(-Math.PI/2);
const terrainPosition=terrain.attributes.position;
for(let iz=0;iz<zAxis.length;iz++)for(let ix=0;ix<xAxis.length;ix++){
 const x=xAxis[ix],z=zAxis[iz];
 terrainPosition.setXYZ(iz*xAxis.length+ix,x,ground(x,z),z);
}
terrain.computeVertexNormals();
function axisCell(axis,value){
 let i=0,j=axis.length-1;
 while(j-i>1){const k=(i+j)>>1;if(value<axis[k])j=k;else i=k;}
 return [i,T.MathUtils.clamp((value-axis[i])/(axis[i+1]-axis[i]),0,1)];
}
// Match the rendered triangles, including the shoreline's finer sampling.
function terrainSurfaceY(x,z){
 const [col,fx]=axisCell(xAxis,x),[row,fz]=axisCell(zAxis,z);
 const i=row*xAxis.length+col;
 const a=terrainPosition.getY(i),b=terrainPosition.getY(i+1);
 const c=terrainPosition.getY(i+xAxis.length),d=terrainPosition.getY(i+xAxis.length+1);
 return fx+fz<=1 ? a+(b-a)*fx+(c-a)*fz : d+(c-d)*(1-fx)+(b-d)*(1-fz);
}

const terrainColors=[], color=new T.Color();
const grass=new T.Color(0x869c68),moss=new T.Color(0x6e8458),forest=new T.Color(0x4d6b46);
for(let i=0;i<terrainPosition.count;i++){
 const y=terrainPosition.getY(i);
 const slope=1-terrain.attributes.normal.getY(i);
 color.copy(grass).lerp(forest,Math.min(.93,Math.max(0,y*.31+slope*1.6)));
 color.lerp(moss,(1-shoreDistanceAt(terrainPosition.getX(i),terrainPosition.getZ(i))/.45)*.88);
 terrainColors.push(color.r,color.g,color.b);
}
terrain.setAttribute('color',new T.Float32BufferAttribute(terrainColors,3));
mat.land.color.setHex(0xffffff);mat.land.vertexColors=true;mat.land.needsUpdate=true;
textureSurface(mat.land,'ground');
hideSubmergedGround(mat.land,lakeField);
const terrainMesh=add(terrain,mat.land);
const skirt=[],trim=[];
const corners=[[BOUNDS.minX,BOUNDS.minZ],[BOUNDS.maxX,BOUNDS.minZ],
 [BOUNDS.maxX,BOUNDS.maxZ],[BOUNDS.minX,BOUNDS.maxZ]];
function band(target,a,b,c,d){target.push(...a,...b,...c,...b,...d,...c);}
const rim=.16;
for(let side=0;side<4;side++){
 const a=corners[side],b=corners[(side+1)%4];
 let last;
 for(let i=0;i<=256;i++){
  const t=i/256,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
  const edge=terrainSurfaceY(x,z);
  const ox=x+(side===1?rim:side===3?-rim:0);
  const oz=z+(side===2?rim:side===0?-rim:0);
  const top=[x,edge+.008,z], outer=[ox,edge+.008,oz], outerBottom=[ox,-.60,oz];
  if(last){
   band(trim,last.top,last.outer,top,outer);
   band(skirt,last.outer,last.outerBottom,outer,outerBottom);
  }
  last={top,outer,outerBottom};
 }
 // Close the two exposed faces of the trim at each corner.
 const x=a[0],z=a[1],y=terrainSurfaceY(x,z)+.008;
 const ox=x+(x<0?-rim:rim),oz=z+(z<0?-rim:rim);
 band(trim,[x,y,z],[ox,y,z],[x,y,oz],[ox,y,oz]);
 band(skirt,[ox,y,z],[ox,-.60,z],[ox,y,oz],[ox,-.60,oz]);
 band(skirt,[x,y,oz],[x,-.60,oz],[ox,y,oz],[ox,-.60,oz]);
}
const frame=new T.Group();frame.name='Sandbox stone frame';
for(const [positions,tint] of [[skirt,0x45413e],[trim,0x7a6551]]){
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
 const material=new T.MeshStandardMaterial({color:tint,side:T.DoubleSide,roughness:.83});
 textureSurface(material,'ground');
 const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;frame.add(mesh);
}
const plinth=new T.Mesh(new T.BoxGeometry(width+rim*2+.07,.12,depth+rim*2+.07),
 new T.MeshStandardMaterial({color:0x3f3530,roughness:.83}));
plinth.position.y=-.66;frame.add(plinth);scene.add(frame);
const revetment=new T.BufferGeometry();
revetment.setAttribute('position',new T.Float32BufferAttribute(revetmentPositions,3));
revetment.setAttribute('pavingCoord',new T.Float32BufferAttribute(revetmentUV,3));
revetment.computeVertexNormals();
const stone=new T.MeshStandardMaterial({color:0x9a998e,side:T.DoubleSide,roughness:.89});
textureSurface(stone,'masonry');add(revetment,stone).name='Batched West Lake stone shoreline';

const waterMeshes=[];
// Join fixed-height embankments to the actual rendered mainland at their ends.
for(const model of rebuiltCauseways){const original=model.surface,span=Math.min(.5,model.length*.15),start=model.station(0),end=model.station(model.length),startDelta=Math.max(0,terrainSurfaceY(start.x,start.z)+.0003-original(0)),endDelta=Math.max(0,terrainSurfaceY(end.x,end.z)+.0003-original(model.length));const fade=t=>{t=Math.max(0,Math.min(1,t));return 1-t*t*(3-2*t);};model.surface=s=>original(s)+startDelta*fade(s/span)+endDelta*fade((model.length-s)/span);model.grassHeight=s=>model.getBridge(s)?model.grassY:model.surface(s)-.002;model.approachGrades={spanM:span*100,startRaiseM:startDelta*100,endRaiseM:endDelta*100};}
const rebuiltBaidi=corridor&&createBaidiEmbankment(corridor,mat.water);
if(rebuiltBaidi)scene.add(rebuiltBaidi.root);
const rebuiltDecks=rebuiltCauseways.map(model=>createBaidiEmbankment(model,mat.water));
for(const deck of rebuiltDecks)scene.add(deck.root);
for(const ring of outer){
 const surface=shape(ring.coordinates);
 for(const hole of inner.filter(hole=>hole.parent===ring))
  surface.holes.push(new T.Path(hole.coordinates.map(([x,z])=>new T.Vector2(x,-z))));
 const geometry=new T.ShapeGeometry(surface);
 geometry.rotateX(-Math.PI/2);
 const mesh=add(geometry,ring.key?gardenWater.material:mat.water);
 if(ring.key){
  const bed=add(geometry,pondBed);
  bed.name=ring.key+'水底';bed.position.y=.025;
  mesh.renderOrder=3;
 }
 mesh.name=ring.key||(ring===island?.pond?'Xiaoyingzhou interior ponds':'West Lake water');
 mesh.position.y=.04;
 waterMeshes.push(mesh);
}
const waterSurfaceIndex=createWalkSurface(waterMeshes,1);
const pavedGround=(x,z,fallback)=>{const soil=terrainSurfaceY(x,z),water=waterSurfaceIndex.height(x,z);return water!=null&&soil<water-.0003?fallback:soil+.0003;};
const paths=[],pathNodeIds=[],deckSegments=new Map(),supplementalDeck=new Map();
const supplementPaths=[],supplementNodeIds=[];
const accepted=feature=>{
 const tags=feature.properties;
 return tags.foot!=='no'&&tags.access!=='private'&&tags.access!=='no'&&tags.area!=='yes';
};
const primary=data.roads.features.filter(accepted);
const alignment=(data.alignment?.features||[]).filter(accepted);
function maskGardenCrossings(runs){
 const {center}=waterfronts.flower;
 const result=[];
 for(const run of runs){
  let current=[];
  for(let i=1;i<run.points.length;i++){
   const a=run.points[i-1],b=run.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
   const near=Math.min(a[0],b[0])<=center.x+.46&&Math.max(a[0],b[0])>=center.x-.55&&
     Math.min(a[1],b[1])<=center.z+.54&&Math.max(a[1],b[1])>=center.z-.36;
   let crosses=false;
   if(near){
    const sampleCount=Math.max(2,Math.ceil(Math.hypot(dx,dz)/.020));
    for(let k=0;k<=sampleCount;k++){
     const x=a[0]+dx*k/sampleCount,z=a[1]+dz*k/sampleCount;
     if(Math.abs(x-center.x)<.53&&Math.abs(z-center.z)<.55&&
       isWater(x,z)&&!baseWater.isWater(x,z)){crosses=true;break;}
    }
   }
   if(crosses){
    if(current.length>1)result.push({points:current.map(k=>run.points[k]),nodeIds:current.map(k=>run.nodeIds[k])});
    current=[];
   }else{
    if(!current.length)current.push(i-1);
    current.push(i);
   }
  }
  if(current.length>1)result.push({points:current.map(k=>run.points[k]),nodeIds:current.map(k=>run.nodeIds[k])});
 }
 return result;
}
function splitWay(feature){
 const id=feature.id??feature.properties.osm_id??'unnamed';
 const source=feature.geometry.coordinates.map(project),nodeIds=feature.properties.node_ids;
 if(!corridor?.isAxis(feature)&&!rebuiltCauseways.some(model=>model.owns(feature))){
  const runs=clipRoad(source,nodeIds,id);
  if(feature.parkTrail||runs.every(r=>r.points.every(([x,z])=>
    Math.abs(x-waterfronts.flower.center.x)>2.6||Math.abs(z-waterfronts.flower.center.z)>2.6)))return runs;
  return maskGardenCrossings(runs);
 }
 const points=[source[0]],ids=[nodeIds?.[0]];
 for(let i=1;i<source.length;i++){
  const a=source[i-1],b=source[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.55));
  for(let k=1;k<n;k++)points.push([T.MathUtils.lerp(a[0],b[0],k/n),T.MathUtils.lerp(a[1],b[1],k/n)]);
  for(let k=1;k<n;k++)ids.push('baidi:'+id+':'+i+':'+k);
  points.push(b);ids.push(nodeIds?.[i]);
 }
 return clipRoad(points,ids,id);
}
const plannedRoads=[...primary,...alignment].flatMap(feature=>splitWay(feature).map(run=>({
 name:feature.properties.name,points:run.points
})));
const {plans:scenicPlans,masks:spotMasks}=planScenicKits(data.spots,plannedRoads,wet,terrainSurfaceY);

placeParkPlans(scenicPlans,parks);
placeSantanPlan(scenicPlans,island);
placeBaidiPlans(scenicPlans,corridor);
if(data.spots)tuneWaterfrontPlans(scenicPlans,waterfronts);
for(const model of rebuiltCauseways){
 const plan=scenicPlans.get(model.name==='苏堤'?'苏堤春晓':model.name);
 if(!plan)continue;
 const current=model.sampleNear(plan.origin.x,plan.origin.z);
 const s0=current?.s??model.length*.48;
 const candidates=[s0,s0-.22,s0+.22,s0-.44,s0+.44].filter(s=>s>.25&&s<model.length-.25&&!model.getBridge(s));
 const p=model.station(candidates[0]??model.length*.45);
 const old=plan.placements[0];
 if(!old)continue;
 const shift=model.width/2-.024;
 const placed={...old,x:p.x+p.nx*shift,z:p.z+p.nz*shift,yaw:Math.atan2(-p.nx,-p.nz),onWater:false};
 plan.placements=[placed];plan.rows=[];plan.origin={x:p.x,z:p.z};plan.focus=placed;
 plan.causewayView={focus:{x:p.x+p.dx*.29,z:p.z+p.dz*.29},
    height:model.level+.06,offset:[p.nx*.38-p.dx*.49,.27,p.nz*.38-p.dz*.49]};
}

spotMasks.push({name:'曲院风荷',...PARK_SITES.lotus,radius:.35,trees:false});
if(parks.lotus?.hero)spotMasks.push({name:'荷塘水榭',...parks.lotus.hero,radius:.125,trees:true},{name:'荷塘核心',...parks.lotus.hero,radius:.35,trees:false});
if(parks.willow.hero)spotMasks.push({name:'闻莺馆',...parks.willow.hero,radius:.135,trees:true});
for(const [x,z] of parks.willow.path)spotMasks.push({name:'柳岸',x,z,radius:.074,treeOnly:true,trees:true});

if(corridor){
 for(const site of [...corridor.pinghu,...corridor.duanqiao])
  spotMasks.push({...site,radius:Math.hypot(site.w,site.d)*.67+.026,trees:true});
}
const primaryIds=new Set(primary.map(feature=>String(feature.properties.osm_id)));
const walkWays=[...primary,...alignment.filter(f=>!primaryIds.has(String(f.id))&&
 ['北山街','杨公堤','湖滨路','平海路','东坡路','白堤','苏堤'].includes(f.properties.name)&&f.geometry.type==='LineString')];
function mappedParkTrail(path,id){
 if(path.length<2)return null;
 const raw=path.map(p=>p.slice());
 const ids=raw.map((_,i)=>'park:'+id+':'+i);
 const used=new Set();
 for(const last of [false,true]){
  const at=last?raw.at(-1):raw[0];
  let chosen,best=id==='willow'?2.2:id==='flower'?.88:id==='hubin'?.64:.55;
  for(const feature of walkWays)for(const run of splitWay(feature)){
   for(let i=0;i<run.points.length;i++){
    const point=run.points[i],node=run.nodeIds[i];
    if(node==null||used.has(node))continue;
    const distance=Math.hypot(point[0]-at[0],point[1]-at[1]);
    if(distance>=best)continue;
    if([.08,.20,.40,.60,.80,1].some(t=>wet(at[0]+(point[0]-at[0])*t,at[1]+(point[1]-at[1])*t)))continue;
    chosen={point,node};best=distance;
   }
  }
  if(!chosen)continue;
  used.add(chosen.node);
  if(best<1e-6)ids[last?ids.length-1:0]=chosen.node;
  else if(last){raw.push(chosen.point);ids.push(chosen.node);}
  else{raw.unshift(chosen.point);ids.unshift(chosen.node);}
 }
 return {id:'park-'+id,parkTrail:id,connections:used.size,properties:{highway:'footway',width:id==='lotus'?2.6:id==='flower'?3.4:id==='hubin'?12:5.2,node_ids:ids},
  geometry:{coordinates:raw.map(([x,z])=>{const p=sceneToLatLon(x,z);return [p.lon,p.lat];})}};
}
const parkTrails=data.spots?[mappedParkTrail(parks.lotus?.bridge||[],'lotus'),
 mappedParkTrail(parks.willow.path,'willow'),
 mappedParkTrail(waterfronts.flower.bridge,'flower'),
 mappedParkTrail([[waterfronts.hubin.plaza.x+.24,waterfronts.hubin.plaza.z],
   [waterfronts.hubin.plaza.x,waterfronts.hubin.plaza.z]],'hubin')].filter(Boolean):[];

const causewayNames=new Set(rebuiltCauseways.length?[]:corridor?['苏堤','杨公堤']:['白堤','苏堤','杨公堤']);
let bridgeCount=0, causewaySegments=0; const islandDecks=[];
const curbPositions=[],curbUV=[];
scene.userData.bridgeBatch={wet, sections:[]};
textureSurface(mat.road,'paving');textureSurface(mat.bridge,'paving');textureSurface(mat.ink,'ink-paving');
for(const f of [...walkWays,...parkTrails])for(const run of splitWay(f)){
const p=f.properties;
let points=run.points;
const bridge=p.bridge&&p.bridge!=='no';
const islandWay=island&&(island.isFlatWay(f)||points.some(([x,z])=>island.contains(x,z)));
const flatBridge=islandWay&&bridge;
const baidiAxis=corridor?.isAxis(f);
const newAxis=rebuiltCauseways.find(model=>model.owns(f));
const ink=f.parkTrail==='hubin'||(['湖滨路','平海路','东坡路'].includes(p.name)&&points.some(([x,z])=>
  x>waterfronts.hubin.fountain.x+.35&&x<waterfronts.hubin.fountain.x+5.7&&Math.abs(z-waterfronts.hubin.fountain.z)<4.5));
const width=ink?.122:baidiAxis?(bridge?.25:.10):flatBridge?.032:Math.min(.15,Math.max(f.parkTrail?.023:.035,(parseFloat(p.width)||(f.visualOnly?7.5:3))*.01));
if(!f.visualOnly){paths.push(points);pathNodeIds.push(run.nodeIds);}
else {supplementPaths.push(points);supplementNodeIds.push(run.nodeIds);}
const causeway=causewayNames.has(p.name);
if(bridge&&!f.visualOnly)bridgeCount++;
if(causeway&&!f.visualOnly)causewaySegments++;
const parkGrade=points.some(([x,z])=>waterfrontGrade(waterfronts,x,z));
{
 const samples=[points[0]];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.015));
  for(let k=1;k<=steps;k++){const t=k/steps;samples.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
 }
 points=samples;
}
const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));const total=lengths.at(-1)||1,vertices=[],ids=[],paving=[],onSoil=[];
for(let i=0;i<points.length;i++){
 const [x,z]=points[i], a=points[Math.max(0,i-1)], b=points[Math.min(points.length-1,i+1)];
 const d1=Math.hypot(x-a[0],z-a[1]),d2=Math.hypot(b[0]-x,b[1]-z);
 const p1=d1>1e-7?[(x-a[0])/d1,(z-a[1])/d1]:[(b[0]-x)/(d2||1),(b[1]-z)/(d2||1)];
 const p2=d2>1e-7?[(b[0]-x)/d2,(b[1]-z)/d2]:p1;
 let dx=p1[0]+p2[0],dz=p1[1]+p2[1],d=Math.hypot(dx,dz);
 if(d<.30){[dx,dz]=p2;d=Math.hypot(dx,dz)||1;}
 dx/=d;dz/=d;
 const dot=dx*p2[0]+dz*p2[1];
 const offset=width*.5/Math.max(.80,dot);
 const t=lengths[i]/total;
 let y=bridge
  ? Math.max(.085,walkingGround(...points[0])+.025)*(1-t)+Math.max(.085,walkingGround(...points.at(-1))+.025)*(lengths[i]/total)+.035*Math.sin(Math.PI*lengths[i]/total)
  : Math.max(causeway ? .085 : -Infinity, walkingGround(x,z)+.025);
 const lotusNear=parks.lotus&&Math.hypot(x-parks.lotus.hero.x,z-parks.lotus.hero.z)<.72;
 if(f.parkTrail==='flower')y=wet(x,z)?.053:Math.max(.053,Math.min(.086,terrainSurfaceY(x,z)+.005));
  else if(ink)y=Math.max(.058,terrainSurfaceY(x,z)+.006);
 else if(parkGrade&&!bridge&&waterfrontGrade(waterfronts,x,z))y=Math.max(.054,terrainSurfaceY(x,z)+.004);
 else if(f.parkTrail==='lotus')y=Math.max(.059,terrainSurfaceY(x,z)+.004);
  else if(f.parkTrail==='willow'||(!bridge&&lotusNear&&!wet(x,z)))y=Math.max(.052,terrainSurfaceY(x,z)+.005);
 if(islandWay){
  if(flatBridge){
   const shoreDistance=shoreWater(x,z)?0:Math.min(.034,shoreDistanceAt(x,z));
   y=Math.max(ISLAND_BRIDGE_Y,ISLAND_BRIDGE_Y+Math.max(0,terrainSurfaceY(x,z)-ISLAND_BRIDGE_Y)*shoreDistance/.034);
  }else y=Math.max(ISLAND_BRIDGE_Y,terrainSurfaceY(x,z)+.006);
 }
 const replacement=corridor?.sampleNear(x,z);
 const level=newAxis?.sampleNear(x,z);
 const nearby=causewayAt(x,z,.33);
 if(level)y=newAxis.surface(level.s);
 else if(nearby)y=nearby.model.surface(nearby.s);
 else if(replacement&&(baidiAxis||replacement.distance<.095))y=corridor.surface(replacement.s);
 else if(corridor?.terraceGrade(x,z)&&(!bridge||corridor.bridgeheadGrade(x,z)))y=Math.max(.057,terrainSurfaceY(x,z)+.005);
 const lx=clampX(x-dz*offset),lz=clampZ(z+dx*offset),rx=clampX(x+dz*offset),rz=clampZ(z-dx*offset);
 const followsSoil=!bridge&&!newAxis&&!baidiAxis&&!nearby&&!(replacement&&replacement.distance<.095)&&!wet(x,z);
 const ly=followsSoil?pavedGround(lx,lz,y):y,ry=followsSoil?pavedGround(rx,rz,y):y;
 onSoil.push(followsSoil);
 vertices.push(lx,ly,lz,rx,ry,rz);
 if(i)ids.push(2*i-2,2*i,2*i-1,2*i-1,2*i,2*i+1);
}

for(let i=0;i<points.length;i++){
 paving.push(lengths[i]/.012,0,-1,lengths[i]/.012,width/.009,1);
}
if(!newAxis&&!baidiAxis&&!ink&&f.parkTrail!=='flower'&&(f.visualOnly||bridge||causeway||['footway','pedestrian','steps','path'].includes(p.highway))){
 for(let i=1;i<points.length;i++)for(const side of [0,1]){
  const a=(2*(i-1)+side)*3,b=(2*i+side)*3;
  const ax=vertices[a],az=vertices[a+2],bx=vertices[b],bz=vertices[b+2];
  const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
  if(len<1e-6||corridor?.isReplacement((ax+bx)*.5,(az+bz)*.5))continue;
  const ox=dz/len*.0017*(side===0?1:-1),oz=-dx/len*.0017*(side===0?1:-1);
  const u=lengths[i-1]/.017,v=lengths[i]/.017;
  const A=[ax,vertices[a+1]+.0011,az,u],B=[bx,vertices[b+1]+.0011,bz,v];
  const C=[clampX(ax+ox),A[1],clampZ(az+oz),u],D=[clampX(bx+ox),B[1],clampZ(bz+oz),v];
  for(const q of (side ? [A,C,B,B,C,D] : [A,B,C,B,D,C])){
   curbPositions.push(...q.slice(0,3));curbUV.push(q[3],0,0);
  }
  if(!causewayAt((ax+bx)*.5,(az+bz)*.5,.65)&&!parkGrade&&!islandWay&&!bridge&&!causeway&&!corridor?.terraceGrade(ax,az)&&(!parks.lotus||Math.hypot(ax-parks.lotus.hero.x,az-parks.lotus.hero.z)>.72)&&!wet(C[0],C[2])&&!wet(D[0],D[2])){
   const lowerC=[C[0],Math.min(C[1],terrainSurfaceY(C[0],C[2])-.002),C[2],u];
   const lowerD=[D[0],Math.min(D[1],terrainSurfaceY(D[0],D[2])-.002),D[2],v];
   for(const q of [C,lowerC,D,D,lowerC,lowerD]){
    curbPositions.push(...q.slice(0,3));curbUV.push(q[3],0,0);
   }
  }
 }
}
// Spatially index the rendered deck itself, so walking uses its continuous height.
const deckIndex=f.visualOnly?supplementalDeck:deckSegments;
for(let i=1;i<points.length;i++){
 const a=points[i-1],b=points[i],segment={a,b,ya:(vertices[(i-1)*6+1]+vertices[(i-1)*6+4])/2,yb:(vertices[i*6+1]+vertices[i*6+4])/2,bridge,width,causeway:baidiAxis||causeway||Boolean(newAxis)};
 for(let ix=Math.floor(Math.min(a[0],b[0])*2);ix<=Math.floor(Math.max(a[0],b[0])*2);ix++)
 for(let iz=Math.floor(Math.min(a[1],b[1])*2);iz<=Math.floor(Math.max(a[1],b[1])*2);iz++){
  const key=ix+','+iz;if(!deckIndex.has(key))deckIndex.set(key,[]);deckIndex.get(key).push(segment);
 }
}
if(baidiAxis||newAxis||((p.name==='杨公堤')&&points.every(([x,z])=>causewayAt(x,z,.145))))continue;
if(causeway&&!bridge){
 // Give the mapped embankment a visible side down to the waterline.
 const count=vertices.length/3;
 for(let i=0;i<count;i++){
  vertices.push(vertices[i*3],.035,vertices[i*3+2]);
  paving.push(paving[i*3],.035/.009,paving[i*3+2]);
 }
 for(let i=2;i<count;i++){
  const previous=i-2;
  if(i%2===0)ids.push(previous,previous+count,i,i,previous+count,i+count);
  else ids.push(previous,i,previous+count,i,i+count,previous+count);
 }
}
const g=new T.BufferGeometry();
if(onSoil.some(Boolean)&&!causeway){const pos=[],uv=[],indices=[],across=Math.max(1,Math.ceil(width/.015)),columns=across+1;
 for(let i=0;i<points.length;i++)for(let j=0;j<=across;j++){const t=j/across,k=i*6,x=vertices[k]+(vertices[k+3]-vertices[k])*t,z=vertices[k+2]+(vertices[k+5]-vertices[k+2])*t,y=onSoil[i]?pavedGround(x,z,vertices[k+1]+(vertices[k+4]-vertices[k+1])*t):vertices[k+1]+(vertices[k+4]-vertices[k+1])*t;pos.push(x,y,z);uv.push(lengths[i]/.012,t*width/.009,2*t-1);if(i&&j){const a=(i-1)*columns+j-1,b=a+1,c=i*columns+j-1,d=c+1;indices.push(a,c,b,b,c,d);}}
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('pavingCoord',new T.Float32BufferAttribute(uv,3));g.setIndex(indices);
}else{g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('pavingCoord',new T.Float32BufferAttribute(paving,3));g.setIndex(ids);}g.computeVertexNormals();add(g,ink?mat.ink:bridge?mat.bridge:mat.road);if(flatBridge)islandDecks.push(vertices);else if(bridge&&!f.visualOnly&&!points.some(([x,z])=>causewayAt(x,z,.39))&&!points.every(([x,z])=>corridor?.bridgeheadGrade(x,z)))addBridgeBalustrade(scene,vertices,width);
}
flushBridgeDetails(scene);
if(curbPositions.length){
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(curbPositions,3));
 geometry.setAttribute('pavingCoord',new T.Float32BufferAttribute(curbUV,3));
 geometry.computeVertexNormals();
 const granite=new T.MeshStandardMaterial({color:0xa6a39a,roughness:.92,side:T.DoubleSide});
 textureSurface(granite,'masonry');
 add(geometry,granite).name='Batched granite path curbs';
}
// Batch static road and bridge decks without changing their topology or heights.
const roadMeshes=[...(rebuiltBaidi?[rebuiltBaidi.walking]:[]),...rebuiltDecks.map(deck=>deck.walking)];
for(const material of [mat.road,mat.bridge,mat.ink]){
 const meshes=scene.children.filter(object=>object.isMesh&&!object.isInstancedMesh&&object.material===material);
 const positions=[],normals=[],paving=[];
 for(const mesh of meshes){const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
  for(const value of g.attributes.position.array)positions.push(value);
  for(const value of g.attributes.normal.array)normals.push(value);
  for(const value of g.attributes.pavingCoord.array)paving.push(value);
  scene.remove(mesh);g.dispose();mesh.geometry.dispose();
 }
 if(positions.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('pavingCoord',new T.Float32BufferAttribute(paving,3));roadMeshes.push(add(g,material));}
}
function sampledDeckHeight(x,z,grids){
 const replacement=causewayAt(x,z,.068);
 if(replacement)return replacement.model.surface(replacement.s);
 const custom=corridor?.sampleNear(x,z);
 if(custom&&custom.distance<.048&&custom.s>.001&&custom.s<corridor.length-.001)return corridor.surface(custom.s);
 let y=walkingGround(x,z)+.025,best=Infinity;
 const ix=Math.floor(x*2),iz=Math.floor(z*2);
 for(const grid of grids)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const edge of grid.get((ix+dx)+','+(iz+dz))||[]){
  const vx=edge.b[0]-edge.a[0],vz=edge.b[1]-edge.a[1];
  const t=Math.max(0,Math.min(1,((x-edge.a[0])*vx+(z-edge.a[1])*vz)/(vx*vx+vz*vz||1)));
  const distance=Math.hypot(x-edge.a[0]-t*vx,z-edge.a[1]-t*vz);
  if(distance<Math.max(.015,edge.width*.6)&&distance<best){best=distance;y=edge.ya+(edge.yb-edge.ya)*t;}
 }
 return y;
}
const primaryGrid=[deckSegments],tourGrids=[deckSegments,supplementalDeck];
function walkHeight(x,z){return sampledDeckHeight(x,z,primaryGrid);}
function tourHeight(x,z){return sampledDeckHeight(x,z,tourGrids);}
function nearRoad(x,z,radius,bridgeOnly=false){
 const ix=Math.floor(x*2),iz=Math.floor(z*2);
 for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const grid of [deckSegments,supplementalDeck,vegetationConnectors])for(const edge of grid.get((ix+i)+','+(iz+j))||[]){
  if(bridgeOnly&&!edge.bridge&&!edge.causeway)continue;
  const dx=edge.b[0]-edge.a[0],dz=edge.b[1]-edge.a[1];
  const t=Math.min(1,Math.max(0,((x-edge.a[0])*dx+(z-edge.a[1])*dz)/(dx*dx+dz*dz||1)));
  if((x-edge.a[0]-t*dx)**2+(z-edge.a[1]-t*dz)**2<(radius+edge.width*.5)**2)return true;
 }
 return false;
}
function roadsideHeight(x,z){
 const cause=causewayAt(x,z);if(cause&&cause.distance>.055)return cause.model.grassHeight?.(cause.s)??cause.model.grassY;
 return terrainSurfaceY(x,z);
}
const vegetationConnectors=new Map();
const plantingNetwork=createWalkNetwork([...paths,...supplementPaths],[...pathNodeIds,...supplementNodeIds],(a,b)=>[.12,.28,.5,.72,.88].every(t=>!wet(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)));
for(const e of plantingNetwork.edges){if(e.inactive||!e.stitch)continue;const segment={a:[e.a.x,e.a.z],b:[e.b.x,e.b.z],width:.018,bridge:false};for(let x=Math.floor(Math.min(e.a.x,e.b.x)*2);x<=Math.floor(Math.max(e.a.x,e.b.x)*2);x++)for(let z=Math.floor(Math.min(e.a.z,e.b.z)*2);z<=Math.floor(Math.max(e.a.z,e.b.z)*2);z++){const key=x+','+z;if(!vegetationConnectors.has(key))vegetationConnectors.set(key,[]);vegetationConnectors.get(key).push(segment);}}
const pavingIndex=createWalkSurface(roadMeshes,.05,{topsOnly:true});
const contextStats=populate(scene,{...data.context,nearRoad,roadsideHeight,causewayAt,spotMasks,lakeField,parks,island,corridor,waterfronts,pavingHeight:(x,z)=>pavingIndex.height(x,z)},terrainSurfaceY,wet);
let lakePhase=0,gardenPhase=0,lastLakeTime=0;
function update(t,wind,month,night,weather,visual){
 const velocity=Math.min(2,Math.max(0,wind));
 contextStats.update(t,velocity,month,night,visual?.direction);
 const dt=Math.max(0,Math.min(.10,t-lastLakeTime));lastLakeTime=t;
 lakePhase+=dt*(.55+velocity*.57);gardenPhase+=dt*.58*(.55+velocity*.22*.57);
 gardenWater.uniforms.lakeTime.value=gardenPhase;
 gardenWater.uniforms.lakeRain.value=(visual?.rainLevel??0)*.64;
 gardenWater.uniforms.lakeWind.value=velocity*.22;
 lake.uniforms.lakeTime.value=lakePhase;
 lake.uniforms.lakeWind.value=velocity;
 lake.uniforms.lakeRain.value=visual?.rainLevel??(weather==='rain'?1:0);
 if(visual)lake.uniforms.lakeWindDirection.value.copy(visual.direction);
}
function setLakeLight(top,horizon,sun,daylight){
 lake.uniforms.lakeSkyTop.value.copy(top);
 lake.uniforms.lakeSkyHorizon.value.copy(horizon);
 lake.uniforms.lakeSun.value.copy(sun);
 lake.uniforms.lakeDaylight.value=daylight;
 gardenWater.uniforms.lakeSkyTop.value.copy(top);
 gardenWater.uniforms.lakeSkyHorizon.value.copy(horizon);
 gardenWater.uniforms.lakeSun.value.copy(sun);
 gardenWater.uniforms.lakeDaylight.value=daylight;
}
function setLakeWakes(boats){
 lake.uniforms.lakeWakes.value.forEach((wake,i)=>{
  const boat=boats[i];
  if(!boat){wake.set(999,999,0,0);return;}
  wake.set(boat.position.x,boat.position.z,Math.sin(boat.rotation.y),Math.cos(boat.rotation.y));
 });
}
return {scene,paths,pathNodeIds,wet,ground,terrainSurfaceY,nearRoad,roadsideHeight,causewayAt,rebuiltCauseways,walkHeight,tourHeight,roadMeshes,
 terrainMesh,waterMeshes,supplementPaths,supplementNodeIds,scenicPlans,parks,island,islandDecks,corridor,waterfronts,update,setLakeLight,setLakeWakes,
 geo:true,contextStats,parkConnections:Object.fromEntries(parkTrails.map(f=>[f.parkTrail,f.connections])),stats:{roads:paths.length,bridgeCount,causewaySegments,outer:outer.length,inner:inner.length}};
}
