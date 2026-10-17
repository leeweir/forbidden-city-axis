import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT, TEXTURES } from '../core/materials.js';
import { createPavilion } from './hall.js';
import { createRoof } from './roof.js';

const V = THREE.Vector3;

/* 宫城尺度（米） */
export const SITE = {
  wallX: 230,
  southZ: 250,
  northZ: -355,
  moatInnerX: 267,
  moatOuterX: 301,
  moatInnerZ: 317,
  moatOuterZ: 351,
  moatInnerNorthZ: -413,
  moatOuterNorthZ: -447,
  hillZ: -620,
};

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tiled(base, rx, ry, extra = {}) {
  const map = base.clone();
  map.needsUpdate = true;
  map.repeat.set(rx, ry);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.95, ...extra });
}

function shadow(mesh, cast = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

function groundPlane(w, d, material, x, z, y = 0, rotY = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotY;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

function pushBox(list, w, h, d, x, y, z, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  list.push(g);
}

function mergeMesh(geos, material, cast = true) {
  if (!geos.length) return null;
  const merged = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

/* ---------------- 地面 ---------------- */
const plazaMat = tiled(TEXTURES.court, 42, 60);
const outerPlazaMat = tiled(TEXTURES.ground, 26, 16);
const earthMat = tiled(TEXTURES.ground, 90, 90, { color: 0x9a8d76 });
const pathMat = tiled(TEXTURES.marbleFloor, 2.2, 52);
const crossPathMat = tiled(TEXTURES.marbleFloor, 26, 3);
const gardenMat = tiled(TEXTURES.court, 18, 9, { color: 0xbfb59e });

function createGround(group) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x847d70, roughness: 0.94 });

  /* 城外大地 */
  group.add(groundPlane(4000, 1553, earthMat, 0, -1223.5, -0.14));
  group.add(groundPlane(4000, 1649, earthMat, 0, 1175.5, -0.14));
  group.add(groundPlane(1699, 798, earthMat, 1150.5, -48, -0.14));
  group.add(groundPlane(1699, 798, earthMat, -1150.5, -48, -0.14));

  /* 城内土地与铺装 */
  const innerLand = groundPlane(534, 730, earthMat, 0, -48, -0.12);
  group.add(innerLand);
  const paving = groundPlane(462, 606, plazaMat, 0, -52.5, 0.02);
  group.add(paving);

  /* 午门广场 */
  group.add(groundPlane(178, 64, outerPlazaMat, 0, 282, 0.03));
  /* 中轴御道 */
  group.add(groundPlane(15, 600, pathMat, 0, -32, 0.05));
  group.add(groundPlane(13, 48, pathMat, 0, 285, 0.06));
  /* 横向甬路 */
  for (const [z, w] of [[105, 280], [-100, 210], [-292, 190]]) {
    group.add(groundPlane(w, 9, crossPathMat, 0, z, 0.045));
  }
  /* 御花园 */
  group.add(groundPlane(196, 54, gardenMat, 0, -312, 0.04));

  /* 金水河 */
  const river = createGoldenWater(group);
  group.add(river);

  /* 护城河 */
  const moat = new THREE.Group();
  const water = new THREE.MeshStandardMaterial({
    color: 0x35565a,
    roughness: 0.14,
    metalness: 0.42,
    envMapIntensity: 1.15,
    normalMap: (() => {
      const n = TEXTURES.waterNormal.clone();
      n.needsUpdate = true;
      n.repeat.set(0.055, 0.055);
      return n;
    })(),
    normalScale: new THREE.Vector2(0.2, 0.2),
  });
  const bands = [
    [0, 334, 602, 34],
    [0, -430, 602, 34],
    [284, -48, 34, 730],
    [-284, -48, 34, 730],
  ];
  for (const [x, z, w, d] of bands) {
    const m = groundPlane(w, d, water, x, z, -1.15);
    m.receiveShadow = false;
    moat.add(m);
  }

  /* 护城河驳岸 */
  const banks = [];
  const bankH = 2.2;
  const bankTop = 0.32;
  const by = bankTop - bankH / 2;
  const bx = SITE.moatInnerX - 1.1;
  const bxOuter = SITE.moatOuterX + 1.1;
  const bzInnerS = SITE.moatInnerZ - 1.1;
  const bzOuterS = SITE.moatOuterZ + 1.1;
  const bzInnerN = SITE.moatInnerNorthZ + 1.1;
  const bzOuterN = SITE.moatOuterNorthZ - 1.1;
  pushBox(banks, 2.4, bankH, 730, bx, by, -48);
  pushBox(banks, 2.4, bankH, 730, -bx, by, -48);
  pushBox(banks, 2.4, bankH, 730, bxOuter, by, -48);
  pushBox(banks, 2.4, bankH, 730, -bxOuter, by, -48);
  pushBox(banks, 602, bankH, 2.4, 0, by, bzInnerS);
  pushBox(banks, 602, bankH, 2.4, 0, by, bzOuterS);
  pushBox(banks, 602, bankH, 2.4, 0, by, bzInnerN);
  pushBox(banks, 602, bankH, 2.4, 0, by, bzOuterN);
  const bankMesh = mergeMesh(banks, steel);
  moat.add(bankMesh);

  group.add(moat);
  return { moat, river };
}

/* ---------------- 金水河与五桥 ---------------- */
function createGoldenWater(group) {
  const g = new THREE.Group();
  const pts = [
    new V(-238, 0, 158),
    new V(-150, 0, 178),
    new V(-72, 0, 192),
    new V(0, 0, 196),
    new V(72, 0, 192),
    new V(150, 0, 178),
    new V(238, 0, 158),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const len = curve.getLength();

  function ribbon(width, y, material, offset = 0, uvScale = 6) {
    const N = 160;
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      const n = new V(-t.z, 0, t.x).normalize();
      const cx = p.x + n.x * offset;
      const cz = p.z + n.z * offset;
      positions.push(cx + n.x * width / 2, y, cz + n.z * width / 2);
      positions.push(cx - n.x * width / 2, y, cz - n.z * width / 2);
      uvs.push((u * len) / uvScale, 0, (u * len) / uvScale, 1);
      if (i < N) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  const bankMat = tiled(TEXTURES.marble, 3, 1);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x4a7278,
    roughness: 0.16,
    metalness: 0.34,
    envMapIntensity: 1.5,
    normalMap: (() => {
      const n = TEXTURES.waterNormal.clone();
      n.needsUpdate = true;
      n.repeat.set(4, 1.4);
      return n;
    })(),
    normalScale: new THREE.Vector2(0.4, 0.4),
  });

  g.add(ribbon(23, 0.1, bankMat));
  g.add(ribbon(13.6, 0.17, waterMat, 0, 8));

  /* 河沿栏杆 */
  const bridgeX = [-46, -23, 0, 23, 46];
  const postGeo = mergeGeometries([
    new THREE.BoxGeometry(0.3, 0.98, 0.3).translate(0, 0.49, 0),
    new THREE.BoxGeometry(0.44, 0.13, 0.44).translate(0, 1.02, 0),
    new THREE.CylinderGeometry(0.14, 0.19, 0.3, 8).translate(0, 1.22, 0),
  ]);
  const posts = [];
  const panels = [];
  const N = Math.round(len / 3.4);
  for (const side of [-1, 1]) {
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      const n = new V(-t.z, 0, t.x).normalize();
      const px = p.x + n.x * 8.9 * side;
      const pz = p.z + n.z * 8.9 * side;
      const nearBridge = bridgeX.some((bx) => Math.abs(px - bx) < 7.4);
      if (nearBridge) {
        prev = null;
        continue;
      }
      const pos = { x: px, z: pz };
      posts.push(pos);
      if (prev) {
        const dx = pos.x - prev.x;
        const dz = pos.z - prev.z;
        panels.push({
          x: (pos.x + prev.x) / 2,
          z: (pos.z + prev.z) / 2,
          len: Math.hypot(dx, dz) - 0.44,
          rot: Math.atan2(dx, dz) + Math.PI / 2,
        });
      }
      prev = pos;
    }
  }
  const postMesh = new THREE.InstancedMesh(postGeo, MAT.columnBase, posts.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new V(1, 1, 1);
  posts.forEach((p, i) => {
    m.compose(new V(p.x, 0.08, p.z), q, one);
    postMesh.setMatrixAt(i, m);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  postMesh.castShadow = true;
  postMesh.receiveShadow = true;
  g.add(postMesh);

  const panelMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.62, 0.14),
    MAT.columnBase,
    panels.length,
  );
  panels.forEach((p, i) => {
    q.setFromAxisAngle(new V(0, 1, 0), p.rot);
    m.compose(new V(p.x, 0.68, p.z), q, new V(Math.max(0.5, p.len), 1, 1));
    panelMesh.setMatrixAt(i, m);
    q.identity();
  });
  panelMesh.instanceMatrix.needsUpdate = true;
  panelMesh.castShadow = true;
  panelMesh.receiveShadow = true;
  g.add(panelMesh);

  /* 五座石桥 */
  const neighbors = curve.getSpacedPoints(80);
  const zAt = (x) => {
    let best = neighbors[0];
    let dist = Infinity;
    for (const p of neighbors) {
      const d = Math.abs(p.x - x);
      if (d < dist) { dist = d; best = p; }
    }
    return best.z;
  };
  bridgeX.forEach((x, idx) => {
    const width = idx === 2 ? 16 : 8.6;
    g.add(createBridge({ x, z: zAt(x), width, span: 30, rise: idx === 2 ? 2.0 : 1.5, central: idx === 2 }));
  });

  g.userData.curve = curve;
  g.userData.waterMaterial = waterMat;
  return g;
}

function createBridge({ x, z, width, span, rise, central }) {
  const g = new THREE.Group();
  const half = span / 2;
  const N = 22;
  const shape = new THREE.Shape();
  shape.moveTo(-half, -1.3);
  shape.lineTo(half, -1.3);
  shape.lineTo(half, 0.05);
  for (let i = 1; i <= N; i++) {
    const xx = half - (span * i) / N;
    const yy = 0.05 + rise * Math.sin(((xx + half) / span) * Math.PI);
    shape.lineTo(xx, yy);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width, bevelEnabled: false, curveSegments: 1,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(-width / 2, 0, 0);
  const deck = new THREE.Mesh(geo, central ? MAT.ramp : MAT.marble);
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  /* 桥栏 */
  const posts = [];
  const rails = [];
  const postCount = Math.round(span / 2.6);
  for (const side of [-1, 1]) {
    for (let i = 0; i <= postCount; i++) {
      const u = i / postCount;
      const zz = (u - 0.5) * span;
      const yy = 0.05 + rise * Math.sin(u * Math.PI);
      posts.push([side * (width / 2 - 0.28), yy, zz]);
    }
    const railPts = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const zz = (u - 0.5) * span;
      const yy = 0.05 + rise * Math.sin(u * Math.PI) + 0.92;
      railPts.push(new V(side * (width / 2 - 0.28), yy, zz));
    }
    rails.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 30, 0.11, 5, false));
  }
  const postGeo = mergeGeometries([
    new THREE.BoxGeometry(0.3, 0.92, 0.3).translate(0, 0.46, 0),
    new THREE.SphereGeometry(0.2, 8, 6).translate(0, 0.98, 0),
  ]);
  const postMesh = new THREE.InstancedMesh(postGeo, MAT.columnBase, posts.length);
  const mm = new THREE.Matrix4();
  const qq = new THREE.Quaternion();
  posts.forEach(([px, py, pz], i) => {
    mm.compose(new V(px, py, pz), qq, new V(1, 1, 1));
    postMesh.setMatrixAt(i, mm);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  postMesh.castShadow = true;
  g.add(postMesh);
  const railMesh = new THREE.Mesh(mergeGeometries(rails), MAT.columnBase);
  rails.forEach((r) => r.dispose());
  railMesh.castShadow = true;
  g.add(railMesh);

  g.position.set(x, 0, z);
  return g;
}

/* ---------------- 宫墙 ---------------- */
const cityWallMat = tiled(TEXTURES.wall, 7, 2.4);
const compoundWallMat = tiled(TEXTURES.wall, 3, 1.3);

function wallSegmentGeoms(len, axis, cx, cz) {
  const bodies = [];
  const bases = [];
  const tiles = [];
  const ridges = [];
  const H = 9.6;

  const local = (geos, prep) => {
    const g = prep();
    if (axis === 'z') g.rotateY(Math.PI / 2);
    g.translate(cx, 0, cz);
    geos.push(g);
  };

  local(bases, () => new THREE.BoxGeometry(len + 1, 0.9, 8).translate(0, 0.45, 0));
  local(bodies, () => new THREE.BoxGeometry(len, H, 7).translate(0, H / 2, 0));
  local(tiles, () => new THREE.BoxGeometry(len + 1.2, 0.42, 4.7).rotateX(0.58).translate(0, H + 0.42, 1.15));
  local(tiles, () => new THREE.BoxGeometry(len + 1.2, 0.42, 4.7).rotateX(-0.58).translate(0, H + 0.42, -1.15));
  local(ridges, () => new THREE.BoxGeometry(len + 1.5, 0.34, 0.9).translate(0, H + 1.12, 0));
  local(ridges, () => new THREE.BoxGeometry(len + 1.1, 0.2, 7.5).translate(0, H + 0.08, 0));
  return { bodies, bases, tiles, ridges };
}

function createCityWalls(group) {
  const bodies = [];
  const bases = [];
  const tiles = [];
  const ridges = [];

  const add = (len, axis, cx, cz) => {
    const seg = wallSegmentGeoms(len, axis, cx, cz);
    bodies.push(...seg.bodies);
    bases.push(...seg.bases);
    tiles.push(...seg.tiles);
    ridges.push(...seg.ridges);
  };

  add(605, 'z', SITE.wallX, -52.5);
  add(605, 'z', -SITE.wallX, -52.5);
  add(170, 'x', -145, SITE.southZ);
  add(170, 'x', 145, SITE.southZ);
  add(202, 'x', -129, SITE.northZ);
  add(202, 'x', 129, SITE.northZ);

  group.add(mergeMesh(bases, MAT.columnBase));
  group.add(mergeMesh(bodies, cityWallMat));
  group.add(mergeMesh(tiles, MAT.roof));
  group.add(mergeMesh(ridges, MAT.ridge));

  /* 城墙灯 */
  const positions = [];
  for (let z = -330; z <= 230; z += 54) {
    positions.push([SITE.wallX - 5, 11.2, z], [-SITE.wallX + 5, 11.2, z]);
  }
  for (let x = -160; x <= 160; x += 54) {
    if (Math.abs(x) > 55) positions.push([x, 11.2, SITE.southZ], [x, 11.2, SITE.northZ]);
  }
  const postGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.12, 0.16, 3.6, 6).translate(0, 1.8, 0),
    new THREE.BoxGeometry(0.9, 0.12, 0.12).translate(0, 3.3, 0),
  ]);
  const postMesh = new THREE.InstancedMesh(postGeo, MAT.darkWood, positions.length);
  const lanGeo = new THREE.SphereGeometry(0.44, 10, 8);
  lanGeo.scale(1, 1.25, 1);
  const lanMesh = new THREE.InstancedMesh(lanGeo, MAT.lantern, positions.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new V(1, 1, 1);
  positions.forEach((p, i) => {
    m.compose(new V(p[0], p[1], p[2]), q, one);
    postMesh.setMatrixAt(i, m);
    m.compose(new V(p[0], p[1] + 3.0, p[2]), q, new V(1.5, 1.5, 1.5));
    lanMesh.setMatrixAt(i, m);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  lanMesh.instanceMatrix.needsUpdate = true;
  lanMesh.castShadow = true;
  group.add(postMesh, lanMesh);
}

/* ---------------- 廊庑 ---------------- */
function createColonnade(x, zCenter, length) {
  const g = new THREE.Group();
  const sign = Math.sign(x);
  const colX = x - sign * 5.1;
  const baseH = 0.85;
  const bodyH = 4.5;

  const base = new THREE.Mesh(new THREE.BoxGeometry(10.6, baseH, length + 2), MAT.columnBase);
  base.position.set(x, baseH / 2, zCenter);
  g.add(base);

  const body = new THREE.Mesh(new THREE.BoxGeometry(8, bodyH, length), compoundWallMat);
  body.position.set(x, baseH + bodyH / 2, zCenter);
  g.add(body);

  const latticeGeos = [];
  const colGeos = [];
  const baseGeos = [];
  const count = Math.floor(length / 5.6);
  for (let i = 0; i <= count; i++) {
    const z = zCenter - length / 2 + (length * i) / count;
    pushBox(latticeGeos, 0.16, 2.5, 2.9, x - sign * 4.05, baseH + bodyH * 0.55, z);
    const col = new THREE.CylinderGeometry(0.28, 0.3, bodyH, 8);
    col.translate(colX, baseH + bodyH / 2, z);
    colGeos.push(col);
    const cb = new THREE.CylinderGeometry(0.42, 0.48, 0.3, 8);
    cb.translate(colX, baseH + 0.15, z);
    baseGeos.push(cb);
  }
  g.add(mergeMesh(latticeGeos, MAT.lattice, false));
  g.add(mergeMesh(colGeos, MAT.column));
  g.add(mergeMesh(baseGeos, MAT.columnBase));

  const beam = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.9, length + 0.8), MAT.beam);
  beam.position.set(x, baseH + bodyH + 0.45, zCenter);
  g.add(beam);
  const dougong = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.75, length + 1.6), MAT.dougong);
  dougong.position.set(x, baseH + bodyH + 1.28, zCenter);
  g.add(dougong);

  const roof = createRoof({
    width: length + 2.4,
    depth: 14.4,
    ridge: length - 8,
    height: 3.3,
    lift: 1.35,
    curve: 1.55,
    segmentsU: 44,
    segmentsV: 5,
  });
  roof.rotation.y = Math.PI / 2;
  roof.position.set(x, baseH + bodyH + 1.75, zCenter);
  g.add(roof);

  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/* ---------------- 东西六宫（写意合并） ---------------- */
function createSideCompounds(group) {
  const bodies = [];
  const bases = [];
  const bands = [];
  const roofGeos = [];
  const edgeGeos = [];
  const doors = [];
  const walls = [];
  const wallTiles = [];
  const steps = [];
  const gateWallMat = compoundWallMat;

  const cols = [128, 188];
  const rows = [-150, -248];
  const hallW = 27;
  const hallD = 15;
  const compW = 52;
  const compD = 74;
  const compoundCenters = [];

  for (const side of [-1, 1]) {
    for (const cxBase of cols) {
      for (const row of rows) {
        const cx = side * cxBase;
        compoundCenters.push([cx, row]);
        const south = row + compD / 2;
        const north = row - compD / 2;
        const halfW = compW / 2;

        /* 院墙 */
        pushBox(walls, 1.6, 5.4, compD, cx - halfW, 2.7, row);
        pushBox(walls, 1.6, 5.4, compD, cx + halfW, 2.7, row);
        pushBox(walls, compW, 5.4, 1.6, cx, 2.7, north);
        const gate = 9;
        const segW = (compW - gate) / 2;
        pushBox(walls, segW, 5.4, 1.6, cx - gate / 2 - segW / 2, 2.7, south);
        pushBox(walls, segW, 5.4, 1.6, cx + gate / 2 + segW / 2, 2.7, south);
        pushBox(walls, gate, 2.2, 1.7, cx, 4.3, south);
        pushBox(wallTiles, compW, 0.3, 2.4, cx, 5.55, north);
        pushBox(wallTiles, compW, 0.3, 2.4, cx, 5.55, south);
        pushBox(wallTiles, 2.4, 0.3, compD, cx - halfW, 5.55, row);
        pushBox(wallTiles, 2.4, 0.3, compD, cx + halfW, 5.55, row);
        pushBox(doors, gate - 1.2, 3.1, 0.22, cx, 1.7, south - 0.85);
        pushBox(steps, gate + 1, 0.4, 2.6, cx, 0.2, south + 1.3);

        /* 正殿 */
        const baseH = 1.6;
        const bodyH = 5;
        pushBox(bases, 32, baseH, 20, cx, baseH / 2, row);
        pushBox(steps, 12, 0.55, 3.1, cx, 0.27, row + 11.2);
        pushBox(bodies, hallW, bodyH, hallD, cx, baseH + bodyH / 2, row);
        pushBox(doors, hallW - 4, 3.3, 0.22, cx, baseH + 1.9, row + hallD / 2 + 0.12);
        pushBox(bands, 29, 1.5, 17, cx, baseH + bodyH + 0.75, row);
        pushBox(bands, 30.6, 0.3, 18.6, cx, baseH + bodyH + 1.62, row);

        const roof = createRoof({
          width: 33.5, depth: 21, ridge: 16, height: 4.8, lift: 1.5, curve: 1.6,
          segmentsU: 16, segmentsV: 5,
        });
        roof.position.set(cx, baseH + bodyH + 1.7, row);
        roof.updateMatrixWorld(true);
        const [roofMesh, edgeMesh] = roof.children;
        const rg = roofMesh.geometry.clone();
        rg.applyMatrix4(roofMesh.matrixWorld);
        roofGeos.push(rg);
        const eg = edgeMesh.geometry.clone();
        eg.applyMatrix4(edgeMesh.matrixWorld);
        edgeGeos.push(eg);
        roofMesh.geometry.dispose();
        edgeMesh.geometry.dispose();

        /* 院门小屋顶 */
        const gateRoof = createRoof({
          width: 12.5, depth: 3.6, ridge: 6, height: 1.5, lift: 0.55, curve: 1.5,
          segmentsU: 8, segmentsV: 3,
        });
        gateRoof.position.set(cx, 5.55, south);
        gateRoof.updateMatrixWorld(true);
        const gr = gateRoof.children[0].geometry.clone();
        gr.applyMatrix4(gateRoof.children[0].matrixWorld);
        roofGeos.push(gr);
        const ge = gateRoof.children[1].geometry.clone();
        ge.applyMatrix4(gateRoof.children[1].matrixWorld);
        edgeGeos.push(ge);
        gateRoof.children[0].geometry.dispose();
        gateRoof.children[1].geometry.dispose();
      }
    }
  }

  group.add(mergeMesh(walls, gateWallMat));
  group.add(mergeMesh(wallTiles, MAT.ridge));
  group.add(mergeMesh(bases, MAT.columnBase));
  group.add(mergeMesh(steps, MAT.columnBase));
  group.add(mergeMesh(bodies, MAT.wall));
  group.add(mergeMesh(bands, MAT.beam));
  group.add(mergeMesh(doors, MAT.darkWood));
  group.add(mergeMesh(roofGeos, MAT.roof));
  group.add(mergeMesh(edgeGeos, MAT.ridge));

  return compoundCenters;
}

/* ---------------- 御花园 ---------------- */
function createGarden(group) {
  const pavilions = [];
  for (const x of [-38, 38]) {
    const p = createPavilion({
      size: 9, bodyH: 4.3, roofH: 4.8, double: true, baseH: 0.55, eaveExtra: 2.6,
    });
    p.position.set(x, 0, -320);
    group.add(p);
    pavilions.push(p);
  }

  /* 堆秀山与御景亭 */
  const rockGeos = [];
  const rand = seeded(77);
  const clusters = [
    [62, -330, 11],
    [-64, -330, 9],
    [78, -294, 6],
    [-84, -300, 5],
    [26, -338, 7],
    [-30, -338, 6],
  ];
  for (const [cx, cz, radius] of clusters) {
    const count = 5 + Math.floor(rand() * 5);
    for (let i = 0; i < count; i++) {
      const r = radius * (0.22 + rand() * 0.34);
      const geo = new THREE.IcosahedronGeometry(r, 0);
      geo.scale(1 + rand() * 0.7, 0.7 + rand() * 1.1, 1 + rand() * 0.6);
      geo.rotateY(rand() * Math.PI);
      const a = rand() * Math.PI * 2;
      const d = rand() * radius * 0.75;
      geo.translate(cx + Math.cos(a) * d, r * 0.5 + rand() * 2.4, cz + Math.sin(a) * d * 0.7);
      rockGeos.push(geo);
    }
  }
  group.add(mergeMesh(rockGeos, MAT.rock));

  const hillTop = new THREE.Mesh(new THREE.IcosahedronGeometry(5.2, 0), MAT.rock);
  hillTop.scale.set(1.5, 0.9, 1.2);
  hillTop.position.set(62, 5.6, -330);
  hillTop.castShadow = true;
  group.add(hillTop);

  const pav = createPavilion({
    size: 5.2, bodyH: 3.2, roofH: 3.6, double: false, baseH: 0.3, eaveExtra: 1.7,
  });
  pav.position.set(62, 7.6, -330);
  group.add(pav);
  pavilions.push(pav);

  /* 花坛与石径 */
  const pathMat = tiled(TEXTURES.marbleFloor, 2, 14);
  const p1 = groundPlane(7, 46, pathMat, 0, -313, 0.08);
  const p2 = groundPlane(150, 6, pathMat, 0, -298, 0.075);
  group.add(p1, p2);

  return pavilions;
}

/* ---------------- 景山地形 ---------------- */
function hillHeight(x, z) {
  const dz = z - SITE.hillZ;
  const ridge = Math.exp(-(dz * dz) / (2 * 86 * 86));
  const peaks =
    50 * Math.exp(-Math.pow(x / 96, 2)) +
    11 * Math.exp(-Math.pow((x + 168) / 78, 2)) +
    9 * Math.exp(-Math.pow((x - 182) / 88, 2));
  const envelope = Math.max(0, 1 - Math.pow(Math.abs(x) / 440, 2)) *
    Math.max(0, 1 - Math.pow(Math.abs(dz) / 240, 2));
  return -2 + ridge * peaks * envelope;
}

function createHill(group) {
  const geo = new THREE.PlaneGeometry(760, 440, 92, 54);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rand = seeded(91);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = hillHeight(x, z + SITE.hillZ);
    const rough = h > 1 ? (rand() - 0.5) * (1.8 + h * 0.06) : 0;
    pos.setY(i, h + rough);
    const t = Math.min(1, Math.max(0, h / 46));
    color.setHex(0x3b4834).offsetHSL(
      (rand() - 0.5) * 0.02,
      (rand() - 0.5) * 0.06,
      t * 0.04 + (rand() - 0.5) * 0.05,
    );
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const hillMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, flatShading: true,
  });
  const hill = new THREE.Mesh(geo, hillMat);
  hill.position.z = SITE.hillZ;
  hill.castShadow = true;
  hill.receiveShadow = true;
  group.add(hill);

  /* 山顶五亭，取中峰万春亭与两翼 */
  const centerY = hillHeight(0, SITE.hillZ);
  const center = createPavilion({ size: 8, bodyH: 4.2, roofH: 5, double: true, eaveExtra: 2.2, baseH: 0.9 });
  center.position.set(0, centerY - 0.5, SITE.hillZ);
  group.add(center);
  for (const [x, z, s] of [[-112, SITE.hillZ + 20, 0.86], [108, SITE.hillZ - 8, 0.82]]) {
    const p = createPavilion({ size: 6, bodyH: 3.4, roofH: 4, double: false, eaveExtra: 1.9, baseH: 0.6 });
    p.position.set(x, hillHeight(x, z) - 0.4, z);
    p.scale.setScalar(s);
    group.add(p);
  }

  /* 西山远影 */
  createHorizonHills(group);
}

function createHorizonHills(group) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x70766a, roughness: 1, flatShading: true,
  });
  const geos = [];
  const specs = [
    [-1120, -1420, 760, 120, 300],
    [-420, -1520, 650, 96, 280],
    [240, -1480, 700, 82, 300],
    [980, -1380, 600, 110, 260],
    [-1720, -1280, 560, 90, 260],
  ];
  for (const [x, z, sx, sy, sz] of specs) {
    const g = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(sx, sy, sz);
    const p = g.attributes.position;
    const rand = seeded(300 + x);
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) p.setY(i, p.getY(i) * (0.68 + rand() * 0.5));
    }
    g.computeVertexNormals();
    g.translate(x, -2, z);
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(merged, mat);
  mesh.receiveShadow = true;
  group.add(mesh);
}

/* ---------------- 树木 ---------------- */
const treeRand = seeded(20261017);
const TREE_COLORS = [0x2e3b2c, 0x3b4834, 0x47553a, 0x2a352a, 0x54603f];

function createTrees(group, compoundCenters) {
  const spots = [];
  const add = (x, z, y = 0, s = 1) => spots.push({ x, z, y, s });

  /* 御花园 */
  for (let i = 0; i < 26; i++) {
    const x = (treeRand() * 2 - 1) * 88;
    const z = -292 - treeRand() * 46;
    if (Math.abs(x) < 11) continue;
    if (Math.abs(Math.abs(x) - 38) < 10 && Math.abs(z + 320) < 10) continue;
    if (Math.abs(x - 62) < 13 && Math.abs(z + 330) < 13) continue;
    add(x, z, 0.04, 0.85 + treeRand() * 0.5);
  }

  /* 各宫院 */
  for (const [cx, row] of compoundCenters) {
    add(cx - 19, row + 29, 0, 0.8 + treeRand() * 0.35);
    add(cx + 19, row - 28, 0, 0.8 + treeRand() * 0.3);
  }

  /* 城墙与护城河之间 */
  for (const side of [-1, 1]) {
    for (let i = 0; i < 34; i++) {
      const x = side * (239 + treeRand() * 22);
      const z = -405 + treeRand() * 700;
      add(x, z, -0.02, 0.9 + treeRand() * 0.55);
    }
  }
  /* 北面与南面城外 */
  for (let i = 0; i < 26; i++) {
    const side = treeRand() > 0.5 ? 1 : -1;
    add(side * (40 + treeRand() * 190), 366 + treeRand() * 90, -0.05, 0.9 + treeRand() * 0.5);
  }
  for (let i = 0; i < 16; i++) {
    add((treeRand() * 2 - 1) * 200, -455 - treeRand() * 12, -0.05, 0.9 + treeRand() * 0.4);
  }

  /* 护城河外沿林带 */
  for (const side of [-1, 1]) {
    for (let i = 0; i < 46; i++) {
      const x = side * (318 + treeRand() * 150);
      const z = -470 + treeRand() * 860;
      add(x, z, -0.08, 1.15 + treeRand() * 0.7);
    }
  }
  for (let i = 0; i < 44; i++) {
    const x = (treeRand() * 2 - 1) * 470;
    if (Math.abs(x) < 40) continue;
    add(x, 420 + treeRand() * 180, -0.08, 1.1 + treeRand() * 0.65);
  }
  for (let i = 0; i < 26; i++) {
    add(-520 + treeRand() * 1040, -500 - treeRand() * 70, -0.08, 1.1 + treeRand() * 0.6);
  }

  /* 景山 */
  for (let i = 0; i < 300; i++) {
    let x;
    let z;
    let y = -2;
    for (let k = 0; k < 6; k++) {
      const a = treeRand() * Math.PI * 2;
      const r = Math.sqrt(treeRand());
      x = Math.cos(a) * r * 350;
      z = SITE.hillZ + Math.sin(a) * r * 185;
      y = hillHeight(x, z);
      if (y > 3) break;
    }
    if (y > 3) add(x, z, y - 0.8, 0.62 + treeRand() * 0.42);
  }

  const lowerGeo = new THREE.ConeGeometry(2.8, 7.2, 7);
  lowerGeo.translate(0, 6, 0);
  const upperGeo = new THREE.ConeGeometry(1.85, 5.4, 7);
  upperGeo.translate(0, 9.4, 0);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 4.2, 6);
  trunkGeo.translate(0, 2.1, 0);

  const lowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const upperMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e3229, roughness: 1 });

  const lowerMesh = new THREE.InstancedMesh(lowerGeo, lowerMat, spots.length);
  const upperMesh = new THREE.InstancedMesh(upperGeo, upperMat, spots.length);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const color = new THREE.Color();
  spots.forEach((t, i) => {
    q.setFromAxisAngle(new V(0, 1, 0), treeRand() * Math.PI * 2);
    const s = t.s;
    m.compose(new V(t.x, t.y, t.z), q, new V(s * (0.85 + treeRand() * 0.3), s, s * (0.85 + treeRand() * 0.3)));
    lowerMesh.setMatrixAt(i, m);
    upperMesh.setMatrixAt(i, m);
    trunkMesh.setMatrixAt(i, m);
    color.setHex(TREE_COLORS[Math.floor(treeRand() * TREE_COLORS.length)]);
    lowerMesh.setColorAt(i, color);
    color.offsetHSL(0.015, 0, 0.05);
    upperMesh.setColorAt(i, color);
  });
  lowerMesh.instanceMatrix.needsUpdate = true;
  upperMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.instanceMatrix.needsUpdate = true;
  if (lowerMesh.instanceColor) lowerMesh.instanceColor.needsUpdate = true;
  if (upperMesh.instanceColor) upperMesh.instanceColor.needsUpdate = true;
  for (const mesh of [lowerMesh, upperMesh, trunkMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  group.add(lowerMesh, upperMesh, trunkMesh);
}

/* ---------------- 内廷横墙与乾清门前景 ---------------- */
function createInnerGateWall(group) {
  const parts = [];
  const tiles = [];
  for (const side of [-1, 1]) {
    const x1 = side * 22;
    const x2 = side * 95;
    const cx = (x1 + x2) / 2;
    const len = Math.abs(x2 - x1);
    pushBox(parts, len, 6.4, 2.2, cx, 3.2, -112);
    pushBox(tiles, len + 1, 0.32, 3.4, cx, 6.6, -112);
    pushBox(tiles, len + 1, 0.26, 2.9, cx, 6.9, -112);
  }
  group.add(mergeMesh(parts, compoundWallMat));
  group.add(mergeMesh(tiles, MAT.ridge));
}

/* ---------------- 端门 ---------------- */
function createDistantGate(group) {
  const g = new THREE.Group();
  const platform = new THREE.Mesh(new THREE.BoxGeometry(58, 11, 20), MAT.brick);
  platform.position.set(0, 5.5, 400);
  platform.castShadow = platform.receiveShadow = true;
  g.add(platform);

  const dark = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 10),
    new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 1 }),
  );
  dark.position.set(0, 5, 410.1);
  g.add(dark);

  const body = new THREE.Mesh(new THREE.BoxGeometry(44, 8, 14), MAT.wall);
  body.position.set(0, 15, 400);
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  const band = new THREE.Mesh(new THREE.BoxGeometry(46, 1.1, 16), MAT.beam);
  band.position.set(0, 19.5, 400);
  g.add(band);
  const dougong = new THREE.Mesh(new THREE.BoxGeometry(48, 0.9, 18), MAT.dougong);
  dougong.position.set(0, 20.5, 400);
  g.add(dougong);

  const roof = createRoof({
    width: 53, depth: 23, ridge: 30, height: 7.4, lift: 2.1, curve: 1.7,
    segmentsU: 24, segmentsV: 8,
  });
  roof.position.set(0, 21, 400);
  g.add(roof);

  /* 八字墙 */
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(80, 8.2, 3), MAT.wall);
    wall.position.set(side * 74, 4.1, 400);
    g.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(81, 0.5, 4.4), MAT.ridge);
    cap.position.set(side * 74, 8.4, 400);
    g.add(cap);
  }

  group.add(g);
}

/* ---------------- 铜狮 ---------------- */
function createLions(group) {
  const stone = [];
  const bronze = [];
  for (const x of [-20, 20]) {
    const z = 157;
    pushBox(stone, 2.6, 1.9, 3, x, 0.95, z);
    const body = new THREE.SphereGeometry(1, 12, 9);
    body.scale(1.15, 1.3, 1.55);
    body.translate(x, 3.1, z);
    bronze.push(body);
    const head = new THREE.SphereGeometry(0.85, 12, 9);
    head.scale(1.05, 1.15, 0.95);
    head.translate(x, 4.2, z + 1.15);
    bronze.push(head);
    for (const lx of [-0.55, 0.55]) {
      const leg = new THREE.BoxGeometry(0.35, 1.4, 0.4);
      leg.translate(x + lx, 2.2, z + 1.05);
      bronze.push(leg);
    }
    const tail = new THREE.SphereGeometry(0.4, 8, 6);
    tail.translate(x, 3.4, z - 1.55);
    bronze.push(tail);
  }
  group.add(mergeMesh(stone, MAT.columnBase));
  group.add(mergeMesh(bronze, MAT.bronze));
}

/* ---------------- 主入口 ---------------- */
export function createScenery() {
  const group = new THREE.Group();
  group.name = 'scenery';
  const ground = createGround(group);
  createCityWalls(group);
  createDistantGate(group);
  createInnerGateWall(group);

  group.add(createColonnade(146, 18, 226));
  group.add(createColonnade(-146, 18, 226));

  const compoundCenters = createSideCompounds(group);
  createGarden(group);
  createLions(group);
  createTrees(group, compoundCenters);
  createHill(group);

  /* 南护城河御路桥 */
  const bridgeMat = tiled(TEXTURES.marbleFloor, 3, 6);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(24, 1.1, 34), bridgeMat);
  bridge.position.set(0, 0.04, 334);
  bridge.receiveShadow = true;
  group.add(bridge);
  const rails = [];
  for (const side of [-1, 1]) {
    pushBox(rails, 0.6, 1.1, 34, side * 12.2, 1.1, 334);
    for (let z = 319; z <= 349; z += 3) {
      pushBox(rails, 0.5, 1.35, 0.5, side * 12.2, 1.9, z);
    }
  }
  group.add(mergeMesh(rails, MAT.columnBase));

  return {
    group,
    river: ground.river,
    moat: ground.moat,
    water: [
      ground.moat.children.find((c) => c.material?.normalMap)?.material.normalMap,
      ground.river.userData.waterMaterial.normalMap,
    ].filter(Boolean),
  };
}
