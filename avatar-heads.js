import * as T from './assets/three.module.js';
import {loadRiggedAvatar} from './rigged-avatar.js';
import {disposeAvatar} from './avatar.js';
const cache=new Map();let task;
export async function renderAvatarHeads(ids,onReady){
 for(const id of ids)if(cache.has(id))onReady(id,cache.get(id));
 if(task){await task;for(const id of ids)if(cache.has(id))onReady(id,cache.get(id));return;}
 task=(async()=>{let renderer;try{
 renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(192,192);renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;
 // Retain only the head and upper shoulders, directly from the real rigged asset.
 renderer.clippingPlanes=[new T.Plane(new T.Vector3(0,1,0),-1.28)];
 const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0x9aa99a,2.6));const light=new T.DirectionalLight(0xffffff,2.2);light.position.set(2,4,5);scene.add(light);
 const camera=new T.OrthographicCamera(-.39,.39,.39,-.39,.01,10);camera.position.set(0,1.48,3);camera.lookAt(0,1.48,0);
 for(const id of ids){if(cache.has(id))continue;let model;try{model=await loadRiggedAvatar(id,1);scene.add(model);renderer.render(scene,camera);const url=renderer.domElement.toDataURL('image/webp',.9);cache.set(id,url);onReady(id,url);}catch{}finally{if(model){scene.remove(model);disposeAvatar(model);}}}
 }finally{renderer?.dispose();renderer?.forceContextLoss();}})();try{await task;}finally{task=null;}
}
