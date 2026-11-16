import {mappedBuildingPassages} from './building-passages.js';
import {maskWaterfrontTree,maskWaterfrontBuilding} from './waterfront-sites.js';
import {PINGHU_COORDS} from './baidi-corridor.js';
import {PARK_SITES} from './park-sites.js';
import {swayFoliage} from './weather-motion.js';
import {inBounds,clipRing,clipRoad} from './sandbox-bounds.js';
import {hideSubmergedGround} from './lake-material.js';
import {textureBuildings, textureSurface} from './surface-materials.js';
import {addContacts} from './contact-shadows.js';
import * as T from '../assets/three.module.js';
import {latLonToScene,sceneToLatLon} from './projection.js';
export function populate(scene,data,ground,wet){
const buildings=[],trees=[],forests=[],rows=[];const heightSources={};let seed=778;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const project=p=>{const q=latLonToScene(p.lat,p.lon);return [q.x,q.z]};
function inside(x,z,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!=(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}

const masks=data.spotMasks||[];
const maskedTree=(x,z)=>Boolean(data.nearRoad?.(x,z,.008))||Boolean(data.causewayAt?.(x,z,.49))||data.nearRoad?.(x,z,.055,true)||maskWaterfrontTree(data.waterfronts,x,z)||data.corridor?.isReplacement(x,z)||masks.some(m=>m.trees&&(x-m.x)**2+(z-m.z)**2<m.radius*m.radius);
let excludedBuildings=0,excludedTrees=0,islandBuildingsRemoved=0,replacedTowerFootprints=0;
const stoneTowerFootprints=new Set([975360500,975360502]);
function maskedBuilding(outline,id){
 const open=outline.slice(0,-1);
 const x=open.reduce((sum,p)=>sum+p[0],0)/open.length;
 const z=open.reduce((sum,p)=>sum+p[1],0)/open.length;
 if(maskWaterfrontBuilding(data.waterfronts,x,z,id))return true;
 if(data.corridor?.isReplacement(x,z))return true;
 if(data.island?.contains(x,z)){islandBuildingsRemoved++;return true;}
 for(const mask of masks){
  if(mask.treeOnly)continue;
  if(mask.behindStreet&&z>mask.behindStreet.z-.025)continue;
  const r2=mask.radius**2;
  if((x-mask.x)**2+(z-mask.z)**2<r2)return true;
  const covered=open.filter(([a,b])=>(a-mask.x)**2+(b-mask.z)**2<r2).length;
  if(covered>open.length*.40)return true;
  if(mask.behindStreet||(x-mask.x)**2+(z-mask.z)**2>r2*5)continue;
  for(let i=1;i<outline.length;i++){
   const [ax,az]=outline[i-1],[bx,bz]=outline[i],dx=bx-ax,dz=bz-az;
   const t=Math.max(0,Math.min(1,((mask.x-ax)*dx+(mask.z-az)*dz)/(dx*dx+dz*dz||1)));
   if((ax+dx*t-mask.x)**2+(az+dz*t-mask.z)**2<r2*.58)return true;
  }
 }
 return false;
}
let greenAreas=0;
const grassMaterial=new T.MeshStandardMaterial({color:0x91a66b,roughness:1,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
textureSurface(grassMaterial, 'ground');
if(data.lakeField)hideSubmergedGround(grassMaterial,data.lakeField);
const grassPositions=[],grassNormals=[];
for(const e of data.elements||[]){const tags=e.tags||{};if(!['grass','meadow','orchard'].includes(tags.landuse)&&tags.leisure!=='garden')continue;const p=clipRing((e.geometry||[]).map(project),2.5);if(p.length<4)continue;
const garden=data.waterfronts?.flower.center;
if(p.some(([x,z])=>data.causewayAt?.(x,z,.31)))continue;
if(garden&&(p.some(([x,z])=>Math.abs(x-garden.x)<1.18&&Math.abs(z-garden.z)<.88)||
 inside(garden.x,garden.z,p)||inside(garden.x,garden.z+.64,p)))continue;
const shape=new T.Shape(p.map(([x,z])=>new T.Vector2(x,-z)));const geometry=new T.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);const position=geometry.attributes.position;for(let i=0;i<position.count;i++)position.setY(i,ground(position.getX(i),position.getZ(i))+.012);geometry.computeVertexNormals();const flat=geometry.toNonIndexed();
for(const value of flat.attributes.position.array)grassPositions.push(value);
for(const value of flat.attributes.normal.array)grassNormals.push(value);
flat.dispose();geometry.dispose();greenAreas++;}
if(grassPositions.length){
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(grassPositions,3));
 geometry.setAttribute('normal',new T.Float32BufferAttribute(grassNormals,3));
 const grass=new T.Mesh(geometry,grassMaterial);grass.receiveShadow=true;scene.add(grass);
}
const night={value:0}, contacts=[];
const wall=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.9});
textureBuildings(wall,night);
const positions=[],normals=[],colors=[],facades=[];
let pitchedRoofs=0, parapets=0;
const facadeColor=new T.Color(), roofColor=new T.Color();
function appendBuildingTriangle(a,b,c,color,base,windowFace){
 const ab=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
 const ac=new T.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
 const n=ab.cross(ac).normalize();
 for(const [x,y,z] of [a,b,c]){
  positions.push(x,y,z);normals.push(n.x,n.y,n.z);colors.push(color.r,color.g,color.b);
  facades.push(x*n.z-z*n.x,y-base,windowFace);
 }
}
const historicCenters=[PARK_SITES.willow,PARK_SITES.lotus,
 latLonToScene(30.233,120.142),latLonToScene(...PINGHU_COORDS)];
function heritageKind(outline){
 const x=outline.reduce((sum,p)=>sum+p[0],0)/outline.length;
 const z=outline.reduce((sum,p)=>sum+p[1],0)/outline.length;
 const flower=data.waterfronts?.flower.center;
 if(flower&&Math.hypot((x-flower.x)*.74,(z-flower.z)*.94)<1.14)return 'park';
 const willow=data.parks?.willow.hero;
 if(willow&&Math.hypot((x-willow.x)*.72,(z-willow.z)*.96)<.78)return 'willow';
 const {lat,lon}=sceneToLatLon(x,z);
 if(lat>=30.2375&&lat<=30.2435&&lon>=120.1525&&lon<=120.1570)return 'willow';
 if(lat>=30.252&&lat<=30.2585&&lon>=120.1345&&lon<=120.1445)return 'island';
 return historicCenters.some(p=>Math.hypot(x-p.x,z-p.z)<.45)?'park':null;
}
let heritageTrimmed=0,willowRemoved=0;
function addRoof(outline, height, top, heritage){
 const points=outline.slice(0,-1);
 if(points.length<3||points.length>16)return;
 const signedArea=points.reduce((sum,a,i)=>{
  const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];
 },0);
 if(Math.abs(signedArea)<1e-7)return;
 if(signedArea>0)points.reverse();
 const center=points.reduce(([x,z],p)=>[x+p[0]/points.length,z+p[1]/points.length],[0,0]);
 const xs=points.map(p=>p[0]), zs=points.map(p=>p[1]);
 const span=Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs));
 if(span<.018)return;
 const convex=points.every((a,i)=>{
  const b=points[(i+1)%points.length],c=points[(i+2)%points.length];
  return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])<=1e-9;
 });
 if(height<=.12&&convex&&points.length<=9){
  pitchedRoofs++;
  const peak=[center[0],top+Math.min(.036,span*.22),center[1]];
  const eave=points.map(([x,z])=>{
   const d=Math.hypot(x-center[0],z-center[1])||1;
   return [x+(x-center[0])*.003/d,top+.0004,z+(z-center[1])*.003/d];
  });
  roofColor.setHex(heritage?0x3b4240:0x3d4644);
  eave.forEach((a,i)=>appendBuildingTriangle(a,eave[(i+1)%eave.length],peak,roofColor,top,0));
 }else if(height>.12){
  parapets++;
  roofColor.setHex(0x777a73);
  points.forEach((a,i)=>{
   const b=points[(i+1)%points.length], dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz);
   if(len<.006)return;
   const insetX=dz*.003/len,insetZ=-dx*.003/len;
   const l=[a[0],top,a[1]],r=[b[0],top,b[1]],lt=[a[0],top+.006,a[1]],rt=[b[0],top+.006,b[1]];
   const li=[lt[0]+insetX,lt[1],lt[2]+insetZ],ri=[rt[0]+insetX,rt[1],rt[2]+insetZ];
   appendBuildingTriangle(l,r,lt,roofColor,top,0);appendBuildingTriangle(lt,r,rt,roofColor,top,0);
   appendBuildingTriangle(lt,rt,li,roofColor,top,0);appendBuildingTriangle(li,rt,ri,roofColor,top,0);
  });
 }
}
const foundationPositions=[],foundationUV=[];let foundationCount=0;
for(const e of data.elements||[]){const tags=e.tags||{};if(tags.natural==='tree'&&Number.isFinite(e.lat)){const p=project(e);if(inBounds(...p)&&!wet(...p))trees.push([...p,Math.min(25,Math.max(3,parseFloat(tags.height)||8))*.01]);}if(!e.geometry)continue;const raw=e.geometry.map(project);if(tags.natural==='tree_row')rows.push(...clipRoad(raw,null,e.id).map(row=>row.points));
const p=clipRing(raw,2.5);
if(tags.building&&p.length>3){buildings.push(p);if(data.island&&stoneTowerFootprints.has(Number(e.id))){excludedBuildings++;replacedTowerFootprints++;continue;}if(maskedBuilding(p,e.id)){excludedBuildings++;continue;}let h=parseFloat(tags.height);if(!Number.isFinite(h)){h=(parseFloat(tags['building:levels'])||2)*3;}const heritage=heritageKind(p);
if(heritage==='willow'&&h>8){excludedBuildings++;willowRemoved++;continue;}
const source=heritage?'park_height_cap':tags.height_source||(tags.height?'osm_height':tags['building:levels']?'osm_levels':'fallback');
heightSources[source]=(heightSources[source]||0)+1;
if(heritage){h=Math.max(4.5,Math.min(8.5,h));heritageTrimmed++;}
h=Math.min(150,Math.max(2,h))*.01;const shape=new T.Shape(p.map(([x,z])=>new T.Vector2(x,-z)));let geometry=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false});
geometry.rotateX(-Math.PI/2);
const elevation=p.map(q=>ground(...q));
const minGroundY=Math.min(...elevation);
const dryElevations=elevation.filter(y=>y>=.044);
const baseY=dryElevations.length?Math.max(.046,Math.min(...dryElevations)+.008):.045;
const footing=Math.min(.02,minGroundY-.08);
for(let i=1;i<p.length;i++){
 const [x,z]=p[i-1],[X,Z]=p[i],n=Math.max(1,Math.ceil(Math.hypot(X-x,Z-z)/.01));
 for(let j=0;j<n;j++){const ax=x+(X-x)*j/n,az=z+(Z-z)*j/n,bx=x+(X-x)*(j+1)/n,bz=z+(Z-z)*(j+1)/n,level=data.pavingHeight?.((ax+bx)/2,(az+bz)/2);if(level!=null&&level<baseY+.04&&level+.022>baseY)continue;
 const length=Math.hypot(bx-ax,bz-az)/.016,a=[ax,baseY+.0003,az],b=[bx,baseY+.0003,bz],c=[ax,footing,az],d=[bx,footing,bz];for(const point of [a,c,b,b,c,d])foundationPositions.push(...point);foundationUV.push(0,0,0,0,0,0,length,0,0,length,0,0,0,0,0,length,0,0);}
}
foundationCount++;
if(data.pavingHeight){const passage=mappedBuildingPassages(geometry,p,baseY,h,data.pavingHeight);if(passage.openings){geometry.dispose();geometry=passage.geometry;}}
const position=geometry.attributes.position, normal=geometry.attributes.normal;
facadeColor.setHSL(.075+random()*.045,.10+random()*.15,.56+random()*.18);
if(heritage)facadeColor.setHex(0xf0ede4);
const {lat,lon}=sceneToLatLon(...p[0]);
if(lat>=30.2465&&lat<=30.2565&&lon>=120.1585&&lon<=120.1635)
 facadeColor.setHex([0xb7a78f,0x9cafb0,0xc8bba5,0xb1a7a0][Number(e.id)%4]||0xb5b8b4);
roofColor.setHex(heritage?0x3b4240:0x68736f);
const facadeSeed=1+random()*127;
for(let i=0;i<position.count;i++){
 const x=position.getX(i),z=position.getZ(i),y=position.getY(i);
 const nx=normal.getX(i),ny=normal.getY(i),nz=normal.getZ(i),face=Math.abs(ny)<.35;
 positions.push(x,y+baseY,z);normals.push(nx,ny,nz);
 const color=face?facadeColor:roofColor;
 colors.push(color.r,color.g,color.b);facades.push(x*nz-z*nx,y,face?facadeSeed:0);
}
geometry.dispose();
addRoof(p,h,baseY+h,heritage);
const x=p[0][0],z=p[0][1];
if(data.nearRoad?.(x,z,.16)&&!wet(x,z))contacts.push([x,ground(x,z),z,.038,.032]);
}else if(p.length>=4&&(tags.natural==='wood'||tags.landuse==='forest'))forests.push(p);}
if(positions.length){
 const geometry=new T.BufferGeometry();
 for(const [name,array] of [['position',positions],['normal',normals],['color',colors],['facadeCoord',facades]])
  geometry.setAttribute(name,new T.Float32BufferAttribute(array,3));
 const mesh=new T.Mesh(geometry,wall);mesh.name='Batched city buildings';mesh.userData.openGroundPassages=true;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
}
if(foundationPositions.length){
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(foundationPositions,3));
 geometry.setAttribute('pavingCoord',new T.Float32BufferAttribute(foundationUV,3));
 geometry.computeVertexNormals();
 const material=new T.MeshStandardMaterial({color:0x898980,roughness:.94,side:T.DoubleSide});
 textureSurface(material,'masonry');
 const foundation=new T.Mesh(geometry,material);
 foundation.name='Batched stone building foundations';foundation.receiveShadow=true;
 scene.add(foundation);
}
const observed=trees.length;let rowTrees=0;
if(!data.canopy)for(const row of rows)for(let i=1;i<row.length;i++){const a=row[i-1],b=row[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(length/.08);for(let k=0;k<n;k++){const t=k/n,x=a[0]+t*(b[0]-a[0]),z=a[1]+t*(b[1]-a[1]);if(!wet(x,z)&&!buildings.some(p=>inside(x,z,p))){trees.push([x,z,.08]);rowTrees++;}}}

if(!data.canopy)for(const p of forests){const xs=p.map(q=>q[0]),zs=p.map(q=>q[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);const count=Math.min(5000,Math.ceil((maxX-minX)*(maxZ-minZ)*20));for(let i=0;i<count&&trees.length<12000;i++){const x=minX+random()*(maxX-minX),z=minZ+random()*(maxZ-minZ);if(inside(x,z,p)&&!wet(x,z)&&!buildings.some(b=>inside(x,z,b)))trees.push([x,z,.06+random()*.09]);}}
// Raster canopy replaces illustrative forest and default-height row samples.
// All positions still pass the reconstructed lake mask before rendering.
let rasterCanopyTrees=0;
if(data.canopy){
  trees.length=0;
  for(const [lon,lat,height] of data.canopy.points){
    const p=latLonToScene(lat,lon);
    if(Number.isFinite(height)&&height>=3&&inBounds(p.x,p.z)&&!wet(p.x,p.z)){
      trees.push([p.x,p.z,height*.01]);rasterCanopyTrees++;
    }
  }
}
function canopyGeometry(detail){
 const positions=[], normals=[];
 const lobes=detail ? [[-.29,.02,0,.67],[.29,.15,.12,.67],[0,.41,-.14,.71],[.12,-.12,-.28,.57]] :
 [[-.26,0,0,.76],[.28,.11,.12,.72],[0,.42,-.15,.68]];
 for(const [x,y,z,radius] of lobes){
  const lobe=new T.IcosahedronGeometry(1,detail);
  lobe.scale(radius,radius,radius);lobe.translate(x,y,z);
  const p=lobe.attributes.position;
  for(let i=0;i<p.count;i++){
   const point=new T.Vector3().fromBufferAttribute(p,i);
   const local=point.clone().sub(new T.Vector3(x,y,z)).normalize();
   const spherical=point.clone().sub(new T.Vector3(0,.15,0)).normalize();
   local.lerp(spherical,.42).normalize();
   positions.push(...point.toArray());normals.push(...local.toArray());
  }
  lobe.dispose();
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 return geometry;
}
const retainedTrees=trees.filter(([x,z])=>{
 if(inBounds(x,z)&&!maskedTree(x,z)&&!data.island?.contains(x,z))return true;
 excludedTrees++;return false;
});
const dummy=new T.Object3D(), tall=[], distant=[], understory=[], shoreline=[];
function treeCells(points){
 const cells=new Map();
 for(const point of points){
  const key=Math.floor(point.x/6)+','+Math.floor(point.z/6);
  if(!cells.has(key))cells.set(key,[]);
  cells.get(key).push(point);
 }
 return cells.values();
}
retainedTrees.forEach(([x,z,h],i)=>{
 const y=(data.roadsideHeight||ground)(x,z);
 const shore=h>=.048&&[[.10,0],[-.10,0],[0,.10],[0,-.10]].some(([dx,dz])=>wet(x+dx,z+dz));
 const road=(i%2===0)&&data.nearRoad?.(x,z,.15);
 const tree={x,y,z,h,willow:shore,deciduous:!shore&&random()<(h>.13?.4:.21),tint:random()};
 if((shore||road)&&tall.length<1850)tall.push(tree);else distant.push(tree);
 if(shore&&shoreline.length<1000)shoreline.push(tree);
 if((shore||road)&&understory.length<2100){
  contacts.push([x,y,z,.016,.013]);
  const dx=(random()-.5)*.045,dz=(random()-.5)*.045;
  const nearPath=data.nearRoad?.(x+dx,z+dz,.038);
  if(inBounds(x+dx,z+dz)&&!nearPath&&!wet(x+dx,z+dz))understory.push([x+dx,z+dz,shore]);
 }
});
const islandTrees=[],islandFlowers=[];
if(data.island){
 const {bounds,contains,stage,shoreDistance}=data.island;
 const candidates=[],step=.046;
 for(let z=bounds.minZ;z<bounds.maxZ;z+=step)for(let x=bounds.minX;x<bounds.maxX;x+=step){
  const a=x+(random()-.5)*step*.72,b=z+(random()-.5)*step*.72;
  if(!contains(a,b)||wet(a,b)||data.nearRoad(a,b,.021))continue;
  if(stage.some(site=>Math.abs(a-site.x)<site.w*.62+.032&&Math.abs(b-site.z)<site.d*.65+.035))continue;
  if([[.013,0],[-.013,0],[0,.013],[0,-.013]].some(([dx,dz])=>wet(a+dx,b+dz)))continue;
  candidates.push({a,b,order:random()});
 }
 candidates.sort((a,b)=>a.order-b.order);
 for(const {a:x,b:z} of candidates.slice(0,880)){
  const y=(data.roadsideHeight||ground)(x,z),shore=shoreDistance(x,z)<.13;
  const willow=shore&&random()<.66;
  const tree={x,y,z,h:willow?.085+random()*.078:.103+random()*.091,
   willow,deciduous:!willow&&random()<.33,tint:random(),island:true};
  islandTrees.push(tree);
  distant.push(tree);
  if(willow)shoreline.push(tree);
  if(shore&&random()<.35){
   const sx=(random()-.5)*.035+x,sz=(random()-.5)*.035+z;
   if(contains(sx,sz)&&!wet(sx,sz)&&!data.nearRoad(sx,sz,.023)){
    understory.push([sx,sz,false]);
    islandFlowers.push([sx,ground(sx,sz)+.017,sz]);
   }
  }
 }
}
const blossoms=new T.InstancedMesh(new T.IcosahedronGeometry(.004,1),new T.MeshStandardMaterial({roughness:.8}),islandFlowers.length*3);
const flowerColor=new T.Color();
islandFlowers.forEach(([x,y,z],i)=>{
 for(let j=0;j<3;j++){
  dummy.rotation.set(0,0,0);
  dummy.position.set(x+(j-1)*.006,y+(j%2)*.005,z+Math.sin(i+j)*.005);
  dummy.scale.setScalar(.65+random()*.5);dummy.updateMatrix();blossoms.setMatrixAt(i*3+j,dummy.matrix);
  blossoms.setColorAt(i*3+j,flowerColor.set(j===1?0xf2dfdc:0xcb8f9c));
 }
});
blossoms.name='Xiaoyingzhou hibiscus';scene.add(blossoms);
const trunkGeometry=new T.CylinderGeometry(.0012,.0022,1,5,1,true);
const trunkMaterial=new T.MeshStandardMaterial({color:0x64503b});
for(const points of treeCells([...distant,...tall])){
 const trunks=new T.InstancedMesh(trunkGeometry,trunkMaterial,points.length);
 points.forEach(({x,y,z,h},i)=>{
  dummy.position.set(x,y+h*.35,z);dummy.scale.set(1,h*.7,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
 });
 trunks.name='Regional tree trunks';
 scene.add(trunks);
}
const seasonal=[];
const wind={value:new T.Vector3(1,0,0)},time={value:0};
for(const [points,detail] of [[distant,0],[tall,1]]){
 const geometry=canopyGeometry(detail),material=new T.MeshStandardMaterial({roughness:.93});

 for(const batch of treeCells(points)){
  const mesh=new T.InstancedMesh(geometry,material,batch.length);
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=detail?'Detailed path canopies':'Regional canopies';
  batch.forEach(({x,y,z,h,tint,island},i)=>{
   dummy.position.set(x,y+h*.70,z);dummy.rotation.y=tint*6.28;
   const width=h*(island?.424:.30);
   dummy.scale.set(width,h*.265,width);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  });
  scene.add(mesh);seasonal.push([mesh,batch]);
 }
 dummy.rotation.set(0,0,0);
}
const willowMaterial=new T.MeshStandardMaterial({color:0x86aa52,roughness:.87});

const pendants=new T.InstancedMesh(new T.SphereGeometry(1,6,4),willowMaterial,shoreline.length*7);
shoreline.forEach(({x,y,z,h},i)=>{
 for(let k=0;k<7;k++){
  const angle=k*Math.PI*2/7;
  dummy.position.set(x+Math.sin(angle)*h*.23,y+h*(.46+.13*random()),z+Math.cos(angle)*h*.23);
  dummy.rotation.set(.18*Math.cos(angle),angle,.16*Math.sin(angle));
  dummy.scale.set(h*.046,h*(.14+.12*random()),h*.045);
  dummy.updateMatrix();pendants.setMatrixAt(i*7+k,dummy.matrix);
 }
});
pendants.castShadow=true;scene.add(pendants);
const shrubs=new T.InstancedMesh(canopyGeometry(0),new T.MeshStandardMaterial({color:0x527840,roughness:.92}),understory.length);
const reeds=new T.InstancedMesh(new T.CylinderGeometry(.001,.002,1,4),new T.MeshStandardMaterial({color:0x748b43,roughness:.85}),understory.filter(p=>p[2]).length*3);
let reedIndex=0;
understory.forEach(([x,z,shore],i)=>{
 const y=(data.roadsideHeight||ground)(x,z),h=.015+.015*random();
 dummy.rotation.set(0,0,0);
 dummy.position.set(x,y+h*.39,z);dummy.scale.set(h*.63,h*.61,h*.63);dummy.updateMatrix();shrubs.setMatrixAt(i,dummy.matrix);
 if(shore)for(let k=0;k<3;k++){
  dummy.position.set(x+k*.004,y+h*.58,z);dummy.scale.set(1,h*1.15,1);
  dummy.rotation.z=(k-1)*.19;dummy.updateMatrix();reeds.setMatrixAt(reedIndex++,dummy.matrix);
 }
});
scene.add(shrubs,reeds);addContacts(scene,contacts);
let phase=0,previousTime=0;
let previousMonth;
function update(t,currentWind,month,isNight,direction){
 night.value=isNight?1:0;wind.value.set(direction?.x??1,direction?.y??0,currentWind);phase+=Math.max(0,Math.min(.10,t-previousTime))*(1.3+2.2*currentWind);previousTime=t;time.value=phase;
 if(previousMonth===month)return;
 previousMonth=month;blossoms.visible=month>=8&&month<=11;
 const autumn=Math.max(0,1-Math.abs(month-10)/2),color=new T.Color(),ochre=new T.Color();
 for(const [mesh,points] of seasonal){
  points.forEach(({willow,deciduous,tint},i)=>{
   color.setHSL(willow?.232:deciduous?.27:.31,.40+tint*.15,.26+tint*.15);
   if(deciduous)color.lerp(ochre.setHSL(.035+tint*.095,.63,.39+tint*.11),autumn*.92);
   mesh.setColorAt(i,color);
  });
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 }
}
update(0,0,7,false);
return {
 update,foundationCount,pitchedRoofs,parapets,excludedBuildings,excludedTrees,islandBuildingsRemoved,replacedTowerFootprints,islandTrees:islandTrees.length,heritageTrimmed,willowRemoved,understory:understory.length,illustrativeWillows:shoreline.length,
 greenAreas,heightSources,buildings:buildings.length-excludedBuildings,
 estimatedBuildingHeights:Object.entries(heightSources).filter(([source])=>source!=='osm_height'&&source!=='overture_height').reduce((sum,[,count])=>sum+count,0),
 osmTreePoints:observed,treeRows:rows.length,estimatedRowTrees:rowTrees,rasterCanopyTrees:Math.max(0,rasterCanopyTrees-excludedTrees),
 illustrativeForestTrees:data.canopy?0:trees.length-observed-rowTrees
};
}


