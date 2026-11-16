import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWeatherGrid,sampleWeatherGrid,WEATHER_GRID_ORIGIN as O} from '../public/weather-grid.js';
const point=(x,y,air,feels=null)=>({lon:O.lon+x/O.metersPerLon,lat:O.lat+y/O.metersPerLat,air,feels,time:1800000000});
const scope=[O.lon,O.lat,O.lon+1000/O.metersPerLon,O.lat+1000/O.metersPerLat];
const square=[point(0,0,10,20),point(1000,0,20,30),point(0,1000,30,40),point(1000,1000,40,50)];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
test('IDW returns exact source values and the known linear-plane midpoint at equal distances',()=>{
 const g=buildWeatherGrid(square,{bbox:scope});for(const p of square){const r=sampleWeatherGrid(g,p.lon,p.lat);assert.equal(r.air,p.air);assert.equal(r.feels,p.feels);}
 const c=point(500,500);close(sampleWeatherGrid(g,c.lon,c.lat).air,25);close(sampleWeatherGrid(g,c.lon,c.lat).feels,35);assert.equal(g.sourceCount,4);assert.equal(g.interpolated,true);
});
test('physical grid nodes use 500 m origin-aligned steps and stay inside the source hull',()=>{
 const g=buildWeatherGrid(square,{bbox:scope});assert.equal(g.spacing,500);assert.equal(g.points.length,9);for(const p of g.points){close(p.x/500,Math.round(p.x/500));close(p.y/500,Math.round(p.y/500));}
 const xs=[...new Set(g.points.map(p=>p.x))].sort((a,b)=>a-b);for(let i=1;i<xs.length;i++)assert.equal(xs[i]-xs[i-1],500);
 const out=point(1001,500);assert.equal(sampleWeatherGrid(g,out.lon,out.lat),null);
 const boundary=point(0,500);close(sampleWeatherGrid(g,boundary.lon,boundary.lat).air,65/3);
});
test('equal values remain equal and duplicate grids do not acquire extra weight',()=>{
 const sources=square.map(p=>({...p,air:18})),copy=structuredClone(sources),g=buildWeatherGrid([...sources,sources[0]],{bbox:scope});assert.equal(g.sourceCount,4);for(const p of g.points)close(p.air,18);assert.deepEqual(sources,copy);
});
test('air and feels each use only their own valid source hull, with one-source uniform disclosure',()=>{
 const input=[point(0,0,10,null),point(1000,0,20,30),point(0,1000,null,40)],g=buildWeatherGrid(input,{bbox:scope});
 const mid=point(500,500),r=sampleWeatherGrid(g,mid.lon,mid.lat);assert.equal(r.air,null);close(r.feels,35);
 const single=buildWeatherGrid([point(0,0,18,null)],{bbox:scope}),u=sampleWeatherGrid(single,mid.lon,mid.lat);assert.equal(u.air,18);assert.equal(u.feels,null);assert.equal(single.interpolated,false);assert.equal(single.method,'uniform-single-source');
 assert.equal(sampleWeatherGrid(buildWeatherGrid([]),O.lon,O.lat),null);
});
test('a third far source cannot pull a collinear field off its supported segment',()=>{
 const g=buildWeatherGrid([point(0,0,10),point(500,0,20),point(1000,0,30)],{bbox:scope}),p=point(500,1);assert.equal(sampleWeatherGrid(g,p.lon,p.lat),null);
 const exact=point(500,0);assert.equal(sampleWeatherGrid(g,exact.lon,exact.lat).air,20);
});
