export const BOUNDS=Object.freeze({minX:-28.5,maxX:28.5,minZ:-27.5,maxZ:27.5});

export function inBounds(x,z){
  return x>=BOUNDS.minX&&x<=BOUNDS.maxX&&z>=BOUNDS.minZ&&z<=BOUNDS.maxZ;
}

export const clampX=x=>Math.min(BOUNDS.maxX,Math.max(BOUNDS.minX,x));
export const clampZ=z=>Math.min(BOUNDS.maxZ,Math.max(BOUNDS.minZ,z));

const same=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<1e-8;

export function clipRing(ring,maxEdge=Infinity){
  if(ring.length<4||!same(ring[0],ring.at(-1)))return [];
  if(Number.isFinite(maxEdge)&&ring.some((p,i)=>i&&Math.hypot(p[0]-ring[i-1][0],p[1]-ring[i-1][1])>maxEdge))return [];
  let points=ring.slice(0,-1);
  for(const [axis,bound,direction] of [
    [0,BOUNDS.minX,1],[0,BOUNDS.maxX,-1],[1,BOUNDS.minZ,1],[1,BOUNDS.maxZ,-1]
  ]){
    if(!points.length)return [];
    const next=[];
    let a=points.at(-1);
    let insideA=(a[axis]-bound)*direction>=0;
    for(const b of points){
      const insideB=(b[axis]-bound)*direction>=0;
      if(insideA!==insideB){
        const t=(bound-a[axis])/(b[axis]-a[axis]);
        const cut=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
        cut[axis]=bound;
        next.push(cut);
      }
      if(insideB)next.push(b);
      a=b;insideA=insideB;
    }
    points=next.filter((p,i)=>!i||!same(p,next[i-1]));
  }
  if(points.length>1&&same(points[0],points.at(-1)))points.pop();
  if(points.length<3)return [];
  return [...points,points[0]];
}

function clipSegment(a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1];
  let from=0,to=1;
  for(const [p,q] of [[-dx,a[0]-BOUNDS.minX],[dx,BOUNDS.maxX-a[0]],
                        [-dz,a[1]-BOUNDS.minZ],[dz,BOUNDS.maxZ-a[1]]]){
    if(!p){if(q<0)return null;continue;}
    if(p<0)from=Math.max(from,q/p);
    else to=Math.min(to,q/p);
    if(from>=to)return null;
  }
  return [from,to];
}

export function clipRoad(points,nodeIds,wayId){
  const runs=[];
  let current=null;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<1e-8)continue;
    const clip=length<=2.5?clipSegment(a,b):null;
    if(!clip){current=null;continue;}
    const [from,to]=clip;
    const sample=t=>[clampX(a[0]+(b[0]-a[0])*t),clampZ(a[1]+(b[1]-a[1])*t)];
    const start=from===0?a:sample(from),end=to===1?b:sample(to);
    const idA=from===0?nodeIds?.[i-1]:`clip:${wayId}:${i}:a`;
    const idB=to===1?nodeIds?.[i]:`clip:${wayId}:${i}:b`;
    if(!current||from!==0||!same(current.points.at(-1),start)){
      current={points:[start],nodeIds:[idA]};
      runs.push(current);
    }
    current.points.push(end);current.nodeIds.push(idB);
    if(to!==1)current=null;
  }
  return runs;
}
