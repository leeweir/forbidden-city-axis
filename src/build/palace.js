import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDING_MAP } from '../data/palace.js';
import { createHall, HALL_CONFIGS } from './hall.js';
import { createWumen, createShenwumen, createCornerTower } from './gate.js';
import { createScenery, SITE } from './scenery.js';
import { MAT } from '../core/materials.js';

const V = THREE.Vector3;

function createDingGeometry() {
  const parts = [
    new THREE.CylinderGeometry(1.05, 0.86, 1.12, 12).translate(0, 1.28, 0),
    new THREE.CylinderGeometry(1.18, 1.18, 0.16, 12).translate(0, 1.9, 0),
    new THREE.CylinderGeometry(0.72, 0.92, 0.35, 10).translate(0, 0.7, 0),
  ];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const leg = new THREE.CylinderGeometry(0.14, 0.18, 0.62, 6);
    leg.translate(Math.cos(a) * 0.65, 0.31, Math.sin(a) * 0.65);
    parts.push(leg);
  }
  for (const side of [-1, 1]) {
    const handle = new THREE.TorusGeometry(0.32, 0.09, 5, 10, Math.PI);
    handle.rotateZ(side > 0 ? 0 : Math.PI);
    handle.translate(side * 1.02, 1.62, 0);
    parts.push(handle);
  }
  const geo = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return geo;
}

function createBronzeDings(root) {
  const geo = createDingGeometry();
  const spots = [
    [-30, 8, 58], [-20, 8, 58], [-10, 8, 58],
    [10, 8, 58], [20, 8, 58], [30, 8, 58],
    [-22, 4.5, -163.5], [-13, 4.5, -163.5],
    [13, 4.5, -163.5], [22, 4.5, -163.5],
  ];
  const mesh = new THREE.InstancedMesh(geo, MAT.bronze, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  spots.forEach((p, i) => {
    m.compose(new V(p[0], p[1], p[2]), q, new V(1, 1, 1));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
}

export function createPalace(scene) {
  const group = new THREE.Group();
  group.name = 'palace';
  scene.add(group);

  const scenery = createScenery();
  group.add(scenery.group);

  const pickables = [];

  const register = (object, id) => {
    const data = BUILDING_MAP[id];
    object.userData = { ...object.userData, id, name: data?.name ?? object.userData.name };
    group.add(object);
    pickables.push(object);
    return object;
  };

  /* 午门 · 五凤楼 */
  register(createWumen(), 'wumen');

  /* 角楼 */
  for (const x of [-SITE.wallX, SITE.wallX]) {
    for (const z of [SITE.southZ, SITE.northZ]) {
      const tower = createCornerTower();
      tower.position.set(x, 0, z);
      group.add(tower);
    }
  }

  /* 外朝 */
  const taihemen = createHall(HALL_CONFIGS.taihemen);
  taihemen.position.z = 140;
  register(taihemen, 'taihemen');

  const taihedian = createHall(HALL_CONFIGS.taihedian);
  taihedian.position.z = 40;
  register(taihedian, 'taihedian');

  const zhonghedian = createHall(HALL_CONFIGS.zhonghedian);
  zhonghedian.position.z = -15;
  register(zhonghedian, 'zhonghedian');

  const baohedian = createHall(HALL_CONFIGS.baohedian);
  baohedian.position.z = -62;
  register(baohedian, 'baohedian');

  /* 乾清门（不作导航点） */
  const qianqingmen = createHall({
    id: 'qianqingmen', name: '乾清门',
    w: 30, d: 14, baseW: 38, baseD: 22, baseH: 3.2, tiers: 1,
    hallH: 6.4, bays: 5, double: false, roofH: 6.2, style: 'hip',
    overhang: 4.2, stairW: 12, radius: 0.4,
  });
  qianqingmen.position.z = -112;
  group.add(qianqingmen);

  /* 内廷 */
  const qianqinggong = createHall(HALL_CONFIGS.qianqinggong);
  qianqinggong.position.z = -180;
  register(qianqinggong, 'qianqinggong');

  const jiaotaidian = createHall(HALL_CONFIGS.jiaotaidian);
  jiaotaidian.position.z = -222;
  register(jiaotaidian, 'jiaotaidian');

  const kunninggong = createHall(HALL_CONFIGS.kunninggong);
  kunninggong.position.z = -264;
  register(kunninggong, 'kunninggong');

  /* 神武门 */
  register(createShenwumen(), 'shenwumen');

  createBronzeDings(group);

  /* 夜间灯火 */
  const lampGroup = new THREE.Group();
  const lampSpecs = [
    [0, 12, 258, 110, 2400],
    [0, 15, 62, 90, 2200],
    [0, 9, -154, 80, 1600],
    [0, 7, -286, 60, 1200],
    [0, 14, -329, 60, 1200],
  ];
  const lamps = [];
  for (const [x, y, z, dist, power] of lampSpecs) {
    const light = new THREE.PointLight(0xffb06a, 0, dist, 2);
    light.position.set(x, y, z);
    lampGroup.add(light);
    lamps.push({ light, power });
  }
  group.add(lampGroup);

  function setNight(night) {
    for (const { light, power } of lamps) {
      light.intensity = night * power;
      light.visible = night > 0.04;
    }
  }
  setNight(0);

  return {
    group,
    pickables,
    setNight,
    water: scenery.water,
  };
}
