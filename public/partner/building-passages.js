import * as T from '../assets/three.module.js';
// OSM walkways may pass through simplified solid building extrusions. Rebuild
// only those ground-floor facades, leaving an actual opening over mapped paving.
export function mappedBuildingPassages(original,polygon,base,height,pavingHeight){
 const rows=[];let openings=0,area=0;
 for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];area+=a[0]*b[1]-b[0]*a[1];const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<1e-8)continue;const n=Math.max(1,Math.ceil(length/.01));for(let j=0;j<n;j++){const t=j/n,u=(j+1)/n,A=[a[0]+dx*t,a[1]+dz*t],B=[a[0]+dx*u,a[1]+dz*u];let floor=null;for(const k of [0,.25,.5,.75,1]){const y=pavingHeight(A[0]+(B[0]-A[0])*k,A[1]+(B[1]-A[1])*k);if(y!=null&&y<base+.04&&y+.022>base){floor=Math.max(floor??-Infinity,y);}}if(floor!=null)openings++;rows.push({A,B,floor,dx:dx/length,dz:dz/length});}}
 if(!openings)return {geometry:original,openings:0};
 const positions=[],normals=[],p=original.attributes.position,n=original.attributes.normal;
 // Preserve roof caps; remove the hidden underside only for a building with a passage.
 for(let i=0;i<p.count;i+=3)if(n.getY(i)>.35)for(let k=0;k<3;k++){positions.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));normals.push(n.getX(i+k),n.getY(i+k),n.getZ(i+k));}
 for(const {A,B,floor,dx,dz}of rows){const lower=floor==null?0:Math.max(0,floor+.022-base);if(lower>=height)continue;const a=[A[0],lower,A[1]],b=[B[0],lower,B[1]],c=[A[0],height,A[1]],d=[B[0],height,B[1]],triangles=area>=0?[a,c,b,b,c,d]:[a,b,c,b,d,c];for(const v of triangles){positions.push(...v);const sign=area>=0?1:-1;normals.push(dz*sign,0,-dx*sign);}}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));return {geometry,openings};
}
