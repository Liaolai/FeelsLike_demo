import {compactAdvice} from './advice-summary.js';

export function createAvatarOverlay(){
 const el=document.createElement('div');el.className='avatar-bubble avatar-card';el.hidden=true;el.setAttribute('role','group');el.setAttribute('aria-label','人物头顶信息 / Character information');
 const thermal=document.createElement('div');thermal.className='avatar-thermal';
 const label=document.createElement('span'),value=document.createElement('strong');thermal.append(label,value);
 const mood=document.createElement('div');mood.className='avatar-mood';mood.setAttribute('role','note');
 const details=document.createElement('details');details.className='avatar-advice';details.hidden=true;
 const summary=document.createElement('summary'),heading=document.createElement('span'),toggle=document.createElement('span');toggle.className='avatar-advice-toggle';summary.append(heading,toggle);
 const body=document.createElement('div');body.className='avatar-advice-body';
 const short=document.createElement('p'),source=document.createElement('small'),disclaimer=document.createElement('small'),full=document.createElement('a');full.href='#aiAdviceResult';body.append(short,source,disclaimer,full);details.append(summary,body);el.append(thermal,mood,details);
 let lang='zh',adviceKey='',box={width:220,height:110};
 const observer=new ResizeObserver(()=>{if(!el.hidden)box={width:el.offsetWidth,height:el.offsetHeight};});observer.observe(el);
 const syncToggle=()=>{toggle.textContent=lang==='zh'?(details.open?'收起':'展开'):(details.open?'Hide':'Show');};details.addEventListener('toggle',syncToggle);
 function update({expression,thermal:reading,advice}={},language='zh'){
  lang=language;const zh=lang==='zh';
  label.textContent=reading?.preview?(zh?'日照演示体感':'Sun preview'):reading?.stale?(zh?'体感 · 待更新':'Feels like · outdated'):(zh?'体感估算':'Feels like · estimate');
  value.textContent=Number.isFinite(reading?.value)?reading.value.toFixed(1)+'°C':'--°C';
  mood.hidden=!expression;el.dataset.kind=expression?.kind||'thought';mood.textContent=expression?expression.emoji+' '+expression[lang]:'';
  const key=advice?String(advice.generatedAt)+':'+advice.text:'';if(key!==adviceKey){details.open=false;adviceKey=key;}
  details.hidden=!advice?.text;heading.textContent='💡 '+(advice?.provider==='basic'?(zh?'出行提醒':'Outing reminder'):(zh?'健康建议':'Health advice'));syncToggle();
  short.textContent=advice?.summary||compactAdvice(advice?.text,advice?.lang||lang);
  const time=Number.isFinite(advice?.generatedAt)?new Intl.DateTimeFormat(zh?'zh-CN':'en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(new Date(advice.generatedAt)):'';
  source.textContent=(advice?.provider==='basic'?(zh?'基础提醒':'Basic reminder'):'DeepSeek')+(time?' · '+time:'');
  disclaimer.textContent=zh?'非专业医疗建议':'Not professional medical advice';full.textContent=zh?'在仪表盘查看完整建议 ↗':'Read full advice in dashboard ↗';
 }
 function place(x,y,width,height,visible=true){el.hidden=!visible;if(!visible)return;el.style.left=Math.max(box.width/2+8,Math.min(width-box.width/2-8,x))+'px';el.style.top=Math.max(box.height+8,Math.min(height-64,y))+'px';}
 return {el,update,place,dispose(){observer.disconnect();el.remove();}};
}
