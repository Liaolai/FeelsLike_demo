import * as T from './assets/three.module.js';
// Static index of the actual rendered walking decks, in our scene units.
export function createWalkSurface(meshes,cellSize=.25,{topsOnly=false}={}){
 const cells=new Map(),triangles=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 const matrix=new T.Matrix4(),instance=new T.Matrix4();
 for(const mesh of meshes){mesh.updateWorldMatrix(true,false);const g=mesh.geometry,p=g.attributes.position,idx=g.index,n=idx?idx.count:p.count;
 for(let j=0;j<(mesh.isInstancedMesh?mesh.count:1);j++){if(mesh.isInstancedMesh){mesh.getMatrixAt(j,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance);}else matrix.copy(mesh.matrixWorld);
 for(let i=0;i<n;i+=3){a.fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(matrix);b.fromBufferAttribute(p,idx?idx.getX(i+1):i+1).applyMatrix4(matrix);c.fromBufferAttribute(p,idx?idx.getX(i+2):i+2).applyMatrix4(matrix);const area=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(area)<1e-12||topsOnly&&area>0)continue;const id=triangles.length;triangles.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
 for(let x=Math.floor(Math.min(a.x,b.x,c.x)/cellSize);x<=Math.floor(Math.max(a.x,b.x,c.x)/cellSize);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/cellSize);z<=Math.floor(Math.max(a.z,b.z,c.z)/cellSize);z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(id);}}
 }}
 const values=new Float32Array(triangles);triangles.length=0;
 function height(x,z,referenceY,maxRise){let top=null,reachable=null,bestDistance=Infinity;for(const id of cells.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))||[]){const ax=values[id],ay=values[id+1],az=values[id+2],bx=values[id+3],by=values[id+4],bz=values[id+5],cx=values[id+6],cy=values[id+7],cz=values[id+8],den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-12)continue;const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den;const tolerance=Math.max(1e-5,.000125*Math.max(Math.hypot(bx-ax,bz-az),Math.hypot(cx-bx,cz-bz),Math.hypot(ax-cx,az-cz))/Math.abs(den));if(u< -tolerance||v< -tolerance||u+v>1+tolerance)continue;const y=u*ay+v*by+(1-u-v)*cy;if(Number.isFinite(maxRise)&&y<=referenceY+maxRise&&(reachable==null||y>reachable))reachable=y;if(Number.isFinite(referenceY)){const distance=Math.abs(y-referenceY);if(distance<bestDistance){bestDistance=distance;top=y;}}else if(top==null||y>top)top=y;}return reachable??top;}
 function segment(a,b,spacing=.005){const length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(length/spacing));let previous=null;for(let i=0;i<=steps;i++){const y=height(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps);if(y==null)return false;if(previous!=null&&Math.abs(y-previous)>Math.max(.24/40,length/steps*1.2))return false;previous=y;}return true;}
 return {height,segment,triangles:values.length/9};
}
