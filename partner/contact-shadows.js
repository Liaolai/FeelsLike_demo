import * as T from '../assets/three.module.js';

export function addContacts(scene, points) {
  if (!points.length) return;
  const geometry = new T.PlaneGeometry(2,2);
  geometry.rotateX(-Math.PI/2);
  const material = new T.ShaderMaterial({
    transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1,
    vertexShader:`
      varying vec2 contactUV;
      void main(){
        contactUV=uv;
        vec4 p=vec4(position,1.0);
        #ifdef USE_INSTANCING
          p=instanceMatrix*p;
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*p;
      }`,
    fragmentShader:`
      varying vec2 contactUV;
      void main(){
        float r=length(contactUV*2.0-1.0);
        gl_FragColor=vec4(.031,.036,.026,.34*(1.0-smoothstep(.08,1.0,r)));
      }`
  });
  const mesh = new T.InstancedMesh(geometry, material, points.length);
  const dummy = new T.Object3D();
  points.forEach(([x,y,z,rx,rz],i)=>{
    dummy.position.set(x,y+.00035,z);
    dummy.scale.set(rx,1,rz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.name = 'Ground contact shadows';
  scene.add(mesh);
  return mesh;
}
