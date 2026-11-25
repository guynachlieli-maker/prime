import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, noise, kf, makeCourt, glowSprite, Trail } from '/build/lib.js';
import { loadXbot, makeAthlete, poseAthlete, racketHeadWorld, makeShuttleHQ, highlightFeathers, makeBallHQ } from '/v2/lib2.js';
import { smashSpec, readySpec } from '/v2/poses.js';

const W = 1080, H = 1920;
const TL = await (await fetch('/v2/build/timeline.json')).json();
const SC = TL.scenes, LN = TL.lines, M = TL.marks, EV = TL.events, CUTS = TL.cuts;
await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('700 60px Oswald'), document.fonts.load('500 40px Oswald')]);
const WORLD = await (await fetch('/node_modules/world-atlas/countries-110m.json')).json();
await loadXbot();

// ============================================================ renderer, environment, lights, post
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .88;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050914); scene.fog = new THREE.FogExp2(0x050914, .02);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .32;
scene.add(new THREE.HemisphereLight(0x6fb8d8, 0x0a0f24, .5));
const key = new THREE.DirectionalLight(0xffd2a8, 2.1); key.position.set(5, 9, 6); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -7; key.shadow.camera.far = 30; key.shadow.bias = -.0004; key.shadow.normalBias = .02;
scene.add(key); scene.add(key.target);
const rim = new THREE.DirectionalLight(0x38d6e6, 3.2); rim.position.set(-6, 5, -7); scene.add(rim);
const fillL = new THREE.DirectionalLight(0x6a7dff, .5); fillL.position.set(-5, 2, 6); scene.add(fillL);
const heroLight = new THREE.PointLight(0xff7a22, 0, 14, 1.5); scene.add(heroLight);

const cam = new THREE.PerspectiveCamera(40, W / H, .03, 400);
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, cam));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .5, .55, .93); composer.addPass(bloom);
const FX = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uWhip: { value: new THREE.Vector2() }, uZoom: { value: 0 }, uCA: { value: 0 }, uFlash: { value: 0 }, uGlitch: { value: 0 }, uTime: { value: 0 }, uVig: { value: .5 }, uGrain: { value: .035 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uWhip; uniform float uZoom,uCA,uFlash,uGlitch,uTime,uVig,uGrain; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main(){
    vec2 uv=vUv; vec2 c=uv-.5;
    if(uGlitch>0.001){ float band=floor(uv.y*34.+floor(uTime*30.)); float r=hash(vec2(band,floor(uTime*30.))); uv.x+=(r-.5)*.10*uGlitch*step(.5,r); }
    vec2 dir=uWhip - c*uZoom; vec3 col=vec3(0.);
    float ca=uCA*(.6+length(c)*2.2)*.012;
    for(int i=0;i<12;i++){ float f=float(i)/11.-.5; vec2 o=dir*f;
      col+=vec3(texture2D(tDiffuse,uv+o+c*ca).r,texture2D(tDiffuse,uv+o).g,texture2D(tDiffuse,uv+o-c*ca).b); }
    col/=12.;
    float l=dot(col,vec3(.2126,.7152,.0722));
    // teal shadows / warm highlights grade + contrast
    col=mix(col*vec3(.86,1.0,1.1), col*vec3(1.08,1.0,.9), smoothstep(.05,.9,l));
    col=(col-.18)*1.08+.18;
    col*=1.-uVig*pow(length(c)*1.45,2.2);
    col+= (hash(uv*vec2(1080.,1920.)+uTime)-.5)*uGrain;
    col=mix(col,vec3(1.),clamp(uFlash,0.,1.));
    gl_FragColor=vec4(max(col,0.),1.);
  }`
});
composer.addPass(FX); composer.addPass(new OutputPass());

// ============================================================ world
const court = makeCourt(); scene.add(court);
court.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
const plain = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x0b1230, roughness: .3, metalness: .5 }));
plain.rotation.x = -Math.PI / 2; plain.position.set(100, -.02, 0); plain.receiveShadow = true; scene.add(plain);

const PB = new THREE.Vector3(2.4, 0, 0), PO = new THREE.Vector3(-3.6, 0, 0);
const A = makeAthlete({ surface: 0x1a2d6a, joints: 0x6f7b96 }); A.root.position.copy(PB); A.root.rotation.y = -Math.PI / 2; A.baseY = 0; scene.add(A.root, A.racket);
const O = makeAthlete({ surface: 0xaab3c8, joints: 0x39ff14, racket: true }); O.root.position.copy(PO); O.root.rotation.y = Math.PI / 2; scene.add(O.root, O.racket);
A.racket.traverse(o => { if (o.isMesh) o.castShadow = true; });
const jm = A.model; // silence lints
const hero = makeShuttleHQ(); scene.add(hero);
const heroTrail = new Trail(36, 0xff6a13, 1, .3); scene.add(heroTrail.group);
const ring = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 64), new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); scene.add(ring);
const flashSprite = glowSprite(0xffb060, 1, 1); scene.add(flashSprite);

// speed-streak field (rank / history backdrop)
const NS = 160, streakMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.02, .02, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), NS); scene.add(streakMesh);
const sData = []; { const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < NS; i++) { const a = rnd() * Math.PI * 2, r = 1.2 + Math.pow(rnd(), .6) * 7; sData.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 1.4, z0: rnd() * 60, sp: 20 + rnd() * 30, len: 1.5 + rnd() * 5, c: rnd() }); } }
const cOr = new THREE.Color(0xff7a22), cTl = new THREE.Color(0x35d9e6);

// diagram objects (why)
const diag = new THREE.Group(); scene.add(diag);
const dShuttle = makeShuttleHQ(), dBall = makeBallHQ(); dShuttle.scale.setScalar(5.5); dBall.scale.setScalar(7.5); diag.add(dShuttle, dBall);
const ZS = -1.7, ZB = 1.7;
for (const [z, col] of [[ZS, 0xff6a13], [ZB, 0x39ff14]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(60, .03, 2.4), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .16 })); l.position.set(24, .02, z); diag.add(l); }
function textSprite(txt, color = '#cfe3ff') { const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d'); g.font = '700 64px Oswald'; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, 50); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(2, .75, 1); return s; }
for (let m = 0; m <= 24; m += 2) { const tk = new THREE.Mesh(new THREE.BoxGeometry(.06, .04, 5.6), new THREE.MeshBasicMaterial({ color: 0xbfd6ff, transparent: true, opacity: .5 })); tk.position.set(m, .03, 0); diag.add(tk); const s = textSprite(m + ' M'); s.position.set(m, .1, 3.6); s.center.set(.5, 0); diag.add(s); }
function makeArrow(color) { const g = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color }); const sh = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 1, 12), m); sh.rotation.z = -Math.PI / 2; const hd = new THREE.Mesh(new THREE.ConeGeometry(.26, .55, 16), m); hd.rotation.z = -Math.PI / 2; g.add(sh, hd); g.userData = { sh, hd }; return g; }
const arrS = makeArrow(0xff7a1f), arrB = makeArrow(0x39ff14); diag.add(arrS, arrB);
const setArrow = (a, x, y, z, len) => { len = Math.max(.05, len); a.userData.sh.scale.y = len; a.userData.sh.position.x = len / 2; a.userData.hd.position.x = len + .27; a.position.set(x, y, z); };
const dTrailS = new Trail(26, 0xff6a13, 1, .5), dTrailB = new Trail(26, 0x39ff14, .8, .9); diag.add(dTrailS.group, dTrailB.group);

// ============================================================ flights
poseAthlete(A, smashSpec(3.0)); const PcB = racketHeadWorld(A).clone();
const DIR_S = new THREE.Vector3(-.88, -.47, .03).normalize();
function shuttleAt(a, out) {
  if (a < 3.0) { const u = clamp((a - .3) / 2.7), p0 = new THREE.Vector3(-5.8, 2.4, .3); return out.set(lerp(p0.x, PcB.x, u), lerp(p0.y, PcB.y, u) + 5.4 * u * (1 - u), lerp(p0.z, PcB.z, u)); }
  const tau = a - 3.0, s = 7.4 * (1 - Math.exp(-tau / .11)); out.copy(PcB).addScaledVector(DIR_S, s); out.y = Math.max(out.y, .05); return out;
}
const orient = (obj, from, to) => { const d = to.clone().sub(from); if (d.lengthSq() > 1e-10) obj.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize()); };

// ============================================================ HUD
const hud = document.getElementById('hud'), svg = document.getElementById('svg'), fxc = document.getElementById('fxc'), fxg = fxc.getContext('2d');
const items = [];
function mk(html, o = {}) {
  const d = document.createElement('div'); d.className = 't ' + (o.cls || ''); d.innerHTML = html;
  d.style.fontSize = (o.size || 100) + 'px'; d.style.left = (o.cx ?? 540) + 'px'; d.style.top = (o.cy ?? 900) + 'px';
  if (o.w) { d.style.width = o.w + 'px'; d.style.whiteSpace = 'normal'; d.style.textAlign = 'center'; d.style.lineHeight = '1.1'; }
  hud.appendChild(d); const it = { d, fn: o.fn || null }; items.push(it); return it;
}
const fo = (t, t1, d = .12) => 1 - smooth(t1 - d, t1, t);
const slam = (t, t0, pop = 1.3, dur = .22) => { const u = clamp((t - t0) / dur); const o = 1 + 1 * (1 - easeOut(u)); return { s: 1 + pop * (1 - easeOut(u)) * (1 - u * .0), o: smooth(0, 1, (t - t0) / .05), sh: (1 - u) * (1 - u) }; };
const cnt = (t, t0, v, dec = 0, dur = .45) => (v * easeOut(clamp((t - t0) / dur))).toFixed(dec);
const shakeXY = (t, t0, amp = 14, d = .35) => { const u = clamp((t - t0) / d); const k = (1 - u) * (1 - u) * amp; return [Math.sin(t * 90) * k, Math.cos(t * 77) * k]; };
function words(txt, t, t0, stg = .08, cls = {}) { // kinetic word-by-word reveal (overshoot)
  return txt.split(' ').map((w, i) => { const u = clamp((t - t0 - i * stg) / .22); const s = u <= 0 ? 0 : 1 + .45 * (1 - easeOut(u)) * (1 - u); const o = smooth(0, 1, u * 3); return `<span class="${cls[w] || ''}" style="display:inline-block;margin:0 .12em;opacity:${o};transform:translateY(${(1 - easeOut(u)) * 40}px) scale(${u <= 0 ? .01 : s})">${w}</span>`; }).join('');
}
const S = (n) => SC[n];

// ---- captions (word-highlight)
const capGroups = []; for (const k in LN) { if (k === 'k1') continue; const ws = LN[k].words; for (let i = 0; i < ws.length; i += 4) { const g = ws.slice(i, i + 4); capGroups.push({ start: g[0].start, end: g[g.length - 1].end, words: g }); } }
const capEl = mk('', { cx: 540, cy: 1585, size: 66 }); capEl.d.id = 'cap';
capEl.fn = (t) => {
  if (t >= S('endcard').start) return null;
  const g = capGroups.find(g => t >= g.start - .03 && t < g.end + .06); if (!g) return null;
  const u = clamp((t - g.start) / .1);
  const html = g.words.map(w => { const on = t >= w.start && t < w.end; return `<span class="${on ? 'on' : ''}" style="transform:scale(${on ? 1.13 : 1})">${w.w.toUpperCase()}</span>`; }).join('');
  return { html, o: u * (1 - smooth(g.end, g.end + .06, t)), s: 1, dy: (1 - u) * 18 };
};

// ---- HOOK
const hk = S('hook');
mk('', { cx: 540, cy: 640, size: 430, cls: 'disp', fn: (t) => {
  const t0 = M.reveal565; if (t < t0 || t > hk.end) return null; const st = slam(t, t0, 1.2, .2); const [sx, sy] = shakeXY(t, t0, 20);
  return { html: `${cnt(t, t0, 565)}<span class="u" style="display:block;font-size:.3em;margin:.06em 0 0">KM/H</span>`, o: st.o * fo(t, hk.end, .1), s: st.s, dx: sx, dy: sy };
} });
mk('', { cx: 540, cy: 1030, size: 92, cls: 'disp', w: 960, fn: (t) => {
  const t0 = LN.k2.start - .1; if (t < t0 || t > hk.end) return null;
  return { html: words('THE FASTEST HIT EVER RECORDED', t, t0, .09, { FASTEST: 'or', RECORDED: 'tl' }), o: fo(t, hk.end, .1), s: 1 };
} });

// ---- CAVEAT
const cv = S('caveat');
mk('<div class="tape"><span class="in disp" style="font-size:112px">LAB TEST</span></div>', { cx: 540, cy: 560, size: 100, fn: (t) => {
  const t0 = M.stamp; if (t < t0 || t > M.reveal426 - .1) return null; const st = slam(t, t0, .9, .18); const [sx, sy] = shakeXY(t, t0, 16);
  const hiW = 1180; return { o: st.o * fo(t, M.reveal426 - .1, .12), s: st.s, r: -5, dx: sx, dy: sy };
} });
mk('NOT A MATCH', { cx: 540, cy: 740, size: 78, cls: 'osw or', fn: (t) => { const t0 = M.stamp + .25; if (t < t0 || t > M.reveal426 - .1) return null; return { o: smooth(0, 1, (t - t0) / .12) * fo(t, M.reveal426 - .1, .12), s: 1 }; } });
mk('', { cx: 540, cy: 640, size: 460, cls: 'disp', fn: (t) => {
  const t0 = M.reveal426; if (t < t0 || t > cv.end) return null; const st = slam(t, t0, 1.1, .2); const [sx, sy] = shakeXY(t, t0, 18);
  return { html: `<span class="osw tl" style="display:block;font-size:.17em;letter-spacing:.14em;margin-bottom:.08em">IN A REAL MATCH</span>${cnt(t, t0, 426)}<span class="u" style="display:block;font-size:.28em;margin:.04em 0 0">KM/H</span>`, o: st.o * fo(t, cv.end, .1), s: st.s, dx: sx, dy: sy };
} });
mk('2017 · BADMINTON PREMIER LEAGUE', { cx: 540, cy: 1160, size: 46, cls: 'osw', fn: (t) => { const t0 = M.reveal426 + .35; if (t < t0 || t > cv.end) return null; return { o: smooth(0, 1, (t - t0) / .2) * fo(t, cv.end, .1), s: 1 }; } });

// ---- RANK (bar race)
const rk = S('rank'), BARW = 800, BX = 70;
const rows = [
  { id: 'lab', label: 'LAB TEST · NOT A MATCH', v: 565, dec: 0, col: '#ff7a1f', t: () => M.bar426, y: 640, ghost: true },
  { id: 'bad', label: 'BADMINTON · IN A MATCH', v: 426, dec: 0, col: '#ff7a1f', t: () => M.bar426 + .15, y: 840 },
  { id: 'f1', label: 'FORMULA 1 CAR', v: 372.6, dec: 1, col: '#2fd3d0', t: () => M.bar372, y: 1040 },
  { id: 'ten', label: "TENNIS · FASTEST RECORDED SERVE", v: 263.4, dec: 1, col: '#39ff14', t: () => M.bar263, y: 1240 },
];
rows.forEach(r => {
  mk('', { cx: 0, cy: r.y, size: 40, fn: (t) => {
    const t0 = r.t(); if (t < t0 || t > rk.end) return null; const u = easeOut(clamp((t - t0) / .55)); const w = BARW * (r.v / 565) * u;
    const st = slam(t, t0 + .35, .35, .15);
    const bar = r.ghost ? `border:5px dashed ${r.col};background:rgba(255,122,31,.10)` : `background:linear-gradient(90deg,${r.col}99,${r.col});box-shadow:0 0 32px ${r.col}77`;
    return { html: `<div style="position:absolute;left:${BX}px;top:-76px;font-family:Oswald;font-weight:700;font-size:40px;letter-spacing:.07em;color:${r.ghost ? '#9fb0d4' : '#fff'};text-shadow:0 3px 12px #000">${r.label}</div><div class="bar" style="left:${BX}px;top:-46px;width:${w}px;${bar}"></div><div style="position:absolute;left:${BX + w + 18}px;top:-62px;font-family:Anton;font-size:96px;color:${r.ghost ? '#9fb0d4' : '#fff'};text-shadow:0 6px 0 #060a1e;white-space:nowrap;transform:scale(${st.s});transform-origin:left center">${cnt(t, t0 + .1, r.v, r.dec)}<span class="u" style="font-size:.34em">KM/H</span></div>`, o: smooth(0, 1, (t - t0) / .08) * fo(t, rk.end, .1), s: 1 };
  } });
});
mk('', { cx: 540, cy: 380, size: 104, cls: 'disp', w: 980, fn: (t) => { const t0 = rk.start + .1; if (t < t0 || t > rk.end) return null; return { html: words('STILL FASTER THAN…', t, t0, .1, { FASTER: 'or' }), o: fo(t, rk.end, .1), s: 1 }; } });

// ---- HISTORY headlines
const hs = S('history');
const BEATS = [
  { head: '~2,000 YEARS AGO', sub: 'INDIA · CHINA · GREECE', c: [62, 30], z: 1.0 },
  { head: '1860s · POONA', sub: 'BRITISH OFFICERS ADD A NET', c: [74, 19], z: 2.3 },
  { head: '1873 · BADMINTON HOUSE', sub: 'GLOUCESTERSHIRE, ENGLAND', c: [-2.3, 51.5], z: 2.7 },
  { head: '1992 · OLYMPIC DEBUT', sub: 'BARCELONA', c: [2.2, 41.4], z: 3.0 },
];
BEATS.forEach((b, i) => {
  mk('', { cx: 540, cy: 300, size: i === 2 ? 86 : 118, cls: 'disp', w: 1000, fn: (t) => {
    const t0 = M.hy[i] - .1, t1 = i < 3 ? M.hy[i + 1] - .05 : hs.end; if (t < t0 || t > t1) return null;
    return { html: words(b.head, t, t0, .1, { '~2,000': 'or', '1860s': 'or', '1873': 'or', '1992': 'or' }) + `<span class="osw tl" style="display:block;font-size:.4em;letter-spacing:.16em;margin-top:.22em;opacity:${smooth(0, 1, (t - t0 - .25) / .2)}">${b.sub}</span>`, o: fo(t, t1, .08), s: 1 };
  } }).d.style.whiteSpace = 'normal';
});

// ---- SHUTTLE
const sh = S('shuttle');
mk('', { cx: 540, cy: 330, size: 250, cls: 'disp', fn: (t) => {
  const t0 = M.feathers - .1; if (t < t0 || t > sh.end) return null; const n = Math.min(16, Math.floor(clamp((t - M.feathers) / .75) * 16 + .001)); const st = slam(t, t0, .5, .15);
  return { html: `${n}<span class="osw" style="display:block;font-size:.3em;letter-spacing:.12em;margin-top:.04em">FEATHERS</span>`, o: st.o * fo(t, sh.end, .1), s: st.s };
} }).d.style.whiteSpace = 'normal';
mk('CORK BASE', { cx: 800, cy: 1160, size: 46, cls: 'co', fn: (t) => { const t0 = M.feathers + 1.05; if (t < t0 || t > sh.end) return null; return { o: smooth(0, 1, (t - t0) / .12) * fo(t, sh.end, .1), s: 1 }; } });
mk('', { cx: 540, cy: 1330, size: 190, cls: 'disp', fn: (t) => {
  const t0 = M.g5; if (t < t0 || t > sh.end) return null; const st = slam(t, t0, .6, .18);
  return { html: `<span class="osw tl" style="font-size:.2em;letter-spacing:.14em;margin-right:.2em">ABOUT</span>~${cnt(t, t0, 5)}<span class="u" style="font-size:.4em">G</span>`, o: st.o * fo(t, sh.end, .1), s: st.s };
} });
const coLine = document.createElementNS('http://www.w3.org/2000/svg', 'line'); coLine.setAttribute('stroke', '#2fd3d0'); coLine.setAttribute('stroke-width', '4');
const coDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); coDot.setAttribute('r', '9'); coDot.setAttribute('fill', '#2fd3d0'); svg.append(coLine, coDot);

// ---- WHY
const wy = S('why');
mk('ILLUSTRATIVE', { cx: 540, cy: 215, size: 30, cls: 'osw', fn: (t) => (t < wy.start || t > wy.end) ? null : { o: .8 * fo(t, wy.end, .1) } });
mk('SHUTTLE SLOWS FAST', { cx: 540, cy: 400, size: 106, cls: 'disp or', fn: (t) => { if (t < M.lbl1 || t > wy.end) return null; const st = slam(t, M.lbl1, .5, .16); return { o: st.o * fo(t, wy.end, .1), s: st.s }; } });
mk('BALL HOLDS SPEED', { cx: 540, cy: 540, size: 106, cls: 'disp gr', fn: (t) => { if (t < M.lbl2 || t > wy.end) return null; const st = slam(t, M.lbl2, .5, .16); return { o: st.o * fo(t, wy.end, .1), s: st.s }; } });

// ---- CLOSE / END
const cl = S('close'), en = S('endcard');
mk('', { cx: 540, cy: 430, size: 150, cls: 'disp', w: 1000, fn: (t) => {
  const t0 = M.comment; if (t < t0 || t > cl.end) return null; return { html: words('WHICH SPORT IS FASTER?', t, t0, .12, { FASTER: 'or' }), o: fo(t, cl.end, .1), s: 1 };
} }).d.style.whiteSpace = 'normal';
mk('COMMENT BELOW', { cx: 540, cy: 760, size: 64, cls: 'osw tl', fn: (t) => { const t0 = LN.z2.start; if (t < t0 || t > cl.end) return null; const st = slam(t, t0, .4, .16); return { o: st.o * fo(t, cl.end, .1), s: st.s }; } });
const eu = (t, d) => clamp((t - en.start - d) / .45);
mk('CHANNEL NAME', { cx: 540, cy: 520, size: 140, cls: 'disp', fn: (t) => t < en.start ? null : { o: easeOut(eu(t, 0)), s: 1, dy: (1 - easeOut(eu(t, 0))) * 30 } });
mk('SOURCES', { cx: 540, cy: 760, size: 62, cls: 'osw or', fn: (t) => t < en.start + .15 ? null : { o: easeOut(eu(t, .15)), s: 1 } });
mk('Guinness World Records; Wikipedia (fastest recorded tennis serves); Olympics.com; BWF.', { cx: 540, cy: 880, size: 40, cls: 'osw', w: 900, fn: (t) => t < en.start + .25 ? null : { o: easeOut(eu(t, .25)) * .9, s: 1 } });

function updateHud(t) {
  for (const it of items) {
    const r = it.fn ? it.fn(t) : { o: 1, s: 1 };
    if (!r || r.o <= .001) { it.d.style.opacity = 0; continue; }
    if (r.html !== undefined && it.last !== r.html) { it.d.innerHTML = r.html; it.last = r.html; }
    it.d.style.opacity = Math.min(1, r.o);
    it.d.style.transform = `translate(-50%,-50%) translate(${r.dx || 0}px,${r.dy || 0}px) scale(${r.s ?? 1}) rotate(${r.r || 0}deg)`;
  }
}

// ============================================================ globe (d3)
const globe = document.getElementById('globe'), gx = globe.getContext('2d');
const land = topojson.feature(WORLD, WORLD.objects.countries).features;
const byName = (n) => land.find(f => f.properties.name === n);
const HL = { india: byName('India'), china: byName('China'), greece: byName('Greece'), uk: byName('United Kingdom'), spain: byName('Spain') };
const grat = d3.geoGraticule10(), sphere = { type: 'Sphere' };
const PUNE = [73.86, 18.52], BHOUSE = [-2.28, 51.54], BCN = [2.17, 41.39];
function drawGlobe(t) {
  gx.clearRect(0, 0, W, H);
  const u = clamp((t - hs.start) / 1); const gin = easeOut(u), gout = 1 - smooth(hs.end - .25, hs.end, t);
  const R0 = 450, cx = 540, cy = 900;
  // focus state from beats
  let bi = 0; for (let i = 0; i < 4; i++) if (t >= M.hy[i] - .05) bi = i;
  const tb = clamp((t - (M.hy[bi] - .05)) / .9), e = easeInOut(tb);
  const prev = BEATS[Math.max(0, bi - 1)], cur = BEATS[bi];
  let c, z;
  if (bi === 2) { // zoom out to show the India -> England arc, then settle on England
    const tz = clamp((t - (M.hy[2] - .05)) / 1.6);
    c = [lerp(74, -2.3, easeInOut(smooth(.25, 1, tz))), lerp(19, 51.5, easeInOut(smooth(.25, 1, tz)))]; z = lerp(2.3, 1.3, Math.sin(Math.min(1, tz * 1.3) * Math.PI * .5)) * (1 - smooth(.55, 1, tz)) + 2.7 * smooth(.55, 1, tz) - 0.0;
    z = tz < .55 ? lerp(2.3, 1.15, easeInOut(tz / .55)) : lerp(1.15, 2.7, easeInOut((tz - .55) / .45));
  } else { c = [lerp(prev.c[0], cur.c[0], e), lerp(prev.c[1], cur.c[1], e)]; z = lerp(prev.z, cur.z, e); if (bi === 0) { c = cur.c; z = cur.z; } }
  const proj = d3.geoOrthographic().rotate([-c[0], -c[1]]).scale(R0 * z).translate([cx, cy]).clipAngle(90).precision(.5);
  const path = d3.geoPath(proj, gx);
  gx.save(); gx.globalAlpha = gin * gout;
  // atmosphere + sphere
  const R = R0 * z; const gl = gx.createRadialGradient(cx, cy, Math.min(R * .96, 760), cx, cy, Math.min(R * 1.08, 820)); gl.addColorStop(0, 'rgba(47,211,208,.35)'); gl.addColorStop(1, 'rgba(47,211,208,0)');
  gx.fillStyle = gl; gx.beginPath(); gx.arc(cx, cy, Math.min(R * 1.08, 820), 0, 7); gx.fill();
  gx.beginPath(); path(sphere); const sg = gx.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R); sg.addColorStop(0, '#12365a'); sg.addColorStop(1, '#060f26'); gx.fillStyle = sg; gx.fill();
  gx.beginPath(); path(grat); gx.strokeStyle = 'rgba(120,200,235,.13)'; gx.lineWidth = 1.2; gx.stroke();
  gx.beginPath(); land.forEach(f => path(f)); gx.fillStyle = '#143a57'; gx.fill(); gx.strokeStyle = 'rgba(150,215,240,.45)'; gx.lineWidth = 1.4; gx.stroke();
  const pulse = .62 + .18 * Math.sin(t * 6);
  const lit = (f, a) => { gx.beginPath(); path(f); gx.fillStyle = `rgba(255,122,31,${a})`; gx.fill(); gx.strokeStyle = 'rgba(255,220,170,.95)'; gx.lineWidth = 2.4; gx.shadowColor = '#ff7a1f'; gx.shadowBlur = 24; gx.stroke(); gx.shadowBlur = 0; };
  if (t >= M.hy[0] - .05) { const a = bi === 0 ? pulse : .3; [HL.india, HL.china, HL.greece].forEach(f => f && lit(f, a)); }
  if (bi >= 1) lit(HL.india, bi === 1 ? pulse : .25);
  if (bi >= 2 && HL.uk) lit(HL.uk, bi === 2 ? pulse : .25);
  if (bi >= 3 && HL.spain) lit(HL.spain, pulse);
  // atmosphere rim + terminator shading
  const sh = gx.createRadialGradient(cx - R * .25, cy - R * .3, R * .3, cx, cy, R); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
  gx.beginPath(); path(sphere); gx.fillStyle = sh; gx.fill(); gx.strokeStyle = 'rgba(120,230,240,.6)'; gx.lineWidth = 3; gx.stroke();
  // arc Pune -> Badminton House
  if (bi >= 2) {
    const p = bi === 2 ? easeInOut(clamp((t - M.hy[2]) / 1.1)) : 1; const it = d3.geoInterpolate(PUNE, BHOUSE); const pts = []; for (let i = 0; i <= 60 * p; i++) pts.push(it(i / 60));
    gx.beginPath(); path({ type: 'LineString', coordinates: pts }); gx.strokeStyle = '#ffb25a'; gx.lineWidth = 7; gx.shadowColor = '#ff7a1f'; gx.shadowBlur = 26; gx.lineCap = 'round'; gx.stroke(); gx.shadowBlur = 0;
  }
  // pins + labels
  const pin = (ll, label, on) => {
    const pt = proj(ll); if (!pt) return; const vis = d3.geoDistance(ll, c) < 1.45; if (!vis) return;
    const pr = (t * 1.4) % 1; gx.beginPath(); gx.arc(pt[0], pt[1], 12 + pr * 46, 0, 7); gx.strokeStyle = `rgba(255,170,80,${(1 - pr) * .9})`; gx.lineWidth = 5; gx.stroke();
    gx.beginPath(); gx.arc(pt[0], pt[1], 13, 0, 7); gx.fillStyle = '#fff'; gx.fill(); gx.beginPath(); gx.arc(pt[0], pt[1], 8, 0, 7); gx.fillStyle = '#ff6a13'; gx.fill();
    gx.font = '700 44px Oswald'; gx.textAlign = 'center'; gx.lineWidth = 11; gx.strokeStyle = '#060a1e'; gx.lineJoin = 'round'; gx.strokeText(label, pt[0], pt[1] - 40); gx.fillStyle = '#fff'; gx.fillText(label, pt[0], pt[1] - 40);
  };
  if (bi === 1) pin(PUNE, 'POONA (PUNE)'); if (bi === 2) pin(BHOUSE, 'BADMINTON HOUSE'); if (bi === 3) pin(BCN, 'BARCELONA');
  if (bi === 0) { gx.font = '700 44px Oswald'; gx.textAlign = 'center'; gx.lineJoin = 'round'; for (const [n, f] of [['INDIA', HL.india], ['CHINA', HL.china], ['GREECE', HL.greece]]) { const cc = d3.geoCentroid(f), pt = proj(cc); if (pt && d3.geoDistance(cc, c) < 1.4) { gx.lineWidth = 10; gx.strokeStyle = '#060a1e'; gx.strokeText(n, pt[0], pt[1]); gx.fillStyle = '#fff'; gx.fillText(n, pt[0], pt[1]); } } }
  gx.restore();
}

// ============================================================ camera + fx helpers
const camT = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40 };
const punches = EV.filter(e => e.type === 'punch').map(e => e.t), shakes = EV.filter(e => e.type === 'shake');
function punchScale(t) { let z = 0; for (const te of punches) { const dt = t - te; if (dt < 0 || dt > 1.4) continue; z = Math.max(z, dt < .23 ? .13 * easeOut(dt / .23) : .13 * (1 - easeInOut((dt - .23) / 1.1))); } return 1 + z; }
function applyCam(t, dist = 6, handheld = 1) {
  cam.position.copy(camT.pos);
  const sh = new THREE.Vector3(noise(t * 1.1, 1) * .0045, noise(t * 1.3, 2) * .0045, noise(t * .9, 3) * .0025).multiplyScalar(dist * handheld);
  let imp = 0; for (const e of shakes) { const dt = t - e.t; if (dt >= 0 && dt < .5) imp += e.amp * Math.exp(-dt * 9) * Math.sin(dt * 75); }
  sh.x += imp * dist * .35; sh.y += imp * dist * .25 * Math.cos(t * 50); cam.position.add(sh);
  cam.lookAt(camT.look); cam.rotateZ(noise(t * .8, 5) * .004 + imp * .12);
  cam.fov = camT.fov / punchScale(t); cam.updateProjectionMatrix();
}
function setVis(o) { court.visible = !!o.court; court.userData.net.visible = !!o.net; A.root.visible = A.racket.visible = !!o.A; O.root.visible = O.racket.visible = !!o.O; hero.visible = !!o.hero; heroTrail.group.visible = !!o.hero; streakMesh.visible = !!o.streaks; diag.visible = !!o.diag; ring.visible = flashSprite.visible = !!o.fx; heroLight.intensity = 0; plain.visible = true; }
function streaks(t, color, dir = 1, speedMul = 1) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < NS; i++) { const d = sData[i]; const z = ((d.z0 - t * d.sp * speedMul * dir) % 60 + 60) % 60 - 52; p.set(d.x, d.y, z); s.set(1, 1, d.len * speedMul); m.compose(p, q, s); streakMesh.setMatrixAt(i, m); streakMesh.setColorAt(i, d.c > .55 ? cOr : cTl); }
  streakMesh.instanceMatrix.needsUpdate = true; if (streakMesh.instanceColor) streakMesh.instanceColor.needsUpdate = true;
}
const piece = (tab, t) => { for (let i = 1; i < tab.length; i++) if (t <= tab[i][0]) { const [t0, a0] = tab[i - 1], [t1, a1] = tab[i]; return lerp(a0, a1, (t - t0) / (t1 - t0)); } return tab[tab.length - 1][1]; };

// ============================================================ scenes
let blackOp = 0;
function sceneHook(t) {
  setVis({ court: 1, net: 1, A: 1, hero: 1, fx: 1 }); A.root.position.copy(PB);
  const a = piece([[0, 2.30], [.5, 2.78], [.8, 3.0], [1.9, 3.38], [2.5, 3.85], [hk.end, 4.5]], t);
  poseAthlete(A, smashSpec(a));
  const p = shuttleAt(a, hero.position); hero.scale.setScalar(5.5); hero.userData.body.rotation.x = a * 22; orient(hero, p.clone(), shuttleAt(a + .01, new THREE.Vector3())); hero.visible = a < 3.9;
  heroTrail.size = .7; heroTrail.life = .1; heroTrail.update((tt) => shuttleAt(tt, new THREE.Vector3()), a, 1, .3);
  heroLight.position.set(hero.position.x, hero.position.y, 1.6); heroLight.intensity = 3;
  // shock ring + flash at contact
  const dc = t - M.contact; const on = dc >= 0 && dc < .5;
  ring.visible = flashSprite.visible = on; if (on) { const k = easeOut(dc / .5); ring.position.copy(PcB); ring.quaternion.copy(cam.quaternion); ring.scale.setScalar(.15 + 2.6 * k); ring.material.opacity = (1 - k) * .9; flashSprite.position.copy(PcB); flashSprite.scale.setScalar(1.6 * (1 - dc / .25 > 0 ? 1 - dc / .25 : 0) + .01); flashSprite.material.opacity = Math.max(0, 1 - dc / .25); }
  const u = clamp(t / 2.6), az = lerp(.62, -.08, easeInOut(u)), R = lerp(2.7, 6.2, easeOut(u));
  camT.pos.set(PB.x - .3 + Math.sin(az) * R, lerp(.85, 1.5, easeOut(u)), Math.cos(az) * R); camT.look.set(PB.x - .5, lerp(2.15, 1.9, u), 0); camT.fov = lerp(34, 44, easeOut(clamp(t / 1.4)));
  applyCam(t, R);
}
function sceneCaveat(t) {
  setVis({ court: 1, net: 1, A: 1, O: 1, hero: 0, fx: 0 });
  const w = t - cv.start; A.root.position.set(1.05, 0, 0); O.root.position.set(-1.05, 0, 0); poseAthlete(A, readySpec(t)); poseAthlete(O, readySpec(t + 1));
  const u = clamp(w / (cv.end - cv.start));
  camT.pos.set(.3 + .4 * u, 1.4 + .15 * u, 8.0 - 1.0 * u); camT.look.set(0, 1.25, 0); camT.fov = 40;
  applyCam(t, 8); heroLight.intensity = 0;
}
function sceneRank(t) {
  setVis({ streaks: 1 });
  streaks(t, 0, 1, 1.0);
  hero.scale.setScalar(26); hero.position.set(0, -2.2, -14); hero.rotation.set(0, Math.PI * .9, 0); hero.userData.body.rotation.x = t * 3;
  heroTrail.group.visible = false; heroLight.position.set(1, 2, -8); heroLight.intensity = 25;
  camT.pos.set(Math.sin(t * .3) * .6, 0, 4); camT.look.set(0, 0, -10); camT.fov = 55; applyCam(t, 6, .4);
}
function sceneHistory(t) {
  setVis({ streaks: 1 }); streaks(t, 0, 1, .22);
  camT.pos.set(0, 0, 4); camT.look.set(0, 0, -10); camT.fov = 55; applyCam(t, 6, .3);
}
const heroSh = { rot: 0 };
function sceneShuttle(t) {
  setVis({ hero: 1 }); const w = t - sh.start, u = clamp(w / (sh.end - sh.start));
  hero.position.set(0, 1.5, 0); hero.scale.setScalar(12.5); hero.rotation.set(0, 0, .12); hero.userData.body.rotation.x = t * .5; heroTrail.group.visible = false;
  const n = t < M.feathers ? 0 : Math.min(16, Math.floor(clamp((t - M.feathers) / .75) * 16 + .001)); highlightFeathers(hero, n, Math.sin(t * 9) * .5 + .5);
  heroLight.position.set(1.5, 3.2, 3.2); heroLight.intensity = 28;
  const az = lerp(-1.0, .85, easeInOut(u)), R = lerp(4.2, 3.4, u);
  camT.pos.set(Math.sin(az) * R, 1.75 + .25 * Math.sin(u * 3), Math.cos(az) * R); camT.look.set(-.15, 1.5, 0); camT.fov = 40; applyCam(t, 3.4);
  hero.updateMatrixWorld(true); const anchor = hero.userData.body.localToWorld(new THREE.Vector3(.0125, 0, 0)).project(cam); const ax = (anchor.x * .5 + .5) * W, ay = (-anchor.y * .5 + .5) * H;
  const on = t >= M.feathers + 1.05; coLine.setAttribute('x1', ax); coLine.setAttribute('y1', ay); coLine.setAttribute('x2', 800); coLine.setAttribute('y2', 1132); coLine.style.opacity = on ? fo(t, sh.end, .1) : 0; coDot.setAttribute('cx', ax); coDot.setAttribute('cy', ay); coDot.style.opacity = coLine.style.opacity;
}
function sceneWhy(t) {
  setVis({ diag: 1 }); const tl = Math.max(0, t - M.launch);
  const vS = 8.5, kS = .95, vB = 4.6, kB = .1; const xS = vS * (1 - Math.exp(-kS * tl)) / kS, xB = vB * (1 - Math.exp(-kB * tl)) / kB, spS = vS * Math.exp(-kS * tl), spB = vB * Math.exp(-kB * tl);
  const fall = Math.max(0, tl - 2.6);
  dShuttle.position.set(xS, 1.3 - Math.min(1.15, .4 * fall * fall), ZS); dShuttle.rotation.set(0, 0, -Math.min(1.2, fall * .6)); dShuttle.userData.body.rotation.x = t * 8; dShuttle.userData.glow.material.opacity = .55 * clamp(spS / 3 + .15);
  dBall.position.set(xB, 1.3, ZB); dBall.rotation.z = -xB * 2;
  setArrow(arrS, xS - .3, 2.7, ZS, spS * .42); setArrow(arrB, xB - .3, 2.7, ZB, spB * .42);
  dTrailS.size = 1; dTrailS.life = .6; dTrailB.size = .9; dTrailB.life = 1.2;
  dTrailS.update((tt) => new THREE.Vector3(vS * (1 - Math.exp(-kS * Math.max(0, tt - M.launch))) / kS, 1.3, ZS), t, 1, M.launch);
  dTrailB.update((tt) => new THREE.Vector3(vB * (1 - Math.exp(-kB * Math.max(0, tt - M.launch))) / kB, 1.3, ZB), t, 1, M.launch);
  const cx = Math.max(3.2, (xS + xB) / 2 + 1.2); camT.pos.set(cx - 1.5, 4.6, 15); camT.look.set(cx, 1.3, 0); camT.fov = 42; applyCam(t, 15, .5);
  heroLight.position.set(cx, 8, 6); heroLight.intensity = 40; heroTrail.group.visible = false;
}
function sceneClose(t) {
  setVis({ court: 1, net: 1, A: 1 }); A.root.position.copy(PB); const w = t - cl.start, u = clamp(w / (cl.end - cl.start));
  poseAthlete(A, smashSpec(3.04 + Math.sin(w * 2) * .008));
  const R = lerp(4.6, 15, easeInOut(u)), az = lerp(.5, -.25, u);
  camT.pos.set(PB.x + Math.sin(az) * R * .9, lerp(1.2, 3.8, easeInOut(u)), Math.cos(az) * R); camT.look.set(PB.x - 1.0, lerp(1.9, 1.2, u), 0); camT.fov = 42; applyCam(t, R);
  blackOp = smooth(cl.end - .3, cl.end, t);
}
function sceneEnd(t) {
  setVis({ court: 1, net: 0, hero: 1 }); const w = t - en.start; const d0 = M.lastDrop, dur = .55, u = clamp((t - d0) / dur);
  hero.scale.setScalar(8); hero.rotation.set(0, 0, -Math.PI / 2 + (u >= 1 ? .5 : 0)); hero.userData.body.rotation.x = t * 3; highlightFeathers(hero, 0);
  const y = u < 1 ? lerp(5.5, .26, u * u) : .26 + Math.abs(Math.sin((t - d0 - dur) * 7)) * .2 * Math.exp(-(t - d0 - dur) * 3);
  hero.position.set(0, y, 0); hero.visible = t > d0 - .05; heroTrail.size = 1.3; heroTrail.life = .14; heroTrail.update((tt) => new THREE.Vector3(0, lerp(5.5, .26, clamp((tt - d0) / dur) ** 2), 0), t, u < 1 ? 1 : 0, d0);
  heroLight.position.set(0, 1.5, 2); heroLight.intensity = 3;
  camT.pos.set(0, 2.4, 9.5 - .5 * (w / 2.5)); camT.look.set(0, 1.0, 0); camT.fov = 42; applyCam(t, 9);
  blackOp = 1 - smooth(0, .3, w);
}
const ORDER = [['hook', sceneHook], ['caveat', sceneCaveat], ['rank', sceneRank], ['history', sceneHistory], ['shuttle', sceneShuttle], ['why', sceneWhy], ['close', sceneClose], ['endcard', sceneEnd]];
const blk = document.getElementById('blk');

window.renderFrame = (f) => {
  const t = f / TL.fps; blackOp = 0;
  let pick = ORDER[ORDER.length - 1]; for (const o of ORDER) { const sc = SC[o[0]]; if (t >= sc.start && t < sc.end) { pick = o; break; } }
  svg.querySelectorAll('line,circle').forEach(n => { if (pick[0] !== 'shuttle') n.style.opacity = 0; });
  pick[1](t);
  globe.style.opacity = pick[0] === 'history' ? 1 : 0; if (pick[0] === 'history') drawGlobe(t); else if (pick[0] !== 'rank') gx.clearRect(0, 0, W, H);
  fxg.clearRect(0, 0, W, H);
  // post fx state: transitions + impacts
  let whip = [0, 0], zoom = 0, ca = 0, flash = 0, glitch = 0;
  for (const c of CUTS) { const dt = t - c.t; if (dt < -.25 || dt > .3) continue; const b = Math.exp(-Math.pow(dt / .1, 2));
    if (c.kind === 'whip') { whip[0] += c.dir[0] * .13 * b; whip[1] += c.dir[1] * .13 * b; ca += 1.2 * b; flash += .18 * b; }
    else if (c.kind === 'zoom') { zoom += .5 * b; ca += .8 * b; flash += .25 * b; }
    else if (c.kind === 'glitch') { glitch += b; ca += 1.8 * b; flash += .12 * b; }
    else if (c.kind === 'flash') { flash += .95 * Math.pow(b, .7); ca += .8 * b; } }
  for (const te of punches) { const dt = t - te; if (dt >= 0 && dt < .35) ca += .7 * Math.exp(-dt * 14); }
  // speed lines at the smash contact
  const dcn = t - M.contact; if (dcn >= -.0 && dcn < .45) { const k = 1 - dcn / .45; fxg.save(); fxg.translate(540, 900); fxg.strokeStyle = `rgba(255,255,255,${k * .55})`; for (let i = 0; i < 70; i++) { const a = i / 70 * Math.PI * 2 + noise(i, 3) * .05, r0 = 360 + (i % 5) * 60 + dcn * 900, r1 = r0 + 260 + (i % 7) * 70; fxg.lineWidth = 2 + (i % 4); fxg.beginPath(); fxg.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 1.6); fxg.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * 1.6); fxg.stroke(); } fxg.restore(); }
  FX.uniforms.uWhip.value.set(whip[0], whip[1]); FX.uniforms.uZoom.value = zoom; FX.uniforms.uCA.value = ca; FX.uniforms.uFlash.value = flash; FX.uniforms.uGlitch.value = glitch; FX.uniforms.uTime.value = t * 1.0;
  if (t < .15) blackOp = Math.max(blackOp, 1 - t / .15);
  updateHud(t); blk.style.opacity = blackOp;
  composer.render();
  return pick[0];
};
window.ready = true;
