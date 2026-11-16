import {feedbackIsCurrent} from './climate.js';
import {normalizeHealth} from './health.js';
// Product outfit bands; they are editable suggestions, not clinical thresholds.
export const OUTFIT_BANDS=[
 {below:0,key:'freezing',wear:'insulated',zh:'保暖内层、厚外套和长裤，带上围巾手套。',en:'Thermal base, an insulated coat and long trousers; bring a scarf and gloves.'},
 {below:10,key:'cold',wear:'insulated',zh:'毛衣配保暖外套和长裤，穿好袜子。',en:'A sweater, warm jacket and long trousers with warm socks.'},
 {below:16,key:'cool',wear:'layers',zh:'长袖配针织衫或薄外套，穿长裤。',en:'Long sleeves with a knit or light jacket, and long trousers.'},
 {below:22,key:'mild',wear:'layers',zh:'长袖或薄针织，带一件方便穿脱的外套。',en:'A long-sleeve top or light knit; carry an easy-to-remove layer.'},
 {below:28,key:'warm',wear:'light',zh:'轻薄透气的上衣配轻便下装，走热了及时减一层。',en:'A light, breathable top and bottoms; remove a layer if you get warm.'},
 {below:Infinity,key:'hot',wear:'light',zh:'选浅色、宽松、轻薄的衣服，走一段就找阴凉歇歇。',en:'Choose light-coloured, loose, lightweight clothes and take shaded breaks.'}
];
export function recommendOutfit(weather,feedback,activity='walk',profile,now=Date.now()){
 const temperature=!weather?.stale?(Number.isFinite(weather?.apparent_temperature)?weather.apparent_temperature:weather?.temperature_2m):null;
 if(!Number.isFinite(temperature))return {available:false,wear:null,items:[],zh:'先看看天气，出门带一件方便穿脱的外套。',en:'Check the weather and bring an easy-to-remove layer.'};
 const band=OUTFIT_BANDS.find(b=>temperature<b.below),items=[],health=normalizeHealth(profile),valid=feedbackIsCurrent(feedback,activity,now);
 if(Number.isFinite(weather.wind_speed_10m)&&weather.wind_speed_10m>=6||Number.isFinite(weather.wind_gusts_10m)&&weather.wind_gusts_10m>=12)items.push(['wind','湖边风大，带轻便防风层。','Bring a light wind-resistant layer for the lakeside.']);
 if(weather.precipitation_probability>=60||weather.precipitation>.5)items.push(['rain','带好轻便雨具，穿防滑的鞋。','Bring rain cover and shoes with good grip.']);
 if(weather.uv_index>=6)items.push(['sun','帽子或遮阳伞带上，也记得防晒。','Bring a hat or parasol and sun protection.']);
 if(activity==='run')items.push(['activity','活动时选透气、方便排汗的衣物。','Choose breathable clothes that let sweat dry while active.']);
 if(valid&&feedback.feel==='hot')items.push(['feelHot','你觉得热，先减掉可脱的外层，到阴凉处歇歇。','You feel warm: remove an optional outer layer and rest in shade.']);
 if(valid&&feedback.feel==='cold')items.push(['feelCold','你觉得冷，备一件方便穿脱的薄外套。','You feel cool: bring an easy-to-remove light jacket.']);
 if(health.conditions.includes('cold'))items.push(['health','感冒时先休息，等舒服些再安排出行。','Rest while you have a cold and head out when you feel better.']);
 return {available:true,temperature,key:band.key,wear:band.wear,zh:band.zh,en:band.en,items:items.map(([key,zh,en])=>({key,zh,en}))};
}
