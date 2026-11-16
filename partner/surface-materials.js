const hashGLSL = `
float surfaceHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float surfaceNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(surfaceHash(i),surfaceHash(i+vec2(1,0)),f.x),
             mix(surfaceHash(i+vec2(0,1)),surfaceHash(i+1.0),f.x),f.y);
}
`;

// These batches already contain scene-space vertices. Using the same metre
// scale on every mesh keeps grain and joints continuous across batch boundaries.
export function textureSurface(material, kind) {
  const grain = `(.94+.09*surfaceNoise(surfacePosition.xz*96.0)+.07*surfaceNoise(surfacePosition.xz*690.0))`;
  const color = {
    ground: `diffuseColor.rgb *= ${grain};`,
    paving: `
      float aa = min(.49, fwidth(surfaceUV.x) * .7);
      vec2 tile = vec2(surfaceUV.x + .5*mod(floor(surfaceUV.y),2.0),surfaceUV.y);
      vec2 edge = min(fract(tile),1.0-fract(tile));
      float joints = 1.0-smoothstep(.032,.075+aa,min(edge.x,edge.y));
      float worn = 1.0-smoothstep(.03,.8,abs(surfaceUV.z));
      diffuseColor.rgb *= ${grain}*(.91+.12*worn+.10*surfaceHash(floor(tile))-.24*joints*(1.0-2.0*aa));
    `,
    'ink-paving': `
      vec2 q=surfaceUV.xy;
      float wash=sin(surfacePosition.z*47.0+4.7*sin(surfacePosition.x*13.0))
        +.39*sin(surfacePosition.z*99.0-surfacePosition.x*31.0);
      float vein=smoothstep(-.12,.15,wash);
      vec2 joints=min(fract(q),1.0-fract(q));
      float cut=1.0-smoothstep(.020,.066,min(joints.x,joints.y));
      vec3 tones=mix(vec3(.34,.38,.41),vec3(.88,.86,.80),vein);
      diffuseColor.rgb*=tones*(1.0-.20*cut)*(.9+.13*surfaceNoise(q*.72));
    `,
    masonry:`
      float course = surfacePosition.y*130.0;
      float run = surfaceUV.x + .52*mod(floor(course),2.0);
      vec2 edge = min(fract(vec2(run,course)),1.0-fract(vec2(run,course)));
      float aa = min(.47,max(fwidth(run),fwidth(course)));
      float grout = (1.0-smoothstep(.035,.09+aa,min(edge.x,edge.y)))*(1.0-2.0*aa);
      float damp = smoothstep(.038,.064,surfacePosition.y);
      diffuseColor.rgb *= mix(.72,1.02,damp)*(.90+.17*surfaceHash(floor(vec2(run,course)))-.32*grout);
    `
  }[kind];
  const hasUV = kind !== 'ground';
  material.onBeforeCompile = shader => {
    shader.vertexShader = `
      varying vec3 surfacePosition;
      ${hasUV ? 'attribute vec3 pavingCoord; varying vec3 surfaceUV;' : ''}
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      surfacePosition=(modelMatrix*vec4(position,1.0)).xyz;
      ${hasUV ? 'surfaceUV=pavingCoord;' : ''}
    `);
    shader.fragmentShader = `
      varying vec3 surfacePosition;
      ${hasUV ? 'varying vec3 surfaceUV;' : ''}
      ${hashGLSL}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n'+color);
  };
  material.customProgramCacheKey = () => 'westlake-surface-'+kind;
}

export function textureBuildings(material, night) {
  material.onBeforeCompile = shader => {
    shader.uniforms.buildingNight = night;
    shader.vertexShader = `
      attribute vec3 facadeCoord;
      varying vec3 facade;
      varying vec3 buildingWorld;
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      facade=facadeCoord;
      buildingWorld=(modelMatrix*vec4(position,1.0)).xyz;
    `);
    shader.fragmentShader = `
      uniform float buildingNight;
      varying vec3 facade;
      varying vec3 buildingWorld;
      ${hashGLSL}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 floorCoord=facade.xy / vec2(.026,.030);
      vec2 cell=floor(floorCoord), tile=fract(floorCoord);
      float detail=1.0-smoothstep(.1,.52,max(fwidth(floorCoord.x),fwidth(floorCoord.y)));
      float face=step(.5,facade.z);
      float plinth=face*(1.0-smoothstep(.031,.035,facade.y));
      float waist=(1.0-smoothstep(.035,.075,tile.y))*face*detail;
      vec2 d=abs(tile-vec2(.5,.59));
      float border=(1.0-smoothstep(.34,.39,d.x))*(1.0-smoothstep(.27,.32,d.y));
      float windowMask=(1.0-smoothstep(.28,.33,d.x))*(1.0-smoothstep(.21,.26,d.y));
      windowMask*=face*(1.0-plinth)*detail;
      float glazing=windowMask*(.73+.27*smoothstep(.021,.052,d.x));
      diffuseColor.rgb *= (1.0-.34*plinth-.19*waist)*
        (.91+.15*surfaceNoise(buildingWorld.xz*160.0+buildingWorld.yy*110.0));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.17,.16,.135),border*face*(1.0-plinth)*detail*.62);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.022,.035,.039),glazing*.91);
      vec2 roofTile=buildingWorld.xz*vec2(235.0,108.0);
      float roofDetail=1.0-smoothstep(.1,.55,max(fwidth(roofTile.x),fwidth(roofTile.y)));
      float roofShade=.94+.11*surfaceNoise(roofTile*.32)
        -.14*roofDetail*(1.0-smoothstep(.02,.09,abs(fract(roofTile.x)-.5)));
      diffuseColor.rgb*=mix(roofShade,1.0,face);
      float windowLight=step(.68,surfaceHash(cell+vec2(facade.z*17.0,facade.z*31.0)));
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor=mix(mix(roughnessFactor,1.0,plinth),.37,glazing);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      totalEmissiveRadiance+=vec3(1.0,.62,.19)*windowLight*buildingNight*glazing*.64;
    `);
  };
  material.customProgramCacheKey = () => 'westlake-facade';
}
