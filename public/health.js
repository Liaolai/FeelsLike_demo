import {temperatureSignal} from './climate.js';
export const HEALTH_OPTIONS={healthy:['健康','Healthy'],cold:['感冒','Cold'],heart:['心脏病','Heart disease'],hypertension:['高血压','High blood pressure'],diabetes:['糖尿病','Diabetes'],kidney:['肾脏疾病','Kidney disease'],other:['其他','Other']};
export function normalizeHealth(profile){
 let conditions=[...new Set((Array.isArray(profile?.conditions)?profile.conditions:[]).filter(k=>Object.hasOwn(HEALTH_OPTIONS,k)))];
 const fluidRestricted=profile?.fluidRestricted===true;
 if(conditions.some(k=>k!=='healthy')||fluidRestricted)conditions=conditions.filter(k=>k!=='healthy');
 const otherText=conditions.includes('other')&&typeof profile.otherText==='string'?profile.otherText.trim().slice(0,200):'';
 return {conditions,fluidRestricted,otherText};
}
export function healthSupport(profile,weather){
 const p=normalizeHealth(profile),active=p.conditions.some(k=>k!=='healthy')||p.fluidRestricted,recorded=p.conditions.length>0||p.fluidRestricted,hot=temperatureSignal(weather)==='heat',cold=p.conditions.includes('cold');
 let zh='',en='';
 if(cold){zh='感冒这几天先在家休息，等舒服些再安排出行。';en='Rest at home while you have a cold, and plan your outing when you feel better.';}
 else if(active){zh=hot?'尽量避开最热的时段，少走一段，多在阴凉处歇歇。':p.conditions.every(k=>k==='other')?'按你平时的照护安排来，提前找好休息点。':'按自己的节奏慢慢走，提前安排休息，带好常用药。';en=hot?'Avoid the hottest hours, shorten your walk and take more breaks in the shade.':p.conditions.every(k=>k==='other')?'Follow your usual care plan and plan your rest stops.':'Take your time, plan rest stops and bring your usual medicines.';}
 if(p.fluidRestricted){zh+=(zh?' ':'')+'饮水按医生给你的安排来。';en+=(en?' ':'')+'Follow your clinician’s drinking plan.';}
 if(!active&&recorded){zh='记得带水，注意休息哦。';en='Bring water and take little breaks.';}
 return {...p,active,recorded,hot,cold,zh,en};
}
