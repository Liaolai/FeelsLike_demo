import {POINTS,weatherURL,validateWeather,pointWeather,retryDelay} from './weather-data.js';
import {nearestForecastPoint,environmentReminder,applyComfortFeedback} from './climate.js';

export const WEATHER_CACHE_MS=600000;
const KEY='feelslike-public-weather-v1';
// Public regional forecasts only: no health, body details or precise device
// location are sent to the provider or stored in this weather cache.
export function createWeatherClient({fetcher=(...args)=>fetch(...args),storage,now=()=>Date.now()}={}){
 let cache=null,task=null,retryAt=0,lastHttpStatus=null,errorCode=null;
 if(storage===undefined)try{storage=globalThis.localStorage;}catch{}
 try{const saved=JSON.parse(storage?.getItem(KEY)||'null');if(saved){if(Number.isFinite(saved.retryAt)&&saved.retryAt>now()&&saved.retryAt<=now()+24*3600000){retryAt=saved.retryAt;errorCode=saved.errorCode;lastHttpStatus=saved.lastHttpStatus;}if(Number.isFinite(saved.fetchedAt)&&saved.fetchedAt<=now()&&now()-saved.fetchedAt<24*3600000){validateWeather(saved.points);cache={points:saved.points,fetchedAt:saved.fetchedAt};}}}catch{}
 function persist(){try{storage?.setItem(KEY,JSON.stringify({...cache,retryAt,errorCode,lastHttpStatus}));}catch{}}
 function diagnostics(){return {transport:'browser',lastHttpStatus,errorCode,retryAt,lastSuccessAt:cache?.fetchedAt??null,status:cache&&!cache.points.some(p=>pointWeather(p,cache.fetchedAt,now()).stale)?'ok':cache?'stale':'unavailable'};}
 async function load({force=false}={}){
  if(!force&&cache&&now()-cache.fetchedAt<WEATHER_CACHE_MS)return cache;
  if(now()<retryAt){if(cache)return cache;const e=Error('Waiting before the next weather request');e.code=errorCode;e.retryAt=retryAt;throw e;}
  if(task)return task;
  task=(async()=>{try{
   const r=await fetcher(weatherURL(),{signal:AbortSignal.timeout(15000)});lastHttpStatus=r.status;
   if(!r.ok){const e=Error('Weather HTTP '+r.status);e.code=r.status===429?'rate_limited':'upstream_http';e.retryAt=now()+(r.status===429?retryDelay(r.headers.get('retry-after'),now()):60000);throw e;}
   const points=validateWeather(await r.json());cache={points,fetchedAt:now()};retryAt=0;errorCode=null;persist();return cache;
  }catch(e){errorCode=e.code||'network_or_data';retryAt=e.retryAt||now()+60000;persist();if(cache)return cache;throw e;}finally{task=null;}})();return task;
 }
 return {load,diagnostics};
}
export function browserWeatherReport(cache,people=[],feedback={},now=Date.now()){
 const points=POINTS.map((p,i)=>({...p,weather:pointWeather(cache.points[i],cache.fetchedAt,now)}));
 return {computedAt:now,transport:'browser',source:'Open-Meteo forecast model',weatherAvailable:true,points,people:people.map(p=>{
  const near=nearestForecastPoint(POINTS,p.lon,p.lat),weather=points.find(w=>w.id===near.id).weather,environmentalReminder=environmentReminder(weather,p.activity);
  return {...p,pointId:near.id,weather,environmentalReminder,...applyComfortFeedback(environmentalReminder,feedback[p.id],p.activity,now)};
 }),crowd:{available:false,source:null,updatedAt:null}};
}
