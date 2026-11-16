import {temperatureSignal} from './climate.js';
const THOUGHTS=[['🐟','想吃鱼','Thinking about fish'],['💃','想跳支舞','Feel like dancing'],['😊','今天心情不错','Feeling cheerful'],['🌿','想看看风景','Taking in the view'],['🎵','想听首歌','A song would be nice']];
export function avatarExpression({weather,mood,id='me',now=Date.now()}){
 const signal=temperatureSignal(weather);if(signal!=='unknown'){if(signal==='heat')return {kind:'heat',emoji:'🥵',zh:'有点热，去树荫下歇歇',en:'Feeling hot · time for shade'};if(signal==='cold')return {kind:'cold',emoji:'🥶',zh:'有点冷，记得加衣服',en:'Feeling chilly · wrap up'};}
 const moods={happy:['😊','心情不错','Feeling happy'],calm:['😌','慢慢走，看风景','Taking it easy'],tired:['😴','想休息一下','A little rest sounds nice'],irritable:['😣','想安静待一会','A quiet moment, please']};
 if(moods[mood]){const [emoji,zh,en]=moods[mood];return {kind:'mood',emoji,zh,en};}
 const hash=[...id].reduce((a,c)=>a+c.charCodeAt(0),0),[emoji,zh,en]=THOUGHTS[(Math.floor(now/25000)+hash)%THOUGHTS.length];return {kind:'thought',emoji,zh,en};
}
