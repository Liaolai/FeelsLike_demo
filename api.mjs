import {healthAdvice} from './ai-health.mjs';
// Common backend for the local continuous service and the hosted Worker.
// No learned individual model and no synthetic weather.
import {environmentReminder,nearestForecastPoint,applyComfortFeedback} from './public/climate.js';
import {POINTS,FIELDS,HOURLY,weatherURL,validateWeather,pointWeather,retryDelay} from './public/weather-data.js';
export {POINTS,FIELDS,HOURLY,weatherURL,validateWeather,pointWeather} from './public/weather-data.js';
export function reminderFor(w,activity='walk'){
 return environmentReminder(w,activity);
}
export function personalize(reminder,feedback,activity,now=Date.now()){return applyComfortFeedback(reminder,feedback,activity,now);}
let weatherCache=null,weatherTask=null,lastError=null,nextAttempt=0,lastAttemptAt=null,lastHttpStatus=null,lastErrorCode=null;
export async function getWeather(force=false){
 if(!force&&weatherCache&&Date.now()-weatherCache.fetchedAt<600000)return weatherCache;
 if(!force&&Date.now()<nextAttempt)return weatherCache;
 if(weatherTask)return weatherTask;
 weatherTask=(async()=>{
  try{lastAttemptAt=Date.now();const r=await fetch(weatherURL(),{signal:AbortSignal.timeout(18000)});lastHttpStatus=r.status;if(!r.ok){const e=Error('Weather HTTP '+r.status);e.status=r.status;if(r.status===429)e.retryAt=Date.now()+retryDelay(r.headers.get('retry-after'));throw e;}
   const points=validateWeather(await r.json());weatherCache={points,fetchedAt:Date.now()};lastError=null;lastErrorCode=null;
  }catch(e){lastErrorCode=e.status===429?'rate_limited':e.status?'upstream_http':'network_or_data';lastError='Weather provider unavailable';nextAttempt=e.retryAt||Date.now()+60000;}
  finally{weatherTask=null;}return weatherCache;
 })();return weatherTask;
}
export function weatherDiagnostics(cache=weatherCache,now=Date.now()){
 const points=cache?cache.points.map((p,i)=>({id:POINTS[i].id,requested:{lat:POINTS[i].lat,lon:POINTS[i].lon},returned:{lat:p.latitude,lon:p.longitude},validTime:p.current.time*1000,ageMinutes:Math.round((now-p.current.time*1000)/60000),currentFields:FIELDS.length,hourlyFields:HOURLY.length,hourlySamples:p.hourly.time.length,stale:pointWeather(p,cache.fetchedAt,now).stale})):[];
 const uniqueGridCount=new Set(points.map(p=>p.returned.lat+','+p.returned.lon)).size;
 return {checkedAt:now,weather:{provider:'Open-Meteo',status:!cache?'unavailable':lastError||points.some(p=>p.stale)?'degraded':'ok',lastHttpStatus,lastAttemptAt,lastSuccessAt:cache?.fetchedAt??null,cacheSeconds:600,uniqueGridCount,points,error:lastError,errorCode:lastErrorCode,retryAt:nextAttempt>Date.now()?nextAttempt:null},tjweather:{status:'credentials_not_configured'},crowd:{status:'not_connected'}};
}
export function telemetry(cache,people=[],now=Date.now()){
 return {computedAt:now,source:'Open-Meteo forecast model',weatherAvailable:!!cache,weatherError:cache?null:lastError||'Waiting for weather provider',points:cache?cache.points.map((p,i)=>({...POINTS[i],weather:pointWeather(p,cache.fetchedAt,now)})):[],people:people.slice(0,6).map(p=>{
  const lon=Number(p.lon),lat=Number(p.lat);if(!Number.isFinite(lon)||!Number.isFinite(lat)||lon<120.108||lon>120.176||lat<30.215||lat>30.281)throw Error('Position outside West Lake');
 const point=nearestForecastPoint(POINTS,lon,lat);
  const i=POINTS.indexOf(point),w=cache?pointWeather(cache.points[i],cache.fetchedAt,now):null;
  const activity=['walk','rest','run'].includes(p.activity)?p.activity:'walk',environmentalReminder=reminderFor(w,activity);
  return {id:String(p.id).slice(0,40),lon,lat,activity,pointId:point.id,weather:w,environmentalReminder,...personalize(environmentalReminder,p.feedback,activity,now)};
 }),crowd:{available:false,source:null,updatedAt:null},method:'Weather values are regional model forecasts. Person position selects the nearest of three requested forecast points; no street-level temperature or health prediction is invented.'};
}
export async function api(request,env={}){
 const url=new URL(request.url);
 if(url.pathname==='/api/health-advice')return healthAdvice(request,env);
 if(url.pathname==='/api/health')return Response.json({ok:true,service:'FeelsLike',weatherCached:!!weatherCache,backgroundIntervalSeconds:5});
 if(url.pathname==='/api/diagnostics'){await getWeather();return Response.json(weatherDiagnostics(),{headers:{'cache-control':'no-store'}});}
 if(url.pathname==='/api/crowd')return Response.json({available:false,reason:'No authorized real-time crowd provider connected',locations:[]});
 if(url.pathname==='/api/telemetry'){
  if(request.method!=='POST')return Response.json({error:'POST required'},{status:405});
  if(Number(request.headers.get('content-length'))>16000)return Response.json({error:'Payload too large'},{status:413});
  try{const raw=await request.text();if(raw.length>16000)return Response.json({error:'Payload too large'},{status:413});const body=JSON.parse(raw);if(!Array.isArray(body.people))throw Error('people must be an array');const cache=await getWeather();return Response.json(telemetry(cache,body.people),{headers:{'cache-control':'no-store'}});}catch(e){return Response.json({error:e.message},{status:400});}
 }
 return Response.json({error:'Not found'},{status:404});
}
