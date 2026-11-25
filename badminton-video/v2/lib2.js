// v2 high-quality assets: feather-by-feather shuttlecock, carbon racket, rigged athlete (Xbot, three.js example model)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { glowSprite, clamp, lerp } from '/build/lib.js';

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// ------------------------------------------------------------ shuttlecock (cork toward +X, skirt toward -X)
function featherTexture() {
  const c = cv(256, 768), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 768, 0, 0); gr.addColorStop(0, '#efe6d2'); gr.addColorStop(.55, '#fbf7ee'); gr.addColorStop(1, '#ffffff');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 768);
  // barbs
  g.lineWidth = 1.1;
  for (let y = 0; y < 768; y += 5) {
    for (const s of [-1, 1]) {
      g.strokeStyle = `rgba(150,128,96,${.10 + Math.random() * .12})`;
      g.beginPath(); g.moveTo(128, y); g.lineTo(128 + s * 128, y - 70 - Math.random() * 20); g.stroke();
    }
  }
  // rachis (shaft)
  const sh = g.createLinearGradient(122, 0, 134, 0); sh.addColorStop(0, 'rgba(190,160,110,0)'); sh.addColorStop(.5, 'rgba(176,142,88,.95)'); sh.addColorStop(1, 'rgba(190,160,110,0)');
  g.fillStyle = sh; g.fillRect(120, 0, 16, 768);
  // soft edge darkening for depth
  const ed = g.createLinearGradient(0, 0, 256, 0); ed.addColorStop(0, 'rgba(120,100,70,.28)'); ed.addColorStop(.12, 'rgba(120,100,70,0)'); ed.addColorStop(.88, 'rgba(120,100,70,0)'); ed.addColorStop(1, 'rgba(120,100,70,.28)');
  g.fillStyle = ed; g.fillRect(0, 0, 256, 768);
  return tex(c);
}
function corkTexture() {
  const c = cv(256, 128), g = c.getContext('2d');
  g.fillStyle = '#e8c9a0'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${120 + Math.random() * 60},${80 + Math.random() * 40},50,${Math.random() * .18})`; g.fillRect(Math.random() * 256, Math.random() * 128, 2, 2); }
  g.strokeStyle = 'rgba(80,50,30,.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, 64); g.lineTo(256, 64); g.stroke();
  return tex(c);
}
const FEATHER_TEX = featherTexture(), CORK_TEX = corkTexture();

export function makeShuttleHQ() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const N = 16, L = .066, r0 = .0132, r1 = .0338, SEG_U = 4, SEG_V = 28, x0 = -.0045;
  const pos = [], uv = [], col = [], idx = [];
  const rAt = (v) => lerp(r0, r1, Math.pow(v, .85));
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, base = pos.length / 3;
    for (let iv = 0; iv <= SEG_V; iv++) {
      const v = iv / SEG_V, r = rAt(v);
      for (let iu = 0; iu <= SEG_U; iu++) {
        const u = iu / SEG_U * 2 - 1;
        const half = Math.PI / N * (1.22 + .16 * v);               // angular half-width (overlap)
        const phi = a + u * half;
        const rr = r + .00045 * (u + 1) * .5 + .0009 * (u * u) * v; // shingle overlap + slight cup
        const tip = Math.pow(v, 6) * .0016 * (1 - u * u);           // rounded feather tips
        pos.push(x0 - v * L - tip, rr * Math.cos(phi), rr * Math.sin(phi));
        uv.push(iu / SEG_U, v); col.push(1, 1, 1);
      }
    }
    for (let iv = 0; iv < SEG_V; iv++) for (let iu = 0; iu < SEG_U; iu++) {
      const A = base + iv * (SEG_U + 1) + iu, B = A + 1, C = A + SEG_U + 1, D = C + 1; idx.push(A, C, B, B, C, D);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const fm = new THREE.MeshPhysicalMaterial({ map: FEATHER_TEX, vertexColors: true, roughness: .5, side: THREE.DoubleSide, sheen: .6, sheenColor: new THREE.Color(0xfff0d8), sheenRoughness: .5, emissive: 0x2a1204, emissiveIntensity: .5 });
  const feathers = new THREE.Mesh(geo, fm); feathers.castShadow = true; body.add(feathers);
  // cork head + leather collar
  const cork = new THREE.Mesh(new THREE.SphereGeometry(.0129, 48, 32), new THREE.MeshPhysicalMaterial({ map: CORK_TEX, roughness: .55, clearcoat: .25 }));
  cork.scale.set(.93, 1, 1); cork.position.x = .0012; cork.castShadow = true; body.add(cork);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.0127, .0132, .0075, 40), new THREE.MeshPhysicalMaterial({ color: 0xd9b27c, roughness: .6 }));
  collar.rotation.z = Math.PI / 2; collar.position.x = -.0062; body.add(collar);
  // binding threads
  for (const x of [-.0185, -.0425]) {
    const v = (-x + x0) / L, r = rAt(clamp(v)) + .0011;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .00085, 8, 64), new THREE.MeshStandardMaterial({ color: 0xe6d6b4, roughness: .7 }));
    ring.rotation.y = Math.PI / 2; ring.position.x = x; body.add(ring);
  }
  const glow = glowSprite(0xff7a22, .06, .55); glow.position.x = -.03; g.add(glow);
  g.userData = { body, glow, feathers, colAttr: geo.getAttribute('color'), perFeather: (SEG_V + 1) * (SEG_U + 1) };
  return g;
}
// light up the first n feathers (hot orange tint) — used by the "16 FEATHERS" counter
export function highlightFeathers(shuttle, n, pulse = 0) {
  const { colAttr, perFeather } = shuttle.userData;
  for (let i = 0; i < 16; i++) for (let k = 0; k < perFeather; k++) {
    const on = i < n; const f = on ? 1 : 0; const j = i * perFeather + k;
    colAttr.setXYZ(j, 1, 1 - .45 * f, 1 - .85 * f * (.7 + .3 * pulse));
  }
  colAttr.needsUpdate = true;
}

// ------------------------------------------------------------ racket (origin at grip end, +Y toward head, face normal Z)
export function makeRacketHQ() {
  const g = new THREE.Group();
  const frame = new THREE.MeshPhysicalMaterial({ color: 0x10131c, metalness: .7, roughness: .25, clearcoat: 1, clearcoatRoughness: .15 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xff6a13, roughness: .4, emissive: 0x6a2200, emissiveIntensity: .5 });
  const hl = .2, shl = .15, a = .1, b = .135, cy = hl + shl + b - .015, p = 2.4;
  const pts = []; for (let i = 0; i < 96; i++) { const t = i / 96 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); pts.push(new THREE.Vector3(a * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), cy + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / p), 0)); }
  const head = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 192, .0058, 10, true), frame); head.castShadow = true; g.add(head);
  const acc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.filter((_, i) => i > 60 && i < 84).map(v => v.clone().multiplyScalar(1).setZ(0)), false), 24, .0062, 8, false), accent); g.add(acc);
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(s * .02, cy - b + .004, 0), new THREE.Vector3(s * .012, hl + shl + .035, 0), new THREE.Vector3(0, hl + shl, 0)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, .0052, 8, false), frame));
  }
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.0042, .0046, shl + .01, 12), frame); shaft.position.y = hl + shl / 2; g.add(shaft);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.0118, .0128, hl, 16), accent); grip.position.y = hl / 2; g.add(grip);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.0138, .0138, .012, 16), frame); cap.position.y = .004; g.add(cap);
  // strings
  const sp = []; const nV = 15, nH = 19;
  const ymax = (x) => b * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / a, p)), 1 / p);
  for (let i = 1; i < nV; i++) { const x = -a + 2 * a * i / nV, y = ymax(x); sp.push(x, cy - y, 0, x, cy + y, 0); }
  const xmax = (y) => a * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y) / b, p)), 1 / p);
  for (let j = 1; j < nH; j++) { const y = -b + 2 * b * j / nH, x = xmax(y); sp.push(-x, cy + y, 0, x, cy + y, 0); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xf4f6ff, transparent: true, opacity: .55 })));
  g.userData.headY = cy; return g;
}

// ------------------------------------------------------------ tennis ball (for the speed-decay diagram)
export function makeBallHQ() {
  const c = cv(512, 256), x = c.getContext('2d'); x.fillStyle = '#d8ff2e'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${150 + Math.random() * 80},${200 + Math.random() * 55},20,${Math.random() * .25})`; x.fillRect(Math.random() * 512, Math.random() * 256, 2, 2); }
  x.strokeStyle = '#f7fff0'; x.lineWidth = 9; for (const o of [0, 256]) { x.beginPath(); x.moveTo(o, 0); x.bezierCurveTo(o + 90, 70, o + 90, 190, o, 256); x.stroke(); x.beginPath(); x.moveTo(o + 256 * .5, 0); x.bezierCurveTo(o + 256 * .5 - 90, 70, o + 256 * .5 - 90, 190, o + 256 * .5, 256); x.stroke(); }
  const m = new THREE.Mesh(new THREE.SphereGeometry(.0335, 40, 28), new THREE.MeshPhysicalMaterial({ map: tex(c), roughness: .85, sheen: 1, sheenColor: new THREE.Color(0xeaff80), emissive: 0x405000, emissiveIntensity: .35 }));
  m.castShadow = true; return m;
}

// ------------------------------------------------------------ athlete (Xbot rig, driven by "aim the bone" posing)
const loader = new GLTFLoader();
let XBOT = null;
export async function loadXbot() { XBOT = await loader.loadAsync('/v2/assets/Xbot.glb'); return XBOT; }
const BN = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'RightHandMiddle1', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftHandMiddle1',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'HeadTop_End'];

export function makeAthlete({ surface = 0x16275c, joints = 0xff6a13, height = 1.84, racket = true } = {}) {
  const model = clone(XBOT.scene); const root = new THREE.Group(); root.add(model);
  const bones = {}; model.traverse(o => { if (o.isBone) { const n = o.name.replace('mixamorig', ''); bones[n] = o; } });
  const sm = new THREE.MeshPhysicalMaterial({ color: surface, roughness: .32, metalness: .15, clearcoat: .8, clearcoatRoughness: .25 });
  const jm = new THREE.MeshStandardMaterial({ color: joints, roughness: .45, metalness: .3, emissive: joints, emissiveIntensity: .22 });
  model.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.material = /Joints/i.test(o.material.name) ? jm : sm; } });
  root.updateMatrixWorld(true);
  const top = new THREE.Vector3(), toe = new THREE.Vector3(); bones.HeadTop_End.getWorldPosition(top); bones.LeftToeBase.getWorldPosition(toe);
  const sc = height / ((top.y - toe.y) + .06); model.scale.setScalar(sc); root.updateMatrixWorld(true);
  const A = { root, model, bones, rest: {}, scale: sc, racket: null };
  for (const k of BN) if (bones[k]) A.rest[k] = { q: bones[k].quaternion.clone(), p: bones[k].position.clone() };
  if (racket) { A.racket = makeRacketHQ(); root.parent ? null : null; }
  A.shadowCaster = true; return A;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
function aim(bone, child, dir) {
  bone.updateWorldMatrix(true, false); child.updateWorldMatrix(true, false);
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _b.sub(_a).normalize();
  _q.setFromUnitVectors(_b, dir);
  bone.getWorldQuaternion(_q2); bone.parent.getWorldQuaternion(_q3);
  bone.quaternion.copy(_q3.invert().multiply(_q).multiply(_q2)); bone.updateMatrixWorld(true);
}
const EUL = new THREE.Euler(), QL = new THREE.Quaternion();
// spec: {c:crouch 0..1, j:jump m, lean, twist, headX, rU,rF,rR (Vector3 in char-local, +Z fwd, +X char-left), lU,lF, spread}
export function poseAthlete(A, s) {
  const { bones: B, rest } = A;
  for (const k in rest) { B[k].quaternion.copy(rest[k].q); B[k].position.copy(rest[k].p); }
  A.root.position.y = A.baseY || 0; A.root.updateMatrixWorld(true);
  const lean = s.lean || 0, tw = s.twist || 0;
  for (const k of ['Spine', 'Spine1', 'Spine2']) { EUL.set(-lean / 3, tw / 3, 0, 'XYZ'); QL.setFromEuler(EUL); B[k].quaternion.copy(rest[k].q).multiply(QL); }
  EUL.set(-(s.headX || 0), -tw * .4, 0); QL.setFromEuler(EUL); B.Head.quaternion.copy(rest.Head.q).multiply(QL);
  A.root.updateMatrixWorld(true);
  const rq = new THREE.Quaternion(); A.root.getWorldQuaternion(rq);
  const sq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, tw * .85, 0));
  const W = (v) => v.clone().normalize().applyQuaternion(sq).applyQuaternion(rq);
  const Wl = (v) => v.clone().normalize().applyQuaternion(rq);
  // arms (aim root -> tip)
  const arm = (S, u, f, r, hand) => {
    aim(B[S + 'Arm'], B[S + 'ForeArm'], W(u)); aim(B[S + 'ForeArm'], B[S + 'Hand'], W(f)); aim(B[S + 'Hand'], B[S + 'HandMiddle1'], W(r || f));
  };
  if (s.rU) arm('Right', s.rU, s.rF, s.rR); if (s.lU) arm('Left', s.lU, s.lF || s.lU, s.lR);
  // legs
  const c = s.c ?? .2, hip = .55 * c, kn = 1.0 * c, sp = s.spread ?? .12, air = clamp((s.j || 0) / .2);
  for (const [S, sg] of [['Right', -1], ['Left', 1]]) {
    const hh = hip + air * (sg < 0 ? .45 : -.1) + (s.stagger ? (sg < 0 ? .22 : -.18) : 0), kk = kn + air * (sg < 0 ? .8 : .5);
    aim(B[S + 'UpLeg'], B[S + 'Leg'], Wl(new THREE.Vector3(sg * sp, -Math.cos(hh), Math.sin(hh))));
    aim(B[S + 'Leg'], B[S + 'Foot'], Wl(new THREE.Vector3(sg * sp * .6, -Math.cos(hh - kk), Math.sin(hh - kk))));
    aim(B[S + 'Foot'], B[S + 'ToeBase'], Wl(new THREE.Vector3(0, -.12 - air * .5, 1)));
  }
  // ground contact + jump
  A.root.updateMatrixWorld(true);
  let low = 1e9; for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) { B[k].getWorldPosition(_a); low = Math.min(low, _a.y); }
  A.root.position.y += (.035 - low) + (s.j || 0); A.root.updateMatrixWorld(true);
  // racket follows the right hand
  if (A.racket) {
    B.RightHand.getWorldPosition(_a); B.RightHandMiddle1.getWorldPosition(_b); const dir = _b.clone().sub(_a).normalize();
    A.racket.position.copy(_a).addScaledVector(dir, -.035); A.racket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    A.racket.updateMatrixWorld(true);
  }
}
export function racketHeadWorld(A) { A.racket.updateMatrixWorld(true); return A.racket.localToWorld(new THREE.Vector3(0, A.racket.userData.headY, 0)); }
