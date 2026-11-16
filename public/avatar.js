import * as T from './assets/three.module.js';
import {AVATAR_ASSETS} from './avatar-assets.js';

// Parametric, articulated reconstructions of the nine supplied PNG turnarounds.
// Appearance is never used as a person's age, sex, health or comfort profile.
export const AVATARS=[
 {id:'plain',zh:'白膜小人',en:'Porcelain',hair:'none',hairColor:'#e2e0d8',shirt:'#e4e1d7',pants:'#e4e1d7',eyes:'#343333',shoes:'#d8d5cd',source:'白膜2.png'},
 {id:'braids',zh:'编发夹克',en:'Braided jacket',hair:'ponytail',hairColor:'#302b28',shirt:'#654332',pants:'#282b2b',eyes:'#333538',shoes:'#3d3531',source:'TapNow_1794732655284_图片生成_1.png'},
 {id:'moon',zh:'星月斗篷',en:'Moon cloak',hair:'short',hairColor:'#273547',shirt:'#34324e',pants:'#424450',eyes:'#e7c745',shoes:'#bdbbb0',robe:true,source:'TapNow_1794732780957_图片生成_1.png'},
 {id:'rainbow',zh:'彩虹毛衣',en:'Rainbow knit',hair:'curly',hairColor:'#e1ded1',shirt:'#c56288',pants:'#b7c1bf',eyes:'#8bb8c9',shoes:'#cccac0',stripes:true,source:'TapNow_1794733006452_图片生成_1.png'},
 {id:'midnight',zh:'黑衫工装',en:'Midnight',hair:'shag',hairColor:'#222b32',shirt:'#272c2c',pants:'#434440',eyes:'#bb5d88',shoes:'#b58a35',source:'TapNow_1794733097963_图片生成_1.png'},
 {id:'waves',zh:'长卷发',en:'Wavy hair',hair:'long',hairColor:'#654735',shirt:'#d6d1c4',pants:'#505653',eyes:'#447b4e',shoes:'#dadbd4',source:'TapNow_1794733318398_Image_1.png'},
 {id:'cap',zh:'鸭舌帽',en:'Flat cap',hair:'cap',hairColor:'#babbb5',shirt:'#4a5143',pants:'#3f443f',eyes:'#a88a64',shoes:'#48443d',source:'TapNow_1794733444815_图片生成_1.png'},
 {id:'silver',zh:'银发针织',en:'Silver knit',hair:'curly',hairColor:'#d0cfc3',shirt:'#a74d68',pants:'#d8d4c8',eyes:'#8eafbe',shoes:'#ccc9bf',source:'TapNow_1794733879879_图片生成_1.png'},
 {id:'outdoor',zh:'拼色户外',en:'Trail jacket',hair:'afro',hairColor:'#302b28',shirt:'#35594e',pants:'#484b44',eyes:'#c84048',shoes:'#333b38',blocks:true,source:'TapNow_1794734583243_图片生成_1.png'}
];
export function avatarSpec(id){return AVATARS.find(a=>a.id===id)||AVATARS.find(a=>a.id==='rainbow')||AVATARS[0];}
export function disposeAvatar(group){const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m);});group.traverse(o=>{o.userData?.dispose?.();if(o.isSkinnedMesh)o.skeleton.dispose();});const textures=new Set();for(const m of materials)for(const v of Object.values(m))if(v?.isTexture)textures.add(v);for(const t of textures)t.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}

export function createAvatar(id='plain',outfit='reference',unit=40){
 const a=avatarSpec(id),model=new T.Group(),limbs=[],mats={};model.name='controlled-avatar';
 const mat=(color)=>mats[color]||(mats[color]=new T.MeshStandardMaterial({color,roughness:.88}));
 const skin='#dedbd0',cloth=outfit==='light'?'#ded7b9':outfit==='insulated'?'#50645c':outfit==='rain'?'#6b8980':a.shirt,pants=outfit==='light'?'#b8b5a5':a.pants;
 const ellipsoid=(parent,x,y,z,rx,ry,rz,color)=>{const mesh=new T.Mesh(new T.SphereGeometry(1,14,10),mat(color));mesh.position.set(x,y,z);mesh.scale.set(rx,ry,rz);parent.add(mesh);return mesh;};
 function rod(parent,start,end,r,color){const A=new T.Vector3(...start),B=new T.Vector3(...end),d=B.clone().sub(A);const mesh=new T.Mesh(new T.CapsuleGeometry(r,Math.max(.001,d.length()-r*2),4,10),mat(color));mesh.position.copy(A).add(B).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());parent.add(mesh);return mesh;}
 ellipsoid(model,0,1.04,0,.205,.285,.135,cloth);ellipsoid(model,0,.79,0,.18,.13,.12,pants);rod(model,[0,1.23,0],[0,1.37,0],.06,skin);
 for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.09,.79,0);rod(leg,[0,-.04,0],[side*.012,-.64,0],.071,pants);ellipsoid(leg,side*.014,-.72,.045,.085,.068,.14,a.shoes);model.add(leg);limbs.push(leg);
 }
 for(const side of [-1,1]){
  const arm=new T.Group();arm.position.set(side*.19,1.22,0);const short=outfit==='light',length=short?.19:.36;rod(arm,[0,-.01,0],[side*.055,-length,0],short?.066:.075,cloth);if(short)rod(arm,[side*.055,-.19,0],[side*.07,-.39,0],.044,skin);ellipsoid(arm,side*.07,-.405,.005,.044,.07,.04,skin);model.add(arm);limbs.push(arm);
 }
 if(a.stripes&&outfit==='reference')for(let i=0;i<6;i++){const colors=['#be6585','#d6bc65','#80aaa0','#c36c8f','#d4b765','#8eaf9c'];const band=new T.Mesh(new T.CylinderGeometry(.20,.20,.065,18),mat(colors[i]));band.position.y=.88+i*.064;band.scale.z=.69;model.add(band);}
 if((a.robe&&outfit==='reference')||outfit==='insulated'){
  const coat=new T.Mesh(new T.CylinderGeometry(.19,outfit==='insulated'?.235:.29,.67,20),mat(cloth));coat.position.y=.86;coat.scale.z=.72;model.add(coat);
  if(a.robe&&outfit==='reference')for(let i=0;i<13;i++)ellipsoid(model,Math.sin(i*2.4)*.18,.57+(i%5)*.095,.12+Math.cos(i*2.4)*.05,.009,.009,.005,'#bfa36a');
 }
 if(a.blocks&&outfit==='reference')for(const [y,color] of [[.9,'#bdad86'],[1.045,'#ad653b']]){const b=new T.Mesh(new T.CylinderGeometry(.208,.208,.12,18),mat(color));b.position.y=y;b.scale.z=.70;model.add(b);}
 if(outfit==='layers'||outfit==='insulated'||outfit==='rain'){rod(model,[0,.83,.14],[0,1.2,.14],.008,'#d8c597');ellipsoid(model,0,1.16,-.10,.17,.08,.10,cloth);}
 if(a.id!=='plain')for(let i=0;i<4;i++)ellipsoid(model,0,1.17-i*.075,.137,.009,.009,.007,'#c4ae87');
 ellipsoid(model,0,1.49,0,.205,.215,.19,skin);
 for(const side of [-1,1]){
  const eye=new T.Mesh(new T.CylinderGeometry(.055,.055,.015,18),mat(a.eyes));eye.rotation.x=Math.PI/2;eye.position.set(side*.078,1.515,.18);model.add(eye);
  const ink=['plain','braids','midnight','outdoor'].includes(a.id)?'#dad6c9':'#303d38';
  rod(model,[side*.078-.016,1.499,.192],[side*.078+.016,1.531,.192],.004,ink);rod(model,[side*.078-.016,1.531,.192],[side*.078+.016,1.499,.192],.004,ink);
 }
 if(a.hair!=='none'){
  for(let i=0;i<(a.hair==='afro'?65:30);i++){
   const theta=i*2.39996,z=1-2*(i+.5)/(a.hair==='afro'?65:30),r=Math.sqrt(1-z*z),x=Math.cos(theta)*r,y=Math.sin(theta)*r;
   if(y<-.45||z>.25&&y<.35)continue;
   const puff=a.hair==='afro'?.105:a.hair==='curly'?.058:.052,rad=a.hair==='afro'?.24:.19;
   ellipsoid(model,x*rad,1.52+y*rad,z*rad,puff,puff*(a.hair==='short'?1.35:1),puff,a.hairColor);
  }
  if(['long','shag'].includes(a.hair))for(let i=0;i<15;i++){
   const angle=(i/14)*Math.PI*1.8+.1,points=[];for(let j=0;j<9;j++){const t=j/8;points.push(new T.Vector3(Math.sin(angle)*(.17+.02*Math.sin(t*12+i)),1.61-t*.62,Math.cos(angle)*.16-.07));}
   model.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),16,a.hair==='long'?.028:.035,6,false),mat(a.hairColor)));
  }
  if(a.hair==='ponytail')for(let i=0;i<7;i++)rod(model,[.01,1.58,-.16],[Math.sin(i*1.2)*.12,1.47+Math.cos(i)*.07,-.33],.027,a.hairColor);
  if(a.hair==='cap'){ellipsoid(model,0,1.68,-.005,.225,.085,.21,'#424846');ellipsoid(model,0,1.65,.17,.19,.019,.125,'#424846');}
 }
 const bounds=new T.Box3().setFromObject(model),height=bounds.max.y-bounds.min.y;for(const child of model.children)child.position.y-=bounds.min.y;model.scale.setScalar(1.7/height/unit);model.userData={avatarId:a.id,outfit,heightM:1.7,limbs,headHeight:1.49/height*1.7};return model;
}

let portraits;
export function avatarPortraits(){return Object.fromEntries(AVATARS.map(a=>[a.id,AVATAR_ASSETS[a.id].portrait]));}
