import * as T from './assets/three.module.js';

// Positions and triangles are world-space scene units; body dimensions are metres.
// Returns true for blocked(), true for a CLEAR segment(). The cylinder is rounded
// at its ends: a vertical capsule, with a small sole clearance above the walk mesh.
export function createNavigationCollision(root,{radiusM=.22,heightM=1.7,unit=40,cellMeters=20}={}){
 if(!(unit>0&&radiusM>0&&heightM>2*radiusM&&cellMeters>0))throw Error('Invalid navigation capsule dimensions');
 const radius=radiusM/unit,height=heightM/unit,sole=.04/unit,cell=cellMeters/unit;
 const owners=[],ownerIds=[],positions=[],solid=[],cells=new Map(),counts={meshes:0,instances:0,triangles:0,building:0,trunk:0,railing:0,furniture:0,excluded:0};
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),edge=new T.Vector3(),matrix=new T.Matrix4(),instance=new T.Matrix4();
 function kind(mesh){
  if(mesh.userData.navigationCollision===false)return null;
  const name=mesh.name||'',material=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m?.name||'').join(' '),text=name+' '+material;
  if(/trunk|树干/i.test(name))return 'trunk';
  if(/树冠|花冠|牡丹叶|牡丹花|地被|柳丝|灌木|canop|crown|foliage|leaves|petals|pods|hibiscus|flowers|blossoms|lotus leaves|jade_pond|water|lake|ground|terrain|contact shadow|foundation|步道|路面|水面|花带|地表|基面|驳岸|岸线/i.test(text)&&mesh.userData.navigationCollision!==true)return null;
  if(!mesh.castShadow&&mesh.userData.navigationCollision!==true)return null;
  if(/railing|rails|扶手|栏|望柱|spandrel/i.test(name))return 'railing';
  if(/building|plaster|brick|glazing|masonry|tile|wall|石拱|塔|亭|楼|馆|斋|阁/i.test(text))return 'building';
  return 'furniture';
 }
 root.updateWorldMatrix(true,true);
 root.traverseVisible(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes?.position)return;let ancestor=mesh;while(ancestor){if(ancestor.userData.navigationCollision===false||ancestor.userData.navigationIgnore===true){counts.excluded++;return;}ancestor=ancestor.parent;}
  const category=kind(mesh);if(!category){counts.excluded++;return;}counts.meshes++;
  const g=mesh.geometry,p=g.attributes.position,index=g.index,n=index?index.count:p.count,instances=mesh.isInstancedMesh?mesh.count:1,isSolid=mesh.name==='Batched city buildings'&&!mesh.userData.openGroundPassages||mesh.userData.solidNavigation===true;
  for(let j=0;j<instances;j++){
   if(mesh.isInstancedMesh){mesh.getMatrixAt(j,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance);}else matrix.copy(mesh.matrixWorld);
   const ownerId=owners.length;owners.push({name:mesh.name||mesh.parent?.name||'(unnamed)',kind:category,index:j,object:mesh});counts.instances++;counts[category]++;
   for(let i=0;i<n;i+=3){
    a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(matrix);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(matrix);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(matrix);
    normal.subVectors(b,a).cross(edge.subVectors(c,a));if(normal.lengthSq()<1e-20)continue;
    const id=positions.length/9;positions.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);solid.push(isSolid?1:0);ownerIds.push(ownerId);
    const x0=Math.floor(Math.min(a.x,b.x,c.x)/cell),x1=Math.floor(Math.max(a.x,b.x,c.x)/cell),z0=Math.floor(Math.min(a.z,b.z,c.z)/cell),z1=Math.floor(Math.max(a.z,b.z,c.z)/cell);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(id);}
   }
  }
 });
 const triangleOwners=new Uint32Array(ownerIds);ownerIds.length=0;let lastHit=null;
 const triangles=new Float32Array(positions),solids=new Uint8Array(solid);counts.triangles=solids.length;positions.length=solid.length=0;
 // Bounds use the same packed Float32 coordinates as narrow-phase geometry.
 // Most triangles in a 20 m hash bucket are far outside a person's capsule;
 // reject them without loading three Vector3s or doing per-query min/max work.
 const bounds=new Float32Array(solids.length*6);
 for(let id=0;id<solids.length;id++){
  const k=id*9,j=id*6;
  for(let axis=0;axis<3;axis++){bounds[j+axis]=Math.min(triangles[k+axis],triangles[k+3+axis],triangles[k+6+axis]);bounds[j+3+axis]=Math.max(triangles[k+axis],triangles[k+3+axis],triangles[k+6+axis]);}
 }
 const A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3(),base=new T.Vector3(),top=new T.Vector3(),closest=new T.Vector3(),scratch=new T.Vector3(),ac=new T.Vector3(),planeNormal=new T.Vector3(),triangle=new T.Triangle(A,B,C);
 function load(id){const k=id*9;A.fromArray(triangles,k);B.fromArray(triangles,k+3);C.fromArray(triangles,k+6);}
 function segmentDistanceSq(p1,q1,p2,q2){
  const ux=q1.x-p1.x,uy=q1.y-p1.y,uz=q1.z-p1.z,vx=q2.x-p2.x,vy=q2.y-p2.y,vz=q2.z-p2.z,wx=p1.x-p2.x,wy=p1.y-p2.y,wz=p1.z-p2.z;
  const aa=ux*ux+uy*uy+uz*uz,bb=ux*vx+uy*vy+uz*vz,cc=vx*vx+vy*vy+vz*vz,dd=ux*wx+uy*wy+uz*wz,ee=vx*wx+vy*wy+vz*wz,den=aa*cc-bb*bb;
  let s=den>1e-20?Math.max(0,Math.min(1,(bb*ee-cc*dd)/den)):0,t=cc>1e-20?(bb*s+ee)/cc:0;
  if(t<0){t=0;s=aa>1e-20?Math.max(0,Math.min(1,-dd/aa)):0;}else if(t>1){t=1;s=aa>1e-20?Math.max(0,Math.min(1,(bb-dd)/aa)):0;}
  return (wx+s*ux-t*vx)**2+(wy+s*uy-t*vy)**2+(wz+s*uz-t*vz)**2;
 }
 function capsuleTouches(){
  triangle.closestPointToPoint(base,closest);if(closest.distanceToSquared(base)<=radius*radius)return true;
  triangle.closestPointToPoint(top,closest);if(closest.distanceToSquared(top)<=radius*radius)return true;
  planeNormal.subVectors(B,A).cross(ac.subVectors(C,A));const dy=planeNormal.y;
  if(Math.abs(dy)>1e-15){const y=A.y-(planeNormal.x*(base.x-A.x)+planeNormal.z*(base.z-A.z))/dy;if(y>=base.y&&y<=top.y){scratch.set(base.x,y,base.z);if(triangle.containsPoint(scratch))return true;}}
  return segmentDistanceSq(base,top,A,B)<=radius*radius||segmentDistanceSq(base,top,B,C)<=radius*radius||segmentDistanceSq(base,top,C,A)<=radius*radius;
 }
 function position(v){return Array.isArray(v)?v:{0:v.x,1:v.y,2:v.z};}
 const seen=new Set(),ray=new T.Ray(),rayOrigin=new T.Vector3(),rayDirection=new T.Vector3(1,0,0),hit=new T.Vector3();
 function insideClosedBuilding(x,y,z){
  // Closed city-building batches contain their roof triangles. An upward hit
  // inside their footprint detects a point embedded in a solid, even if its
  // walls are farther away than the capsule radius. Open pavilions do not opt in.
  rayOrigin.set(x,y,z);rayDirection.set(0,1,0);ray.set(rayOrigin,rayDirection);
  for(const id of cells.get(Math.floor(x/cell)+','+Math.floor(z/cell))||[]){
   if(!solids[id])continue;const j=id*6;
   if(bounds[j+4]<=y||bounds[j]>x||bounds[j+3]<x||bounds[j+2]>z||bounds[j+5]<z)continue;
   load(id);if(ray.intersectTriangle(A,B,C,false,hit)){lastHit=owners[triangleOwners[id]];return true;}
  }return false;
 }

 function blocked(v){lastHit=null;
  const p=position(v),x=p[0],y=p[1],z=p[2];if(![x,y,z].every(Number.isFinite))return true;
  base.set(x,y+sole+radius,z);top.set(x,y+height-radius,z);seen.clear();
  const minX=x-radius,maxX=x+radius,minY=base.y-radius,maxY=top.y+radius,minZ=z-radius,maxZ=z+radius;
  for(let ix=Math.floor((x-radius)/cell);ix<=Math.floor((x+radius)/cell);ix++)for(let iz=Math.floor((z-radius)/cell);iz<=Math.floor((z+radius)/cell);iz++)for(const id of cells.get(ix+','+iz)||[]){
   const j=id*6;
   if(bounds[j+4]<minY||bounds[j+1]>maxY||bounds[j+3]<minX||bounds[j]>maxX||bounds[j+5]<minZ||bounds[j+2]>maxZ)continue;
   if(seen.has(id))continue;seen.add(id);load(id);
   if(capsuleTouches()){lastHit=owners[triangleOwners[id]];return true;}
  }
  return insideClosedBuilding(x,y+height*.5,z);
 }
 function segment(start,end){const a=position(start),b=position(end);if(![a[0],a[1],a[2],b[0],b[1],b[2]].every(Number.isFinite))return false;const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/(radius*.8)));for(let i=0;i<=n;i++){const t=i/n;if(blocked([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]))return false;}return true;}

 return {blocked,segment,counts,radius,height,unit,inspect(v){return blocked(v)?lastHit:null;}};
}
