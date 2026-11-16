import * as T from '../assets/three.module.js';

// Scan-convert the actual shoreline rings, then bake a capped chamfer distance.
// The lake uses physical scene units, where .25 is 25 metres.
export function bakeLakeField(outer,inner,dykes,layers,island,corridor){
  const size=1200,padding=.08;
  const all=outer.flatMap(r=>r.coordinates);
  const minX=Math.min(...all.map(p=>p[0]))-padding,minZ=Math.min(...all.map(p=>p[1]))-padding;
  const unit=(Math.max(Math.max(...all.map(p=>p[0]))-minX,Math.max(...all.map(p=>p[1]))-minZ)+padding)/size;
  const wet=new Uint8Array(size*size);
  function raster(rings,value){
    for(const {coordinates} of rings){
      const rows=new Map();
      for(let i=1;i<coordinates.length;i++){
        const a=coordinates[i-1],b=coordinates[i],dz=b[1]-a[1];
        if(!dz)continue;
        const first=Math.max(0,Math.ceil((Math.min(a[1],b[1])-minZ)/unit-.5));
        const last=Math.min(size,Math.ceil((Math.max(a[1],b[1])-minZ)/unit-.5));
        for(let y=first;y<last;y++){
          const t=(minZ+(y+.5)*unit-a[1])/dz;
          if(!rows.has(y))rows.set(y,[]);
          rows.get(y).push(a[0]+(b[0]-a[0])*t);
        }
      }
      for(const [y,crossings] of rows){
        crossings.sort((a,b)=>a-b);
        for(let j=1;j<crossings.length;j+=2){
          const start=Math.max(0,Math.ceil((crossings[j-1]-minX)/unit-.5));
          const end=Math.min(size,Math.ceil((crossings[j]-minX)/unit-.5));
          if(end>start)wet.fill(value,y*size+start,y*size+end);
        }
      }
    }
  }
  if(layers)for(const ring of layers)raster([ring],ring.role==='outer'?255:0);
  else {raster(outer,255);raster(inner,0);}
  if(island){
    const b=island.pond;
    for(let z=Math.max(0,Math.floor((b.minZ-minZ)/unit));z<Math.min(size,Math.ceil((b.maxZ-minZ)/unit));z++)
    for(let x=Math.max(0,Math.floor((b.minX-minX)/unit));x<Math.min(size,Math.ceil((b.maxX-minX)/unit));x++){
      if(island.embankment(minX+(x+.5)*unit,minZ+(z+.5)*unit))wet[z*size+x]=0;
    }
  }
  if(corridor){
    const b=corridor.box;
    for(let z=Math.max(0,Math.floor((b.minZ-minZ)/unit));z<Math.min(size,Math.ceil((b.maxZ-minZ)/unit));z++)
    for(let x=Math.max(0,Math.floor((b.minX-minX)/unit));x<Math.min(size,Math.ceil((b.maxX-minX)/unit));x++){
      const px=minX+(x+.5)*unit,pz=minZ+(z+.5)*unit;
      if(corridor.depression(px,pz)>.82)wet[z*size+x]=255;
    }
  }
  const range=.70;
  const field=new Float32Array(size*size).fill(range/unit);
  for(let i=0;i<wet.length;i++)if(!wet[i])field[i]=0;
  for(const path of dykes)for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/unit*2);
    for(let k=0;k<=steps;k++){
      const t=k/(steps||1),x=Math.floor((a[0]+(b[0]-a[0])*t-minX)/unit);
      const y=Math.floor((a[1]+(b[1]-a[1])*t-minZ)/unit);
      if(x>=0&&x<size&&y>=0&&y<size)field[y*size+x]=0;
    }
  }
  const diagonal=Math.SQRT2;
  for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){
    const i=y*size+x;
    field[i]=Math.min(field[i],field[i-1]+1,field[i-size]+1,field[i-size-1]+diagonal,field[i-size+1]+diagonal);
  }
  for(let y=size-2;y>0;y--)for(let x=size-2;x>0;x--){
    const i=y*size+x;
    field[i]=Math.min(field[i],field[i+1]+1,field[i+size]+1,field[i+size-1]+diagonal,field[i+size+1]+diagonal);
  }
  const data=new Uint8Array(size*size*4);
  for(let i=0;i<wet.length;i++){
    data[i*4]=Math.min(255,Math.round(field[i]*unit/range*255));
    data[i*4+1]=wet[i];data[i*4+3]=255;
  }
  const map=new T.DataTexture(data,size,size);
  map.magFilter=T.LinearFilter;map.minFilter=T.LinearFilter;
  map.needsUpdate=true;
  return {map,transform:new T.Vector4(minX,minZ,1/(size*unit),range)};
}

const shorelineGLSL=`
  uniform sampler2D lakeField;
  uniform vec4 lakeTransform;
  vec2 lakeSample(vec2 point){
    vec2 uv=(point-lakeTransform.xy)*lakeTransform.z;
    if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1))))return vec2(1,0);
    return texture2D(lakeField,uv).rg;
  }
`;

export function hideSubmergedGround(material,field){
  const previous=material.onBeforeCompile;
  const key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.uniforms.lakeField={value:field.map};
    shader.uniforms.lakeTransform={value:field.transform};
    shader.fragmentShader=shorelineGLSL+shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\nif(lakeSample(surfacePosition.xz).y>.51)discard;');
  };
  material.customProgramCacheKey=()=>key+'-shore-mask';
}

export function createLakeMaterial(field){
  const material=new T.MeshPhysicalMaterial({
    color:0xffffff,roughness:.50,metalness:0,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
  });
  const uniforms={
    lakeField:{value:field.map},lakeTransform:{value:field.transform},
    lakeTime:{value:0},lakeWind:{value:.24},lakeRain:{value:0},
    lakeWindDirection:{value:new T.Vector2(.91,.414)},lakeDaylight:{value:1},lakeSun:{value:new T.Vector3(-.4,.85,.35).normalize()},
    lakeSkyTop:{value:new T.Color('#759ebc')},lakeSkyHorizon:{value:new T.Color('#b9d4d1')},
    lakeShallow:{value:new T.Color('#4ea89b')},lakeDeep:{value:new T.Color('#1e646e')},
    lakeFountainPoint:{value:new T.Vector2(999,999)},
    lakeTowerLights:{value:Array.from({length:3},()=>new T.Vector2(999,999))},
    lakeWakes:{value:Array.from({length:4},()=>new T.Vector4(999,999,0,0))}
  };
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 lakePosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nlakePosition=(modelMatrix*vec4(position,1.0)).xyz;');
    shader.fragmentShader=shorelineGLSL+`
      varying vec3 lakePosition;
      uniform float lakeTime,lakeWind,lakeRain,lakeDaylight;
      uniform vec2 lakeWindDirection;
      uniform vec3 lakeSun,lakeSkyTop,lakeSkyHorizon,lakeShallow,lakeDeep;
      uniform vec4 lakeWakes[4];
      uniform vec2 lakeTowerLights[3];
      uniform vec2 lakeFountainPoint;
      float lakeHash(vec2 p){
        vec3 f=fract(vec3(p.xyx)*.1031);
        f+=dot(f,f.yzx+31.32);
        return fract((f.x+f.y)*f.z);
      }
      vec2 noiseSlope(vec2 p){
        vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f),d=6.0*f*(1.0-f);
        float a=lakeHash(i),b=lakeHash(i+vec2(1,0)),c=lakeHash(i+vec2(0,1)),e=lakeHash(i+1.0);
        return vec2(mix(b-a,e-c,u.y),mix(c-a,e-b,u.x))*d;
      }
      vec2 wave(vec2 p,vec2 direction,float lengthScale,float speed){
        vec2 side=vec2(-direction.y,direction.x);
        vec2 q=vec2(dot(p,direction),dot(p,side)*.57)*lengthScale;
        q.x-=lakeTime*speed;
        float waveCoverage=1.0-smoothstep(.31,1.05,max(fwidth(q.x),fwidth(q.y)));
        vec2 d=noiseSlope(q)*waveCoverage;
        return direction*d.x+side*d.y*.57;
      }
      vec2 raindrop(vec2 p,float scale,float offset){
        vec2 q=p*scale,cell=floor(q),uv=fract(q);
        float age=fract(lakeTime*.88+lakeHash(cell+offset)+offset);
        vec2 d=uv-(.35+.30*vec2(lakeHash(cell+4.0),lakeHash(cell+8.0)));
        float r=length(d);
        float ring=r-age*.32;
        float aa=1.0-smoothstep(.10,.65,max(fwidth(q.x),fwidth(q.y)));
        return d/max(r,.01)*sin(ring*94.0)*exp(-ring*ring*2200.0)*(1.0-age)*aa;
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 lakePoint=lakePosition.xz;
      float shore=lakeSample(lakePoint).x*lakeTransform.w;
      float shallows=1.0-smoothstep(.015,.33,shore);
      vec3 lakeBase=mix(lakeDeep,lakeShallow,shallows);
      float edgeGlow=(1.0-smoothstep(.014,.062,shore))*.09;
      lakeBase=mix(lakeBase,vec3(.26,.48,.41),edgeGlow);
      diffuseColor.rgb=lakeBase*mix(.34,1.0,lakeDaylight);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`
      #include <normal_fragment_begin>
      vec2 flow=normalize(vec2(.91,.414));
      vec2 crossflow=vec2(-flow.y,flow.x);
      vec2 slope=wave(lakePoint,flow,3.7,.38)*.18+
                 wave(lakePoint,normalize(flow*.76+crossflow*.65),8.2,.59)*.125+
                (wave(lakePoint,normalize(flow*.94-crossflow*.32),34.0,1.17)*.09+
                 wave(lakePoint,normalize(flow*.87+crossflow*.48),79.0,1.93)*.055)*(.32+lakeWind*.8);
      if(lakeRain>.001){
        slope+=lakeRain*(raindrop(lakePoint,13.0,.19)*.056+raindrop(lakePoint,23.0,.71)*.034);
      }
      float wakeFoam=0.0;
      for(int i=0;i<4;i++){
        vec4 boat=lakeWakes[i];
        vec2 relative=lakePoint-boat.xy;
        float tail=-dot(relative,boat.zw)-.035;
        if(tail>0.0&&tail<.34){
          float across=dot(relative,vec2(-boat.w,boat.z));
          float crest=abs(across)-(.013+tail*.30);
          float band=exp(-abs(crest)*108.0)*(1.0-smoothstep(.04,.34,tail));
          float ripple=sin(tail*76.0-lakeTime*6.5);
          slope+=boat.zw*band*ripple*.086;
          wakeFoam+=band*(.5+.5*ripple)*.13;
        }
      }
      vec3 lakeNormal=normalize(vec3(-slope.x,1.0,-slope.y));
      normal=normalize(mat3(viewMatrix)*lakeNormal);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 lakeEye=normalize(cameraPosition-lakePosition);
      float cosView=clamp(dot(lakeEye,lakeNormal),0.0,1.0);
      float fresnel=.035+.65*pow(1.0-cosView,4.25);
      vec3 reflected=reflect(-lakeEye,lakeNormal);
      vec3 skyReflection=mix(lakeSkyHorizon,lakeSkyTop,smoothstep(0.0,.78,reflected.y));
      float glint=pow(max(0.0,dot(normalize(lakeSun+lakeEye),lakeNormal)),27.0);
      outgoingLight=mix(lakeBase*mix(.24,.83,lakeDaylight)+outgoingLight*.12,
                        skyReflection*mix(.38,.79,lakeDaylight),fresnel);
      outgoingLight+=vec3(1.0,.84,.54)*glint*.095*lakeDaylight*(1.0-lakeRain*.84);
      outgoingLight+=vec3(.27,.39,.37)*wakeFoam*lakeDaylight;
      float candleGlow=0.0;
      if(lakeDaylight<.48)for(int i=0;i<3;i++){
        vec2 delta=lakePoint-lakeTowerLights[i];
        vec2 viewLine=normalize(lakeEye.xz+vec2(.00001));
        float along=dot(delta,viewLine),crosswise=dot(delta,vec2(-viewLine.y,viewLine.x));
        float area=along*along*560.0+crosswise*crosswise*4400.0;
        candleGlow+=exp(-area)*(.55+.45*sin(along*290.0+lakeTime*2.7+slope.x*5.0));
      }
      float darkness=1.0-smoothstep(.25,.48,lakeDaylight);
      outgoingLight+=vec3(.93,.42,.115)*candleGlow*darkness*.30;
      if(darkness>.001){
        vec2 d=lakePoint-lakeFountainPoint;
        if(abs(d.x)<.40&&abs(d.y)<.56){
          float shoreMask=(1.0-smoothstep(.01,.36,abs(d.x)))
            *(1.0-smoothstep(.34,.55,abs(d.y)));
          float streak=.42+.58*pow(.5+.5*sin(d.y*141.0+slope.x*5.0-d.x*11.0-lakeTime*1.8),2.0);
          float ripples=.36+.64*pow(.5+.5*sin(d.x*196.0+lakeTime*6.0+d.y*19.0),2.0);
          vec3 reflections=mix(vec3(.18,.68,1.0),vec3(1.0,.62,.22),
            .5+.5*sin(d.y*14.0+lakeTime*1.2));
          outgoingLight+=reflections*shoreMask*streak*ripples*darkness*.38;
        }
      }
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey=()=> 'westlake-advection-v4';
  return {material,uniforms};
}

