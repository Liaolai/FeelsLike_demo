import {latLonToScene} from './projection.js';

export const FLOWER_NAME='花港观鱼';
export const HUBIN_NAME='湖滨';
export const FLOWER_COORDS=[30.2330,120.1398];
export const HUBIN_COORDS=[30.2515,120.1586];

const center=latLonToScene(30.23241,120.13559);
const fountain=latLonToScene(30.2560855,120.1557357);
const jixian=latLonToScene(30.2531420,120.1569882);
const at=(c,x,z)=>({x:c.x+x,z:c.z+z});
const point=(c,x,z)=>[c.x+x,c.z+z];

function ring(c,role,key,vertices){
  const coordinates=vertices.map(([x,z])=>point(c,x,z));
  coordinates.push(coordinates[0]);
  return {role,key,coordinates};
}

function oval(c,a,b,n){
  return Array.from({length:n},(_,i)=>{
    const angle=i*Math.PI*2/n,shape=1+.045*Math.sin(angle*3+.7);
    return [c.x+Math.cos(angle)*a*shape,c.z+Math.sin(angle)*b*shape];
  });
}

const mainPond=ring(center,'outer','红鱼池',[
  [-.39,-.09],[-.40,-.20],[-.34,-.29],[-.22,-.33],[-.08,-.32],
  [.02,-.27],[.105,-.277],[.23,-.31],[.34,-.25],[.40,-.15],[.405,-.03],
  [.365,.08],[.31,.14],[.29,.23],[.19,.29],[.06,.30],[-.045,.26],
  [-.10,.20],[-.19,.23],[-.31,.21],[-.39,.13],[-.425,.01]
]);
const ecology=ring(center,'inner','红鱼池生态岛',oval({x:.015,z:-.007},.094,.070,18));
const quietPond=ring(center,'outer','印影池',oval({x:-.37,z:.42},.142,.091,25));
export const FLOWER_WATER_RINGS=[mainPond,ecology,quietPond];

export const HUBIN_REBUILDINGS=new Map([
  [328911727,'Apple 西湖旗舰店'],[109882469,'湖滨银泰 in77 A区'],[260710901,'湖滨银泰 in77 C1区'],
  [260711006,'湖滨银泰 in77 C2区'],[260711007,'湖滨银泰 in77 C3区'],
  [514210559,'湖滨银泰 in77 D区'],[547678662,'湖滨银泰 in77 E区'],
  [28538110,'杭州君悦酒店'],[548510277,'杭州君悦酒店 · 东翼'],
  [399028956,'华侨饭店'],[542780576,'华侨饭店商务中心'],[542780578,'华侨饭店 · 主楼']
]);

function nearestLand(isWater,c,offset){
  for(let d=.015;d<1.64;d+=.016){
    const x=c.x+d,z=c.z+offset;
    if(!isWater(x,z)&&!isWater(x+.073,z))return x;
  }
  return c.x+1.2;
}

function mapEstate(isWater,guess){
  let nearest;
  for(let i=0;i<80;i++){
    const angle=i*Math.PI/40,nx=Math.cos(angle),nz=Math.sin(angle);
    for(let d=.02;d<(nearest?.d??1.52);d+=.025){
      const x=guess.x+nx*d,z=guess.z+nz*d;
      if(!isWater(x,z)||isWater(x-nx*.065,z-nz*.065))continue;
      nearest={x,z,nx,nz,d};break;
    }
  }
  if(!nearest)return {...guess,yaw:-Math.PI/2,pier:[]};
  const {x,z,nx,nz}=nearest;
  return {x:x-nx*.095,z:z-nz*.095,yaw:Math.atan2(nx,nz),
    pier:[[-.153,-.025],[-.153,.055],[-.043,.055],[-.043,.120],[.132,.120],[.132,.052]]
      .map(([a,b])=>[x+nz*a+nx*b,z-nx*a+nz*b])};
}

export function planWaterfronts(isWater,osmElements){
  const north=point(center,-.055,-.406),south=point(center,.145,.378);
  const bridge=[north,point(center,-.055,-.29),point(center,.021,-.215),
    point(center,.008,-.095),point(center,.028,.002),point(center,.028,.091),
    point(center,.115,.164),point(center,.115,.268),south];
  const gallery=[point(center,-.35,-.258),point(center,-.20,-.276),point(center,-.085,-.263),
    point(center,.049,-.232),point(center,.186,-.249),point(center,.300,-.209)];
  const peony=at(center,-.70,.14);
  const estate=mapEstate(isWater,at(center,-1.0,-.46));
  const plaza={x:nearestLand(isWater,fountain,-.026)+.034,z:fountain.z-.026};
  const pavilionBank=nearestLand(isWater,jixian,.016);
  const rebuilt=[];
  for(const el of osmElements||[]){
    const name=HUBIN_REBUILDINGS.get(Number(el.id));
    if(!name||!el.geometry?.length)continue;
    const points=el.geometry.map(p=>latLonToScene(p.lat,p.lon));
    const xs=points.map(p=>p.x),zs=points.map(p=>p.z);
    const x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
    rebuilt.push({id:Number(el.id),name,x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0});
  }
  const market=latLonToScene(30.25462,120.15860);
  const pinghai=[[plaza.x+.18,plaza.z-.13],...[
    [30.256248,120.15685],[30.256251,120.15696],[30.256295,120.15822],
    [30.256333,120.15935],[30.25636,120.16027]
  ].map(([lat,lon])=>{const p=latLonToScene(lat,lon);return [p.x,p.z];})];
  const dongpo=[[30.25708,120.15829],[30.25632,120.15827],
    [30.25531,120.15830],[30.25440,120.15848],[30.25374,120.15852]]
    .map(([lat,lon])=>{const p=latLonToScene(lat,lon);return [p.x,p.z];});
  const lakeside=Array.from({length:20},(_,i)=>{
    const dz=-.79+i*.115;
    return [nearestLand(isWater,fountain,dz)+.125,fountain.z+dz];
  });
  const streets=[{name:'平海路',path:pinghai,width:.206},{name:'东坡路',path:dongpo,width:.169},
    {name:'湖滨路',path:lakeside,width:.126}];
  rebuilt.push({name:'湖滨银泰 in77 B区 · 龙翔里',x:market.x,z:market.z,w:.31,d:.31});
  const northLawn=at(center,-.25,-.63),southLawn=at(center,.07,.49);
  return {flower:{center,peony,estate,northLawn,southLawn,north,south,bridge,gallery},
    hubin:{fountain,plaza,jixian,pavilionBank,rebuilt,market,streets}};
}

export function waterfrontGrade(sites,x,z){
  const {flower,hubin}=sites;
  const p=flower.center;
  if(Math.abs(x-p.x)<1.55&&Math.abs(z-p.z)<1.25){
    const distance=Math.hypot((x-p.x)*.84,z-p.z);
    const hill=Math.hypot(x-flower.peony.x,z-flower.peony.z);
    const blend=1-Math.min(1,Math.max(0,(distance-.73)/.52));
    if(blend>0)return {elevation:.068+.045*Math.max(0,1-(hill/.30)**2)**2,blend};
  }
  const d=Math.hypot((x-hubin.plaza.x)*.80,z-hubin.plaza.z);
  if(d<.57)return {elevation:.078,blend:Math.min(1,(.57-d)/.26)};
  return null;
}

export function maskWaterfrontTree(sites,x,z){
  if(!sites)return false;
  const {flower,hubin}=sites;
  for(const [p,rx,rz] of [[flower.center,.57,.39],[flower.northLawn,.35,.20],
    [flower.southLawn,.36,.19],[flower.peony,.24,.25],[hubin.plaza,.27,.43]]){
    if(((x-p.x)/rx)**2+((z-p.z)/rz)**2<1)return true;
  }
  return false;
}

export function maskWaterfrontBuilding(sites,x,z,id){
  if(!sites)return false;
  if(HUBIN_REBUILDINGS.has(Number(id)))return true;
  const {flower,hubin}=sites;
  if(Math.hypot(x-flower.center.x,z-flower.center.z)<.50)return true;
  if(Math.hypot(x-flower.peony.x,z-flower.peony.z)<.22)return true;
  if(Math.hypot(x-flower.estate.x,z-flower.estate.z)<.23)return true;
  if(Math.hypot(x-hubin.plaza.x,z-hubin.plaza.z)<.28)return true;
  return Math.abs(x-hubin.market.x)<.17&&Math.abs(z-hubin.market.z)<.17;
}

export function tuneWaterfrontPlans(plans,sites){
  const f=plans.get(FLOWER_NAME),h=plans.get(HUBIN_NAME);
  if(f){
    const {center,north}=sites.flower;
    f.origin={x:north[0],z:north[1]};f.placements=[];f.rows=[];
    f.waterfrontView={
      detail:{focus:at(center,-.26,-.030),height:.085,offset:[.20,.55,1.15]},
      overview:{focus:at(center,-.79,-.31),height:.065,offset:[.53,3.65,2.20]}
    };
  }
  if(h){
    const {plaza,fountain}=sites.hubin;
    h.origin={...plaza};h.placements=[];h.rows=[];
    h.waterfrontView={
      detail:{focus:at(fountain,1.27,1.09),height:.18,offset:[-4.25,1.66,1.44]},
      overview:{focus:at(plaza,1.59,-.19),height:.115,offset:[-1.15,.30,.15]}
    };
  }
}
