import * as T from '../assets/three.module.js';
import {pavilionRoof} from './scenic-craft.js';
import {instanceBoxes} from './baidi-embankment.js';
import {addBox,addPart,castAndReceive,makePavilion,material,onPath,plantBatch,seededRandom,terrace} from './waterfront-kit.js';

function animateKoi(root,site,wet){
  const n=200,dummy=new T.Object3D(),random=seededRandom(4927),color=new T.Color();
  const body=new T.InstancedMesh(new T.SphereGeometry(1,9,6),material(0xffffff,.68,{emissive:0x942719,emissiveIntensity:.10}),n);
  const finShape=new T.BufferGeometry();
  finShape.setAttribute('position',new T.Float32BufferAttribute([
    -.005,0,-.004,0,0,.004,0,0,-.001,0,0,-.001,0,0,.004,.005,0,-.004
  ],3));finShape.computeVertexNormals();
  const fins=new T.InstancedMesh(finShape,material(0xffffff,.79,{side:T.DoubleSide}),n);
  const patches=new T.InstancedMesh(new T.SphereGeometry(1,6,4),material(0xffe0b4,.68),n);
  body.name='红鱼池 · 200 尾锦鲤';fins.name='锦鲤尾鳍';patches.name='锦鲤斑纹';
  for(const m of [body,fins,patches]){
    m.frustumCulled=false;
    m.instanceMatrix.setUsage(T.DynamicDrawUsage);
  }
  const splashes=new T.InstancedMesh(new T.RingGeometry(.76,1,12).rotateX(-Math.PI/2),
    new T.MeshBasicMaterial({color:0xc6e7df,transparent:true,opacity:.29,depthWrite:false,side:T.DoubleSide}),24);
  splashes.name='锦鲤细波';splashes.frustumCulled=false;splashes.renderOrder=5;
  const schools=[[-.239,-.10],[-.256,.068],[.224,-.10],[.190,.144]];
  const fish=[];
  for(let i=0;i<n;i++){
    const [a,b]=schools[i%schools.length],x=site.center.x+a,z=site.center.z+b;
    const hue=[0xf27536,0xef5928,0xffb941,0xffdeac,0xf53b21][i%5],size=.78+random()*.48;
    fish.push({x,z,size,phase:random()*Math.PI*2,r:.024+random()*.071,
      speed:.64+random()*.65,bias:random(),hue});
    body.setColorAt(i,color.set(hue));fins.setColorAt(i,color.set(hue).multiplyScalar(.89));
  }
  function place(mesh,i,x,y,z,sx,sy,sz,yaw){
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,yaw,0);
    dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  }
  const animate=t=>{
    for(let i=0;i<n;i++){
      const p=fish[i],a=p.phase+t*p.speed;
      let x=p.x+Math.sin(a)*p.r,z=p.z+Math.cos(a)*p.r*.76;
      if(!wet(x,z)){x=p.x;z=p.z;}
      const angle=Math.atan2(Math.cos(a),-.76*Math.sin(a));
      const h=.0379+.0009*Math.sin(a*2+p.bias*8);
      place(body,i,x,h,z,.0039*p.size,.00245*p.size,.0078*p.size,angle);
      const tail=-.008*p.size;
      place(fins,i,x+Math.sin(angle)*tail,h,z+Math.cos(angle)*tail,p.size,1,p.size,angle+.35*Math.sin(t*8+p.phase));
      place(patches,i,x+Math.sin(angle)*.002,h+.00185,z+Math.cos(angle)*.002,
        .0021*p.size,.0008,.0033*p.size,angle);
      if(i<24){
        const age=(t*.61+p.bias)%1,radius=.003+age*.011;
        place(splashes,i,x,.0405,z,radius,1,radius,0);
      }
    }
    for(const m of [body,fins,patches,splashes])m.instanceMatrix.needsUpdate=true;
  };
  animate(0);
  root.add(body,fins,patches,splashes);
  return animate;
}

export function createHuagangScenery(landscape,batch){
  const site=landscape.waterfronts.flower,{center,peony,estate}=site;
  const root=new T.Group();root.name='花港观鱼 · 红鱼池园林';
  const {wet,terrainSurfaceY:ground,nearRoad}=landscape;
  const stone=material(0xa6a693,.90),tile=material(0x35443e,.83,{side:T.DoubleSide});
  const wood=material(0x843d30),amber=material(0xd2a06e,.7,{emissive:0xffa050,emissiveIntensity:.06});
  const posts=[],rails=[],board=[],footing=[],roof=new T.Group();roof.name='池北贴水木曲廊';
  function pavilion(name,x,z,w,d,style,yaw,floor,sides){
    terrace(root,ground,x,z,w*.94,d*.93,floor,stone);
    const object=batch(makePavilion({w,d,style,sides,stone,wood,tile,lamp:amber}));
    object.name=name;object.position.set(x,floor,z);object.rotation.y=yaw;root.add(object);
  }
  const gallery=site.gallery;
  for(let i=1;i<gallery.length;i++){
    const [x,z]=gallery[i-1],[a,b]=gallery[i];
    const length=Math.hypot(a-x,b-z),yaw=Math.atan2(a-x,b-z)-Math.PI/2;
    const cover=addPart(roof,pavilionRoof(length*1.09,.074,.108,.022,.004,.46),tile,(a+x)/2,0,(b+z)/2,yaw);
    cover.castShadow=true;
  }
  onPath(gallery,.027,(x,z,yaw,length,i,j)=>{
    const y=.060,nx=Math.cos(yaw),nz=-Math.sin(yaw);
    board.push([x,y,z,.063,.006,length+.0005,yaw]);
    footing.push([x,y-.011,z,.025,.028,length*.73,yaw]);
    for(const s of [-1,1]){
      posts.push([x+s*.027*nx,y+.027,z+s*.027*nz,.005,.054,.005,yaw]);
      rails.push([x+s*.028*nx,y+.013,z+s*.028*nz,.006,.006,length,yaw]);
      if(j%2===0)rails.push([x+s*.030*nx,y+.022,z+s*.030*nz,.004,.002,length*.62,yaw]);
    }
  });
  root.add(batch(roof));root.children.at(-1).name=roof.name;
  for(const [i,title] of [[0,'池西观鱼水榭'],[2,'红鱼池重檐观鱼轩'],[5,'池东观景敞轩']]){
    const [x,z]=gallery[i];pavilion(title,x,z,i===2?.122:.097,.087,'double',0,.060);
  }
  pavilion('康熙花港观鱼御碑亭',center.x+.335,center.z-.275,.092,.076,'stele',0,.072);
  pavilion('重檐八角牡丹亭',peony.x,peony.z,.144,.138,'polygon',.10,Math.max(.075,ground(peony.x,peony.z)+.003),8);
  pavilion('蒋庄与藏山阁 · 白墙水院',estate.x,estate.z,.182,.133,'court',estate.yaw,
    Math.max(.067,ground(estate.x,estate.z)+.006));
  onPath(estate.pier,.012,(x,z,yaw,length)=>{
    const y=Math.max(.054,Math.min(.088,ground(x,z)+.004));
    board.push([x,y,z,.077,.006,length+.0007,yaw]);
    footing.push([x,(y+.019)/2,z,.030,y-.019,length*.74,yaw]);
  });
  const bridgeRails=[],bridgePosts=[],bridgeSupports=[];
  onPath(site.bridge,.029,(x,z,yaw,length,i,j)=>{
    const y=landscape.walkHeight(x,z),nx=Math.cos(yaw),nz=-Math.sin(yaw);
    if(y<.042)return;
    for(const side of [-1,1]){
      const a=x+nx*side*.0157,b=z+nz*side*.0157;
      bridgeRails.push([a,y+.009,b,.0038,.0041,length,yaw]);
      bridgePosts.push([a,y+.007,b,.0058,.013,.0058,yaw]);
    }
    if(wet(x,z)&&j%2===0)bridgeSupports.push([x,.040,z,.022,.021,.011,yaw]);
  });
  const walks=[],rocks=[],flower=[],willows=[],orchard=[],cedars=[],trunks=[],maples=[],shrub=[];
  const random=seededRandom(926);
  for(const r of [.177,.258])for(let i=0;i<64;i++){
    const a=i*Math.PI*2/64,x=peony.x+Math.cos(a)*r,z=peony.z+Math.sin(a)*r;
    if(wet(x,z))continue;
    const y=ground(x,z),size=.008+random()*.009;
    walks.push([x,y+.0025,z,size,.0045,.020,-a]);
    if(i%3===0){
      const xx=peony.x+Math.cos(a)*(r+.030),zz=peony.z+Math.sin(a)*(r+.030);
      if(wet(xx,zz))continue;
      const y0=ground(xx,zz);
      shrub.push([xx,y0+.009,zz,.023,.013,.023,0x537642]);
      for(let j=0;j<4;j++)flower.push([xx+(random()-.5)*.027,y0+.018,zz+(random()-.5)*.027,.0075,.006,.0078,
        j%2?0xc8436f:0xe596ad]);
      if(i%12===0)rocks.push([xx,y0+.022,zz,.022,.039,.020,0x8c9084,a]);
    }
  }

  const rim=[[-.35,-.27],[-.30,.18],[.13,.29],[.37,.05],[.335,-.21]];
  for(let i=0;i<rim.length;i++){
    const [x,z]=rim[i];
    for(let j=0;j<5;j++){
      const xx=center.x+x+(random()-.5)*.052,zz=center.z+z+(random()-.5)*.061;
      rocks.push([xx,.049+random()*.008,zz,.016,.012+random()*.026,.012,
        j%2?0x9ca999:0x737c72,random()*6]);
    }
  }
  function plant(x,z,kind,h){
    if(wet(x,z)||nearRoad(x,z,.015))return;
    const y=ground(x,z);
    if(y<.045)return;
    trunks.push([x,y+h*.38,z,.0043,h*.76,.0043,0x604d39]);
    if(kind==='redwood'){
      for(let i=0;i<3;i++){
        const s=h*(.205-i*.038);
        maples.push([x,y+h*(.58+i*.145),z,s,h*.36,s,
          [0xc86432,0xd98845,0xab5d37][i],random()*6]);
      }
    }else if(kind==='cedar'){
      for(let i=0;i<4;i++){
        const s=h*(.29-i*.052);
        cedars.push([x,y+h*(.49+i*.13),z,s,h*.23,s,i%2?0x3f5d48:0x566f53,random()*6]);
      }
    }else{
      const tint=kind==='willow'?0x77985d:kind==='pine'?0x405e42:0xf7dce2;
      for(let i=0;i<4;i++){
        const a=i*Math.PI*.5,hx=x+Math.cos(a)*h*.13,hz=z+Math.sin(a)*h*.13;
        orchard.push([hx,y+h*.74,hz,h*.30,h*.21,h*.29,tint,a]);
        if(kind==='willow')willows.push([hx+Math.cos(a)*h*.15,y+h*.58,hz+Math.sin(a)*h*.15,
          h*.067,h*.19,h*.061,0x80a66b,a]);
      }
    }
  }
  for(const [dx,dz,h] of [[-.16,-.57,.18],[-.44,-.58,.154],[.22,-.60,.166],
    [.28,.60,.151],[-.25,.62,.18],[-.75,.35,.133]])plant(center.x+dx,center.z+dz,'cedar',h);
  for(const [dx,dz,kind] of [[-.44,-.242,'willow'],[-.31,-.345,'cherry'],[-.22,-.37,'cherry'],
    [.15,-.328,'willow'],[.28,-.322,'cherry'],[-.435,.125,'willow'],[.26,.357,'cherry'],
    [-.83,.19,'pine'],[-.68,.31,'pine'],[.050,.008,'willow'],[-.026,-.033,'pine']])
    plant(center.x+dx,center.z+dz,kind,.086+random()*.031);
  for(let i=0;i<31;i++){
    const z=center.z-.83+i*.057;
    let best=null;
    for(let x=center.x+1.09;x>center.x-.83;x-=.024){
      if(!wet(x,z)&&wet(x+.061,z)&&!wet(x-.060,z)){best=x-.030;break;}
    }
    if(best!==null&&Math.hypot(best-center.x,z-center.z)>.55)plant(best,z,'redwood',.107+random()*.058);
  }
  for(let i=0;i<9;i++){
    const x=center.x-1.00+i*.087,z=center.z+.73+.036*Math.cos(i*.8);
    plant(x,z,'redwood',.117+random()*.043);
  }
  for(let i=0;i<10;i++){
    const x=estate.x+(i-4.5)*.033,z=estate.z+.14;
    plant(x,z,'redwood',.114+random()*.045);
  }
  instanceBoxes(root,board,0x986b4d,'木曲廊与西岸 Z 形木栈道');
  instanceBoxes(root,posts,0x843f36,'临水朱柱');
  instanceBoxes(root,rails,0x624638,'木质美人靠');
  instanceBoxes(root,footing.concat(bridgeSupports),0x9c9c89,'池中石墩与木廊台基');
  instanceBoxes(root,bridgePosts.concat(bridgeRails),0xb7b7a9,'红鱼池折线石桥低栏');
  instanceBoxes(root,walks,0xc9c0a7,'牡丹山双圈鹅卵石花径');
  const s=new T.SphereGeometry(1,9,7);
  const r=new T.IcosahedronGeometry(1,1);
  const cone=new T.ConeGeometry(1,1,9);
  plantBatch(root,'太湖石与自然叠石',r,material(0xffffff,.94),rocks);
  plantBatch(root,'牡丹叶',s,material(0xffffff),shrub);
  plantBatch(root,'牡丹花',s,material(0xffffff),flower);
  plantBatch(root,'樱柳雪松水杉树干',new T.CylinderGeometry(.55,.74,1,7),material(0xffffff),trunks);
  plantBatch(root,'橙红水杉林',cone,material(0xffffff),maples);
  plantBatch(root,'大草坪雪松',cone,material(0xffffff),cedars);
  plantBatch(root,'粉白樱花与翠柳',s,material(0xffffff),orchard);
  plantBatch(root,'池岸下垂柳丝',s,material(0xffffff),willows);
  castAndReceive(root);
  const koi=animateKoi(root,site,wet);
  root.userData.animate=koi;
  root.userData.updateWeather=(t,weather,night)=>{amber.emissiveIntensity=.06+night*.9;};
  return root;
}
