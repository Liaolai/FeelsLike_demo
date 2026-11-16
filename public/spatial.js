export const GEO={lon:120.142,lat:30.248,mPerLon:96400,mPerLat:111320,unit:40};
export const toMeters=c=>[(c[0]-GEO.lon)*GEO.mPerLon,(GEO.lat-c[1])*GEO.mPerLat];
export const fromMeters=p=>[p[0]/GEO.mPerLon+GEO.lon,GEO.lat-p[1]/GEO.mPerLat];
export function roadWidthM(r){const defaults={primary:14,secondary:11,tertiary:9,residential:7,unclassified:7,service:4,living_street:5,pedestrian:5,footway:3,path:2.2,steps:2.4,cycleway:3,track:3.5};return Number.isFinite(r.widthM)?Math.max(.8,Math.min(30,r.widthM)):defaults[r.kind]||5;}
export const isFootpath=r=>['footway','path','steps','pedestrian','cycleway'].includes(r.kind);
export function roadJunctions(roads){
 const nodes=new Map();for(const road of roads)for(let i=0;i<road.nodes.length;i++){const id=road.nodes[i];if(!nodes.has(id))nodes.set(id,{id,c:road.c[i],roads:new Map()});nodes.get(id).roads.set(road.id,road);}
 return [...nodes.values()].filter(n=>n.roads.size>1).map(n=>{const roads=[...n.roads.values()],dominant=roads.slice().sort((a,b)=>Number(isFootpath(a))-Number(isFootpath(b))||roadWidthM(b)-roadWidthM(a))[0];return {...n,roads,dominant,widthM:Math.max(...roads.map(roadWidthM)),mixed:roads.some(isFootpath)&&roads.some(r=>!isFootpath(r))};});
}
export function pointInPolygon(c,p){let odd=false;for(let i=0,j=c.length-1;i<c.length;j=i++){const a=c[i],b=c[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])odd=!odd;}return odd;}
export function waterQuery(data){const rings=data.water.map(r=>({...r,bounds:[Math.min(...r.c.map(p=>p[0])),Math.min(...r.c.map(p=>p[1])),Math.max(...r.c.map(p=>p[0])),Math.max(...r.c.map(p=>p[1]))]}));const hit=(r,p)=>p[0]>=r.bounds[0]&&p[0]<=r.bounds[2]&&p[1]>=r.bounds[1]&&p[1]<=r.bounds[3]&&pointInPolygon(r.c,p);return p=>rings.some(r=>r.role==='outer'&&hit(r,p))&&!rings.some(r=>r.role==='inner'&&hit(r,p));}
// Match the exact diagonal and barycentric interpolation of the rendered mesh.
export function terrainHeight(data,lon,lat){const[w,s,e,n]=data.bbox,N=data.size;const x=Math.max(0,Math.min(N-1,(lon-w)/(e-w)*(N-1))),y=Math.max(0,Math.min(N-1,(n-lat)/(n-s)*(N-1)));const c=Math.min(N-2,Math.floor(x)),r=Math.min(N-2,Math.floor(y)),u=x-c,v=y-r;const a=data.elev[r*N+c],b=data.elev[r*N+c+1],d=data.elev[(r+1)*N+c],f=data.elev[(r+1)*N+c+1];const h=u+v<=1?a+u*(b-a)+v*(d-a):f+(1-u)*(d-f)+(1-v)*(b-f);return h/GEO.unit*1.6;}
export function densifyRoad(road,maxStep=3){const out=[road.c[0]];for(let i=1;i<road.c.length;i++){const a=road.c[i-1],b=road.c[i],A=toMeters(a),B=toMeters(b),steps=Math.max(1,Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1])/maxStep));for(let k=1;k<=steps;k++)out.push([a[0]+(b[0]-a[0])*k/steps,a[1]+(b[1]-a[1])*k/steps]);}return out;}
export function roadSurfaceHeight(data,c,road={},inWater=waterQuery(data)){return Math.max(terrainHeight(data,...c)+.016,road.bridge||inWater(c)?.339:0);}
export function buildRoadSurface(data,road,inWater=waterQuery(data)){
 const points=densifyRoad(road,2.5),vertices=[],half=roadWidthM(road)/2;
 const v=(x,z)=>{const c=fromMeters([x,z]);return [x/GEO.unit,roadSurfaceHeight(data,c,road,inWater),z/GEO.unit];};
 const N=data.size-1,origin=toMeters([data.bbox[0],data.bbox[3]]),sx=(data.bbox[2]-data.bbox[0])*GEO.mPerLon/N,sz=(data.bbox[3]-data.bbox[1])*GEO.mPerLat/N;
 function clip(poly,a,b,c){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=a*p[0]+b*p[1]+c,dq=a*q[0]+b*q[1]+c;if(dp>=-1e-9)out.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}return out;}
 function emit(A,B,C){const g=[A,B,C].map(p=>[(p[0]*GEO.unit-origin[0])/sx,(p[2]*GEO.unit-origin[1])/sz]);const xs=g.map(p=>Math.floor(p[0])),ys=g.map(p=>Math.floor(p[1]));const cellX=xs[0],cellY=ys[0],d=g.map(p=>p[0]+p[1]-cellX-cellY-1);if(xs.every(x=>x===cellX)&&ys.every(y=>y===cellY)&&cellX>=0&&cellX<N&&cellY>=0&&cellY<N&&(d.every(x=>x<=1e-9)||d.every(x=>x>=-1e-9))){vertices.push(...A,...B,...C);return;}
 for(let x=Math.max(0,Math.min(...xs));x<=Math.min(N-1,Math.max(...xs));x++)for(let y=Math.max(0,Math.min(...ys));y<=Math.min(N-1,Math.max(...ys));y++){let poly=clip(clip(clip(clip(g,1,0,-x),-1,0,x+1),0,1,-y),0,-1,y+1);if(poly.length<3)continue;for(const sign of [-1,1]){const part=clip(poly,sign,sign,-sign*(x+y+1));if(part.length<3)continue;const P=part.map(p=>v(origin[0]+p[0]*sx,origin[1]+p[1]*sz));for(let j=1;j<P.length-1;j++)vertices.push(...P[0],...P[j],...P[j+1]);}}}

 const lanes=1; // Terrain-cell clipping supplies all required cross-road subdivisions.
 for(let i=1;i<points.length;i++){const a=toMeters(points[i-1]),b=toMeters(points[i]),dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.001)continue;const nx=-dz/len,nz=dx/len;for(let lane=0;lane<lanes;lane++){const lo=-half+2*half*lane/lanes,hi=-half+2*half*(lane+1)/lanes,A=v(a[0]+nx*lo,a[1]+nz*lo),B=v(a[0]+nx*hi,a[1]+nz*hi),C=v(b[0]+nx*lo,b[1]+nz*lo),D=v(b[0]+nx*hi,b[1]+nz*hi);emit(A,B,C);emit(C,B,D);}}
 // Round overlapping caps close joins at road nodes, including intersections.
 for(const c of road.c){const p=toMeters(c),center=v(...p);for(let i=0;i<10;i++){const a=i*Math.PI/5,b=(i+1)*Math.PI/5;emit(center,v(p[0]+Math.cos(a)*half,p[1]+Math.sin(a)*half),v(p[0]+Math.cos(b)*half,p[1]+Math.sin(b)*half));}}
 return vertices;
}
export function distanceToSegment(p,a,b){const x=b[0]-a[0],y=b[1]-a[1],l=x*x+y*y,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/l)):0;return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);}
export function pierHouseLayout(data,destinations){
 const index=roadIndex(data.roads),inWater=waterQuery(data),result=[],buildingBounds=data.buildings.map(b=>{const pts=b.c.map(toMeters);return [Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];});
 for(const [key,d] of Object.entries(destinations).filter(([,d])=>d.kind==='pier')){
  const origin=toMeters(d.c),options=[];
  for(const radius of [0,4,8,12,16,20,24,28])for(let i=0;i<(radius?16:1);i++){
   const a=i*Math.PI/8,c=fromMeters([origin[0]+Math.cos(a)*radius,origin[1]+Math.sin(a)*radius]);
   const clearance=index.clearance(c);if(clearance<8)continue;
   const m=toMeters(c);if(buildingBounds.some(b=>Math.hypot(Math.max(b[0]-m[0],0,m[0]-b[2]),Math.max(b[1]-m[1],0,m[1]-b[3]))<8))continue;
   options.push({c,clearance,score:radius+(inWater(c)?0:8)});
  }
  options.sort((a,b)=>a.score-b.score);if(!options.length)throw Error('No clear pier-house site: '+key);
  result.push({key,...options[0]});
 }
 return result;
}
export function roadIndex(roads,cellSize=32){const cells=new Map(),segments=[];for(const r of roads)for(let i=1;i<r.c.length;i++){const seg={a:toMeters(r.c[i-1]),b:toMeters(r.c[i]),half:roadWidthM(r)/2};segments.push(seg);const pad=seg.half+8;for(let x=Math.floor((Math.min(seg.a[0],seg.b[0])-pad)/cellSize);x<=Math.floor((Math.max(seg.a[0],seg.b[0])+pad)/cellSize);x++)for(let y=Math.floor((Math.min(seg.a[1],seg.b[1])-pad)/cellSize);y<=Math.floor((Math.max(seg.a[1],seg.b[1])+pad)/cellSize);y++){const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(seg);}}
 return {segments,clearance(c){const p=toMeters(c);let d=Infinity;for(const s of cells.get(Math.floor(p[0]/cellSize)+','+Math.floor(p[1]/cellSize))||[])d=Math.min(d,distanceToSegment(p,s.a,s.b)-s.half);return d;}};}
export function buildTrees(data){const index=roadIndex(data.roads),inWater=waterQuery(data),trees=[],bins=new Map(),[w,s,e,n]=data.bbox;let seed=7381;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const stats={rejectedRoad:0,rejectedWater:0,rejectedBuilding:0,roadside:0,park:0};
 const buildings=data.buildings.map(b=>({c:b.c,bbox:[Math.min(...b.c.map(p=>p[0])),Math.min(...b.c.map(p=>p[1])),Math.max(...b.c.map(p=>p[0])),Math.max(...b.c.map(p=>p[1]))]}));
 function plant(c,type){if(c[0]<w||c[0]>e||c[1]<s||c[1]>n||type==='roadside'&&rnd()>.42)return;const crown=1.7+rnd()*.7;if(index.clearance(c)<crown+1.1){stats.rejectedRoad++;return;}if(inWater(c)){stats.rejectedWater++;return;}if(buildings.some(b=>c[0]>=b.bbox[0]&&c[0]<=b.bbox[2]&&c[1]>=b.bbox[1]&&c[1]<=b.bbox[3]&&pointInPolygon(b.c,c))){stats.rejectedBuilding++;return;}const p=toMeters(c),cx=Math.floor(p[0]/6),cy=Math.floor(p[1]/6);for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const q of bins.get(x+','+y)||[])if(Math.hypot(q[0]-p[0],q[1]-p[1])<5.5)return;const key=cx+','+cy;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(p);trees.push({c,crown,height:7+rnd()*3,type});stats[type]++;}
 // Two rows offset from the road's full width, crown radius and a clear margin.
 for(const road of data.roads){if(road.bridge||road.tunnel||!road.walk||road.kind==='steps')continue;const points=densifyRoad(road,16);for(let i=1;i<points.length;i++){const a=toMeters(points[i-1]),b=toMeters(points[i]),len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<8)continue;const nx=-(b[1]-a[1])/len,ny=(b[0]-a[0])/len,offset=roadWidthM(road)/2+4;for(const sign of [-1,1])plant(fromMeters([(a[0]+b[0])/2+nx*offset*sign,(a[1]+b[1])/2+ny*offset*sign]),'roadside');}}
 for(const poly of data.green){const minX=Math.max(w,Math.min(...poly.map(p=>p[0]))),maxX=Math.min(e,Math.max(...poly.map(p=>p[0]))),minY=Math.max(s,Math.min(...poly.map(p=>p[1]))),maxY=Math.min(n,Math.max(...poly.map(p=>p[1])));const count=Math.min(190,Math.ceil((maxX-minX)*(maxY-minY)*7e6));for(let i=0;i<count;i++){const c=[minX+rnd()*(maxX-minX),minY+rnd()*(maxY-minY)];if(pointInPolygon(poly,c))plant(c,'park');}if(stats.park>3000)break;}
 return {trees,stats,index};}
export function graphAudit(data){const edges=new Map(),coords=new Map();let duplicates=0,zeroSegments=0;for(const road of data.roads.filter(r=>r.walk))for(let i=1;i<road.nodes.length;i++){const a=road.nodes[i-1],b=road.nodes[i];coords.set(a,road.c[i-1]);coords.set(b,road.c[i]);if(a===b){zeroSegments++;continue;}if(!edges.has(a))edges.set(a,new Set());if(!edges.has(b))edges.set(b,new Set());if(edges.get(a).has(b))duplicates++;edges.get(a).add(b);edges.get(b).add(a);}
 const component=new Map(),sizes=[];for(const key of edges.keys()){if(component.has(key))continue;const id=sizes.length,q=[key];component.set(key,id);for(let i=0;i<q.length;i++)for(const n of edges.get(q[i]))if(!component.has(n)){component.set(n,id);q.push(n);}sizes.push(q.length);}return {edges,coords,component,summary:{nodes:edges.size,components:sizes.length,largestComponents:sizes.sort((a,b)=>b-a).slice(0,10),duplicateSegments:duplicates,zeroSegments}};}
