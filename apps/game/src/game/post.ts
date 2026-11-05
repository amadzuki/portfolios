import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.0015 },
    uDanger: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAberration; uniform float uDanger;
    varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 dir = vUv - 0.5;
      float d = length(dir);
      float ab = uAberration * (1.0 + uDanger * 6.0) * d;
      vec3 c = vec3(
        texture2D(tDiffuse, vUv + dir * ab).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - dir * ab).b);
      c *= smoothstep(0.95, 0.25, d * (1.0 + uDanger * 0.4));
      c += (rand(vUv * 1000.0 + uTime) - 0.5) * 0.035;
      c = mix(c, c * vec3(1.25, 0.55, 0.7), uDanger * 0.6);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.45, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);
  return {
    composer,
    bloom,
    finish,
    setSize(w: number, h: number, dpr: number) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      bloom.resolution.set(w * dpr, h * dpr);
    },
  };
}
