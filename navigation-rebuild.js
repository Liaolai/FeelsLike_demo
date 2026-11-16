import * as T from './assets/three.module.js';
import {DEST} from './destinations.js';

// Rebuild the road graph against the same surfaces and body collider used by movement.
// No connection is allowed through unsupported water, a wall, or a large height step.
export function createNavigationGuard(deck,collision){
 const UNIT=40,SOLE=.0005;
 const cache=new Map();
 function supported(p){if(!p)return false;for(const [dx,dz] of [[.16/UNIT,0],[-.16/UNIT,0],[0,.16/UNIT],[0,-.16/UNIT]]){const y=deck.height(p.x+dx,p.z+dz,p.y-SOLE);if(y==null||Math.abs(y+SOLE-p.y)>.24/UNIT)return false;}return true;}
 function surface(x,z){const key=Math.round(x*100000)+','+Math.round(z*100000);if(cache.has(key))return cache.get(key);const y=deck.height(x,z);const p=y==null?null:new T.Vector3(x,y+SOLE,z);const result=p&&!collision.blocked(p)?p:null;if(cache.size>100000)cache.clear();cache.set(key,result);return result;}
 function evaluate(a,b){const length=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(length/(collision.radius*.8)));let previous=null;
  for(let i=0;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=deck.height(x,z);if(y==null)return {reason:'no-surface',at:[x,0,z]};const p=surface(x,z);if(!p)return {reason:'body-collision',at:[x,y+SOLE,z]};
   if(previous&&Math.abs(p.y-previous.y)>Math.max(.24/UNIT,length/n*1.2))return {reason:'height-step',at:p.toArray(),stepM:Math.abs(p.y-previous.y)*UNIT,slope:Math.abs(p.y-previous.y)/(length/n||1)};
   if(!supported(p))return {reason:'sole-support',at:p.toArray()};previous=p;
  }return null;
 }
 const canWalk=(a,b)=>evaluate(a,b)===null;
 return {surface,supported,canWalk,evaluate,clear:()=>cache.clear()};
}
export function rebuildNavigation({network,root,deck,collision,focus=new Map(),onProgress=()=>{}}){
 const UNIT=40,world=n=>root.localToWorld(new T.Vector3(n.x,0,n.z)),inverse=root.matrixWorld.clone().invert();
 const diagnostics={nodesRelocated:0,edgesRerouted:0,edgesRejected:0,connectionsRepaired:0,rejectedReasons:{},rejectedExamples:[],collision:collision.counts};
 const guard=createNavigationGuard(deck,collision),{surface,supported,canWalk,evaluate}=guard;
 function setNode(node,p){const q=p.clone().applyMatrix4(inverse);node.x=q.x;node.z=q.z;node.worldY=p.y;node.worldPosition=p;}
 for(const node of network.nodes){const p=world(node);let found=surface(p.x,p.z);if(!found){outer:for(let r=.25;r<=4;r+=.25)for(let k=0;k<16;k++){const a=k*Math.PI/8,candidate=surface(p.x+Math.cos(a)*r/UNIT,p.z+Math.sin(a)*r/UNIT);if(candidate){found=candidate;diagnostics.nodesRelocated++;break outer;}}}if(found)setNode(node,found);else{node.worldPosition=null;node.worldY=null;}}
 const connect=(a,b)=>{const edge={a,b,length:Math.hypot(a.x-b.x,a.z-b.z),repaired:true};network.edges.push(edge);a.links.push({node:b,edge});b.links.push({node:a,edge});return edge;};
 function detour(a,b){
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<1e-9||length>25/UNIT)return null;
  for(const distance of [.5,1,1.5,2,3,4])for(const side of [-1,1]){const x=-dz/length*distance/UNIT*side,z=dx/length*distance/UNIT*side;
   const points=[a,surface(a.x+x,a.z+z),surface(b.x+x,b.z+z),b];if(points.every(Boolean)&&points.slice(1).every((q,i)=>canWalk(points[i],q)))return points.slice(1,-1);
  }
  // A bounded 0.5 m grid handles corners around columns and irregular walls.
  const step=.5/UNIT,pad=4/UNIT,minX=Math.min(a.x,b.x)-pad,minZ=Math.min(a.z,b.z)-pad,maxX=Math.max(a.x,b.x)+pad,maxZ=Math.max(a.z,b.z)+pad;
  const start={p:a,g:0,key:'start'},open=[start],visited=new Map([['start',start]]);let visits=0;
  if(!supported(a)||!supported(b))return null;
  while(open.length&&visits++<256){open.sort((u,v)=>(u.g+u.p.distanceTo(b))-(v.g+v.p.distanceTo(b)));const cur=open.shift();if(cur.p.distanceTo(b)<step*1.5&&canWalk(cur.p,b)){const result=[];for(let c=cur;c.parent;c=c.parent)result.push(c.p);return result.reverse();}
   for(const [ix,iz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=Math.round((cur.p.x-minX)/step)+ix,z=Math.round((cur.p.z-minZ)/step)+iz,key=x+','+z;if(visited.has(key))continue;const X=minX+x*step,Z=minZ+z*step;if(X<minX||X>maxX||Z<minZ||Z>maxZ)continue;const p=surface(X,Z);if(!p||!canWalk(cur.p,p))continue;const next={p,key,g:cur.g+cur.p.distanceTo(p),parent:cur};visited.set(key,next);open.push(next);}
  }return null;
 }
 onProgress('navigation nodes '+network.nodes.length);const original=[...network.edges];let processed=0;
 for(const edge of original){if(++processed%10000===0)onProgress('navigation edges '+processed+'/'+original.length);if(edge.inactive)continue;const a=edge.a.worldPosition,b=edge.b.worldPosition;
  if(a&&b&&canWalk(a,b)){edge.length=Math.hypot(edge.a.x-edge.b.x,edge.a.z-edge.b.z);continue;}
  edge.inactive=true;edge.a.links=edge.a.links.filter(l=>l.edge!==edge);edge.b.links=edge.b.links.filter(l=>l.edge!==edge);
  const path=a&&b?detour(a,b):null;if(path){let prev=edge.a;for(const p of path){const node={id:network.nodes.length,links:[],component:-1};setNode(node,p);network.nodes.push(node);connect(prev,node);prev=node;}connect(prev,edge.b);diagnostics.edgesRerouted++;}else {diagnostics.edgesRejected++;const failure=a&&b?evaluate(a,b):{reason:'no-safe-endpoint'};const reason=failure?.reason||'detour-unresolved';diagnostics.rejectedReasons[reason]=(diagnostics.rejectedReasons[reason]||0)+1;if(diagnostics.rejectedExamples.length<60)diagnostics.rejectedExamples.push({a:edge.a.id,b:edge.b.id,...failure});}
 }
 // Rejoin crossing/adjacent rendered strips after obstacle rerouting. Every new
 // connection is supported by the real deck and checked with the same capsule.
 const parents=network.nodes.map(n=>n.id),find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;},join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[b]=a;};
 for(const e of network.edges)if(!e.inactive)join(e.a.id,e.b.id);
 const cell=6/UNIT,buckets=new Map();for(const n of network.nodes){if(!n.worldPosition||!n.links.length)continue;const p=n.worldPosition,key=Math.floor(p.x/cell)+','+Math.floor(p.z/cell);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(n);}
 for(const n of network.nodes){if(!n.worldPosition||!n.links.length)continue;const p=n.worldPosition,X=Math.floor(p.x/cell),Z=Math.floor(p.z/cell);for(let x=X-1;x<=X+1;x++)for(let z=Z-1;z<=Z+1;z++)for(const other of buckets.get(x+','+z)||[]){if(n===other||find(n.id)===find(other.id)||p.distanceToSquared(other.worldPosition)>cell*cell)continue;if(canWalk(p,other.worldPosition)){connect(n,other);join(n.id,other.id);diagnostics.connectionsRepaired++;}}}
 // Every component is recomputed after actual geometry filtering, never inherited.
 const components=[];for(const n of network.nodes)n.component=-1;
 for(const n of network.nodes){if(n.component!==-1||!n.links.length)continue;const component=components.length,stack=[n];n.component=component;let count=0;while(stack.length){const p=stack.pop();count++;for(const l of p.links)if(!l.edge.inactive&&l.node.component===-1){l.node.component=component;stack.push(l.node);}}components.push(count);}
 network.mainComponent=components.indexOf(Math.max(0,...components));
 diagnostics.components=components.slice().sort((a,b)=>b-a);diagnostics.activeEdges=network.edges.filter(e=>!e.inactive).length;
 const targets={};for(const [key,d]of Object.entries(DEST)){let anchor=new T.Vector3((d.c[0]-120.142)*96400/UNIT,0,(30.248-d.c[1])*111320/UNIT);
  if(key==='leifeng'||key==='autumn'){const model=focus.get(d.zh);if(model)anchor=model.getWorldPosition(new T.Vector3());}
  const candidates=network.nodes.filter(n=>n.component>=0&&n.worldPosition).map(node=>({node,d:Math.hypot(node.worldPosition.x-anchor.x,node.worldPosition.z-anchor.z)})).sort((a,b)=>a.d-b.d);
  let best=candidates[0];if(best&&!d.island){const major=candidates.find(c=>c.node.component===network.mainComponent&&c.d<=best.d+20/UNIT);if(major)best=major;}
  if(best)targets[key]={nodeId:best.node.id,position:best.node.worldPosition.toArray(),anchor:anchor.toArray(),distanceM:best.d*UNIT,component:best.node.component};
 }
 guard.clear();return {targets,diagnostics,canWalk};
}

export function hydrateNavigation(data,root){
 const nodes=data.nodes.map(([id,x,z,worldY,component])=>({id,x,z,worldY,component,links:[],worldPosition:root.localToWorld(new T.Vector3(x,0,z)).setY(worldY??0)})),byId=new Map(nodes.map(n=>[n.id,n]));
 const edges=[];for(let i=0;i<data.edges.length;i+=2){const a=byId.get(data.edges[i]),b=byId.get(data.edges[i+1]),edge={a,b,length:Math.hypot(a.x-b.x,a.z-b.z)};edges.push(edge);a.links.push({node:b,edge});b.links.push({node:a,edge});}
 function snap(p,radius=Infinity,component){let hit,best=radius**2;for(const edge of edges){const {a,b,length}=edge;if(component!=null&&a.component!==component)continue;const t=Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.z-a.z)*(b.z-a.z))/(length**2||1))),x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,d=(p.x-x)**2+(p.z-z)**2;if(d<best){best=d;hit={edge,t,x,z};}}return hit;}
 function route(start,goal){if(!start||!goal||start.edge.a.component!==goal.edge.a.component)return null;if(start.edge===goal.edge)return [goal];const costs=new Map(),came=new Map(),pending=[];for(const [n,k]of [[start.edge.a,start.t],[start.edge.b,1-start.t]]){costs.set(n.id,k*start.edge.length);pending.push(n);}let exit=null;const done=new Set();while(pending.length){pending.sort((a,b)=>costs.get(a.id)-costs.get(b.id));const n=pending.shift();if(done.has(n.id))continue;done.add(n.id);if(n===goal.edge.a||n===goal.edge.b){exit=n;break;}for(const {node,edge}of n.links){const c=costs.get(n.id)+edge.length;if(c<(costs.get(node.id)??Infinity)){costs.set(node.id,c);came.set(node.id,n);pending.push(node);}}}if(!exit)return null;const result=[];for(let n=exit;n;n=came.get(n.id))result.push(n);return [...result.reverse(),goal];}
 return {nodes,edges,snap,route,mainComponent:data.mainComponent,stitched:data.diagnostics?.connectionsRepaired||0};
}
