// Use the actual Broken Bridge axis for its landing, rather than the nearby
// north-bank path. This affects the avatar pose, not the OSM graph or geometry.
export function baidiEntry(network,corridor){
 const bridge=corridor?.bridges?.find(b=>b.name==='断桥');if(!bridge)return null;
 const point=corridor.station(bridge.s),snap=network.snap(point,.35,network.mainComponent);if(!snap)return null;
 const candidates=[snap.edge.a,snap.edge.b].filter(n=>n.walkable!==false&&n.worldPosition);
 candidates.sort((a,b)=>Math.hypot(a.x-point.x,a.z-point.z)-Math.hypot(b.x-point.x,b.z-point.z));
 const node=candidates[0];if(!node)return null;
 // The axis runs west to east. Face along its western continuation.
 const dx=-point.dx,dz=-point.dz;
 const toward=node.links.filter(l=>!l.edge?.inactive&&l.node.walkable!==false).sort((a,b)=>{
  const score=n=>((n.x-node.x)*dx+(n.z-node.z)*dz)/(Math.hypot(n.x-node.x,n.z-node.z)||1);
  return score(b.node)-score(a.node);
 })[0]?.node;
 return {nodeId:node.id,heading:toward?Math.atan2(toward.worldPosition.x-node.worldPosition.x,toward.worldPosition.z-node.worldPosition.z):Math.atan2(dx,dz)};
}
