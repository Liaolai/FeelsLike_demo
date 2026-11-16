import * as T from '../assets/three.module.js';
import {BOUNDS,clampX,clampZ} from './sandbox-bounds.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const DESIGN_WIND=245;
const overrides={
  sun:{ws:4,rain:0,cloud:12,wd:240,label:'晴'},
  cloud:{ws:8,rain:0,cloud:85,wd:245,label:'多云'},
  rain:{ws:23,rain:3,cloud:97,wd:255,label:'雨'},
  wind:{ws:42,rain:0,cloud:35,wd:245,label:'大风'}
};
const supplied=(value)=>typeof value==='number'&&Number.isFinite(value);

export function selectedWeather(day,h,test){
  const reading=overrides[test]||{
    ws:supplied(day?.ws?.[h])?day.ws[h]:null,
    rain:supplied(day?.rain?.[h])?day.rain[h]:null,
    cloud:supplied(day?.cc?.[h])?day.cc[h]:null,
    wd:supplied(day?.wd?.[h])?day.wd[h]:null
  };
  const wind=clamp((reading.ws??0)/28,.05,1.5);
  const rain=clamp((reading.rain??0)/2.5,0,1.2);
  const coverage=clamp((reading.cloud??0)/100,0,1);
  const angle=(reading.wd??DESIGN_WIND)*Math.PI/180;
  return {...reading,windLevel:wind,rainLevel:rain,coverage,
    // Forecast degrees describe where the wind comes from. +z points south.
    direction:new T.Vector2(-Math.sin(angle),Math.cos(angle)),
    label:reading.label||(rain>0?'雨':wind>=.8?'大风':coverage>=.4?'多云':'晴')};
}

export function createWeatherParticles(){
  const rainCount=2400,activeRain=new Float32Array(rainCount*6);
  const rainGeometry=new T.BufferGeometry();
  const rainPosition=new T.BufferAttribute(activeRain,3).setUsage(T.DynamicDrawUsage);
  rainGeometry.setAttribute('position',rainPosition);
  const rain=new T.LineSegments(rainGeometry,new T.LineBasicMaterial({
    color:0xcadff0,transparent:true,opacity:0,depthWrite:false
  }));
  rain.name='Rain over the West Lake model';rain.frustumCulled=false;rain.visible=false;
  const particles=Array.from({length:rainCount},()=>({x:0,y:0,z:0}));
  const random=(a,b)=>a+Math.random()*(b-a);
  function spawn(p,focus,initial){
    const x0=focus?clampX(focus.x-8):BOUNDS.minX,x1=focus?clampX(focus.x+8):BOUNDS.maxX;
    const z0=focus?clampZ(focus.z-8):BOUNDS.minZ,z1=focus?clampZ(focus.z+8):BOUNDS.maxZ;
    p.x=random(x0,x1);p.z=random(z0,z1);
    // Spread the initial columns vertically. Recycle overview drops high up.
    p.y=focus?focus.y+random(initial?-1:2,6):random(initial?.30:12,24);
  }
  particles.forEach(p=>spawn(p,null,true));
  let localized=false,focusX=0,focusZ=0;

  const group=new T.Group();group.name='Wind flow ribbons';
  const count=90,sections=8;
  const geometry=new T.BufferGeometry(),vertices=new Float32Array(count*sections*18);
  const alpha=new Float32Array(count*sections*6);
  const position=new T.BufferAttribute(vertices,3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position',position);
  for(let i=0;i<count;i++)for(let k=0;k<sections;k++){
    const a=Math.sin(Math.PI*k/sections)**.7,b=Math.sin(Math.PI*(k+1)/sections)**.7;
    alpha.set([a,a,b,a,b,b],(i*sections+k)*6);
  }
  geometry.setAttribute('edgeAlpha',new T.BufferAttribute(alpha,1));
  const strength={value:0};
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{strength},
    vertexShader:`attribute float edgeAlpha; varying float a;
      void main(){a=edgeAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float strength; varying float a;
      void main(){gl_FragColor=vec4(.80,.90,.94,strength*a);}`
  });
  const ribbons=new T.Mesh(geometry,material);
  ribbons.frustumCulled=false;
  group.add(ribbons);group.visible=false;

  const strokes=Array.from({length:count},()=>({
    x:random(BOUNDS.minX,BOUNDS.maxX),z:random(BOUNDS.minZ,BOUNDS.maxZ),
    y:random(.25,3.5),length:random(.85,3.6),phase:random(0,6.283)
  }));
  let windFocused=false,windFocusX=0,windFocusZ=0;
  function respawnStreak(p,focus){
    p.x=focus?clampX(focus.x+random(-5,5)):random(BOUNDS.minX,BOUNDS.maxX);
    p.z=focus?clampZ(focus.z+random(-5,5)):random(BOUNDS.minZ,BOUNDS.maxZ);
    p.y=focus?clamp(focus.y+random(-.12,1.05),.25,3.5):random(.25,3.5);
  }
  function update(dt,time,weather,focus){
    const {direction,windLevel,rainLevel}=weather;
    const vx=direction.x,vz=direction.y;
    rain.visible=rainLevel>.006;
    rain.material.opacity=clamp(.16+rainLevel*.44,0,.69);
    const wanted=Math.floor(rainCount*clamp(.20+rainLevel*.69,0,1));
    const active=rainLevel>=1.1?rainCount:wanted;
    rainGeometry.setDrawRange(0,active*2);
    if(rain.visible){
      if(Boolean(focus)!==localized||(focus&&Math.hypot(focus.x-focusX,focus.z-focusZ)>4)){
        for(let i=0;i<rainCount/2;i++)spawn(particles[i],focus,true);
        localized=Boolean(focus);
        if(focus){focusX=focus.x;focusZ=focus.z;}
      }
      // Alternate local and regional particles so a light shower still covers the whole lake.
      for(let i=0;i<active;i++){
        const index=i%2===0?i/2:rainCount/2+(i-1)/2;
        const p=particles[index],near=focus&&i%2===0;
        p.y-=dt*(15+rainLevel*3);p.x+=vx*windLevel*dt*2.2;p.z+=vz*windLevel*dt*2.2;
        if(p.y<(near?focus.y-.7:.13)||(near&&(Math.abs(p.x-focus.x)>8||Math.abs(p.z-focus.z)>8))||p.x<BOUNDS.minX||p.x>BOUNDS.maxX||p.z<BOUNDS.minZ||p.z>BOUNDS.maxZ)
          spawn(p,near?focus:null,false);
        const trail=windLevel*.28;
        activeRain.set([p.x,p.y,p.z,clampX(p.x+vx*trail),p.y-(near?.29:.70),clampZ(p.z+vz*trail)],i*6);
      }
      rainPosition.needsUpdate=true;
    }
    group.visible=windLevel>.35;
    if(!group.visible)return;
    strength.value=T.MathUtils.smoothstep(windLevel,.35,1.15)*.66;
    if(Boolean(focus)!==windFocused||(focus&&Math.hypot(focus.x-windFocusX,focus.z-windFocusZ)>3)){
      for(let i=0;i<44;i++)respawnStreak(strokes[i],focus);
      windFocused=Boolean(focus);
      if(focus){windFocusX=focus.x;windFocusZ=focus.z;}
    }
    for(let i=0;i<count;i++){
      const p=strokes[i];
      p.x+=vx*dt*(3+windLevel*4);p.z+=vz*dt*(3+windLevel*4);
      const local=focus&&i<44;
      if(p.x<BOUNDS.minX||p.x>BOUNDS.maxX||p.z<BOUNDS.minZ||p.z>BOUNDS.maxZ||
        (local&&(Math.abs(p.x-focus.x)>6||Math.abs(p.z-focus.z)>6)))respawnStreak(p,local?focus:null);
      function point(k){
        const t=k/sections,curl=Math.sin(time*1.5+p.phase+t*4)*.18;
        return [clampX(p.x-vx*t*p.length-vz*curl),p.y+.091*Math.sin(t*Math.PI*2+p.phase),
                clampZ(p.z-vz*t*p.length+vx*curl)];
      }
      for(let j=0;j<sections;j++){
        const a=point(j),b=point(j+1),w=.024+.013*Math.sin(j*Math.PI/sections);
        vertices.set([a[0],a[1]-w,a[2],a[0],a[1]+w,a[2], b[0],b[1]-w,b[2],
                      a[0],a[1]+w,a[2], b[0],b[1]+w,b[2], b[0],b[1]-w,b[2]],(i*sections+j)*18);
      }
    }
    position.needsUpdate=true;
  }
  return {rain,group,update};
}

export function swayFoliage(material,time,wind,willow=false){
  material.onBeforeCompile=shader=>{
    shader.uniforms.foliageTime=time;
    shader.uniforms.foliageWind=wind;
    shader.vertexShader=`uniform float foliageTime; uniform vec3 foliageWind;\n`+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec4 mvPosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        mvPosition=instanceMatrix*mvPosition;
        float level=foliageWind.z;
        float phase=dot(instanceMatrix[3].xz,vec2(2.6,1.7));
        float sway=sin(foliageTime+phase)*(.19+.11*level);
        float size=length(instanceMatrix[1].xyz);
        ${willow?`
          float root=clamp((1.0-position.y)*.5,0.0,1.0);
          float bend=root*size*2.0*tan(radians(30.0)*smoothstep(.17,.98,level));
          mvPosition.xz+=foliageWind.xy*bend*(.85+sway);
          mvPosition.y+=bend*.22*root;
        `:`
          float bend=smoothstep(-1.0,1.04,position.y);
          mvPosition.xz+=foliageWind.xy*size*(level*.75+sway*level)*(.31+bend);
        `}
      #endif
      mvPosition=modelViewMatrix*mvPosition;
      gl_Position=projectionMatrix*mvPosition;
    `);
  };
  material.customProgramCacheKey=()=>willow?'willow-wind-v2':'canopy-wind-v2';
}
