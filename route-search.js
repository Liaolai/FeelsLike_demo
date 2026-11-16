// Heap-based A*: large road graphs have no arbitrary 40,000-iteration cutoff.
export function shortestRoute(nodes,edges,start,end){
 if(!nodes.has(start)||!nodes.has(end)||start===end)return [];
 const score=new Map([[start,0]]),came=new Map(),heap=[],done=new Set(),goal=nodes.get(end).position;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 function push(entry){let i=heap.length;heap.push(entry);while(i){const p=(i-1)>>1;if(heap[p][0]<=entry[0])break;heap[i]=heap[p];i=p;}heap[i]=entry;}
 function pop(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(heap[child+1]?.[0]<heap[child][0])child++;if(heap[child][0]>=last[0])break;heap[i]=heap[child];i=child;}heap[i]=last;}return first;}
 push([distance(nodes.get(start).position,goal),start]);
 while(heap.length){const [,id]=pop();if(done.has(id))continue;if(id===end){const result=[end];while(came.has(result[0]))result.unshift(came.get(result[0]));return result.slice(1);}done.add(id);
  for(const next of edges.get(id)||[]){if(done.has(next)||!nodes.has(next))continue;const g=score.get(id)+distance(nodes.get(id).position,nodes.get(next).position);if(g<(score.get(next)??Infinity)){score.set(next,g);came.set(next,id);push([g+distance(nodes.get(next).position,goal),next]);}}
 }return [];
}
