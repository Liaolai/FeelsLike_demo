import {latLonToScene} from './projection.js';

const kits = [
  ['保俶塔','baochu',{lift:.03, radius:.12, view:[.72,.37,.48]}],
  ['三潭印月','santan',{water:true, view:[.74,.82,.51]}],
  ['北山街','beishan',{street:'北山街',north:true,radius:.35,view:[.43,.10,.42]}],
  ['断桥残雪','duanqiao',{street:'断桥',setback:.105,radius:.12,view:[.29,.21,.35]}],
  ['湖滨','hubin',{street:'湖滨路',setback:.16,radius:.15,view:[-.27,.12,.19]}],
  ['柳浪闻莺','liulang',{anchor:[30.2405,120.1538],setback:.14,radius:.14,view:[.23,.12,.25]}],
  ['雷峰塔','leifeng-crafted',{anchor:[30.2318,120.1485],radius:.20,view:[.72,.32,.79]}],
  ['花港观鱼','huagang',{setback:.16,radius:.16,view:[.22,.12,.29]}],
  ['苏堤春晓','sudi',{street:'苏堤',setback:.12,view:[.26,.12,.33]}],
  ['杨公堤','yanggong',{street:'杨公堤',setback:.15,view:[.28,.12,.36]}],
  ['曲院风荷','quyuan',{anchor:[30.2495,120.1302],setback:.14,radius:.16,view:[.18,.15,.32]}],
  ['孤山','gushan',{anchor:[30.2552,120.1392],setback:.14,radius:.17,view:[.21,.12,.27]}],
  ['平湖秋月','pinghu',{setback:.14,radius:.14,view:[.25,.11,.22]}],
  ['白堤','baidi',{street:'白堤',setback:.115,view:[.20,.12,.31]}]
];

export const SPOT_KITS = Object.fromEntries(kits.map(([name,asset,options])=>[name,{asset,...options}]));
export const SPOT_EXCLUSION_ZONES = Object.fromEntries(
  kits.filter(([, ,kit])=>kit.radius).map(([name,,kit])=>[name,kit.radius])
);
const LIMIT=.80, INTERVAL=.12;
const close=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-5;

function joinRoads(parts){
  const pending=parts.map(path=>path.slice());
  const chains=[];
  while(pending.length){
    const line=pending.pop();
    let changed=true;
    while(changed){
      changed=false;
      for(let i=0;i<pending.length;i++){
        const next=pending[i];
        if(close(line.at(-1),next[0]))line.push(...next.slice(1));
        else if(close(line.at(-1),next.at(-1)))line.push(...next.slice(0,-1).reverse());
        else if(close(line[0],next.at(-1)))line.unshift(...next.slice(0,-1));
        else if(close(line[0],next[0]))line.unshift(...next.slice(1).reverse());
        else continue;
        pending.splice(i,1);changed=true;break;
      }
    }
    chains.push(line);
  }
  return chains;
}

function locate(path,x,z){
  let s=0,best=null;
  for(let i=1;i<path.length;i++){
    const [ax,az]=path[i-1],[bx,bz]=path[i];
    const length=Math.hypot(bx-ax,bz-az);
    if(length<1e-7)continue;
    const dx=(bx-ax)/length,dz=(bz-az)/length;
    const t=Math.min(length,Math.max(0,(x-ax)*dx+(z-az)*dz));
    const distance=Math.hypot(x-ax-dx*t,z-az-dz*t);
    if(!best||distance<best.distance)best={distance,station:s+t};
    s+=length;
  }
  return best&&{...best,total:s,path};
}

function at(route,s){
  if(s<0||s>route.total)return null;
  for(let i=1;i<route.path.length;i++){
    const [ax,az]=route.path[i-1],[bx,bz]=route.path[i];
    const len=Math.hypot(bx-ax,bz-az);
    if(len<1e-7)continue;
    if(s>len&&i<route.path.length-1){s-=len;continue;}
    const dx=(bx-ax)/len,dz=(bz-az)/len;
    return {x:ax+dx*s,z:az+dz*s,dx,dz};
  }
  return null;
}

function facingRoad(x,z,center){
  return Math.atan2(center.x-x,center.z-z);
}

function usableSite(station,setback,wet,ground,north=false,allowWater=false){
  for(const sign of (north?[station.dx>0?-1:1]:[-1,1])){
    const x=station.x-station.dz*setback*sign,z=station.z+station.dx*setback*sign;
    const y=ground(x,z);
    if(!allowWater&&wet(x,z))continue;
    if(!allowWater&&[[.026,0],[-.026,0],[0,.027],[0,-.027]].some(([dx,dz])=>wet(x+dx,z+dz)))continue;
    if(!allowWater&&y<.044)continue;
    return {x,z,yaw:facingRoad(x,z,station),onWater:allowWater&&wet(x,z),station};
  }
  return null;
}

export function planScenicKits(spots,roads,wet,ground){
  const plans=new Map(),masks=[];
  if(!spots)return {plans,masks};
  const usable=roads.filter(row=>row.points.length>1);
  for(const [name,kit] of Object.entries(SPOT_KITS)){
    const spot=spots[name];
    if(!spot)continue;
    const [lat,lon]=kit.anchor||[spot.lat,spot.lon];
    const center=latLonToScene(lat,lon);
    const named=kit.street?usable.filter(row=>row.name===kit.street):[];
    const candidates=(named.length?joinRoads(named.map(row=>row.points)):usable.map(row=>row.points))
      .map(path=>locate(path,center.x,center.z)).filter(Boolean);
    candidates.sort((a,b)=>a.distance-b.distance);
    const route=candidates[0];
    const streetStation=route&&at(route,route.station);
    const origin=streetStation&&kit.street?streetStation:center;
    const placements=[];
    const rows=[];
    if(kit.water||kit.asset==='baochu'||kit.asset==='leifeng-crafted'){
      placements.push({...center,asset:kit.asset,yaw:kit.water?.32:0,onWater:kit.water===true});
    }else if(kit.north&&route){
      const assets=['beishan','beishan-qiushui','beishan-arcade','beishan-villa'];
      const start=Math.max(0,Math.min(route.total-.58,route.station-.29));
      for(let i=0;i<assets.length;i++){
        const station=at(route,start+i*.19);
        if(!station)continue;
        const site=usableSite(station,.129,wet,ground,true) || usableSite(station,.19,wet,ground,true);
        if(site)placements.push({...site,asset:assets[i]});
      }
    }else if(route){
      search:
      for(const test of candidates.slice(0,kit.street?8:100)){
        if(test.distance>route.distance+.35)break;
        for(const offset of [0,.06,-.06,.12,-.12,.22,-.22,.35,-.35,.51,-.51]){
          const station=at(test,test.station+offset);
          if(!station)continue;
          const site=usableSite(station,kit.setback||.12,wet,ground);
          if(site){placements.push({...site,asset:kit.asset});break search;}
        }
      }
      if(!placements.length&&streetStation){
        const nearby=usable.map(row=>locate(row.points,streetStation.x,streetStation.z))
          .filter(row=>row&&row.distance<.38).sort((a,b)=>a.distance-b.distance);
        for(const test of nearby.slice(0,40)){
          const station=at(test,test.station);
          const site=station&&usableSite(station,kit.setback||.12,wet,ground);
          if(site){placements.push({...site,asset:kit.asset});break;}
        }
      }
      if(!placements.length&&streetStation){
        const site=usableSite(streetStation,kit.setback||.12,wet,ground,false,true);
        if(site)placements.push({...site,asset:kit.asset});
      }
    }
    if(kit.street&&route){
      for(let offset=-.72;offset<=.721;offset+=INTERVAL){
        const station=at(route,route.station+offset);
        if(!station||Math.hypot(station.x-origin.x,station.z-origin.z)>LIMIT)continue;
        rows.push(station);
      }
    }
    if(kit.street&&rows.length<7&&streetStation){
      for(const candidate of candidates.slice(1,10)){
        if(candidate.distance>route.distance+.85)break;
        for(let offset=-.72;offset<=.721;offset+=INTERVAL){
          const station=at(candidate,candidate.station+offset);
          if(!station||Math.hypot(station.x-origin.x,station.z-origin.z)>LIMIT)continue;
          if(rows.some(row=>Math.hypot(row.x-station.x,row.z-station.z)<.105))continue;
          rows.push(station);
        }
      }
      rows.sort((a,b)=>(a.x-b.x)*streetStation.dx+(a.z-b.z)*streetStation.dz);
    }
    if(!placements.length)continue;
    const view=kit.view,hero=placements[0];
    const focus=kit.north&&placements.length>1?placements[Math.floor(placements.length/2)]:hero;
    plans.set(name,{name,kit,origin,placements,rows,focus,view});
    const radius=SPOT_EXCLUSION_ZONES[name];
    if(radius)for(const site of placements){
      if(site.onWater)continue;
      // Scope the streetside mask to the frontage behind the road. Keep
      // buildings across the street and in the surrounding historic blocks.
      masks.push({name,x:site.x,z:site.z,
        radius:kit.north?.113:radius,
        trees:true});
    }
    if(kit.north&&streetStation){
      masks.push({name,x:focus.x,z:focus.z,radius:.35,behindStreet:streetStation,trees:false});
    }
    if(kit.north)for(const row of rows)for(const side of [-1,1]){
      masks.push({name,x:row.x-row.dz*.057*side,z:row.z+row.dx*.057*side,
        radius:.045,treeOnly:true,trees:true});
    }
  }
  return {plans,masks};
}
