// Shared product triggers for the API, avatar bubbles and local health advice.
export function temperatureSignal(weather){
 if(!weather||weather.stale)return 'unknown';
 const air=weather.temperature_2m,feels=weather.apparent_temperature;
 if(!Number.isFinite(air)&&!Number.isFinite(feels))return 'unknown';
 if(Number.isFinite(air)&&air>=32||Number.isFinite(feels)&&feels>=32)return 'heat';
 if(Number.isFinite(air)&&air<=10||Number.isFinite(feels)&&feels<=5)return 'cold';
 return 'comfortable';
}
export function weatherTriggers(weather,activity='walk'){
 const signal=temperatureSignal(weather);if(signal==='unknown')return [];
 const reasons=[];if(signal==='heat')reasons.push('heat');
 if(Number.isFinite(weather.wind_gusts_10m)&&weather.wind_gusts_10m>=12)reasons.push('wind');
 if(signal==='cold')reasons.push('cold');
 if(activity==='run'&&Number.isFinite(weather.apparent_temperature)&&weather.apparent_temperature>=26)reasons.push('activity');
 if(Number.isFinite(weather.precipitation_probability)&&weather.precipitation_probability>=60||Number.isFinite(weather.precipitation)&&weather.precipitation>.5)reasons.push('rain');
 if(Number.isFinite(weather.uv_index)&&weather.uv_index>=6)reasons.push('uv');return reasons;
}
export function environmentReminder(weather,activity='walk'){
 if(temperatureSignal(weather)==='unknown')return {level:'unknown',code:'unknown',reasons:['missing']};
 const reasons=weatherTriggers(weather,activity);
 return {level:reasons.some(r=>r==='heat'||r==='activity')?'attention':reasons.length?'notice':'routine',code:reasons[0]||'routine',reasons};
}
export function feedbackIsCurrent(feedback,activity,now=Date.now()){
 return !!feedback&&['cold','fine','hot'].includes(feedback.feel)&&Number.isFinite(feedback.at)&&feedback.at<=now&&now-feedback.at<=2*3600000&&(!feedback.activity||feedback.activity===activity);
}
export function applyComfortFeedback(reminder,feedback,activity,now=Date.now()){
 if(!feedbackIsCurrent(feedback,activity,now))return {reminder,personalization:{active:false}};
 const personalization={active:true,feel:feedback.feel,at:feedback.at,activity,ageMinutes:Math.floor((now-feedback.at)/60000),basis:'Self-reported comfort in the same activity, valid for 2 hours'};
 if(feedback.feel==='hot'&&['routine','activity','unknown'].includes(reminder.code))return {reminder:{...reminder,code:'personalHot',level:'attention',reasons:[...reminder.reasons,'personalHot']},personalization};
 if(feedback.feel==='cold'&&reminder.code==='routine')return {reminder:{...reminder,code:'personalCold',level:'notice',reasons:[...reminder.reasons,'personalCold']},personalization};
 return {reminder,personalization};
}
export function forecastRows(weather,now=Date.now()){
 const h=weather?.hourly;if(!Array.isArray(h?.time)||!Array.isArray(h?.apparent_temperature))return [];
 const start=Math.ceil(now/3600000)*3600,end=start+24*3600;
 return h.time.map((time,i)=>({time,temp:h.apparent_temperature[i]})).filter(p=>Number.isFinite(p.time)&&p.time>=start&&p.time<end&&Number.isFinite(p.temp));
}
export function nearestForecastPoint(points,lon,lat){return points.reduce((best,p)=>Math.hypot((p.lon-lon)*96400,(p.lat-lat)*111320)<Math.hypot((best.lon-lon)*96400,(best.lat-lat)*111320)?p:best,points[0]);}
