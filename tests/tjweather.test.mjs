import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateTjWeather,nearestTjPoint,tjPointWeather,tjWeatherReport,TJ_SNAPSHOT_MAX_AGE_MS} from '../public/tjweather.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/assets/tjweather.json',import.meta.url),'utf8'));
const downloaded=Date.parse(data.downloadedAt);
test('all 81 downloaded grids retain original hourly values and a truthful snapshot source',()=>{
 validateTjWeather(data);assert.equal(data.points.length,81);assert.equal(data.times.length,240);
 const p=nearestTjPoint(data,120.14,30.25),at=Date.parse('2026-11-16T00:20:00+08:00'),w=tjPointWeather(data,p,at,downloaded);
 const i=data.times.findIndex(t=>t==='2026-11-16T00:00+08:00');assert.equal(w.temperature_2m,p.values[i][0]);assert.equal(w.wind_speed_10m,p.values[i][4]);assert.equal(w.precipitation_intensity,p.values[i][2]);assert.equal(w.precipitation,null);assert.equal(w.uv_index,null);assert.equal(w.apparent_temperature,null);assert.equal(w.snapshot,true);assert.equal(w.stale,false);
});
test('snapshot age and selected forecast coverage are separate, without rolling dates forward',()=>{
 const at=Date.parse('2026-11-16T00:20:00+08:00'),p=data.points[0];assert.equal(tjPointWeather(data,p,at,downloaded+TJ_SNAPSHOT_MAX_AGE_MS+1).stale,true);
 assert.equal(tjPointWeather(data,p,Date.parse('2026-12-01T00:00:00+08:00'),downloaded),null);
 assert.equal(tjPointWeather(data,p,Date.parse('2026-11-01T00:00:00+08:00'),downloaded),null);
});
test('person selection uses the nearest requested grid, with no spatial temperature fabrication',()=>{
 const at=Date.parse('2026-11-16T00:20:00+08:00'),report=tjWeatherReport(data,[{id:'me',lon:120.14,lat:30.25,activity:'walk'}],at,downloaded);
 const point=report.points.find(p=>p.id===report.people[0].pointId);assert.equal(point.lon,120.14);assert.equal(point.lat,30.25);assert.equal(point.weather,report.people[0].weather);assert.equal(report.snapshot,true);
});
