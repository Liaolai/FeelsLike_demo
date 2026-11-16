import {textureSurface} from './surface-materials.js';
import * as T from '../assets/three.module.js';
import {pavilionRoof} from './scenic-craft.js';
import {instanceBoxes} from './baidi-embankment.js';
import {addBox,addPart,castAndReceive,makePavilion,material,plantBatch,seededRandom,terrace} from './waterfront-kit.js';

function createFountain(root,site){
  const {x,z}=site,n=57,dummy=new T.Object3D(),pointCount=216;
  const pale=new T.Color(0xd0f2fa),blue=new T.Color(0x7adfff),gold=new T.Color(0xffc775),color=new T.Color();
  const water=new T.MeshBasicMaterial({transparent:true,opacity:.59,depthWrite:false});
  const jets=new T.InstancedMesh(new T.CylinderGeometry(.0023,.0058,1,7),water,n);
  jets.name='西湖音乐喷泉 · 三排动态水柱';jets.frustumCulled=false;
  jets.instanceMatrix.setUsage(T.DynamicDrawUsage);jets.renderOrder=6;
  const nozzle=[];
  for(let i=0;i<n;i++){
    const row=Math.floor(i/19)-1,col=i%19-9;
    nozzle.push([x+row*.045+.017*(col/9)**2,z+col*.047,row,col]);
  }
  const positions=new Float32Array(pointCount*3),opacity=new Float32Array(pointCount);
  const sprayGeometry=new T.BufferGeometry();
  sprayGeometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
  sprayGeometry.setAttribute('opacity',new T.BufferAttribute(opacity,1).setUsage(T.DynamicDrawUsage));
  const spray=new T.Points(sprayGeometry,new T.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{night:{value:0}},
    vertexShader:`attribute float opacity; varying float a; void main(){
      a=opacity;vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize=clamp(25.0/max(.5,-mv.z),2.0,14.0);
      gl_Position=projectionMatrix*mv;
    }`,
    fragmentShader:`uniform float night; varying float a; void main(){
      vec2 q=gl_PointCoord*2.0-1.0;float p=max(0.0,1.0-dot(q,q));
      gl_FragColor=vec4(mix(vec3(.90,.97,1.0),vec3(.57,.88,1.0),night),p*p*a*.40);
    }`}));
  spray.name='喷泉水雾';spray.frustumCulled=false;spray.renderOrder=7;
  const reflections=new T.Mesh(new T.PlaneGeometry(.68,1.09),
    new T.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{night:{value:0},time:{value:0}},vertexShader:`
      varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
      `,fragmentShader:`
        varying vec2 v;uniform float night,time;void main(){
          vec2 p=(v-.5)*2.0;float mask=max(0.0,1.0-p.x*p.x-p.y*p.y);
          float rays=.50+.50*sin(p.y*32.0-time*2.6+p.x*5.0);
          float ripple=.55+.45*sin(p.x*37.0+time*5.2+p.y*9.0);
          vec3 light=mix(vec3(.24,.75,1.0),vec3(1.0,.69,.27),.5+.5*sin(p.y*4.0+time));
          gl_FragColor=vec4(light,mask*mask*rays*ripple*night*.86);
        }`}));
  reflections.name='喷泉流光水面反射';reflections.rotation.x=-Math.PI/2;
  reflections.position.set(x-.058,.0431,z);reflections.renderOrder=5;
  const nozzleGlow=plantBatch(root,'喷泉金蓝灯组',new T.SphereGeometry(1,7,5),
    new T.MeshBasicMaterial(),nozzle.filter((_,i)=>i>=19&&i<38).map(([a,b],i)=>
      [a,.043,b,.008,.003,.006,i%3===0?0xfbc883:0x81dcff]));
  nozzleGlow.visible=false;
  const meshNozzles=nozzle.map(([a,b])=>[a,.041,b,.012,.004,.009]);
  instanceBoxes(root,meshNozzles,0x4f777c,'喷泉喷头矩阵');
  root.add(reflections,jets,spray);
  let night=0;
  const heights=new Float32Array(n);
  function animate(time){
    for(let i=0;i<n;i++){
      const [a,b,row,col]=nozzle[i];
      const phase=time*2.25+col*.35+row*.81;
      const pulse=.55+.45*Math.sin(phase),fan=1-Math.abs(col)/12;
      const h=.032+(.062+.34*pulse*pulse)*fan*(row===0?1:.62);
      const lean=.18*row*Math.sin(time*.62+col*.12);
      heights[i]=h;
      dummy.position.set(a-Math.sin(lean)*h*.5,.042+h*.48,b);
      dummy.scale.setScalar(1);dummy.scale.y=h;dummy.rotation.set(0,0,lean);
      dummy.updateMatrix();jets.setMatrixAt(i,dummy.matrix);
      color.copy(pale).lerp(i%3?blue:gold,night*(.63+.37*Math.sin(time*.7+i*.3)));
      jets.setColorAt(i,color);
    }
    jets.instanceMatrix.needsUpdate=true;jets.instanceColor.needsUpdate=true;
    water.opacity=.55+night*.22;
    for(let i=0;i<pointCount;i++){
      const k=(i*7)%n,[a,b]=nozzle[k],age=(time*(.61+(i%5)*.06)+(i*.618)%1)%1;
      const az=i*2.399;
      positions[i*3]=a+.042*age*Math.cos(az)+.007*Math.sin(time*2+i);
      positions[i*3+1]=.044+heights[k]+.04*age-.14*age*age;
      positions[i*3+2]=b+.052*age*Math.sin(az);
      opacity[i]=(1-age)*.85;
    }
    sprayGeometry.attributes.position.needsUpdate=sprayGeometry.attributes.opacity.needsUpdate=true;
    reflections.material.uniforms.time.value=time;
  }
  animate(0);
  return {animate,night(value){
    night=value;nozzleGlow.visible=value>.18;
    spray.material.uniforms.night.value=value;
    reflections.material.uniforms.night.value=value;
  }};
}

function ledPanel(root,w,h,x,y,z,yaw,time,night){
  const material=new T.ShaderMaterial({uniforms:{time,night},side:T.DoubleSide,
    vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      varying vec2 v;uniform float time,night;
      void main(){
        vec2 p=v-.5;
        float wave=.45+.55*sin(v.x*14.0+v.y*9.5-time*1.42+1.8*sin(v.y*6.0+time*.83));
        float orb=exp(-12.0*length(p-vec2(.24*sin(time*.9),.16*cos(time*.9))));
        float horizon=pow(max(0.0,.51-v.y),.38);
        vec3 rgb=mix(vec3(.042,.15,.32),vec3(.20,.86,.92),wave*.73)*(.70+.40*horizon)
          +vec3(1.0,.60,.28)*orb*1.25;
        float pixels=.88+.12*cos(v.y*460.0);
        float frame=smoothstep(.0,.025,min(min(v.x,1.0-v.x),min(v.y,1.0-v.y)));
        gl_FragColor=vec4(rgb*pixels*frame*(.77+.28*night),1.);
      }
    `});
  const screen=addPart(root,new T.PlaneGeometry(w,h),material,x,y,z,yaw);
  screen.name='西湖天幕 · 动态 LED 大屏';
}

function buildHubinBusiness(root,landscape,batch,time,night){
  const {rebuilt}=landscape.waterfronts.hubin;
  const stone=material(0xb9aaa0,.89),metal=material(0x81766c,.40,{metalness:.46});
  const glass=material(0x81a9b9,.22,{transparent:true,opacity:.49,depthWrite:false,metalness:.29});
  const window=material(0x557282,.24,{emissive:0x936642,emissiveIntensity:.04,metalness:.31});
  const warm=material(0xe7d8bb,.69,{emissive:0xffcc86,emissiveIntensity:.06});
  const cap=material(0x414b4c,.73),plant=material(0x637950,.92),dark=material(0x47494a,.66);
  const allWindows=[],columns=[],slabs=[],beds=[];
  for(const p of rebuilt){
    if(p.name.includes('东翼'))continue;
    const group=new T.Group();group.name=p.name;
    const hotel=/酒店|饭店/.test(p.name),apple=p.id===328911727,heritage=p.name.includes('龙翔里');
    const w=p.w*.91,d=p.d*.88,x=p.x,z=p.z;
    const grade=Math.max(.069,landscape.terrainSurfaceY(x,z)+.007);
    const height=apple?.15:heritage?.113:hotel?(p.name.includes('君悦')?.49:.31):.16+(Number(p.id)%7)*.027;
    terrace(root,landscape.terrainSurfaceY,x,z,w,d,grade,stone);
    if(apple){
      addBox(group,warm,x,grade+.008,z,w*.98,.014,d*.96);
      addBox(group,metal,x,grade+height+.006,z,w*1.10,.012,d*1.08);
      addBox(group,warm,x,grade+height-.009,z,w*.89,.003,d*.86);
      for(const sign of [-1,1]){
        addBox(group,glass,x+sign*w*.50,grade+height*.50,z,.0022,height,d);
        addBox(group,glass,x,grade+height*.50,z+sign*d*.50,w,height,.0022);
        for(let i=-2;i<=2;i++){
          columns.push([x+sign*w*.501,grade+height*.50,z+i*d*.184,.003,height,.003]);
          columns.push([x+i*w*.184,grade+height*.50,z+sign*d*.501,.003,height,.003]);
        }
      }
      for(let j=0;j<4;j++)for(const q of [-1,1]){
        const xx=x+q*w*.255,zz=z+(j-1.5)*d*.2;
        addBox(group,stone,xx,grade+.011,zz,.040,.020,.017);
        for(let k=0;k<3;k++)addBox(group,window,xx+(k-1)*.011,grade+.022,zz,.008,.002,.011);
      }
      root.add(group);
      continue;
    }
    if(heritage){
      const bay=d/6;
      for(let i=0;i<6;i++){
        const zz=z+(i-2.5)*bay;
        addBox(group,i%2?stone:dark,x+.015,grade+.060,zz,w*.89,.102,bay*.94);
        addBox(group,glass,x-w*.45,grade+.022,zz,.0038,.040,bay*.82);
        for(const dz of [-bay*.39,bay*.39]){
          columns.push([x-w*.49,grade+.027,zz+dz,.008,.052,.008]);
          addBox(group,stone,x,grade+.111,zz+dz,w*.94,.013,.005);
          addBox(group,stone,x-w*.36,grade+.120,zz+dz,w*.14,.010,.005);
        }
        const roof=pavilionRoof(w*.96,bay*1.09,grade+.099,.020,.002,.39);
        addPart(group,roof,cap,x,0,zz);
        addBox(group,window,x-w*.451,grade+.070,zz,.0029,.026,bay*.57);
      }
      root.add(batch(group));root.children.at(-1).name=p.name;
      continue;
    }
    const levels=hotel?Math.ceil(height/.038):Math.ceil(height/.044);
    const base=hotel?stone:metal;
    const floor=height/levels;
    for(let i=0;i<levels;i++){
      const inset=hotel?1-.35*(Math.floor(i/3)/Math.max(1,Math.floor((levels-1)/3))):
        1-(i===levels-1?.07:0);
      const width=w*inset,dep=d*(hotel?.4+.60*inset:inset),h=grade+(i+.5)*floor;
      const shift=hotel?(w-width)*.20:0;
      slabs.push([x+shift,h+floor*.49,z,width+.015,.006,dep+.009]);
      addBox(group,base,x+shift,h,z,width,floor,dep);
      const cols=Math.min(32,Math.max(5,Math.round(dep/(hotel?.033:.035))));
      for(let j=0;j<cols;j++){
        const a=z+(j+.5-cols*.5)*dep/cols;
        for(const side of [-1,1])allWindows.push([x+shift+side*(width/2+.001),h,a,.0027,
          floor*(hotel?.48:.66),dep/cols*.79]);
      }
      const ends=Math.min(28,Math.max(4,Math.round(width/.036)));
      for(let j=0;j<ends;j++){
        const a=x+shift+(j+.5-ends*.5)*width/ends;
        for(const side of [-1,1])allWindows.push([a,h,z+side*(dep/2+.001),width/ends*.81,floor*.56,.0027]);
      }
      if(hotel&&i%3===2){
        const y=h+floor*.5+.003;
        for(let j=-2;j<=2;j++)beds.push([x+shift-width*.50+.022,y,z+j*dep*.145,.045,.008,.066]);
      }
    }
    for(let edge=-4;edge<=4;edge++)columns.push([x-w*.501,grade+.048,z+edge*d*.103,.006,.088,.006]);
    if(!hotel){
      addBox(group,cap,x,grade+height+.005,z,w*.97,.010,d*.95);
      addBox(group,warm,x-w*.503,grade+.038,z,.0035,.021,d*.88);
    }
    if(p.name.includes('A区')||p.name.includes('D区')){
      const sx=x-w*.51;
      addBox(group,dark,sx,grade+.135,z,.009,.102,d*.55);
      ledPanel(root,d*.51,.088,sx-.006,grade+.136,z,-Math.PI/2,time,night);
      ledPanel(root,w*.29,.088,x-w*.36,grade+.136,z-d*.51-.006,Math.PI,time,night);
    }
    const building=batch(group);building.name=p.name;root.add(building);
  }
  const wBatch=instanceBoxes(root,allWindows,0x607582,'湖滨商厦 · 水平窗带与玻璃格栅');
  wBatch.material.dispose();wBatch.material=window;
  instanceBoxes(root,columns,0xa69581,'湖滨旗舰店与骑楼立柱');
  instanceBoxes(root,slabs,0xbcb0a2,'石材退台与金属挑檐');
  const roofBeds=instanceBoxes(root,beds,0x637950,'酒店屋顶及退台花园');
  roofBeds.material.dispose();roofBeds.material=plant;
  return value=>{window.emissiveIntensity=.04+value*.42;warm.emissiveIntensity=.06+value*.89;};
}

function addInkWalk(root,site,ground){
  const positions=[],uv=[];
  for(const {path,width} of site.streets){
    let length=0;
    for(let i=1;i<path.length;i++){
      const [ax,az]=path[i-1],[bx,bz]=path[i],dx=bx-ax,dz=bz-az;
      const distance=Math.hypot(dx,dz),n=Math.ceil(distance/.028);
      if(!n)continue;
      const nx=dz*width*.5/distance,nz=-dx*width*.5/distance;
      const section=t=>{
        const x=ax+dx*t,z=az+dz*t;
        return [[x+nx,ground(x+nx,z+nz)+.0003,z+nz],[x-nx,ground(x-nx,z-nz)+.0003,z-nz]];
      };
      const across=Math.max(1,Math.ceil(width/.015));
      const point=(t,w)=>{const x=ax+dx*t+nx*(1-2*w),z=az+dz*t+nz*(1-2*w);return [x,ground(x,z)+.0003,z];};
      for(let k=0;k<n;k++)for(let j=0;j<across;j++){
        const A=point(k/n,j/across),B=point(k/n,(j+1)/across),C=point((k+1)/n,j/across),D=point((k+1)/n,(j+1)/across),u=(length+k*distance/n)/.024,v=u+distance/n/.024;
        positions.push(...A,...B,...C,...B,...D,...C);uv.push(u,j*width/across/.023,-1,u,(j+1)*width/across/.023,1,v,j*width/across/.023,-1,u,(j+1)*width/across/.023,1,v,(j+1)*width/across/.023,1,v,j*width/across/.023,-1);
      }
      length+=distance;
    }
  }
  const m=material(0xd2cfc5,.95,{side:T.DoubleSide});
  textureSurface(m,'ink-paving');
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('pavingCoord',new T.Float32BufferAttribute(uv,3));g.computeVertexNormals();
  const mesh=new T.Mesh(g,m);mesh.name='湖滨路、平海路与东坡路连续水墨石板';mesh.receiveShadow=true;
  root.add(mesh);
}
export function createHubinScenery(landscape,batch){
  const root=new T.Group();root.name='湖滨 · 喷泉步行街与 in77';
  const site=landscape.waterfronts.hubin,{plaza,jixian,pavilionBank}=site;
  const stone=material(0xc8c1b4),wood=material(0x843c29),tile=material(0x3c4746,.81,{side:T.DoubleSide});
  const lamp=material(0xdcd8bc,.69,{emissive:0xffb769,emissiveIntensity:.06});
  const lamps=[],furniture=[],steel=[],rails=[],tiles=[],trunks=[],crowns=[],umbrellas=[],glassParts=[];
  const time={value:0},night={value:0},random=seededRandom(6039);
  const ground=landscape.terrainSurfaceY;
  addInkWalk(root,site,ground);
  const porch=makePavilion({w:.177,d:.155,style:'polygon',sides:6,stone,wood,tile,lamp});
  const jx=jixian.x,jz=jixian.z,finish=.071;
  terrace(root,ground,jx,jz,.236,.205,finish,stone);
  const reach=pavilionBank-jx;
  const count=Math.ceil(reach/.025);
  for(let i=0;i<count;i++){
    const x=jx+(i+.5)*reach/count;
    addBox(root,stone,x,.053,jz,reach/count+.001,.039,.079);
    for(const s of [-1,1])rails.push([x,.076,jz+s*.039,.0052,.019,.0052]);
  }
  const j=batch(porch);j.name='集贤亭 · 重檐六角攒尖顶';j.position.set(jx,finish,jz);root.add(j);
  for(let row=0;row<3;row++){
    const x=plaza.x-.135+row*.037,wide=.50+row*.053,y=.051+row*.010;
    terrace(root,ground,x,plaza.z,.039,wide,y,stone);
    for(let col=-8;col<=8;col++)
      tiles.push([x+(col/8)**2*.027,y+.001,plaza.z+col*wide/17,.037,.003,wide/17-.001]);
  }
  for(let i=0;i<14;i++)for(let k=-13;k<=13;k++){
    const x=plaza.x-.024+i*.029,z=plaza.z+k*.027;
    const q=Math.abs(k)/13;
    if(i<.9&&q>.84)continue;
    const y=Math.max(.076,ground(x,z)+.006);
    tiles.push([x,y,z,.0285,.007,.0265]);
    if(i===0&&k%2===0&&Math.abs(k)>3){
      rails.push([x,y+.017,z,.010,.032,.009]);
      if(Math.abs(k)<12)rails.push([x,y+.020,z+.027,.005,.008,.052]);
    }
  }
  for(const s of [-1,1])terrace(root,ground,plaza.x+.080,plaza.z+s*.286,.22,.094,.078,stone);

  function streetObject(x,z,i){
    if(landscape.wet(x,z)||landscape.nearRoad(x,z,.012))return;
    const y=Math.max(.063,ground(x,z)+.004);
    if(i%5===0){
      steel.push([x,y+.027,z,.0033,.054,.0033],[x-.011,y+.054,z,.024,.0031,.0032]);
      lamps.push([x-.020,y+.052,z,.008,.0043,.0055,0xe3cf9e]);
    }else if(i%3===0){
      furniture.push([x,y+.012,z,.015,.012,.015]);
      steel.push([x,y+.020,z,.0018,.040,.0018]);
      umbrellas.push([x,y+.039,z,.024,.010,.024,i%2?0xdbd2b2:0x8baca6]);
    }else{
      const h=.075+random()*.055;
      furniture.push([x,y+.005,z,.046,.005,.046]);
      trunks.push([x,y+h*.38,z,.004,h*.76,.004,0x7c6d53]);
      for(let v=0;v<4;v++){
        const a=v*Math.PI*.5;
        crowns.push([x+Math.sin(a)*h*.125,y+h*.77,z+Math.cos(a)*h*.125,h*.29,h*.24,h*.29,
          i%2?0xa4a34f:0x687f54,a]);
      }
    }
  }
  for(let i=0;i<28;i++){
    const x=plaza.x+.22+i*.075;
    const z=plaza.z-.182-.031*Math.sin(i*.6);
    streetObject(x,z,i);
    streetObject(x,z+.225,i+2);
  }
  for(let i=0;i<17;i++)streetObject(plaza.x+.26+Math.sin(i*.1)*.16,plaza.z+i*.075,i+1);
  for(const [a,b] of [[.39,-.32],[.80,.17]]){
    const x=plaza.x+a,z=plaza.z+b,y=Math.max(.071,ground(x,z)+.006);
    if(landscape.wet(x,z))continue;
    glassParts.push([x,y+.027,z,.093,.048,.053]);
    steel.push([x,y+.053,z,.102,.004,.063],[x,y+.005,z,.096,.004,.056]);
    for(const d of [-.045,.045])for(const e of [-.025,.025])
      steel.push([x+d,y+.028,z+e,.003,.045,.003]);
  }
  instanceBoxes(root,tiles,0xcac4b6,'湖滨三公园花岗岩涟漪广场与阶梯');
  instanceBoxes(root,rails,0xbdb5a5,'湖滨亲水石栏');
  instanceBoxes(root,furniture,0xa1917e,'湖滨外摆茶座与树池');
  instanceBoxes(root,steel,0x526263,'通透花亭框与城市景观灯');
  const transparent=instanceBoxes(root,glassParts,0x8db5b9,'玻璃商业花亭');
  transparent.material.transparent=true;transparent.material.opacity=.31;transparent.material.depthWrite=false;
  transparent.castShadow=false;
  plantBatch(root,'湖滨暖光庭院灯',new T.SphereGeometry(1,8,6),lamp,lamps);
  plantBatch(root,'湖滨咖啡座遮阳伞',new T.ConeGeometry(1,1,12),material(0xffffff),umbrellas);
  plantBatch(root,'银杏悬铃木树干',new T.CylinderGeometry(.60,.74,1,8),material(0xffffff),trunks);
  plantBatch(root,'银杏和悬铃木行道树',new T.SphereGeometry(1,9,7),material(0xffffff),crowns);
  const business=buildHubinBusiness(root,landscape,batch,time,night);
  castAndReceive(root);
  const fountain=createFountain(root,site.fountain);
  root.userData.animate=t=>{time.value=t;fountain.animate(t);};
  root.userData.updateWeather=(t,weather,value)=>{
    night.value=value;fountain.night(value);business(value);lamp.emissiveIntensity=.06+value*1.36;
  };
  return root;
}
