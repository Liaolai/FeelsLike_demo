import test from 'node:test';
import assert from 'node:assert/strict';
import {healthAdvice,adviceContext} from '../ai-health.mjs';
import {buildAdviceSnapshot} from '../public/advice-snapshot.js';
const req=(body,id='test')=>new Request('https://example.test/api/health-advice',{method:'POST',headers:{origin:'https://example.test','cf-connecting-ip':id},body:JSON.stringify(body)});
test('advice requires explicit send action and hides key and upstream errors',async()=>{
 assert.equal((await healthAdvice(req({consent:true}),{})).status,503);
 assert.equal((await healthAdvice(req({}),{DEEPSEEK_API_KEY:'secret'})).status,400);
 const r=await healthAdvice(req({consent:true},'failure'),{DEEPSEEK_API_KEY:'secret'},async()=>new Response('private provider detail',{status:401}));assert.equal(r.status,502);assert.equal((await r.text()).includes('secret'),false);
});
test('full visitor snapshot reaches the provider with source, observation and preview distinctions',async()=>{
 const now=Date.now(),state={lang:'zh',positions:[{id:'me',lon:120.14,lat:30.25,activity:'walk'}],healthProfiles:{me:{conditions:['hypertension']}},bodyProfiles:{me:{heightCm:170,weightKg:65,age:30,sex:'male'}},feedback:{me:{feel:'hot',at:now,activity:'walk'}},measurements:{me:{temperature:34,humidity:60,wind:1,at:now,lon:120.14,lat:30.25}},moods:{me:'tired'},water:{me:now-60000},timer:true,lastReminder:now-60000,shadowPreview:now,weatherProvider:'tjweather',outfit:'light',avatarId:'plain',road:{name:'苏堤',kind:'footway'},routeReport:{destination:'平湖秋月',meters:120},routeRunning:true};
 const w={temperature_2m:33,apparent_temperature:38,relative_humidity_2m:60,wind_speed_10m:1,stale:false,time:now/1000,provider:'tjweather',snapshot:true,downloadedAt:now-3600000,hourly:{time:[Math.ceil(now/3600000)*3600],temperature_2m:[34],apparent_temperature:[39]}};
 const d={weather:w,adviceWeather:w,warningWeather:w,observation:{active:true,status:'active',air:34,borrowedWind:false},shadeContext:{shade:.8,time:now,sun:{daylight:true,elevation:50}},geometryThermal:{value:35,shadeDelta:-3,radiationEstimated:true},environmentalReminder:{code:'heat',reasons:['heat']}};
 const payload=buildAdviceSnapshot(state,d,{doctorAdvice:'注意休息',question:'该去哪休息？',destination:{zh:'苏堤'},now});
 const c=adviceContext(payload);assert.equal(c.location.roadName,'苏堤');assert.equal(c.bodyProfile.age,30);assert.equal(c.metabolism.status,'ok');assert.equal(c.personal.mood,'tired');assert.equal(c.observation.record.temperature,34);assert.equal(c.observation.assessment.active,true);assert.equal(c.sunlight.mode,'preview');assert.equal(c.thermal.preview,true);assert.equal(c.regionalWeather.snapshot,true);assert.equal(c.forecast[0].temperature_2m,34);assert.equal(c.hydration.lastRecordedAt,now-60000);assert.equal(c.route.meters,120);assert.equal(c.crowd.available,false);assert.equal(c.feedback.active,true);
 let sent;const response=await healthAdvice(req(payload,'full-snapshot'),{DEEPSEEK_API_KEY:'secret'},async(url,init)=>{sent=JSON.parse(init.body);return Response.json({model:'deepseek-v4.1-flash',choices:[{message:{content:'非专业医疗建议。先去阴凉处休息。',reasoning_content:'hidden thoughts'}}]});});
 assert.equal(sent.model,'deepseek-v4-flash');assert.equal(sent.thinking.type,'enabled');assert.equal(sent.reasoning_effort,'medium');assert.ok(sent.max_tokens>=8192);const result=await response.json();assert.equal(result.reasoningEffort,'medium');assert.equal(result.effectiveReasoningEffort,'high');assert.equal(result.model,'deepseek-v4.1-flash');assert.match(result.disclaimer,/非专业医疗建议/);assert.ok(!JSON.stringify(result).includes('hidden thoughts'));
});
test('unknown fields stay out of context and expired feedback is explicitly inactive',()=>{
 const c=adviceContext({location:{kind:'virtual_character',lon:999,lat:30.25,apiKey:'never'},thermal:{value:30,private:'never'},feedback:{feel:'hot',at:1,activity:'walk'},forecast:Array.from({length:40},()=>({time:1,private:'never'}))});
 assert.equal(c.location.lon,null);assert.equal(c.location.apiKey,undefined);assert.equal(c.thermal.private,undefined);assert.equal(c.bodyProfile,null);assert.equal(c.regionalWeather.stale,true);assert.equal(c.feedback.active,false);assert.equal(c.forecast.length,24);assert.ok(!JSON.stringify(c).includes('never'));
});
test('server filters context and retains fluid restriction, freshness and rest plan',async()=>{
 const c=adviceContext({health:{conditions:['heart'],fluidRestricted:true},weather:{temperature_2m:35,stale:false,private:'no'},activity:'walk',doctorAdvice:'Follow my plan'});
 assert.equal(c.plan.minutes,15);assert.equal(c.plan.mode,'rest');assert.equal(c.weather.private,undefined);assert.equal(c.weather.stale,false);
 let sent;const r=await healthAdvice(req({consent:true,health:c.health,weather:c.weather},'success'),{DEEPSEEK_API_KEY:'secret'},async(url,init)=>{sent=JSON.parse(init.body);return Response.json({choices:[{message:{content:'Take a shaded break.'}}]});});
 assert.equal(r.status,200);assert.equal(sent.messages[1].content.includes('fluidRestricted'),true);assert.equal((await r.json()).text,'Take a shaded break.');
 assert.equal((await healthAdvice(req({consent:true},'success'),{DEEPSEEK_API_KEY:'secret'})).status,429);
});
