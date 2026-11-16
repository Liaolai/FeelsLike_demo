import * as T from '../assets/three.module.js';
import {STONE_TOWERS,ISLAND_WATER_Y} from './xiaoyingzhou.js';
import {textureSurface} from './surface-materials.js';
import {pavilionRoof} from './scenic-craft.js';

function material(color,roughness=.86){
  return new T.MeshStandardMaterial({color,roughness});
}

function component(group,geometry,mat,x=0,y=0,z=0,yaw=0){
  geometry.clearGroups();
  const mesh=new T.Mesh(geometry,mat);
  mesh.position.set(x,y,z);mesh.rotation.y=yaw;
  group.add(mesh);
  return mesh;
}

function towerShell(){
  const pos=[],indices=[],n=32,steps=5;
  const lower=.014,upper=.029,mid=(lower+upper)/2;
  function put(angle,y,thickness){
    const h=(y-mid)/.009;
    const r=.0094*Math.sqrt(1-h*h)-thickness;
    pos.push(Math.sin(angle)*r,y,Math.cos(angle)*r);
  }
  for(let panel=0;panel<5;panel++){
    const az=panel*2*Math.PI/5,start=pos.length/3;
    for(const thickness of [0,.00050])for(let layer=0;layer<=steps;layer++)for(let i=0;i<n;i++){
      const angle=i*2*Math.PI/n,c=Math.cos(angle),s=Math.sin(angle);
      const square=1/Math.max(Math.abs(c),Math.abs(s));
      const t=layer/steps;
      put(az+c*T.MathUtils.lerp(.186,Math.PI/5*square,t),
        mid+s*T.MathUtils.lerp(.00165,(upper-lower)*.5*square,t),thickness);
    }
    const offset=(steps+1)*n;
    for(let i=0;i<n;i++){
      const next=(i+1)%n;
      for(let j=0;j<steps;j++)for(const side of [0,1]){
        const a=start+side*offset+j*n+i,b=a-i+next,c=a+n,d=b+n;
        if(side)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);
      }
      const a=start+i,b=start+next,c=a+offset,d=b+offset;
      indices.push(a,c,b,b,c,d);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

function stoneTower(){
  const group=new T.Group();
  const stone=material(0x6e736b,.88),moss=material(0x4c5849,.92);
  stone.side=T.DoubleSide;
  textureSurface(stone,'ground');textureSurface(moss,'ground');
  function turned(profile,mat=stone,segments=30){
    const geometry=new T.LatheGeometry(profile.map(([radius,y])=>new T.Vector2(radius,y)),segments);
    component(group,geometry,mat);
  }
  turned([[0,-.013],[.003,-.013],[.004,-.002],[.012,-.002],[.012,.001],[.0114,.0025],[0,.0025]],moss);
  turned([[0,.0025],[.0108,.0025],[.0108,.0042],[.0098,.005],[.006,.0077],[.0058,.0085],[.0089,.011],[.0097,.0122],[.0082,.0144],[0,.0144]],stone,16);
  for(let j=0;j<16;j++)for(const layer of [0,1]){
    const a=(j+layer*.5)*Math.PI/8,r=layer?.0076:.0088;
    const petal=component(group,new T.SphereGeometry(1,8,6),layer?stone:moss,Math.sin(a)*r,.0055+layer*.004,Math.cos(a)*r,a);
    petal.scale.set(.0016,.0016,.001);
    petal.rotation.x=layer?.61:-.45;
  }
  component(group,towerShell(),stone);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5,r=.00932;
    component(group,new T.TorusGeometry(.00188,.00032,8,22),stone,Math.sin(a)*r,.0215,Math.cos(a)*r,a);
  }
  turned([[0,.0286],[.0061,.0286],[.0077,.0305],[.0093,.0311],[.0103,.0321],[.0082,.032],[.0053,.0339],[.0048,.0344],[0,.0344]],stone,30);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;
    component(group,new T.BoxGeometry(.0014,.0052,.00145),stone,Math.sin(a)*.0036,.0368,Math.cos(a)*.0036,a);
  }
  turned([[0,.0393],[.0044,.0393],[.0059,.0397],[.0066,.0405],[.0045,.0406],[.0022,.0429],[.0013,.0438],
    [.0024,.045],[.00275,.0465],[.0022,.0478],[.00122,.0484],[.0011,.049],[.0018,.0497],[.00173,.0508],[.00095,.0518],[0,.0525]],stone,24);
  return group;
}

function makeTowerGlow(){
  return new T.ShaderMaterial({
    depthWrite:false,transparent:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,
    uniforms:{night:{value:0},time:{value:0}},
    vertexShader:`
      varying vec2 disk;
      void main(){
        disk=uv*2.0-1.0;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:`
      uniform float night,time;
      varying vec2 disk;
      void main(){
        float r=length(disk);
        float wave=fract(time*.31);
        float ripple=r-(.24+.56*wave); float ring=exp(-1300.0*ripple*ripple)*(1.0-wave)*.16;
        float lip=r-.24; float foam=exp(-1300.0*lip*lip)*.14;
        float glow=exp(-8.0*r*r)*night*(.47+.045*sin(time*5.2));
        gl_FragColor=vec4(mix(vec3(.57,.68,.60),vec3(1.,.64,.25),night),
          (glow+ring+foam)*(1.0-smoothstep(.64,1.,r)));
      }`
  });
}

function makeGardenPavilion(site,lantern){
  const {w,d,kind}=site;
  const group=new T.Group();
  const stone=material(0xb8b5a3),tile=material(0x384743),ridge=material(0x65726b);
  const red=material(0x873e33),wood=material(0x49372a),wall=material(0xe8e2d0),plinth=material(0x77786c);
  const box=(a,h,b,x,y,z,mat)=>component(group,new T.BoxGeometry(a,h,b),mat,x,y,z);
  const main=kind==='signature',court=kind==='court',octagon=kind==='octagon';
  const floor=main?.011:.006,post=main?.051:.040;
  box(w*1.06,floor,d*1.12,0,floor*.5,0,plinth);
  box(w*1.02,.002,d*1.07,0,floor+.001,0,stone);
  if(main||court){
    for(let j=0;j<3;j++)box(w*.52,.002,d*(.31-j*.06),0,.004+j*.002,d*.56,stone);
  }
  const columns=[];
  if(octagon){
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      columns.push([w*.44*Math.sin(a),d*.43*Math.cos(a)]);
    }
  }else{
    for(const z of [-d*.39,d*.39])for(const x of (main||court?[-.44,-.15,.15,.44]:[-.42,.42])){
      if(kind==='open'&&z>0&&x<0)continue;
      columns.push([w*x,z]);
    }
  }
  for(const [x,z] of columns){
    component(group,new T.CylinderGeometry(.004,.005,.004,10),stone,x,floor+.004,z);
    component(group,new T.CylinderGeometry(.003,.0036,post,12),red,x,floor+.004+post*.5,z);
    box(.009,.005,.009,x,floor+post-.001,z,wood);
  }
  const roofY=floor+post+.006;
  if(octagon){
    const roof=component(group,new T.ConeGeometry(w*.72,.020,8,3),tile,0,roofY+.004,0,Math.PI/8);
    roof.scale.z=.95;
  }else{
    const roof=pavilionRoof(w*1.16,d*1.22,roofY,main?.024:.016,.0065,kind==='open'?0:.35);
    component(group,roof,tile);
    box(w*(kind==='open'?.16:.48),.0031,.004,0,roofY+(main?.024:.016),0,ridge);
  }
  for(const z of [-d*.39,d*.39]){
    box(w*.94,.005,.005,0,roofY-.006,z,red);
    if(z<0||!main)box(w*.82,.004,.004,0,floor+.014,z,wood);
  }
  if(main||court||kind==='hall'){
    box(w*.88,post*.71,.004,0,floor+post*.36,-d*.37,wall);
    for(const direction of [-1,1]){
      const x=direction*w*.44;
      box(.004,.016,d*.71,x,floor+.009,0,wall);
      box(.004,.006,d*.71,x,roofY-.016,0,wall);
      for(let j=-3;j<=3;j++)
        box(.0027,.020,.0026,x,floor+.026,j*d*.092,wood);
      box(.003,.0026,d*.61,x,floor+.027,0,wood);
    }
  }
  if(main){
    for(const x of [-.322,0,.322]){
      component(group,new T.CylinderGeometry(.0027,.0027,.0056,8),lantern,w*x,roofY-.012,d*.39);
      box(.0009,.006,.0009,w*x,roofY-.007,d*.39,wood);
    }
    for(const direction of [-1,1]){
      const x=direction*w*.52,z=-d*.20,bay=.027,r=.013,y=.019;
      box(bay,.004,.005,x,.011,z,wall);
      const arc=new T.Shape();
      arc.moveTo(-r,0);arc.lineTo(-r,.032);arc.lineTo(r,.032);arc.lineTo(r,0);arc.lineTo(-r,0);
      const hole=new T.Path();hole.absarc(0,y,r*.87,0,Math.PI*2,true);arc.holes.push(hole);
      component(group,new T.ExtrudeGeometry(arc,{depth:.003,bevelEnabled:false}),wall,x,.013,z);
      component(group,new T.TorusGeometry(r*.88,.0017,7,24),stone,x,.013+y,z+.003);
      box(bay*1.16,.004,.008,x,.047,z,tile);
    }
  }
  if(kind==='stele'){
    box(.023,.006,.014,0,floor+.005,0,plinth);
    box(.012,.024,.003,0,floor+.018,0,stone);
  }
  if(court){
    for(const direction of [-1,1]){
      const x=direction*w*.32;
      box(w*.23,.029,d*.80,x,floor+.014,d*.52,wall);
      component(group,pavilionRoof(w*.30,d*.89,floor+.034,.014,.004),tile,x,0,d*.52);
    }
    box(w*.95,.005,d*.59,0,.004,d*.65,stone);
  }
  return group;
}

function batchBoxes(group,items,mat,name){
  const mesh=new T.InstancedMesh(new T.BoxGeometry(),mat,items.length),dummy=new T.Object3D();
  items.forEach(({x,y,z,sx,sy,sz,a=0},i)=>{
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,a,0);
    dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.name=name;group.add(mesh);
}

function addBridgeRails(root,decks){
  const rails=[],posts=[];
  for(const deck of decks){
    for(let a=0;a+11<deck.length;a+=6)for(const side of [0,3]){
      const i=a+side,j=i+6,dx=deck[j]-deck[i],dz=deck[j+2]-deck[i+2];
      const span=Math.hypot(dx,dz);
      if(span<.001)continue;
      const x=(deck[i]+deck[j])*.5,z=(deck[i+2]+deck[j+2])*.5,y=(deck[i+1]+deck[j+1])*.5;
      const angle=Math.atan2(dx,dz);
      rails.push({x,y:y+.0064,z,sx:.0033,sy:.0034,sz:span,a:angle});
      posts.push({x:deck[i],y:deck[i+1]+.005,z:deck[i+2],sx:.0047,sy:.012,sz:.0047,a:angle});
      if(side===0&&a%12===0)
        posts.push({x,y:y-.010,z,sx:.014,sy:.023,sz:.010,a:angle});
    }
  }
  const stone=material(0xa6a79a);
  batchBoxes(root,rails,stone,'Jiǔqū bridge handrails');
  batchBoxes(root,posts,stone,'Jiǔqū bridge posts');
}

export function createXiaoyingzhou(landscape,batch){
  const root=new T.Group(),{island}=landscape;
  root.name='三潭印月 · 小瀛洲';
  if(!island)return root;
  const model=batch(stoneTower()),glow=makeTowerGlow();
  const candle=new T.MeshStandardMaterial({color:0x5b4c37,emissive:0xffb85c,emissiveIntensity:0});
  const candleGeom=new T.SphereGeometry(.00145,12,8);
  const paneMaterial=new T.MeshBasicMaterial({color:0x292a22,side:T.DoubleSide});
  const paneGeometry=new T.CircleGeometry(.00143,24);
  const warm=new T.Color(0xffb85c),dark=new T.Color(0x272923);
  const lantern=new T.MeshStandardMaterial({color:0x926841,emissive:0xffb85c,emissiveIntensity:0});
  STONE_TOWERS.forEach(({x,z},i)=>{
    const tower=model.clone();
    tower.name='三潭石塔 '+(i+1);
    tower.position.set(x,ISLAND_WATER_Y,z);tower.rotation.y=.54+i*.16;
    component(tower,candleGeom,candle,0,.0214,0);
    for(let k=0;k<5;k++){
      const angle=k*2*Math.PI/5,r=.00913;
      // A thin translucent-looking backing reproduces the historical paper shades.
      component(tower,paneGeometry,paneMaterial,Math.sin(angle)*r,.0215,Math.cos(angle)*r,angle);
    }
    root.add(tower);
    const halo=new T.Mesh(new T.PlaneGeometry(.093,.093),glow);
    halo.rotation.x=-Math.PI/2;halo.position.set(x,ISLAND_WATER_Y+.00118,z);
    halo.name='三潭水面烛光';root.add(halo);
  });
  for(const site of island.stage){
    const house=batch(makeGardenPavilion(site,lantern));
    const deck=landscape.walkHeight(site.x,site.z),soil=landscape.terrainSurfaceY(site.x,site.z);
    const floor=Math.max(ISLAND_WATER_Y+.010,soil,deck-.004);
    house.position.set(site.x,floor,site.z);house.rotation.y=site.yaw;house.name=site.name;
    root.add(house);
    if(soil<floor-.010){
      const bottom=Math.max(ISLAND_WATER_Y-.004,soil);
      if(floor>bottom)component(root,new T.BoxGeometry(site.w*.97,floor-bottom,site.d*.87),
        material(0x899186),site.x,(floor+bottom)/2,site.z,site.yaw).name=site.name+' · 台基';
    }
  }
  const signature=island.stage[0];
  component(root,new T.BoxGeometry(.200,.018,.083),material(0xa4aa9d),
    signature.x,ISLAND_WATER_Y+.012,signature.z+.047).name='我心相印亭 · 观塔平台';
  const north=island.stage.at(-1),pier=[];
  for(let i=0;i<26;i++){
    const z=north.z-.071-.0076*i;
    pier.push({x:north.x+.050,y:ISLAND_WATER_Y+.012,z,sx:.073,sy:.005,sz:.0074});
    if(i%6===0)for(const dx of [-.033,.033])
      pier.push({x:north.x+.050+dx,y:ISLAND_WATER_Y+.011,z,sx:.006,sy:.046,sz:.006});
  }
  batchBoxes(root,pier,material(0x69503b),'先贤祠 · 画舫码头');
  addBridgeRails(root,landscape.islandDecks);
  root.traverse(mesh=>{
    if(mesh.isMesh&&mesh.material!==glow&&mesh.material!==candle)
      mesh.castShadow=mesh.receiveShadow=true;
  });
  root.userData.updateWeather=(time,weather,night)=>{
    const strength=T.MathUtils.smoothstep(night,.20,.80);
    candle.emissiveIntensity=strength*(2.0+.19*Math.sin(time*8.2));
    paneMaterial.color.copy(dark).lerp(warm,strength*(.91+.09*Math.sin(time*7.3)));
    lantern.emissiveIntensity=strength*1.22;
    glow.uniforms.night.value=strength;
    glow.uniforms.time.value=time;
  };
  return root;
}
