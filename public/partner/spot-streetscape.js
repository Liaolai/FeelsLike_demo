import * as T from '../assets/three.module.js';
import {textureSurface} from './surface-materials.js';

const limestone=new T.MeshStandardMaterial({color:0xa9a398,roughness:.89});
textureSurface(limestone,'ground');

export function buildStreetKits(plans, landscape){
  const root=new T.Group();root.name='Path-aligned scenic streetscapes';
  const dummy=new T.Object3D();
  const lampMaterial=new T.MeshStandardMaterial({name:'Emissive_WarmLamp',color:0xf4be73,
    emissive:0xffa34a,emissiveIntensity:.035,roughness:.38});
  const types={
    stone:[new T.BoxGeometry(1,1,1),limestone],
    capital:[new T.IcosahedronGeometry(.66,0),limestone],
    iron:[new T.CylinderGeometry(.5,.5,1,6),new T.MeshStandardMaterial({color:0x343e35,metalness:.45,roughness:.66})],
    timber:[new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0x6e4830,roughness:.83})],
    lamp:[new T.BoxGeometry(1,1,1),lampMaterial],
    trunk:[new T.CylinderGeometry(.32,.50,1,8),new T.MeshStandardMaterial({color:0x645847,roughness:.92})],
    crown:[new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:0x647d43,roughness:.88})]
  };
  const batches=Object.fromEntries(Object.keys(types).map(key=>[key,[]]));
  function add(kind,x,y,z,sx,sy,sz,yaw=0,tilt=0){
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);
    dummy.rotation.set(0,yaw,tilt,'YXZ');dummy.updateMatrix();
    batches[kind].push(dummy.matrix.clone());
  }
  function edge(station,side,d){
    return [station.x-station.dz*d*side,station.z+station.dx*d*side];
  }
  function footingHeight(x,z,station){
    return landscape.roadsideHeight?.(x,z)??landscape.terrainSurfaceY(x,z);
  }
  function railBetween(a,b){
    const [ax,ay,az]=a,[bx,by,bz]=b;
    const dx=bx-ax,dz=bz-az,l=Math.hypot(dx,dz);
    if(l<.007||l>.20)return;
    const yaw=-Math.atan2(dz,dx);
    const spans=Math.max(2,Math.ceil(l/.029));
    for(let i=0;i<=spans;i++){
      const t=i/spans,x=ax+dx*t,y=ay+(by-ay)*t,z=az+dz*t;
      add('stone',x,y+.005,z,.0022,.010,.0022,yaw);
      add('capital',x,y+.0105,z,.0025,.00165,.0025,yaw);
      if(i<spans){
        const t=(i+.5)/spans;
        const x=ax+dx*t,y=ay+(by-ay)*t,z=az+dz*t;
        add('stone',x,y+.0047,z,.0026,.0026,.0013,yaw,Math.PI/4);
      }
    }
    for(const y of [.0018,.0086])add('stone',(ax+bx)*.5,(ay+by)*.5+y,(az+bz)*.5,l,.00145,.00165,yaw,Math.atan2(by-ay,l));
  }
  for(const {kit,rows} of plans.values()){
    if(rows.length<1||kit.asset==='duanqiao')continue;
    let previous=null;
    const setback=kit.asset==='beishan'?.056:kit.asset==='yanggong'?.053:kit.asset==='hubin'?.044:.025;
    for(let i=0;i<rows.length;i++){
      const row=rows[i];
      const northSign=row.dx>0?-1:1;
      const sides=[-1,1].map(side=>{
        const [x,z]=edge(row,side,setback);
        return {x,z,side,wet:landscape.wet(x,z)};
      });
      const shore=kit.north?sides.find(p=>p.side!==northSign):
        sides.find(p=>p.wet)||sides.find(p=>landscape.wet(...edge(row,p.side,setback+.037)));
      if(shore){
        const y=Math.max(.050,landscape.terrainSurfaceY(shore.x,shore.z)+.001,
          landscape.walkHeight(row.x,row.z)-.020);
        const point=[shore.x,y,shore.z];
        if(previous)railBetween(previous,point);
        previous=point;
      }else previous=null;
      for(const side of sides){
        const {x,z,wet}=side;
        if(wet||landscape.nearRoad(x,z,.012))continue;
        const y=footingHeight(x,z,row);
        if(kit.north){
          const h=.113+.026*Math.sin(i*1.8);
          add('trunk',x,y+h*.34,z,.0075,h*.68,.0075);
          add('crown',x-.017,y+h*.78,z+.004,.031,h*.29,.028);
          add('crown',x+.014,y+h*.87,z-.003,.029,h*.28,.033,1.2);
          add('crown',x,y+h*.92,z+.020,.028,h*.29,.029,2.3);
        }
        if((shore?.side??northSign) !== side.side || i%2!==0)continue;
        const yaw=-Math.atan2(row.dz,row.dx);
        const lx=x+row.dx*.026,lz=z+row.dz*.026;
        add('iron',lx,y+.017,lz,.0020,.034,.0020);
        add('iron',lx,y+.0016,lz,.0047,.0032,.0047);
        for(const sign of [-1,1]){
          const bx=lx+sign*row.dx*.005,bz=lz+sign*row.dz*.005;
          add('iron',bx,y+.034,bz,.00115,.011,.00115,yaw,Math.PI/2);
          add('lamp',lx+sign*row.dx*.010,y+.035,lz+sign*row.dz*.010,.0032,.0048,.0032,yaw);
          add('iron',lx+sign*row.dx*.010,y+.038,lz+sign*row.dz*.010,.0047,.0017,.0047);
        }
        const bx=x-row.dx*.021,bz=z-row.dz*.021;
        for(const k of [-1,1])add('stone',bx+k*row.dx*.007,y+.0021,bz+k*row.dz*.007,.0024,.0042,.0048,yaw);
        for(let j=0;j<4;j++){
          const d=j*.00113-.0017;
          add('timber',bx+row.dz*d,y+.0048,bz-row.dx*d,.021,.0010,.00096,yaw);
        }
      }
    }
  }
  for(const [kind,[geometry,material]] of Object.entries(types)){
    const matrices=batches[kind];
    if(!matrices.length){geometry.dispose();continue;}
    const mesh=new T.InstancedMesh(geometry,material,matrices.length);
    matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
    mesh.name='Streetscape '+kind;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  root.userData.updateNight=night=>{lampMaterial.emissiveIntensity=.035+.95*night;};
  return root;
}

export function createLandmarkPlinth(bounds, placement, elevation, surface){
  if(placement.asset==='santan')return null;
  const width=(bounds.max.x-bounds.min.x)*.01,depth=(bounds.max.z-bounds.min.z)*.01;
  const rx=width*.44,rz=depth*.43;
  const sin=Math.sin(placement.yaw),cos=Math.cos(placement.yaw);
  let lowest=elevation;
  for(const x of [-rx,0,rx])for(const z of [-rz,0,rz]){
    const gx=placement.x+x*cos+z*sin,gz=placement.z+z*cos-x*sin;
    lowest=Math.min(lowest,surface(gx,gz));
  }
  const base=placement.onWater?.029:Math.max(elevation-.22,lowest-.004);
  const height=Math.max(.004,elevation-base+.001);
  const mesh=new T.Mesh(new T.BoxGeometry(rx*2,height,rz*2),limestone);
  mesh.position.set(placement.x,elevation-height/2,placement.z);
  mesh.rotation.y=placement.yaw;
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.name='Limestone slope footing';
  return mesh;
}
