export const ADVICE_SUMMARY_MARKER='[[FEELSLIKE_SUMMARY]]';
// Extract whole sentences only. Do not cut a condition, a negation or a dose.
export function compactAdvice(text,language='zh'){
 const lines=String(text||'').split(/\r?\n/).map(s=>s.replace(/^\s*(?:[-*•]|\d+[.)、．])\s*/,'').trim()).filter(s=>s&&!/^(?:非专业医疗建议[。.]?|Not professional medical advice[.!]?)$/i.test(s));
 const sentences=lines.flatMap(s=>s.split(/(?<=[。！？!?])\s*|(?<=\.)\s+(?=[A-Z])/u)).filter(Boolean),limit=language==='en'?220:100;
 const selected=[];for(const sentence of sentences){if(selected.length===2)break;if(selected.length&&selected.join(' ').length+sentence.length>limit)break;selected.push(sentence);}
 return selected.join(language==='en'?' ':'');
}
export function splitAdviceContent(raw,language='zh'){
 const content=String(raw||'').trim(),index=content.lastIndexOf(ADVICE_SUMMARY_MARKER),text=(index<0?content:content.slice(0,index)).trim(),short=index<0?'':content.slice(index+ADVICE_SUMMARY_MARKER.length).trim();
 return {text,summary:compactAdvice(short||text,language)};
}
export function overheadThermal(report,{preview=false}={}){
 const local=report?.geometryThermal?.value,regional=report?.weather?.apparent_temperature;
 return {value:Number.isFinite(local)?local:Number.isFinite(regional)?regional:null,preview,stale:report?.weather?.stale===true};
}
