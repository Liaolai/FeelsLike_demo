// 500 m is an interpolation/display spacing, not the source forecast resolution.
export const WEATHER_GRID_ORIGIN={lon:120.142,lat:30.248,metersPerLon:96400,metersPerLat:111320};
export const WEATHER_GRID_SPACING=500;
const project=(lon,lat)=>[(lon-WEATHER_GRID_ORIGIN.lon)*WEATHER_GRID_ORIGIN.metersPerLon,(lat-WEATHER_GRID_ORIGIN.lat)*WEATHER_GRID_ORIGIN.metersPerLat];
const geographic=(x,y)=>({lon:x/WEATHER_GRID_ORIGIN.metersPerLon+WEATHER_GRID_ORIGIN.lon,lat:y/WEATHER_GRID_ORIGIN.metersPerLat+WEATHER_GRID_ORIGIN.lat});
const finite=Number.isFinite,cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function uniqueWeatherPoints(points){
 const unique=new Map();
 for(const p of points||[]){if(![p?.lon,p?.lat].every(finite)||p.lon< -180||p.lon>180||p.lat< -90||p.lat>90)continue;const key=p.lon+','+p.lat;
  if(!unique.has(key))unique.set(key,{...p,air:finite(p.air)?p.air:null,feels:finite(p.feels)?p.feels:null,requests:[...(p.requests||[])]});
  else{const q=unique.get(key);for(const metric of ['air','feels'])if(!finite(q[metric])&&finite(p[metric]))q[metric]=p[metric];q.requests=[...new Set([...q.requests,...(p.requests||[])])];}
 }
 return [...unique.values()].filter(p=>finite(p.air)||finite(p.feels));
}
function hull(points){
 const sorted=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y);if(sorted.length<3)return sorted;
 const lower=[],upper=[];for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}for(const p of sorted.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function inside(h,p){
 if(!h.length)return false;if(h.length===1)return true;
 if(h.length===2){const [a,b]=h,dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=((p.x-a.x)*dx+(p.y-a.y)*dy)/len;return t>=-1e-10&&t<=1+1e-10&&Math.abs(cross(a,b,p))/Math.sqrt(len)<1e-5;}
 return h.every((a,i)=>cross(a,h[(i+1)%h.length],p)>=-1e-5);
}
function prepare(points,metric){const usable=points.filter(p=>finite(p[metric])).map(p=>{const [x,y]=project(p.lon,p.lat);return {...p,x,y};});return {points:usable,hull:hull(usable)};}
function interpolate(field,metric,lon,lat){
 const [x,y]=project(lon,lat),p={x,y};if(!field.points.length||!inside(field.hull,p))return null;
 const nearest=field.points.map(q=>({q,d2:(q.x-x)**2+(q.y-y)**2})).sort((a,b)=>a.d2-b.d2).slice(0,4);
 if(nearest[0].d2<1e-12)return nearest[0].q[metric];
 if(nearest.length===1)return nearest[0].q[metric];
 // Normalising inverse-square weights avoids overflow near exact source points.
 const reference=nearest[0].d2;let sum=0,weight=0;for(const {q,d2}of nearest){const w=reference/d2;sum+=q[metric]*w;weight+=w;}return sum/weight;
}
export function sampleWeatherGrid(grid,lon,lat){
 if(![lon,lat].every(finite))return null;
 const fields=grid._fields||{air:prepare(grid.sources||[],'air'),feels:prepare(grid.sources||[],'feels')},air=interpolate(fields.air,'air',lon,lat),feels=interpolate(fields.feels,'feels',lon,lat);
 if(!finite(air)&&!finite(feels))return null;
 const times=(grid.sources||[]).map(p=>p.time).filter(finite);
 return {lon,lat,air,feels,time:times.length?Math.min(...times):null,requests:[],interpolated:grid.sourceCount>1,sourceCount:grid.sourceCount,spacing:grid.spacing,method:grid.method};
}
export function buildWeatherGrid(sourcePoints,{bbox,spacing=WEATHER_GRID_SPACING}={}){
 if(!finite(spacing)||spacing<1)throw Error('Invalid weather grid spacing');
 const sources=uniqueWeatherPoints(sourcePoints),fields={air:prepare(sources,'air'),feels:prepare(sources,'feels')};
 const scope=Array.isArray(bbox)&&bbox.length===4&&bbox.every(finite)?bbox:sources.length?[Math.min(...sources.map(p=>p.lon)),Math.min(...sources.map(p=>p.lat)),Math.max(...sources.map(p=>p.lon)),Math.max(...sources.map(p=>p.lat))]:null;
 const result={points:[],sources,sourceCount:sources.length,metricSourceCounts:{air:fields.air.points.length,feels:fields.feels.points.length},hulls:{air:fields.air.hull.map(p=>[p.lon,p.lat]),feels:fields.feels.hull.map(p=>[p.lon,p.lat])},spacing,interpolated:sources.length>1,method:sources.length===1?'uniform-single-source':'IDW-p2-nearest4',origin:{...WEATHER_GRID_ORIGIN},bbox:scope};
 Object.defineProperty(result,'_fields',{value:fields,enumerable:false});
 if(!scope||!sources.length)return result;
 const [x0,y0]=project(scope[0],scope[1]),[x1,y1]=project(scope[2],scope[3]);
 if(x1<x0||y1<y0)throw Error('Invalid weather grid bounds');
 const minX=Math.ceil(x0/spacing-1e-8),maxX=Math.floor(x1/spacing+1e-8),minY=Math.ceil(y0/spacing-1e-8),maxY=Math.floor(y1/spacing+1e-8);
 if((maxX-minX+1)*(maxY-minY+1)>100000)throw Error('Weather grid bounds too large');
 for(let iy=minY;iy<=maxY;iy++)for(let ix=minX;ix<=maxX;ix++){const {lon,lat}=geographic(ix*spacing,iy*spacing),point=sampleWeatherGrid(result,lon,lat);if(point)result.points.push({...point,x:ix*spacing,y:iy*spacing,ix,iy});}
 if(!result.points.length&&sources.length===1)result.points.push({...sources[0],interpolated:false,sourceCount:1,spacing,method:result.method});
 return result;
}
