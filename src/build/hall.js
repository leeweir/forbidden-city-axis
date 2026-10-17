import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT, getDoorMaterial, getLatticeMaterial, getPlaqueTexture } from '../core/materials.js';
import { createRoof } from './roof.js';

const V = THREE.Vector3;

function shadow(g) {
  g.traverse((o) => {
    if (o.isMesh || o.isInstancedMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/* ---------------- 台基与栏杆 ---------------- */
function createPodium({ baseW, baseD, baseH, tiers, stairW }) {
  const g = new THREE.Group();
  const tierH = baseH / tiers;
  const scales = [];
  for (let i = 0; i < tiers; i++) {
    const scale = 1 - i * 0.05;
    scales.push(scale);
    const w = baseW * scale;
    const d = baseD * scale;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, tierH, d), MAT.marble);
    body.position.y = tierH * (i + 0.5);
    g.add(body);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.55, 0.2, d + 0.55), MAT.columnBase);
    lip.position.y = tierH * (i + 1) - 0.1;
    g.add(lip);
  }
  const topScale = scales[scales.length - 1];
  const topW = baseW * topScale;
  const topD = baseD * topScale;
  const topZ = topD / 2;

  /* 踏跺 */
  const run = Math.max(4, baseH * 1.45);
  const steps = Math.max(8, Math.round(baseH / 0.34));
  const stepH = baseH / steps;
  const stepD = run / steps;
  const stepMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    MAT.marble,
    steps,
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < steps; i++) {
    const y = stepH * (i + 0.5);
    const z = topZ + run * (1 - (i + 1) / steps) + stepD * 0.5;
    m.compose(
      new V(0, y, z),
      new THREE.Quaternion(),
      new V(stairW, stepH, stepD * 1.04),
    );
    stepMesh.setMatrixAt(i, m);
  }
  stepMesh.instanceMatrix.needsUpdate = true;
  stepMesh.castShadow = true;
  stepMesh.receiveShadow = true;
  g.add(stepMesh);

  /* 御路石 */
  const slope = Math.hypot(run, baseH);
  const angle = Math.atan2(baseH, run);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(Math.min(5, stairW * 0.28), 0.26, slope), MAT.ramp);
  ramp.position.set(0, baseH / 2 + 0.24, topZ + run / 2);
  ramp.rotation.x = angle;
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  g.add(ramp);

  /* 垂带 */
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.55, slope),
      MAT.columnBase,
    );
    rail.position.set(sx * (stairW / 2 + 0.45), baseH / 2 + 0.2, topZ + run / 2);
    rail.rotation.x = angle;
    rail.castShadow = true;
    rail.receiveShadow = true;
    g.add(rail);
  }

  /* 各层汉白玉栏杆 */
  for (let i = 0; i < tiers; i++) {
    const scale = 1 - i * 0.05;
    g.add(createBalustrade(
      baseW * scale - 0.5,
      baseD * scale - 0.5,
      tierH * (i + 1),
      stairW + 2.4,
    ));
  }

  return g;
}

function createBalustrade(w, d, y, gap) {
  const g = new THREE.Group();
  const postGeo = mergeGeometries([
    new THREE.BoxGeometry(0.32, 1.02, 0.32).translate(0, 0.51, 0),
    new THREE.BoxGeometry(0.46, 0.13, 0.46).translate(0, 1.05, 0),
    new THREE.CylinderGeometry(0.16, 0.21, 0.34, 8).translate(0, 1.28, 0),
  ]);
  const posts = [];
  const panels = [];

  function addEdge(len, fixed, axis, isFront) {
    const count = Math.max(2, Math.round(len / 3.1));
    const positions = [];
    for (let i = 0; i <= count; i++) {
      const t = -len / 2 + (len * i) / count;
      if (isFront && Math.abs(t) < gap / 2) {
        positions.push(null);
        continue;
      }
      const x = axis === 'x' ? t : fixed;
      const z = axis === 'x' ? fixed : t;
      positions.push({ x, z });
    }
    for (let i = 0; i < positions.length; i++) {
      if (positions[i]) posts.push(positions[i]);
    }
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i];
      const b = positions[i + 1];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz) - 0.45;
      if (length < 0.8) continue;
      panels.push({
        x: (a.x + b.x) / 2,
        z: (a.z + b.z) / 2,
        length,
        rot: axis === 'x' ? 0 : Math.PI / 2,
      });
    }
  }

  addEdge(w, d / 2, 'x', true);
  addEdge(w, -d / 2, 'x', false);
  addEdge(d, -w / 2, 'z', false);
  addEdge(d, w / 2, 'z', false);

  const postMesh = new THREE.InstancedMesh(postGeo, MAT.columnBase, posts.length);
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new V(1, 1, 1);
  posts.forEach((p, i) => {
    matrix.compose(new V(p.x, y, p.z), q, one);
    postMesh.setMatrixAt(i, matrix);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  postMesh.castShadow = true;
  postMesh.receiveShadow = true;
  g.add(postMesh);

  const panelMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.66, 0.16),
    MAT.columnBase,
    panels.length,
  );
  panels.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
    matrix.compose(new V(p.x, y + 0.58, p.z), q, new V(p.length, 1, 1));
    panelMesh.setMatrixAt(i, matrix);
  });
  q.identity();
  panelMesh.instanceMatrix.needsUpdate = true;
  panelMesh.castShadow = true;
  panelMesh.receiveShadow = true;
  g.add(panelMesh);

  return g;
}

/* ---------------- 柱廊 ---------------- */
function createColumns({ w, d, hallH, baseH, bays, radius }) {
  const g = new THREE.Group();
  const positions = [];
  const zFront = d / 2 - 0.42;
  for (let i = 0; i <= bays; i++) {
    const x = -w / 2 + (w * i) / bays;
    positions.push([x, zFront], [x, -zFront]);
  }
  const sideIntervals = Math.max(3, Math.round(d / 5.2));
  for (let j = 1; j < sideIntervals; j++) {
    const z = -d / 2 + (d * j) / sideIntervals;
    positions.push([-w / 2 + 0.42, z], [w / 2 - 0.42, z]);
  }
  const shaftGeo = new THREE.CylinderGeometry(radius, radius * 1.06, hallH, 12);
  const baseGeo = new THREE.CylinderGeometry(radius * 1.55, radius * 1.75, 0.32, 12);
  const shafts = new THREE.InstancedMesh(shaftGeo, MAT.column, positions.length);
  const bases = new THREE.InstancedMesh(baseGeo, MAT.columnBase, positions.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  positions.forEach(([x, z], i) => {
    m.compose(new V(x, baseH + hallH / 2, z), q, new V(1, 1, 1));
    shafts.setMatrixAt(i, m);
    m.compose(new V(x, baseH + 0.16, z), q, new V(1, 1, 1));
    bases.setMatrixAt(i, m);
  });
  shafts.instanceMatrix.needsUpdate = true;
  bases.instanceMatrix.needsUpdate = true;
  shafts.castShadow = shafts.receiveShadow = true;
  bases.castShadow = bases.receiveShadow = true;
  g.add(shafts, bases);
  return g;
}

/* ---------------- 殿身 ---------------- */
function createBeamBand({ w, d, y }) {
  const g = new THREE.Group();
  const parts = [
    new THREE.BoxGeometry(w + 1.4, 0.95, 1.05).translate(0, 0, d / 2 - 0.15),
    new THREE.BoxGeometry(w + 1.4, 0.95, 1.05).translate(0, 0, -d / 2 + 0.15),
    new THREE.BoxGeometry(1.05, 0.95, d + 1.4).translate(w / 2 - 0.15, 0, 0),
    new THREE.BoxGeometry(1.05, 0.95, d + 1.4).translate(-w / 2 + 0.15, 0, 0),
  ];
  const beam = new THREE.Mesh(mergeGeometries(parts), MAT.beam);
  beam.position.y = y + 0.48;
  parts.forEach((p) => p.dispose());
  g.add(beam);

  const dougong = new THREE.Mesh(
    new THREE.BoxGeometry(w + 2.9, 0.95, d + 2.9),
    MAT.dougong,
  );
  dougong.position.y = y + 1.42;
  g.add(dougong);

  const goldParts = [
    new THREE.BoxGeometry(w + 3.3, 0.14, d + 3.3).translate(0, 0, 0),
    new THREE.BoxGeometry(w + 1.7, 0.14, d + 1.7).translate(0, -0.52, 0),
  ];
  const gold = new THREE.Mesh(mergeGeometries(goldParts), MAT.gold);
  gold.position.y = y + 1.95;
  goldParts.forEach((p) => p.dispose());
  g.add(gold);

  return { group: g, top: y + 2.1 };
}

function createUpperStorey({ w, d, h, y, bays }) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT.wall);
  wall.position.y = y + h / 2;
  g.add(wall);

  const latticeMat = getLatticeMaterial(Math.max(3, bays), 2);
  const panels = [
    new THREE.BoxGeometry(w * 0.93, h * 0.52, 0.18).translate(0, 0, d / 2 + 0.02),
    new THREE.BoxGeometry(w * 0.93, h * 0.52, 0.18).translate(0, 0, -d / 2 - 0.02),
    new THREE.BoxGeometry(0.18, h * 0.52, d * 0.9).translate(w / 2 + 0.02, 0, 0),
    new THREE.BoxGeometry(0.18, h * 0.52, d * 0.9).translate(-w / 2 - 0.02, 0, 0),
  ];
  const lattice = new THREE.Mesh(mergeGeometries(panels), latticeMat);
  lattice.position.y = y + h * 0.52;
  panels.forEach((p) => p.dispose());
  g.add(lattice);

  const columnGeo = [];
  const radius = 0.36;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const geo = new THREE.CylinderGeometry(radius, radius * 1.07, h, 10);
      geo.translate(sx * (w / 2 - 0.2), h / 2, sz * (d / 2 - 0.2));
      columnGeo.push(geo);
    }
  }
  const cols = new THREE.Mesh(mergeGeometries(columnGeo), MAT.column);
  cols.position.y = y;
  g.add(cols);

  const band = createBeamBand({ w: w * 0.995, d: d * 0.995, y: y + h });
  g.add(band.group);

  return { group: g, top: band.top };
}

/* ---------------- 大殿 ---------------- */
export function createHall(cfg) {
  const {
    id, name, w, d, baseW = w + 14, baseD = d + 14, baseH = 5,
    tiers = 2, hallH = 9, bays = 9, double = false, roofH = 9,
    style = 'hip', overhang = 5, stairW = 14, radius = 0.5,
    plaque = true, noPodium = false, lanterns = true,
  } = cfg;

  const g = new THREE.Group();

  if (!noPodium) {
    g.add(createPodium({ baseW, baseD, baseH, tiers, stairW }));
  }
  const bodyBase = noPodium ? 0 : baseH;

  /* 墙身 */
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.7, 0.55, d - 0.7),
    MAT.columnBase,
  );
  plinth.position.y = bodyBase + 0.28;
  g.add(plinth);

  const wall = new THREE.Mesh(new THREE.BoxGeometry(w - 1.5, hallH, d - 1.5), MAT.wall);
  wall.position.y = bodyBase + hallH / 2;
  g.add(wall);

  /* 隔扇门窗 */
  const doorH = hallH - 0.75;
  const doorMat = getDoorMaterial(bays);
  const frontDoors = new THREE.Mesh(
    new THREE.BoxGeometry(w - 3.2, doorH, 0.26),
    doorMat,
  );
  frontDoors.position.set(0, bodyBase + 0.35 + doorH / 2, d / 2 - 0.72);
  g.add(frontDoors);

  const backDoors = new THREE.Mesh(
    new THREE.BoxGeometry(w - 3.2, doorH, 0.26),
    doorMat,
  );
  backDoors.position.set(0, bodyBase + 0.35 + doorH / 2, -d / 2 + 0.72);
  g.add(backDoors);

  const sideLattice = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 0, 1]) {
      const geo = new THREE.BoxGeometry(0.22, hallH * 0.42, d * 0.2);
      geo.translate(sx * (w / 2 - 0.74), bodyBase + hallH * 0.56, sz * d * 0.26);
      sideLattice.push(geo);
    }
  }
  const latticeMat = getLatticeMaterial(3, 2);
  const latticeMesh = new THREE.Mesh(mergeGeometries(sideLattice), latticeMat);
  sideLattice.forEach((geo) => geo.dispose());
  g.add(latticeMesh);

  /* 柱廊 */
  g.add(createColumns({ w, d, hallH, baseH: bodyBase, bays, radius }));

  /* 额枋、斗拱 */
  const bands = createBeamBand({ w, d, y: bodyBase + hallH });
  g.add(bands.group);
  const eaveY = bands.top;

  /* 匾额 */
  if (plaque && name) {
    const pw = Math.min(5.2, Math.max(2.8, w * 0.14));
    const ph = pw * 0.31;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.34, ph + 0.32, 0.18), MAT.darkWood);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, ph),
      new THREE.MeshStandardMaterial({
        map: getPlaqueTexture(name), roughness: 0.52, metalness: 0.15,
      }),
    );
    frame.position.set(0, bodyBase + hallH - 0.55, d / 2 + 0.3);
    board.position.set(0, bodyBase + hallH - 0.55, d / 2 + 0.4);
    g.add(frame, board);
  }

  /* 灯笼 */
  if (lanterns && double) {
    const lantG = [];
    for (const sx of [-1, 1]) {
      const geo = new THREE.SphereGeometry(0.52, 12, 10);
      geo.scale(1, 1.25, 1);
      geo.translate(sx * Math.min(w * 0.34, 15), bodyBase + hallH - 1.9, d / 2 + 1.1);
      lantG.push(geo);
    }
    const lanternMesh = new THREE.Mesh(mergeGeometries(lantG), MAT.lantern);
    lantG.forEach((geo) => geo.dispose());
    g.add(lanternMesh);
  }

  /* 屋顶 */
  if (double) {
    const lowerRoofW = w + overhang * 2;
    const lowerRoofD = d + overhang * 2;
    const lowerH = Math.max(2.2, roofH * 0.3, lowerRoofD * 0.1);
    const lowerRoof = createRoof({
      width: lowerRoofW,
      depth: lowerRoofD,
      height: lowerH,
      ridge: w * 0.45,
      lift: Math.max(1.4, roofH * 0.22),
      curve: 1.55,
      style: 'hip',
      segmentsU: 22,
      segmentsV: 7,
    });
    lowerRoof.position.y = eaveY;
    g.add(lowerRoof);

    const soffitLower = new THREE.Mesh(
      new THREE.BoxGeometry(lowerRoofW * 0.93, 0.5, lowerRoofD * 0.93),
      MAT.soffit,
    );
    soffitLower.position.y = eaveY - 0.28;
    g.add(soffitLower);

    const upperW = w * 0.74;
    const upperD = d * 0.74;
    const upperH = Math.max(2.8, hallH * 0.36);
    const upper = createUpperStorey({
      w: upperW,
      d: upperD,
      h: upperH,
      y: eaveY - 1.4,
      bays: Math.max(4, Math.round(bays * 0.6)),
    });
    g.add(upper.group);

    const topRoofW = upperW + overhang * 2.7;
    const topRoofD = upperD + overhang * 2.7;
    const topRoof = createRoof({
      width: topRoofW,
      depth: topRoofD,
      height: Math.max(roofH * 0.86, topRoofD * 0.28),
      ridge: topRoofW * 0.46,
      lift: Math.max(1.8, roofH * 0.26),
      curve: 1.75,
      style,
      segmentsU: 28,
      segmentsV: 10,
    });
    topRoof.position.y = upper.top;
    g.add(topRoof);

    const soffitUpper = new THREE.Mesh(
      new THREE.BoxGeometry(topRoofW * 0.93, 0.45, topRoofD * 0.93),
      MAT.soffit,
    );
    soffitUpper.position.y = upper.top - 0.26;
    g.add(soffitUpper);
  } else {
    const roofW = w + overhang * 2;
    const roofD = d + overhang * 2;
    const roof = createRoof({
      width: roofW,
      depth: roofD,
      height: Math.max(roofH, roofD * 0.28),
      ridge: style === 'pyramid' ? 0 : roofW * 0.46,
      lift: Math.max(1.6, roofH * 0.3),
      curve: 1.7,
      style,
      segmentsU: 24,
      segmentsV: 9,
    });
    roof.position.y = eaveY;
    g.add(roof);

    const soffit = new THREE.Mesh(
      new THREE.BoxGeometry(roofW * 0.93, 0.5, roofD * 0.93),
      MAT.soffit,
    );
    soffit.position.y = eaveY - 0.28;
    g.add(soffit);
  }

  g.userData = { id, name };
  return shadow(g);
}

/* ---------------- 亭子 ---------------- */
export function createPavilion({
  size = 10, bodyH = 4, roofH = 4.5, double = false, name = '',
  eaveExtra = 2.6, baseH = 0,
}) {
  const g = new THREE.Group();
  if (baseH > 0) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(size + 4, baseH, size + 4), MAT.marble);
    base.position.y = baseH / 2;
    g.add(base);
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(size, bodyH, size), MAT.wall);
  body.position.y = baseH + bodyH / 2;
  g.add(body);

  const lattice = getLatticeMaterial(2, 2);
  const panels = [];
  for (const [dx, dz, rot] of [[0, size / 2 + 0.02, 0], [0, -size / 2 - 0.02, 0], [size / 2 + 0.02, 0, Math.PI / 2], [-size / 2 - 0.02, 0, Math.PI / 2]]) {
    const geo = new THREE.BoxGeometry(size * 0.72, bodyH * 0.52, 0.18);
    geo.rotateY(rot);
    geo.translate(dx, baseH + bodyH * 0.56, dz);
    panels.push(geo);
  }
  const latMesh = new THREE.Mesh(mergeGeometries(panels), lattice);
  panels.forEach((p) => p.dispose());
  g.add(latMesh);

  const cornerCols = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const geo = new THREE.CylinderGeometry(0.3, 0.33, bodyH, 10);
      geo.translate((sx * size) / 2, baseH + bodyH / 2, (sz * size) / 2);
      cornerCols.push(geo);
    }
  }
  const colMesh = new THREE.Mesh(mergeGeometries(cornerCols), MAT.column);
  cornerCols.forEach((c) => c.dispose());
  g.add(colMesh);

  const band = createBeamBand({ w: size, d: size, y: baseH + bodyH });
  g.add(band.group);

  if (double) {
    const lowerRoof = createRoof({
      width: size + eaveExtra * 2,
      depth: size + eaveExtra * 2,
      height: roofH * 0.34,
      ridge: size * 0.4,
      lift: 1.5,
      style: 'hip',
      segmentsU: 18,
      segmentsV: 6,
    });
    lowerRoof.position.y = band.top;
    g.add(lowerRoof);
    const upperH = Math.max(2.2, bodyH * 0.72);
    const up = createUpperStorey({ w: size * 0.68, d: size * 0.68, h: upperH, y: band.top - 1.1, bays: 3 });
    g.add(up.group);
    const top = createRoof({
      width: size * 0.68 + eaveExtra * 2.1,
      depth: size * 0.68 + eaveExtra * 2.1,
      height: roofH * 0.8,
      ridge: 0,
      lift: 2.1,
      style: 'pyramid',
      segmentsU: 20,
      segmentsV: 8,
    });
    top.position.y = up.top;
    g.add(top);
  } else {
    const roof = createRoof({
      width: size + eaveExtra * 2,
      depth: size + eaveExtra * 2,
      height: roofH,
      ridge: 0,
      lift: Math.max(1.4, roofH * 0.34),
      style: 'pyramid',
      segmentsU: 22,
      segmentsV: 8,
    });
    roof.position.y = band.top;
    g.add(roof);
  }

  if (name) {
    const pw = Math.min(3.2, size * 0.4);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.3, pw * 0.31 + 0.28, 0.16), MAT.darkWood);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, pw * 0.31),
      new THREE.MeshStandardMaterial({ map: getPlaqueTexture(name), roughness: 0.5 }),
    );
    frame.position.set(0, baseH + bodyH - 0.3, size / 2 + 0.3);
    board.position.set(0, baseH + bodyH - 0.3, size / 2 + 0.39);
    g.add(frame, board);
  }

  return shadow(g);
}

export const HALL_CONFIGS = {
  taihedian: {
    w: 56, d: 34, baseW: 74, baseD: 50, baseH: 8, tiers: 3, hallH: 11,
    bays: 11, double: true, roofH: 10.5, overhang: 6, stairW: 21,
    radius: 0.56, name: '太和殿', id: 'taihedian',
  },
  zhonghedian: {
    w: 24, d: 24, baseW: 36, baseD: 36, baseH: 5, tiers: 2, hallH: 8.5,
    bays: 3, double: false, roofH: 9, style: 'pyramid', overhang: 4.2,
    stairW: 12, radius: 0.42, name: '中和殿', id: 'zhonghedian',
  },
  baohedian: {
    w: 44, d: 28, baseW: 58, baseD: 40, baseH: 6, tiers: 2, hallH: 10,
    bays: 9, double: true, roofH: 9, overhang: 5, stairW: 17,
    radius: 0.5, name: '保和殿', id: 'baohedian',
  },
  taihemen: {
    w: 38, d: 22, baseW: 50, baseD: 31, baseH: 4.5, tiers: 2, hallH: 8,
    bays: 9, double: true, roofH: 7.2, overhang: 4.4, stairW: 15,
    radius: 0.46, name: '太和门', id: 'taihemen',
  },
  qianqinggong: {
    w: 44, d: 28, baseW: 56, baseD: 38, baseH: 4.5, tiers: 2, hallH: 7.6,
    bays: 9, double: true, roofH: 7, overhang: 5, stairW: 16,
    radius: 0.48, name: '乾清宫', id: 'qianqinggong',
  },
  jiaotaidian: {
    w: 18, d: 18, baseW: 27, baseD: 27, baseH: 4, tiers: 2, hallH: 6,
    bays: 3, double: false, roofH: 5.6, style: 'pyramid', overhang: 3.2,
    stairW: 9, radius: 0.36, name: '交泰殿', id: 'jiaotaidian',
  },
  kunninggong: {
    w: 38, d: 24, baseW: 50, baseD: 34, baseH: 4.5, tiers: 2, hallH: 7.4,
    bays: 9, double: true, roofH: 6.8, overhang: 4.5, stairW: 14,
    radius: 0.46, name: '坤宁宫', id: 'kunninggong',
  },
  wumenTower: {
    w: 46, d: 20, baseH: 0, tiers: 1, hallH: 6.6, bays: 9,
    double: true, roofH: 7, overhang: 4.2, stairW: 10, radius: 0.42,
    name: '午门', id: 'wumen', noPodium: true, lanterns: false,
  },
  shenwumenTower: {
    w: 34, d: 16, baseH: 0, tiers: 1, hallH: 6, bays: 7,
    double: true, roofH: 6.2, overhang: 3.8, stairW: 10, radius: 0.4,
    name: '神武门', id: 'shenwumen', noPodium: true, lanterns: false,
  },
};
