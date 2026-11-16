const TYPES={primary:['主路','Main road'],secondary:['主路','Main road'],tertiary:['道路','Road'],residential:['街道','Street'],service:['通行道路','Access road'],pedestrian:['步行街','Pedestrian street'],footway:['步行道','Footpath'],path:['小路','Path'],steps:['台阶','Steps'],cycleway:['骑行道','Cycleway'],track:['小路','Track']};
export function roadLabel(road,lang='zh'){
 const type=(TYPES[road.kind]||['道路','Road'])[lang==='zh'?0:1];return {name:road.name?.trim()||(lang==='zh'?'未命名'+type:'Unnamed '+type.toLowerCase()),type};
}
