import * as T from '../assets/three.module.js';

// Based on the paired stone lanterns in the supplied Pinghu Qiuyue photograph.
// Architectural proportions are illustrative; this is not a surveyed asset.
export function createStoneLanternPair() {
  const group = new T.Group();
  group.name = '平湖秋月 · 石灯近景';
  const stone = new T.MeshStandardMaterial({color:0xb6b8ae,roughness:.92});
  const tiles = new T.MeshStandardMaterial({color:0x4b5753,roughness:.82});
  function add(geometry,material,x,y,z) {
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  for(const x of [-2.5,2.5]) {
    add(new T.CylinderGeometry(.45,.55,.55,8),stone,x,.275,0);
    add(new T.CylinderGeometry(.90,.95,.22,8),stone,x,.65,0);
    for(const dx of [-.46,.46])for(const dz of [-.46,.46])
      add(new T.BoxGeometry(.18,1.2,.18),stone,x+dx,1.35,dz);
    // Open window apertures are real gaps, rather than painted rectangles.
    add(new T.BoxGeometry(1.12,.14,1.12),stone,x,1.98,0);
    add(new T.ConeGeometry(1.22,.48,8),tiles,x,2.29,0);
    add(new T.SphereGeometry(.15,8,6),stone,x,2.65,0);
    for(let k=0;k<16;k++) {
      const a=k*Math.PI/8;
      const rib=add(new T.CylinderGeometry(.025,.035,.78,5),stone,x+Math.sin(a)*.66,2.29,Math.cos(a)*.66);
      rib.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.sin(a),-.5,Math.cos(a)).normalize());
    }
  }
  group.scale.setScalar(.01);
  return group;
}

// Photo-informed silhouette, not a surveyed reconstruction. Dimensions in metres
// until the final scale conversion to the geographic scene (100 m / unit).
export function createLeifengTower() {
  const root = new T.Group();
  root.name = '雷峰塔 · 照片参考程序模型';
  const stone = new T.MeshStandardMaterial({color:0xe8dfc9, roughness:.85});
  const wood = new T.MeshStandardMaterial({color:0x8f3023, roughness:.8});
  const roof = new T.MeshStandardMaterial({color:0x263632, roughness:.7, side:T.DoubleSide});
  const glass = new T.MeshStandardMaterial({color:0x90a9a4, roughness:.3, transparent:true, opacity:.42, depthWrite:false});
  const warm = new T.MeshStandardMaterial({color:0xd7a665, emissive:0xffa347, emissiveIntensity:0});
  function mesh(geometry, material, x, y, z) {
    const obj = new T.Mesh(geometry,material);
    obj.position.set(x,y,z); obj.castShadow=true; obj.receiveShadow=true;
    root.add(obj); return obj;
  }
  function beam(a,b,r,material) {
    const va=new T.Vector3(...a), vb=new T.Vector3(...b), d=vb.clone().sub(va);
    const obj=mesh(new T.CylinderGeometry(r,r,d.length(),6),material,...va.clone().add(vb).multiplyScalar(.5).toArray());
    obj.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());
  }
  function eaves(radius,y) {
    const vertices=[], indices=[];
    // Upturned outer rim, dipped middle, raised inner roof.
    for(const [r,h] of [[radius,.7],[radius*.84,0],[radius*.57,2.5]]) {
      for(let i=0;i<8;i++){const a=i*Math.PI/4;vertices.push(Math.sin(a)*r,y+h,Math.cos(a)*r);}
    }
    for(let ring=0;ring<2;ring++)for(let i=0;i<8;i++){
      const a=ring*8+i,b=ring*8+(i+1)%8,c=a+8,d=b+8;
      indices.push(a,b,c,b,d,c);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
    mesh(g,roof,0,0,0);
  }
  mesh(new T.CylinderGeometry(17,18,2,8),stone,0,1,0);
  mesh(new T.CylinderGeometry(13,16,7,8),glass,0,5.5,0);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    beam([16*Math.sin(a),2,16*Math.cos(a)],[13*Math.sin(a),9,13*Math.cos(a)],.32,stone);
  }
  for(let level=0;level<5;level++){
    const y=9+level*9.3,r=15-level*1.15;
    mesh(new T.CylinderGeometry(r*.68,r*.7,6.8,8),stone,0,y+3.4,0);
    mesh(new T.CylinderGeometry(r*.91,r*.91,.55,8),stone,0,y,0);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
      const p=[Math.sin(a)*r*.83,Math.cos(a)*r*.83],q=[Math.sin(b)*r*.83,Math.cos(b)*r*.83];
      beam([p[0],y,p[1]],[p[0],y+6.7,p[1]],.25,wood);
      for(const h of [.45,1.35])beam([p[0],y+h,p[1]],[q[0],y+h,q[1]],.12,stone);
      for(let k=0;k<=4;k++){const t=k/4,x=p[0]+(q[0]-p[0])*t,z=p[1]+(q[1]-p[1])*t;beam([x,y,z],[x,y+1.5,z],.1,stone);}
      beam([p[0],y+6.3,p[1]],[q[0],y+6.3,q[1]],.12,warm);
    }
    eaves(r,y+6.7);
  }
  mesh(new T.CylinderGeometry(.15,1.1,9,8),warm,0,62,0);
  for(let i=0;i<6;i++)mesh(new T.CylinderGeometry(1.1-i*.13,1.1-i*.13,.24,8),warm,0,59+i,0);
  const bounds=new T.Box3().setFromObject(root);
  root.scale.setScalar(.71679/(bounds.max.y-bounds.min.y));
  root.userData.reference='Local photo manifest: 07_雷峰塔/01_2009_杭州_雷峰塔_-_panoramio.jpg';
  root.userData.updateNight=night=>{warm.emissiveIntensity=Math.max(0,Math.min(1,night))*.8;};
  return root;
}

import {pavilionRoof} from './scenic-craft.js';

export function createBaidiPavilion(site){
  const {w,d,style}=site,model=new T.Group();
  const color=tint=>new T.MeshStandardMaterial({color:tint,roughness:.86});
  const stone=color(0xb6b3a4),plaster=color(0xede3ce),wood=color(0x813e33),dark=color(0x49342b),tile=color(0x404844);
  tile.side=T.DoubleSide;
  const lamp=new T.MeshStandardMaterial({name:'Emissive_WarmLamp',color:0xcfa774,emissive:0xffb859,emissiveIntensity:.06});
  const put=(g,m,x,y,z,rotation=0)=>{
    g.clearGroups();
    const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.rotation.y=rotation;model.add(mesh);return mesh;
  };
  const box=(a,h,b,x,y,z,m)=>put(new T.BoxGeometry(a,h,b),m,x,y,z);
  const library=style==='library',oct=style==='octagon',stele=style==='stele';
  const floor=.006,post=library?.039:.036,base=floor+post+.004;
  box(w*1.03,.006,d*1.04,0,.003,0,stone).userData.walkable=true;
  for(let k=0;k<3;k++)box(w*.46,.0018,.016-k*.003,0,.001+k*.0018,d*.54,stone).userData.walkable=true;
  const count=library?4:3;
  if(oct){
    for(let k=0;k<8;k++){
      const angle=(k+.5)*Math.PI/4;
      const x=Math.sin(angle)*w*.43,z=Math.cos(angle)*d*.43;
      put(new T.CylinderGeometry(.0021,.0028,post,10),wood,x,floor+post*.5,z);
    }
    const rim=new T.CylinderGeometry(w*.535,w*.535,.0037,8);
    put(rim,dark,0,base,0,Math.PI/8);
    const roof=put(new T.ConeGeometry(w*.69,.026,8),tile,0,base+.010,0,Math.PI/8);
    roof.scale.z=d/w;
    put(new T.SphereGeometry(.003,8,6),stone,0,base+.025,0);
  }else{
    for(const z of [-d*.35,d*.35])for(let j=0;j<count;j++){
      const x=(j/(count-1)-.5)*w*.83;
      put(new T.CylinderGeometry(.0026,.0031,post,10),wood,x,floor+post*.5,z);
      box(.009,.003,.009,x,floor+.0015,z,stone);
      box(.006,.004,.006,x,base-.005,z,dark);
    }
    for(const z of [-d*.35,d*.35])box(w*.90,.005,.005,0,base-.003,z,wood);
    for(const x of [-w*.415,w*.415])box(.005,.005,d*.75,x,base-.003,0,wood);
    put(pavilionRoof(w*1.17,d*1.23,base,library?.020:.017,.007,stele?0:.39),tile,0,0,0);
    box(w*(stele?.11:.38),.003,.005,0,base+(library?.020:.017),0,dark);
  }
  if(library||style==='hall'){
    box(w*.78,post*.82,.004,0,floor+post*.42,-d*.31,plaster);
    for(const x of [-w*.39,w*.39]){
      box(.004,post*.34,d*.68,x,floor+post*.18,0,plaster);
      for(let j=-4;j<=4;j++)box(.0018,post*.45,.0016,x,floor+post*.64,j*d*.073,dark);
      box(.0028,.0022,d*.65,x,floor+post*.62,0,wood);
    }
  }
  if(library){
    const upper=base+.008;
    box(w*.60,.022,d*.55,0,upper+.011,0,plaster);
    for(let j=-2;j<=2;j++){
      const x=j*w*.108;
      box(.009,.013,.002,x,upper+.013,d*.28,dark);
      for(const a of [-1,1])box(.0014,.014,.0025,x+a*.003,upper+.013,d*.282,wood);
      box(.010,.0015,.0025,x,upper+.012,d*.283,wood);
    }
    put(pavilionRoof(w*.82,d*.89,upper+.026,.020,.006),tile,0,0,0);
    box(w*.30,.0028,.005,0,upper+.048,0,stone);
    for(const x of [-w*.29,w*.29])
      put(new T.CylinderGeometry(.0025,.0025,.0048,8),lamp,x,base-.009,d*.34);
  }
  if(stele){
    box(.029,.006,.019,0,.009,0,stone);
    box(.015,.026,.004,0,.024,0,stone);
    box(.013,.0012,.005,0,.037,0,dark);
    for(let i=0;i<5;i++)box(.005,.0004,.0006,0,.018+i*.003,.0023,dark);
  }
  return model;
}
