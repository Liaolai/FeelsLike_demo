// One explicit-send snapshot of the information available for the current visitor.
export function buildAdviceSnapshot(state,d,{doctorAdvice='',question='',now=Date.now(),destination=null,history=null,evidence='',evidenceIds=null,offsetC=null}={}){
 const p=state.positions?.[0],id=p?.id||'me',regional=d?.weather,shade=d?.shadeContext;
 const fields=['temperature_2m','apparent_temperature','relative_humidity_2m','wind_speed_10m','wind_gusts_10m','wind_direction_10m','uv_index','precipitation_probability','precipitation_intensity','precipitation','shortwave_radiation','weather_code','cloud_cover','is_day'];
 const weather=w=>w?Object.fromEntries([...fields,'time','fetchedAt','downloadedAt','provider','source','snapshot','snapshotAgeHours','latitude','longitude','coordinateKind','sourceResolutionMinutes','retainedResolutionMinutes','radiationSource','apparentEstimated','stale'].map(k=>[k,w[k]??null])):null;
 const forecast=[],h=regional?.hourly;for(let i=0;i<(h?.time?.length||0)&&forecast.length<24;i++)if(h.time[i]*1000>=Math.ceil(now/3600000)*3600000)forecast.push(Object.fromEntries(['time',...fields].map(k=>[k,h[k]?.[i]??null])));
 return {consent:true,language:state.lang,capturedAt:now,thermalMethod:d?.geometryThermal&&state.shadowPreview==null?'utci_geometry':'regional',health:state.healthProfiles?.[id],bodyProfile:state.bodyProfiles?.[id],doctorAdvice,question,history,evidence,evidenceIds,weather:weather(d?.adviceWeather),regionalWeather:weather(regional),warningWeather:weather(d?.warningWeather),forecast,feedback:state.feedback?.[id],activity:p?.activity,
 location:{kind:'virtual_character',lon:p?.lon,lat:p?.lat,roadName:state.road?.name,roadKind:state.road?.kind,nearestLandmark:destination?.zh,nearestLandmarkEn:destination?.en},
 observation:{record:state.measurements?.[id]??null,assessment:d?.observation??null},
 sunlight:{mode:state.shadowPreview==null?'current':'preview',time:shade?.time,shade:shade?.shade,elevation:shade?.sun?.elevation,azimuth:shade?.sun?.azimuth,daylight:shade?.sun?.daylight,geometryCount:shade?.geometryCount},
 thermal:d?.geometryThermal?{...d.geometryThermal,weather:undefined,preview:state.shadowPreview!=null}:null,
 personal:{mood:state.moods?.[id]??null,outfit:state.outfit,avatarId:state.avatarId,clothingKind:'virtual_avatar_or_saved_recommendation',offsetC},
 hydration:{lastRecordedAt:state.water?.[id]??null,reminderEnabled:state.timer,lastReminderAt:state.lastReminder},
 route:state.routeReport?{...state.routeReport,running:state.routeRunning}:null,crowd:state.telemetry?.crowd??{available:false},
 reminders:{environmental:d?.environmentalReminder,personalized:d?.reminder},view:{mapMode:state.mapMode,mapMetric:state.mapMetric},weatherProvider:state.weatherProvider};
}
