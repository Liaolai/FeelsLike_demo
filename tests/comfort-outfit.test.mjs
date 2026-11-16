import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3} from '../public/assets/three.module.js';
import {AVATARS,createAvatar,disposeAvatar} from '../public/avatar.js';
import {apparentEstimate,observationContext,personComfort,reminderPlan} from '../public/comfort.js';
import {recommendOutfit} from '../public/outfit.js';
import {TEXT} from '../public/copy.js';
const now=1800000000000,p={id:'me',lon:120.149,lat:30.260,activity:'walk'},weather={temperature_2m:24,apparent_temperature:24,relative_humidity_2m:60,wind_speed_10m:1,shortwave_radiation:0},obs={temperature:35,at:now,lon:p.lon,lat:p.lat};

test('local apparent estimate follows the provider equation, including calm and zero humidity',()=>{
 const expected=30+.348*(.6*6.105*Math.exp(17.27*30/(237.7+30)))-.7*1.5-4.25;
 assert.ok(Math.abs(apparentEstimate(30,60,2,0)-expected)<1e-10);
 assert.equal(apparentEstimate(0,0,0),-4.25);
 assert.ok(apparentEstimate(30,60,2,900)>apparentEstimate(30,60,2));
 for(const args of [[30,null,1],[61,50,1],[20,101,1],[20,50,-1]])assert.equal(apparentEstimate(...args),null);
});
test('observations expire after 30 minutes or a 100 metre move and reject future/invalid readings',()=>{
 assert.equal(observationContext(obs,p,weather,now).active,true);
 assert.equal(observationContext({...obs,at:now-1800001},p,weather,now).status,'expired');
 assert.equal(observationContext({...obs,at:now+1},p,weather,now).active,false);
 assert.equal(observationContext(obs,{...p,lon:p.lon+.002},weather,now).status,'moved');
 assert.equal(observationContext({...obs,humidity:101},p,weather,now).status,'invalid');
});
test('missing local humidity/wind use fresh weather only; unknown inputs never fabricate a local estimate',()=>{
 const fresh=observationContext(obs,p,weather,now);assert.equal(fresh.borrowedHumidity,true);assert.equal(fresh.borrowedWind,true);assert.ok(Number.isFinite(fresh.apparent));
 const stale=observationContext(obs,p,{...weather,stale:true},now);assert.equal(stale.active,true);assert.equal(stale.apparent,null);
 const measured=observationContext({...obs,humidity:0,wind:0},p,null,now);assert.equal(measured.apparent,30.75);assert.equal(measured.borrowedHumidity,false);
});
test('a hotter reading updates local advice and warnings without changing the original weather',()=>{
 const original=structuredClone(weather),d=personComfort({weather},p,null,obs,now);
 assert.equal(d.reminder.code,'heat');assert.equal(d.weather,weather);assert.deepEqual(weather,original);assert.equal(d.adviceWeather.temperature_2m,35);
 assert.equal(personComfort({weather:{...weather,temperature_2m:36}},p,null,{...obs,temperature:22},now).reminder.code,'heat');
});
test('categorical hot/cold feedback changes advice and outfits without inventing a Celsius offset',()=>{
 const feedback={feel:'hot',activity:'walk',at:now},d=personComfort({weather},p,feedback,null,now);
 assert.equal(d.reminder.code,'personalHot');assert.equal(d.weather.apparent_temperature,24);
 assert.ok(recommendOutfit(d.adviceWeather,feedback,'walk',null,now).items.some(x=>x.key==='feelHot'));
 assert.equal(personComfort({weather},p,{...feedback,activity:'run'},null,now).reminder.code,'routine');
 assert.equal(personComfort({weather},p,{...feedback,at:now-7200001},null,now).personalization.active,false);
});
test('health and heat change the actual reminder interval and fluid restriction changes its message',()=>{
 const hot={temperature_2m:35};
 assert.equal(reminderPlan({conditions:['heart']},hot,null,'walk',now).minutes,15);
 assert.equal(reminderPlan({conditions:['healthy']},hot,null,'walk',now).minutes,30);
 assert.equal(reminderPlan({conditions:['hypertension']},weather,{feel:'hot',at:now},'walk',now).minutes,15);
 assert.equal(reminderPlan({conditions:['heart']},weather,null,'walk',now).minutes,30);
 const restricted=reminderPlan({fluidRestricted:true},hot,null,'walk',now);assert.equal(restricted.mode,'rest');assert.match(restricted.zh,/医生/);
 assert.equal(reminderPlan({conditions:['cold']},weather,null,'walk',now).mode,'rest');
});
test('outfit band boundaries and weather additions are deterministic; stale/missing weather cannot be tried on',()=>{
 for(const [t,key]of [[-1,'freezing'],[0,'cold'],[10,'cool'],[16,'mild'],[22,'warm'],[28,'hot']])assert.equal(recommendOutfit({apparent_temperature:t}).key,key);
 const r=recommendOutfit({...weather,wind_speed_10m:6,precipitation_probability:60,uv_index:6},{feel:'cold',at:now},'run',{conditions:['cold']},now);
 assert.deepEqual(r.items.map(x=>x.key),['wind','rain','sun','activity','feelCold','health']);
 assert.equal(recommendOutfit(null).available,false);assert.equal(recommendOutfit({...weather,stale:true}).available,false);
 assert.equal(recommendOutfit(weather,{feel:'hot',at:now-7200001},'walk',null,now).items.length,0);
});
test('all nine selectable reference characters have four articulated limbs and a 1.7m standing height',()=>{
 assert.equal(AVATARS.length,9);assert.equal(new Set(AVATARS.map(a=>a.id)).size,9);
 for(const a of AVATARS)for(const wear of ['reference','light','layers','insulated']){const model=createAvatar(a.id,wear,1),box=new Box3().setFromObject(model);assert.ok(Math.abs(box.max.y-box.min.y-1.7)<1e-8,a.id);assert.equal(model.userData.limbs.length,4);assert.equal(model.userData.avatarId,a.id);disposeAvatar(model);}
});
test('the UI has every referenced element, unique IDs, and bilingual copy for every marked label',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 for(const [,id] of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id)||id==='avatarOpen',id);
 for(const [,key]of html.matchAll(/data-(?:placeholder-)?i="([^"]+)"/g))assert.ok(TEXT[key]?.length===2,key);
});
