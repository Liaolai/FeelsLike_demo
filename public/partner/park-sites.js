import {latLonToScene} from './projection.js';

export const PARK_SITES={
  lotus:latLonToScene(30.2495,120.1302),
  hill:latLonToScene(30.2552,120.1392),
  willow:latLonToScene(30.2405,120.1538)
};

// Starting from the mapped bay, locate the actual transition between land
// and water. The given nominal point itself lies inside the bay.
function nearBay(wet){
 let best;
 const c=PARK_SITES.lotus;
 for(let i=0;i<96;i++){
  const a=i*Math.PI/48,dx=Math.sin(a),dz=Math.cos(a);
  for(let d=.025;d<=.92;d+=.015){
   const x=c.x+dx*d,z=c.z+dz*d;
   if(wet(x,z))continue;
   if(wet(x+dx*.05,z+dz*.05))break;
   if(best&&d>=best.distance)break;
   best={edge:{x,z},land:{x:dx,z:dz},distance:d};
   break;
  }
 }
 return best;
}

function findWillowShore(wet){
 const c=PARK_SITES.willow;
 const rows=[];
 for(let z=c.z-.67;z<=c.z+.781;z+=.05){
   for(let x=c.x-5.5;x<c.x+.35;x+=.017){
     if(wet(x,z)||!wet(x-.055,z)||!wet(x-.17,z))continue;
     const wx=x+.053;
     if(wet(wx,z)||wet(wx-.027,z)||wet(wx+.040,z))continue;
     rows.push([wx,z]);break;
   }
 }
 // A polygon inlet can produce jumpy x coordinates. Only keep continuous
 // segments; bridge across neither the water nor a missing shoreline sample.
 const runs=[];
 let run=[];
 for(const p of rows){
  if(run.length&&Math.hypot(p[0]-run.at(-1)[0],p[1]-run.at(-1)[1])>.17){runs.push(run);run=[];}
  run.push(p);
 }
 if(run.length)runs.push(run);
 runs.sort((a,b)=>b.length-a.length);
 const path=runs[0]||[];
 return path.map((p,i)=>i&&i<path.length-1?
  [(path[i-1][0]+2*p[0]+path[i+1][0])*.25,p[1]]:p).filter(p=>!wet(...p));
}

export function mapParkSites(wet){
 const bay=nearBay(wet),path=findWillowShore(wet);
 if(bay){
  const {edge,land}=bay;
  bay.hero={x:edge.x+land.x*.044,z:edge.z+land.z*.044};
  bay.bridge=[];
  for(let j=0;j<=9;j++){
   const d=-.060+j*.038,side=j===0?0:j%2===0?-.028:.028;
   const q=[edge.x-land.x*d+land.z*side,edge.z-land.z*d-land.x*side];
   bay.bridge.push(q);
  }
  // Return to the bank on a separate arm, leaving the lake centre open.
  for(const sign of [1,-1]){
   const side=sign*.148;
   const a=[edge.x-land.x*.272+land.z*side,edge.z-land.z*.272-land.x*side];
   const b=[edge.x-land.x*.135+land.z*side,edge.z-land.z*.135-land.x*side];
   for(let d=.072;d<.29;d+=.027){
    const c=[edge.x+land.x*d+land.z*side,edge.z+land.z*d-land.x*side];
    if(wet(...c))continue;bay.bridge.push(a,b,c);break;
   }
   if(bay.bridge.length>10)break;
  }
 }
 const willow={path};
 if(path.length){
  const middle=path[Math.floor(path.length*.52)];
  willow.hero={x:middle[0]+.103,z:middle[1]-.065};
  willow.entry={x:middle[0],z:middle[1]};
 }
 return {lotus:bay,willow,hill:PARK_SITES.hill};
}

export function placeParkPlans(plans,parks){
 const q=plans.get('曲院风荷');
 if(q&&parks.lotus?.hero){
  const {hero,bridge,land}=parks.lotus;
  const placement={...hero,asset:'quyuan',yaw:Math.atan2(-land.x,-land.z),onWater:false};
  q.placements=[placement];
  q.focus=placement;
  q.origin={x:bridge[0][0],z:bridge[0][1]};
  q.view=[.235,.195,.395];
 }
 const w=plans.get('柳浪闻莺');
 if(w&&parks.willow.hero){
  const placement={...parks.willow.hero,asset:'liulang',yaw:-1.05,onWater:false};
  w.placements=[placement];w.focus=placement;w.origin=parks.willow.entry;
  w.view=[.29,.137,.115];
 }
 const g=plans.get('孤山');
 if(g){
  const placement={...parks.hill,asset:'gushan',yaw:0,onWater:false};
  g.placements=[placement];g.focus=placement;g.origin=placement;
  g.view=[.55,.30,.84];
 }
}
