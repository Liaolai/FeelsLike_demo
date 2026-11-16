// The graph controls XZ travel; the rendered road controls the feet. Never use
// a nearby centreline's approximate Y as a substitute for an existing deck.
export function createGroundContact(deck,collision,{unit=40,soleM=.02,stepM=.24,slope=1.2,waterDeck=null}={}){
 const sole=soleM/unit;
 function height(x,z,referenceY){let y=deck.height(x,z,Number.isFinite(referenceY)?referenceY-sole:undefined);const water=waterDeck?.height(x,z);if(y!=null&&water!=null&&y<water-.02/unit){const top=deck.height(x,z);y=top!=null&&top>=water-.02/unit?top:null;}return y;}
 function trace(a,b){const distance=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(distance/(.15/unit)));let previous={x:a.x,y:a.y,z:a.z};
  for(let i=0;i<=steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=height(x,z,previous.y);if(y==null)return {ok:false,reason:'missing-surface',at:[x,previous.y,z]};const feet=y+sole;
   if(Math.abs(feet-previous.y)>Math.max(stepM/unit,i?distance/steps*slope:0))return {ok:false,reason:'height-step',at:[x,feet,z]};
   const p={x,y:feet,z};if(collision?.blocked(p))return {ok:false,reason:'body-collision',at:[x,feet,z]};previous=p;
  }return {ok:true,position:previous};
 }
 return {height,trace,canWalk:(a,b)=>trace(a,b).ok,sole};
}

