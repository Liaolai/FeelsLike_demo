import {textureSurface} from './surface-materials.js';
import * as T from '../assets/three.module.js';
import {latLonToScene} from './projection.js';
import {swayFoliage} from './weather-motion.js';

export function createLakeBoats(wet){
  const fleet=new T.Group();fleet.name='西湖游船 · 示意航线';
  const routes=[];
  const wood=new T.MeshStandardMaterial({color:0x855b35,roughness:.75});
  const roof=new T.MeshStandardMaterial({color:0x45534c,roughness:.7});
  const cream=new T.MeshStandardMaterial({color:0xd9cda5,roughness:.8});
  for(const [lat,lon,radius] of [[30.249,120.148,.7],[30.244,120.151,.5],[30.252,120.146,.55],[30.239,120.149,.4]]){
    const center=latLonToScene(lat,lon);
    // Reject an entire loop if either its centreline or boat-width margins
    // touch land. This is an animation path, not a navigation recommendation.
    let safe=true;
    for(let k=0;k<720;k++)for(const offset of [-.06,0,.06]){
      const a=k*Math.PI/360;
      if(!wet(center.x+Math.sin(a)*(radius+offset),center.z+Math.cos(a)*(radius+offset)))safe=false;
    }
    if(!safe)continue;
    const boat=new T.Group();
    function part(g,m,x,y,z){const obj=new T.Mesh(g,m);obj.position.set(x,y,z);obj.castShadow=true;boat.add(obj);return obj;}
    const hull=part(new T.SphereGeometry(1,12,6),wood,0,.002,0);hull.scale.set(.019,.007,.055);
    part(new T.BoxGeometry(.033,.003,.074),cream,0,.007,0);
    for(const x of [-.013,.013])for(const z of [-.024,.024])part(new T.CylinderGeometry(.0012,.0012,.022,5),wood,x,.019,z);
    const top=part(new T.ConeGeometry(.036,.012,4),roof,0,.035,0);top.rotation.y=Math.PI/4;top.scale.z=1.5;
    part(new T.BoxGeometry(.026,.005,.006),wood,0,.012,-.015);
    part(new T.BoxGeometry(.026,.005,.006),wood,0,.012,.015);
    fleet.add(boat);routes.push({boat,center,radius,phase:routes.length*1.7});
  }
  fleet.userData.routes=routes.map(({center,radius})=>({center,radius}));
  fleet.userData.animate=t=>routes.forEach(({boat,center,radius,phase})=>{
    const angle=phase+t*.022/radius;
    boat.position.set(center.x+Math.sin(angle)*radius,.043+Math.sin(t*1.5+phase)*.0008,center.z+Math.cos(angle)*radius);
    boat.rotation.y=angle+Math.PI/2;boat.rotation.z=Math.sin(t*.8+phase)*.025;
  });
  fleet.userData.animate(0);return fleet;
}

export function createLotusBeds(wet,bay,nearRoad=()=>false){
  const group=new T.Group();group.name='曲院风荷 · 四季荷塘';
  const center=bay?.edge??latLonToScene(30.2495,120.1302);
  const inward=bay?.land??{x:-1,z:0};
  const random=parkRandom(96),points=[];
  for(let i=0;i<1500;i++){
    const d=.015+random()*.38,side=(random()-.5)*.67;
    const x=center.x-inward.x*d+inward.z*side,z=center.z-inward.z*d-inward.x*side;
    if(wet(x,z)&&!nearRoad(x,z,.012)){
      points.push({x,z,r:.010+random()*.012,y:.044+random()*.014,color:random(),tilt:(random()-.5)*.27,a:random()*Math.PI*2});
    }
  }
  const leafGeometry=new T.CircleGeometry(1,14,0,Math.PI*1.85).rotateX(-Math.PI/2);
  const leaves=new T.InstancedMesh(leafGeometry,new T.MeshStandardMaterial({roughness:.62,side:T.DoubleSide}),points.length);
  const blooms=points.filter((p,i)=>i%11===0);
  const petals=new T.InstancedMesh(new T.SphereGeometry(1,7,5),new T.MeshStandardMaterial({roughness:.53}),blooms.length*16);
  const pods=new T.InstancedMesh(new T.CylinderGeometry(.0034,.0018,.0036,8),new T.MeshStandardMaterial({color:0xcbad55}),blooms.length);
  const dummy=new T.Object3D(),color=new T.Color();
  points.forEach(({x,z,r,y,tilt,a},i)=>{
    dummy.position.set(x,y,z);dummy.rotation.set(tilt,a,tilt*.6);dummy.scale.set(r,1,r);
    dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
  });
  blooms.forEach(({x,z,y,color:tone},i)=>{
    const bud=i%5===0,base=y+.009;
    for(let layer=0;layer<2;layer++)for(let j=0;j<8;j++){
      const a=(j+layer*.5)*Math.PI/4,r=bud?.0018:layer?.004:.006;
      dummy.position.set(x+Math.sin(a)*r,base+layer*.002,z+Math.cos(a)*r);
      dummy.rotation.set(bud?.34:layer?.68:.98,a,0,'YXZ');
      dummy.scale.set(layer?.0026:.0032,layer?.006:.0068,.00145);
      dummy.updateMatrix();
      const index=i*16+layer*8+j;
      petals.setMatrixAt(index,dummy.matrix);
      petals.setColorAt(index,color.set(tone>.55?0xffe0e7:layer?0xe995b0:0xe06c93));
    }
    dummy.position.set(x,base+.003,z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);
    dummy.updateMatrix();pods.setMatrixAt(i,dummy.matrix);
  });
  leaves.name='Lotus leaves';petals.name='Lotus petals';pods.name='Lotus seed heads';
  leaves.receiveShadow=petals.receiveShadow=true;
  group.add(leaves,petals,pods);
  let previousMonth;
  group.userData.updateSeason=month=>{
    if(previousMonth===month)return;
    previousMonth=month;
    points.forEach(({color:tone},i)=>{
      const bronze=(month>=9||month<=2)&&tone<.30;
      color.set(bronze?0x93944c:tone>.5?0x58874a:0x3e733d).multiplyScalar(.88+tone*.24);
      leaves.setColorAt(i,color);
    });
    if(leaves.instanceColor)leaves.instanceColor.needsUpdate=true;
  };
  group.userData.updateSeason(7);
  return group;
}

function parkRandom(seed){
  return ()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
}

export function pavilionRoof(w,d,base,rise,eaveLift=.46,ridge=.35){
  const points=[],uv=[],indices=[],n=16;
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const u=i/n*2-1,v=j/n*2-1;
    const slope=1-Math.max(Math.abs(v),Math.max(0,(Math.abs(u)-ridge)/(1-ridge)));
    const y=base+rise*slope**1.45+eaveLift*Math.abs(u*v)**4;
    points.push(u*w/2,y,v*d/2);uv.push(i/n,j/n);
  }
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const a=j*(n+1)+i;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

export function createQuyuanPavilion(kind='lotus'){
  const group=new T.Group();
  const white=kind==='willow',small=kind==='hill';
  const stone=new T.MeshStandardMaterial({color:0xb8b3a2,roughness:.89});
  const plaster=new T.MeshStandardMaterial({color:0xf0ede4,roughness:.84});
  const wood=new T.MeshStandardMaterial({color:white?0x624d3b:0x733f2d,roughness:.73});
  const tile=new T.MeshStandardMaterial({color:0x3b4240,roughness:.76,side:T.DoubleSide});
  const lamp=new T.MeshStandardMaterial({name:'Emissive_WarmLamp',color:0xd9ac65,emissive:0xffa845,emissiveIntensity:.08});
  function part(g,mat,x=0,y=0,z=0){
    const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
  }
  const box=(w,h,d,x,y,z,mat=stone)=>part(new T.BoxGeometry(w,h,d),mat,x,y,z);
  const width=white?10:9,depth=white?6.2:6.8;
  box(width,.35,depth,0,.20,0);
  box(width-.34,.16,depth-.28,0,.445,0);
  for(let i=0;i<3;i++)box(3.2,.11,1-i*.26,0,.07+i*.11,depth*.5);
  for(const x of [-3.6,-1.2,1.2,3.6])for(const z of [-2.35,2.35]){
    box(.52,.29,.52,x,.64,z);
    part(new T.CylinderGeometry(.18,.22,3.5,10),wood,x,2.42,z);
    box(.49,.22,.48,x,4.15,z,wood);
  }
  for(const z of [-2.35,2.35])box(7.9,.34,.36,0,3.96,z,wood);
  for(const x of [-3.6,3.6])box(.32,.32,5, x,3.96,0,wood);
  if(white){
    box(8.2,3.0,.32,0,2,-2.1,plaster);
    for(const x of [-3.55,3.55])box(.28,2.8,4.1,x,1.95,0,plaster);
    for(const x of [-2.35,2.35]){
      box(1.35,1.52,.12,x,2.15,2.344,wood);
      for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)
        box(.14,.17,.035,x+i*.21,2.15+j*.23,2.42,plaster);
      const canopy=part(new T.ConeGeometry(.78,.27,10),plaster,x,2.04,4.25);
      canopy.rotation.y=.2;
      part(new T.CylinderGeometry(.045,.05,1.8,7),wood,x,1.03,4.25);
      part(new T.CylinderGeometry(.46,.46,.09,9),wood,x,.88,4.25);
    }
  }else{
    for(const x of [-3.62,3.62]){
      for(let i=0;i<8;i++)box(.10,.66,.10,x,.93,-2.13+i*.58,wood);
      box(.14,.11,4.4,x,1.28,0,wood);
    }
  }
  for(const x of [-2.4,2.4]){
    part(new T.CylinderGeometry(.035,.035,.6,6),wood,x,3.61,2.28);
    part(new T.SphereGeometry(.17,9,7),lamp,x,3.20,2.28);
  }
  part(pavilionRoof(width+.6,depth+.5,4.15,1.13),tile);
  box(width*.42,.17,.19,0,5.31,0,tile);
  if(!white&&!small){
    box(4.4,.8,3,0,5.45,0,wood);
    part(pavilionRoof(6.35,4.95,5.77,1.08),tile);
    box(2.6,.18,.19,0,6.88,0,tile);
  }
  group.scale.setScalar(.01);
  return group;
}

export function createParkScenery(landscape,batchModel=model=>model){
  const {parks,wet,nearRoad,walkHeight,terrainSurfaceY:ground}=landscape;
  const group=new T.Group();group.name='Park shore and hill details';
  const random=parkRandom(271),dummy=new T.Object3D();
  const foliageTime={value:0},foliageWind={value:new T.Vector3(1,0,.05)};
  const crownMaterial=new T.MeshStandardMaterial({roughness:.85});
  const willowMaterial=new T.MeshStandardMaterial({roughness:.82});


  const lamp=new T.MeshStandardMaterial({color:0xeacb95,emissive:0xff9d37,emissiveIntensity:.07});
  const type={
    trunk:[new T.CylinderGeometry(.5,.75,1,8),new T.MeshStandardMaterial({color:0x514834})],
    white:[new T.CylinderGeometry(.72,.82,1,8),new T.MeshStandardMaterial({color:0xf2f2ee})],
    crown:[new T.SphereGeometry(1,10,7),crownMaterial],
    willow:[new T.SphereGeometry(1,8,7),willowMaterial],
    stone:[new T.BoxGeometry(),new T.MeshStandardMaterial({color:0x9b9f91,roughness:.9})],
    rail:[new T.BoxGeometry(),new T.MeshStandardMaterial({color:0x374e43,roughness:.75})],
    lampBody:[new T.CylinderGeometry(.38,.65,1,7),new T.MeshStandardMaterial({color:0x282f2d})],
    lampGlass:[new T.SphereGeometry(1,8,6),lamp]
  };
  const batches=new Map();
  function add(key,x,y,z,sx,sy,sz,angle=0,color){
    dummy.position.set(x,y,z);dummy.rotation.set(0,angle,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
    if(!batches.has(key))batches.set(key,[]);
    batches.get(key).push({matrix:dummy.matrix.clone(),color});
  }
  function willow(x,z,variation){
    if(wet(x,z))return;
    const y=ground(x,z),h=.070+variation*.033;
    add('trunk',x,y+h*.5,z,.009,h,.009);
    add('white',x,y+.013,z,.0092,.026,.0092);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2,s=.026+variation*.009;
      add('crown',x+Math.sin(a)*.012,y+h*.91,z+Math.cos(a)*.012,s,.027,s*.94,a,i%2?0x72934c:0x658747);
    }
    for(let i=0;i<9;i++){
      const a=(i+variation)*Math.PI*2/9,r=.023+random()*.013,len=.020+random()*.016;
      add('willow',x+Math.sin(a)*r,y+h-.021,z+Math.cos(a)*r,.0036,len,.005,a,i%3?0x6e9448:0x8aa85b);
    }
  }
  const path=parks.willow.path;
  let lastRail;
  for(let i=0;i<path.length;i++){
    const [x,z]=path[i],previous=path[Math.max(0,i-1)],next=path[Math.min(path.length-1,i+1)];
    const dx=next[0]-previous[0],dz=next[1]-previous[1];
    const len=Math.hypot(dx,dz)||1,nx=dz/len,nz=-dx/len;
    if(i%2===0)for(const side of [-1,1]){
      if(side===1&&Math.abs(z-parks.willow.hero.z)<.14)continue;
      willow(x+side*nx*.039,z+side*nz*.039,random());
    }
    const sx=x-nx*.027,sz=z-nz*.027,sy=Math.max(.048,ground(sx,sz))+.009;
    add('stone',sx,sy-.005,sz,.011,.023,.054,Math.atan2(dx,dz));
    add('rail',sx,sy+.020,sz,.0038,.036,.0038);
    if(lastRail){
      const [px,py,pz]=lastRail,span=Math.hypot(sx-px,sz-pz);
      const angle=Math.atan2(sx-px,sz-pz);
      for(const y of [.015,.031])add('rail',(sx+px)/2,(sy+py)/2+y,(sz+pz)/2,.0027,.003,span,angle);
    }
    lastRail=[sx,sy,sz];
    if(i%4===0){
      const lx=x+nx*.031,lz=z+nz*.031,ly=ground(lx,lz);
      add('lampBody',lx,ly+.030,lz,.007,.060,.007);
      add('lampGlass',lx,ly+.059,lz,.005,.006,.005);
    }
  }
  const hill=parks.hill;
  for(let i=0;i<140;i++){
    const r=.15+Math.sqrt(random())*.76,a=random()*Math.PI*2;
    const x=hill.x+Math.sin(a)*r,z=hill.z+Math.cos(a)*r;
    if(wet(x,z)||nearRoad(x,z,.02)||Math.abs(x-hill.x)<.09&&z>hill.z)continue;
    const y=ground(x,z),height=.038+random()*.045,c=.022+random()*.025;
    add('trunk',x,y+height*.5,z,.007,height,.007);
    add('crown',x,y+height,z,c,c*.73,c,a,i%3?0x476d42:0x65834b);
  }
  for(let z=hill.z+.14;z<hill.z+.69;z+=.024){
    if(wet(hill.x,z))continue;
    add('stone',hill.x,Math.max(ground(hill.x,z),walkHeight(hill.x,z))+.002,z,.052,.010,.025);
  }
  function gazebo(x,z,scale,yaw){
    const model=createQuyuanPavilion('hill');
    model.scale.setScalar(1);
    const result=batchModel(model);
    result.scale.setScalar(scale);
    result.position.set(x,ground(x,z),z);
    result.rotation.y=yaw;
    result.traverse(mesh=>{if(mesh.isMesh)mesh.castShadow=mesh.receiveShadow=true;});
    group.add(result);
  }
  const bay=parks.lotus;
  if(bay){
    for(const [x,z] of bay.bridge.slice(2)){
      const deck=walkHeight(x,z),bottom=.034;
      if(deck>bottom&&wet(x,z))add('stone',x,(deck+bottom)/2,z,.012,deck-bottom,.012);
    }
    const {edge,land}=bay;
    const x=edge.x+land.x*.10-land.z*.255,z=edge.z+land.z*.10+land.x*.255;
    if(!wet(x,z)&&!nearRoad(x,z,.047)){
      gazebo(x,z,.0064,Math.atan2(-land.x,-land.z));
    }
  }
  const pavilionX=hill.x+.21,pavilionZ=hill.z+.39;
  if(!wet(pavilionX,pavilionZ)&&!nearRoad(pavilionX,pavilionZ,.03)){
    gazebo(pavilionX,pavilionZ,.0068,0);
  }
  for(const [key,items] of batches){
    const [geometry,material]=type[key],mesh=new T.InstancedMesh(geometry,material,items.length);
    const color=new T.Color();mesh.name=key;mesh.castShadow=mesh.receiveShadow=true;
    items.forEach(({matrix,color:tone},i)=>{
      mesh.setMatrixAt(i,matrix);
      if(tone!==undefined)mesh.setColorAt(i,color.set(tone));
    });
    group.add(mesh);
  }
let phase=0,previousTime=0;
  group.userData.updateWeather=(time,weather,night)=>{
    phase+=Math.max(0,Math.min(.10,time-previousTime))*(1.3+2.2*weather.windLevel);previousTime=time;foliageTime.value=phase;
    foliageWind.value.set(weather.direction.x,weather.direction.y,weather.windLevel);
    lamp.emissiveIntensity=.06+night*1.35;
  };
  return group;
}

const bridgeStone = new T.MeshStandardMaterial({color:0xb4aea0,roughness:.86});
const coarseStone = new T.MeshStandardMaterial({color:0x99968c,roughness:.92,side:T.DoubleSide});
textureSurface(coarseStone,'masonry');

export function addBridgeBalustrade(scene, vertices, width){
  const batch=scene.userData.bridgeBatch;
  const section={vertices:[...vertices],width};
  if(batch){batch.sections.push(section);return vertices.length/6;}
  drawBridgeDetails(scene,[section],()=>true);
  return vertices.length/6;
}

export function flushBridgeDetails(scene){
  const batch=scene.userData.bridgeBatch;
  if(!batch)return;
  drawBridgeDetails(scene,batch.sections,batch.wet);
  delete scene.userData.bridgeBatch;
}

function drawBridgeDetails(scene, sections, wet){
  const archPositions=[], archUV=[];
  const blocks=[], capitals=[];
  const dummy=new T.Object3D(), axis=new T.Vector3(0,1,0);
  const addBlock=(position,scale,rotation,target=blocks)=>{
    dummy.position.copy(position);dummy.scale.set(...scale);
    dummy.quaternion.copy(rotation);dummy.updateMatrix();target.push(dummy.matrix.clone());
  };
  const columnRotation=new T.Quaternion();
  for(const {vertices,width} of sections){
    const count=vertices.length/6;
    if(count<2)continue;
    const deck=[];
    let distance=0;
    for(let i=0;i<count;i++){
      const a=new T.Vector3().fromArray(vertices,i*6),b=new T.Vector3().fromArray(vertices,i*6+3);
      const mid=a.clone().add(b).multiplyScalar(.5);
      if(i)distance+=mid.distanceTo(deck[i-1].mid);
      deck.push({a,b,mid,distance});
    }
    if(distance<.008)continue;
    function sample(t,side){
      let j=1;
      while(j<deck.length-1&&deck[j].distance<t*distance)j++;
      const a=deck[j-1],b=deck[j];
      return a[side].clone().lerp(b[side],(t*distance-a.distance)/(b.distance-a.distance||1));
    }
    const bays=Math.min(32,Math.max(1,Math.ceil(distance/.036)));
    for(const side of ['a','b']){
      for(let i=0;i<=bays;i++){
        const point=sample(i/bays,side);
        addBlock(point.clone().addScaledVector(axis,.005),[.0028,.010,.0028],columnRotation);
        addBlock(point.clone().addScaledVector(axis,.0108),[.0039,.002,.0039],columnRotation,capitals);
        if(!i)continue;
        const prev=sample((i-1)/bays,side),direction=point.clone().sub(prev);
        const length=direction.length();
        if(length<.0005)continue;
        const rotation=new T.Quaternion().setFromUnitVectors(axis,direction.normalize());
        const center=point.clone().add(prev).multiplyScalar(.5);
        addBlock(center.clone().addScaledVector(axis,.009),[.00165,length,.00165],rotation);
        addBlock(center.clone().addScaledVector(axis,.0024),[.0018,length,.0018],rotation);
        for(const t of [.25,.5,.75]){
          const panel=prev.clone().lerp(point,t).addScaledVector(axis,.0054);
          addBlock(panel,[.0011,.0062,Math.min(.0046,length*.17)],columnRotation);
        }
      }
    }
    const crossesWater=deck.some(({mid})=>wet(mid.x,mid.z)) || [0.25,.5,.75].some(t=>{
      const a=sample(t,'a').lerp(sample(t,'b'),.5);return wet(a.x,a.z);
    });
    if(!crossesWater)continue;
    const segments=Math.max(12,Math.min(36,Math.ceil(distance/.012)));
    for(const side of ['a','b']){
      const profile=[];
      for(let i=0;i<=segments;i++){
        const t=i/segments,top=sample(t,side),span=(t-.5)/.39;
        const rise=Math.sqrt(Math.max(0,1-span*span))*Math.min(.064,distance*.29);
        const low=top.clone();
        low.y=Math.min(top.y-.004,.029+rise);
        profile.push([top,low]);
        if(!i)continue;
        const [a,b]=profile[i-1], [c,d]=profile[i];
        for(const [p,k] of [[a,i-1],[b,i-1],[c,i],[c,i],[b,i-1],[d,i]]){
          archPositions.push(...p.toArray());archUV.push(k/segments*distance/.014,0,0);
        }
      }
    }
  }
  for(const [list,geometry,name] of [
    [blocks,new T.BoxGeometry(1,1,1),'Bridge railings and pierced panels'],
    [capitals,new T.IcosahedronGeometry(.66,0),'Bridge baluster capitals']
  ]){
    if(!list.length){geometry.dispose();continue;}
    const mesh=new T.InstancedMesh(geometry,bridgeStone,list.length);
    list.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
    mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  }
  if(archPositions.length){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(archPositions,3));
    geometry.setAttribute('pavingCoord',new T.Float32BufferAttribute(archUV,3));
    geometry.computeVertexNormals();
    const mesh=new T.Mesh(geometry,coarseStone);
    mesh.name='Batched bridge stone arch spandrels';
    mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  }
}

export function addGardenDetails(scene, spots, paths, positionOf, ground, wet){
  const shapes={
    stone:new T.CylinderGeometry(1,1,1,8),
    timber:new T.BoxGeometry(1,1,1),
    rock:new T.DodecahedronGeometry(1,0),
    lamp:new T.BoxGeometry(1,1,1)
  };
  const warm=new T.MeshStandardMaterial({color:0xd5ab67,emissive:0xffac47,emissiveIntensity:0});
  const materials={
    stone:new T.MeshStandardMaterial({color:0xa19e8d,roughness:.93}),
    timber:new T.MeshStandardMaterial({color:0x60452e,roughness:.86}),
    rock:new T.MeshStandardMaterial({color:0x777b69,roughness:1}),
    lamp:warm
  };
  const dummy=new T.Object3D(), instances={stone:[],timber:[],rock:[],lamp:[]};
  const addPart=(kind,x,y,z,w,h,d,yaw=0)=>{
    dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(w,h,d);
    dummy.updateMatrix();instances[kind].push(dummy.matrix.clone());
  };
  for(const [index,[name,spot]] of Object.entries(spots).entries()){
    const [x,z]=positionOf(spot);
    let site,best=.3;
    for(const path of paths)for(let i=1;i<path.length;i++){
      const [ax,az]=path[i-1],[bx,bz]=path[i];
      const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
      if(length<.004)continue;
      const t=Math.min(1,Math.max(0,((x-ax)*dx+(z-az)*dz)/(length*length)));
      const cx=ax+dx*t,cz=az+dz*t;
      for(const side of [-1,1]){
        const qx=cx-dz/length*.067*side,qz=cz+dx/length*.067*side;
        const dist=Math.hypot(qx-x,qz-z);
        if(dist<best&&!wet(qx,qz)&&!wet((cx+qx)*.5,(cz+qz)*.5)){
          best=dist;site={x:qx,z:qz,yaw:-Math.atan2(dz,dx)};
        }
      }
    }
    if(!site){
      for(let radius=.072;radius<=.29&&!site;radius+=.029){
        for(let i=0;i<16;i++){
          const angle=i*Math.PI/8;
          const qx=x+Math.sin(angle)*radius,qz=z+Math.cos(angle)*radius;
          const points=[[qx,qz],[qx-.019,qz],[qx+.019,qz],[qx,qz+.015]];
          if(points.some(([u,v])=>wet(u,v)))continue;
          const ys=points.map(([u,v])=>ground(u,v));
          if(Math.max(...ys)-Math.min(...ys)>.020)continue;
          site={x:qx,z:qz,yaw:angle};break;
        }
      }
    }
    if(!site){
      // A water-only destination uses a mooring detail rather than land furniture.
      if(wet(x,z))for(const dx of [-.008,.008]){
        addPart('timber',x+dx,.049,z+.16,.0027,.034,.0027);
        addPart('timber',x+dx,.066,z+.16,.0034,.002,.0034);
      }
      continue;
    }
    const {x:gx,z:gz,yaw}=site, y=ground(gx,gz);
    addPart('timber',gx,y+.010,gz,.0017,.020,.0017,yaw);
    addPart('timber',gx,y+.018,gz,.015,.0075,.0014,yaw);
    addPart('timber',gx+.018,y+.016,gz,.0014,.032,.0014);
    addPart('lamp',gx+.018,y+.033,gz,.0041,.0048,.0041,yaw);
    addPart('timber',gx+.018,y+.036,gz,.0057,.0014,.0057,yaw);
    if(name==='湖滨'||name==='平湖秋月'||name==='花港观鱼'){
      let edge;
      for(let i=0;i<12&&!edge;i++){
        const angle=i*Math.PI/6,dx=Math.sin(angle),dz=Math.cos(angle);
        for(let radius=.012;radius<=.07;radius+=.006){
          const wx=gx+dx*radius,wz=gz+dz*radius;
          if(!wet(wx,wz))continue;
          if(Math.hypot(wx-x,wz-z)<.28)edge={wx,wz,dx,dz,angle};
          break;
        }
      }
      if(edge){
        const {wx,wz,dx,dz,angle}=edge;
        const deckY=Math.max(.057,ground(wx-dx*.008,wz-dz*.008)+.002);
        if(deckY<.11){
          for(let i=-4;i<=4;i++)addPart('timber',wx+dx*i*.0027,deckY,wz+dz*i*.0027,.022,.0014,.00245,angle);
          for(const side of [-1,1]){
            const postX=wx+dx*.009+dz*.007*side,postZ=wz+dz*.009-dx*.007*side;
            addPart('timber',postX,(deckY+.014+.028)/2,postZ,.0023,deckY-.014,.0023);
          }
        }
      }
    }
    if(index%3===0){
      addPart('stone',gx-.018,y+.004,gz,.004,.008,.004);
      addPart('stone',gx-.018,y+.0085,gz,.008,.0018,.008);
      for(const sign of [-1,1])addPart('stone',gx-.018,y+.002,gz+.011*sign,.0037,.004,.0037);
    }else if(index%3===1){
      addPart('rock',gx-.019,y+.005,gz,.008,.008,.005,.4);
      addPart('rock',gx-.012,y+.002,gz+.004,.005,.004,.006);
    }else{
      for(let j=0;j<4;j++)addPart('timber',gx-.018,y+.004,gz+.0025*j,.015,.0012,.0022,yaw);
      for(const sign of [-1,1])addPart('timber',gx-.018,y+.002,gz+.004+.006*sign,.002,.004,.002);
    }
  }
  for(const [kind,list] of Object.entries(instances)){
    if(!list.length){shapes[kind].dispose();materials[kind].dispose();continue;}
    const mesh=new T.InstancedMesh(shapes[kind],materials[kind],list.length);
    list.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
    mesh.name='Scenic '+kind+' details';
    mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  }
  return night=>{warm.emissiveIntensity=night?.86:0;};
}
