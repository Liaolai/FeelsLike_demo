export const causewayBridgeNames=['映波桥','锁澜桥','望山桥','压堤桥','东浦桥','跨虹桥'];
const suOrder=[4335991,975869980,30072125,30072127,30075392,30075393,30072130,30072131,30072139,30072138,30072144,30072145,30072147,30072148];
const yangOrder=[4324623,159190076,159190088,159190083,159190090,504564911,1366299790,4477338,832181800,832181799];
const id=f=>Number(f.properties.osm_id??f.id);
const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

export function mapCauseways(features,project,isWater){
 return [['苏堤',suOrder,.24,.068],['杨公堤',yangOrder,.26,.070]].flatMap(([name,ids,width,level])=>{
  const edges=[],bridges=[];
  let length=0,last;
  function add(a,b){
   const span=distance(a,b);
   if(span<1e-7)return;
   edges.push({a,b,start:length,span,dx:b[0]-a[0],dz:b[1]-a[1]});length+=span;
  }
  for(const osmId of ids){
   const f=features.find(x=>id(x)===osmId);
   if(!f)continue;
   const p=f.geometry.coordinates.map(project),prop=f.properties;
   if(last&&distance(last,p.at(-1))<distance(last,p[0]))p.reverse();
   if(last)add(last,p[0]);
   const start=length;
   for(let i=1;i<p.length;i++)add(p[i-1],p[i]);
   if(prop.bridge==='yes'&&length-start>.035)
     bridges.push({name:prop.name,s:(start+length)/2,half:(length-start)/2,top:level+.083,rise:.084});
   last=p.at(-1);
  }
  if(!edges.length)return [];
  const e0=edges[0].a,e1=edges.at(-1).b;
  const minX=Math.min(...edges.map(e=>Math.min(e.a[0],e.b[0])))-.60,maxX=Math.max(...edges.map(e=>Math.max(e.a[0],e.b[0])))+.60;
  const minZ=Math.min(...edges.map(e=>Math.min(e.a[1],e.b[1])))-.60,maxZ=Math.max(...edges.map(e=>Math.max(e.a[1],e.b[1])))+.60;
  function sample(s){
   const e=edges.find(v=>v.start+v.span>=s)||edges.at(-1);
   const t=clamp((s-e.start)/e.span,0,1);
   return {x:e.a[0]+e.dx*t,z:e.a[1]+e.dz*t};
  }
  function station(s){
   const a=sample(s-.065),b=sample(s+.065),p=sample(s);
   const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz)||1;
   return {...p,s,dx:dx/d,dz:dz/d,nx:dz/d,nz:-dx/d};
  }
  function sampleNear(x,z){
   if(x<minX||x>maxX||z<minZ||z>maxZ)return null;
   let best=Infinity,q=0;
   for(const e of edges){
    const t=clamp(((x-e.a[0])*e.dx+(z-e.a[1])*e.dz)/(e.span*e.span),0,1);
    const r=Math.hypot(x-e.a[0]-e.dx*t,z-e.a[1]-e.dz*t);
    if(r<best){best=r;q=e.start+t*e.span;}
   }
   return {s:q,distance:best};
  }
  const getBridge=s=>bridges.find(b=>Math.abs(s-b.s)<b.half);
  const surface=s=>{
   const b=getBridge(s);
   return b?level+(b.top-level)*Math.cos((s-b.s)/b.half*Math.PI*.5)**2:level;
  };
  const owns=f=>ids.includes(id(f));
  const needsWater=(s,q)=>{
   if(name==='苏堤')return true;
   if(getBridge(s))return true;
   return isWater(q.x+q.nx*.135,q.z+q.nz*.135)||isWater(q.x-q.nx*.135,q.z-q.nz*.135);
  };
  function underlying(x,z,above){
   const q=sampleNear(x,z);
   if(!q||q.distance>=.48||q.s<=0||q.s>=length)return above;
   const t=clamp((q.distance-.32)/.16,0,1);
   const end=clamp(Math.min(q.s,length-q.s)/.29,0,1);
   const bed=needsWater(q.s,station(q.s))?-.22:level-.019;
   return above+(bed-above)*(1-t*t*(3-2*t))*end;
  }
  return [{name,width,grassY:level-.002,level,length,station,bridges,getBridge,surface,sampleNear,owns,underlying,
   waterPatch:(a,b)=>needsWater((a.s+b.s)/2,a)}];
 });
}
import * as T from '../assets/three.module.js';
import {material,plantBatch,seededRandom} from './waterfront-kit.js';
import {instanceBoxes} from './baidi-embankment.js';
import {swayFoliage} from './weather-motion.js';

export function addCausewayGreenery(scene,models,landscape){
 const group=new T.Group();group.name='苏堤及杨公堤桃柳与家具';
 const tree=[],crowns=[],strands=[],bushes=[],benches=[],rng=seededRandom(392);
 const time={value:0},wind={value:new T.Vector3(1,0,.2)};
 for(const model of models)for(let i=0,s=.20;s<model.length-.18;i++,s+=.143){
  if(model.getBridge(s-.04)||model.getBridge(s+.04))continue;
  const q=model.station(s);
  for(const side of [-1,1]){
   const a=side*(model.width/2-.027),x=q.x+q.nx*a,z=q.z+q.nz*a,y=model.grassHeight?.(q.s)??model.grassY;
   if(landscape?.nearRoad(x,z,.008))continue;
   const willow=i%2===0,h=.077+rng()*.039;
   tree.push([x,y+h*.37,z,.0041,h*.74,.0041,0x67503c]);
   for(let k=0;k<4;k++){
    const theta=k*Math.PI*.5,tint=willow?0x749752:k%2?0xe499a7:0xeab2b6;
    crowns.push([x+Math.sin(theta)*h*.125,y+h*.77,z+Math.cos(theta)*h*.125,h*.30,h*.23,h*.30,tint,theta]);
    if(willow)strands.push([x+Math.sin(theta)*h*.34,y+h*.58,z+Math.cos(theta)*h*.34,h*.065,h*.19,h*.059,0x83a761,theta]);
   }
   if(i%3===0)bushes.push([x+q.dx*.04,y+.007,z+q.dz*.04,.015,.009,.014,0x54763f]);
   if(i%12===5){
    const yaw=Math.atan2(q.dx,q.dz);
    benches.push([x+q.dx*.047,y+.013,z+q.dz*.047,.016,.004,.043,yaw],
     [x+q.dx*.048,y+.006,z+q.dz*.048,.010,.012,.032,yaw]);
   }
  }
 }
 const bark=material(0xffffff),leaf=material(0xffffff),slender=material(0xffffff);
swayFoliage(slender,time,wind,true);
 const blob=new T.SphereGeometry(1,9,6);
 for(const [name,geom,mat,items] of [
  ['堤岸树干',new T.CylinderGeometry(.53,.73,1,7),bark,tree],['苏杨两堤桃柳',blob,leaf,crowns],
  ['堤岸垂柳枝条',blob,slender,strands],['堤岸地被',blob,material(0xffffff),bushes]
 ]){
  const mesh=plantBatch(group,name,geom,mat,items);mesh.castShadow=mesh.receiveShadow=true;
 }
 instanceBoxes(group,benches,0x72533a,'苏杨两堤长椅');
 let phase=0,previous=0;
 group.userData.updateWeather=(t,weather)=>{
  const dt=Math.max(0,Math.min(.10,t-previous));previous=t;
  phase+=dt*(1.3+2.2*weather.windLevel);
  time.value=phase;
  wind.value.set(weather.direction.x,weather.direction.y,weather.windLevel);
 };
 scene.add(group);
}
