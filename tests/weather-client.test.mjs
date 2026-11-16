import test from 'node:test';import assert from 'node:assert/strict';
import {createWeatherClient,browserWeatherReport} from '../public/weather-client.js';
import {POINTS,FIELDS,HOURLY,retryDelay} from '../public/weather-data.js';
function forecast(now){return POINTS.map(()=>({latitude:30.26,longitude:120.14,current:{time:now/1000,...Object.fromEntries(FIELDS.map(k=>[k,1]))},current_units:{wind_speed_10m:'m/s'},hourly:{time:[now/1000],...Object.fromEntries(HOURLY.map(k=>[k,[1]]))}}));}
function memory(){let value=null;return {getItem(){return value;},setItem(k,v){value=v;}};}
test('browser weather reuses one request for simultaneous calls, five-second reports and reloads within ten minutes',async()=>{
 let now=Date.now(),calls=0;const storage=memory(),fetcher=async url=>{calls++;assert.match(url,/api\.open-meteo\.com/);return Response.json(forecast(now));};
 const client=createWeatherClient({fetcher,storage,now:()=>now});const [a,b]=await Promise.all([client.load(),client.load()]);assert.equal(a,b);now+=5000;await client.load();assert.equal(calls,1);
 const reloaded=createWeatherClient({fetcher,storage,now:()=>now});await reloaded.load();assert.equal(calls,1);now+=600001;await reloaded.load();assert.equal(calls,2);
});
test('429 Retry-After survives reload and manual refresh cannot bypass it',async()=>{
 let now=Date.now(),calls=0;const storage=memory(),fetcher=async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'120'}});};
 let client=createWeatherClient({fetcher,storage,now:()=>now});await assert.rejects(client.load());assert.equal(client.diagnostics().retryAt,now+120000);
 client=createWeatherClient({fetcher,storage,now:()=>now});await assert.rejects(client.load({force:true}));assert.equal(calls,1);now+=120001;await assert.rejects(client.load());assert.equal(calls,2);
});
test('a failed refresh retains weather with its original valid time and stale data stays stale',async()=>{
 let now=Date.now(),calls=0;const client=createWeatherClient({storage:memory(),now:()=>now,fetcher:async()=>{if(calls++)throw Error('offline');return Response.json(forecast(now));}});
 const cache=await client.load();now+=2*3600000;const retained=await client.load();assert.equal(retained.fetchedAt,cache.fetchedAt);const report=browserWeatherReport(retained,[{id:'me',lon:120.145,lat:30.26,activity:'walk'}],{},now);assert.equal(report.people[0].weather.stale,true);assert.equal(report.people[0].reminder.code,'unknown');
});
test('malformed upstream payload is rejected and no simulated forecast is created',async()=>{
 const client=createWeatherClient({storage:memory(),fetcher:async()=>Response.json({current:{temperature_2m:30}})});await assert.rejects(client.load());assert.equal(client.diagnostics().status,'unavailable');
});
test('retry intervals support seconds and HTTP dates with a lower bound',()=>{
 const now=Date.now();assert.equal(retryDelay('120',now),120000);assert.equal(retryDelay('0',now),60000);assert.ok(Math.abs(retryDelay(new Date(now+180000).toUTCString(),now)-180000)<1000);assert.equal(retryDelay(null,now),900000);
});
