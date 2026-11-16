// Graph motion is independent of the camera. Stopping preserves the current
// point on its edge, so resuming never snaps to an earlier road node.
export function walkGraph(p,nodes,edges,{direction=0,distance=0,route=false,steering=false}={}){
 p.moving=false;let moved=0,blocked=false;const segments=[];
 if((!route&&!direction)||distance<=0)return {moved,blocked,segments};
 let remaining=distance;
 for(let guard=0;remaining>1e-8&&guard<128;guard++){
  if(route){
   if(p.target==null){const next=p.route?.shift();if(next==null)break;p.target=next;p.edge=[p.node,next];}
  }else{
   // Keep an intentional turn until the next junction. A short button step
   // must not erase the choice while it is still finishing the current edge.
   const onEdge=!!p.edge,face=onEdge&&p.steeringHeading!=null?(p.roadHeading??p.heading):(p.steeringHeading??p.heading);
   const heading=face+(direction<0?Math.PI:0);let options=p.edge||[...(edges.get(p.node)||[])],continuation=false,reverseRequested=false;
   if(!onEdge&&options.length===2&&options.includes(p.arrivedFrom)&&Number.isFinite(p.roadHeading)){
    const back=nodes.get(p.arrivedFrom).position,dx=back.x-p.position.x,dz=back.z-p.position.z,len=Math.hypot(dx,dz);
    reverseRequested=p.steeringHeading!=null&&len>1e-8&&(dx*Math.sin(heading)+dz*Math.cos(heading))/len>.85;
    if(!reverseRequested){options=options.filter(id=>id!==p.arrivedFrom);continuation=true;}
   }
   let target=null,best=continuation?-Infinity:onEdge?.025:-.5;
   for(const id of options){const q=nodes.get(id).position,dx=q.x-p.position.x,dz=q.z-p.position.z,len=Math.hypot(dx,dz);if(len<1e-8)continue;const score=(dx*Math.sin(heading)+dz*Math.cos(heading))/len;if(score>best){best=score;target=id;}}
   if(target==null){blocked=true;break;}
   if(!p.edge){p.edge=[p.node,target];if((edges.get(p.node)?.size||0)>2||reverseRequested)p.steeringHeading=null;}p.target=target;
  }
  const goal=nodes.get(p.target)?.position;if(!goal){p.target=null;p.edge=null;blocked=true;break;}
  const dx=goal.x-p.position.x,dz=goal.z-p.position.z,len=Math.hypot(dx,dz);
  if(len<1e-8){p.arrivedFrom=p.edge?.find(id=>id!==p.target)??p.node;p.node=p.target;p.target=null;p.edge=null;continue;}
  // Backwards travel keeps the face pointed forwards.
  p.roadHeading=Math.atan2(dx,dz)+(!route&&direction<0?Math.PI:0);
  if(!steering)p.heading=p.roadHeading;
  const step=Math.min(remaining,len),t=step/len;
  p.position.x+=dx*t;p.position.z+=dz*t;p.position.y+=(goal.y-p.position.y)*t;
  segments.push({x:p.position.x,y:p.position.y,z:p.position.z});
  moved+=step;remaining-=step;
  if(step>=len-1e-8){p.arrivedFrom=p.edge?.find(id=>id!==p.target)??p.node;p.node=p.target;p.target=null;p.edge=null;}
 }
 p.moving=moved>0;return {moved,blocked,segments};
}

export function turnWalker(p,angle){p.steeringHeading=(p.steeringHeading??p.heading)+angle;p.heading=p.steeringHeading;}

export function walkingInput(held){
 return {direction:Number(held.has('w')||held.has('arrowup'))-Number(held.has('s')||held.has('arrowdown')),turn:Number(held.has('a')||held.has('arrowleft'))-Number(held.has('d')||held.has('arrowright'))};
}
