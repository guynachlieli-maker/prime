import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { bodyShape, type BodyParams } from '../engine/bodyshape';
export { bodyShape, type BodyParams };

/* ---------- hologram shading ---------- */

const vertex = `
varying vec3 vN; varying vec3 vView; varying vec3 vW;
void main(){
  vec4 wp = modelMatrix * vec4(position,1.0);
  vW = wp.xyz;
  vN = normalize(normalMatrix * normal);
  vec4 mv = viewMatrix * wp;
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const fragment = `
uniform vec3 uColor; uniform vec3 uTop; uniform float uTime; uniform float uOpacity; uniform float uH;
varying vec3 vN; varying vec3 vView; varying vec3 vW;
void main(){
  float fres = pow(1.0 - abs(dot(vN, vView)), 2.4);
  float h = clamp(vW.y / uH, 0.0, 1.0);
  vec3 col = mix(uColor, uTop, h);
  float scan = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(vW.y * 220.0 - uTime * 4.0));
  float grid = smoothstep(0.92, 1.0, 0.5 + 0.5 * sin(atan(vW.z, vW.x) * 24.0));
  float sweep = smoothstep(0.045, 0.0, abs(fract(h * 0.9 - uTime * 0.16) - 0.5) - 0.455);
  float flick = 0.94 + 0.06 * sin(uTime * 23.0 + vW.y * 9.0);
  float a = (0.035 + fres * 0.5 + scan * 0.05 + grid * 0.03 + sweep * 0.25) * uOpacity * flick;
  gl_FragColor = vec4(col * (0.35 + fres * 0.75 + sweep * 0.6 + scan * 0.1), a);
}`;

function holoMaterial(color: string, top: string, opacity: number, H: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTop: { value: new THREE.Color(top) }, uTime: { value: 0 }, uOpacity: { value: opacity }, uH: { value: H } },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
  });
}

const beamFragment = `
uniform vec3 uColor; uniform float uTime; varying vec3 vW; varying vec3 vN; varying vec3 vView;
void main(){
  float h = clamp(vW.y / 2.1, 0.0, 1.0);
  float fade = (1.0 - h) * (1.0 - h);
  float ray = 0.6 + 0.4 * sin(atan(vW.z, vW.x) * 18.0 + uTime * 0.8);
  gl_FragColor = vec4(uColor, fade * 0.06 * ray);
}`;

/** A rounded, tapered limb as one smooth surface (no visible joints). */
function limb(len: number, r1: number, r2: number, mat: THREE.Material): THREE.Mesh {
  const pts: THREE.Vector2[] = [];
  const cap = 6;
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * r2, -len / 2 - r2 * 0.6 + (1 - Math.cos(a)) * r2 * 0.6));
  }
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    const bulge = Math.sin(t * Math.PI) * 0.08 * (r1 + r2);
    pts.push(new THREE.Vector2(r2 + (r1 - r2) * t + bulge, -len / 2 + len * t));
  }
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r1, len / 2 + Math.sin(a) * r1 * 0.6));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 32), mat);
}

function place(m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize());
}

export function buildBody(p: BodyParams, mat: THREE.Material): THREE.Group {
  const b = bodyShape(p);
  const H = b.H;
  const k = H / 1.75;
  const g = new THREE.Group();
  // torso: one smooth lathe from crotch to neck base
  const prof: [number, number][] = [
    [0.001, 0.452],
    [b.hip * 0.62, 0.458],
    [b.hip * 0.9, 0.475],
    [b.hip, 0.505],
    [b.hip * 0.97, 0.535],
    [(b.hip + b.belly) / 2, 0.56],
    [b.belly, 0.585],
    [b.waist, 0.62],
    [(b.waist + b.chest) / 2, 0.665],
    [b.chest * 0.98, 0.7],
    [b.chest, 0.725],
    [b.shoulder * 0.86, 0.765],
    [b.shoulder * 0.9, 0.79],
    [b.shoulder * 0.62, 0.812],
    [b.neck * 1.25, 0.828],
    [b.neck, 0.84],
    [b.neck * 0.98, 0.875],
    [b.neck * 1.05, 0.885],
    [0.001, 0.886],
  ];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y * H)), 64), mat);
  // belly and glutes push forward/back with body fat; chest deeper with muscle
  torso.scale.z = 0.66 + Math.max(0, b.fat) * 0.9;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.104 * k, 40, 28), mat);
  head.scale.set(0.84, 1.1, 0.95);
  head.position.y = 0.94 * H;
  g.add(head);

  for (const side of [-1, 1]) {
    const hipJ = new THREE.Vector3(side * b.hip * 0.5, 0.47 * H, 0);
    const knee = new THREE.Vector3(side * b.hip * 0.4, 0.268 * H, 0.008);
    const ankle = new THREE.Vector3(side * b.hip * 0.36, 0.05 * H, -0.006);
    const thigh = limb(hipJ.distanceTo(knee), b.thigh, b.thigh * 0.6, mat);
    place(thigh, hipJ, knee);
    g.add(thigh);
    const calf = limb(knee.distanceTo(ankle), b.calf * 1.08, b.calf * 0.62, mat);
    place(calf, knee, ankle);
    g.add(calf);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.046 * k, 24, 14), mat);
    foot.scale.set(0.78, 0.42, 2.1);
    foot.position.set(ankle.x, 0.022 * H, 0.045 * k);
    g.add(foot);

    const sh = new THREE.Vector3(side * (b.shoulder - b.arm * 0.15), 0.792 * H, 0);
    const elbow = new THREE.Vector3(side * (b.shoulder + b.arm * 0.55), 0.622 * H, -0.012);
    const wrist = new THREE.Vector3(side * (b.shoulder + b.arm * 0.78), 0.47 * H, 0.02);
    const upper = limb(sh.distanceTo(elbow), b.arm * 1.05, b.arm * 0.8, mat);
    place(upper, sh, elbow);
    g.add(upper);
    const fore = limb(elbow.distanceTo(wrist), b.arm * 0.82, b.arm * 0.52, mat);
    place(fore, elbow, wrist);
    g.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.036 * k, 20, 14), mat);
    hand.scale.set(0.7, 1.45, 0.45);
    hand.position.set(wrist.x + side * 0.004, wrist.y - 0.055 * k, wrist.z);
    g.add(hand);
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(b.arm * 1.22, 24, 16), mat);
    deltoid.position.copy(sh).add(new THREE.Vector3(side * 0.006, 0.004, 0));
    g.add(deltoid);
  }
  return g;
}

function projector(color: string, x: number, beamMat: THREE.ShaderMaterial): THREE.Group {
  const g = new THREE.Group();
  g.position.x = x;
  // glowing base disc
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, color);
  grd.addColorStop(0.35, color + '88');
  grd.addColorStop(1, color + '00');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.003;
  g.add(disc);
  for (const [r, w, o] of [[0.26, 0.012, 0.9], [0.34, 0.006, 0.5], [0.4, 0.004, 0.35]] as const) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + w, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    ring.userData.spin = r === 0.34 ? 0.4 : r === 0.4 ? -0.25 : 0;
    g.add(ring);
  }
  // light beam
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.27, 2.1, 48, 1, true), beamMat);
  beam.position.y = 1.05;
  g.add(beam);
  // rising particles
  const n = 90;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.08 + Math.random() * 0.26;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 2;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.012, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.userData.particles = true;
  g.add(pts);
  return g;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export interface AvatarBody extends BodyParams {
  label: string;
  color: string;
  sub?: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Holographic body view. With two bodies, the second shows the forecast and carries a faint
 * outline of the first, so the change is visible without exaggerating it. Changing the
 * forecast morphs smoothly between shapes.
 */
export function Avatar3D(props: { bodies: AvatarBody[]; height?: number; ghost?: boolean; compareTo?: BodyParams }) {
  const mount = useRef<HTMLDivElement>(null);
  const [ok] = useState(webglAvailable);
  const api = useRef<{ setBodies: (b: AvatarBody[]) => void; setGhost: (g: BodyParams | undefined) => void } | null>(null);
  const n = props.bodies.length;
  const colorsKey = props.bodies.map((b) => b.color).join();

  // scene setup: once per number of bodies / colours
  useEffect(() => {
    if (!ok || !mount.current) return;
    const el = mount.current;
    const w = el.clientWidth || 320;
    const h = props.height ?? 360;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071216');
    scene.fog = new THREE.Fog('#071216', 4, 9);
    const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
    camera.position.set(0, 1.05, 3.9 + (n - 1) * 1.0);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.9, 0);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.minPolarAngle = Math.PI * 0.3;
    controls.maxPolarAngle = Math.PI * 0.58;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.3, 0.25);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const grid = new THREE.PolarGridHelper(2.2, 16, 8, 96, 0x1f5866, 0x123642);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    scene.add(grid);

    const xs = props.bodies.map((_, i) => (n === 1 ? 0 : ((n - 1) / 2 - i) * 0.8)); // first body on the right (RTL timeline)
    const mats: THREE.ShaderMaterial[] = [];
    const beams: THREE.ShaderMaterial[] = [];
    const holders = props.bodies.map((b, i) => {
      const m = holoMaterial(b.color, '#' + new THREE.Color(b.color).lerp(new THREE.Color('#ffffff'), 0.3).getHexString(), 0.9, b.heightCm / 100);
      mats.push(m);
      const beamMat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(b.color) }, uTime: { value: 0 } }, vertexShader: vertex, fragmentShader: beamFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      beams.push(beamMat);
      scene.add(projector(b.color, xs[i], beamMat));
      const holder = new THREE.Group();
      holder.position.x = xs[i];
      scene.add(holder);
      return holder;
    });
    const ghostMat = holoMaterial('#ffb35c', '#ffd9a8', 0.8, 1.75);
    mats.push(ghostMat);
    const ghostHolder = new THREE.Group();
    const showGhost = props.ghost !== false && (n > 1 || !!props.compareTo);
    let ghostOf: BodyParams | undefined = props.compareTo;
    if (showGhost) {
      ghostHolder.position.x = xs[n - 1];
      scene.add(ghostHolder);
    }

    let current: BodyParams[] = props.bodies.map((b) => ({ ...b }));
    let from: BodyParams[] = current;
    let to: BodyParams[] = current;
    let t0 = 0;
    const MORPH = 900;
    let ghostBuilt = false;
    const rebuild = (params: BodyParams[]) => {
      holders.forEach((holder, i) => {
        holder.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
        holder.clear();
        holder.add(buildBody(params[i], mats[i]));
      });
      if (showGhost && !ghostBuilt) {
        ghostBuilt = true;
        ghostHolder.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
        ghostHolder.clear();
        const ghost = buildBody(ghostOf ?? params[0], ghostMat);
        ghost.scale.setScalar(1.004);
        ghostHolder.add(ghost);
      }
    };
    rebuild(current);
    api.current = {
      setGhost: (g) => {
        ghostOf = g;
        ghostBuilt = false;
        rebuild(current);
      },
      setBodies: (b) => {
        from = current;
        to = b.map((x) => ({ sex: x.sex, heightCm: x.heightCm, weightKg: x.weightKg, bodyFatPct: x.bodyFatPct }));
        t0 = performance.now();
      },
    };

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.9;
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const clock = new THREE.Clock();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const t = clock.getElapsedTime();
      const dt = clock.getDelta();
      if (to !== from) {
        const k = Math.min(1, (performance.now() - t0) / (reduce ? 1 : MORPH));
        const e = ease(k);
        current = to.map((p, i) => ({ ...p, weightKg: lerp(from[i]?.weightKg ?? p.weightKg, p.weightKg, e), bodyFatPct: lerp(from[i]?.bodyFatPct ?? p.bodyFatPct, p.bodyFatPct, e) }));
        rebuild(current);
        if (k >= 1) from = to;
      }
      mats.forEach((m) => (m.uniforms.uTime.value = reduce ? 0 : t));
      beams.forEach((m) => (m.uniforms.uTime.value = reduce ? 0 : t));
      if (!reduce)
        scene.traverse((o) => {
          if (o.userData.spin) o.rotation.z += o.userData.spin * 0.016;
          if (o.userData.particles) {
            const a = (o as THREE.Points).geometry.getAttribute('position') as THREE.BufferAttribute;
            for (let i = 0; i < a.count; i++) {
              let y = a.getY(i) + 0.004 + dt * 0;
              if (y > 2) y = 0;
              a.setY(i, y);
            }
            a.needsUpdate = true;
          }
        });
      controls.update();
      composer.render();
    };
    tick();
    const onResize = () => {
      const nw = el.clientWidth || w;
      renderer.setSize(nw, h);
      composer.setSize(nw, h);
      camera.aspect = nw / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', onResize);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      composer.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, n, colorsKey, props.height, props.ghost, !!props.compareTo]);

  // shape changes morph instead of rebuilding the scene
  const shapeKey = JSON.stringify(props.bodies.map((b) => [b.weightKg, b.bodyFatPct, b.heightCm, b.sex]));
  useEffect(() => {
    api.current?.setBodies(props.bodies);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKey]);

  const ghostKey = props.compareTo ? JSON.stringify([props.compareTo.weightKg, props.compareTo.bodyFatPct, props.compareTo.heightCm, props.compareTo.sex]) : '';
  useEffect(() => {
    if (ghostKey) api.current?.setGhost(props.compareTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostKey]);

  if (!ok) return <div className="avatar-fallback">התצוגה התלת־ממדית לא נתמכת במכשיר הזה. הנתונים מוצגים למטה.</div>;
  return (
    <div className="avatar-wrap">
      <div ref={mount} className="avatar-canvas" style={{ height: props.height ?? 360 }} aria-label={`תצוגה תלת־ממדית: ${props.bodies.map((b) => `${b.label} ${b.sub ?? ''}`).join(', ')}`} role="img" />
      <div className="avatar-labels">
        {props.bodies.map((b) => (
          <span key={b.label + b.color} style={{ color: b.color }}>
            <b>{b.label}</b>
            {b.sub && <small>{b.sub}</small>}
          </span>
        ))}
      </div>
      {(n > 1 || props.compareTo) && props.ghost !== false && (
        <div className="avatar-legend">
          <i className="legend-swatch" aria-hidden="true" /> קו המתאר הכתום = הגוף שלך היום
        </div>
      )}
    </div>
  );
}
