import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT, TEXTURES } from '../core/materials.js';
import { createHall, createPavilion, HALL_CONFIGS } from './hall.js';
import { createRoof } from './roof.js';

const V = THREE.Vector3;

function shadow(group) {
  group.traverse((o) => {
    if (o.isMesh || o.isInstancedMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}

function tiledMaterial(base, repeatX, repeatY, extra = {}) {
  const map = base.clone();
  map.needsUpdate = true;
  map.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.9, ...extra });
}

const gateWallMat = tiledMaterial(TEXTURES.wall, 8, 3);
const wingWallMat = tiledMaterial(TEXTURES.wall, 3, 5);
const brickBodyMat = tiledMaterial(TEXTURES.brick, 8, 3);
const extrudeWallMat = tiledMaterial(TEXTURES.wall, 0.22, 0.22, { side: THREE.DoubleSide });
const darkInterior = new THREE.MeshStandardMaterial({ color: 0x0d0907, roughness: 1 });
const gateDoorMaterial = (() => {
  const map = TEXTURES.gateDoor.clone();
  map.needsUpdate = true;
  map.repeat.set(1, 1);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.72, color: 0xb9a896 });
})();

/* 拱门立面：矩形墙上挖出券洞 */
function archFacade(width, height, arches, thickness = 1.6) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.closePath();

  for (const a of arches) {
    const r = a.w / 2;
    const straight = a.h - r;
    const path = new THREE.Path();
    path.moveTo(a.x - r, 0);
    path.lineTo(a.x - r, straight);
    path.absarc(a.x, straight, r, Math.PI, 0, true);
    path.lineTo(a.x + r, 0);
    path.closePath();
    shape.holes.push(path);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: false, curveSegments: 18,
  });
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, extrudeWallMat);
}

function archTrim(parent, arches, z, facing) {
  const parts = [];
  for (const a of arches) {
    const r = a.w / 2;
    const straight = a.h - r;
    const torus = new THREE.TorusGeometry(r + 0.3, 0.3, 6, 26, Math.PI);
    torus.translate(a.x, straight, facing > 0 ? z + 0.55 : z - 0.55);
    parts.push(torus);
    for (const side of [-1, 1]) {
      const jamb = new THREE.BoxGeometry(0.6, straight + 0.4, 0.38);
      jamb.translate(a.x + side * (r + 0.3), (straight + 0.4) / 2, facing > 0 ? z + 0.55 : z - 0.55);
      parts.push(jamb);
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), MAT.columnBase);
  parts.forEach((p) => p.dispose());
  parent.add(mesh);
}

function gateOpenings(parent, { width, depth, height, arches, zFront, zBack }) {
  for (const sign of [1, -1]) {
    const z = sign > 0 ? zFront : zBack;
    const facing = sign;
    const facade = archFacade(width, height, arches);
    facade.position.z = sign > 0 ? z - 1.2 : z - 0.4;
    facade.castShadow = true;
    facade.receiveShadow = true;
    parent.add(facade);
    archTrim(parent, arches, z, facing);

    for (let i = 0; i < arches.length; i++) {
      const a = arches[i];
      const r = a.w / 2;
      const straight = a.h - r;
      const voidPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(a.w - 0.15, a.h - 0.1),
        darkInterior,
      );
      const zPlane = sign > 0 ? z + 0.02 : z - 0.02;
      voidPlane.position.set(a.x, (a.h - 0.1) / 2, zPlane);
      voidPlane.rotation.y = sign > 0 ? 0 : Math.PI;
      parent.add(voidPlane);

      if (!a.open) {
        const doorH = straight + r * 0.82;
        const door = new THREE.Mesh(new THREE.BoxGeometry(a.w - 0.8, doorH, 0.32), gateDoorMaterial);
        door.position.set(a.x, doorH / 2, sign > 0 ? z + 0.2 : z - 0.2);
        door.castShadow = true;
        door.receiveShadow = true;
        parent.add(door);
        const lintel = new THREE.Mesh(
          new THREE.BoxGeometry(a.w - 0.4, 0.45, 0.5),
          MAT.darkWood,
        );
        lintel.position.set(a.x, doorH + 0.22, sign > 0 ? z + 0.24 : z - 0.24);
        parent.add(lintel);
      } else {
        const glow = new THREE.Mesh(
          new THREE.PlaneGeometry(a.w * 0.34, a.h * 0.16),
          new THREE.MeshBasicMaterial({ color: 0x2a1a0c }),
        );
        glow.position.set(a.x, a.h * 0.22, sign > 0 ? z + 0.045 : z - 0.045);
        glow.rotation.y = sign > 0 ? 0 : Math.PI;
        parent.add(glow);
      }
    }
  }
}

function parapet(edges, y, height = 0.95) {
  const bodyGeos = [];
  const capGeos = [];
  for (const e of edges) {
    bodyGeos.push(
      new THREE.BoxGeometry(e.w, height, e.d).translate(e.x, y + height / 2, e.z),
    );
    capGeos.push(
      new THREE.BoxGeometry(e.w + 0.26, 0.16, e.d + 0.26).translate(e.x, y + height + 0.08, e.z),
    );
  }
  const g = new THREE.Group();
  const body = new THREE.Mesh(mergeGeometries(bodyGeos), MAT.columnBase);
  const cap = new THREE.Mesh(mergeGeometries(capGeos), MAT.ridge);
  bodyGeos.forEach((x) => x.dispose());
  capGeos.forEach((x) => x.dispose());
  body.castShadow = body.receiveShadow = true;
  cap.castShadow = true;
  g.add(body, cap);
  return g;
}

function baseCourse(width, depth, height) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(width + 2.2, height, depth + 2.2), MAT.columnBase);
  base.position.y = height / 2;
  g.add(base);
  const shadowLine = new THREE.Mesh(
    new THREE.BoxGeometry(width + 2.7, 0.32, depth + 2.7),
    MAT.brick,
  );
  shadowLine.position.y = height - 0.16;
  g.add(shadowLine);
  return g;
}

function coping(width, depth, y) {
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.9, 0.55, depth + 0.9), MAT.ridge);
  cap.position.y = y + 0.27;
  const course = new THREE.Mesh(new THREE.BoxGeometry(width + 1.35, 0.2, depth + 1.35), MAT.ridge);
  course.position.y = y + 0.62;
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(width + 0.35, 0.45, depth + 0.35), MAT.darkWood);
  fascia.position.y = y - 0.1;
  g.add(cap, course, fascia);
  return g;
}

/* ---------------- 午门 ---------------- */
export function createWumen() {
  const g = new THREE.Group();
  const platformH = 14;
  const mainW = 120;
  const mainD = 24;
  const mainZ = 246;
  const frontZ = mainZ + mainD / 2;
  const backZ = mainZ - mainD / 2;

  const arches = [
    { x: 0, w: 13, h: 11.6, open: true },
    { x: -27, w: 8.4, h: 9.2, open: false },
    { x: 27, w: 8.4, h: 9.2, open: false },
  ];
  const sideArches = [
    { x: -53, w: 5.4, h: 7.2, open: false },
    { x: 53, w: 5.4, h: 7.2, open: false },
  ];

  g.add(baseCourse(mainW, mainD, 2.6));

  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(mainW, platformH, mainD), gateWallMat);
  mainBody.position.set(0, platformH / 2, mainZ);
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  g.add(mainBody);

  gateOpenings(g, {
    width: mainW, depth: mainD, height: platformH,
    arches, zFront: frontZ, zBack: backZ,
  });

  /* 雁翅楼城台 */
  for (const sign of [-1, 1]) {
    const wingD = 44;
    const wingZ = frontZ + wingD / 2;
    const x = sign * 52;
    g.add(baseCourse(16, wingD, 2.6));
    const wing = new THREE.Mesh(new THREE.BoxGeometry(16, platformH, wingD), wingWallMat);
    wing.position.set(x, platformH / 2, wingZ);
    wing.castShadow = true;
    wing.receiveShadow = true;
    g.add(wing);

    gateOpenings(g, {
      width: 16, depth: wingD, height: platformH - 3.4,
      arches: [{ x: 0, w: 5.4, h: 6.6, open: false }],
      zFront: frontZ + wingD, zBack: frontZ + 0.5,
    });

    const capGroup = coping(16, wingD, platformH);
    capGroup.position.set(x, 0, wingZ);
    g.add(capGroup);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(17.4, 0.62, wingD + 0.9), MAT.ridge);
    cap.position.set(x, platformH + 0.31, wingZ);
    g.add(cap);

    /* 城台顶廊庑 */
    const galleryH = 5;
    const gallery = new THREE.Mesh(new THREE.BoxGeometry(10, galleryH, 30), MAT.wall);
    gallery.position.set(x, platformH + galleryH / 2, 280);
    gallery.castShadow = gallery.receiveShadow = true;
    g.add(gallery);

    const lattice = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, galleryH * 0.52, 25),
      MAT.darkWood,
    );
    lattice.position.set(x - sign * 5.05, platformH + galleryH * 0.56, 280);
    g.add(lattice);

    const band = new THREE.Mesh(new THREE.BoxGeometry(11, 0.9, 31), MAT.beam);
    band.position.set(x, platformH + galleryH + 0.45, 280);
    g.add(band);
    const dougong = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.85, 32.2), MAT.dougong);
    dougong.position.set(x, platformH + galleryH + 1.3, 280);
    g.add(dougong);

    const galleryRoof = createRoof({
      width: 34, depth: 16, ridge: 22, height: 3.4, lift: 1.5, curve: 1.55,
      segmentsU: 18, segmentsV: 6,
    });
    galleryRoof.rotation.y = Math.PI / 2;
    galleryRoof.position.set(x, platformH + galleryH + 1.8, 280);
    g.add(galleryRoof);

    /* 雁翅楼角亭 */
    for (const z of [263, 297]) {
      const pav = createPavilion({
        size: 9, bodyH: 4.4, roofH: 5.2, double: true, baseH: 0.7, eaveExtra: 2.3,
      });
      pav.position.set(x, platformH, z);
      g.add(pav);
    }

    /* 平台围栏 */
    g.add(parapet([
      { x, z: frontZ + 3.5, w: 1.1, d: 7 },
      { x, z: frontZ + wingD - 2, w: 17, d: 1.1 },
      { x: x + sign * 8, z: wingZ, w: 1.1, d: wingD },
    ], platformH + 0.55));
  }

  /* 主城台围栏 */
  g.add(parapet([
    { x: -34, z: frontZ - 0.6, w: 52, d: 1.2 },
    { x: 34, z: frontZ - 0.6, w: 52, d: 1.2 },
    { x: 0, z: backZ + 0.6, w: mainW, d: 1.2 },
    { x: -mainW / 2 + 0.6, z: mainZ, w: 1.2, d: mainD },
    { x: mainW / 2 - 0.6, z: mainZ, w: 1.2, d: mainD },
  ], platformH + 0.25));

  /* 五凤楼 */
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(56, 1.3, 28), MAT.marble);
  plinth.position.set(0, platformH + 0.65, mainZ);
  plinth.castShadow = plinth.receiveShadow = true;
  g.add(plinth);

  const tower = createHall(HALL_CONFIGS.wumenTower);
  tower.position.set(0, platformH + 1.3, mainZ);
  g.add(tower);

  /* 檐下宫灯 */
  for (const x of [-9.5, 9.5]) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), MAT.lantern);
    lantern.scale.y = 1.3;
    lantern.position.set(x, platformH + 0.6, backZ + 0.5);
    g.add(lantern);
  }

  g.userData = { id: 'wumen', name: '午门' };
  return shadow(g);
}

/* ---------------- 神武门 ---------------- */
export function createShenwumen() {
  const g = new THREE.Group();
  const platformH = 13;
  const width = 56;
  const depth = 26;
  const zCenter = -342;
  const zFront = zCenter + depth / 2;
  const zBack = zCenter - depth / 2;

  const arches = [
    { x: 0, w: 10.2, h: 9.4, open: true },
    { x: -17.5, w: 6.4, h: 7.2, open: false },
    { x: 17.5, w: 6.4, h: 7.2, open: false },
  ];

  g.add(baseCourse(width, depth, 2.4));
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, platformH, depth), gateWallMat);
  body.position.set(0, platformH / 2, zCenter);
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  gateOpenings(g, {
    width, depth, height: platformH, arches, zFront, zBack,
  });

  coping(width, depth, platformH).position.set(0, 0, zCenter);
  g.add(parapet([
    { x: -20, z: zFront - 0.5, w: 16, d: 1.1 },
    { x: 20, z: zFront - 0.5, w: 16, d: 1.1 },
    { x: 0, z: zBack + 0.5, w: width, d: 1.1 },
    { x: -width / 2 + 0.5, z: zCenter, w: 1.1, d: depth },
    { x: width / 2 - 0.5, z: zCenter, w: 1.1, d: depth },
  ], platformH + 0.2));

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(42, 1.2, 22), MAT.marble);
  plinth.position.set(0, platformH + 0.6, zCenter);
  g.add(plinth);

  const tower = createHall(HALL_CONFIGS.shenwumenTower);
  tower.position.set(0, platformH + 1.2, zCenter);
  g.add(tower);

  g.userData = { id: 'shenwumen', name: '神武门' };
  return shadow(g);
}

/* ---------------- 角楼 ---------------- */
export function createCornerTower() {
  const g = new THREE.Group();
  const platformH = 11.5;

  g.add(baseCourse(23, 23, 2.2));
  const platform = new THREE.Mesh(new THREE.BoxGeometry(23, platformH, 23), gateWallMat);
  platform.position.y = platformH / 2;
  platform.castShadow = platform.receiveShadow = true;
  g.add(platform);

  g.add(parapet([
    { x: 0, z: 11.5, w: 23, d: 0.8 },
    { x: 0, z: -11.5, w: 23, d: 0.8 },
    { x: 11.5, z: 0, w: 0.8, d: 23 },
    { x: -11.5, z: 0, w: 0.8, d: 23 },
  ], platformH + 0.1, 0.8));

  const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(17, 0.8, 17), MAT.marble);
  basePlinth.position.y = platformH + 0.4;
  g.add(basePlinth);

  /* 首层 */
  const lowerH = 5.2;
  const lower = new THREE.Mesh(new THREE.BoxGeometry(13, lowerH, 13), MAT.wall);
  lower.position.y = platformH + 0.8 + lowerH / 2;
  g.add(lower);

  const lowerBandY = platformH + 0.8 + lowerH;
  const lowerBand = new THREE.Mesh(new THREE.BoxGeometry(14.4, 1.1, 14.4), MAT.beam);
  lowerBand.position.y = lowerBandY + 0.55;
  const lowerDougong = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.9, 15.6), MAT.dougong);
  lowerDougong.position.y = lowerBandY + 1.55;
  g.add(lowerBand, lowerDougong);

  const lowerRoof = createRoof({
    width: 20.5, depth: 20.5, ridge: 6.5, height: 3, lift: 1.6, curve: 1.6,
    segmentsU: 22, segmentsV: 7,
  });
  lowerRoof.rotation.y = Math.PI / 4;
  lowerRoof.position.y = lowerBandY + 2.1;
  g.add(lowerRoof);

  /* 中层 */
  const midH = 3.8;
  const midY = lowerBandY + 2.2;
  const mid = new THREE.Mesh(new THREE.BoxGeometry(8.6, midH, 8.6), MAT.wall);
  mid.position.y = midY + midH / 2;
  g.add(mid);

  const lattice = new THREE.Mesh(new THREE.BoxGeometry(7.4, midH * 0.48, 0.16), MAT.lattice);
  lattice.position.set(0, midY + midH * 0.58, 4.38);
  g.add(lattice);

  const midBandY = midY + midH;
  const midBand = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.9, 9.8), MAT.beam);
  midBand.position.y = midBandY + 0.45;
  const midDougong = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.8, 10.8), MAT.dougong);
  midDougong.position.y = midBandY + 1.35;
  g.add(midBand, midDougong);

  const midRoof = createRoof({
    width: 15.5, depth: 15.5, ridge: 4, height: 2.4, lift: 1.3, curve: 1.6,
    segmentsU: 20, segmentsV: 6,
  });
  midRoof.position.y = midBandY + 1.85;
  g.add(midRoof);

  /* 顶层 */
  const topH = 3;
  const topY = midBandY + 1.95;
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.6, topH, 5.6), MAT.wall);
  top.position.y = topY + topH / 2;
  g.add(top);
  const topBand = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1, 6.8), MAT.beam);
  topBand.position.y = topY + topH + 0.5;
  g.add(topBand);

  const topRoof = createRoof({
    width: 10.6, depth: 10.6, height: 4.4, ridge: 0, style: 'pyramid',
    lift: 1.8, curve: 1.7, segmentsU: 22, segmentsV: 8,
  });
  topRoof.position.y = topY + topH + 1.05;
  g.add(topRoof);

  /* 四面小披檐 */
  for (const rot of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const dor = createRoof({
      width: 7.6, depth: 3.2, ridge: 3.6, height: 1.1, lift: 0.5, curve: 1.4,
      segmentsU: 10, segmentsV: 3,
    });
    dor.position.set(Math.sin(rot) * 6.4, platformH + 4.9, Math.cos(rot) * 6.4);
    dor.rotation.y = rot;
    g.add(dor);
  }

  g.userData = { id: 'corner', name: '角楼' };
  return shadow(g);
}
