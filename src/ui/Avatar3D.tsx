import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Sex } from '../engine/types';

export interface BodyParams {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number;
}

/** Shape coefficients derived from height, weight and body fat. Exported for tests and for the data overlay. */
export function bodyShape(p: BodyParams) {
  const H = p.heightCm / 100;
  const bmi = p.weightKg / (H * H);
  const lean = p.weightKg * (1 - p.bodyFatPct / 100);
  const ffmi = lean / (H * H);
  const male = p.sex === 'male';
  const refBf = male ? 15 : 25;
  const refFfmi = male ? 19 : 15.5;
  const girth = Math.pow(bmi / 22, 0.45);
  const fat = (p.bodyFatPct - refBf) / 100;
  const muscle = 1 + (ffmi - refFfmi) * 0.03;
  const s = H / 1.75;
  return {
    H,
    shoulder: (male ? 0.205 : 0.178) * s * girth * Math.max(0.9, muscle),
    chest: (male ? 0.165 : 0.155) * s * girth * (1 + fat * 0.6) * Math.max(0.92, muscle),
    waist: (male ? 0.138 : 0.122) * s * girth * (1 + fat * (male ? 2.4 : 1.6)),
    hip: (male ? 0.158 : 0.178) * s * girth * (1 + fat * (male ? 1.1 : 1.7)),
    thigh: (male ? 0.072 : 0.078) * s * girth * (1 + fat * 1.2) * Math.max(0.9, muscle),
    arm: (male ? 0.046 : 0.04) * s * girth * (1 + fat * 1.0) * Math.max(0.9, muscle),
  };
}

const vertex = `
varying vec3 vN; varying vec3 vView; varying float vY;
void main(){
  vec4 wp = modelMatrix * vec4(position,1.0);
  vY = wp.y;
  vN = normalize(normalMatrix * normal);
  vec4 mv = viewMatrix * wp;
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const fragment = `
uniform vec3 uColor; uniform float uTime; uniform float uOpacity;
varying vec3 vN; varying vec3 vView; varying float vY;
void main(){
  float fres = pow(1.0 - max(dot(vN, vView), 0.0), 2.2);
  float scan = 0.5 + 0.5 * sin(vY * 140.0 - uTime * 3.0);
  float sweep = smoothstep(0.06, 0.0, abs(fract(vY * 0.35 - uTime * 0.12) - 0.5) - 0.44);
  float a = (0.12 + fres * 0.85 + scan * 0.06 + sweep * 0.35) * uOpacity;
  gl_FragColor = vec4(uColor * (0.55 + fres * 0.9 + sweep * 0.6), a);
}`;

function holoMaterial(color: THREE.Color, opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uTime: { value: 0 }, uOpacity: { value: opacity } },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function buildBody(p: BodyParams, mat: THREE.Material): THREE.Group {
  const b = bodyShape(p);
  const H = b.H;
  const g = new THREE.Group();
  const prof: [number, number][] = [
    [0.001, 0.455],
    [b.hip * 0.82, 0.47],
    [b.hip, 0.52],
    [(b.hip + b.waist) / 2, 0.57],
    [b.waist, 0.615],
    [(b.waist + b.chest) / 2, 0.665],
    [b.chest, 0.72],
    [b.shoulder * 0.92, 0.79],
    [b.shoulder * 0.55, 0.815],
    [0.052 * (H / 1.75), 0.835],
    [0.001, 0.84],
  ];
  const torsoGeo = new THREE.LatheGeometry(
    prof.map(([r, y]) => new THREE.Vector2(r, y * H)),
    48,
  );
  const torso = new THREE.Mesh(torsoGeo, mat);
  torso.scale.z = 0.66 + Math.max(0, (p.bodyFatPct - (p.sex === 'male' ? 15 : 25)) / 100) * 0.9;
  g.add(torso);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * (H / 1.75), 0.055 * (H / 1.75), 0.06 * H, 24), mat);
  neck.position.y = 0.86 * H;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105 * (H / 1.75), 32, 24), mat);
  head.scale.set(0.86, 1.08, 0.95);
  head.position.y = 0.935 * H;
  g.add(head);

  const k = H / 1.75;
  const seg = (a: THREE.Vector3, c: THREE.Vector3, r1: number, r2: number) => {
    const len = a.distanceTo(c);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 28, 1, true), mat);
    m.position.copy(a).add(c).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize());
    g.add(m);
  };
  const joint = (at: THREE.Vector3, r: number, sy = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
    m.position.copy(at);
    m.scale.y = sy;
    g.add(m);
  };
  for (const side of [-1, 1]) {
    // legs
    const hipJ = new THREE.Vector3(side * b.hip * 0.5, 0.465 * H, 0);
    const knee = new THREE.Vector3(side * b.hip * 0.4, 0.27 * H, 0.005);
    const ankle = new THREE.Vector3(side * b.hip * 0.36, 0.045 * H, -0.005);
    seg(hipJ, knee, b.thigh, b.thigh * 0.58);
    joint(knee, b.thigh * 0.58);
    seg(knee, ankle, b.thigh * 0.62, b.thigh * 0.34);
    joint(ankle, b.thigh * 0.34);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.045 * k, 20, 12), mat);
    foot.scale.set(0.8, 0.45, 2.1);
    foot.position.set(ankle.x, 0.02 * H, 0.045 * k);
    g.add(foot);
    // arms
    const sh = new THREE.Vector3(side * (b.shoulder - b.arm * 0.2), 0.795 * H, 0);
    const elbow = new THREE.Vector3(side * (b.shoulder + b.arm * 0.55), 0.625 * H, -0.01);
    const wrist = new THREE.Vector3(side * (b.shoulder + b.arm * 0.75), 0.475 * H, 0.02);
    joint(sh, b.arm * 1.15);
    seg(sh, elbow, b.arm, b.arm * 0.78);
    joint(elbow, b.arm * 0.78);
    seg(elbow, wrist, b.arm * 0.8, b.arm * 0.52);
    joint(new THREE.Vector3(wrist.x, wrist.y - 0.04 * k, wrist.z), 0.038 * k, 1.5);
  }
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

export function Avatar3D(props: { bodies: (BodyParams & { label: string; color: string })[]; height?: number }) {
  const mount = useRef<HTMLDivElement>(null);
  const [ok] = useState(webglAvailable);
  const bodiesKey = JSON.stringify(props.bodies);

  useEffect(() => {
    if (!ok || !mount.current) return;
    const el = mount.current;
    const w = el.clientWidth || 320;
    const h = props.height ?? 360;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 50);
    const n = props.bodies.length;
    camera.position.set(0, 1.0, 3.6 + (n - 1) * 0.9);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.85, 0);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.minPolarAngle = Math.PI * 0.3;
    controls.maxPolarAngle = Math.PI * 0.6;

    const mats: THREE.ShaderMaterial[] = [];
    const root = new THREE.Group();
    props.bodies.forEach((bp, i) => {
      const m = holoMaterial(new THREE.Color(bp.color), 1);
      mats.push(m);
      const body = buildBody(bp, m);
      body.position.x = n === 1 ? 0 : ((n - 1) / 2 - i) * 0.75;
      root.add(body);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.24, 64), new THREE.MeshBasicMaterial({ color: bp.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(body.position.x, 0.002, 0);
      root.add(ring);
    });
    scene.add(root);
    const grid = new THREE.PolarGridHelper(1.6, 12, 6, 64, 0x3a6f80, 0x24434d);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);

    let raf = 0;
    const clock = new THREE.Clock();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    controls.autoRotate = !reduce;
    const tick = () => {
      const t = clock.getElapsedTime();
      mats.forEach((m) => (m.uniforms.uTime.value = reduce ? 0 : t));
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();
    const onResize = () => {
      const nw = el.clientWidth || w;
      renderer.setSize(nw, h);
      camera.aspect = nw / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, bodiesKey, props.height]);

  if (!ok) return <div className="avatar-fallback">התצוגה התלת־ממדית לא נתמכת במכשיר הזה. הנתונים מוצגים למטה.</div>;
  return (
    <div className="avatar-wrap">
      <div ref={mount} className="avatar-canvas" style={{ height: props.height ?? 360 }} aria-label="אבטאר תלת־ממדי של הגוף" role="img" />
      {props.bodies.length > 1 && (
        <div className="avatar-labels">
          {props.bodies.map((b) => (
            <span key={b.label} style={{ color: b.color }}>
              {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
