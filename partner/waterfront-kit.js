import * as T from '../assets/three.module.js';
import {pavilionRoof} from './scenic-craft.js';

export function material(color,roughness=.83,other={}){
  return new T.MeshStandardMaterial({color,roughness,...other});
}

export function addPart(root,geometry,mat,x,y,z,yaw=0){
  geometry.clearGroups();
  const mesh=new T.Mesh(geometry,mat);
  mesh.position.set(x,y,z);mesh.rotation.y=yaw;root.add(mesh);
  return mesh;
}

export function addBox(root,mat,x,y,z,w,h,d,yaw=0){
  return addPart(root,new T.BoxGeometry(w,h,d),mat,x,y,z,yaw);
}

export function castAndReceive(root){
  root.traverse(object=>{
    if(object.isMesh&&object.material.isMeshStandardMaterial&&!object.material.transparent)
      object.castShadow=object.receiveShadow=true;
  });
}

export function plantBatch(group,name,geometry,mat,items){
  const mesh=new T.InstancedMesh(geometry,mat,items.length),dummy=new T.Object3D(),color=new T.Color();
  items.forEach(([x,y,z,sx,sy,sz,tint=0xffffff,yaw=0],i)=>{
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,yaw,0);
    dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.set(tint));
  });
  mesh.name=name;group.add(mesh);return mesh;
}

export function seededRandom(seed){
  return ()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
}

export function onPath(path,spacing,callback){
  for(let i=1;i<path.length;i++){
    const [ax,az]=path[i-1],[bx,bz]=path[i],dx=bx-ax,dz=bz-az;
    const length=Math.hypot(dx,dz);
    if(length<1e-6)continue;
    const steps=Math.ceil(length/spacing),yaw=Math.atan2(dx,dz);
    for(let j=0;j<steps;j++){
      const t=(j+.5)/steps;
      callback(ax+dx*t,az+dz*t,yaw,length/steps,i,j);
    }
  }
}

export function terrace(root,ground,x,z,w,d,floor,stone){
  const bed=Math.min(.018,ground(x,z)-.032);
  const mesh=addBox(root,stone,x,(floor+bed)/2,z,w,floor-bed,d);mesh.userData.walkable=true;
}

function polygonRoof(n,width,y,eaveRise,rise){
  const vertices=[],indices=[];
  const radius=width*.5;
  const segments=4;
  for(let j=0;j<=5;j++)for(let i=0;i<=n*segments;i++){
    const a=Math.floor(i/segments)*Math.PI*2/n,b=a+Math.PI*2/n,blend=(i%segments)/segments;
    const t=1-j/5;
    const x=(Math.sin(a)*(1-blend)+Math.sin(b)*blend)*radius*t;
    const z=(Math.cos(a)*(1-blend)+Math.cos(b)*blend)*radius*t;
    vertices.push(x,y+rise*(1-t)**1.5+eaveRise*t**4*Math.abs(blend*2-1)**3,z);
    if(j&&i){
      const m=j*(n*segments+1)+i;
      indices.push(m,m-1,m-n*segments-2,m,m-n*segments-2,m-n*segments-1);
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
}

export function makePavilion({w,d,style='double',sides=8,stone,wood,tile,lamp}){
  const group=new T.Group(),plaster=material(0xe3dfce),dark=material(0x402c26);
  const box=(mat,x,y,z,a,h,b)=>addBox(group,mat,x,y,z,a,h,b);
  const polygon=style==='polygon',end=style==='stele',court=style==='court';
  const rim=polygon?w*.66:w;
  box(stone,0,.003,0,w*.94,.006,d*.93);
  if(polygon)addPart(group,new T.CylinderGeometry(rim*.74,rim*.74,.006,sides),stone,0,.003,0);
  const columns=[];
  if(polygon)for(let i=0;i<sides;i++){
    const a=i*Math.PI*2/sides;columns.push([Math.sin(a)*w*.37,Math.cos(a)*d*.37]);
  }
  else for(const z of [-d*.37,d*.37])for(const x of [-w*.40,0,w*.40])columns.push([x,z]);
  const post=w*.34,below=.009;
  for(const [x,z] of columns){
    addPart(group,new T.CylinderGeometry(w*.038,w*.046,.004,8),stone,x,below,z);
    addPart(group,new T.CylinderGeometry(w*.023,w*.029,post,10),wood,x,below+post/2,z);
    box(dark,x,below+post-.003,z,w*.067,.005,w*.067);
  }
  if(polygon){
    for(let i=0;i<sides;i++){
      const a=columns[i],b=columns[(i+1)%sides];
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);
      for(const y of [below+.010,below+post-.006])
        addBox(group,dark,(a[0]+b[0])/2,y,(a[1]+b[1])/2,.004,.004,length,yaw);
    }
  }else{
    for(const z of [-d*.37,d*.37])box(wood,0,below+post-.006,z,w*.87,.006,.006);
    if(!end){
      box(dark,0,below+.010,-d*.34,w*.75,.006,.006);
      for(const x of [-w*.40,w*.40]){
        box(dark,x,below+.010,0,.005,.006,d*.68);
        box(wood,x,below+.017,0,.004,.003,d*.69);
      }
    }
  }
  const roof=below+post;
  function eaves(x=0,z=0){
    const first=polygon?polygonRoof(sides,w*1.23,roof,.008,w*.13):
      pavilionRoof(w*1.18,d*1.23,roof,w*.17,.008,end?0:.42);
    addPart(group,first,tile,x,0,z);
    if(!end&&!court){
      box(dark,0,roof+w*.16,0,w*.43,w*.10,d*.43);
      for(let i=-2;i<=2;i++)box(wood,i*w*.07,roof+w*.16,d*.219,.002,w*.08,.0022);
      const upper=polygon?polygonRoof(sides,w*.72,roof+w*.20,.005,w*.15):
        pavilionRoof(w*.75,d*.78,roof+w*.20,w*.16,.006,.31);
      addPart(group,upper,tile,x,0,z);
      if(polygon)addPart(group,new T.SphereGeometry(w*.025,9,6),stone,0,roof+w*.359,0);
    }
  }
  eaves();
  if(end){
    box(stone,0,.008,0,w*.36,.005,d*.30);
    box(stone,0,.02,0,w*.16,.024,.005);
    box(dark,0,.034,0,w*.20,.004,.007);
    for(let i=0;i<4;i++)box(dark,0,.013+i*.005,.0027,.006,.0006,.0006);
  }
  if(court){
    for(const x of [-w*.32,w*.32]){
      box(plaster,x,below+.016,-d*.48,w*.28,.032,d*.54);
      addPart(group,pavilionRoof(w*.34,d*.67,.039,.013,.004,.39),tile,x,0,-d*.48);
    }
    box(plaster,0,.020,-d*.69,w*.78,.033,.005);
  }
  if(polygon){
    box(dark,0,roof-.009,d*.37,w*.34,.007,.003);
    for(let i=-1;i<=1;i++)box(wood,i*w*.07,roof-.009,d*.392,.005,.0019,.0018);
  }
  if(lamp)for(const x of [-w*.22,w*.22])
    addPart(group,new T.SphereGeometry(.0024,8,6),lamp,x,roof-.013,d*.365);
  return group;
}
