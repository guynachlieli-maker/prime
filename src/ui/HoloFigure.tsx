import { bodyShape, type BodyParams } from '../engine/bodyshape';

/**
 * Lightweight 2D "hologram" body (SVG). Renders instantly on every phone, no WebGL.
 * Widths come from bodyShape(); `emphasis` > 1 magnifies the difference from `reference`
 * so progress is easy to see (shown to the user as an illustration).
 */
type Shape = ReturnType<typeof bodyShape>;
const KEYS = ['shoulder', 'chest', 'waist', 'belly', 'hip', 'thigh', 'calf', 'arm', 'neck'] as const;
type W = Record<(typeof KEYS)[number], number>;

const U = 230; // svg units per metre at the reference height

/**
 * Widths for a body. With a reference (today) and an emphasis > 1, the difference from today is
 * magnified so progress is easy to see. `end` is the final body of the journey: the emphasis is scaled
 * down per measurement so that the end body never passes a lean floor. Every point in between keeps
 * its share of the change, so each step is visibly slimmer than the one before (no clamping plateau).
 */
export function figureWidths(p: BodyParams, reference?: BodyParams, emphasis = 1, end?: BodyParams): W {
  const norm = (sh: Shape): W => Object.fromEntries(KEYS.map((k) => [k, (sh[k] / (sh.H / 1.75)) * U])) as W;
  const a = norm(bodyShape(p));
  if (!reference || emphasis === 1) return a;
  const r = norm(bodyShape(reference));
  const e = norm(bodyShape(end ?? p));
  const lean = norm(bodyShape({ ...p, weightKg: 21 * (p.heightCm / 100) ** 2, bodyFatPct: p.sex === 'male' ? 12 : 21 }));
  return Object.fromEntries(
    KEYS.map((k) => {
      const endDelta = (e[k] - r[k]) * emphasis; // magnified change at the end of the journey
      let scale = emphasis;
      if (endDelta < 0) {
        // shrinking: the end may go down to the lean floor, or to its real width if that is thinner
        const room = r[k] - Math.min(lean[k], e[k]);
        if (-endDelta > room) scale = room / (r[k] - e[k] || 1);
      } else if (endDelta > 0) {
        const room = r[k] * 0.6;
        if (endDelta > room) scale = room / (e[k] - r[k] || 1);
      }
      return [k, r[k] + (a[k] - r[k]) * Math.max(1, scale)];
    }),
  ) as W;
}

export function lerpWidths(a: W, b: W, t: number): W {
  return Object.fromEntries(KEYS.map((k) => [k, a[k] + (b[k] - a[k]) * t])) as W;
}

/** Catmull-Rom through points -> smooth cubic path. */
function smooth(pts: [number, number][], closed = true): string {
  const n = pts.length;
  const p = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + (closed ? 'Z' : '');
}

export function bodyPaths(w: W, sex: BodyParams['sex']) {
  const cx = 100;
  const belly = Math.max(w.waist, w.belly * 0.92);
  const waist = sex === 'female' ? Math.min(w.waist, w.hip * 0.82) : w.waist;
  const legX = Math.max(w.thigh + 1, w.hip - w.thigh * 0.95);
  const knee = w.calf * 0.85;
  const ankle = w.calf * 0.5;
  const right: [number, number][] = [
    [w.neck * 0.72, 50],
    [w.neck * 0.78, 60],
    [w.shoulder * 0.72, 67],
    [w.shoulder * 0.97, 74],
    [w.shoulder, 88],
    [w.chest, 104],
    [waist, 148],
    [belly, 170],
    [w.hip, 200],
    [legX + w.thigh, 228],
    [legX + knee + 1, 300],
    [legX + w.calf, 326],
    [legX + ankle, 384],
    [legX + ankle + 3, 394],
    [legX - ankle, 394],
    [legX - ankle * 0.9, 384],
    [legX - w.calf * 0.8, 326],
    [legX - knee * 0.8, 300],
    [Math.max(2, legX - w.thigh * 0.85), 236],
    [2, 214],
  ];
  const left = right.map(([x, y]) => [-x, y] as [number, number]).reverse();
  const body = smooth([...right, ...left].map(([x, y]) => [cx + x, y]));
  const armX = Math.max(w.chest, belly, waist) + w.arm * 0.9 + 3;
  const arm = (dir: 1 | -1) =>
    smooth(
      [
        [cx + dir * (w.shoulder + w.arm * 0.2), 76],
        [cx + dir * (armX + w.arm * 0.95), 110],
        [cx + dir * (armX + w.arm * 0.8), 160],
        [cx + dir * (armX + w.arm * 0.55), 212],
        [cx + dir * (armX + w.arm * 0.2), 230],
        [cx + dir * (armX - w.arm * 0.35), 228],
        [cx + dir * (armX - w.arm * 0.45), 210],
        [cx + dir * (armX - w.arm * 0.7), 160],
        [cx + dir * (armX - w.arm * 0.9), 118],
        [cx + dir * (w.shoulder - w.arm * 0.2), 100],
      ],
      true,
    );
  return { body, arms: [arm(1), arm(-1)] };
}

export function HoloFigure({ w, sex, color, outline, outlineColor = '#ff9f43', id }: { w: W; sex: BodyParams['sex']; color: string; outline?: W; outlineColor?: string; id: string }) {
  const p = bodyPaths(w, sex);
  const o = outline ? bodyPaths(outline, sex) : null;
  return (
    <svg viewBox="0 0 200 420" className="holo-fig" aria-hidden="true">
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor={color} stopOpacity="0.18" />
        </linearGradient>
        <pattern id={`s-${id}`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.2" fill={color} opacity="0.35" />
        </pattern>
        <filter id={`f-${id}`} x="-30%" y="-10%" width="160%" height="120%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse cx="100" cy="402" rx="62" ry="10" fill={color} opacity="0.18" />
      <ellipse cx="100" cy="402" rx="44" ry="6" fill="none" stroke={color} strokeOpacity="0.6" />
      <g filter={`url(#f-${id})`}>
        <circle cx="100" cy="30" r="21" fill={`url(#g-${id})`} stroke={color} strokeWidth="1.6" />
        {[p.body, ...p.arms].map((d, i) => (
          <g key={i}>
            <path d={d} fill={`url(#g-${id})`} stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
            <path d={d} fill={`url(#s-${id})`} />
          </g>
        ))}
      </g>
      {o && (
        <g fill="none" stroke={outlineColor} strokeWidth="2" strokeDasharray="5 4" opacity="0.95">
          {[o.body, ...o.arms].map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      )}
    </svg>
  );
}
