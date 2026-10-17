import * as THREE from 'three';
import { SKY_KEYS_BY_HOUR } from '../data/palace.js';
import { setNightGlow } from './materials.js';

function makeRadialTexture(size, stops) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const sunTexture = makeRadialTexture(512, [
  [0, 'rgba(255,255,255,1)'],
  [0.06, 'rgba(255,248,224,1)'],
  [0.14, 'rgba(255,214,150,.95)'],
  [0.3, 'rgba(255,170,90,.42)'],
  [0.55, 'rgba(255,140,70,.12)'],
  [1, 'rgba(255,130,60,0)'],
]);

const moonTexture = (() => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,250,235,0)');
  g.addColorStop(0.42, 'rgba(255,250,235,0)');
  g.addColorStop(0.47, 'rgba(230,235,245,.5)');
  g.addColorStop(0.58, 'rgba(210,222,240,.14)');
  g.addColorStop(1, 'rgba(200,215,240,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#f4f0e2';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,186,186,.35)';
  for (const [x, y, r] of [[0.46, 0.44, 0.045], [0.55, 0.52, 0.03], [0.5, 0.6, 0.024], [0.42, 0.55, 0.02]]) {
    ctx.beginPath();
    ctx.arc(size * x, size * y, size * r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

const starTexture = makeRadialTexture(64, [
  [0, 'rgba(255,255,255,1)'],
  [0.25, 'rgba(255,255,255,.9)'],
  [0.6, 'rgba(255,255,255,.22)'],
  [1, 'rgba(255,255,255,0)'],
]);

const prepareKeys = SKY_KEYS_BY_HOUR.map((key) => ({
  ...key,
  zenithC: new THREE.Color(key.zenith),
  horizonC: new THREE.Color(key.horizon),
  lowerC: new THREE.Color(key.lower),
  fogC: new THREE.Color(key.fog),
  sunC: new THREE.Color(key.sun),
  lightC: new THREE.Color(key.light),
}));

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class SkySystem {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.hour = 16;
    this.night = 0;
    this.glow = 0.6;
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3(0.42, 0.62, 0.4).normalize();

    this.sample = {
      zenith: new THREE.Color(),
      horizon: new THREE.Color(),
      lower: new THREE.Color(),
      fog: new THREE.Color(),
      sun: new THREE.Color(),
      light: new THREE.Color(),
      sunIntensity: 3,
      hemiIntensity: 1,
      exposure: 1.2,
      night: 0,
      glow: 0.6,
    };

    /* ---- 天空穹顶（顶点色渐变） ---- */
    const skyGeo = new THREE.SphereGeometry(2600, 64, 40);
    const count = skyGeo.attributes.position.count;
    this.skyColors = new Float32Array(count * 3);
    skyGeo.setAttribute('color', new THREE.BufferAttribute(this.skyColors, 3));
    this.skyMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    /* ---- 日、月 ---- */
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTexture, color: 0xffe0ae, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    }));
    this.sunSprite.scale.set(620, 620, 1);
    this.sunSprite.renderOrder = -8;
    scene.add(this.sunSprite);

    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTexture, color: 0xdfe8ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    }));
    this.moonSprite.scale.set(240, 240, 1);
    this.moonSprite.renderOrder = -8;
    scene.add(this.moonSprite);

    /* ---- 星空 ---- */
    const starGeo = new THREE.BufferGeometry();
    const N = 1400;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const az = Math.random() * Math.PI * 2;
      const u = 0.02 + Math.pow(Math.random(), 0.7) * 0.98;
      const el = Math.asin(u);
      const r = 2400;
      positions[i * 3] = Math.cos(az) * Math.cos(el) * r;
      positions[i * 3 + 1] = Math.sin(el) * r;
      positions[i * 3 + 2] = Math.sin(az) * Math.cos(el) * r;
      const b = 0.35 + Math.pow(Math.random(), 2.2) * 0.65;
      const warm = Math.random();
      colors[i * 3] = b * (warm > 0.7 ? 1 : 0.85);
      colors[i * 3 + 1] = b * 0.94;
      colors[i * 3 + 2] = b * (warm > 0.7 ? 0.8 : 1);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.starMaterial = new THREE.PointsMaterial({
      size: 2.4, sizeAttenuation: false, map: starTexture,
      transparent: true, opacity: 0, vertexColors: true,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMaterial);
    this.stars.renderOrder = -7;
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    /* ---- 光照 ---- */
    this.sunLight = new THREE.DirectionalLight(0xfff0d8, 3);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(
      window.innerWidth > 900 ? 4096 : 2048,
      window.innerWidth > 900 ? 4096 : 2048,
    );
    const cam = this.sunLight.shadow.camera;
    cam.left = -360;
    cam.right = 360;
    cam.top = 400;
    cam.bottom = -400;
    cam.near = 1;
    cam.far = 2200;
    this.sunLight.shadow.bias = -0.00015;
    this.sunLight.shadow.normalBias = 0.55;
    this.sunLight.shadow.camera.updateProjectionMatrix();
    this.sunLightTarget = new THREE.Object3D();
    this.sunLightTarget.position.set(0, 0, -50);
    scene.add(this.sunLightTarget);
    this.sunLight.target = this.sunLightTarget;
    scene.add(this.sunLight);

    this.hemi = new THREE.HemisphereLight(0xcfe0ec, 0x6b5a44, 1);
    scene.add(this.hemi);

    this.fill = new THREE.DirectionalLight(0xbcd4ec, 0.28);
    this.fill.position.set(-320, 220, -260);
    scene.add(this.fill);

    this.scene.fog = new THREE.Fog(0xc4beb1, 560, 3200);
    this.scene.environmentIntensity = 0.5;

    /* ---- 环境反射 ---- */
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.envSky.scale.setScalar(0.0038);
    this.envSky.frustumCulled = false;
    this.envScene.add(this.envSky);
    this.envRT = null;
    this.envTimer = 0;

    this.setHour(16, true);
  }

  sunPosition(hour) {
    const t = ((hour - 6) / 12) * Math.PI;
    return new THREE.Vector3(
      Math.cos(t) * 0.88,
      Math.sin(t),
      0.46,
    ).normalize();
  }

  sampleAt(hour) {
    const keys = prepareKeys;
    const h = ((hour % 24) + 24) % 24;
    let a = keys[0];
    let b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (h >= keys[i].h && h <= keys[i + 1].h) {
        a = keys[i];
        b = keys[i + 1];
        break;
      }
    }
    const span = b.h - a.h || 1;
    const t = Math.min(1, Math.max(0, (h - a.h) / span));
    const s = this.sample;
    s.zenith.copy(a.zenithC).lerp(b.zenithC, t);
    s.horizon.copy(a.horizonC).lerp(b.horizonC, t);
    s.lower.copy(a.lowerC).lerp(b.lowerC, t);
    s.fog.copy(a.fogC).lerp(b.fogC, t);
    s.sun.copy(a.sunC).lerp(b.sunC, t);
    s.light.copy(a.lightC).lerp(b.lightC, t);
    s.sunIntensity = THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, t);
    s.hemiIntensity = THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t);
    s.exposure = THREE.MathUtils.lerp(a.exposure, b.exposure, t);
    s.night = THREE.MathUtils.lerp(a.night, b.night, t);
    s.glow = THREE.MathUtils.lerp(a.glow, b.glow, t);
    return s;
  }

  setHour(hour, updateEnv = false) {
    this.hour = hour;
    const s = this.sampleAt(hour);
    this.night = s.night;
    this.glow = s.glow;

    this.sunDir.copy(this.sunPosition(hour));
    const sunElev = this.sunDir.y;

    this.updateSkyVertices(s, this.sunDir, sunElev);
    this.skyColors.needsUpdate = true;

    const sunVisible = smoothstep(-0.06, 0.05, sunElev);
    this.sunSprite.position.copy(this.sunDir).multiplyScalar(2300);
    this.sunSprite.material.opacity = sunVisible * (0.55 + this.glow * 0.65);
    this.sunSprite.material.color.copy(s.sun);
    this.sunSprite.visible = sunVisible > 0.01;

    this.moonSprite.position.copy(this.moonDir).multiplyScalar(2200);
    this.moonSprite.material.opacity = smoothstep(0.25, 0.8, this.night);
    this.moonSprite.visible = this.night > 0.2;

    this.starMaterial.opacity = smoothstep(0.2, 0.85, this.night);
    this.stars.visible = this.night > 0.15;

    const useMoon = sunElev < -0.035;
    const lightDir = useMoon ? this.moonDir : this.sunDir;
    this.sunLight.position.copy(lightDir).multiplyScalar(900).add(this.sunLightTarget.position);
    this.sunLight.color.copy(useMoon ? new THREE.Color(0x9db3da) : s.light);
    this.sunLight.intensity = s.sunIntensity;
    this.hemi.color.copy(s.horizon).lerp(new THREE.Color(0xdce9f2), 0.5);
    this.hemi.groundColor.setHex(0x6b5a44);
    this.hemi.intensity = s.hemiIntensity;
    this.fill.intensity = 0.12 + s.sunIntensity * 0.09;

    this.scene.fog.color.copy(s.fog).lerp(new THREE.Color(0xb7c4c8), 0.38 * (1 - this.night));
    this.scene.fog.near = 700;
    this.scene.fog.far = 3600;
    this.renderer.toneMappingExposure = s.exposure;

    setNightGlow(this.night);

    if (updateEnv) this.updateEnvironment();
    return s;
  }

  updateSkyVertices(s, sunDir, sunElev) {
    const pos = this.sky.geometry.attributes.position;
    const colors = this.skyColors;
    const R = 2600;
    const c = new THREE.Color();
    const warm = s.sun.clone();
    const mid = s.zenith.clone().lerp(new THREE.Color(0xd7e4ea), 0.4 * (1 - this.night));
    const cool = mid.clone().lerp(new THREE.Color(0x9fbccd), 0.5 * (1 - this.night));
    const strength = this.glow * 0.62 * smoothstep(-0.28, 0.05, sunElev);
    const hLen = Math.hypot(sunDir.x, sunDir.z) || 1;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / R;
      const y = pos.getY(i) / R;
      const z = pos.getZ(i) / R;
      const cos = (x * sunDir.x + z * sunDir.z) / hLen;
      if (y >= 0) {
        c.copy(s.horizon).lerp(mid, smoothstep(0, 0.17, y));
        c.lerp(s.zenith, Math.pow(y, 0.9));
        c.lerp(cool, Math.max(0, -cos) * 0.42 * Math.max(0, 1 - y * 3.2));
      } else {
        c.copy(s.horizon).lerp(s.lower, Math.min(1, -y * 3.4));
      }
      const band = Math.exp(-Math.abs(y) * 4.2) * Math.pow(Math.max(0, cos), 3.6);
      c.lerp(warm, Math.min(1, band * strength));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
  }

  updateEnvironment() {
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 100);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.18 + (1 - this.night) * 0.38;
  }

  scheduleEnvironment(delay = 350) {
    clearTimeout(this.envTimer);
    this.envTimer = setTimeout(() => this.updateEnvironment(), delay);
  }

  tick(dt) {
    this.stars.rotation.y += dt * 0.0035;
  }
}
