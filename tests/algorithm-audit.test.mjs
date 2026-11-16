import test from 'node:test';import assert from 'node:assert/strict';
import {temperatureSignal,forecastRows,nearestForecastPoint} from '../public/climate.js';
import {reminderFor,personalize,pointWeather,validateWeather,POINTS,FIELDS,HOURLY} from '../api.mjs';
import {avatarExpression} from '../public/mood.js';import {healthSupport,normalizeHealth} from '../public/health.js';
import {telemetryPeople,currentPersonReport} from '../public/telemetry.js';
const normal={temperature_2m:22,apparent_temperature:22,uv_index:2,precipitation_probability:0,precipitation:0,wind_gusts_10m:3};
test('API, bubble and health module use the same heat/cold boundaries, including zero and null',()=>{
 for(const [patch,signal] of [[{temperature_2m:32},'heat'],[{apparent_temperature:32},'heat'],[{temperature_2m:10},'cold'],[{apparent_temperature:5},'cold'],[{temperature_2m:0},'cold'],[{temperature_2m:null,apparent_temperature:null},'unknown'],[{stale:true,temperature_2m:40},'unknown']]){
  const w={...normal,...patch};assert.equal(temperatureSignal(w),signal);assert.equal(reminderFor(w).code,signal==='unknown'?'unknown':signal);assert.equal(avatarExpression({weather:w}).kind,signal==='unknown'?'thought':signal);assert.equal(healthSupport({conditions:['heart']},w).hot,signal==='heat');
 }
});
test('warm feedback retains wind, rain, UV and cold warnings and all concurrent reasons',()=>{
 const now=Date.now(),feedback={feel:'hot',at:now,activity:'walk'};
 for(const patch of [{wind_gusts_10m:12},{precipitation_probability:60},{uv_index:6},{temperature_2m:8}]){const r=reminderFor({...normal,...patch});assert.equal(personalize(r,feedback,'walk',now).reminder.code,r.code);}
 assert.deepEqual(reminderFor({...normal,temperature_2m:35,wind_gusts_10m:14,uv_index:8,precipitation_probability:90}).reasons,['heat','wind','rain','uv']);
});
test('24-hour forecast begins at the next hour and never wraps back to old data',()=>{
 const start=Date.UTC(2026,10,15,2),w={hourly:{time:Array.from({length:72},(_,i)=>start/1000+i*3600),apparent_temperature:Array.from({length:72},(_,i)=>i)}};
 const rows=forecastRows(w,start+30*60000);assert.equal(rows.length,24);assert.equal(rows[0].time,start/1000+3600);assert.equal(rows.at(-1).time,start/1000+24*3600);assert.deepEqual(forecastRows(w,start+80*3600000),[]);
});
test('forecast validation rejects null samples, impossible percentages, wrong units and future clock errors',()=>{
 const make=()=>POINTS.map(()=>({latitude:30.26,longitude:120.14,current:{time:Date.now()/1000,...Object.fromEntries(FIELDS.map(k=>[k,1]))},current_units:{wind_speed_10m:'m/s'},hourly:{time:[Date.now()/1000],...Object.fromEntries(HOURLY.map(k=>[k,[1]]))}}));
 assert.equal(validateWeather(make()).length,3);
 for(const change of [p=>p.hourly.uv_index[0]=null,p=>p.current.relative_humidity_2m=101,p=>p.current_units.wind_speed_10m='km/h',p=>p.current.time+=3600,p=>p.hourly.precipitation_probability[0]=-1]){const points=make();change(points[0]);assert.throws(()=>validateWeather(points));}
});
test('stale or unaligned hourly values cannot be presented as current UV or radiation',()=>{
 const now=Date.now(),p={current:{time:now/1000,...normal},hourly:{time:[now/1000-7200],uv_index:[9],shortwave_radiation:[800],precipitation_probability:[90]}};
 const w=pointWeather(p,now,now);assert.equal(w.uv_index,null);assert.equal(w.shortwave_radiation,null);assert.equal(pointWeather({...p,current:{...p.current,time:now/1000+3600}},now,now).stale,true);
});
test('nearest weather point uses physical distance rather than raw longitude/latitude degrees',()=>{const points=[{id:'east',lon:120.01,lat:30},{id:'north',lon:120,lat:30.009}];assert.equal(nearestForecastPoint(points,120,30).id,'east');});
test('healthy excludes illness advice; a cold requests rest; other text is retained without interpreting it',()=>{
 assert.equal(healthSupport({conditions:['healthy']},normal).active,false);assert.doesNotMatch(healthSupport({conditions:['healthy']},normal).zh,/常用药/);
 assert.deepEqual(normalizeHealth({conditions:['healthy','cold']}).conditions,['cold']);assert.deepEqual(normalizeHealth({conditions:['healthy'],fluidRestricted:true}).conditions,[]);
 assert.match(healthSupport({conditions:['cold']},normal).zh,/在家休息/);
 const other=normalizeHealth({conditions:['other','toString'],otherText:'  出门要带护具  '});assert.equal(other.otherText,'出门要带护具');assert.deepEqual(other.conditions,['other']);assert.equal(normalizeHealth({conditions:['healthy'],otherText:'旧记录'}).otherText,'');
});
test('health, free text and body details are excluded from outgoing telemetry',()=>{
 const out=telemetryPeople([{id:'me',lon:120.14,lat:30.24,activity:'walk',healthProfiles:{conditions:['heart']},otherText:'私密说明',weightKg:65}],{me:{feel:'fine',at:123,activity:'walk',otherText:'私密说明'}});
 assert.deepEqual(Object.keys(out[0]),['id','lon','lat','activity','feedback']);assert.deepEqual(Object.keys(out[0].feedback),['feel','at','activity']);assert.doesNotMatch(JSON.stringify(out),/私密|heart|weightKg/);
});
test('late server responses cannot restore deleted, replaced, expired or different-activity feedback',()=>{
 const now=Date.now(),feedback={feel:'hot',at:now,activity:'walk'},report={weather:normal,activity:'walk',...personalize(reminderFor(normal),feedback,'walk',now)},position={activity:'walk'};
 assert.equal(currentPersonReport(report,position,feedback,now).reminder.code,'personalHot');
 for(const [p,f,t] of [[position,null,now],[position,{...feedback,feel:'cold'},now],[position,feedback,now+3*3600000],[{activity:'rest'},feedback,now]])assert.notEqual(currentPersonReport(report,p,f,t).reminder.code,'personalHot');
});
