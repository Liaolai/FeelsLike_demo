// Weather definitions and validation shared by browser and service.
export const POINTS=[{id:'north',name:'西湖北岸',en:'North shore',lat:30.264,lon:120.145},{id:'south',name:'西湖南岸',en:'South shore',lat:30.231,lon:120.145},{id:'west',name:'西湖西岸',en:'West shore',lat:30.249,lon:120.123}];
export const FIELDS=['temperature_2m','relative_humidity_2m','apparent_temperature','precipitation','weather_code','cloud_cover','wind_speed_10m','wind_direction_10m','wind_gusts_10m','is_day'];
export const HOURLY=[...FIELDS.filter(x=>x!=='is_day'),'shortwave_radiation','uv_index','precipitation_probability'];
export function weatherURL(){return 'https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:POINTS.map(p=>p.lat).join(','),longitude:POINTS.map(p=>p.lon).join(','),current:FIELDS.join(','),hourly:HOURLY.join(','),forecast_days:'3',timezone:'Asia/Shanghai',timeformat:'unixtime',wind_speed_unit:'ms'});}
export function validateWeather(data){
 const a=Array.isArray(data)?data:[data];
 if(a.length!==POINTS.length)throw Error('Weather point count mismatch');
 for(const p of a){
  if(!p.current||!Number.isFinite(p.current.time)||p.current.time*1000>Date.now()+15*60000||!Array.isArray(p.hourly?.time)||!p.hourly.time.length||!p.hourly.time.every((t,i)=>Number.isFinite(t)&&(!i||t>p.hourly.time[i-1]))||!FIELDS.every(k=>Number.isFinite(p.current[k]))||!HOURLY.every(k=>Array.isArray(p.hourly[k])&&p.hourly[k].length===p.hourly.time.length&&p.hourly[k].every(Number.isFinite)))throw Error('Incomplete weather response');
  if(p.current.relative_humidity_2m<0||p.current.relative_humidity_2m>100||p.current.wind_speed_10m<0||p.current.wind_gusts_10m<0||p.hourly.precipitation_probability.some(v=>v<0||v>100)||p.hourly.uv_index.some(v=>v<0)||p.hourly.shortwave_radiation.some(v=>v<0))throw Error('Invalid weather values');
  if(p.current_units?.wind_speed_10m&&p.current_units.wind_speed_10m!=='m/s')throw Error('Unexpected wind unit');
 }
 return a;
}
export function pointWeather(p,fetchedAt,now=Date.now()){
 const hour=p.hourly.time.reduce((best,t,i)=>Math.abs(t-p.current.time)<Math.abs(p.hourly.time[best]-p.current.time)?i:best,0);
 const aligned=Math.abs(p.hourly.time[hour]-p.current.time)<=3600;
 return {...p.current,shortwave_radiation:aligned?p.hourly.shortwave_radiation?.[hour]??null:null,uv_index:aligned?p.hourly.uv_index?.[hour]??null:null,precipitation_probability:aligned?p.hourly.precipitation_probability?.[hour]??null:null,latitude:p.latitude,longitude:p.longitude,elevation:p.elevation,current_units:p.current_units,hourly:p.hourly,fetchedAt,stale:!Number.isFinite(p.current.time)||now-p.current.time*1000>90*60000||p.current.time*1000-now>15*60000};
}

export function retryDelay(value,now=Date.now()){const seconds=Number(value),date=Date.parse(value);const ms=value&&Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-now:15*60000;return Math.min(24*3600000,Math.max(60000,ms));}
