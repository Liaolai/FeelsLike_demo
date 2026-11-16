import fs from 'node:fs';
import {tjWeatherReport} from '../public/tjweather.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {temperaturePoints,nearestTemperature,temperatureColor,temperatureDomain} from '../public/temperature-map.js';
const now=1800000000000,weather={time:now/1000,latitude:30.263618,longitude:120.14051,temperature_2m:16.7,apparent_temperature:16.6};
test('temperature map merges three requests for one returned grid rather than inventing three local temperatures',()=>{
 const report={points:['north','south','west'].map(id=>({id,weather:{...weather}}))},copy=structuredClone(report),points=temperaturePoints(report,now);
 assert.equal(points.length,1);assert.deepEqual(points[0].requests,['north','south','west']);assert.equal(points[0].air,16.7);assert.equal(points[0].feels,16.6);assert.deepEqual(report,copy);
 for(const c of [[120.11,30.22],[120.17,30.28],[120.145,30.249]])assert.equal(nearestTemperature(points,...c).air,16.7);
});
test('temperature map omits missing, stale, future or invalid data and does not borrow local body feedback',()=>{
 for(const patch of [{stale:true},{time:(now-5400001)/1000},{time:(now+900001)/1000},{temperature_2m:null,apparent_temperature:null},{latitude:null}])assert.equal(temperaturePoints({points:[{weather:{...weather,...patch}}]},now).length,0);
 assert.deepEqual(temperaturePoints(null,now),[]);assert.equal(nearestTemperature([],120.14,30.25),null);
 const r=temperaturePoints({points:[{weather:{...weather,apparent_temperature:null}}],measurements:{me:{temperature:40}},feedback:{me:{feel:'hot'}}},now);assert.equal(r[0].air,16.7);assert.equal(r[0].feels,null);
});
test('temperature colour has a fixed shared scale, accepts zero, uses an alternate accessible palette and treats missing data as grey',()=>{
 assert.equal(temperatureColor(-10),'#29245c');assert.equal(temperatureColor(40),'#f9dc91');assert.equal(temperatureColor(-40),temperatureColor(-10));assert.equal(temperatureColor(60),temperatureColor(40));
 assert.notEqual(temperatureColor(0),temperatureColor(null));assert.equal(temperatureColor(null),'#e1e5df');assert.notEqual(temperatureColor(20,'accessible'),temperatureColor(20));assert.equal(temperatureColor(20,'mono'),temperatureColor(20,'accessible'));
});

test('local colour domain is scoped to the map and leaves source values and missing values intact',()=>{
 const points=[{lon:120.14,lat:30.25,air:14,feels:null},{lon:120.15,lat:30.25,air:15,feels:null},{lon:121,lat:31,air:40,feels:45}],copy=structuredClone(points),bbox=[120.108,30.215,120.176,30.281];
 const domain=temperatureDomain(points,'air',{scopeBBox:bbox});assert.deepEqual(domain,[14,15]);
 assert.equal(temperatureColor(14,'normal',domain),temperatureColor(-10));assert.equal(temperatureColor(15,'normal',domain),temperatureColor(40));
 assert.equal(temperatureColor(null,'normal',domain),'#e1e5df');assert.deepEqual(points,copy);assert.deepEqual(temperatureDomain(points,'feels',{scopeBBox:bbox}),[-10,40]);
});
test('local domain preserves equal-temperature colours and uses at least a one-degree display span',()=>{
 for(const points of [[{air:16},{air:16}],[{air:16},{air:16.2}]]){const domain=temperatureDomain(points,'air');assert.ok(domain[1]-domain[0]>=1);assert.equal(temperatureColor(16,'normal',domain),temperatureColor(16,'normal',domain));}
 const domain=temperatureDomain([{air:16},{air:16}]);assert.deepEqual(domain,[15.5,16.5]);assert.deepEqual(temperatureDomain([]),[-10,40]);
});
test('the actual tjweather snapshot has a measurable West Lake air-temperature range at its download time',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/assets/tjweather.json',import.meta.url),'utf8')),bbox=JSON.parse(fs.readFileSync(new URL('../public/assets/westlake.json',import.meta.url),'utf8')).bbox,at=Date.parse(data.downloadedAt);
 const points=temperaturePoints(tjWeatherReport(data,[],at,at),at),scoped=points.filter(p=>p.lon>=bbox[0]&&p.lon<=bbox[2]&&p.lat>=bbox[1]&&p.lat<=bbox[3]),values=scoped.map(p=>p.air);
 assert.equal(scoped.length,49);const min=Math.min(...values),max=Math.max(...values);assert.ok(Math.abs(min-14.175835)<1e-7);assert.ok(Math.abs(max-15.5375595)<1e-7);assert.ok(Math.abs(max-min-1.3617245)<1e-7);
 const domain=temperatureDomain(points,'air',{scopeBBox:bbox});assert.deepEqual(domain,[min,max]);assert.notEqual(temperatureColor(min,'normal',domain),temperatureColor(max,'normal',domain));
});

test('temperature sources retain missing metrics independently when reports share a coordinate',()=>{
 const r=temperaturePoints({points:[{id:'a',weather:{...weather,temperature_2m:null}},{id:'b',weather:{...weather,apparent_temperature:null}}]},now);
 assert.equal(r.length,1);assert.equal(r[0].air,16.7);assert.equal(r[0].feels,16.6);
 const onlyFeels=temperaturePoints({points:[{weather:{...weather,temperature_2m:null}}]},now);assert.equal(onlyFeels[0].air,null);assert.equal(onlyFeels[0].feels,16.6);
});
