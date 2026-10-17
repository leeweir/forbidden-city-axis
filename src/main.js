import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SkySystem } from './core/sky.js';
import { createPalace } from './build/palace.js';
import { Director } from './core/director.js';
import { UI } from './core/ui.js';
import { BUILDINGS, BUILDING_MAP, SHICHEN, DEFAULT_SHICHEN } from './data/palace.js';

const canvas = document.getElementById('scene');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;
const clamp = THREE.MathUtils.clamp;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
} catch (error) {
  const loader = document.getElementById('loader');
  const status = loader?.querySelector('.loader__status');
  if (status) status.textContent = '此浏览器无法启动 WebGL 三维场景';
  loader?.classList.add('is-error');
  throw error;
}

const maxPixelRatio = () => Math.min(window.devicePixelRatio || 1, window.innerWidth < 900 ? 1.6 : 2);
renderer.setPixelRatio(maxPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  1,
  9000,
);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.058;
controls.rotateSpeed = 0.52;
controls.zoomSpeed = 0.72;
controls.panSpeed = 0.65;
controls.minDistance = 24;
controls.maxDistance = 1650;
controls.minPolarAngle = 0.14;
controls.maxPolarAngle = Math.PI * 0.495;
controls.zoomToCursor = true;
controls.target.set(0, 12, 8);

const director = new Director(camera, controls, { reducedMotion });
director.home = director.getHomePose();
director.setPose(director.home);

const ui = new UI({
  onSelect: selectBuilding,
  onTimeChange: applyTimeIndex,
  onTour: toggleTour,
  onReset: resetExperience,
  onFullscreen: toggleFullscreen,
  onOverview: showOverview,
});

let sky = null;
let palace = null;
const byId = new Map();
const anchors = new Map();
let selectedId = null;
let hoverId = null;
let timeAnim = null;
let hasInteracted = false;
let hintShown = false;

let lastTime = performance.now();
let elapsed = 0;

/* =========================================================
   选中标记：地面上的勘测刻线
   ========================================================= */
const markerMat = new THREE.MeshBasicMaterial({
  color: 0xdfb875,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  fog: false,
  toneMapped: false,
});
const cornerMat = new THREE.MeshBasicMaterial({
  color: 0xf0cd8e,
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
  fog: false,
  toneMapped: false,
});
const dashMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 0.045, 0.15),
  markerMat,
  380,
);
dashMesh.count = 0;
dashMesh.frustumCulled = false;
dashMesh.renderOrder = 4;
dashMesh.visible = false;
scene.add(dashMesh);

const cornerMesh = new THREE.InstancedMesh(
  new THREE.OctahedronGeometry(0.34, 0),
  cornerMat,
  4,
);
cornerMesh.frustumCulled = false;
cornerMesh.renderOrder = 4;
cornerMesh.visible = false;
scene.add(cornerMesh);

const _dummy = new THREE.Object3D();

function layoutSelection(object) {
  if (!object) return;
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const width = box.max.x - box.min.x;
  const depth = box.max.z - box.min.z;
  const margin = clamp(Math.max(width, depth) * 0.045, 3.6, 10);
  const minX = box.min.x - margin;
  const maxX = box.max.x + margin;
  const minZ = box.min.z - margin;
  const maxZ = box.max.z + margin;
  const spacing = Math.max(2.1, Math.max(width, depth) / 74);
  const y = 0.42;

  const edges = [
    [minX, minZ, maxX, minZ],
    [maxX, minZ, maxX, maxZ],
    [maxX, maxZ, minX, maxZ],
    [minX, maxZ, minX, minZ],
  ];

  let index = 0;
  for (const [x1, z1, x2, z2] of edges) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const count = Math.max(2, Math.round(len / spacing));
    for (let i = 0; i < count && index < 380; i++) {
      const t = (i + 0.5) * (len / count);
      _dummy.position.set(x1 + ux * t, y, z1 + uz * t);
      _dummy.rotation.set(0, Math.atan2(-uz, ux), 0);
      _dummy.scale.set(0.92, 1, 1);
      _dummy.updateMatrix();
      dashMesh.setMatrixAt(index, _dummy.matrix);
      index += 1;
    }
  }
  dashMesh.count = index;
  dashMesh.instanceMatrix.needsUpdate = true;
  dashMesh.computeBoundingSphere();

  const corners = [
    [minX, minZ],
    [maxX, minZ],
    [maxX, maxZ],
    [minX, maxZ],
  ];
  corners.forEach(([x, z], i) => {
    _dummy.position.set(x, 0.96, z);
    _dummy.rotation.set(0, Math.PI / 4, 0);
    _dummy.scale.set(1, 1.7, 1);
    _dummy.updateMatrix();
    cornerMesh.setMatrixAt(i, _dummy.matrix);
  });
  cornerMesh.instanceMatrix.needsUpdate = true;
  cornerMesh.computeBoundingSphere();
}

function showSelection(object) {
  layoutSelection(object);
  dashMesh.visible = true;
  cornerMesh.visible = true;
}

function hideSelection() {
  dashMesh.visible = false;
  cornerMesh.visible = false;
}

/* =========================================================
   选中 / 概览 / 巡游
   ========================================================= */
function updateTitle(id) {
  document.title = id
    ? `${BUILDING_MAP[id].name} · 中轴九阙 | 紫禁城`
    : '紫禁城 · 中轴九阙 | 3D 宫城漫游';
}

function markInteracted() {
  hasInteracted = true;
  ui.dismissHint();
}

function setHover(id) {
  if (hoverId === id) return;
  hoverId = id;
  document.body.classList.toggle('is-hovering', Boolean(id));
}

function selectBuilding(id, { fly = true } = {}) {
  if (!BUILDING_MAP[id] || !byId.has(id)) return;
  markInteracted();
  if (director.tour) {
    director.stopTour(false);
    director.userTakeover();
    ui.setTourActive(false);
  }
  const object = byId.get(id);
  selectedId = id;
  setHover(null);
  ui.setActive(id);
  updateTitle(id);
  controls.minDistance = 24;
  showSelection(object);
  if (fly) {
    director.flyToObject(object, { duration: 1550 });
  }
}

function showOverview() {
  if (director.tour) {
    director.stopTour(false);
    ui.setTourActive(false);
  }
  markInteracted();
  selectedId = null;
  hoverId = null;
  document.body.classList.remove('is-hovering');
  ui.setActive(null);
  updateTitle(null);
  hideSelection();
  ui.hideMarker();
  controls.minDistance = 24;
}

function resetExperience() {
  if (director.tour) {
    director.stopTour(false);
    ui.setTourActive(false);
  }
  selectedId = null;
  hoverId = null;
  document.body.classList.remove('is-hovering');
  ui.setActive(null);
  updateTitle(null);
  hideSelection();
  ui.hideMarker();
  markInteracted();
  director.resetView();
}

function startTour() {
  if (!palace) return;
  markInteracted();
  setHover(null);
  ui.setTourActive(true);
  const stops = BUILDINGS
    .map((building) => ({ id: building.id, object: byId.get(building.id) }))
    .filter((stop) => stop.object);
  director.startTour(stops);
}

function toggleTour() {
  if (director.tour) {
    director.stopTour(false);
    ui.setTourActive(false);
    showOverview();
    director.resetView();
    return;
  }
  if (ui.tourActive) {
    ui.setTourActive(false);
    showOverview();
    return;
  }
  startTour();
}

director.onStop = (id, object) => {
  if (!BUILDING_MAP[id] || !object) return;
  selectedId = id;
  ui.setActive(id);
  updateTitle(id);
  showSelection(object);
};

director.onTourCancel = () => {
  ui.setTourActive(false);
};

director.onTourEnd = () => {
  ui.setTourActive(false);
  selectedId = null;
  hoverId = null;
  document.body.classList.remove('is-hovering');
  ui.setActive(null);
  updateTitle(null);
  hideSelection();
  ui.hideMarker();
};

/* =========================================================
   天光流转
   ========================================================= */
function applyTimeIndex(index) {
  if (!sky) return;
  markInteracted();
  const target = SHICHEN[((index % SHICHEN.length) + SHICHEN.length) % SHICHEN.length].hour;
  const from = sky.hour;
  let delta = ((target - from + 36) % 24) - 12;
  if (Math.abs(delta) < 0.001) return;
  if (reducedMotion) {
    sky.setHour(target);
    palace?.setNight(sky.night);
    sky.scheduleEnvironment(120);
    timeAnim = null;
    return;
  }
  timeAnim = { from, delta, t: 0, duration: 0.95 };
}

function updateTime(dt) {
  if (!timeAnim) return;
  timeAnim.t = Math.min(1, timeAnim.t + dt / timeAnim.duration);
  const hour = (((timeAnim.from + timeAnim.delta * easeInOutCubic(timeAnim.t)) % 24) + 24) % 24;
  sky.setHour(hour);
  palace.setNight(sky.night);
  if (timeAnim.t >= 1) {
    timeAnim = null;
    sky.scheduleEnvironment(260);
  }
}

/* =========================================================
   拾取与标记
   ========================================================= */
const raycaster = new THREE.Raycaster();
raycaster.far = 5000;
const pointerNdc = new THREE.Vector2();
const pointerScreen = { x: 0, y: 0 };
let hoverDirty = false;
let lastHoverCheck = 0;
let press = null;
const _project = new THREE.Vector3();
let markerVisible = false;
let markerId = null;

function pickAt(clientX, clientY) {
  if (!palace) return null;
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(palace.pickables, true);
  for (const hit of hits) {
    let node = hit.object;
    while (node) {
      const id = node.userData?.id;
      if (id && byId.has(id)) return id;
      node = node.parent;
    }
  }
  return null;
}

canvas.addEventListener('pointermove', (event) => {
  if (!finePointer || event.pointerType === 'touch') return;
  pointerScreen.x = event.clientX;
  pointerScreen.y = event.clientY;
  hoverDirty = true;
});

canvas.addEventListener('pointerleave', () => {
  hoverDirty = false;
  setHover(null);
});

window.addEventListener('pointerdown', (event) => {
  if (event.target !== canvas) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  press = { x: event.clientX, y: event.clientY, t: performance.now() };
  if (director.tour) {
    director.stopTour(false);
    director.userTakeover();
    ui.setTourActive(false);
  }
}, true);

function endPress(event) {
  if (!press) return;
  const start = press;
  press = null;
  if (event.target !== canvas) return;
  const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
  if (moved > 7 || performance.now() - start.t > 700) return;
  const id = pickAt(event.clientX, event.clientY);
  if (id) selectBuilding(id);
}

window.addEventListener('pointerup', endPress);
window.addEventListener('pointercancel', () => {
  press = null;
});

function updateHover(now) {
  if (!hoverDirty || press || director.tour) return;
  if (now - lastHoverCheck < 85) return;
  lastHoverCheck = now;
  hoverDirty = false;
  setHover(pickAt(pointerScreen.x, pointerScreen.y));
}

function updateMarker() {
  const id = hoverId || selectedId;
  if (!id || !anchors.has(id)) {
    if (markerVisible || markerId) {
      ui.hideMarker();
      markerVisible = false;
      markerId = null;
    }
    return;
  }
  const anchor = anchors.get(id);
  _project.copy(anchor).project(camera);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const x = (_project.x * 0.5 + 0.5) * width;
  const y = (-_project.y * 0.5 + 0.5) * height;
  const offscreen = _project.z < -1 || _project.z > 1
    || x < -80 || x > width + 80 || y < -40 || y > height + 60;
  if (offscreen) {
    if (markerVisible || markerId) {
      ui.hideMarker();
      markerVisible = false;
      markerId = null;
    }
    return;
  }
  const active = id === selectedId;
  ui.showMarker(BUILDING_MAP[id], x, y, active);
  markerVisible = true;
  markerId = id;
}

/* =========================================================
   舞台驻留与自适应
   ========================================================= */
function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(maxPixelRatio());
  renderer.setSize(width, height);
  const prevHome = director.home;
  director.home = director.getHomePose();
  if (!selectedId && director.mode === 'idle' && camera.position.distanceTo(prevHome.pos) < 2) {
    director.setPose(director.home);
  }
}

window.addEventListener('resize', onResize);

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
    return;
  }
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {
      ui.showHint('当前浏览器不支持全屏');
    });
  } else {
    ui.showHint('当前浏览器不支持全屏');
  }
}

function showAmbientHint() {
  if (hintShown || hasInteracted) return;
  hintShown = true;
  ui.showHint('拖拽环视 · 滚轮推近 · 点击殿宇细读');
}

window.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = event.target?.tagName;
  const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    if (director.tour) {
      director.stopTour(false);
      director.userTakeover();
      ui.setTourActive(false);
      return;
    }
    if (selectedId) {
      showOverview();
      return;
    }
    return;
  }
  if (inField) return;
  if (key >= '1' && key <= '9') {
    const building = BUILDINGS[Number(key) - 1];
    if (building) {
      event.preventDefault();
      selectBuilding(building.id);
    }
    return;
  }
  if (key === 't') {
    event.preventDefault();
    toggleTour();
    return;
  }
  if (key === 'r') {
    event.preventDefault();
    resetExperience();
    return;
  }
  if (key === 'f') {
    event.preventDefault();
    toggleFullscreen();
  }
});

/* =========================================================
   渲染循环
   ========================================================= */
function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  elapsed += dt;

  if (sky) {
    sky.tick(dt);
    updateTime(dt);
    for (let i = 0; i < palace.water.length; i++) {
      const map = palace.water[i];
      if (!map) continue;
      const side = i % 2 === 0 ? 1 : -0.72;
      map.offset.set(elapsed * 0.0082 * side, elapsed * 0.0115 * (i % 2 === 0 ? 1 : 0.8));
    }
  }

  director.update(dt);
  controls.update();

  if (renderer) {
    renderer.render(scene, camera);
  }

  updateHover(performance.now());
  updateMarker();

  const pulse = 0.5 + Math.sin(elapsed * 2.1) * 0.18;
  markerMat.opacity = pulse + 0.12;
  cornerMat.opacity = 0.72 + Math.sin(elapsed * 2.1 + 0.7) * 0.16;
}

/* =========================================================
   启动
   ========================================================= */
async function boot() {
  ui.setLoadingStatus('正在铺陈金砖');
  await nextFrame();

  sky = new SkySystem(renderer, scene);
  ui.setLoadingStatus('正在起造九阙');
  await nextFrame();

  palace = createPalace(scene);
  scene.updateMatrixWorld(true);

  for (const object of palace.pickables) {
    const id = object.userData.id;
    if (!id || !BUILDING_MAP[id]) continue;
    byId.set(id, object);
    const box = new THREE.Box3().setFromObject(object);
    const height = box.max.y - box.min.y;
    anchors.set(id, new THREE.Vector3(
      (box.min.x + box.max.x) / 2,
      box.max.y + Math.max(3.2, height * 0.045),
      (box.min.z + box.max.z) / 2,
    ));
  }

  palace.setNight(sky.night);

  ui.setLoadingStatus('正在校准日影');
  await nextFrame();

  const compile = renderer.compileAsync(scene, camera).catch(() => {});
  await Promise.race([compile, delay(5200)]);
  await Promise.race([document.fonts.ready, delay(1400)]);

  renderer.render(scene, camera);
  renderer.setAnimationLoop(animate);
  await nextFrame();

  ui.setLoadingStatus('正在点亮宫灯');
  ui.finishLoading();

  setTimeout(() => {
    controls.enabled = false;
    director.playIntro(() => {
      window.setTimeout(showAmbientHint, 900);
    });
  }, 320);
}

boot().catch((error) => {
  console.error(error);
  ui.setLoadingStatus('场景未能加载，请刷新重试');
  document.getElementById('loader')?.classList.add('is-error');
});
