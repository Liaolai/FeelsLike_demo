import {buildWeatherGrid,sampleWeatherGrid,WEATHER_GRID_SPACING} from './weather-grid.js';
export {buildWeatherGrid,sampleWeatherGrid,WEATHER_GRID_SPACING} from './weather-grid.js';
import {DEST} from './destinations.js';

// Keep source points separately from the 500 m interpolation grid.
// Neither display spacing nor IDW increases the original measurement precision.
export function temperaturePoints(report,now=Date.now()){
 const grids=new Map();
 for(const p of report?.points||[]){const w=p.weather;if(!w||w.stale||!Number.isFinite(w.time)||w.time*1000>now+15*60000||now-w.time*1000>90*60000||![w.latitude,w.longitude].every(Number.isFinite)||!Number.isFinite(w.temperature_2m)&&!Number.isFinite(w.apparent_temperature))continue;
  const key=w.latitude+','+w.longitude;if(!grids.has(key))grids.set(key,{lon:w.longitude,lat:w.latitude,air:Number.isFinite(w.temperature_2m)?w.temperature_2m:null,feels:Number.isFinite(w.apparent_temperature)?w.apparent_temperature:null,time:w.time,requests:[]});const point=grids.get(key);if(!Number.isFinite(point.air)&&Number.isFinite(w.temperature_2m))point.air=w.temperature_2m;if(!Number.isFinite(point.feels)&&Number.isFinite(w.apparent_temperature))point.feels=w.apparent_temperature;point.requests.push(p.id);
 }return [...grids.values()];
}
export function nearestTemperature(points,lon,lat){let best=null,d=Infinity;for(const p of points){const n=Math.hypot((p.lon-lon)*96400,(p.lat-lat)*111320);if(n<d){best=p;d=n;}}return best;}
export const TEMPERATURE_STOPS=[[-10,'#29245c'],[0,'#58429b'],[10,'#974784'],[20,'#cb6476'],[30,'#ea9960'],[40,'#f9dc91']];
const ACCESSIBLE=[[-10,'#00204c'],[0,'#29466e'],[10,'#536776'],[20,'#8b8c78'],[30,'#c6b866'],[40,'#ffe945']];
// Local scaling changes the colour mapping only; the source temperatures stay intact.
// bbox order matches the map data: [west, south, east, north].
export function temperatureDomain(points,metric='air',{scopeBBox}={}){
 const scoped=Array.isArray(scopeBBox)&&scopeBBox.length===4&&scopeBBox.every(Number.isFinite);
 const values=(points||[]).filter(p=>Number.isFinite(p?.[metric])&&(!scoped||Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&p.lon>=scopeBBox[0]&&p.lon<=scopeBBox[2]&&p.lat>=scopeBBox[1]&&p.lat<=scopeBBox[3])).map(p=>p[metric]);
 if(!values.length)return [-10,40];
 let min=Math.min(...values),max=Math.max(...values);
 if(max-min<1){const mid=(min+max)/2;min=mid-.5;max=mid+.5;}
 return [min,max];
}
export function temperatureColor(value,vision='normal',domain){
 if(!Number.isFinite(value))return '#e1e5df';
 const local=Array.isArray(domain)&&domain.length===2&&domain.every(Number.isFinite)&&domain[1]>domain[0],mapped=local?-10+(value-domain[0])/(domain[1]-domain[0])*50:value;
 const stops=vision==='normal'?TEMPERATURE_STOPS:ACCESSIBLE,v=Math.max(-10,Math.min(40,mapped));let i=0;while(i<stops.length-2&&v>stops[i+1][0])i++;
 const [a,ca]=stops[i],[b,cb]=stops[i+1],f=(v-a)/(b-a),parts=c=>[1,3,5].map(k=>parseInt(c.slice(k,k+2),16));return '#'+parts(ca).map((n,k)=>Math.round(n+(parts(cb)[k]-n)*f).toString(16).padStart(2,'0')).join('');
}
export function createTemperatureMap(canvas,{onRoad,onInspect}={}){
 const ctx=canvas.getContext('2d');
 let data,sourcePoints=[],points=[],grid=buildWeatherGrid([]),gridSignature='',lang='zh',vision='normal',metric='air',colorScale='fixed',scopeBBox,domain,person,active=false,W=1,H=1,zoom=1,center=[120.142,30.248],road,selected,signature='',paint='';
 const pointers=new Map();let gesture=null,dragged=false;
 const scale=()=>data?Math.min((W-28)/((data.bbox[2]-data.bbox[0])*96400),(H-28)/((data.bbox[3]-data.bbox[1])*111320))*zoom:1;
 const xy=c=>[W/2+(c[0]-center[0])*96400*scale(),H/2-(c[1]-center[1])*111320*scale()];
 const geo=(x,y)=>[center[0]+(x-W/2)/scale()/96400,center[1]-(y-H/2)/scale()/111320];
 function trace(c,close=false){ctx.beginPath();c.forEach((p,i)=>{const q=xy(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});if(close)ctx.closePath();}
 function label(text,x,y,color='#233534',bg=false){ctx.font='14px system-ui';const width=ctx.measureText(text).width;if(bg){ctx.fillStyle='#fffef4ec';ctx.fillRect(x-width/2-5,y-16,width+10,24);}ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(text,x,y+1);}
 function inspect(c){selected=c;const p=sampleWeatherGrid(grid,...c);onInspect?.(p,c);}
 function draw(){if(!active||!data||W<2||H<2)return;ctx.clearRect(0,0,W,H);ctx.fillStyle='#e5e9e1';ctx.fillRect(0,0,W,H);
  domain=colorScale==='local'?temperatureDomain(points,metric,{scopeBBox:scopeBBox||data.bbox}):undefined;
  // Clip display cells to the valid metric hull; grey remains outside source support.
  ctx.save();trace([[data.bbox[0],data.bbox[1]],[data.bbox[2],data.bbox[1]],[data.bbox[2],data.bbox[3]],[data.bbox[0],data.bbox[3]]],true);ctx.clip();
  const support=grid.hulls[metric]||[];
  if(support.length>=3){trace(support,true);ctx.clip();}
  if(support.length!==2)for(const p of points){const [x,y]=xy([p.lon,p.lat]),size=grid.spacing*scale();ctx.fillStyle=temperatureColor(p[metric],vision,domain);ctx.fillRect(x-size/2,y-size/2,size+.5,size+.5);}
  ctx.restore();
  for(const ring of data.water){trace(ring.c,true);ctx.fillStyle=ring.role==='inner'?'#fff7e42b':'#effaff16';ctx.fill();ctx.strokeStyle='#234b5b';ctx.lineWidth=1.4;ctx.stroke();}
  ctx.fillStyle='#26352d36';for(const building of data.buildings){trace(building.c,true);ctx.fill();}
  for(const r of data.roads){trace(r.c);ctx.strokeStyle=r.walk?'#314449b0':'#4c41498c';ctx.lineWidth=r.type==='footway'||r.type==='path'?.8:1.3;ctx.stroke();}
  if(road){trace(road.c);ctx.lineWidth=6;ctx.strokeStyle='#fffdf1';ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle='#165c81';ctx.stroke();}
  const occupied=[];for(const [key,d]of Object.entries(DEST)){const [x,y]=xy(d.c);if(x<25||y<26||x>W-25||y>H-95)continue;ctx.fillStyle=d.kind==='pier'?'#1f5362':'#2b3e34';ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();const text=(d.kind==='pier'?'⛵ ':'')+d[lang],width=text.length*(lang==='en'?7.4:14)+14;if(x<width/2+8||x>W-width/2-8||occupied.some(p=>Math.abs(p[0]-x)<(p[2]+width)/2+10&&Math.abs(p[1]-y)<32))continue;label(text,x,y-9,undefined,false);occupied.push([x,y,width]);}
  const [lx,ly]=xy([120.142,30.243]);label(lang==='zh'?'西 湖':'WEST LAKE',lx,ly,'#244955',false);
  if(person){const [x,y]=xy([person.lon,person.lat]);ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fillStyle='#fffdf6';ctx.fill();ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle='#254e71';ctx.fill();}
  if(selected){const [x,y]=xy(selected);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);ctx.stroke();}
  ctx.font='13px system-ui';ctx.fillStyle='#22392e';ctx.textAlign='left';ctx.fillText('N ↑',14,23);
 }
 function resize(){const r=canvas.getBoundingClientRect();if(r.width<2||r.height<2)return;W=r.width;H=r.height;const dpr=Math.min(devicePixelRatio,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
 function moveZoom(f,anchor=[W/2,H/2]){const before=geo(...anchor);zoom=Math.max(1,Math.min(12,zoom*f));const after=geo(...anchor);center=[center[0]+before[0]-after[0],center[1]+before[1]-after[1]];draw();}
 function coords(e){const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
 canvas.addEventListener('wheel',e=>{e.preventDefault();moveZoom(Math.exp(-e.deltaY*.0015),coords(e));},{passive:false});
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,coords(e));dragged=false;gesture={center:[...center],zoom,values:[...pointers.values()]};});
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,coords(e));const values=[...pointers.values()];if(values.length===1&&gesture.values.length===1){const dx=values[0][0]-gesture.values[0][0],dy=values[0][1]-gesture.values[0][1];if(Math.hypot(dx,dy)>4)dragged=true;center=[gesture.center[0]-dx/scale()/96400,gesture.center[1]+dy/scale()/111320];}else if(values.length===2&&gesture.values.length===2){dragged=true;zoom=Math.max(1,Math.min(12,gesture.zoom*Math.hypot(values[0][0]-values[1][0],values[0][1]-values[1][1])/Math.max(1,Math.hypot(gesture.values[0][0]-gesture.values[1][0],gesture.values[0][1]-gesture.values[1][1]))));}draw();});
 canvas.addEventListener('pointerup',e=>{const c=coords(e),pick=!dragged&&pointers.size===1;pointers.delete(e.pointerId);gesture={center:[...center],zoom,values:[...pointers.values()]};if(pick){inspect(geo(...c));let best=null,dist=7;for(const r of data?.roads||[])for(let i=1;i<r.c.length;i++){const a=xy(r.c[i-1]),b=xy(r.c[i]),dx=b[0]-a[0],dy=b[1]-a[1],f=Math.max(0,Math.min(1,((c[0]-a[0])*dx+(c[1]-a[1])*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(c[0]-a[0]-f*dx,c[1]-a[1]-f*dy);if(d<dist){best=r;dist=d;}}road=best;onRoad?.(best);draw();}});
 canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);dragged=true;});
 canvas.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){e.preventDefault();moveZoom(1.3);}else if(e.key==='-'){e.preventDefault();moveZoom(1/1.3);}else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const dx=e.key==='ArrowLeft'?-40:e.key==='ArrowRight'?40:0,dy=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;center=[center[0]+dx/scale()/96400,center[1]+dy/scale()/111320];draw();}});
 function rebuildGrid(){const next=JSON.stringify([sourcePoints,data?.bbox]);if(next!==gridSignature){gridSignature=next;grid=buildWeatherGrid(sourcePoints,{bbox:data?.bbox});points=grid.points;}}
 return {getGrid(){return grid;},inspectAt(lon,lat){return sampleWeatherGrid(grid,lon,lat);},setData(value){data=value;rebuildGrid();center=[(data.bbox[0]+data.bbox[2])/2,(data.bbox[1]+data.bbox[3])/2];resize();},setActive(value){active=value;if(value)resize();},update(report,options={}){sourcePoints=temperaturePoints(report);rebuildGrid();lang=options.lang||'zh';vision=options.vision||'normal';metric=options.metric||'air';colorScale=options.colorScale==='local'?'local':'fixed';scopeBBox=options.scopeBBox;person=options.person;const next=JSON.stringify([points,lang,vision,metric,colorScale,scopeBBox,person]);if(next!==signature){signature=next;draw();}return points;},zoom(f){moveZoom(f);},reset(){zoom=1;if(data)center=[(data.bbox[0]+data.bbox[2])/2,(data.bbox[1]+data.bbox[3])/2];draw();},clearSelection(){road=null;selected=null;draw();},destroy(){resizeObserver.disconnect();}};
}
