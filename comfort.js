import {environmentReminder,temperatureSignal,applyComfortFeedback,feedbackIsCurrent} from './climate.js';
import {normalizeHealth} from './health.js';
export const OBSERVATION_MAX_AGE_MS=30*60000,OBSERVATION_RADIUS_M=100;

// Same approximation used by Open-Meteo's published Meteorology.swift,
// inspected 2026-11-15. Optional radiation adds no term when unavailable.
export function apparentEstimate(air,humidity,wind10,solar){
 if(![air,humidity,wind10].every(Number.isFinite)||air< -50||air>60||humidity<0||humidity>100||wind10<0||wind10>75)return null;
 const vapor=humidity/100*6.105*Math.exp(17.27*air/(237.7+air)),wind2=wind10*.75,q=Number.isFinite(solar)?Math.max(0,.1*(solar-550)):0;
 return air+.348*vapor-.70*wind2+.70*q/(wind2+10)-4.25;
}
export function observationContext(observation,position,weather,now=Date.now()){
 if(!observation)return {active:false,status:'empty'};
 if(!Number.isFinite(observation.temperature)||observation.temperature< -50||observation.temperature>60||!Number.isFinite(observation.at)||![observation.lon,observation.lat,position?.lon,position?.lat].every(Number.isFinite)||observation.lon<120.108||observation.lon>120.176||observation.lat<30.215||observation.lat>30.281||observation.humidity!=null&&(!Number.isFinite(observation.humidity)||observation.humidity<0||observation.humidity>100)||observation.wind!=null&&(!Number.isFinite(observation.wind)||observation.wind<0||observation.wind>75))return {active:false,status:'invalid'};
 if(observation.at>now||now-observation.at>OBSERVATION_MAX_AGE_MS)return {active:false,status:'expired'};
 const distanceM=Math.hypot((position.lon-observation.lon)*96400,(position.lat-observation.lat)*111320);if(distanceM>OBSERVATION_RADIUS_M)return {active:false,status:'moved',distanceM};
 const regional=weather&&!weather.stale?weather:null,humidity=observation.humidity??regional?.relative_humidity_2m,wind=observation.wind??regional?.wind_speed_10m;
 const estimate=apparentEstimate(observation.temperature,humidity,wind,regional?.shortwave_radiation);
 const localWeather={...regional,temperature_2m:observation.temperature,relative_humidity_2m:humidity,wind_speed_10m:wind,apparent_temperature:estimate,stale:false};
 return {active:true,status:'active',distanceM,air:observation.temperature,apparent:estimate,humidity,wind,ageMinutes:Math.floor((now-observation.at)/60000),borrowedHumidity:observation.humidity==null&&Number.isFinite(humidity),borrowedWind:observation.wind==null&&Number.isFinite(wind),weather:localWeather};
}
export function personComfort(report,position,feedback,measurement,now=Date.now()){
 const forecast=report?.weather||null,local=observationContext(measurement,position,forecast,now),environments=[forecast,...(local.active?[local.weather]:[])],known=environments.filter(w=>temperatureSignal(w)!=='unknown');
 const reasons=new Set(known.flatMap(w=>environmentReminder(w,position.activity).reasons).filter(r=>r!=='missing'));
 const ordered=['heat','wind','cold','activity','rain','uv'].filter(r=>reasons.has(r));
 const environmentalReminder=known.length?{code:ordered[0]||'routine',level:ordered.some(r=>r==='heat'||r==='activity')?'attention':ordered.length?'notice':'routine',reasons:ordered}:{code:'unknown',level:'unknown',reasons:['missing']};
 const warningWeather=known.find(w=>temperatureSignal(w)==='heat')||known.find(w=>temperatureSignal(w)==='cold')||local.weather||forecast;
 return {...report,weather:forecast,observation:local,adviceWeather:local.active?local.weather:forecast,warningWeather,environmentalReminder,...applyComfortFeedback(environmentalReminder,feedback,position.activity,now)};
}
export function reminderPlan(profile,weather,feedback,activity,now=Date.now()){
 const health=normalizeHealth(profile),care=health.conditions.some(k=>['heart','hypertension','diabetes','kidney'].includes(k)),hot=temperatureSignal(weather)==='heat'||feedbackIsCurrent(feedback,activity,now)&&feedback.feel==='hot';
 const minutes=care&&hot?15:30,rest=health.fluidRestricted||health.conditions.includes('cold')||care&&hot;
 return {minutes,mode:rest?'rest':'water',zh:health.fluidRestricted?'歇一会儿，饮水按医生给你的安排来。':health.conditions.includes('cold')?'感冒这几天先好好休息。':rest?'到阴凉处歇歇，看看自己这会儿的感觉。':'走了好一会儿啦，喝口水，歇歇吧。',en:health.fluidRestricted?'Take a break and follow your clinician’s drinking plan.':health.conditions.includes('cold')?'Take it easy and rest while you have a cold.':rest?'Take a shady break and check how you feel.':'Time for a little water break.'};
}
