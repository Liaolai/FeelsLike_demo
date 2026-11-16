import {createWalkSurface} from './walk-surface.js';
import * as T from './assets/three.module.js';
// Pave existing OSM graph joins; never create new graph connections or water crossings.
export function addRoadSeams(root,landscape,paths,network,deck){
 const vertices=[],world=(x,z)=>root.localToWorld(new T.Vector3(x,0,z));
 const sample=(x,z,fallback)=>{const p=world(x,z),y=deck.height(p.x,p.z);return y==null?landscape.wet(x,z)?fallback:landscape.terrainSurfaceY(x,z)+.0003:y/2.5+.00002;};
 for(const path of paths)for(const end of [0,path.length-1]){const a=path[end],b=path[end===0?1:path.length-2];if(!a||!b)continue;const q=world(a[0],a[1]);let base=deck.height(q.x,q.z);if(base==null){const length=Math.hypot(b[0]-a[0],b[1]-a[1]),t=Math.min(1,.006/(length||1)),near=world(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);base=deck.height(near.x,near.z);}if(base==null&&landscape.wet(...a))continue;base=base==null?landscape.terrainSurfaceY(...a)+.0003:base/2.5;const center=[a[0],base+.00002,a[1]];for(let k=0;k<16;k++){const b=(k+1)*Math.PI/8,c=k*Math.PI/8,point=t=>{const x=a[0]+Math.cos(t)*.005,z=a[1]+Math.sin(t)*.005;return [x,sample(x,z,base),z];};vertices.push(...center,...point(b),...point(c));}}
 // Fill only dry, in-scene gaps along already mapped graph edges.
 const water=createWalkSurface(landscape.waterMeshes,5);let dryPatches=0;
 for(const edge of network.edges){if(edge.inactive)continue;const {a,b}=edge,dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(length/.01));if(!length)continue;const nx=-dz/length*.009,nz=dx/length*.009;
  for(let i=0;i<n;i++){const t=(i+.5)/n,x=a.x+dx*t,z=a.z+dz*t;if(x< -28.49||x>28.49||z< -27.49||z>27.49||landscape.wet(x,z))continue;const center=world(x,z);if(deck.height(center.x,center.z)!=null||water.height(center.x,center.z)!=null)continue;
   const point=(u,s)=>{const X=a.x+dx*u+nx*s,Z=a.z+dz*u+nz*s;return [X,landscape.terrainSurfaceY(X,Z)+.0003,Z];},A=point(i/n,1),B=point(i/n,-1),C=point((i+1)/n,1),D=point((i+1)/n,-1);vertices.push(...A,...C,...B,...B,...C,...D);dryPatches++;}
 }
 let seams=0;for(const edge of network.edges){if(edge.inactive||!edge.stitch)continue;const {a,b}=edge,dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(len/.01));if(!len)continue;
  if(Array.from({length:n+1},(_,i)=>i/n).some(t=>{const x=a.x+dx*t,z=a.z+dz*t,p=world(x,z);return landscape.wet(x,z)&&deck.height(p.x,p.z)==null;}))continue;
  const nx=-dz/len*.009,nz=dx/len*.009;for(let i=0;i<n;i++){const make=(t,side)=>{const x=a.x+dx*t+nx*side,z=a.z+dz*t+nz*side;return [x,sample(x,z,landscape.tourHeight(x,z)),z];},A=make(i/n,1),B=make(i/n,-1),C=make((i+1)/n,1),D=make((i+1)/n,-1);vertices.push(...A,...C,...B,...B,...C,...D);}seams++;
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();const mesh=new T.Mesh(g,new T.MeshStandardMaterial({color:'#d7ccb4',roughness:.95,side:T.DoubleSide}));mesh.name='OSM endpoint and existing-join paving';mesh.receiveShadow=true;mesh.userData.navigationCollision=false;root.add(mesh);landscape.roadMeshes.push(mesh);root.updateMatrixWorld(true);return {seams,dryPatches,triangles:vertices.length/9};
}
