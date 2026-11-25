// Shared 3D building blocks and animation helpers (three.js, procedural, no external assets)
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const easeInOut = (t) => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeBack = (t) => { t = clamp(t); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const noise = (x, s = 1) => (Math.sin(x * 1.7 + s * 12.9) * .5 + Math.sin(x * 2.9 + s * 4.1) * .3 + Math.sin(x * 5.3 + s * 7.7) * .2);

// keyframe tracks: [[t, v], ...] smooth (cosine) interpolation
export function kf(track, t) {
  if (t <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    if (t <= track[i][0]) {
      const [t0, v0] = track[i - 1], [t1, v1] = track[i];
      const u = (t - t0) / (t1 - t0);
      const e = u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * e;
    }
  }
  return track[track.length - 1][1];
}

export const C = {
  navy: 0x0a1230, charcoal: 0x161b2b, orange: 0xff6a13, hot: 0xff8a2a, green: 0x39ff14,
  teal: 0x2fd3d0, white: 0xffffff, skin: 0x9c7352, kitNavy: 0x16275c,
};

function radialTex(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,.35)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(.35, mid); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const glowTex = radialTex();
const shadowTex = radialTex('rgba(0,0,0,.8)', 'rgba(0,0,0,.35)');

export function glowSprite(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity });
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
}
export function blobShadow(r) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: .8 }));
  m.rotation.x = -Math.PI / 2; m.position.y = .012; return m;
}

const std = (color, rough = .55, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

// ---------- Shuttlecock: cork forward (+X), skirt trailing (-X). Real size ~0.088 m long ----------
export function makeShuttle(scale = 1) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const cork = new THREE.Mesh(new THREE.SphereGeometry(.0128, 24, 16), std(0xf3c892, .5, 0, { emissive: 0x7a3a10, emissiveIntensity: .5 }));
  cork.scale.set(.95, 1, 1); body.add(cork);
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0xfff1de, roughness: .6, side: THREE.DoubleSide, transparent: true, opacity: .93, emissive: 0xff6a13, emissiveIntensity: .38 });
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.0135, .034, .07, 32, 1, true), skirtMat);
  skirt.rotation.z = -Math.PI / 2; skirt.position.x = -.034; body.add(skirt);
  // ribs + rings (feather shafts and thread bands)
  const pts = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    pts.push(new THREE.Vector3(-.0005, Math.cos(a) * .0138, Math.sin(a) * .0138), new THREE.Vector3(-.0705, Math.cos(a) * .0345, Math.sin(a) * .0345));
  }
  const ribs = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff7a1f }));
  body.add(ribs);
  for (const x of [-.032, -.066]) {
    const r = .0138 + (-x / .0705) * .0207;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .0007, 6, 40), new THREE.MeshBasicMaterial({ color: 0xff7a1f }));
    ring.rotation.y = Math.PI / 2; ring.position.x = x; body.add(ring);
  }
  body.scale.setScalar(scale);
  g.userData.body = body;
  const glow = glowSprite(C.hot, .075 * scale, .55); glow.position.x = -.03 * scale; g.add(glow);
  g.userData.glow = glow;
  return g;
}

// ---------- Streak trail made from additive glow sprites along a path function ----------
export class Trail {
  constructor(n, color, size, life) {
    this.group = new THREE.Group(); this.n = n; this.life = life; this.size = size; this.sprites = [];
    for (let i = 0; i < n; i++) { const s = glowSprite(color, size, 1); this.group.add(s); this.sprites.push(s); }
  }
  // posAt(t) -> Vector3 ; draws trail behind current time t
  update(posAt, t, headFade = 1, minT = -1e9) {
    for (let i = 0; i < this.n; i++) {
      const k = i / (this.n - 1);
      const tt = t - k * this.life;
      const s = this.sprites[i];
      if (tt < minT) { s.visible = false; continue; }
      s.visible = true;
      s.position.copy(posAt(tt));
      const f = 1 - k;
      s.scale.setScalar(this.size * (.25 + .75 * f));
      s.material.opacity = Math.pow(f, 1.6) * .9 * headFade;
    }
  }
}

// ---------- Rackets ----------
function stringTex(w, h, lines) {
  const c = document.createElement('canvas'); c.width = 128; c.height = Math.round(128 * h / w);
  const g = c.getContext('2d'); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.2;
  for (let i = 0; i <= lines; i++) { const x = i / lines * c.width; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); const y = i / lines * c.height; g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function makeRacket(kind) {
  const g = new THREE.Group();
  const tennis = kind === 'tennis';
  const frameC = tennis ? C.green : 0x23283a;
  const accent = tennis ? 0xeaffd9 : C.orange;
  const hl = tennis ? .30 : .20, sl = tennis ? .10 : .16;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.016, .018, hl, 12), std(tennis ? 0x1d2a1a : 0x20263a, .8));
  handle.position.y = hl / 2; g.add(handle);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.007, .009, sl + .02, 8), std(frameC, .35, .3));
  shaft.position.y = hl + sl / 2; g.add(shaft);
  const rw = tennis ? .13 : .095, rh = tennis ? .17 : .125;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, tennis ? .05 : .045, 8, 40), std(frameC, .3, .35, { emissive: tennis ? 0x1f8a0c : 0x000000, emissiveIntensity: .9 }));
  ring.scale.set(rw, rh, rw); ring.rotation.y = 0; ring.position.y = hl + sl + rh * .95; g.add(ring);
  const st = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ map: stringTex(rw * 2, rh * 2, tennis ? 12 : 16), transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false }));
  st.scale.set(rw * .96, rh * .96, 1); st.position.y = ring.position.y; st.rotation.y = Math.PI / 2 * 0; g.add(st);
  const trim = new THREE.Mesh(new THREE.SphereGeometry(.02, 10, 8), std(accent, .4, 0, { emissive: accent, emissiveIntensity: .6 }));
  trim.position.y = hl + sl * .9; g.add(trim);
  g.userData.headY = ring.position.y; g.userData.headR = rh;
  return g;
}

// ---------- Stylised athlete (no face, no logos). Faces +Z in local space. ----------
export function makeHuman({ shirt = C.kitNavy, shorts = 0x101a3f, skin = C.skin, hair = 0x1a1410, shoe = 0xe9edf5, racket = 'badminton' } = {}) {
  const root = new THREE.Group();
  const H = { root };
  const cap = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
  const mShirt = std(shirt, .55), mShorts = std(shorts, .6), mSkin = std(skin, .6), mShoe = std(shoe, .5);

  H.pelvis = new THREE.Group(); H.pelvis.position.y = .95; root.add(H.pelvis);
  const hips = cap(.1, .14, mShorts); hips.rotation.z = Math.PI / 2; hips.scale.set(1, 1, 1.15); H.pelvis.add(hips);

  H.spine = new THREE.Group(); H.spine.position.y = .06; H.pelvis.add(H.spine);
  const chest = cap(.15, .26, mShirt); chest.scale.set(1.12, 1, .74); chest.position.y = .27; H.spine.add(chest);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.044, .05, .1, 12), mSkin); neck.position.y = .56; H.spine.add(neck);
  H.head = new THREE.Group(); H.head.position.y = .66; H.spine.add(H.head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.105, 24, 18), mSkin); skull.scale.set(.93, 1.1, 1); H.head.add(skull);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(.109, 24, 14, 0, Math.PI * 2, 0, 1.45), std(hair, .8)); hairM.scale.set(.95, 1.12, 1.03); hairM.rotation.x = -.18; hairM.position.y = .005; H.head.add(hairM);

  const arm = (side) => {
    const a = {};
    a.sh = new THREE.Group(); a.sh.position.set(side * .205, .47, 0); H.spine.add(a.sh);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.062, .058, .15, 12), mShirt); sleeve.position.y = -.07; a.sh.add(sleeve);
    const up = cap(.045, .2, mSkin); up.position.y = -.18; a.sh.add(up);
    a.el = new THREE.Group(); a.el.position.y = -.32; a.sh.add(a.el);
    const fo = cap(.037, .2, mSkin); fo.position.y = -.13; a.el.add(fo);
    a.hand = new THREE.Group(); a.hand.position.y = -.27; a.el.add(a.hand);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(.04, 12, 10), mSkin); a.hand.add(hd);
    return a;
  };
  H.armR = arm(-1); H.armL = arm(1);

  const leg = (side) => {
    const l = {};
    l.hip = new THREE.Group(); l.hip.position.set(side * .09, -.02, 0); H.pelvis.add(l.hip);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(.088, .078, .2, 14), mShorts); sh.position.y = -.1; l.hip.add(sh);
    const th = cap(.07, .26, mSkin); th.position.y = -.24; l.hip.add(th);
    l.knee = new THREE.Group(); l.knee.position.y = -.44; l.hip.add(l.knee);
    const sn = cap(.052, .28, mSkin); sn.position.y = -.21; l.knee.add(sn);
    l.foot = new THREE.Group(); l.foot.position.y = -.44; l.knee.add(l.foot);
    const shoeM = new THREE.Mesh(new THREE.BoxGeometry(.095, .075, .27), mShoe); shoeM.position.set(0, -.015, .06); l.foot.add(shoeM);
    return l;
  };
  H.legR = leg(-1); H.legL = leg(1);

  H.racket = makeRacket(racket);
  H.racket.rotation.x = Math.PI;          // extend along forearm (-Y of hand)
  H.armR.hand.add(H.racket);
  H.shadow = blobShadow(.55); root.add(H.shadow);
  return H;
}

// ---------- Tennis ball ----------
export function makeBall() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.033, 20, 14), std(0xd6ff2a, .6, 0, { emissive: 0x9bd400, emissiveIntensity: .6 }));
  m.add(glowSprite(C.green, .3, .5)); return m;
}

// ---------- Stylised F1 car (unbranded). Faces +X. ----------
export function makeCar() {
  const g = new THREE.Group();
  const body = std(0x7d8bb0, .3, .45, { emissive: 0x2a3556, emissiveIntensity: 1 }), dark = std(0x0b0d16, .5, .3), accent = std(C.teal, .3, .2, { emissive: C.teal, emissiveIntensity: .8 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  add(new THREE.BoxGeometry(2.9, .38, .75), body, 0, .42, 0);                          // tub
  add(new THREE.CylinderGeometry(.06, .3, 2.0, 16), body, 2.1, .38, 0, 0, 0, -Math.PI / 2); // nose
  add(new THREE.BoxGeometry(.9, .32, .9), body, .2, .62, 0);                            // engine cover
  add(new THREE.BoxGeometry(1.3, .3, .5), body, -.2, .62, 0, 0, 0, 0).scale.set(1, 1, 1);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(1.5, .3, .42), body, .1, .36, s * .62);                   // sidepods
    add(new THREE.BoxGeometry(1.5, .035, .06), accent, .1, .53, s * .62);
  }
  add(new THREE.BoxGeometry(.5, .05, 1.9), dark, 2.9, .12, 0);                          // front wing
  add(new THREE.BoxGeometry(.5, .03, 1.8), accent, 2.78, .18, 0);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(.5, .28, .05), dark, 2.9, .22, s * .95);
  add(new THREE.BoxGeometry(.5, .06, 1.1), dark, -1.9, 1.0, 0);                         // rear wing
  add(new THREE.BoxGeometry(.4, .05, 1.0), accent, -1.95, 1.18, 0);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(.6, .6, .04), dark, -1.9, .85, s * .55);
  add(new THREE.BoxGeometry(.12, .5, .12), dark, -1.9, .6, 0);
  add(new THREE.TorusGeometry(.28, .025, 8, 20, Math.PI), dark, .95, .85, 0, 0, Math.PI / 2, 0);     // halo
  add(new THREE.SphereGeometry(.15, 14, 10), std(C.orange, .3), .9, .75, 0);                           // helmet
  const wheel = (x, z, r, w) => {
    const grp = new THREE.Group(); grp.position.set(x, r, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 28), std(0x0a0a0c, .85)); tire.rotation.x = Math.PI / 2; grp.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * .55, r * .55, w + .01, 20), accent); rim.rotation.x = Math.PI / 2; grp.add(rim);
    g.add(grp); return grp;
  };
  g.userData.wheels = [wheel(1.7, .9, .33, .36), wheel(1.7, -.9, .33, .36), wheel(-1.3, .95, .37, .5), wheel(-1.3, -.95, .37, .5)];
  g.userData.wheels.forEach(w => { w.userData.r = w.position.y; });
  return g;
}

// ---------- Court floor (13.4 x 6.1 playing area on a larger dark floor) ----------
export function makeCourt() {
  const g = new THREE.Group();
  const cw = 2200, ch = 1100; // px for 20 x 10 m floor
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 0, ch); grad.addColorStop(0, '#0c1432'); grad.addColorStop(1, '#10193a');
  x.fillStyle = grad; x.fillRect(0, 0, cw, ch);
  const sx = cw / 20, sy = ch / 10; const cx = cw / 2, cy = ch / 2;
  x.strokeStyle = 'rgba(210,225,255,.55)'; x.lineWidth = 5;
  const R = (x0, z0, x1, z1) => { x.strokeRect(cx + x0 * sx, cy + z0 * sy, (x1 - x0) * sx, (z1 - z0) * sy); };
  R(-6.7, -3.05, 6.7, 3.05); R(-6.7, -2.59, 6.7, 2.59);
  const L = (x0, z0, x1, z1) => { x.beginPath(); x.moveTo(cx + x0 * sx, cy + z0 * sy); x.lineTo(cx + x1 * sx, cy + z1 * sy); x.stroke(); };
  L(-1.98, -3.05, -1.98, 3.05); L(1.98, -3.05, 1.98, 3.05); L(-6.7, 0, -1.98, 0); L(1.98, 0, 6.7, 0); L(-5.94, -3.05, -5.94, 3.05); L(5.94, -3.05, 5.94, 3.05);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), new THREE.MeshStandardMaterial({ map: tex, roughness: .32, metalness: .35 }));
  floor.rotation.x = -Math.PI / 2; g.add(floor);
  // dark apron beyond the floor so fog hides the edge
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x080c1e, roughness: .6, metalness: .2 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -.01; g.add(apron);
  // net
  const net = new THREE.Group(); g.add(net);
  const nt = document.createElement('canvas'); nt.width = 256; nt.height = 64; const nx = nt.getContext('2d');
  nx.strokeStyle = 'rgba(235,240,255,.7)'; nx.lineWidth = 1.2; for (let i = 0; i <= 64; i++) { nx.beginPath(); nx.moveTo(i * 4, 0); nx.lineTo(i * 4, 64); nx.stroke(); } for (let j = 0; j <= 16; j++) { nx.beginPath(); nx.moveTo(0, j * 4); nx.lineTo(256, j * 4); nx.stroke(); }
  const ntex = new THREE.CanvasTexture(nt);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6.1, .76), new THREE.MeshBasicMaterial({ map: ntex, transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false }));
  mesh.rotation.y = Math.PI / 2; mesh.position.y = 1.17; net.add(mesh);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(.03, .04, 6.1), std(0xffffff, .5)); tape.position.y = 1.55; net.add(tape);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.55, 10), std(0x20263a, .4, .6)); p.position.set(0, .775, s * 3.1); net.add(p); }
  g.userData.net = net;
  // overhead light bars for depth
  const bars = new THREE.Group(); g.add(bars);
  for (let i = -3; i <= 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.18, .1, 14), new THREE.MeshBasicMaterial({ color: 0xbfe9ff }));
    b.position.set(i * 3.4, 9.5, 0); bars.add(b);
  }
  g.userData.bars = bars;
  return g;
}

// ---------- Procedural poses ----------
export function resetPose(h) {
  for (const o of [h.pelvis, h.spine, h.head, h.armR.sh, h.armR.el, h.armR.hand, h.armL.sh, h.armL.el, h.armL.hand, h.legR.hip, h.legR.knee, h.legR.foot, h.legL.hip, h.legL.knee, h.legL.foot]) o.rotation.set(0, 0, 0);
}
