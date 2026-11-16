import * as T from './assets/three.module.js';

export function createPierHouse(unit=40,label='游船码头'){
 const house=new T.Group();house.name='pier-house';
 const wood=new T.MeshStandardMaterial({color:'#70472e',roughness:.9}),stone=new T.MeshStandardMaterial({color:'#d7cbb1',roughness:.95}),roof=new T.MeshStandardMaterial({color:'#34433d',roughness:.8,side:T.DoubleSide}),dark=new T.MeshStandardMaterial({color:'#203b36',roughness:.7});
 const box=(x,y,z,w,h,d,mat)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);house.add(mesh);return mesh;};
 box(0,.2,0,11,.4,9,wood);for(const x of [-4.7,4.7])for(const z of [-3.7,3.7])box(x,-.65,z,.32,1.7,.32,wood);
 box(0,1.9,2.25,6.4,3,.18,stone);for(const x of [-3.2,3.2]){box(x,1.9,0,.18,3,4.5,stone);for(const z of [-2.3,2.3])box(x,2.2,z,.32,3.7,.32,wood);}
 for(const x of [-2.1,2.1]){box(x,1.85,-2.3,1.6,2.8,.18,stone);box(x,2,-2.42,1.1,1.4,.12,dark);for(const offset of [-.35,0,.35])box(x+offset,2,-2.51,.055,1.4,.06,wood);}
 box(0,.5,-1.9,2.2,.2,.9,wood);box(0,3.15,-2.48,4.6,.75,.22,wood);
 const vertices=[],corners=[[-1,-1],[1,-1],[1,1],[-1,1]],rings=[[4.45,3.5,4.05],[3.25,2.45,4.8],[2.5,.025,6.05]];
 for(let k=0;k<2;k++)for(let i=0;i<4;i++){const point=(j,r)=>[corners[j%4][0]*rings[r][0],rings[r][2]+(r===0?.45:0),corners[j%4][1]*rings[r][1]],a=point(i,k),b=point(i+1,k),c=point(i,k+1),d=point(i+1,k+1);vertices.push(...a,...c,...b,...b,...c,...d);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();house.add(new T.Mesh(geometry,roof));
 box(0,6.1,0,5.5,.15,.17,wood);
 // Railings leave the front landing open.
 for(const x of [-5,5]){box(x,1.1,0,.12,.15,8,wood);for(let z=-3.5;z<=3.5;z++)box(x,.75,z,.12,1,.12,wood);}
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#f8ead0';ctx.font='bold 58px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,256,48,490);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(4.3,.64),new T.MeshBasicMaterial({map:texture,transparent:true,side:T.DoubleSide}));sign.position.set(0,3.15,-2.61);sign.rotation.y=Math.PI;house.add(sign);
 }
 house.scale.setScalar(1/unit);house.userData={kind:'pier',label,heightM:6.2};return house;
}

// Octagonal, five-storey silhouette; dimensions in metres before scene scaling.
export function createLeifengPagoda(unit=40){
 const tower=new T.Group();tower.name='leifeng-pagoda';
 const materials={stone:new T.MeshStandardMaterial({color:'#b3b0a0',roughness:.95}),wall:new T.MeshStandardMaterial({color:'#8a593c',roughness:.85}),wood:new T.MeshStandardMaterial({color:'#513c2c',roughness:.82}),roof:new T.MeshStandardMaterial({color:'#343c36',roughness:.68,side:T.DoubleSide}),gold:new T.MeshStandardMaterial({color:'#bc9550',metalness:.5,roughness:.4}),window:new T.MeshStandardMaterial({color:'#203d3a',roughness:.55})};
 const add=(geometry,mat,x,y,z)=>{const m=new T.Mesh(geometry,materials[mat]);m.position.set(x,y,z);tower.add(m);return m;};
 function octagon(rt,rb,h,y,mat){const m=add(new T.CylinderGeometry(rt,rb,h,8),mat,0,y+h/2,0);m.rotation.y=Math.PI/8;return m;}
 function beam(a,b,r,mat){const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A),m=add(new T.CylinderGeometry(r,r,d.length(),5),mat,...A.clone().add(B).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());}
 const corner=(r,i,y)=>[Math.sin(i*Math.PI/4+Math.PI/8)*r,y,Math.cos(i*Math.PI/4+Math.PI/8)*r];
 function railing(r,y){for(let i=0;i<8;i++){const a=corner(r,i,y),b=corner(r,i+1,y);beam([a[0],y+1.1,a[2]],[b[0],y+1.1,b[2]],.12,'stone');for(let j=0;j<=5;j++){const t=j/5,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;beam([x,y,z],[x,y+1.1,z],.12,'stone');}}}
 function roof(r,y){
  const profile=[[.59,3.7],[.76,1.25],[.93,.22],[1,.30]],verts=[];
  const p=(side,u,k)=>{const [s,h]=profile[k],a=corner(r*s,side,0),b=corner(r*s,side+1,0),lift=k>=2?Math.pow(Math.abs(2*u-1),7)*.85:0;return [a[0]+(b[0]-a[0])*u,y+h+lift,a[2]+(b[2]-a[2])*u];};
  for(let side=0;side<8;side++)for(let k=0;k<profile.length-1;k++)for(let j=0;j<6;j++){const a=p(side,j/6,k),b=p(side,(j+1)/6,k),c=p(side,j/6,k+1),d=p(side,(j+1)/6,k+1);verts.push(...a,...c,...b,...b,...c,...d);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();add(g,'roof',0,0,0);
  octagon(r*.59,r*.59,.15,y+3.7,'roof');
  for(let side=0;side<8;side++)for(let j=0;j<6;j++)beam(p(side,j/6,3),p(side,(j+1)/6,3),.10,'gold');
 }
 octagon(29,30,1.2,0,'stone');octagon(27,29,1.8,1.2,'stone');octagon(24,27,5.5,3,'stone');octagon(25,25,.6,8.5,'stone');railing(24,9.1);
 for(let level=0;level<5;level++){
  const y=9.2+level*8.8,r=12.4-level*.9,eave=18.2-level*.95;
  octagon(r,r+.3,7.5,y,'wall');octagon(eave-1,eave-1,.65,y,'stone');railing(eave-1.5,y+.65);
  for(let side=0;side<8;side++){
   const a=corner(r,side,y),b=corner(r,side+1,y),x=(a[0]+b[0])/2,z=(a[2]+b[2])/2,angle=(side+.5)*Math.PI/4+Math.PI/8;
   const window=add(new T.BoxGeometry(r*.45,4.9,.22),'window',x,y+4,z);window.rotation.y=angle;
   for(const shift of [-.9,0,.9]){const dx=Math.cos(angle)*shift,dz=-Math.sin(angle)*shift;beam([x+dx,y+1.6,z+dz],[x+dx,y+6.5,z+dz],.12,'wood');}
   const column=corner(r+1.35,side,y+.65);beam(column,[column[0],y+7.7,column[2]],.28,'wood');
  }
  roof(eave,y+7.25);
 }
 octagon(2.3,3.4,2.05,55.35,'gold');
 for(let i=0;i<7;i++){const y=57.4+i*1.15,r=2.3-i*.22;octagon(r*.55,r, .65,y,'gold');}
 add(new T.ConeGeometry(.8,6.1,8),'gold',0,68.5,0);add(new T.SphereGeometry(.35,8,6),'gold',0,71.35,0);
 // Merge the repeated rails and columns by material to keep draw calls low.
 const batches=new Map();for(const m of [...tower.children]){m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);if(!batches.has(m.material))batches.set(m.material,{p:[],n:[]});const batch=batches.get(m.material);for(const v of g.attributes.position.array)batch.p.push(v);for(const v of g.attributes.normal.array)batch.n.push(v);g.dispose();m.geometry.dispose();tower.remove(m);}
 for(const [material,batch] of batches){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(batch.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(batch.n,3));tower.add(new T.Mesh(g,material));}
 tower.scale.setScalar(1/unit);tower.userData={heightM:71.7,storeys:5,sides:8};return tower;
}
