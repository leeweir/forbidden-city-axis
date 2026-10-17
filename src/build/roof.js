import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from '../core/materials.js';

const V = THREE.Vector3;

/**
 * 中式屋顶生成器（参数化曲面）
 * 原点位于檐口平面中心，向外为 +z。
 */
export function createRoof({
  width,
  depth,
  height,
  ridge = width * 0.46,
  lift = 2.6,
  curve = 1.75,
  style = 'hip', // hip | pyramid
  material = MAT.roof,
  edgeMaterial = MAT.ridge,
  segmentsU = 26,
  segmentsV = 10,
  uvW = 2.4,
  uvH = 2.0,
  ornament = true,
}) {
  const group = new THREE.Group();
  const halfW = width / 2;
  const halfD = depth / 2;
  const halfR = style === 'pyramid' ? 0 : Math.min(ridge, width * 0.94) / 2;

  const flareOf = (edge, v) => 1 + 0.032 * Math.pow(Math.abs(edge), 8) * Math.pow(1 - v, 3);
  const liftOf = (edge, v) => lift * Math.pow(Math.abs(edge), 5) * Math.pow(1 - v, 2.4);
  const yOf = (v) => height * Math.pow(v, curve);

  function pointFront(edge, v, signZ) {
    const f = flareOf(edge, v);
    const x = THREE.MathUtils.lerp(edge * halfW, edge * halfR, Math.pow(v, 0.9)) * f;
    const z = signZ * halfD * (1 - v) * f;
    const y = yOf(v) + liftOf(edge, v);
    return [x, y, z];
  }

  function pointSide(edge, v, signX) {
    const f = flareOf(edge, v);
    const x = signX * THREE.MathUtils.lerp(halfW, halfR, Math.pow(v, 0.9)) * f;
    const z = edge * halfD * (1 - v) * f;
    const y = yOf(v) + liftOf(edge, v);
    return [x, y, z];
  }

  function buildFace(kind, sign) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const slope = Math.hypot(kind === 'front' ? halfD : halfW, height);
    for (let j = 0; j <= segmentsV; j++) {
      const v = j / segmentsV;
      for (let i = 0; i <= segmentsU; i++) {
        const edge = (i / segmentsU) * 2 - 1;
        const p = kind === 'front'
          ? pointFront(edge, v, sign)
          : pointSide(edge, v, sign);
        positions.push(p[0], p[1], p[2]);
        const lateral = kind === 'front' ? edge * halfW : edge * halfD;
        uvs.push(lateral / uvW, (v * slope) / uvH);
      }
    }
    for (let j = 0; j < segmentsV; j++) {
      for (let i = 0; i < segmentsU; i++) {
        const a = j * (segmentsU + 1) + i;
        const b = a + 1;
        const c = a + segmentsU + 1;
        const d = c + 1;
        if (kind === 'front') {
          if (sign > 0) indices.push(a, b, c, b, d, c);
          else indices.push(a, c, b, b, c, d);
        } else {
          if (sign > 0) indices.push(a, c, b, b, c, d);
          else indices.push(a, b, c, b, d, c);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  const faceGeos = [
    buildFace('front', 1),
    buildFace('front', -1),
    buildFace('side', 1),
    buildFace('side', -1),
  ];
  const roofGeo = mergeGeometries(faceGeos);
  for (const g of faceGeos) g.dispose();
  const roofMesh = new THREE.Mesh(roofGeo, material);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  /* ---------- 檐口金线 ---------- */
  const edgeGeos = [];
  const eaveSegments = 20;
  function eaveCurve(kind, sign) {
    const pts = [];
    for (let i = 0; i <= eaveSegments; i++) {
      const edge = (i / eaveSegments) * 2 - 1;
      const p = kind === 'front' ? pointFront(edge, 0, sign) : pointSide(edge, 0, sign);
      pts.push(new V(p[0], p[1] + 0.16, p[2]));
    }
    return new THREE.CatmullRomCurve3(pts);
  }
  for (const sign of [1, -1]) {
    edgeGeos.push(new THREE.TubeGeometry(eaveCurve('front', sign), 36, 0.24, 5, false));
    edgeGeos.push(new THREE.TubeGeometry(eaveCurve('side', sign), 36, 0.24, 5, false));
  }

  /* ---------- 垂脊 / 戗脊 ---------- */
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const v = i / 16;
        const p = pointFront(sx, v, sz);
        pts.push(new V(p[0] * 1.004, p[1] + 0.2, p[2] * 1.004));
      }
      const curveLine = new THREE.CatmullRomCurve3(pts);
      edgeGeos.push(new THREE.TubeGeometry(curveLine, 32, 0.31, 5, false));
    }
  }

  /* ---------- 正脊与鸱吻 ---------- */
  if (style !== 'pyramid' && halfR > 0.4) {
    const ridgeGeo = new THREE.BoxGeometry(halfR * 2 + 1.4, 0.95, 0.8);
    ridgeGeo.translate(0, height + 0.42, 0);
    edgeGeos.push(ridgeGeo);
    edgeGeos.push(new THREE.BoxGeometry(halfR * 2 + 2.1, 0.18, 1.05).translate(0, height + 0.95, 0));

    const chiwen = (sign) => {
      const pts = [
        new V(0, 0, 0),
        new V(0.18 * sign, 0.5, 0),
        new V(0.55 * sign, 0.95, 0),
        new V(1.0 * sign, 1.15, 0),
        new V(1.55 * sign, 1.0, 0),
      ];
      const curveLine = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curveLine, 14, 0.36, 5, false);
      geo.translate(sign * halfR, height + 0.7, 0);
      return geo;
    };
    edgeGeos.push(chiwen(1), chiwen(-1));
  }

  const edgeGeo = mergeGeometries(edgeGeos);
  for (const g of edgeGeos) g.dispose();
  const edgeMesh = new THREE.Mesh(edgeGeo, edgeMaterial);
  edgeMesh.castShadow = true;
  group.add(edgeMesh);

  /* ---------- 攒尖宝顶 ---------- */
  if (style === 'pyramid' && ornament) {
    const parts = [];
    const scale = Math.min(1.4, Math.max(0.65, height / 12));
    const base = new THREE.CylinderGeometry(0.9 * scale, 1.1 * scale, 0.5 * scale, 16);
    base.translate(0, height + 0.25 * scale, 0);
    const bulge = new THREE.SphereGeometry(0.62 * scale, 16, 12);
    bulge.translate(0, height + 0.95 * scale, 0);
    const spire = new THREE.ConeGeometry(0.22 * scale, 1.6 * scale, 12);
    spire.translate(0, height + 1.85 * scale, 0);
    parts.push(base, bulge, spire);
    const gold = new THREE.Mesh(mergeGeometries(parts), MAT.gold);
    parts.forEach((g) => g.dispose());
    gold.castShadow = true;
    group.add(gold);
  }

  group.userData.topY = height;
  return group;
}
