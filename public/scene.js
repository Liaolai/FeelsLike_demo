import {baidiEntry} from './baidi-entry.js';
import {createAvatarOverlay} from './avatar-overlay.js';
import {shortestRoute} from './route-search.js';
import {loadPartnerScene} from './partner-scene.js';
import {createSceneShade,solarRadiation} from './scene-shade.js';
import {solarPosition} from './solar.js';
import * as T from './assets/three.module.js';
import {terrainHeight,waterQuery,buildRoadSurface,roadSurfaceHeight,buildTrees,graphAudit,roadJunctions,isFootpath,roadWidthM,pierHouseLayout} from './spatial.js';
const UNIT=40, LAT=30.248, LON=120.142, PERSON_SCALE=.055;
import {DEST} from './destinations.js';
import {createLeifengPagoda,createPierHouse} from './landmarks.js';
import {walkGraph,walkingInput,turnWalker} from './walking.js';
import {createAvatar,disposeAvatar,avatarSpec} from './avatar.js';
import {loadRiggedAvatar} from './rigged-avatar.js';
export {DEST} from './destinations.js';
const project=p=>new T.Vector3((p[0]-LON)*96400/UNIT,0,-(p[1]-LAT)*111320/UNIT);
const geographic=p=>[p.x*UNIT/96400+LON,LAT-p.z*UNIT/111320];
export async function createWorld(host,{onMove,onRoute,onRoad,onError,onProgress,avatarId='plain',outfit='reference',reduced=false,vision='normal'}={}){
 const report=(stage,pct)=>{try{onProgress?.({stage,pct});}catch{}};
 const breathe=()=>new Promise(r=>setTimeout(r,0));
 const lowTier=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)||(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
 report('连接地图数据…',8);
 const data=await fetch('/assets/westlake.json').then(r=>{if(!r.ok)throw Error('Map unavailable');return r.json();});
 const scene=new T.Scene();scene.background=new T.Color('#e8ede1');scene.fog=new T.Fog('#e8ede1',80,280);
 let renderer;
 try{renderer=new T.WebGLRenderer({antialias:!lowTier,alpha:false,powerPreference:'high-performance'});}catch(e){return createFallback(host,data,onMove,onError,onRoad);}
 renderer.setPixelRatio(Math.min(devicePixelRatio,lowTier?1:1.5));renderer.setSize(host.clientWidth,host.clientHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;host.appendChild(renderer.domElement);
 const camera=new T.PerspectiveCamera(53,host.clientWidth/host.clientHeight,.005,700);
 const hemi=new T.HemisphereLight('#f9f6dd','#577265',2.2);scene.add(hemi);
 const sun=new T.DirectionalLight('#fff5d4',2.4);sun.position.set(-55,100,45);scene.add(sun);
 // Staged boot: paint a cheap lake+ground preview as the FIRST frame, then stream the full world in yielding stages.
 const preview=new T.Group();
 {const ground=new T.Mesh(new T.PlaneGeometry(240,240).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x8d9e75,roughness:1}));ground.position.y=-.05;preview.add(ground);
  for(const ring of (data.water||[])){if(!ring.c||ring.c.length<3)continue;const sh=new T.Shape(ring.c.map(c=>{const p=project(c);return new T.Vector2(p.x,-p.z);}));const g=new T.ShapeGeometry(sh);g.rotateX(-Math.PI/2);const m=new T.Mesh(g,new T.MeshStandardMaterial({color:ring.role==='inner'?0x8d9e75:0x7daea5,roughness:.6}));m.position.y=.02;preview.add(m);}}
 scene.add(preview);
 let previewRAF=0,previewLast=0;const previewStart=performance.now();
 const previewFrame=now=>{previewRAF=requestAnimationFrame(previewFrame);if(now-previewLast<80)return;previewLast=now;if(!window.__flFF){window.__flFF=performance.now();performance.mark('fl-first-frame');}const t=(now-previewStart)/1000;camera.position.set(Math.sin(t*.12)*70,46,Math.cos(t*.12)*70);camera.lookAt(0,0,0);renderer.render(scene,camera);};
 previewRAF=requestAnimationFrame(previewFrame);
 report('展开西湖地形…',22);await breathe();
 cancelAnimationFrame(previewRAF); // freeze preview during heavy build; canvas keeps last frame, progress bar still updates
 const partner=await loadPartnerScene({deferShade:true,onProgress:s=>report(s,s==='loading'?26:s==='landscape'?46:s==='models'?66:80)});scene.add(partner.root);await breathe();
 const tower=partner.focus.get('雷峰塔');if(tower){const point=tower.getWorldPosition(new T.Vector3());DEST.leifeng.c=geographic(point);}
 data.roads=partner.rows.map(r=>({...r.road,nodes:r.ids||r.c.map((_,i)=>'partner:'+r.index+':'+i)}));
 renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=T.PCFSoftShadowMap;
 sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.00005;sun.shadow.normalBias=.004;
 scene.add(sun.target);
 let lakeWind=2,sunlightWeather=null,shadowTime=null,lastSunUpdate=0,solar=solarPosition();
 const groundMat=new T.MeshStandardMaterial(),lakeMat=new T.MeshStandardMaterial(),roadMat=new T.MeshStandardMaterial(),pathMat=new T.MeshStandardMaterial(),buildingMat=new T.MeshStandardMaterial();
 const waterTime={value:0},inWater=waterQuery(data),height=partner.height;
 const heightAtPosition=p=>height(...geographic(p));
 function at(c,offset=0){const p=project(c);p.y=height(...c)+offset;return p;}
 const nodes=new Map(),edges=new Map();function addEdge(a,b){if(!edges.has(a))edges.set(a,new Set());edges.get(a).add(b);}
 for(const point of partner.network.nodes){const donor=partner.landscape.scene.localToWorld(new T.Vector3(point.x,0,point.z)),c=geographic(donor);nodes.set(point.id,{c,component:point.component,safe:point.walkable!==false,position:new T.Vector3(donor.x,point.worldY??height(...c)+.0005,donor.z)});}
 for(const edge of partner.network.edges){if(edge.inactive)continue;addEdge(edge.a.id,edge.b.id);addEdge(edge.b.id,edge.a.id);}

 const roadsGroup=partner.root,roadHighlight=new T.Group();scene.add(roadHighlight);
 function clearRoad(){for(const m of [...roadHighlight.children]){m.geometry.dispose();m.material.dispose();roadHighlight.remove(m);}onRoad?.(null);}
 function selectRoad(road){clearRoad();roadHighlight.add(new T.Line(new T.BufferGeometry().setFromPoints(road.c.map(c=>at(c,.025))),new T.LineBasicMaterial({color:'#357fa3'})));onRoad?.(road);}
 const pagoda=partner.focus.get('雷峰塔')||new T.Object3D();
 // Keep every existing pier destination and its recognizable marker house.
 const pierHouses=partner.pierHouses;
 partner.shade=createSceneShade(partner.root);
 data.sceneDiagnostics={source:'feelslike-westlake-stability-latest',...partner.landscape.contextStats,shadowGeometryCount:partner.shade.count,assetErrors:partner.errors};
 function surfaceHeight(c){return height(...c)+.0005;}
 function nearest(c,component){const v=project(c);let best=null,d=Infinity;for(const[id,n]of nodes){if(!edges.has(id)||!n.safe||(component!=null&&n.component!==component))continue;const dist=n.position.distanceToSquared(v.clone().setY(n.position.y));if(dist<d&&partner.deck.height(n.position.x,n.position.z)!=null){d=dist;best=id;}}return best;}
 function applyContact(p,before,result){let point=before.position;for(const segment of result.segments||[p.position]){const hit=partner.contact.trace(point,segment);if(!hit.ok){host.dataset.walkBlock=hit.reason;return false;}point=hit.position;}p.position.y=point.y;host.dataset.walkBlock='';return true;}
 async function personModel(id,wear,allowFallback=false){const model=new T.Group();let body;try{body=await loadRiggedAvatar(id,UNIT);}catch(e){if(!allowFallback)throw e;body=createAvatar(id,wear,UNIT);onError?.('avatar');}host.dataset.avatarModel=body.userData.source||'procedural';model.add(body);body.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});const ring=new T.Mesh(new T.RingGeometry(.45/UNIT,.55/UNIT,32),new T.MeshBasicMaterial({color:'#447c69',side:T.DoubleSide,transparent:true,opacity:.8}));ring.rotation.x=-Math.PI/2;ring.position.y=.004;model.add(ring);return {model,body,ring,limbs:body.userData.limbs};}
 const bridgeEntry=baidiEntry(partner.network,partner.landscape.corridor),destinationNode=key=>key==='bridge'&&bridgeEntry?bridgeEntry.nodeId:partner.navigationTargets[key]?.nodeId;
 report('加载人物…',90);await breathe();
 const initialNode=destinationNode('bridge')??nearest(DEST.bridge.c),pos=nodes.get(initialNode).position.clone(),rig=await personModel(avatarId,outfit,true);
 rig.model.position.copy(pos);scene.add(rig.model);
 const people=[{id:'me',name:'我',en:'Me',color:'#447c69',node:initialNode,position:pos,...rig,heading:bridgeEntry?.heading??Math.PI*.7,activity:'walk',route:[],moving:false,target:null,edge:null}];
 let appearanceRequest=0;
 async function setAppearance(id,wear='reference'){const request=++appearanceRequest,nextId=avatarSpec(id).id,replacement=await personModel(nextId,wear);if(request!==appearanceRequest){disposeAvatar(replacement.model);return false;}avatarId=nextId;outfit=wear;const p=people[0];scene.remove(p.model);disposeAvatar(p.model);Object.assign(p,replacement);p.model.position.copy(p.position);p.model.rotation.y=p.heading;scene.add(p.model);return true;}

 let selected=0,mode='follow',distance=1.65,yaw=people[0].heading+Math.PI,tilt=.1,auto=false,last=performance.now(),phase=0,lang='zh',disposed=false,renderVisible=true,snapCamera=true,focusLandmark=null,focusHeight=.85;
 const labels=document.createElement('div');labels.className='landmark-labels';host.parentElement.append(labels);
 let expressions={},overhead={};const bubbleLayer=document.createElement('div');bubbleLayer.className='avatar-bubbles';host.parentElement.append(bubbleLayer);const bubbles=people.map(person=>{const overlay=createAvatarOverlay();bubbleLayer.append(overlay.el);return {person,...overlay};});
 function refreshBubbles(){for(const b of bubbles)b.update({expression:expressions[b.person.id],...overhead[b.person.id]},lang);}

 const landmarkLabels=Object.entries(DEST).map(([key,d])=>{const button=document.createElement('button');button.className='landmark-label';button.dataset.landmark=key;button.dataset.kind=d.kind||'landmark';button.textContent=(d.kind==='pier'?'⛵ ':'')+d.zh;button.title=d.zh+' / '+d.en;labels.append(button);return {key,d,button,position:d.kind==='pier'?pierHouses.get(key).getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.22,0)):at(d.c,.13)};});
 const orbitTarget=new T.Vector3(),targetPos=new T.Vector3(),look=new T.Vector3();const routeGroup=new T.Group();scene.add(routeGroup);
 const pointsGroup=new T.Group();scene.add(pointsGroup);pointsGroup.visible=false;
 for(const c of [[120.145,30.264],[120.145,30.231],[120.123,30.249]]){const marker=new T.Mesh(new T.CylinderGeometry(.2,.2,5,8),new T.MeshBasicMaterial({color:'#698eaf',transparent:true,opacity:.5}));marker.position.copy(at(c,2.5));pointsGroup.add(marker);}
 function state(){return people.map(p=>{const c=geographic(p.position);return {id:p.id,lon:c[0],lat:c[1],activity:p.activity};});}
 const shortest=(start,end)=>shortestRoute(nodes,edges,start,end);
 function drawRoute(p){routeGroup.clear();if(!p.route.length)return;const v=[p.position,...p.route.map(id=>nodes.get(id).position)].map(q=>q.clone().add(new T.Vector3(0,.07,0)));const g=new T.BufferGeometry().setFromPoints(v);routeGroup.add(new T.Line(g,new T.LineBasicMaterial({color:'#b47a36'})));}
 function routeTo(key){const dest=DEST[key];if(!dest)return;const p=people[selected];p.target=null;p.edge=null;p.steeringHeading=null;p.roadHeading=null;p.arrivedFrom=null;p.node=nearest(geographic(p.position));p.position.copy(nodes.get(p.node).position);const target=destinationNode(key)??nearest(dest.c,nodes.get(p.node).component);p.route=shortest(p.node,target);auto=!!p.route.length&&!reduced;drawRoute(p);onRoute?.({ok:!!p.route.length,paused:reduced,destinationKey:key,destination:dest[lang],meters:p.route.reduce((a,id,i)=>a+nodes.get(id).position.distanceTo(i?nodes.get(p.route[i-1]).position:p.position)*UNIT,0)});}
 function jumpTo(key){const d=DEST[key];if(!d)return;const p=people[selected];auto=false;held.clear();p.route=[];p.target=null;p.edge=null;p.moving=false;p.node=destinationNode(key)??nearest(d.c);p.position.copy(nodes.get(p.node).position);p.heading=key==='bridge'&&bridgeEntry?bridgeEntry.heading:Math.PI*.55;p.steeringHeading=null;p.roadHeading=null;p.arrivedFrom=null;p.model.position.copy(p.position);drawRoute(p);mode='follow';focusLandmark=key==='leifeng'?pagoda:pierHouses.get(key)||null;focusHeight=key==='leifeng'?.85:.09;distance=focusLandmark?(key==='leifeng'?3.8:1.25):1.65;tilt=focusLandmark ? .55 : .1;yaw=focusLandmark?Math.atan2(p.position.x-focusLandmark.getWorldPosition(new T.Vector3()).x,p.position.z-focusLandmark.getWorldPosition(new T.Vector3()).z):p.heading+Math.PI;snapCamera=true;onMove?.(state());onRoute?.({arrived:true,destinationKey:key,destination:d[lang]});}
 const held=new Set();
 function resetFocus(){if(focusLandmark){focusLandmark=null;distance=1.65;tilt=.1;}}
 function cancelAuto(){const wasAuto=auto;auto=false;people[selected].route=[];if(wasAuto)onRoute?.({stopped:true});}
 function pauseTravel(){held.clear();cancelAuto();for(const p of people)p.moving=false;}
 const down=e=>{const key=e.key.toLowerCase();if(['INPUT','SELECT','TEXTAREA','BUTTON','SUMMARY','A'].includes(document.activeElement.tagName)||document.querySelector('dialog[open]'))return;if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){e.preventDefault();cancelAuto();held.add(key);}};
 const up=e=>{held.delete(e.key.toLowerCase());if(!walkingInput(held).direction&&!auto)people[selected].moving=false;};
 const blur=()=>pauseTravel(),visibility=()=>{if(document.hidden)pauseTravel();},focus=()=>{if(document.activeElement!==host)held.clear();};
 window.addEventListener('keydown',down);window.addEventListener('keyup',up,true);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);document.addEventListener('focusin',focus);
 let drag=null,moved=false;const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};moved=false;canvas.setPointerCapture(e.pointerId);host.focus();});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)moved=true;yaw-=dx*.006;tilt=Math.max(-.35,Math.min(.9,tilt+dy*.004));drag={x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{drag=null;if(!moved){const r=canvas.getBoundingClientRect(),mouse=new T.Vector2((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1),ray=new T.Raycaster();ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(partner.roadMeshes,true)[0];if(hit){const road=partner.pickRoad(hit.point);if(road)selectRoad(road);}else clearRoad();}});
 canvas.addEventListener('pointercancel',()=>{drag=null;held.clear();});
 canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(.35,Math.min(27,distance*Math.exp(e.deltaY*.0015)));},{passive:false});
 const resize=new ResizeObserver(()=>{if(disposed)return;const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);});resize.observe(host);
 let moveReport=0,chunkReport=0;
 function frame(now){if(disposed)return;requestAnimationFrame(frame);const dt=Math.min(.06,(now-last)/1000);last=now;if(!renderVisible)return;const p=people[selected];phase+=dt*9;if(!reduced)waterTime.value+=dt*(.35+Math.min(lakeWind,12)*.12);
  const input=walkingInput(held);if(input.turn){resetFocus();turnWalker(p,input.turn*dt*1.7);yaw+=input.turn*dt*1.7;}
  const travel=p.activity!=='rest'&&!document.querySelector('dialog[open]')&&(auto||input.direction);
  if(travel){resetFocus();const before={position:p.position.clone(),node:p.node,target:p.target,edge:p.edge?[...p.edge]:null,steeringHeading:p.steeringHeading,roadHeading:p.roadHeading,arrivedFrom:p.arrivedFrom,route:[...p.route]};const result=walkGraph(p,nodes,edges,{direction:input.direction,route:auto,steering:!!input.turn,distance:dt*(p.activity==='run'?.8:.42)});if(result.moved){if(applyContact(p,before,result)){}else{p.position.copy(before.position);Object.assign(p,{node:before.node,target:before.target,edge:before.edge,steeringHeading:before.steeringHeading,roadHeading:before.roadHeading,arrivedFrom:before.arrivedFrom,route:before.route,moving:false});auto=false;}}if(auto&&p.target==null&&!p.route.length){auto=false;drawRoute(p);onRoute?.({arrived:true});}}
  else p.moving=false;
  host.dataset.moving=String(p.moving);
  for(let i=0;i<people.length;i++){const q=people[i];q.model.position.copy(q.position);q.model.rotation.y=q.heading;q.ring.visible=i===selected;q.model.visible=!(i===selected&&mode==='eye');q.body.userData.animate?.(dt,q.moving,q.activity,reduced);for(let j=0;j<q.limbs.length;j++)q.limbs[j].rotation.x=q.moving&&!reduced?Math.sin(phase+(j%2)*Math.PI+(j>=2?Math.PI:0))*.35:0;}
  if(p.moving&&!drag&&mode!=='map'){const desired=p.heading+(mode==='eye'?0:Math.PI),turn=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));yaw+=turn*(reduced?1:1-Math.exp(-dt*2));}
  if(mode==='map'){orbitTarget.set(0,0,0);targetPos.set(Math.sin(yaw)*80,105+tilt*35,Math.cos(yaw)*85);look.set(0,0,0);}
  else if(mode==='eye'){const direction=new T.Vector3(Math.sin(yaw),tilt*.4,Math.cos(yaw));targetPos.copy(p.position).add(new T.Vector3(0,.67*PERSON_SCALE,0));look.copy(targetPos).add(direction.multiplyScalar(8));}
  else{targetPos.copy(p.position).add(new T.Vector3(Math.sin(yaw)*distance,distance*(.4+tilt*.3),Math.cos(yaw)*distance));targetPos.y=Math.max(targetPos.y,height(...geographic(targetPos))+.10);look.copy(focusLandmark?focusLandmark.getWorldPosition(new T.Vector3()):p.position).add(new T.Vector3(0,focusLandmark ? focusHeight : .6*PERSON_SCALE,0));}
  if(reduced||mode==='eye'||snapCamera){camera.position.copy(targetPos);snapCamera=false;}else camera.position.lerp(targetPos,1-Math.exp(-dt*7));camera.lookAt(look);
  if(now-lastSunUpdate>1000){lastSunUpdate=now;solar=solarPosition(shadowTime??Date.now());const focus=p.position,dir=new T.Vector3().fromArray(solar.direction);sun.target.position.copy(focus);sun.position.copy(focus).addScaledVector(dir,120);const radiation=solarRadiation(sunlightWeather,solar,{preview:shadowTime!=null,time:shadowTime??Date.now()});sun.intensity=solar.daylight?2.4*Math.min(1,radiation.total/700):0;hemi.intensity=solar.daylight?1.6:.5;const radius=mode==='map'?100:7;Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.01,far:260});sun.shadow.camera.updateProjectionMatrix();renderer.shadowMap.needsUpdate=true;partner.setLight(solar,solar.daylight?1:.1);}
  if(!reduced)partner.update(now/1000,lakeWind/8,new Date(shadowTime??Date.now()).getMonth()+1,!solar.daylight);
  renderer.render(scene,camera);
  host.parentElement.dataset.camera=mode;const occupied=[];for(const l of landmarkLabels){const v=l.position.clone().project(camera),x=(v.x*.5+.5)*host.clientWidth,y=(-v.y*.5+.5)*host.clientHeight;const near=mode==='map'||l.position.distanceTo(p.position)<8,labelWidth=l.d[lang].length*(lang==='en'?7.4:14)+38;const visible=near&&v.z>-1&&v.z<1&&(mode==='map'||l.d.kind==='pier'||l.position.distanceTo(p.position)>1.5)&&x>labelWidth/2+8&&x<host.clientWidth-labelWidth/2-8&&y>75&&y<host.clientHeight-80&&!occupied.some(q=>Math.abs(q.x-x)<(q.width+labelWidth)/2+10&&Math.abs(q.y-y)<38);l.button.hidden=!visible;if(visible){l.button.style.left=x+'px';l.button.style.top=y+'px';l.button.textContent=(l.d.kind==='pier'?'⛵ ':'')+l.d[lang];occupied.push({x,y,width:labelWidth});}}
  for(const bubble of bubbles){const q=bubble.person,v=q.position.clone().add(new T.Vector3(0,.77*PERSON_SCALE+.018,0)).project(camera),x=(v.x*.5+.5)*host.clientWidth,y=(-v.y*.5+.5)*host.clientHeight;bubble.place(x,y,host.clientWidth,host.clientHeight,v.z>=-1&&v.z<=1&&x>=0&&x<=host.clientWidth&&y>=0&&y<=host.clientHeight&&!(mode==='eye'&&q===p));}
  if(now-moveReport>250){moveReport=now;onMove?.(state());}
  if(now-chunkReport>500){chunkReport=now;applyChunk(...chunkOf(p.position));}
 }
 cancelAnimationFrame(previewRAF);scene.remove(preview);preview.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
 report('准备就绪',100);
 performance.mark('fl-ready');window.__flBoot={firstFrameMs:window.__flFF,readyMs:performance.now(),lowTier,drawCalls:()=>renderer.info.render.calls,memory:()=>renderer.info.memory,pause:()=>{renderVisible=false;},resume:()=>{renderVisible=true;snapCamera=true;}};
 camera.position.set(15,15,15);requestAnimationFrame(frame);
 host.querySelector('#loading')?.remove();
 function setVision(v){vision=v;for(const mesh of partner.roadMeshes){mesh.material.color.set(v==='mono'?'#bd883a':v==='accessible'?'#c9aa76':'#d7ccb4');}for(const mesh of partner.landscape.waterMeshes||[]){mesh.material.userData.vision=v;}lakeMat.color.set(v==='normal'?'#7daea5':v==='mono'?'#7ba9ba':'#84aec5');roadMat.color.set(v==='mono'?'#ad7020':'#ece7ce');pathMat.color.set(v==='mono'?'#ad7020':v==='normal'?'#e5cba1':'#b58430');}
 setVision(vision);
 // Basic perf: static scenery receives but does not cast shadows (avatar still casts); cuts the shadow pass.
 partner.root.traverse(o=>{if(o.isMesh)o.castShadow=false;});
 // Chunked detail: only the active chunk renders decorative meshes; other chunks stay empty.
 // Nav deck / collision / shade are precomputed from full geometry at boot, so visibility-only chunking never breaks walking.
 const keep=new Set([...partner.roadMeshes,...(partner.landscape.waterMeshes||[]),partner.landscape.terrainMesh]);
 const rootBox=new T.Box3().setFromObject(partner.root);
 const CELL=Math.max(1,(rootBox.max.x-rootBox.min.x)/4),CELLZ=Math.max(1,(rootBox.max.z-rootBox.min.z)/4);
 const chunkOf=v=>[Math.floor((v.x-rootBox.min.x)/CELL),Math.floor((v.z-rootBox.min.z)/CELLZ)];
 const buckets=new Map();const wp=new T.Vector3();
 partner.root.traverse(o=>{if(!o.isMesh&&!o.isInstancedMesh)return;if(o.isInstancedMesh)return;if(/^Batched/.test(o.name||''))return;if(keep.has(o))return;for(let n=o;n;n=n.parent){if(n.name==='Sandbox stone frame')return;}o.getWorldPosition(wp);const k=chunkOf(wp).join(',');if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(o);});
 let activeChunk=null;
 function applyChunk(cx,cz){const k=cx+','+cz;if(k===activeChunk)return;activeChunk=k;for(const [key,list] of buckets){const on=key===k;for(const o of list)o.visible=on;}}
 applyChunk(...chunkOf(people[0].position));
 return {data,state,people,jumpTo,clearRoad,setAppearance,setVisible(v){renderVisible=v;if(!v)pauseTravel();else snapCamera=true;},setExpressions(value){expressions=value;refreshBubbles();},setOverhead(value){overhead=value;refreshBubbles();},setShadowTime(t){shadowTime=Number.isFinite(t)?t:null;lastSunUpdate=0;},shadeContext(){const p=people[selected];return partner.shade.sample(p.position.toArray(),shadowTime??Date.now());},setWeather(w){sunlightWeather=w;lakeWind=Number.isFinite(w?.wind_speed_10m)?w.wind_speed_10m:2;},select(i){pauseTravel();selected=i;focusLandmark=null;distance=1.65;tilt=.1;snapCamera=true;drawRoute(people[i]);yaw=people[i].heading+(mode==='eye'?0:Math.PI);onMove?.(state());},setCamera(v){mode=v;focusLandmark=null;distance=1.65;tilt=.1;if(mode!=='map')yaw=people[selected].heading+(mode==='eye'?0:Math.PI);snapCamera=true;held.clear();},setActivity(v){people[selected].activity=v;if(v==='rest')pauseTravel();},setReduced(v){reduced=v;if(v)pauseTravel();},setVision,setLang(v){lang=v;refreshBubbles();},setLayer(v){pointsGroup.visible=v==='weather';roadsGroup.visible=true;for(const mesh of partner.roadMeshes)mesh.material.color.set(v==='roads'?'#8b7044':vision==='mono'?'#bd883a':vision==='accessible'?'#c9aa76':'#d7ccb4');},routeTo,step(dir){const p=people[selected];cancelAuto();resetFocus();if(dir==='left'){turnWalker(p,.35);yaw+=.35;}else if(dir==='right'){turnWalker(p,-.35);yaw-=.35;}else if(p.activity!=='rest'){const before={position:p.position.clone(),node:p.node,target:p.target,edge:p.edge?[...p.edge]:null,steeringHeading:p.steeringHeading,roadHeading:p.roadHeading,arrivedFrom:p.arrivedFrom};const result=walkGraph(p,nodes,edges,{direction:dir==='back'?-1:1,distance:4/UNIT});if(applyContact(p,before,result)){}else{p.position.copy(before.position);Object.assign(p,{node:before.node,target:before.target,edge:before.edge,steeringHeading:before.steeringHeading,roadHeading:before.roadHeading,arrivedFrom:before.arrivedFrom});}p.moving=false;onMove?.(state());}},stop(){pauseTravel();drawRoute(people[selected]);},destroy(){disposed=true;resize.disconnect();labels.remove();bubbles.forEach(b=>b.dispose());bubbleLayer.remove();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up,true);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('focusin',focus);renderer.dispose();}};
}
function createFallback(host,data,onMove,onError,onRoad){
 host.querySelector('#loading').textContent='点击地图，开始漫步 / Tap the map to take a walk';
 const canvas=document.getElementById('fallback');canvas.hidden=false;const ctx=canvas.getContext('2d');const [w,s,e,n]=data.bbox;
 const people=[{id:'me',lon:DEST.bridge.c[0],lat:DEST.bridge.c[1],activity:'walk',color:'#447c69'}];let selected=0,fallbackLang='zh',fallbackExpressions={},fallbackOverhead={};const fallbackLayer=document.createElement('div');fallbackLayer.className='avatar-bubbles';host.parentElement.append(fallbackLayer);const card=createAvatarOverlay();fallbackLayer.append(card.el);
 function refreshFallback(){card.update({expression:fallbackExpressions.me,...fallbackOverhead.me},fallbackLang);const r=canvas.getBoundingClientRect(),p=people[0];card.place((p.lon-w)/(e-w)*r.width,(n-p.lat)/(n-s)*r.height-12,r.width,r.height);}
 function draw(){const r=canvas.getBoundingClientRect();canvas.width=r.width*devicePixelRatio;canvas.height=r.height*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);const W=r.width,H=r.height,point=p=>[(p[0]-w)/(e-w)*W,(n-p[1])/(n-s)*H];ctx.fillStyle='#dce2cc';ctx.fillRect(0,0,W,H);for(const ring of data.water){ctx.beginPath();ring.c.forEach((p,i)=>{const q=point(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.fillStyle=ring.role==='inner'?'#dce2cc':'#8bb5af';ctx.fill();}ctx.lineWidth=1;ctx.strokeStyle='#eee8d0';for(const road of data.roads){ctx.beginPath();road.c.forEach((p,i)=>{const q=point(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.stroke();}for(let i=0;i<people.length;i++){const p=people[i],q=point([p.lon,p.lat]);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(...q,i===selected?7:5,0,Math.PI*2);ctx.fill();}refreshFallback();onMove?.(people);}
 canvas.addEventListener('click',ev=>{const r=canvas.getBoundingClientRect(),c=[w+ev.offsetX/r.width*(e-w),n-ev.offsetY/r.height*(n-s)];let best,bestRoad,dist=Infinity;for(const road of data.roads.filter(r=>r.walk))for(const q of road.c){const d=Math.hypot(q[0]-c[0],q[1]-c[1]);if(d<dist){dist=d;best=q;bestRoad=road;}}if(best){people[selected].lon=best[0];people[selected].lat=best[1];draw();onRoad?.(bestRoad);}});new ResizeObserver(draw).observe(canvas);draw();onError?.('WebGL');
 return {data,people,state:()=>people,setVisible(){},setAppearance(){},clearRoad(){onRoad?.(null);},jumpTo(key){const d=DEST[key];if(!d)return;let best,dist=Infinity;for(const road of data.roads.filter(r=>r.walk))for(const c of road.c){const delta=Math.hypot(c[0]-d.c[0],c[1]-d.c[1]);if(delta<dist){dist=delta;best=c;}}if(best){people[selected].lon=best[0];people[selected].lat=best[1];draw();}},select(i){selected=i;draw();},setCamera(){},setActivity(v){people[selected].activity=v;draw();},setReduced(){},setVision(){},setLang(v){fallbackLang=v;refreshFallback();},setExpressions(v){fallbackExpressions=v;refreshFallback();},setOverhead(v){fallbackOverhead=v;refreshFallback();},setLayer(){},routeTo(){onError?.('route2d');},step(){onError?.('WebGL');},stop(){}};
}
