import * as T from '../assets/three.module.js';
import {textureSurface} from './surface-materials.js';

const GRASS_Y=.066, ROAD_WIDTH=.10, WIDTH=.26, WATER_Y=.04;

function surface(color,kind){
  const material=new T.MeshStandardMaterial({color,roughness:.9,side:T.DoubleSide});
  textureSurface(material,kind);
  return material;
}
function writer(material,name){
  const positions=[],uv=[];
  return {quad(a,b,c,d,u,v,width=1){
    positions.push(...a,...b,...c,...b,...d,...c);
    uv.push(u,0,-1,u,width,1,v,0,-1,u,width,1,v,width,1,v,0,-1);
  }, finish(parent){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('pavingCoord',new T.Float32BufferAttribute(uv,3));
    geometry.computeVertexNormals();
    const mesh=new T.Mesh(geometry,material);
    mesh.name=name;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }};
}

function offset(q,width,y){return [q.x+q.nx*width,y,q.z+q.nz*width];}
function strip(writer,a,b,left,right,y1,y2){
  writer.quad(offset(a,right,y1),offset(a,left,y1),offset(b,right,y2),offset(b,left,y2),
    a.s/.014,b.s/.014,Math.abs(right-left)/.014);
}
function cap(writer,a,b,outer,inner,y){
  strip(writer,a,b,outer,inner,y,y);
}
function side(writer,a,b,edgeA,edgeB,topA,topB,bottomA,bottomB){
  writer.quad(offset(a,edgeA,topA),offset(a,edgeA,bottomA),
    offset(b,edgeB,topB),offset(b,edgeB,bottomB),a.s/.016,b.s/.016);
}

function archBottom(bridge,s){
  const span=bridge.half*.53,t=Math.abs(s-bridge.s)/span;
  return .035+(t>=1?0:bridge.rise*Math.sqrt(1-t*t));
}

export function createBaidiEmbankment(corridor,lakeMaterial){
  const name=corridor.name||'白堤',WIDTH=corridor.width||.26,GRASS_Y=corridor.grassY??.066;
  const root=new T.Group();root.name=name+' · 连续堤岸';
  const road=writer(surface(0xc8c1ab,'paving'),name+'花岗岩步道');
  const meadow=writer(surface(0x77964d,'ground'),'白堤双侧花带');
  const stone=writer(surface(0x9c9e92,'masonry'),'白堤垂直青石驳岸');
  const edgeStone=writer(surface(0xb9baab,'masonry'),'白堤压顶石');
  const arch=writer(surface(0xb8ae97,'masonry'),'断桥与锦带桥单孔石拱');
  const vault=writer(surface(0x736c5b,'masonry'),'石拱券底');
  const halo=writer(lakeMaterial,'白堤水面接缝');
  const special=corridor.bridges.flatMap(b=>[b.s-b.half,b.s+b.half,b.s-b.half*.53,b.s+b.half*.53,b.s]);
  const stations=Array.from({length:Math.ceil(corridor.length/.020)+1},(_,i)=>Math.min(corridor.length,i*.020));
  const steps=[...new Set([...stations,...special])].sort((a,b)=>a-b).map(corridor.station);
  for(let i=1;i<steps.length;i++){
    const a=steps[i-1],b=steps[i],bridge=corridor.getBridge((a.s+b.s)/2);
    const ya=corridor.surface(a.s),yb=corridor.surface(b.s);
    const overlayWidth=.351;
    if(!corridor.waterPatch||corridor.waterPatch(a,b))strip(halo,a,b,-overlayWidth,overlayWidth,WATER_Y+.00027,WATER_Y+.00027);
    if(!bridge){
      strip(road,a,b,-ROAD_WIDTH/2,ROAD_WIDTH/2,ya,yb);
      strip(meadow,a,b,-WIDTH/2,-(ROAD_WIDTH/2-.0013),ya-.002,yb-.002);
      strip(meadow,a,b,ROAD_WIDTH/2-.0013,WIDTH/2,ya-.002,yb-.002);
      for(const sign of [-1,1]){
        side(stone,a,b,sign*WIDTH/2,sign*WIDTH/2,ya-.002,yb-.002,.020,.020);
        side(edgeStone,a,b,sign*ROAD_WIDTH/2,sign*ROAD_WIDTH/2,ya,yb,.061,.061);
        strip(edgeStone,a,b,sign*WIDTH/2,sign*(WIDTH/2-.006),ya,yb);
      }
      continue;
    }
    const ha=archBottom(bridge,a.s),hb=archBottom(bridge,b.s);
    const halfWidth=WIDTH/2-.005;
    strip(road,a,b,-halfWidth,halfWidth,ya,yb);
    for(const sign of [-1,1])side(arch,a,b,sign*halfWidth,sign*halfWidth,ya,yb,ha,hb);
    strip(vault,a,b,-halfWidth,halfWidth,ha,hb);
  }
  // Low, individually seated stone posts and handrails exist only on the bridges.
  const posts=[],rails=[],caps=[],bands=[];
  for(const b of corridor.bridges){
    const count=Math.ceil(2*b.half/.041);
    for(const sign of [-1,1])for(let i=0;i<=count;i++){
      const a=corridor.station(b.s-b.half+2*b.half*i/count);
      const [x,y,z]=offset(a,(WIDTH/2-.012)*sign,corridor.surface(a.s));
      posts.push([x,y+.016,z,.009,.032,.009,0]);
      caps.push([x,y+.034,z,.012,.006,.012,0]);
      if(i===count)continue;
      const next=corridor.station(b.s-b.half+2*b.half*(i+1)/count);
      const [x2,y2,z2]=offset(next,(WIDTH/2-.012)*sign,corridor.surface(next.s));
      const width=Math.hypot(x2-x,z2-z),yaw=Math.atan2(x2-x,z2-z),pitch=-Math.atan2(y2-y,width);
      rails.push([(x+x2)/2,(y+y2)/2+.022,(z+z2)/2,.0058,.006,width,yaw,pitch]);
      bands.push([(x+x2)/2,(y+y2)/2+.010,(z+z2)/2,.0045,.009,width*.82,yaw,pitch]);
    }
  }
  instanceBoxes(root,posts.concat(caps),0xb6ae9b,'石栏望柱及柱帽');
  instanceBoxes(root,rails.concat(bands),0xbeb5a2,'石栏扶手及栏板');
  halo.finish(root);
  const walking=road.finish(root);
  for(const batch of [meadow,stone,edgeStone,arch,vault]){
    const mesh=batch.finish(root);
    mesh.castShadow=batch!==meadow;
  }
  return {root,walking};
}

export function instanceBoxes(parent,items,color,name){
  const mesh=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color,roughness:.83}),items.length);
  const dummy=new T.Object3D();
  items.forEach(([x,y,z,w,h,d,yaw=0,pitch=0],i)=>{
    dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(pitch,yaw,0,'YXZ');
    dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);
  return mesh;
}
