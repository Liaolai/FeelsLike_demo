// Downloaded forecast snapshot; never a live subscription or a sensor observation.
export const TJ_SNAPSHOT_MAX_AGE_MS=24*3600000;
const TIME_CACHE=new WeakMap(),HOURLY_CACHE=new WeakMap();
const isNumber=Number.isFinite;
function parsedTimes(dataset){let t=TIME_CACHE.get(dataset);if(!t){t=dataset.times.map(v=>Date.parse(v)/1000);TIME_CACHE.set(dataset,t);}return t;}
export function validateTjWeather(dataset){
 if(dataset?.kind!=='downloaded_forecast_snapshot'||!Array.isArray(dataset.times)||dataset.times.length<2||!Array.isArray(dataset.points)||!dataset.points.length||!isNumber(Date.parse(dataset.downloadedAt)))throw Error('Invalid tjweather snapshot');
 const times=parsedTimes(dataset);if(!times.every((v,i)=>isNumber(v)&&(!i||v>times[i-1])))throw Error('Invalid tjweather times');
 for(const p of dataset.points){if(!isNumber(p.lon)||!isNumber(p.lat)||p.lon< -180||p.lon>180||p.lat< -90||p.lat>90||!Array.isArray(p.values)||p.values.length!==times.length||p.values.some(r=>!Array.isArray(r)||r.length!==5||!r.every(isNumber)||r[0]< -60||r[0]>65||r[1]<0||r[1]>100||r.slice(2).some(v=>v<0)))throw Error('Invalid tjweather point');}
 return dataset;
}
let loading;
export async function loadTjWeather({fetcher=fetch}={}){
 if(!loading)loading=(async()=>{try{const r=await fetcher('./assets/tjweather.json');if(!r.ok)throw Error('Snapshot unavailable');return validateTjWeather(await r.json());}catch(e){loading=null;throw e;}})();
 return loading;
}
export function nearestTjPoint(dataset,lon,lat){
 if(!isNumber(lon)||!isNumber(lat))return null;
 return dataset.points.reduce((best,p)=>!best||Math.hypot((p.lon-lon)*96400,(p.lat-lat)*111320)<Math.hypot((best.lon-lon)*96400,(best.lat-lat)*111320)?p:best,null);
}
function hourlyFor(dataset,point){
 let h=HOURLY_CACHE.get(point);if(h)return h;
 const nil=()=>point.values.map(()=>null);
 h={time:parsedTimes(dataset),temperature_2m:point.values.map(r=>r[0]),relative_humidity_2m:point.values.map(r=>r[1]),wind_gusts_10m:point.values.map(r=>r[3]),wind_speed_10m:point.values.map(r=>r[4]),precipitation_intensity:point.values.map(r=>r[2]),apparent_temperature:nil(),precipitation:nil(),precipitation_probability:nil(),shortwave_radiation:nil(),uv_index:nil()};
 HOURLY_CACHE.set(point,h);return h;
}
// Selects the current hourly forecast, without interpolating or changing source values.
// `at` can be a selected simulation time; `now` is the real clock for download age.
export function tjPointWeather(dataset,point,at=Date.now(),now=Date.now()){
 if(!point||!isNumber(at)||!isNumber(now))return null;
 const times=parsedTimes(dataset),seconds=at/1000;
 if(seconds<times[0]||seconds>=times.at(-1)+3600)return null;
 let index=times.length-1;while(index>0&&times[index]>seconds)index--;
 const r=point.values[index],downloadedAt=Date.parse(dataset.downloadedAt),age=now-downloadedAt;
 const stale=age< -15*60000||age>TJ_SNAPSHOT_MAX_AGE_MS||seconds-times[index]>90*60;
 return {temperature_2m:r[0],relative_humidity_2m:r[1],precipitation_intensity:r[2],wind_gusts_10m:r[3],wind_speed_10m:r[4],
  // tp is an intensity (mm/hr), NOT a current interval precipitation amount.
  precipitation:null,apparent_temperature:null,shortwave_radiation:null,uv_index:null,precipitation_probability:null,cloud_cover:null,weather_code:null,wind_direction_10m:null,is_day:null,
  time:times[index],latitude:point.lat,longitude:point.lon,coordinateKind:'requested_forecast_point',hourly:hourlyFor(dataset,point),
  current_units:{temperature_2m:'°C',relative_humidity_2m:'%',wind_speed_10m:'m/s',wind_gusts_10m:'m/s',precipitation_intensity:'mm/hr'},
  fetchedAt:downloadedAt,downloadedAt,snapshotAgeHours:Math.max(0,age/3600000),stale,provider:'tjweather',source:'tjweather downloaded forecast snapshot',snapshot:true,retainedResolutionMinutes:60,sourceResolutionMinutes:15};
}
export function tjWeatherReport(dataset,people=[],at=Date.now(),now=Date.now()){
 const points=dataset.points.map((p,i)=>({id:'tj-'+i,name:'气象预报点 '+(i+1),en:'Forecast point '+(i+1),lon:p.lon,lat:p.lat,weather:tjPointWeather(dataset,p,at,now)}));
 return {computedAt:now,transport:'snapshot',source:'tjweather downloaded forecast snapshot',weatherAvailable:points.some(p=>p.weather),snapshot:true,downloadedAt:Date.parse(dataset.downloadedAt),points,
  people:people.map(p=>{const nearest=nearestTjPoint(dataset,p.lon,p.lat),index=dataset.points.indexOf(nearest);return {...p,pointId:'tj-'+index,weather:points[index]?.weather||null};}),
  crowd:{available:false,source:null,updatedAt:null}};
}
