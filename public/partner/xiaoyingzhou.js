import {latLonToScene} from './projection.js';

export const SANTAN_NAME='三潭印月';
export const SANTAN_ANCHOR=[30.23975,120.14050];
const anchor=latLonToScene(...SANTAN_ANCHOR);
const towerCenter=latLonToScene(30.23905,120.14050);
const spacing=.62, altitude=spacing*Math.sqrt(3)/2;
export const STONE_TOWERS=[
  {x:towerCenter.x,z:towerCenter.z-2*altitude/3},
  {x:towerCenter.x-spacing/2,z:towerCenter.z+altitude/3},
  {x:towerCenter.x+spacing/2,z:towerCenter.z+altitude/3}
];
export const ISLAND_WATER_Y=.040;
export const ISLAND_BRIDGE_Y=.052;

const flatWays=new Set([30086286,30086287,30086288,30086290,30086293,89568414,331627806]);
const axialWays=new Set([...flatWays,331627804,331627805]);
const at=(x,z)=>({x:anchor.x+x,z:anchor.z+z});

export function ringContains(ring,x,z){
  if(x<ring.minX||x>ring.maxX||z<ring.minZ||z>ring.maxZ)return false;
  let inside=false;
  const p=ring.coordinates;
  for(let i=1;i<p.length;i++){
    const [ax,az]=p[i-1],[bx,bz]=p[i];
    if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
  }
  return inside;
}

export function mapWaterRings(rings){
  const layers=rings.map(r=>{
    const x=r.coordinates.map(p=>p[0]),z=r.coordinates.map(p=>p[1]);
    let area=0;
    for(let i=1;i<x.length;i++)area+=x[i-1]*z[i]-x[i]*z[i-1];
    return {...r,area:Math.abs(area*.5),minX:Math.min(...x),maxX:Math.max(...x),minZ:Math.min(...z),maxZ:Math.max(...z)};
  }).sort((a,b)=>b.area-a.area);
  for(let i=0;i<layers.length;i++){
    const ring=layers[i];
    ring.parent=layers.slice(0,i).findLast(parent=>ringContains(parent,...ring.coordinates[0]));
    ring.depth=ring.parent?ring.parent.depth+1:0;
  }
  layers.sort((a,b)=>a.depth-b.depth||b.area-a.area);
  const topAt=(x,z)=>layers.findLast(ring=>ringContains(ring,x,z));
  return {layers,isWater:(x,z)=>topAt(x,z)?.role==='outer'};
}

function segments(lines){
  return lines.flatMap(path=>path.slice(1).map(([x,z],i)=>{
    const [ax,az]=path[i],dx=x-ax,dz=z-az;
    return {ax,az,dx,dz,length2:dx*dx+dz*dz};
  }).filter(s=>s.length2>0));
}

function distance(edges,x,z){
  let best=Infinity;
  for(const {ax,az,dx,dz,length2} of edges){
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/length2));
    best=Math.min(best,(x-ax-dx*t)**2+(z-az-dz*t)**2);
  }
  return Math.sqrt(best);
}

export function mapXiaoyingzhou(layers,features,project){
  const test=at(-.48,-2.15);
  const pond=layers.find(r=>r.role==='outer'&&r.depth>=2&&ringContains(r,test.x,test.z));
  if(!pond?.parent)return null;
  const island=pond.parent;
  const contains=(x,z)=>ringContains(island,x,z);
  const spots=Object.fromEntries(features.filter(f=>axialWays.has(Number(f.properties.osm_id))||
    [62124951,30086291,62124964].includes(Number(f.properties.osm_id)))
    .map(f=>[f.properties.osm_id,f.geometry.coordinates.map(project)]));
  const dykes=segments([spots[62124951]?.filter(p=>p[0]>=anchor.x-1.11&&p[1]>=anchor.z-1.91)||[],spots[30086291]||[]]);
  const flat=Object.entries(spots).filter(([id])=>flatWays.has(+id)).map(([,path])=>path);
  const bridgeEdges=segments(flat);
  const embankment=(x,z)=>ringContains(pond,x,z)&&distance(dykes,x,z)<.048;
  const bridgeFootprint=(x,z)=>ringContains(pond,x,z)&&distance(bridgeEdges,x,z)<.019;
  const stage=[
    {name:'我心相印亭',...at(.23,-.195),kind:'signature',w:.198,d:.084,yaw:0},
    {name:'开网亭',...at(.573,-2.373),kind:'open',w:.083,d:.077,yaw:.46},
    {name:'亭亭亭',...at(.444,-1.809),kind:'octagon',w:.085,d:.078,yaw:0},
    {name:'御碑亭',...at(-.005,-.805),kind:'stele',w:.069,d:.067,yaw:0},
    {name:'迎翠轩',...at(.165,-1.210),kind:'hall',w:.105,d:.064,yaw:-.55},
    {name:'先贤祠',...at(.05,-3.021),kind:'court',w:.178,d:.118,yaw:-.22}
  ];
  const path=spots[62124964]||[];
  const entry=path.reduce((best,[x,z])=>{
    const d=Math.hypot(x-stage[0].x,z-stage[0].z);
    return d<best.distance?{x,z,distance:d}:best;
  },{...anchor,distance:Infinity});
  return {bounds:island,pond,contains,flat,embankment,bridgeFootprint,stage,entry,
    center:at(.03,-1.68),
    shoreDistance:(x,z)=>distance(segmentsAround(island),x,z),
    isFlatWay:f=>flatWays.has(Number(f.properties.osm_id))
  };
}

const shorelineSegments=new WeakMap();
function segmentsAround(ring){
  if(!shorelineSegments.has(ring))shorelineSegments.set(ring,segments([ring.coordinates]));
  return shorelineSegments.get(ring);
}

export function placeSantanPlan(plans,island){
  const plan=plans.get(SANTAN_NAME);
  if(!plan||!island)return;
  plan.origin=island.entry;
  plan.focus={...anchor,asset:'santan',yaw:0};
  plan.island=island;
}
