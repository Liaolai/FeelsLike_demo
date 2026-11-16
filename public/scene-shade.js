import * as T from './assets/three.module.js';
import {solarPosition} from './solar.js';
import {calculateUTCI} from './partner/thermal.js';
// BVH of the exact visible static mesh/instance bounds. Ray intersections use
// their original triangles and world transforms, not a separate tree inventory.
export function createSceneShade(root){
 root.updateMatrixWorld(true);const items=[],matrix=new T.Matrix4(),m=new T.Matrix4();
 root.traverseVisible(o=>{if(!o.isMesh||!o.castShadow||!o.visible)return;const g=o.geometry;if(!g.attributes.position)return;g.computeBoundingBox();
  if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);matrix.multiplyMatrices(o.matrixWorld,m);if(Math.abs(matrix.determinant())<1e-15)continue;items.push({geometry:g,material:o.material,matrix:matrix.clone(),box:g.boundingBox.clone().applyMatrix4(matrix),name:o.name,index:i});}}
  else items.push({geometry:g,material:o.material,matrix:o.matrixWorld.clone(),box:g.boundingBox.clone().applyMatrix4(o.matrixWorld),name:o.name});
 });
 function build(a){if(!a.length)return null;const box=new T.Box3();for(const item of a)box.union(item.box);if(a.length<=12)return {box,items:a};const size=box.getSize(new T.Vector3()),axis=size.x>size.z?'x':'z';a.sort((x,y)=>(x.box.min[axis]+x.box.max[axis])-(y.box.min[axis]+y.box.max[axis]));const mid=a.length>>1;return {box,left:build(a.slice(0,mid)),right:build(a.slice(mid))};}
 const tree=build(items),ray=new T.Raycaster(),proxy=new T.Mesh(),direction=new T.Vector3(),origin=new T.Vector3(),scratch=new T.Vector3();
 function blocked(node){if(!node||!ray.ray.intersectBox(node.box,scratch))return false;
  if(node.items){for(const item of node.items){if(!ray.ray.intersectBox(item.box,scratch))continue;proxy.geometry=item.geometry;proxy.material=item.material;proxy.matrixWorld.copy(item.matrix);const hits=[];proxy.raycast(ray,hits);if(hits.length)return true;}return false;}
  return blocked(node.left)||blocked(node.right);
 }
 let previous=null;
 function sample(position,time=Date.now()){
  const sun=solarPosition(time),key=[...position].map(v=>Math.round(v*200)/200).join(',')+'|'+Math.floor(time/60000);
  if(previous?.key===key)return previous.value;
  let occluded=0;direction.fromArray(sun.direction);ray.near=.002;ray.far=Infinity;
  if(sun.daylight)for(const [dx,dz]of [[0,0],[-.006,0],[.006,0],[0,-.006],[0,.006]]){origin.fromArray(position);origin.x+=dx;origin.z+=dz;origin.y+=1.1/40;ray.set(origin,direction);if(blocked(tree))occluded++;}
  const value={shade:sun.daylight?occluded/5:0,sun,geometryCount:items.length,time};previous={key,value};return value;
 }
 return {sample,count:items.length};
}
// Radiation is selected for the chosen shadow time; preview never reuses a
// current-night zero as a daytime observation. Missing radiation stays labelled.
export function solarRadiation(weather,sun,{preview=false,time=Date.now()}={}){
 if(!sun?.daylight)return {total:0,source:'night',estimated:false};
 if(preview){const h=weather?.hourly;if(Array.isArray(h?.time)&&Array.isArray(h.shortwave_radiation)){let index=-1,gap=Infinity;for(let i=0;i<h.time.length;i++){const d=Math.abs(h.time[i]*1000-time);if(d<gap){gap=d;index=i;}}const value=h.shortwave_radiation[index];if(gap<=3600000&&Number.isFinite(value))return {total:Math.max(0,value),source:'selected-hour forecast radiation',estimated:false};}}
 else if(Number.isFinite(weather?.shortwave_radiation))return {total:Math.max(0,weather.shortwave_radiation),source:weather.radiationSource||'forecast radiation',estimated:false};
 const sin=Math.max(0,Math.sin(sun.elevation*Math.PI/180));
 const total=sin>0?1098*sin*Math.exp(-.059/sin):0;
 return {total,source:'Haurwitz clear-sky estimate',estimated:true};
}
export function localThermalEstimate(weather,shadeContext,{preview=false}={}){
 if(!weather||weather.stale||!shadeContext)return null;
 const air=weather.temperature_2m,rh=weather.relative_humidity_2m,wind=weather.wind_speed_10m;
 if(![air,rh,wind].every(Number.isFinite))return null;
 const daylight=shadeContext.sun.daylight,shade=Math.max(0,Math.min(1,shadeContext.shade)),input=solarRadiation(weather,shadeContext.sun,{preview,time:shadeContext.time});
 const diffuse=input.total*.25,direct=input.total*.75,radiation=diffuse+direct*(1-shade);
 const mrt=sw=>Math.pow(Math.pow(air+273.15,4)+.7*.25*sw/(.97*5.670374419e-8),.25)-273.15;
 const tmrt=mrt(radiation),sunTmrt=mrt(input.total),value=calculateUTCI(air,tmrt,wind,rh),sunValue=calculateUTCI(air,sunTmrt,wind,rh);
 if(!Number.isFinite(value)||!Number.isFinite(sunValue))return null;
 return {value,sunValue,shadeDelta:value-sunValue,shade,tmrt,sunTmrt,radiation,inputRadiation:input.total,radiationSource:input.source,radiationEstimated:input.estimated,time:shadeContext.time,daylight,method:'UTCI · model geometry shade',weather:{...weather,apparent_temperature:value}};
}
