const EPSILON = 1e-7;
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);

class MinHeap {
  items=[];
  push(entry){
    const items=this.items;
    let i=items.length;
    items.push(entry);
    while(i>0){
      const p=(i-1)>>1;
      if(items[p][0]<=entry[0])break;
      items[i]=items[p];i=p;
    }
    items[i]=entry;
  }
  pop(){
    const items=this.items,first=items[0],last=items.pop();
    if(!items.length)return first;
    let i=0;
    while(2*i+1<items.length){
      let child=2*i+1;
      if(items[child+1]?.[0]<items[child][0])child++;
      if(items[child][0]>=last[0])break;
      items[i]=items[child];i=child;
    }
    items[i]=last;
    return first;
  }
}

export function createWalkNetwork(paths,pathNodeIds,canConnect=()=>true){
  const ids=new Map(),nodes=[],edges=[];
  paths.forEach((path,pathIndex)=>{
    let previous;
    path.forEach(([x,z],i)=>{
      const key=String(pathNodeIds[pathIndex]?.[i]??x.toFixed(7)+','+z.toFixed(7));
      let node=ids.get(key);
      if(!node){
        node={id:nodes.length,x,z,links:[],component:-1};
        ids.set(key,node);nodes.push(node);
      }
      if(previous&&previous!==node){
        const edge={a:previous,b:node,length:distance(previous,node)};
        if(edge.length>EPSILON){
          previous.links.push({node,edge});node.links.push({node:previous,edge});
          edges.push(edge);
        }
      }
      previous=node;
    });
  });
  const parent=nodes.map(n=>n.id),size=nodes.map(()=>1);
  function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  function join(a,b){a=find(a);b=find(b);if(a===b)return;if(size[a]<size[b])[a,b]=[b,a];parent[b]=a;size[a]+=size[b];}
  for(const {a,b} of edges)join(a.id,b.id);
  const cell=.25, grid=new Map(),key=(x,z)=>Math.floor(x/cell)+','+Math.floor(z/cell);
  for(const n of nodes){const k=key(n.x,n.z);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(n);}
  let stitched=0;
  for(const radius of [.08,.25]){
    const main=nodes.reduce((a,b)=>size[find(a.id)]>=size[find(b.id)]?a:b,nodes[0]);
    for(const a of nodes){
      const ax=Math.floor(a.x/cell),az=Math.floor(a.z/cell);
      let best,bestDistance=radius;
      for(let x=ax-1;x<=ax+1;x++)for(let z=az-1;z<=az+1;z++)for(const b of grid.get(x+','+z)||[]){
        if(a===b||find(a.id)===find(b.id))continue;
        if(radius>.08&&find(b.id)!==find(main.id))continue;
        const d=distance(a,b);
        if(d<bestDistance&&canConnect(a,b)){best=b;bestDistance=d;}
      }
      if(!best)continue;
      const edge={a,b:best,length:Math.max(EPSILON,bestDistance),stitch:true};
      a.links.push({node:best,edge});best.links.push({node:a,edge});edges.push(edge);
      join(a.id,best.id);stitched++;
    }
  }
  const edgeCells=new Map();
  for(const edge of edges){
    const {a,b}=edge;
    for(let x=Math.floor(Math.min(a.x,b.x)/cell);x<=Math.floor(Math.max(a.x,b.x)/cell);x++)
    for(let z=Math.floor(Math.min(a.z,b.z)/cell);z<=Math.floor(Math.max(a.z,b.z)/cell);z++){
      const k=x+','+z;if(!edgeCells.has(k))edgeCells.set(k,[]);edgeCells.get(k).push(edge);
    }
  }
  const connect=(a,b)=>{
    const edge={a,b,length:Math.max(EPSILON,distance(a,b)),stitch:true};
    a.links.push({node:b,edge});b.links.push({node:a,edge});edges.push(edge);join(a.id,b.id);
    return edge;
  };
  for(const n of nodes.slice()){
    if(n.links.length!==1)continue;
    const x0=Math.floor(n.x/cell),z0=Math.floor(n.z/cell);
    let best=null,limit=.25;
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const edge of edgeCells.get((x0+i)+','+(z0+j))||[]){
      if(edge.inactive||find(n.id)===find(edge.a.id))continue;
      const {a,b,length}=edge,dx=b.x-a.x,dz=b.z-a.z;
      const t=((n.x-a.x)*dx+(n.z-a.z)*dz)/(length*length);
      if(t<=.015||t>=.985)continue;
      const point={x:a.x+dx*t,z:a.z+dz*t},d=distance(n,point);
      if(d<limit&&canConnect(n,point)){limit=d;best={edge,point};}
    }
    if(!best)continue;
    const {edge,point}=best;
    const node={...point,id:nodes.length,links:[]};
    nodes.push(node);parent.push(node.id);size.push(1);
    edge.inactive=true;
    edge.a.links=edge.a.links.filter(link=>link.edge!==edge);
    edge.b.links=edge.b.links.filter(link=>link.edge!==edge);
    const replacements=[connect(edge.a,node),connect(node,edge.b)];
    for(const bucket of edgeCells.values())if(bucket.includes(edge))bucket.push(...replacements);
    connect(n,node);stitched++;
  }
  for(const node of nodes)node.component=find(node.id);
  const mainComponent=nodes.reduce((a,b)=>a===null||size[b.component]>size[a]?b.component:a,null);
  function snap(point,radius=Infinity,component){
    let hit,best=radius*radius;
    for(const edge of edges){
      if(edge.inactive)continue;
      const {a,b,length}=edge;
      if(component!==undefined&&a.component!==component)continue;
      const t=Math.max(0,Math.min(1,((point.x-a.x)*(b.x-a.x)+(point.z-a.z)*(b.z-a.z))/(length*length)));
      const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
      const d=(point.x-x)**2+(point.z-z)**2;
      if(d>=best)continue;
      hit={edge,t,x,z};best=d;
    }
    return hit;
  }
  function route(start,goal){
    if(start.edge.a.component!==goal.edge.a.component)return null;
    if(start.edge===goal.edge)return [goal];
    const costs=new Float64Array(nodes.length).fill(Infinity);
    const parent=new Int32Array(nodes.length).fill(-1);
    const pending=new MinHeap();
    for(const [node,weight] of [[start.edge.a,start.t],[start.edge.b,1-start.t]]){
      costs[node.id]=weight*start.edge.length;pending.push([costs[node.id],node.id]);
    }
    let best=Infinity,exit=-1;
    while(pending.items.length){
      const [cost,id]=pending.pop();
      if(cost!==costs[id])continue;
      if(cost>=best)break;
      const node=nodes[id];
      if(node===goal.edge.a||node===goal.edge.b){
        const total=cost+goal.edge.length*(node===goal.edge.a?goal.t:1-goal.t);
        if(total<best){exit=id;best=total;}
      }
      for(const {node:next,edge} of node.links){
        const costNext=cost+edge.length;
        if(costNext>=costs[next.id])continue;
        costs[next.id]=costNext;parent[next.id]=id;pending.push([costNext,next.id]);
      }
    }
    if(exit<0)return null;
    const points=[];
    for(let id=exit;id>=0;id=parent[id])points.push(nodes[id]);
    return [...points.reverse(),goal];
  }
  return {snap,route,mainComponent,stitched,nodes,edges};
}
