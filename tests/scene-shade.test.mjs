import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../public/assets/three.module.js';
import {solarPosition} from '../public/solar.js';
import {createSceneShade,localThermalEstimate,solarRadiation} from '../public/scene-shade.js';
const noon=Date.parse('2026-06-21T12:00:00+08:00');
test('West Lake solar direction has east morning, south noon and no night direct sun',()=>{
 const morning=solarPosition(Date.parse('2026-06-21T08:00:00+08:00'));assert.ok(morning.direction[0]>0);const n=solarPosition(noon);assert.ok(n.elevation>80&&n.direction[2]>0);assert.equal(solarPosition(Date.parse('2026-06-21T00:00:00+08:00')).daylight,false);
});
test('exact instanced visible geometry occludes body samples, moving clear removes shade',()=>{
 const root=new T.Group(),mesh=new T.InstancedMesh(new T.BoxGeometry(.1,.02,.1),new T.MeshStandardMaterial(),2);mesh.castShadow=true;
 mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(0,.08,0));mesh.setMatrixAt(1,new T.Matrix4().makeTranslation(1,.08,0));root.add(mesh);
 const field=createSceneShade(root);assert.equal(field.count,2);assert.equal(field.sample([0,0,0],noon).shade,1);assert.equal(field.sample([2,0,0],noon).shade,0);
 const night=field.sample([0,0,0],Date.parse('2026-06-21T00:00:00+08:00'));assert.equal(night.shade,0);
});
test('shade changes local radiative UTCI without changing original weather; missing radiation uses an explicitly labelled clear-sky model',()=>{
 const w={temperature_2m:35,relative_humidity_2m:60,wind_speed_10m:1,shortwave_radiation:800,apparent_temperature:40,stale:false};
 const clear=localThermalEstimate(w,{sun:{daylight:true},shade:0,time:noon}),shade=localThermalEstimate(w,{sun:{daylight:true},shade:1,time:noon});
 assert.ok(shade.value<clear.value);assert.ok(shade.tmrt<clear.tmrt);assert.equal(w.apparent_temperature,40);assert.equal(w.temperature_2m,35);const fallback=localThermalEstimate({...w,shortwave_radiation:null},{sun:{daylight:true,elevation:60},shade:1,time:noon});assert.ok(fallback.radiationEstimated);assert.ok(fallback.inputRadiation>0);
});

test('manual noon uses selected-hour or model radiation rather than current-night zero',()=>{
 const w={temperature_2m:28,relative_humidity_2m:60,wind_speed_10m:1,shortwave_radiation:0,stale:false},sun={daylight:true,elevation:70};
 const open=localThermalEstimate(w,{sun,shade:0,time:noon},{preview:true}),shade=localThermalEstimate(w,{sun,shade:1,time:noon},{preview:true});assert.ok(open.inputRadiation>800);assert.ok(shade.value<open.value);assert.ok(shade.shadeDelta<0);
 assert.equal(solarRadiation(w,sun).total,0);assert.equal(solarRadiation(w,{daylight:false,elevation:-20},{preview:true}).total,0);
 assert.equal(solarRadiation({...w,hourly:{time:[noon/1000],shortwave_radiation:[650]}},sun,{preview:true,time:noon}).total,650);
});
