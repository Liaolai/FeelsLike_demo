import * as T from './assets/three.module.js';
import {GLTFLoader} from './assets/GLTFLoader.js';
import {MeshoptDecoder} from './assets/meshopt_decoder.module.js';
import {AVATAR_ASSETS} from './avatar-assets.js';

// Remove horizontal root travel from walking/running clips. OSM movement owns
// the world position, so an animation must not walk away from its road anchor.
export function inPlaceClip(clip,reference,up){
 const copy=clip.clone();if(!['walk','run'].includes(copy.name))return copy;
 for(const track of copy.tracks){if(!/^Hip\.position$/.test(track.name))continue;const values=track.values,first=new T.Vector3().fromArray(values),last=new T.Vector3().fromArray(values,values.length-3),drift=last.sub(first),offset=first.clone().sub(reference);drift.addScaledVector(up,-drift.dot(up));offset.addScaledVector(up,-offset.dot(up));
  const start=track.times[0],duration=track.times.at(-1)-start||1;for(let i=0;i<track.times.length;i++){const f=(track.times[i]-start)/duration;for(let k=0;k<3;k++)values[i*3+k]-=offset.getComponent(k)+drift.getComponent(k)*f;}
 }return copy;
}
export async function loadRiggedAvatar(id,unit=40){
 const asset=AVATAR_ASSETS[id]||AVATAR_ASSETS.plain,loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),gltf=await loader.loadAsync(asset.file+'?v='+asset.hash.slice(0,12));
 return prepareRiggedAvatar(gltf,asset,unit,id);
}
export function prepareRiggedAvatar(gltf,asset,unit=40,id='plain'){
 const model=new T.Group(),orientation=new T.Group(),root=gltf.scene;model.name='controlled-avatar';orientation.rotation.y=asset.frontRotation;orientation.add(root);model.add(orientation);root.updateMatrixWorld(true);model.updateMatrixWorld(true);
 const hip=root.getObjectByName('Hip'),reference=hip?.position.clone()||new T.Vector3(),parentQ=new T.Quaternion();hip?.parent?.getWorldQuaternion(parentQ);const up=new T.Vector3(0,1,0).applyQuaternion(parentQ.invert()).normalize();
 const clips=gltf.animations.map(c=>inPlaceClip(c,reference,up));root.animations=clips;const mixer=new T.AnimationMixer(root),actions=new Map(clips.map(c=>[c.name,mixer.clipAction(c)]));
 let current=actions.get('idle');current?.play();mixer.update(0);model.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox();o.frustumCulled=false;}});
 const box=new T.Box3().setFromObject(model,true),height=box.max.y-box.min.y;if(!Number.isFinite(height)||height<.01)throw Error('Invalid model dimensions');orientation.position.set(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);model.scale.setScalar(1.7/height/unit);
 model.userData={avatarId:id,source:'glb',heightM:1.7,limbs:[],clips:clips.map(c=>c.name),mixer};
 model.userData.animate=(dt,moving,activity,reduced)=>{if(reduced)return;const next=actions.get(moving?(activity==='run'?'run':'walk'):'idle');if(next&&next!==current){current?.fadeOut(.14);next.reset().fadeIn(.14).play();current=next;}mixer.update(dt);};
 model.userData.dispose=()=>{mixer.stopAllAction();mixer.uncacheRoot(root);};return model;
}
