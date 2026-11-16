import * as T from './assets/three.module.js';
export function clearanceMeshKey(mesh){if(mesh.userData.clearanceKey)return mesh.userData.clearanceKey;mesh.updateWorldMatrix(true,false);const box=new T.Box3().setFromObject(mesh);return [mesh.name||mesh.parent?.name||'',mesh.geometry.attributes.position.count,...box.min.toArray().map(n=>n.toFixed(5)),...box.max.toArray().map(n=>n.toFixed(5))].join('|');}
// Subtract narrow, mapped walking clearances from the actual displayed mesh.
// Interpolate all vertex attributes so facades, UVs and shading remain intact.
export function applyMeshClearances(root,edits){
 const byKey=new Map(edits.filter(e=>e.instance==null).map(e=>[e.key,e.boxes])),stats={meshes:0,openings:0};if(!edits.length)return stats;root.updateWorldMatrix(true,true);
 const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});const clones=new Map(meshes.filter(m=>m.userData.clearanceBase).map(m=>[m.userData.clearanceKey,m]));
 for(const edit of edits.filter(e=>e.instance!=null)){const original=meshes.find(m=>m.isInstancedMesh&&clearanceMeshKey(m)===edit.key);if(!original)continue;original.userData.clearanceKey=edit.key;const cloneKey=edit.key+'@'+edit.instance;let clone=clones.get(cloneKey);
  if(!clone){const instance=new T.Matrix4(),world=new T.Matrix4();original.getMatrixAt(edit.instance,instance);world.multiplyMatrices(original.matrixWorld,instance);clone=new T.Mesh(original.geometry.clone(),original.material);clone.name=original.name+' · mapped entry';clone.castShadow=original.castShadow;clone.receiveShadow=original.receiveShadow;clone.matrixAutoUpdate=false;clone.matrix.multiplyMatrices(root.matrixWorld.clone().invert(),world);clone.userData.clearanceKey=cloneKey;clone.userData.clearanceBase={key:edit.key,instance:edit.instance};root.add(clone);clones.set(cloneKey,clone);const hidden=new T.Matrix4().makeScale(0,0,0);original.setMatrixAt(edit.instance,hidden);original.instanceMatrix.needsUpdate=true;}
  byKey.set(cloneKey,edit.boxes);
 }
 root.updateWorldMatrix(true,true);
 root.traverse(mesh=>{if(!mesh.isMesh||mesh.isInstancedMesh)return;const boxes=byKey.get(clearanceMeshKey(mesh));if(!boxes?.length)return;mesh.userData.clearanceKey=clearanceMeshKey(mesh);
  const source=mesh.geometry,index=source.index,names=Object.keys(source.attributes).filter(k=>!['skinIndex','skinWeight'].includes(k)),out=Object.fromEntries(names.map(k=>[k,[]])),matrix=mesh.matrixWorld,world=new T.Vector3();
  const vertex=i=>{const value={};for(const name of names){const a=source.attributes[name];value[name]=Array.from({length:a.itemSize},(_,k)=>a.array[i*a.itemSize+k]);}world.fromArray(value.position).applyMatrix4(matrix);value.world=world.toArray();return value;};
  const interpolate=(a,b,t)=>{const v={world:a.world.map((x,i)=>x+(b.world[i]-x)*t)};for(const name of names)v[name]=a[name].map((x,i)=>x+(b[name][i]-x)*t);return v;};
  const split=(poly,axis,bound,sign)=>{const inside=[],outside=[];if(!poly.length)return [inside,outside];let a=poly.at(-1),da=sign*(a.world[axis]-bound);for(const b of poly){const db=sign*(b.world[axis]-bound);if((da>=0)!==(db>=0)){const v=interpolate(a,b,da/(da-db));inside.push(v);outside.push(v);}if(db>=0)inside.push(b);else outside.push(b);a=b;da=db;}return [inside,outside];};
  const emit=poly=>{for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]])for(const name of names)out[name].push(...v[name]);};
  const count=index?index.count:source.attributes.position.count;
  for(let i=0;i<count;i+=3){let fragments=[[vertex(index?index.getX(i):i),vertex(index?index.getX(i+1):i+1),vertex(index?index.getX(i+2):i+2)]];
   const originalPolygon=fragments[0],min=[0,1,2].map(a=>Math.min(...originalPolygon.map(v=>v.world[a]))),max=[0,1,2].map(a=>Math.max(...originalPolygon.map(v=>v.world[a])));const nearby=boxes.filter(b=>![0,1,2].some(a=>max[a]<b[a]||min[a]>b[a+3]));
   for(const box of nearby){const next=[];for(const polygon of fragments){if([0,1,2].some(axis=>Math.max(...polygon.map(v=>v.world[axis]))<box[axis]||Math.min(...polygon.map(v=>v.world[axis]))>box[axis+3])){next.push(polygon);continue;}let inside=polygon;for(const [axis,bound,sign]of [[0,box[0],1],[0,box[3],-1],[1,box[1],1],[1,box[4],-1],[2,box[2],1],[2,box[5],-1]]){const [keep,discard]=split(inside,axis,bound,sign);if(discard.length>=3)next.push(discard);inside=keep;if(!inside.length)break;}}fragments=next;if(!fragments.length)break;}
   for(const polygon of fragments)emit(polygon);
  }
  const geometry=new T.BufferGeometry();for(const name of names)geometry.setAttribute(name,new T.Float32BufferAttribute(out[name],source.attributes[name].itemSize));geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;stats.meshes++;stats.openings+=boxes.length;
 });return stats;
}
