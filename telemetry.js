import {environmentReminder} from './climate.js';
export function telemetryPeople(positions,feedback){return positions.map(p=>{const f=feedback[p.id];return {id:p.id,lon:p.lon,lat:p.lat,activity:p.activity,feedback:f?{feel:f.feel,at:f.at,activity:f.activity}:null};});}
export function currentPersonReport(report,position,feedback,now=Date.now()){
 if(!report)return undefined;const p=report.personalization;
 const activity=report.activity??position.activity;
 const valid=p?.active&&feedback&&p.at===feedback.at&&p.feel===feedback.feel&&feedback.at<=now&&now-feedback.at<=2*3600000&&(!feedback.activity||feedback.activity===position.activity)&&activity===position.activity;
 if(activity!==position.activity||p?.active&&!valid)return {...report,reminder:environmentReminder(report.weather,position.activity),personalization:{active:false}};
 return report;
}
