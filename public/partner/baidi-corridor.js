import {latLonToScene} from './projection.js';

export const BAIDI_NAME='白堤';
export const PINGHU_NAME='平湖秋月';
export const DUANQIAO_NAME='断桥残雪';
export const PINGHU_COORDS=[30.2545,120.1413];
const axisIds=[29416781,28538285,28538286,28538289,28538290];
const axisIdSet=new Set(axisIds);
const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};

function pathSegments(points){
  let cursor=0;
  return points.slice(1).map(([x,z],i)=>{
    const a=points[i],dx=x-a[0],dz=z-a[1],length=Math.hypot(dx,dz);
    const edge={a,dx,dz,length,start:cursor};cursor+=length;
    return edge;
  });
}

export function mapBaidi(features,project,isWater){
  const axis=axisIds.map(id=>features.find(f=>Number(f.properties.osm_id)===id));
  if(axis.some(f=>!f))return null;
  const coords=axis.map(f=>f.geometry.coordinates.map(project));
  const edges=pathSegments(coords.flatMap((p,i)=>i?p.slice(1):p)).filter(e=>e.length>1e-6);
  const last=edges.at(-1),length=last.start+last.length;
  function sample(s){
    const distance=clamp(s,0,length);
    const e=edges.find(e=>distance<=e.start+e.length)||last;
    const t=clamp((distance-e.start)/e.length,0,1);
    return {x:e.a[0]+e.dx*t,z:e.a[1]+e.dz*t};
  }
  function station(s){
    const q=sample(s),a=sample(s-.045),b=sample(s+.045),dx=b.x-a.x,dz=b.z-a.z;
    const len=Math.hypot(dx,dz)||1;
    return {...q,s,dx:dx/len,dz:dz/len,nx:dz/len,nz:-dx/len};
  }
  function nearest(x,z){
    let d2=Infinity,s=0;
    for(const e of edges){
      const t=clamp(((x-e.a[0])*e.dx+(z-e.a[1])*e.dz)/(e.length*e.length),0,1);
      const d=(x-e.a[0]-e.dx*t)**2+(z-e.a[1]-e.dz*t)**2;
      if(d<d2){d2=d;s=e.start+e.length*t;}
    }
    return {s,distance:Math.sqrt(d2)};
  }
  const west=sample(0),east=sample(length),box={
    minX:Math.min(west.x,east.x)-.54,maxX:Math.max(west.x,east.x)+.54,
    minZ:Math.min(west.z,east.z)-.54,maxZ:Math.max(west.z,east.z)+.54
  };
  const bridges=[['锦带桥',1,.24,.122,.074],['断桥',3,.29,.162,.112]].map(([name,i,half,top,rise])=>{
    const [a,b]=coords[i],s=(nearest(...a).s+nearest(...b).s)*.5;
    return {name,s,half,top,rise};
  });
  const getBridge=s=>bridges.find(b=>Math.abs(b.s-s)<b.half);
  const surface=s=>{
    const b=getBridge(s);
    if(!b)return .068;
    return .068+(b.top-.068)*Math.cos((s-b.s)/b.half*Math.PI*.5)**1.6;
  };
  function sampleNear(x,z){
    if(x<box.minX||x>box.maxX||z<box.minZ||z>box.maxZ)return null;
    return nearest(x,z);
  }
  function depression(x,z){
    const q=sampleNear(x,z);
    if(!q||q.distance>.351)return 0;
    const edgeFade=1-smooth((q.distance-.285)/.066);
    const endFade=smooth(q.s/.24)*smooth((length-q.s)/.23);
    // Taper into the existing mainland and Gushan approach at the two joins.
    return edgeFade*endFade;
  }
  function ownGround(x,z){
    const q=sampleNear(x,z);
    if(!q||q.distance>.1305)return null;
    const b=getBridge(q.s);
    return b?(q.distance<=.125?surface(q.s):null):.066;
  }
  const origin=latLonToScene(...PINGHU_COORDS);
  const pinghu=[];
  function southBank(x){
    for(let z=origin.z-.10;z<origin.z+.9;z+=.014){
      if(!isWater(x,z-.035)&&isWater(x,z)&&isWater(x,z+.055))return z;
    }
    return origin.z+.08;
  }
  for(const [name,dx,offset,w,d,style] of [
    ['御书楼',.09,-.057,.151,.095,'library'],
    ['御碑亭',-.135,.013,.066,.065,'stele'],
    ['望湖亭',-.255,.036,.078,.074,'octagon'],
    ['四面厅',-.396,-.025,.124,.094,'hall'],
    ['湖天一碧楼',-.563,-.042,.146,.102,'library']
  ]){
    const x=origin.x+dx,bank=southBank(x);
    pinghu.push({name,x,z:bank+offset,bank,w,d,style});
  }
  const end=latLonToScene(30.2613,120.1474);
  const duanqiao=[
    {name:'断桥残雪御碑亭',x:end.x+.235,z:end.z-.216,w:.101,d:.094,style:'stele'},
    {name:'云水光中',x:end.x-.197,z:end.z-.318,w:.143,d:.097,style:'hall'}
  ];
  function bridgeheadGrade(x,z){
    const d=Math.min(...duanqiao.map(p=>Math.hypot(x-p.x,z-p.z)));
    if(d>.51)return null;
    return {y:.068,weight:1-smooth((d-.18)/.33)};
  }
  function terraceGrade(x,z){
    if(Math.abs(x-end.x)<.69&&Math.abs(z-end.z)<.88){
      const grade=bridgeheadGrade(x,z);
      if(grade)return grade;
    }
    if(Math.abs(x-origin.x)>.94||Math.abs(z-origin.z)>1.2)return null;
    const site=pinghu.reduce((best,p)=>Math.abs(p.x-x)<Math.abs(best.x-x)?p:best,pinghu[0]);
    const distance=Math.hypot((x-site.x)*1.6,Math.max(0,site.bank-z-.11)*.95,Math.max(0,z-site.bank)*.87);
    if(distance>.40)return null;
    return {y:.055+.026*smooth((site.bank-z)/.24),weight:1-smooth((distance-.16)/.24)};
  }
  return {length,box,station,nearest,sampleNear,depression,ownGround,terraceGrade,bridgeheadGrade,isAxis:f=>axisIdSet.has(Number(f.properties.osm_id)),
    getBridge,bridges,surface,pinghu,duanqiao,pinghuAnchor:origin,
    midpoint:station(length*.53),isReplacement:(x,z)=>{
      const q=sampleNear(x,z);
      return q&&q.distance<.145&&q.s>.035&&q.s<length-.12;
    }};
}

export function placeBaidiPlans(plans,corridor){
  if(!corridor)return;
  const {midpoint,bridges,station,pinghu,pinghuAnchor}=corridor;
  const broken=station(bridges.at(-1).s);
  const library=pinghu[0];
  const sites=[
    [DUANQIAO_NAME,broken,{x:broken.x+.16,z:broken.z-.30,y:.106},[-.92,.31,-.55]],
    [BAIDI_NAME,midpoint,{x:midpoint.x,z:midpoint.z,y:.079},[-.26,.315,-.48]],
    [PINGHU_NAME,pinghuAnchor,{x:library.x-.35,z:library.z+.082,y:.087},[.11,.29,1.10]]
  ];
  for(const [name,origin,focus,offset] of sites){
    const plan=plans.get(name);
    if(!plan)continue;
    plan.origin=origin;
    plan.corridorView={focus,offset};
    plan.rows=[];
    plan.placements=[];
  }
}
