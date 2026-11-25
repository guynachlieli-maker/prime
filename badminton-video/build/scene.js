import * as THREE from 'three';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeBack, noise, kf, C, makeShuttle, Trail, makeHuman, makeCar, makeCourt, makeBall, glowSprite, blobShadow, resetPose } from './lib.js';

const W = 1080, H = 1920;
const TL = await (await fetch('/build/timeline.json')).json();
const SC = TL.scenes, LN = TL.lines, M = TL.marks, EV = TL.events;
await document.fonts.load('700 100px Oswald'); await document.fonts.load('500 40px Oswald');

// ------------------------------------------------------------------ renderer / scene
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060a1c);
scene.fog = new THREE.FogExp2(0x060a1c, .017);
scene.add(new THREE.HemisphereLight(0x6fb8d8, 0x0a0f24, .9));
const key = new THREE.DirectionalLight(0xffc8a0, 1.8); key.position.set(4, 8, 6); scene.add(key);
const rim = new THREE.DirectionalLight(0x38d6e6, 2.6); rim.position.set(-6, 5, -7); scene.add(rim);
const fill = new THREE.DirectionalLight(0x5577ff, .6); fill.position.set(-5, 2, 6); scene.add(fill);
const heroLight = new THREE.PointLight(0xff7a22, 0, 12, 1.6); scene.add(heroLight);

const cam = new THREE.PerspectiveCamera(40, W / H, .05, 400);
const camL = new THREE.PerspectiveCamera(55, (W / 2) / H, .05, 400);
const camR = new THREE.PerspectiveCamera(55, (W / 2) / H, .05, 400);

// floors
const court = makeCourt(); scene.add(court);
const plain = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x0b1230, roughness: .28, metalness: .5 }));
plain.rotation.x = -Math.PI / 2; plain.position.set(100, -.02, 0); scene.add(plain);

// ------------------------------------------------------------------ actors
const PB = new THREE.Vector3(2.4, 0, 0), PT = new THREE.Vector3(200, 0, 0);
const hB = makeHuman({ racket: 'badminton' }); hB.root.position.copy(PB); hB.root.rotation.y = -Math.PI / 2; scene.add(hB.root);
const hT = makeHuman({ shirt: 0xf1f3fa, shorts: 0xe8ebf5, shoe: 0xd6ff2a, racket: 'tennis' }); hT.root.position.copy(PT); hT.root.rotation.y = -Math.PI / 2; scene.add(hT.root);
const hero = makeShuttle(1); scene.add(hero);
const heroTrail = new Trail(34, C.orange, 1, .3); scene.add(heroTrail.group);
const ball = makeBall(); scene.add(ball);
const ballTrail = new Trail(30, C.green, .5, .5); scene.add(ballTrail.group);
const car = makeCar(); car.scale.setScalar(.55); scene.add(car);

// F1 scrolling scenery
const trackFx = new THREE.Group(); scene.add(trackFx);
for (let i = -22; i <= 22; i++) for (const s of [-1]) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.4, .06), new THREE.MeshBasicMaterial({ color: 0x8fe9ff }));
  p.position.set(i * 2.5, 1.2, s * 5.5); trackFx.add(p);
  const d = new THREE.Mesh(new THREE.BoxGeometry(1.1, .02, .12), new THREE.MeshBasicMaterial({ color: 0xff7a1f }));
  d.position.set(i * 2.5, .015, s * 1.9); trackFx.add(d);
}

// records bars
const bars = new THREE.Group(); scene.add(bars);
const BAR_X = [-1.45, 0, 1.45], BAR_V = [493, 565, 438], barMeshes = [];
for (let i = 0; i < 3; i++) {
  const g = new THREE.Group(); g.position.x = BAR_X[i];
  const b = new THREE.Mesh(new THREE.BoxGeometry(.95, 1, .95), new THREE.MeshStandardMaterial({ color: i === 2 ? 0x2fd3d0 : 0xff6a13, roughness: .3, metalness: .2, emissive: i === 2 ? 0x1c8f90 : 0xd94a00, emissiveIntensity: .75 }));
  g.add(b);
  const sh = makeShuttle(9); sh.rotation.z = Math.PI / 2; g.add(sh);
  const gl = glowSprite(i === 2 ? C.teal : C.hot, 1.8, .7); g.add(gl);
  bars.add(g); barMeshes.push({ g, b, sh, gl });
}
const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, .06, 64), new THREE.MeshStandardMaterial({ color: 0x0d1636, roughness: .25, metalness: .6 }));
pad.position.y = -.03; bars.add(pad);

// diagram (why)
const diag = new THREE.Group(); scene.add(diag);
const dShuttle = makeShuttle(5.5), dBall = makeBall(); dBall.scale.setScalar(7.5);
diag.add(dShuttle, dBall);
function textSprite(txt, color = '#cfe3ff', size = 1) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.font = '700 64px Oswald'; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(2.2 * size, .83 * size, 1); return s;
}
const ZS = -1.6, ZB = 1.6;
for (const [z, col] of [[ZS, 0xff6a13], [ZB, 0x39ff14]]) {
  const lane = new THREE.Mesh(new THREE.BoxGeometry(60, .03, 2.2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .13 })); lane.position.set(24, .02, z); diag.add(lane);
}
for (let m = 0; m <= 24; m += 2) {
  const t = new THREE.Mesh(new THREE.BoxGeometry(.06, .04, 5.2), new THREE.MeshBasicMaterial({ color: 0xbfd6ff, transparent: true, opacity: .5 })); t.position.set(m, .03, 0); diag.add(t);
  const s = textSprite(m + ' M', '#cfe3ff', .9); s.position.set(m, .08, 3.5); s.center.set(.5, 0); diag.add(s);
}
function makeArrow(color) {
  const g = new THREE.Group();
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1, 12), new THREE.MeshBasicMaterial({ color })); sh.rotation.z = -Math.PI / 2; g.add(sh);
  const hd = new THREE.Mesh(new THREE.ConeGeometry(.24, .5, 16), new THREE.MeshBasicMaterial({ color })); hd.rotation.z = -Math.PI / 2; g.add(hd);
  g.userData = { sh, hd }; return g;
}
const arrS = makeArrow(0xff7a1f), arrB = makeArrow(0x39ff14); diag.add(arrS, arrB);
function setArrow(a, x, y, z, len) {
  len = Math.max(.05, len);
  a.userData.sh.scale.y = len; a.userData.sh.position.x = len / 2;
  a.userData.hd.position.x = len + .25; a.position.set(x, y, z);
}
const dTrailS = new Trail(26, C.orange, .9, .5), dTrailB = new Trail(26, C.green, .7, .9); diag.add(dTrailS.group, dTrailB.group);

// ------------------------------------------------------------------ posing (direction-authored arms)
const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const DOWN = new THREE.Vector3(0, -1, 0);
function kfv(track, t) {
  if (t <= track[0][0]) return track[0][1].clone();
  for (let i = 1; i < track.length; i++) if (t <= track[i][0]) {
    const [t0, v0] = track[i - 1], [t1, v1] = track[i]; const u = (t - t0) / (t1 - t0), e = u * u * (3 - 2 * u);
    return v0.clone().lerp(v1, e).normalize();
  }
  return track[track.length - 1][1].clone();
}
function aimArm(arm, u, f, r) {
  const q1 = new THREE.Quaternion().setFromUnitVectors(DOWN, u); arm.sh.quaternion.copy(q1);
  const fl = f.clone().applyQuaternion(q1.clone().invert());
  const q2 = new THREE.Quaternion().setFromUnitVectors(DOWN, fl); arm.el.quaternion.copy(q2);
  const rl = r.clone().applyQuaternion(q1.clone().multiply(q2).invert());
  arm.hand.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(DOWN, rl));
}
function legs(h, c, j, spread = .1) {
  const hip = .55 * c, kn = 1.0 * c;
  const y = .95 - (.88 - .44 * (Math.cos(hip) + Math.cos(hip - kn)));
  h.pelvis.position.y = y + j;
  for (const [L, s] of [[h.legR, -1], [h.legL, 1]]) {
    const air = clamp(j / .2);
    const hh = hip + air * (s < 0 ? .45 : -.1), kk = kn + air * (s < 0 ? .8 : .5);
    L.hip.rotation.set(-hh, 0, s * spread); L.knee.rotation.set(kk, 0, 0); L.foot.rotation.set(hh - kk + air * .5, 0, 0);
  }
}

// smash tracks (a=anim seconds, contact at 3.0)
const SM = {
  rU: [[0, V(-.3, -.8, .5)], [1.5, V(-.9, -.1, .2)], [2.4, V(-.95, .15, -.1)], [2.75, V(-.5, .8, -.05)], [3.0, V(-.16, .98, .08)], [3.35, V(-.2, -.35, .9)], [4.4, V(-.3, -.8, .4)]],
  rF: [[0, V(.05, .25, 1)], [1.5, V(-.2, .9, .1)], [2.4, V(-.1, 1, -.35)], [2.75, V(-.2, .95, .15)], [3.0, V(-.1, .99, .12)], [3.35, V(.05, -.55, .85)], [4.4, V(.1, -.5, .5)]],
  rR: [[0, V(.0, 1, .6)], [1.5, V(0, .8, -.5)], [2.4, V(0, .1, -1)], [2.75, V(0, .7, .75)], [3.0, V(0, .93, .36)], [3.35, V(.1, -.5, .85)], [4.4, V(.1, -.7, .5)]],
  lU: [[0, V(.35, -.8, .4)], [1.5, V(.6, .6, .35)], [2.5, V(.45, .88, .45)], [3.0, V(.55, .3, .6)], [3.5, V(.5, -.75, .3)]],
  twist: [[0, 0], [1.5, -.4], [2.45, -.8], [3.0, .45], [3.5, .5], [4.5, .1]],
  lean: [[0, .05], [2.45, -.28], [3.0, .1], [3.6, .3], [4.5, .1]],
  crouch: [[0, .35], [1.3, .5], [2.0, .9], [2.38, 1.0], [2.5, .3], [3.0, .1], [3.55, .15], [3.8, .85], [4.7, .35]],
  jump: [[0, 0], [2.42, 0], [2.55, .08], [3.0, .5], [3.45, .2], [3.7, 0], [9, 0]],
  headX: [[0, 0], [1.8, -.1], [2.9, -.45], [3.4, .1]],
};
function poseSmash(h, a) {
  resetPose(h);
  const u = kfv(SM.rU, a), f = kfv(SM.rF, a), r = kfv(SM.rR, a);
  aimArm(h.armR, u, f, r);
  const lu = kfv(SM.lU, a); aimArm(h.armL, lu, lu.clone().add(V(0, 0, .15)).normalize(), lu);
  h.spine.rotation.set(kf(SM.lean, a), kf(SM.twist, a), 0);
  h.pelvis.rotation.y = kf(SM.twist, a) * -.3;
  h.head.rotation.x = kf(SM.headX, a) - kf(SM.lean, a) * .6; h.head.rotation.y = -kf(SM.twist, a) * .5;
  const j = kf(SM.jump, a); legs(h, kf(SM.crouch, a), j);
  h.shadow.position.y = .012 - j; h.shadow.scale.setScalar(1 - j * .5);
}
// tennis serve (contact at 3.0)
const SV = {
  rU: [[0, V(-.2, -.9, .3)], [1.4, V(-.4, -.75, -.5)], [2.2, V(-.95, .05, -.2)], [2.75, V(-.5, .8, -.05)], [3.0, V(-.16, .98, .08)], [3.4, V(.25, -.45, .85)], [4.5, V(.2, -.9, .3)]],
  rF: [[0, V(.1, -.7, .6)], [1.4, V(-.1, -.85, -.5)], [2.2, V(-.1, 1, -.35)], [2.75, V(-.2, .95, .15)], [3.0, V(-.1, .99, .12)], [3.4, V(.1, -.5, .8)], [4.5, V(.1, -.8, .4)]],
  rR: [[0, V(.1, -.9, .45)], [1.4, V(0, -.5, -.9)], [2.2, V(0, .2, -1)], [2.75, V(0, .7, .75)], [3.0, V(0, .93, .36)], [3.4, V(.1, -.4, .9)], [4.5, V(.1, -.9, .4)]],
  lU: [[0, V(.2, -.9, .3)], [.5, V(.15, -.7, .6)], [1.1, V(.1, .95, .3)], [2.4, V(.15, .9, .35)], [3.2, V(.3, .0, .8)], [3.8, V(.25, -.8, .4)]],
  twist: [[0, 0], [1.4, -.25], [2.2, -.7], [3.0, .4], [3.6, .5], [4.5, .1]],
  lean: [[0, .0], [2.2, -.3], [3.0, .12], [3.6, .35], [4.5, .1]],
  crouch: [[0, .15], [1.2, .3], [2.0, .8], [2.35, .95], [2.5, .15], [3.0, .05], [3.5, .1], [3.8, .6], [4.7, .25]],
  jump: [[0, 0], [2.42, 0], [2.6, .06], [3.0, .28], [3.4, .12], [3.7, 0], [9, 0]],
  headX: [[0, 0], [1.1, -.35], [2.9, -.45], [3.5, .1]],
};
function poseServe(h, a) {
  resetPose(h);
  aimArm(h.armR, kfv(SV.rU, a), kfv(SV.rF, a), kfv(SV.rR, a));
  const lu = kfv(SV.lU, a); aimArm(h.armL, lu, lu, lu);
  h.spine.rotation.set(kf(SV.lean, a), kf(SV.twist, a), 0);
  h.pelvis.rotation.y = kf(SV.twist, a) * -.3;
  h.head.rotation.x = kf(SV.headX, a) - kf(SV.lean, a) * .6;
  const j = kf(SV.jump, a); legs(h, kf(SV.crouch, a), j, .12);
  h.shadow.position.y = .012 - j; h.shadow.scale.setScalar(1 - j * .5);
}
function racketHead(h) { h.root.updateMatrixWorld(true); return h.racket.localToWorld(new THREE.Vector3(0, h.racket.userData.headY, 0)); }
poseSmash(hB, 3.0); const PcB = racketHead(hB);
poseServe(hT, 3.0); const PcT = racketHead(hT);
const handAt = (h, a) => { poseServe(h, a); h.root.updateMatrixWorld(true); return h.armL.hand.getWorldPosition(new THREE.Vector3()); };
const tossHand = handAt(hT, 1.1);

// flights ------------------------------------------------
const DIR_S = new THREE.Vector3(-.88, -.47, .03).normalize();
const sAnim = (w, s0) => { // wall-clock-in-scene -> anim time with slow motion window around contact
  const A = M.slowA - s0, B = M.slowB - s0;
  if (w < A) return w; if (w < B) return A + (w - A) * .25; return A + (B - A) * .25 + (w - B);
};
function smashShuttlePos(a, out) {
  if (a < 3.0) {
    const u = clamp((a - .3) / 2.7), p0 = new THREE.Vector3(-5.8, 2.4, .3);
    out.set(lerp(p0.x, PcB.x, u), lerp(p0.y, PcB.y, u) + 5.4 * u * (1 - u), lerp(p0.z, PcB.z, u)); return out;
  }
  const tau = a - 3.0, s = 7.4 * (1 - Math.exp(-tau / .11));
  out.copy(PcB).addScaledVector(DIR_S, s); out.y = Math.max(out.y, .05); return out;
}
function orient(obj, from, to) { const d = to.clone().sub(from); if (d.lengthSq() > 1e-10) obj.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize()); }

// ------------------------------------------------------------------ HUD
const hud = document.getElementById('hud'), svg = document.getElementById('svg');
const items = [];
function mk(html, o = {}) {
  const d = document.createElement('div'); d.className = 't ' + (o.cls || ''); d.innerHTML = html;
  d.style.fontSize = (o.size || 100) + 'px'; d.style.left = (o.cx ?? 540) + 'px'; d.style.top = (o.cy ?? 900) + 'px';
  if (o.color) d.style.color = o.color; if (o.w) { d.style.width = o.w + 'px'; d.style.whiteSpace = 'normal'; d.style.textAlign = 'center'; d.style.lineHeight = '1.12'; }
  if (o.weight) d.style.fontWeight = o.weight; if (o.bg) d.style.background = o.bg; if (o.h) d.style.height = o.h + 'px';
  hud.appendChild(d); const it = { d, fn: o.fn || null, t0: o.t0 ?? -1e9, t1: o.t1 ?? 1e9 }; items.push(it); return it;
}
const stampAnim = (t, t0, pop = .55, dur = .2) => { const u = clamp((t - t0) / dur); return { s: 1 + pop * (1 - easeOut(u)), o: smooth(0, 1, (t - t0) / .06) }; };
const cnt = (t, t0, v, dec = 0, dur = .5) => (v * easeOut(clamp((t - t0) / dur))).toFixed(dec);
const fadeOut = (t, t1, d = .15) => 1 - smooth(t1 - d, t1, t);
const S = (n) => SC[n];

// captions
const capEl = mk('', { cx: 540, cy: 1600, size: 56, cls: '' }); capEl.d.id = 'cap';
const allChunks = []; for (const k in LN) for (const c of LN[k].chunks) allChunks.push(c); allChunks.sort((a, b) => a.start - b.start);
capEl.fn = (t) => {
  const c = allChunks.find(c => t >= c.start - .02 && t < c.end + .05);
  if (!c || t >= S('endcard').start) return null;
  const u = clamp((t - c.start) / .08);
  return { html: c.text.toUpperCase(), o: u * (1 - smooth(c.end - .05, c.end + .05, t)), s: 1, dy: (1 - u) * 14 };
};

// ---- COLD
const cold = S('cold');
mk('', { cx: 540, cy: 700, size: 380, fn: (t) => {
  const t0 = M.reveal565; if (t < t0 || t > cold.end) return null; const st = stampAnim(t, t0, .28, .24);
  return { html: `${cnt(t, t0, 565)}<span class="u" style="display:block;font-size:.3em;margin:.05em 0 0 0">KM/H</span>`, o: st.o * fadeOut(t, cold.end, .1), s: st.s };
} });
// ---- F1
mk('', { cx: 540, cy: 1390, size: 94, fn: (t) => {
  const t0 = M.revealF1, s = S('f1'); if (t < t0 || t > s.end) return null; const st = stampAnim(t, t0, .25, .2);
  return { html: `<span style="color:#2fd3d0">F1:</span> ${cnt(t, t0, 372.6, 1)}<span class="u">KM/H</span>`, o: st.o * fadeOut(t, s.end, .12), s: st.s };
} });
// ---- SHUTTLE
const shS = S('shuttle');
mk('', { cx: 540, cy: 360, size: 250, fn: (t) => {
  const t0 = M.g5; if (t < t0 || t > shS.end) return null; const st = stampAnim(t, t0, .3, .2);
  return { html: `~${cnt(t, t0, 5)}<span class="u" style="font-size:.4em">G</span>`, o: st.o * fadeOut(t, shS.end, .12), s: st.s };
} });
const callouts = [
  { t: M.gFeather, txt: 'FEATHER SKIRT', anchor: new THREE.Vector3(-.075, .04, 0), lx: 250, ly: 1090 },
  { t: M.gBase, txt: 'CORK BASE', anchor: new THREE.Vector3(.016, .0, 0), lx: 830, ly: 1260 },
].map(c => { const it = mk(c.txt, { cx: c.lx, cy: c.ly, size: 44, cls: 'co', fn: (t) => (t < c.t || t > shS.end) ? null : { o: smooth(0, 1, (t - c.t) / .12) * fadeOut(t, shS.end, .1), s: 1 } }); const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.setAttribute('stroke', '#2fd3d0'); ln.setAttribute('stroke-width', '4'); const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '9'); dot.setAttribute('fill', '#2fd3d0'); svg.append(ln, dot); return { ...c, it, ln, dot }; });

// ---- SMASH
const smS = S('smash');
const titleCard = mk('SMASH', { cx: 540, cy: 860, size: 330, fn: (t) => {
  const w = t - smS.start; if (w < 0 || w > .55) return null; const st = stampAnim(t, smS.start, .35, .16);
  return { o: st.o * fadeOut(t, smS.start + .55, .12), s: st.s };
} });
const meterBar = mk('', { cx: 985, cy: 780, size: 10, fn: (t) => {
  if (t < M.contact - .5 || t > S('records').start) return null;
  const v = t < M.contact ? 0 : 565 * easeOut(clamp((t - M.contact) / .9)); const hh = 760 * v / 600;
  let ticks = ''; for (const k of [0, 200, 400, 600]) ticks += `<div style="position:absolute;right:56px;bottom:${760 * k / 600 - 14}px;font-size:26px;color:#9fb6e8;font-weight:500">${k}</div><div style="position:absolute;right:38px;bottom:${760 * k / 600}px;width:16px;height:3px;background:#9fb6e8"></div>`;
  return { html: `<div style="position:relative;width:36px;height:760px;margin-left:-18px"><div style="position:absolute;inset:0;background:rgba(255,255,255,.10);border-radius:18px"></div><div style="position:absolute;left:0;bottom:0;width:36px;height:${hh}px;background:linear-gradient(0deg,#ff6a13,#ffc26b);border-radius:18px;box-shadow:0 0 28px #ff7a1f"></div>${ticks}</div>`, o: smooth(0, 1, (t - (M.contact - .5)) / .3), s: 1 };
} });
meterBar.d.style.whiteSpace = 'normal';
const meterNum = mk('', { cx: 800, cy: 310, size: 150, fn: (t) => {
  if (t < M.contact || t > S('records').start - .45) return null; const st = stampAnim(t, M.contact, .15, .15);
  return { html: `<span class="lb" style="font-size:30px;text-align:right;margin-bottom:6px">SHUTTLE SPEED</span>${cnt(t, M.contact, 565)}<span class="u">KM/H</span>`, o: st.o, s: 1 };
} });
// push-through the 565 into the records scene
const rcS = S('records');
mk('565', { cx: 540, cy: 900, size: 150, fn: (t) => {
  const t0 = rcS.start - .45, t1 = rcS.start + .55; if (t < t0 || t > t1) return null; const u = clamp((t - t0) / (t1 - t0));
  const sc = Math.exp(lerp(0, Math.log(16), easeIn(u))); const x = lerp(800, 540, easeInOut(u * 1.3)), y = lerp(310, 900, easeInOut(u * 1.3));
  return { o: 1 - smooth(.55, 1, u), s: sc, dx: x - 540, dy: y - 900 };
} });

// ---- RECORDS
mk('TEST RECORDS', { cx: 540, cy: 1240, size: 46, cls: 'tag', fn: (t) => { const t0 = rcS.start + .5; if (t < t0 || t > rcS.end) return null; return { o: smooth(0, 1, (t - t0) / .15) * fadeOut(t, rcS.end, .12), s: 1 }; } });
const recCards = [['2013', 493, 'card', 210], ['2023', 565, 'card', 540], ['WOMEN', 438, 'card w', 870]];
recCards.forEach(([lab, val, cls, cx], i) => mk('', { cx, cy: 1390, size: 82, cls, fn: (t) => {
  const e = M.rec[i]; if (t < e.slide || t > rcS.end) return null; const u = easeOut(clamp((t - e.slide) / .28));
  return { html: `<span class="lb">${lab}</span>${t < e.count ? '' : cnt(t, e.count, val)}<span class="u">${t < e.count ? '' : 'KM/H'}</span>`, o: u * fadeOut(t, rcS.end, .12), s: 1, dx: (1 - u) * 160 };
} }));

// ---- HONEST
const hoS = S('honest');
mk('', { cx: 540, cy: 560, size: 330, fn: (t) => {
  if (t < M.stamp565 || t > hoS.end) return null; const st = stampAnim(t, M.stamp565, .5, .2);
  const u = easeInOut(clamp((t - M.split) / .5));
  return { html: `565<span class="u" style="font-size:.28em;color:#fff;opacity:.9">KM/H</span>`, o: st.o * lerp(1, .55, u) * fadeOut(t, hoS.end, .12), s: st.s * lerp(1, .52, u), dy: lerp(0, -170, u) };
} });
mk('CONTROLLED TEST', { cx: 540, cy: 800, size: 78, cls: 'tag', fn: (t) => {
  if (t < M.tag || t > hoS.end) return null; const st = stampAnim(t, M.tag, .5, .18); const u = easeInOut(clamp((t - M.split) / .5));
  return { o: st.o * fadeOut(t, hoS.end, .12), s: st.s * lerp(1, .8, u), r: -3.5, dy: lerp(0, -280, u) };
} });
mk('', { cx: 540, cy: 1080, size: 280, fn: (t) => {
  if (t < M.reveal426 - .55 || t > hoS.end) return null; const t0 = M.reveal426; const st = stampAnim(t, t0, .35, .22);
  const lab = clamp((t - (M.reveal426 - .55)) / .2);
  return { html: `<span class="lb" style="font-size:.28em;opacity:${lab}">IN MATCH:</span>${t >= t0 ? cnt(t, t0, 426) : '0'}<span class="u" style="color:#ff8a2a">KM/H</span><span class="lb" style="font-size:.16em;color:#fff;letter-spacing:.14em;margin-top:.2em;margin-bottom:0;opacity:${smooth(0, 1, (t - t0 - .3) / .3)}">2017 · BADMINTON PREMIER LEAGUE</span>`, o: Math.max(lab, 0) * fadeOut(t, hoS.end, .12) * (t >= t0 ? st.o : 1), s: t >= t0 ? st.s : 1 };
} });

// ---- TENNIS
const teS = S('tennis');
const sp = (t) => easeOut(clamp((t - teS.start) / .5));
mk('', { cx: 540, cy: 960, size: 10, fn: (t) => { if (t < teS.start || t > teS.end) return null; const p = sp(t); return { html: `<div style="width:${4}px;height:1920px;background:#fff;box-shadow:0 0 24px #fff;margin-left:-2px;margin-top:-960px;opacity:${1 - p * .35}"></div>`, o: 1, s: 1 }; } });
const tennisNum = (txt, cx, color, val, dec, sub, lcls) => mk('', { cx, cy: 470, size: 120, cls: lcls, fn: (t) => {
  if (t < M.serve || t > teS.end) return null; const st = stampAnim(t, M.serve + .05, .3, .2);
  return { html: `<span class="lb" style="font-size:.34em">${txt}</span>${cnt(t, M.serve + .05, val, dec)}<span class="u" style="display:block;font-size:.28em;margin:.1em 0 0">KM/H</span><span class="lb" style="font-size:.2em;color:#fff;letter-spacing:.1em;margin:.35em 0 0">${sub}</span>`, o: st.o * fadeOut(t, teS.end, .12), s: st.s };
} });
tennisNum('TENNIS:', 270, '#39ff14', 263.4, 1, 'CHALLENGER · 2012', 'green');
tennisNum('BADMINTON:', 810, '#ff8a2a', 426, 0, 'IN MATCH', 'org');

// ---- WHY
const wyS = S('why');
mk('ILLUSTRATIVE', { cx: 540, cy: 250, size: 30, weight: 500, color: '#9fb6e8', fn: (t) => (t < wyS.start || t > wyS.end) ? null : { o: .85 * fadeOut(t, wyS.end, .12) } });
mk('SHUTTLE SLOWS FAST', { cx: 540, cy: 400, size: 104, color: '#ff8a2a', fn: (t) => { if (t < M.lbl1 || t > wyS.end) return null; const st = stampAnim(t, M.lbl1, .35, .18); return { o: st.o * fadeOut(t, wyS.end, .12), s: st.s }; } });
mk('BALL HOLDS SPEED', { cx: 540, cy: 530, size: 104, color: '#39ff14', fn: (t) => { if (t < M.lbl2 || t > wyS.end) return null; const st = stampAnim(t, M.lbl2, .35, .18); return { o: st.o * fadeOut(t, wyS.end, .12), s: st.s }; } });

// ---- CLOSE / END CARD
const clS = S('close'), enS = S('endcard');
mk('<span class="lb" style="font-size:.42em;letter-spacing:.2em">COMMENT:</span>WHICH SPORT?', { cx: 540, cy: 430, size: 128, fn: (t) => {
  if (t < M.comment || t > clS.end) return null; const st = stampAnim(t, M.comment, .35, .2); return { o: st.o * fadeOut(t, clS.end, .1), s: st.s };
} });
const endT = (t) => clamp((t - enS.start) / .5);
mk('CHANNEL NAME', { cx: 540, cy: 700, size: 130, fn: (t) => t < enS.start ? null : { o: easeOut(endT(t)), s: 1, dy: (1 - easeOut(endT(t))) * 30 } });
mk('SOURCES', { cx: 540, cy: 960, size: 64, color: '#ff8a2a', fn: (t) => t < enS.start + .2 ? null : { o: easeOut(clamp((t - enS.start - .2) / .5)), s: 1 } });
mk('Guinness World Records; Wikipedia (fastest recorded tennis serves).', { cx: 540, cy: 1090, size: 44, weight: 500, w: 880, fn: (t) => t < enS.start + .3 ? null : { o: easeOut(clamp((t - enS.start - .3) / .5)), s: 1 } });

function updateHud(t) {
  for (const it of items) {
    if (t < it.t0 || t > it.t1) { it.d.style.opacity = 0; continue; }
    const r = it.fn ? it.fn(t) : { o: 1, s: 1 };
    if (!r || r.o <= .001) { it.d.style.opacity = 0; continue; }
    if (r.html !== undefined && it.last !== r.html) { it.d.innerHTML = r.html; it.last = r.html; }
    it.d.style.opacity = Math.min(1, r.o);
    it.d.style.transform = `translate(-50%,-50%) translate(${r.dx || 0}px,${r.dy || 0}px) scale(${r.s ?? 1}) rotate(${r.r || 0}deg)`;
  }
}

// ------------------------------------------------------------------ camera helpers
const camTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40 };
const orbit = (c, r, az, y, look) => { camTarget.pos.set(c.x + Math.sin(az) * r, y, c.z + Math.cos(az) * r); camTarget.look.copy(look || c); };
const punches = EV.filter(e => e.type === 'punch').map(e => e.t), shakes = EV.filter(e => e.type === 'shake');
function punchScale(t) {
  let z = 0;
  for (const te of punches) { const dt = t - te; if (dt < 0 || dt > 1.4) continue; z = Math.max(z, dt < .23 ? .12 * easeOut(dt / .23) : .12 * (1 - easeInOut((dt - .23) / 1.1))); }
  return 1 + z;
}
function applyCam(c, t, fovBase, dist = 6, extra = 1) {
  c.position.copy(camTarget.pos);
  const sh = new THREE.Vector3(noise(t * 1.1, 1) * .0035, noise(t * 1.3, 2) * .0035, noise(t * .9, 3) * .002).multiplyScalar(dist * extra);
  let imp = 0; for (const e of shakes) { const dt = t - e.t; if (dt >= 0 && dt < .5) imp += e.amp * Math.exp(-dt * 9) * Math.sin(dt * 75); }
  sh.x += imp * dist * .35; sh.y += imp * dist * .25 * Math.cos(t * 50);
  c.position.add(sh);
  c.lookAt(camTarget.look);
  c.rotateZ(noise(t * .8, 5) * .004 + imp * .12);
  c.fov = fovBase / punchScale(t); c.updateProjectionMatrix();
}

// ------------------------------------------------------------------ scene logic
const heroBody = hero.userData.body;
let CUR = '';
function setVis(o) {
  court.visible = !!o.court; court.userData.net.visible = !!o.net; trackFx.visible = !!o.track; car.visible = !!o.car; hB.root.visible = !!o.hB; hT.root.visible = !!o.hT;
  hero.visible = !!o.hero; heroTrail.group.visible = !!o.hero; ball.visible = !!o.ball; ballTrail.group.visible = !!o.ball;
  bars.visible = !!o.bars; diag.visible = !!o.diag; plain.visible = true; heroLight.intensity = 0;
}
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
let blackOp = 0, dimOp = 0, split = null;

function sceneCold(t) {
  const s = SC.cold; setVis({ court: 1, hero: 1 });
  const snap = M.snap, drop0 = .25;
  const pathHero = (tt, out) => {
    if (tt < snap) { const u = clamp((tt - drop0) / (snap - drop0)); out.set(0, 5.4 - 4.5 * u * u, 0); }
    else if (tt < M.launch565) { out.set(0, .62 + Math.sin(tt * 1.6) * .03, 0); }
    else { const k = tt - M.launch565; out.set(26 * k * k, .62 + 1.2 * k, 0); }
    return out;
  };
  hero.scale.setScalar(13); heroBody.rotation.x = t * 2.2;
  pathHero(t, hero.position);
  if (t < snap) { hero.rotation.set(0, 0, -Math.PI / 2); }
  else if (t < M.launch565) { hero.rotation.set(0, -.5, .33); }
  else { const k = t - M.launch565; hero.rotation.set(0, -.2 * (1 - clamp(k * 3)) - .0, .33 * (1 - clamp(k * 2))); }
  hero.visible = !(hero.position.x > 22);
  heroTrail.size = 2.2; heroTrail.life = t < snap ? .22 : .5;
  heroTrail.update((tt) => pathHero(tt, new THREE.Vector3()).add(new THREE.Vector3(-.6, 0, 0).multiplyScalar(0)), t, t < snap ? .6 : (t > M.launch565 ? 1 : 0), drop0);
  heroTrail.group.children.forEach((c, i) => { const k = i / 33; c.position.x -= 0; });
  heroLight.position.set(hero.position.x, hero.position.y + .8, 2.5); heroLight.intensity = 5;
  if (t < snap) { camTarget.pos.set(0, 1.6, 6.2); camTarget.look.set(0, 3.2 - 2.3 * clamp((t - .25) / 1.5), 0); camTarget.fov = 40; }
  else { const u = (t - snap); camTarget.pos.set(-.9 + u * .05, .25 + u * .01, 5.6 - .5 * easeOut(clamp(u / 1.8))); camTarget.look.set(.05 + Math.min(u, 3) * .05, .62, 0); camTarget.fov = 42; }
  if (t > M.launch565) { camTarget.look.x = lerp(.3, 3.4, easeOut(clamp((t - M.launch565) / .5))); }
  applyCam(cam, t, camTarget.fov, 4);
}

function sceneF1(t) {
  const s = SC.f1, w = t - s.start; setVis({ track: 1, car: 1, hero: 1 });
  const speed = 9; trackFx.position.x = -((w * speed) % 2.5);
  car.position.set(0, .0, 0); car.position.y = Math.sin(w * 18) * .004;
  car.userData.wheels.forEach(wh => { wh.rotation.z = -(w * speed) / (wh.userData.r); });
  const tp = M.shuttlePass, rel = (tt) => -7.5 + (tt - (tp - .5)) * 15;
  hero.scale.setScalar(4.5); hero.rotation.set(0, 0, 0); heroBody.rotation.x = t * 14;
  const hp = (tt, out) => out.set(rel(tt), .95, .25);
  hp(t, hero.position); hero.visible = hero.position.x > -8 && hero.position.x < 9;
  heroTrail.size = 1.5; heroTrail.life = .24; heroTrail.update((tt) => hp(tt, new THREE.Vector3()), t, 1, tp - .5);
  heroTrail.group.visible = hero.visible || (t > tp && t < tp + .9);
  heroLight.position.set(hero.position.x, 1.2, 2); heroLight.intensity = hero.visible ? 2.5 : 0;
  const u = clamp(w / (s.end - s.start)); const az = lerp(-.7, .5, easeInOut(u));
  camTarget.pos.set(Math.sin(az) * 5.6, .4 + .1 * u, Math.cos(az) * 5.6); camTarget.look.set(.25, .33, 0); camTarget.fov = 40;
  applyCam(cam, t, 40, 5.6);
}

function sceneShuttle(t) {
  const s = SC.shuttle, w = t - s.start, u = clamp(w / (s.end - s.start)); setVis({ hero: 1 });
  plain.visible = true;
  hero.position.set(0, 1.5, 0); hero.scale.setScalar(15); hero.rotation.set(0, 0, .1); heroBody.rotation.x = t * .7;
  heroTrail.group.visible = false;
  heroLight.position.set(1.5, 3, 3); heroLight.intensity = 22;
  const az = lerp(-1.0, .9, easeInOut(u)), R = lerp(3.9, 3.2, u);
  camTarget.pos.set(Math.sin(az) * R, 1.8 + .35 * Math.sin(u * 3), Math.cos(az) * R); camTarget.look.set(-.3, 1.5, 0); camTarget.fov = 40;
  applyCam(cam, t, 40, 3.5);
  hero.updateMatrixWorld(true);
  callouts.forEach(c => {
    const p = heroBody.localToWorld(c.anchor.clone()).project(cam); const ax = (p.x * .5 + .5) * W, ay = (-p.y * .5 + .5) * H;
    const on = t >= c.t; const o = on ? 1 : 0;
    c.ln.setAttribute('x1', ax); c.ln.setAttribute('y1', ay); c.ln.setAttribute('x2', c.lx); c.ln.setAttribute('y2', c.ly - 28);
    c.ln.style.opacity = o * fadeOut(t, s.end, .1); c.dot.setAttribute('cx', ax); c.dot.setAttribute('cy', ay); c.dot.style.opacity = o * fadeOut(t, s.end, .1);
  });
}

function sceneSmash(t) {
  const s = SC.smash, w = t - s.start; setVis({ court: 1, net: 1, hB: 1, hero: 1 });
  const a = sAnim(w, s.start); poseSmash(hB, a);
  const p = smashShuttlePos(a, hero.position); heroBody.rotation.x = a * 20;
  const pn = smashShuttlePos(a + .01, tmp); orient(hero, p.clone(), pn);
  hero.scale.setScalar(a < 3 ? 5 : 5); hero.visible = a > .3 && a < 3.8;
  heroTrail.size = .5; heroTrail.life = .09; heroTrail.update((tt) => smashShuttlePos(tt, new THREE.Vector3()), a, 1, .3);
  heroTrail.group.visible = true;
  heroLight.position.set(hero.position.x, hero.position.y, 2); heroLight.intensity = a > 2.4 ? 9 : 4;
  // camera: low-angle orbit with a push-in on the slow-mo
  const u = clamp(w / (s.end - s.start)); const push = smooth(M.slowA - s.start - .4, M.contact - s.start, w);
  const az = lerp(-.55, .35, easeInOut(u)) * 1.0; const R = lerp(5.6, 4.0, push) + 1.8 * smooth(M.slowB - s.start, s.end - s.start, w);
  const look = new THREE.Vector3(1.9, lerp(1.45, 2.05, push), 0);
  camTarget.pos.set(PB.x - .5 + Math.sin(az) * R * .8, lerp(.8, 1.4, push), Math.cos(az) * R); camTarget.look.copy(look); camTarget.fov = 44;
  applyCam(cam, t, 44, R);
  dimOp = Math.max(0, .5 * (1 - smooth(.35, .62, w))) * (w < .6 ? 1 : 0);
}

function sceneRecords(t) {
  const s = SC.records, w = t - s.start, u = clamp(w / (s.end - s.start)); setVis({ bars: 1, court: 0 });
  bars.position.set(0, 0, 0);
  barMeshes.forEach((b, i) => {
    const e = M.rec[i], k = easeOut(clamp((t - e.slide) / .9)); const h = Math.max(.001, BAR_V[i] / 100 * k);
    b.b.scale.y = h; b.b.position.y = h / 2; b.sh.position.y = h + .55; b.gl.position.y = h + .4; b.sh.visible = k > .02; b.gl.visible = k > .02; b.b.visible = k > .01;
    b.sh.userData.body.rotation.x = t * 3; b.sh.rotation.z = Math.PI / 2 + (i === 2 ? .15 : 0);
  });
  const az = lerp(-.7, .6, easeInOut(u)); const R = lerp(16.5, 15, u);
  camTarget.pos.set(Math.sin(az) * R, lerp(3.2, 4.4, u), Math.cos(az) * R); camTarget.look.set(0, 2.9, 0); camTarget.fov = 40;
  applyCam(cam, t, 40, R);
  heroLight.position.set(0, 7, 5); heroLight.intensity = 10;
}

function sceneHonest(t) {
  const s = SC.honest, w = t - s.start, u = clamp(w / (s.end - s.start)); setVis({ court: 1, hero: 1 });
  hero.position.set(0, .45, 0); hero.scale.setScalar(9); hero.rotation.set(0, -.6 + .5 * Math.sin(w * .35), .22); heroBody.rotation.x = t * .6;
  heroTrail.group.visible = false; heroLight.position.set(1, 2, 3); heroLight.intensity = 14;
  const az = lerp(-.3, .5, u); camTarget.pos.set(Math.sin(az) * 5, .55, Math.cos(az) * 5); camTarget.look.set(0, .75, 0); camTarget.fov = 42;
  applyCam(cam, t, 42, 5);
  dimOp = .5;
  blackOp = clamp(1 - (t - s.start) / .2) * (t >= s.start ? 1 : 0);
}

function sceneTennis(t) {
  const s = SC.tennis, w = t - s.start; setVis({ court: 1, net: 1, hB: 1, hT: 1, hero: 1, ball: 1 });
  const a = clamp(w - (M.serve - s.start) + 3.0, 0, 99) * 0 + (w - (M.serve - s.start) + 3.0); // contact at anim 3.0 when t == M.serve
  const aa = Math.max(0, a);
  poseServe(hT, aa); poseSmash(hB, aa);
  // tennis ball
  const tp = (x, out) => out;
  const ballPos = (an, out) => {
    if (an < 1.1) { return out.copy(tossHand).setY(-5); }
    if (an < 3.0) { const u = (an - 1.1) / 1.9; out.set(lerp(tossHand.x, PcT.x, u), tossHand.y + (PcT.y - tossHand.y) * (1 - Math.pow(1 - u, 2)), lerp(tossHand.z, PcT.z, u)); return out; }
    const tau = an - 3.0, sdist = 28 * (1 - Math.exp(-tau / 1.4)) * 1.4; out.copy(PcT).addScaledVector(new THREE.Vector3(-.93, -.36, .03).normalize(), sdist); out.y = Math.max(out.y, .05); return out;
  };
  ballPos(aa, ball.position); ball.visible = aa >= 1.1 && aa < 3.9;
  ballTrail.size = .2; ballTrail.life = .22; ballTrail.update((tt) => ballPos(tt, new THREE.Vector3()), aa, 1, 3.0);
  ballTrail.group.visible = aa > 3.0;
  // shuttle (right half)
  const hp = smashShuttlePos(aa, hero.position); heroBody.rotation.x = aa * 20; orient(hero, hp.clone(), smashShuttlePos(aa + .01, tmp));
  hero.scale.setScalar(5); hero.visible = aa > .3 && aa < 3.5;
  heroTrail.size = .5; heroTrail.life = .09; heroTrail.update((tt) => smashShuttlePos(tt, new THREE.Vector3()), aa, 1, 3.0);
  heroTrail.group.visible = aa > 3.0;
  // half cameras
  const mkCam = (c, P, look, az, R, y) => { camTarget.pos.set(P.x + Math.sin(az) * R, y, Math.cos(az) * R); camTarget.look.copy(look); applyCam(c, t, 52, R); };
  const u = clamp(w / (s.end - s.start));
  mkCam(camL, PT, new THREE.Vector3(PT.x - .4, 1.0, 0), lerp(.15, .6, u) + 0.35, 5.4, 1.2);
  mkCam(camR, PB, new THREE.Vector3(PB.x - .4, 1.0, 0), lerp(.15, .6, u) + 0.35, 5.4, 1.2);
  split = { p: sp(t) };
  heroLight.position.set(hero.position.x, hero.position.y, 2); heroLight.intensity = 1.5;
}

function sceneWhy(t) {
  const s = SC.why, w = t - s.start; setVis({ diag: 1, ball: 0 });
  const tl = Math.max(0, t - M.launch);
  const vS = 8.5, kS = .95, vB = 4.6, kB = .1;
  const xS = vS * (1 - Math.exp(-kS * tl)) / kS, xB = vB * (1 - Math.exp(-kB * tl)) / kB;
  const spS = vS * Math.exp(-kS * tl), spB = vB * Math.exp(-kB * tl);
  const fall = Math.max(0, tl - 3.2);
  dShuttle.position.set(xS, 1.2 - Math.min(1.1, .4 * fall * fall), ZS); dShuttle.rotation.set(0, 0, -Math.min(1.2, fall * .6)); dShuttle.userData.body.rotation.x = t * 8;
  dBall.position.set(xB, 1.2, ZB); dBall.rotation.z = -xB * 2;
  dShuttle.userData.glow.material.opacity = .85 * clamp(spS / 3 + .15);
  setArrow(arrS, xS - .3, 2.5, ZS, spS * .42); setArrow(arrB, xB - .3, 2.5, ZB, spB * .42);
  const vis = t >= M.launch; arrS.visible = arrB.visible = dShuttle.visible = dBall.visible = true;
  dTrailS.size = 1; dTrailS.life = .6; dTrailB.size = .9; dTrailB.life = 1.2;
  dTrailS.update((tt) => new THREE.Vector3(vS * (1 - Math.exp(-kS * Math.max(0, tt - M.launch))) / kS, 1.2, ZS), t, 1, M.launch);
  dTrailB.update((tt) => new THREE.Vector3(vB * (1 - Math.exp(-kB * Math.max(0, tt - M.launch))) / kB, 1.2, ZB), t, 1, M.launch);
  heroTrail.group.visible = false; ballTrail.group.visible = false; hero.visible = false;
  const cx = Math.max(3.2, (xS + xB) / 2 + 1.2);
  camTarget.pos.set(cx - 1.5, 4.6, 15); camTarget.look.set(cx, 1.3, 0); camTarget.fov = 42;
  applyCam(cam, t, 42, 15, .5);
  heroLight.position.set(cx, 8, 6); heroLight.intensity = 40;
}

function sceneClose(t) {
  const s = SC.close, w = t - s.start, u = clamp(w / (s.end - s.start)); setVis({ court: 1, net: 1, hB: 1 });
  const a = 3.04 + Math.sin(w * 2.0) * .006; poseSmash(hB, a);
  hB.pelvis.position.y = .95 - .02 + .02; // grounded hold
  hero.visible = false; heroTrail.group.visible = false;
  const R = lerp(5.0, 15, easeInOut(u)); const az = lerp(.5, -.25, u);
  camTarget.pos.set(PB.x + Math.sin(az) * R * .9, lerp(1.1, 3.8, easeInOut(u)), Math.cos(az) * R); camTarget.look.set(PB.x - 1.0, lerp(1.8, 1.2, u), 0); camTarget.fov = 42;
  applyCam(cam, t, 42, R);
  blackOp = smooth(s.end - .35, s.end, t);
}

function sceneEnd(t) {
  const s = SC.endcard, w = t - s.start; setVis({ court: 1, hero: 1 });
  const d0 = M.lastDrop, dur = .62; const u = clamp((t - d0) / dur);
  hero.scale.setScalar(9); hero.rotation.set(0, 0, -Math.PI / 2 + (u >= 1 ? .5 : 0)); heroBody.rotation.x = t * 3;
  const y = u < 1 ? lerp(5.5, .28, u * u) : .28 + Math.abs(Math.sin((t - d0 - dur) * 7)) * .22 * Math.exp(-(t - d0 - dur) * 3);
  hero.position.set(0, y, 0); hero.visible = t > d0 - .05;
  heroTrail.size = 1.4; heroTrail.life = .15; heroTrail.update((tt) => new THREE.Vector3(0, lerp(5.5, .28, clamp((tt - d0) / dur) ** 2), 0), t, u < 1 ? 1 : 0, d0);
  heroLight.position.set(0, 1.5, 2); heroLight.intensity = 2;
  camTarget.pos.set(0, 2.4, 9.5 - .6 * (w / 3)); camTarget.look.set(0, 1.0, 0); camTarget.fov = 42;
  applyCam(cam, t, 42, 9);
  dimOp = .62; blackOp = 1 - smooth(0, .35, w);
}

const ORDER = [['cold', sceneCold], ['f1', sceneF1], ['shuttle', sceneShuttle], ['smash', sceneSmash], ['records', sceneRecords], ['honest', sceneHonest], ['tennis', sceneTennis], ['why', sceneWhy], ['close', sceneClose], ['endcard', sceneEnd]];
const blk = document.getElementById('blk'), dim = document.getElementById('dim');

window.renderFrame = (f) => {
  const t = f / TL.fps;
  blackOp = 0; dimOp = 0; split = null;
  // lights default
  key.intensity = 1.8; rim.intensity = 2.6;
  let pick = ORDER[ORDER.length - 1];
  for (const o of ORDER) { const sc = SC[o[0]]; if (t >= sc.start && t < sc.end) { pick = o; break; } }
  pick[1](t);
  if (t < .3) blackOp = Math.max(blackOp, 1 - smooth(0, .3, t));
  // black snap into the honesty beat starts just before the scene (0.2s)
  updateHud(t);
  blk.style.opacity = blackOp; dim.style.opacity = dimOp;
  svg.querySelectorAll('line,circle').forEach(n => { if (pick[0] !== 'shuttle') n.style.opacity = 0; });
  renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
  if (split) {
    const p = split.p; renderer.setScissorTest(true); renderer.clear();
    camL.aspect = camR.aspect = (W / 2) / H; camL.updateProjectionMatrix(); camR.updateProjectionMatrix();
    renderer.setViewport(0, 0, W / 2, H); renderer.setScissor(W / 2 * (1 - p), 0, W / 2 * p, H); renderer.render(scene, camL);
    renderer.setViewport(W / 2, 0, W / 2, H); renderer.setScissor(W / 2, 0, W / 2 * p, H); renderer.render(scene, camR);
    renderer.setScissorTest(false);
  } else {
    cam.aspect = W / H; renderer.render(scene, cam);
  }
  return pick[0];
};
window.ready = true;
