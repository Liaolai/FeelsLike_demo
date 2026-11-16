import * as T from '../assets/three.module.js';
import {createBaidiPavilion} from './landmark-details.js';
import {instanceBoxes} from './baidi-embankment.js';
import {createLotusBeds} from './scenic-craft.js';
import {swayFoliage} from './weather-motion.js';

function treeStyle(group,name,geometry,material,points){
  const mesh=new T.InstancedMesh(geometry,material,points.length);
  mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;
  const dummy=new T.Object3D(),color=new T.Color();
  points.forEach(([x,y,z,w,h,d,yaw=0,tint=0xffffff],i)=>{
    dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,yaw,0);dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.set(tint));
  });
  group.add(mesh);return mesh;
}

function railSegment(posts,rails,a,b,y){
  const dx=b[0]-a[0],dz=b[1]-a[1],n=Math.ceil(Math.hypot(dx,dz)/.029);
  if(!n)return;
  const angle=Math.atan2(dx,dz),d=Math.hypot(dx,dz)/n;
  for(let j=0;j<=n;j++){
    const x=a[0]+dx*j/n,z=a[1]+dz*j/n;
    posts.push([x,y+.010,z,.006,.020,.006,angle],[x,y+.021,z,.008,.004,.008,angle]);
    if(j<n){
      rails.push([x+dx/(2*n),y+.015,z+dz/(2*n),.005,.004,d,angle]);
      rails.push([x+dx/(2*n),y+.007,z+dz/(2*n),.004,.008,d*.79,angle]);
    }
  }
}

export function createBaidiScenery(landscape,batch){
  const root=new T.Group(),corridor=landscape.corridor;
  root.name='断桥—白堤—平湖秋月景观';
  if(!corridor)return root;
  const {midpoint,pinghu,duanqiao}=corridor;
  const timber=[],boatHull=[],blue=[],gold=[],shoreFootings=[],stoneLights=[],rails=[],posts=[],planks=[],waterPlatforms=[];
  const trees=[],crown=[],peach=[],willow=[],bushes=[],flowers=[],lampBody=[],lanterns=[];
  const time={value:0},wind={value:new T.Vector3(1,0,.2)};
  const stoneLamp=new T.MeshStandardMaterial({color:0xd9b989,emissive:0xffb35b,emissiveIntensity:.07});
  const litMaterials=[stoneLamp];
  const palette=[0xe87a90,0xf29bae,0xe98ca7,0xf5a3b5];
  let seed=2982;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const lightAt=(x,y,z)=>{
    lampBody.push([x,y+.027,z,.0046,.054,.0046]);
    lampBody.push([x,y+.053,z,.029,.0036,.0036]);
    for(const side of [-1,1])lanterns.push([x+side*.011,y+.050,z,.0041,.0058,.0041]);
  };
  function tree(x,y,z,spec,h){
    trees.push([x,y+h*.44,z,.004,h*.88,.004]);
    const tint=spec==='willow'?0x80a857:spec==='plane'?0x82974e:0x527941;
    const out=spec==='peach'?peach:crown;
    for(let k=0;k<4;k++){
      const theta=k*Math.PI*.5+random()*.4,r=h*.19;
      out.push([x+Math.cos(theta)*r,y+h*(.77+.11*random()),z+Math.sin(theta)*r,
        h*.34,h*(spec==='plane'?.27:.25),h*.323,theta,spec==='peach'?palette[k]:tint]);
    }
    if(spec==='willow'){
      for(let k=0;k<9;k++){
        const theta=k*Math.PI*2/9,r=h*(.34+random()*.11);
        willow.push([x+Math.sin(theta)*r,y+h*(.59+.13*random()),z+Math.cos(theta)*r,
          h*.053,h*(.17+.13*random()),h*.054,theta,k%2?0x87a958:0x73944c]);
      }
    }
  }
  const at=(q,d)=>[q.x+q.nx*d,q.z+q.nz*d];
  for(let i=0,s=.13;s<corridor.length-.16;i++,s+=.09){
    if(corridor.getBridge(s-.022)||corridor.getBridge(s+.022))continue;
    const q=corridor.station(s);
    for(const side of [-1,1]){
      if(side>0&&Math.abs(s-midpoint.s)<.07)continue;
      const [x,z]=at(q,.104*side);
      const spec=i%2===0?'willow':'peach';
      tree(x,.066,z,spec,spec==='peach'?.062+random()*.02:.091+random()*.024);
      const [bx,bz]=at(q,.087*side);
      bushes.push([bx,.073,bz,.015,.008,.012,0,i%2?0x4f7944:0x63954b]);
      if(i%2===1)flowers.push([bx+.006,.080,bz,.007,.0045,.006,0,palette[i%4]]);
    }
    if(i%6===1){
      const [x,z]=at(q,-.076),yaw=Math.atan2(q.dx,q.dz);
      timber.push([x,.076,z,.011,.004,.043,yaw],[x-q.nx*.006,.088,z-q.nz*.006,.004,.012,.043,yaw]);
      for(const d of [-.015,.015])stoneLights.push([x+q.dx*d,.069,z+q.dz*d,.007,.010,.007,yaw]);
      if(i%12===1){const [lx,lz]=at(q,.072);lightAt(lx,.067,lz);}
    }
  }
  // North-facing T pier; boats are parked in two orderly banks.
  const dockYaw=Math.atan2(midpoint.nx,midpoint.nz);
  for(let i=0;i<27;i++){
    const [x,z]=at(midpoint,.107+i*.009);
    planks.push([x,.054,z,.065,.0055,.0087,dockYaw]);
    if(i%7===0)for(const side of [-1,1])
      timber.push([x+midpoint.dx*side*.028,.050,z+midpoint.dz*side*.028,.006,.036,.006,dockYaw]);
  }
  for(let i=-19;i<=19;i++){
    const [x,z]=at(midpoint,.346);
    planks.push([x+midpoint.dx*i*.008,.054,z+midpoint.dz*i*.008,.063,.0055,.0077,Math.atan2(midpoint.dx,midpoint.dz)]);
  }
  for(let i=0;i<9;i++){
    const row=i<5?1:-1,along=(i%5-2)*.056+(row<0?.025:0);
    const q=at(midpoint,.346+row*.077);
    const x=q[0]+midpoint.dx*along,z=q[1]+midpoint.dz*along;
    boatHull.push([x,.043,z,.020,.008,.054,dockYaw,0x765942]);
    timber.push([x,.048,z,.029,.003,.072,dockYaw]);
    const canopy=i%3===1?gold:blue;
    canopy.push([x,.063,z,.018,.010,.035,dockYaw,i%3===1?0xd7aa50:0x407699]);
    for(const sign of [-1,1])
      timber.push([x+midpoint.dx*sign*.012,.055,z+midpoint.dz*sign*.012,.0018,.017,.018,dockYaw]);
  }

  function foundation(x,z,width,depth,y,bottom=.014){
    if(y>bottom)shoreFootings.push([x,(y+bottom)/2,z,width,y-bottom,depth]);
  }
  for(const site of [...pinghu,...duanqiao]){
    const grades=[[-.40,-.38],[-.40,.38],[.40,-.38],[.40,.38]].map(([a,b])=>
      landscape.terrainSurfaceY(site.x+site.w*a,site.z+site.d*b));
    const supported=grades.filter(y=>y>=.044);
    const floor=supported.length?Math.max(.058,Math.min(.121,Math.max(...supported)+.004)):.058;
    const bottom=Math.min(.018,Math.min(...grades)-.062);
    foundation(site.x,site.z,site.w*1.05,site.d*1.06,floor,bottom);
    const building=batch(createBaidiPavilion(site));
    building.name=site.name;building.position.set(site.x,floor,site.z);
    building.traverse(mesh=>{
      if(!mesh.isMesh)return;
      mesh.castShadow=mesh.receiveShadow=true;
      if(mesh.material.name==='Emissive_WarmLamp')litMaterials.push(mesh.material);
    });
    root.add(building);
  }
  const library=pinghu[0],platZ=library.bank+.059;
  // The lower moon-view terrace remains accessible via stone steps up to the pavilion.
  foundation(library.x,platZ,.22,.16,.058,.017);
  waterPlatforms.push([library.x,.057,platZ,.22,.002,.16]);
  for(let i=0;i<14;i++)for(let j=0;j<9;j++)
    waterPlatforms.push([library.x+(i-6.5)*.0154,.058,platZ+(j-4)*.0172,.0149,.0013,.0167]);
  const platCorners=[[library.x-.109,platZ-.079],[library.x-.109,platZ+.079],
    [library.x+.109,platZ+.079],[library.x+.109,platZ-.079]];
  for(let i=1;i<platCorners.length;i++)railSegment(posts,rails,platCorners[i-1],platCorners[i],.058);
  for(const side of [-1,1]){
    const lx=library.x+side*.093,lz=platZ+.066;
    stoneLights.push([lx,.062,lz,.014,.008,.014],[lx,.073,lz,.0048,.016,.0048],[lx,.087,lz,.015,.005,.013]);
    lanterns.push([lx,.082,lz,.0049,.006,.0049]);
    const tx=library.x+side*.122,tz=library.bank-.018;
    if(!landscape.wet(tx,tz))tree(tx,Math.max(.053,landscape.terrainSurfaceY(tx,tz)),tz,side>0?'willow':'plane',.137);
  }
  const path=[[library.x-.112,platZ-.048]];
  for(let i=1;i<pinghu.length;i++){
    const site=pinghu[i],ahead=site.z+site.d*.57;
    path.push([path.at(-1)[0]-.024,ahead+.027],[site.x+.043,ahead+.027],[site.x+.043,ahead],[site.x-.039,ahead]);
  }
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.001)continue;
    const yaw=Math.atan2(dx,dz),n=Math.ceil(length/.014);
    for(let j=0;j<n;j++){
      const t=(j+.5)/n,x=a[0]+dx*t,z=a[1]+dz*t;
      waterPlatforms.push([x,.056,z,.036,.004,Math.max(.009,length/n-.0005),yaw]);
      if(j%3===0)shoreFootings.push([x,.037,z,.015,.030,.015,yaw]);
    }
    if(length>.028)railSegment(posts,rails,[a[0]-dz/length*.017,a[1]+dx/length*.017],
      [b[0]-dz/length*.017,b[1]+dx/length*.017],.058);
  }
  const shoreHouse=duanqiao[1];
  foundation(shoreHouse.x,shoreHouse.z+.037,.174,.098,.060,.015);
  waterPlatforms.push([shoreHouse.x,.061,shoreHouse.z+.037,.177,.003,.10]);
  const lotus=createLotusBeds(landscape.wet,{edge:{x:shoreHouse.x-.070,z:shoreHouse.z-.110},land:{x:1,z:.11}},
    (x,z,radius)=>landscape.nearRoad(x,z,radius+.035));
  lotus.name='断桥 · 北里湖荷叶带';root.add(lotus);

  for(let i=0;i<13;i++){
    const x=library.x+.16-i*.071;
    const bank=pinghu.reduce((best,p)=>Math.abs(p.x-x)<Math.abs(best.x-x)?p:best,pinghu[0]).bank;
    for(const d of [.19,.258]){
      const z=bank-d;
      if(!landscape.wet(x,z)&&!landscape.nearRoad(x,z,.022))
        tree(x,Math.max(.066,landscape.terrainSurfaceY(x,z)),z,'plane',.123+random()*.043);
    }
  }
  instanceBoxes(root,timber,0x705945,'木质桩柱与湖畔座椅');
  instanceBoxes(root,planks,0x9a7c58,'北里湖T形木栈桥');
  instanceBoxes(root,shoreFootings,0x92948a,'临水青石台基');
  instanceBoxes(root,waterPlatforms,0xb7b6a9,'望月平台与贴水曲桥');
  instanceBoxes(root,stoneLights.concat(posts,rails),0xb3b4aa,'石灯、柱帽与青石栏板');
  instanceBoxes(root,lampBody,0x343b38,'双头复古路灯');
  const foliage=new T.MeshStandardMaterial({roughness:.86});
  const hanging=new T.MeshStandardMaterial({roughness:.83});
swayFoliage(hanging,time,wind,true);
  const plant=new T.SphereGeometry(1,10,7);
  const leaves=new T.SphereGeometry(1,7,5);
  treeStyle(root,'环湖天青色游船船底',plant,new T.MeshStandardMaterial({roughness:.9}),boatHull);
  treeStyle(root,'蓝篷手划船',plant,new T.MeshStandardMaterial({roughness:.85}),blue);
  treeStyle(root,'黄篷手划船',plant,new T.MeshStandardMaterial({roughness:.85}),gold);
  treeStyle(root,'桃柳梧桐树干',new T.CylinderGeometry(.53,.75,1,7),new T.MeshStandardMaterial({color:0x584731}),trees);
  treeStyle(root,'垂柳与梧桐树冠',plant,foliage,crown);
  treeStyle(root,'白堤碧桃花冠',plant,foliage,peach);
  treeStyle(root,'白堤柔垂柳丝',leaves,hanging,willow);
  treeStyle(root,'堤岸修剪灌木',plant,new T.MeshStandardMaterial({roughness:.92}),bushes);
  treeStyle(root,'春景花带',leaves,new T.MeshStandardMaterial({roughness:.84}),flowers);
  treeStyle(root,'水榭宫灯与石灯芯',leaves,stoneLamp,lanterns);
  root.userData.updateSeason=month=>lotus.userData.updateSeason(month);
let phase=0,previousTime=0;
  root.userData.updateWeather=(t,weather,night)=>{
    phase+=Math.max(0,Math.min(.10,t-previousTime))*(1.3+2.2*weather.windLevel);previousTime=t;time.value=phase;
    wind.value.set(weather.direction.x,weather.direction.y,weather.windLevel);
    for(const m of litMaterials)m.emissiveIntensity=.06+night*1.35;
  };
  return root;
}
