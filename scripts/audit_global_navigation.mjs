import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import * as T from '../public/assets/three.module.js';
import {DEST} from '../public/destinations.js';
// Geometry audit only: never runs browser automation or contacts a remote host.
globalThis.ProgressEvent=class {constructor(type,props){Object.assign(this,{type},props);}};
globalThis.fetch=async input=>{const url=input?.url||String(input);if(!url.startsWith('file:'))throw Error('External network disabled: '+url);const bytes=await readFile(fileURLToPath(url));return new Response(bytes,{headers:{'content-length':String(bytes.length)}});};
const baseline=process.argv.includes('--baseline'),started=performance.now();
if(process.argv.includes('--self-test')){
 const world=(x,z)=>new T.Vector3(x,0,z),local=(x,y,z)=>({x,y,z}),road=[[0,0],[.5,0]];
 const edge=(id,x,z,X,Z)=>({a:{id:id*2,x,z},b:{id:id*2+1,x:X,z:Z}});
 const scene=(paths,height)=>({landscape:{paths,supplementPaths:[]},rows:paths.map((_,i)=>({road:{name:'road-'+i,kind:'footway'}})),deck:{height}});
 const rectangle=(x,z)=>x>=-.05&&x<=.55&&Math.abs(z)<=.05?0:null;
 const full=[edge(0,0,0,.25,0),edge(1,.25,0,.5,0)];full[1].a=full[0].b;
 const audit=(p,edges)=>auditSourceRoadCoverage(p,edges,world,40,local);
 assert.equal(audit(scene([road],rectangle),full).passed,true,'continuous original road must pass');
 const empty=audit(scene([road],rectangle),[]);assert.equal(empty.missingRoads,1);assert.equal(empty.passed,false,'pruning every edge must fail original-road coverage');
 const gap=audit(scene([road],rectangle),[edge(0,0,0,.1,0),edge(1,.4,0,.5,0)]);assert.equal(gap.missingRoads,1,'long uncovered gap must fail');
 const split=audit(scene([road],rectangle),[edge(0,0,0,.23,0),edge(1,.27,0,.5,0)]);assert.equal(split.disconnectedRoads,1);assert.equal(split.navigationCoveredSamples,split.samples,'nearby but disconnected fragments must fail even at 100% sample proximity');
 const wide=audit(scene([road],(x,z)=>x>=-.05&&x<=.55&&Math.abs(z)<=.15?0:null),[edge(0,0,.12,.5,.12)]);assert.equal(wide.passed,true,'a 4.8 m lateral shift on a real 12 m deck must pass');
 const parallel=audit(scene([road],(x,z)=>x>=-.05&&x<=.55&&(Math.abs(z)<=.02||Math.abs(z-.07)<=.02)?0:null),[edge(0,0,.07,.5,.07)]);assert.equal(parallel.passed,false,'a separate nearby parallel deck must not cover the missing source road');
 const islands=audit(scene([road,[[0,.5],[.5,.5]]],(x,z)=>x>=-.05&&x<=.55&&(Math.abs(z)<=.05||Math.abs(z-.5)<=.05)?0:null),[edge(0,0,0,.5,0),edge(1,0,.5,.5,.5)]);assert.equal(islands.passed,true,'separate island roads need internal continuity, not an artificial water crossing');
 console.log('source-road coverage self-test: 7 cases passed');process.exit(0);
}
const {loadPartnerScene}=await import('../public/partner-scene.js');
const p=await loadPartnerScene({deferShade:true,onProgress:message=>console.log(message)});p.root.updateWorldMatrix(true,true);
const UNIT=40,ROOT=p.root.matrixWorld.clone(),INV=ROOT.clone().invert();
console.log('sole-support examples',JSON.stringify((p.navigationDiagnostics.rejectedExamples||[]).filter(e=>e.reason==='sole-support').slice(0,6).map(e=>({at:e.at,sides:[[.16/40,0],[-.16/40,0],[0,.16/40],[0,-.16/40]].map(([x,z])=>{const y=p.deck.height(e.at[0]+x,e.at[2]+z);return y==null?null:(y+.0005-e.at[1])*40;})}))));
const world=(x,z)=>new T.Vector3(x,0,z).applyMatrix4(ROOT);
const local=(x,y,z)=>new T.Vector3(x,y,z).applyMatrix4(INV);
const collision=p.collision||p.navigationCollision||null;
const safe=(position)=>!collision||!collision.blocked(position);
const take=(a,item)=>{if(a.length<30)a.push(item);};
const report={date:new Date().toISOString(),mode:baseline?'baseline':'strict',source:'current loaded scene meshes and current active graph',coordinateConvention:'Three.js Y-up; world scene unit=40 m; partner local scene unit=100 m',coverage:{},limits:['No GPU rendering, browser controls or physical phone performance acceptance.','Roof-wall joins and other intended internal decorative mesh intersections are not treated as navigation failures.','Landmark AABB overlaps are broad-phase candidates, not proof of triangle interpenetration.'],loadErrors:p.errors,providedDiagnostics:p.navigationDiagnostics||p.layoutDiagnostics||null};

// Every terrain vertex, not just a selected landmark or rectangle.
const terrain=p.landscape.terrainMesh.geometry.attributes.position;
let invalidTerrain=0;for(let i=0;i<terrain.count;i++)if(![terrain.getX(i),terrain.getY(i),terrain.getZ(i)].every(Number.isFinite))invalidTerrain++;
report.terrain={vertices:terrain.count,verticesScanned:terrain.count,invalidVertices:invalidTerrain};

// Every visible walk-deck triangle is scanned at its centroid against the final
// rendered terrain interpolation. Bridges may legitimately stand above ground.
let roadMeshes=0,roadInstances=0,triangles=0,walkableTriangles=0,excludedSides=0,degenerateTriangles=0,downwardWinding=0,subsurfaceTriangles=0,buried=0,maxBuried=0;const roadExamples=[];
const A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3(),normal=new T.Vector3(),edgeVector=new T.Vector3(),instanceMatrix=new T.Matrix4(),matrix=new T.Matrix4();
for(const mesh of p.roadMeshes){let visible=true;for(let o=mesh;o;o=o.parent)if(!o.visible)visible=false;if(!visible)continue;mesh.updateWorldMatrix(true,false);roadMeshes++;const g=mesh.geometry,pos=g.attributes.position,idx=g.index,count=idx?idx.count:pos.count,instances=mesh.isInstancedMesh?mesh.count:1;
 for(let j=0;j<instances;j++){roadInstances++;if(mesh.isInstancedMesh){mesh.getMatrixAt(j,instanceMatrix);matrix.multiplyMatrices(mesh.matrixWorld,instanceMatrix);}else matrix.copy(mesh.matrixWorld);
  for(let i=0;i<count;i+=3){A.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(matrix);B.fromBufferAttribute(pos,idx?idx.getX(i+1):i+1).applyMatrix4(matrix);C.fromBufferAttribute(pos,idx?idx.getX(i+2):i+2).applyMatrix4(matrix);normal.subVectors(B,A).cross(edgeVector.subVectors(C,A));triangles++;const area=normal.length();if(area<1e-16){degenerateTriangles++;continue;}const up=Math.abs(normal.y)/area;
   // Vertical embankment faces and curbs are rendered road geometry, but cannot
   // be evaluated as foot surfaces. Include reversed winding top faces because
   // the walk-surface renderer also accepts double-sided geometry.
   if(up<.35){excludedSides++;continue;}if(normal.y<0)downwardWinding++;walkableTriangles++;
   const center=A.clone().add(B).add(C).multiplyScalar(1/3),top=p.deck.height(center.x,center.z);if(top!=null&&top-center.y>.05/UNIT){subsurfaceTriangles++;continue;}const q=center.applyMatrix4(INV),ground=p.landscape.terrainSurfaceY(q.x,q.z),depth=(ground-q.y)*100;
   if(Number.isFinite(depth)&&depth>.05&&!p.landscape.wet(q.x,q.z)){buried++;maxBuried=Math.max(maxBuried,depth);take(roadExamples,{mesh:mesh.name||'walk-deck',instance:j,triangle:i/3,x:q.x,z:q.z,depthM:depth,upwardNormalRatio:up});}
  }
 }
}
report.roads={visibleMeshes:roadMeshes,instances:roadInstances,triangles,trianglesScanned:triangles,walkableTopTriangles:walkableTriangles,subsurfaceTriangles,excludedVerticalOrSteepSides:excludedSides,degenerateTriangles,downwardWindingTopTriangles:downwardWinding,normalYRatioMin:.35,centroidsBuriedOver5cm:buried,maxBuriedM:maxBuried,examples:roadExamples};

// Independently recompute components: don't trust stale component IDs left over
// from a graph that was subsequently pruned by surface or collider constraints.
const graph=p.network,nodes=graph.nodes,active=graph.edges.filter(e=>!e.inactive),parent=nodes.map((_,i)=>i),size=nodes.map(()=>1),index=new Map(nodes.map((n,i)=>[n.id,i]));
const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
function join(a,b){a=find(a);b=find(b);if(a===b)return;if(size[a]<size[b])[a,b]=[b,a];parent[b]=a;size[a]+=size[b];}
for(const e of active)join(index.get(e.a.id),index.get(e.b.id));
const components=new Map();for(let i=0;i<nodes.length;i++){const root=find(i);components.set(root,(components.get(root)||0)+1);}
let edgeSamples=0,unsupported=0,blocked=0,maxHeightError=0,nonfinite=0,steep=0,blockedSweeps=0,sweepsScanned=0,maxSlope=0,scannedLengthM=0;const unsupportedExamples=[],collisionExamples=[],heightExamples=[],steepExamples=[],sweepExamples=[],safeNodes=[];
for(const edge of active){const a=world(edge.a.x,edge.a.z),b=world(edge.b.x,edge.b.z),length=a.distanceTo(b)*UNIT,n=Math.max(1,Math.ceil(length));scannedLengthM+=length;let previous=null;
 for(let i=0;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,deck=p.deck.height(x,z);edgeSamples++;if(!Number.isFinite(deck)){unsupported++;take(unsupportedExamples,{a:edge.a.id,b:edge.b.id,t,x,z});continue;}
 const q=local(x,deck,z),geo={lon:120.140+q.x/(111320*Math.cos(30.245*Math.PI/180)*.01),lat:30.245-q.z/(111320*.01)},reported=p.height(geo.lon,geo.lat),error=Math.abs(reported-deck)*UNIT;
 if(!Number.isFinite(reported)){nonfinite++;}else if(error>maxHeightError)maxHeightError=error;if(error>.05)take(heightExamples,{a:edge.a.id,b:edge.b.id,t,errorM:error});
 const position=new T.Vector3(x,deck+.0005,z);if(!safe(position)){blocked++;take(collisionExamples,{a:edge.a.id,b:edge.b.id,t,x,y:position.y,z});}
 if(previous){const slope=Math.abs(deck-previous.y)/Math.max(1e-9,Math.hypot(x-previous.x,z-previous.z));maxSlope=Math.max(maxSlope,slope);if(slope>1){steep++;take(steepExamples,{a:edge.a.id,b:edge.b.id,t,slope,stepM:Math.abs(deck-previous.y)*UNIT});}if(collision?.segment){sweepsScanned++;if(!collision.segment(new T.Vector3(previous.x,previous.y+.0005,previous.z),position)){blockedSweeps++;take(sweepExamples,{a:edge.a.id,b:edge.b.id,t});}}}previous={x,y:deck,z};
 }
}
for(let i=0;i<nodes.length;i++){const node=nodes[i];if(!node.links?.some(l=>!l.edge.inactive))continue;const q=world(node.x,node.z),y=p.deck.height(q.x,q.z);if(!Number.isFinite(y))continue;q.y=y+.0005;if(safe(q))safeNodes.push({node,world:q,component:find(i)});}
report.graph={nodes:nodes.length,activeEdges:active.length,allEdges:graph.edges.length,edgesScanned:active.length,spacingMaxM:1,lengthScannedM:scannedLengthM,samples:edgeSamples,unsupportedSamples:unsupported,blockedSamples:blocked,nonfiniteHeightSamples:nonfinite,maxFootHeightErrorM:maxHeightError,steepSamplesOver100Percent:steep,maxSlope,steepExamples,collisionSweepsScanned:sweepsScanned,blockedSweeps,sweepExamples,safeNodes:safeNodes.length,components:[...components.values()].sort((a,b)=>b-a),unsupportedExamples,collisionExamples,heightExamples};

// Audit the original visible source polylines as well as the surviving graph.
// Deleting a bad edge must never turn a road-coverage failure into a pass.
function auditSourceRoadCoverage(p,active,world,UNIT,local){
 const take=(a,item)=>{if(a.length<30)a.push(item);};
 const cell=10/UNIT,maxProbeM=15,spacingM=2,edgeGrid=new Map(),edgeData=active.map((edge,id)=>({id,edge,a:world(edge.a.x,edge.a.z),b:world(edge.b.x,edge.b.z)}));
 for(const entry of edgeData){const {a,b}=entry;for(let x=Math.floor(Math.min(a.x,b.x)/cell);x<=Math.floor(Math.max(a.x,b.x)/cell);x++)for(let z=Math.floor(Math.min(a.z,b.z)/cell);z<=Math.floor(Math.max(a.z,b.z)/cell);z++){const key=x+','+z;if(!edgeGrid.has(key))edgeGrid.set(key,[]);edgeGrid.get(key).push(entry);}}
 const projection=(q,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.z-a.z)*dz)/(dx*dx+dz*dz||1)));const x=a.x+dx*t,z=a.z+dz*t;return {x,z,t,distance:Math.hypot(q.x-x,q.z-z)};};
 const inFootprint=(a,b)=>{const distance=Math.hypot(a.x-b.x,a.z-b.z),n=Math.max(1,Math.ceil(distance*UNIT/.5));let previous=null;for(let i=0;i<=n;i++){const t=i/n,y=p.deck.height(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t);if(!Number.isFinite(y)||previous!==null&&Math.abs(y-previous)>Math.max(.24/UNIT,distance/n*1.05))return false;previous=y;}return true;};
 const source=[...p.landscape.paths.map((path,index)=>({path,index,kind:'primary'})),...p.landscape.supplementPaths.map((path,index)=>({path,index:index+p.landscape.paths.length,kind:'supplement'}))];
 const roads=[],failureExamples=[];let samplesTotal=0,samplesWithSurface=0,samplesCovered=0,totalLengthM=0,fullySupported=0,missing=0,disconnected=0,invalid=0;
 for(const entry of source){const path=entry.path.map(([x,z])=>world(x,z)),segments=[],samples=[];let lengthM=0;
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],length=Math.hypot(b.x-a.x,b.z-a.z),count=Math.max(1,Math.ceil(length*UNIT/spacingM));if(length<1e-10)continue;const segment={a,b,length,radiusM:3};segments.push(segment);lengthM+=length*UNIT;
   for(let k=0;k<=count;k++){if(samples.length&&k===0)continue;const t=k/count,q={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,segment:segments.length-1},y=p.deck.height(q.x,q.z);q.hasSurface=Number.isFinite(y);q.surfaceY=y;q.candidates=[];q.nearestM=null;
    // Measure the rendered deck laterally. The 3 m fallback only expands the
    // candidate search; every accepted shift must still cross continuous deck.
    let halfWidthM=0;if(q.hasSurface)for(const side of [-1,1]){let lastY=y;for(let metres=.5;metres<=maxProbeM;metres+=.5){const X=q.x-(b.z-a.z)/length*side*metres/UNIT,Z=q.z+(b.x-a.x)/length*side*metres/UNIT,Y=p.deck.height(X,Z);if(!Number.isFinite(Y)||Math.abs(Y-lastY)>(.24+.5*1.05)/UNIT)break;halfWidthM=Math.max(halfWidthM,metres);lastY=Y;}}
    q.radiusM=Math.max(3,halfWidthM+.25);segment.radiusM=Math.max(segment.radiusM,q.radiusM);const radius=q.radiusM/UNIT,seen=new Set();
    for(let x=Math.floor((q.x-radius)/cell);x<=Math.floor((q.x+radius)/cell);x++)for(let z=Math.floor((q.z-radius)/cell);z<=Math.floor((q.z+radius)/cell);z++)for(const candidate of edgeGrid.get(x+','+z)||[]){if(seen.has(candidate.id))continue;seen.add(candidate.id);const hit=projection(q,candidate.a,candidate.b),distanceM=hit.distance*UNIT;if(q.nearestM===null||distanceM<q.nearestM)q.nearestM=distanceM;if(distanceM<=q.radiusM&&q.hasSurface&&inFootprint(q,hit))q.candidates.push(candidate.id);}
    samples.push(q);
   }
  }
  totalLengthM+=lengthM;samplesTotal+=samples.length;samplesWithSurface+=samples.filter(q=>q.hasSurface).length;samplesCovered+=samples.filter(q=>q.hasSurface&&q.candidates.length).length;
  // Components are restricted to the source road corridor. Joining via a node
  // far away on a different road cannot prove that this polyline is continuous.
  const selected=new Set(samples.flatMap(q=>q.candidates)),localParent=new Map([...selected].map(id=>[id,id])),firstAtNode=new Map(),nodeInside=new Map();
  const localFind=id=>{let root=id;while(localParent.get(root)!==root)root=localParent.get(root);while(id!==root){const next=localParent.get(id);localParent.set(id,root);id=next;}return root;};
  const belongs=node=>{if(nodeInside.has(node.id))return nodeInside.get(node.id);const q=world(node.x,node.z);let best=null,minimum=Infinity,roadSegment=null;for(const segment of segments){const hit=projection(q,segment.a,segment.b);if(hit.distance<minimum){minimum=hit.distance;best=hit;roadSegment=segment;}}const inside=!!best&&minimum*UNIT<=roadSegment.radiusM&&inFootprint(q,best);nodeInside.set(node.id,inside);return inside;};
  for(const id of selected)for(const node of [edgeData[id].edge.a,edgeData[id].edge.b])if(belongs(node)){const previous=firstAtNode.get(node.id);if(previous!==undefined){const a=localFind(previous),b=localFind(id);if(a!==b)localParent.set(b,a);}else firstAtNode.set(node.id,id);}
  let common=null;for(const q of samples){const components=new Set(q.candidates.map(localFind));if(common===null)common=components;else for(const id of common)if(!components.has(id))common.delete(id);}
  const endpointComponents=samples.length?[new Set(samples[0].candidates.map(localFind)),new Set(samples.at(-1).candidates.map(localFind))]:[new Set(),new Set()];
  const endpointsConnected=[...endpointComponents[0]].some(id=>endpointComponents[1].has(id));
  const unsupportedSamples=samples.filter(q=>!q.hasSurface).length,uncoveredSamples=samples.filter(q=>!q.candidates.length).length;
  const status=!segments.length?'invalid':unsupportedSamples||uncoveredSamples?'missing':!common?.size||!endpointsConnected?'disconnected':'fully-supported';
  if(status==='fully-supported')fullySupported++;else if(status==='missing')missing++;else if(status==='disconnected')disconnected++;else invalid++;
  const road={index:entry.index,source:entry.kind,name:p.rows[entry.index]?.road?.name||'',kind:p.rows[entry.index]?.road?.kind||'',lengthM,samples:samples.length,spacingMaxM:spacingM,supportedSurfaceSamples:samples.length-unsupportedSamples,navigationCoveredSamples:samples.length-uncoveredSamples,unsupportedSamples,uncoveredSamples,endpointsConnected,wholePolylineConnected:!!common?.size,status,maxSearchRadiusM:samples.reduce((maximum,q)=>Math.max(maximum,q.radiusM),3)};
  roads.push(road);if(status!=='fully-supported'){const bad=samples.filter(q=>!q.hasSurface||!q.candidates.length).slice(0,3);if(!bad.length&&samples.length)bad.push(samples[0],samples.at(-1));take(failureExamples,{...road,points:bad.map(q=>{const source=local(q.x,q.surfaceY||0,q.z);return {x:q.x,z:q.z,lon:120.140+source.x/(111320*Math.cos(30.245*Math.PI/180)*.01),lat:30.245-source.z/(111320*.01),surface:q.hasSurface,nearbyActiveEdges:q.candidates.length,nearestSearchedActiveDistanceM:q.nearestM,searchRadiusM:q.radiusM};})});}
 }
 return {passed:invalid===0&&missing===0&&disconnected===0,method:'All original primary and supplemental rendered-road polylines, <=2 m samples; continuous rendered-deck lateral footprint; active graph connectivity restricted to each road corridor. Every sample and both endpoints must share a corridor component.',sourceRoads:source.length,sourceRoadsScanned:roads.length,sourceSegments:roads.reduce((n,r)=>n+Math.max(0,(source[r.index]?.path.length||1)-1),0),lengthScannedM:totalLengthM,spacingMaxM:spacingM,samples:samplesTotal,surfaceSupportedSamples:samplesWithSurface,navigationCoveredSamples:samplesCovered,fullySupportedRoads:fullySupported,missingRoads:missing,disconnectedRoads:disconnected,invalidRoads:invalid,roadCoverageRatio:source.length?fullySupported/source.length:0,sampleCoverageRatio:samplesTotal?samplesCovered/samplesTotal:0,footprintProbeStepM:.5,footprintProbeMaxM:maxProbeM,fallbackSearchRadiusM:3,examples:failureExamples,roads};
}
console.log('source-road coverage');report.roadCoverage=auditSourceRoadCoverage(p,active,world,UNIT,local);

// All configured destinations (including piers), and every placed model group.
const destinations=[];
for(const [key,d]of Object.entries(DEST)){
 const supplied=p.navigationTargets instanceof Map?p.navigationTargets.get(key):p.navigationTargets?.[key];
 const wanted=supplied?.anchor?new T.Vector3().fromArray(supplied.anchor):new T.Vector3((d.c[0]-120.142)*96400/40,0,(30.248-d.c[1])*111320/40);
 let best=null,distance=Infinity;
 if(supplied){best=safeNodes.find(s=>s.node.id===supplied.nodeId)||null;if(best)distance=Math.hypot(best.world.x-wanted.x,best.world.z-wanted.z);}
 else for(const s of safeNodes){const dist=Math.hypot(s.world.x-wanted.x,s.world.z-wanted.z);if(dist<distance){distance=dist;best=s;}}
 const declaredPosition=supplied?.position?new T.Vector3().fromArray(supplied.position):null,positionMatches=!declaredPosition||!!best&&declaredPosition.distanceTo(best.world)*UNIT<.05;
 destinations.push({key,name:d.zh,island:!!d.island,source:supplied?'runtime-navigationTargets':'fallback-nearest-node',hasSafeSnap:!!best&&positionMatches,node:best?.node.id,component:best?.component,snapDistanceM:distance*UNIT,positionMatches,anchor:wanted.toArray(),position:best?.world.toArray()});
}
report.destinations=destinations;
const placed=[],containers=new Set(['断桥—白堤—平湖秋月景观','Path-aligned scenic streetscapes','Park shore and hill details','Sandbox stone frame']);
p.root.traverse(o=>{if(o===p.root)return;if((o.isGroup||o.type==='Scene')&&o.name&&!containers.has(o.name))placed.push(o);});
const models=placed.map((model,i)=>{const box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3()),q=local(center.x,box.min.y,center.z),ground=p.landscape.terrainSurfaceY(q.x,q.z);return {index:i,name:model.name,min:box.min.toArray(),max:box.max.toArray(),finite:[...box.min.toArray(),...box.max.toArray()].every(Number.isFinite),baseVsTerrainAtCenterM:(q.y-ground)*100,waterAtCenter:p.landscape.wet(q.x,q.z)};});
const overlaps=[];for(let i=0;i<models.length;i++)for(let j=i+1;j<models.length;j++){let ancestor=placed[j],nested=false;while(ancestor){if(ancestor===placed[i])nested=true;ancestor=ancestor.parent;}ancestor=placed[i];while(ancestor){if(ancestor===placed[j])nested=true;ancestor=ancestor.parent;}if(nested)continue;const a=models[i],b=models[j];const depth=a.min.map((v,k)=>Math.min(a.max[k],b.max[k])-Math.max(v,b.min[k]));if(depth.every(v=>v>0))overlaps.push({a:a.index,b:b.index,names:[a.name,b.name],aabbOverlapM:depth.map(v=>v*UNIT),status:'candidate-only'});}
report.models={placedGroups:models.length,models,overlapCandidates:overlaps,declaredScenicPlacements:[...p.landscape.scenicPlans].flatMap(([name,plan])=>(plan.placements||[]).map(placement=>({name,asset:placement.asset,x:placement.x,z:placement.z}))),programmaticCorridorSites:[...(p.landscape.corridor?.pinghu||[]),...(p.landscape.corridor?.duanqiao||[])].map(site=>({name:site.name,x:site.x,z:site.z,hasNamedModel:placed.some(m=>m.name===site.name)}))};
report.coverage={terrainVertices:1,visibleRoadTriangles:1,activeGraphEdges:1,configuredDestinations:destinations.length+'/'+Object.keys(DEST).length,graphSampleMaxStepM:1,collisionAvailable:!!collision,runtimeTargetsAvailable:!!p.navigationTargets,sourceRoadPolylines:report.roadCoverage.sourceRoadsScanned+'/'+report.roadCoverage.sourceRoads,sourceRoadSampleMaxStepM:2,allMeshTrianglePairs:false};
report.elapsedMs=Math.round(performance.now()-started);
report.passed=report.roadCoverage.passed&&p.errors.length===0&&invalidTerrain===0&&unsupported===0&&blocked===0&&blockedSweeps===0&&nonfinite===0&&maxHeightError<.05&&destinations.every(d=>d.hasSafeSnap)&&report.models.programmaticCorridorSites.every(s=>s.hasNamedModel)&&!!collision&&!!p.navigationTargets;
await mkdir('verification',{recursive:true});await writeFile('verification/global-navigation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,elapsedMs:report.elapsedMs,coverage:report.coverage,roads:triangles,buried,graphEdges:active.length,edgeSamples,unsupported,blocked,blockedSweeps,maxHeightError,roadCoverage:{roads:report.roadCoverage.sourceRoads,fullySupported:report.roadCoverage.fullySupportedRoads,missing:report.roadCoverage.missingRoads,disconnected:report.roadCoverage.disconnectedRoads,samples:report.roadCoverage.samples,covered:report.roadCoverage.navigationCoveredSamples},destinations:destinations.map(d=>({name:d.name,safe:d.hasSafeSnap,distanceM:Math.round(d.snapDistanceM),component:d.component}))}));
if(!baseline&&!report.passed)throw Error('Global navigation audit failed; see verification/global-navigation.json');

