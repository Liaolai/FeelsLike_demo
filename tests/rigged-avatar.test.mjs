import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../public/assets/three.module.js';
import {GLTFLoader} from '../public/assets/GLTFLoader.js';
import {MeshoptDecoder} from '../public/assets/meshopt_decoder.module.js';
import {prepareRiggedAvatar} from '../public/rigged-avatar.js';
import {AVATAR_ASSETS} from '../public/avatar-assets.js';
import {disposeAvatar} from '../public/avatar.js';
// Node has no image decoder. Keep real mesh, skin and animation bytes, while
// omitting material texture references for this geometry/animation validation.
function geometryOnlyGLB(bytes){const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=data.getUint32(12,true),json=JSON.parse(bytes.subarray(20,20+length).toString());for(const m of json.materials||[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}const text=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);const bin=bytes.subarray(20+length),result=Buffer.alloc(20+padded.length+bin.length);result.writeUInt32LE(0x46546c67);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(padded.length,12);result.writeUInt32LE(0x4e4f534a,16);padded.copy(result,20);bin.copy(result,20+padded.length);return result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength);}
test('all nine actual GLB files load with 41-bone skins and six retained clips, at a 1.7m normalized height',async()=>{
 let signature;for(const [id,asset]of Object.entries(AVATAR_ASSETS)){
  const bytes=await readFile(new URL('../public'+asset.file,import.meta.url)),gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(geometryOnlyGLB(bytes),'');
  assert.deepEqual(gltf.animations.map(c=>c.name).sort(),['defeat_03','idle','jump','run','turn','walk']);let skin;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skin=o;});assert.ok(skin,id);assert.equal(skin.skeleton.bones.length,41,id);
  const current=skin.skeleton.bones.map(b=>[b.name,b.parent?.isBone?b.parent.name:null]);if(signature)assert.deepEqual(current,signature);else signature=current;
  const model=prepareRiggedAvatar(gltf,asset,1,id),box=new T.Box3().setFromObject(model,true);assert.ok(Math.abs(box.max.y-box.min.y-1.7)<1e-5,id);assert.ok(Math.abs(box.min.y)<1e-5,id);assert.equal(model.userData.source,'glb');assert.equal(model.userData.clips.length,6);
  model.userData.animate(.1,true,'walk',false);model.userData.animate(.1,false,'walk',false);disposeAvatar(model);
 }
});
test('actual walking and running tracks have no accumulating horizontal root displacement',async()=>{
 const asset=AVATAR_ASSETS.waves,bytes=await readFile(new URL('../public'+asset.file,import.meta.url)),gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(geometryOnlyGLB(bytes),'');
 const model=prepareRiggedAvatar(gltf,asset,1,'waves'),root=model.children[0].children[0],hip=root.getObjectByName('Hip'),q=new T.Quaternion();hip.parent.getWorldQuaternion(q);const up=new T.Vector3(0,1,0).applyQuaternion(q.invert());
 for(const name of ['walk','run']){const action=model.userData.mixer.existingAction(name);const track=action.getClip().tracks.find(t=>t.name==='Hip.position');assert.ok(track);const values=track.values,drift=new T.Vector3().fromArray(values,values.length-3).sub(new T.Vector3().fromArray(values));drift.addScaledVector(up,-drift.dot(up));assert.ok(drift.length()<1e-5,name);}
 disposeAvatar(model);
});
