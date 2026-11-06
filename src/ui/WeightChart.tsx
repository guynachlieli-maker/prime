import { fmt } from './kit';

export interface ChartPoint {
  date: string;
  kg: number;
  trend: number;
}
export interface ForecastBand {
  date: string;
  mid: number;
  low: number;
  high: number;
}

/** Weight chart: daily weigh-ins as faint dots, the trend as the main line, the forecast as a dashed line in a band. */
export function WeightChart({ points, forecast }: { points: ChartPoint[]; forecast: ForecastBand[] }) {
  const W = 400;
  const H = 220;
  const padL = 34;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const all = [...points.map((p) => p.date), ...forecast.map((f) => f.date)];
  if (all.length < 2) return <p className="muted">צריך לפחות שתי שקילות כדי להציג גרף.</p>;
  const t = (d: string) => Date.parse(d + 'T00:00:00Z');
  const t0 = Math.min(...all.map(t));
  const t1 = Math.max(...all.map(t));
  const vals = [...points.flatMap((p) => [p.kg, p.trend]), ...forecast.flatMap((f) => [f.low, f.high])];
  let lo = Math.floor(Math.min(...vals) - 0.5);
  let hi = Math.ceil(Math.max(...vals) + 0.5);
  if (hi - lo < 3) {
    lo -= 1;
    hi += 1;
  }
  const X = (d: string) => padL + ((t(d) - t0) / Math.max(1, t1 - t0)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const step = Math.max(1, Math.round((hi - lo) / 4));
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const line = (arr: { d: string; v: number }[]) => arr.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)} ${Y(p.v).toFixed(1)}`).join('');
  const band =
    forecast.length > 1
      ? line(forecast.map((f) => ({ d: f.date, v: f.high }))) + forecast.slice().reverse().map((f) => `L${X(f.date).toFixed(1)} ${Y(f.low).toFixed(1)}`).join('') + 'Z'
      : '';
  const months = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
  const label = (d: string) => `${Number(d.slice(8))} ${months.at(Number(d.slice(5, 7)) - 1)}`;
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`גרף משקל: מגמה נוכחית ${last ? fmt(last.trend, 1) : ''} ק"ג`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" />
          <text x={padL - 8} y={Y(v) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
            {v}
          </text>
        </g>
      ))}
      <text x={padL} y={H - 8} fontSize="12" fill="var(--muted)" textAnchor="start">
        {label(all.reduce((a, b) => (a < b ? a : b)))}
      </text>
      <text x={W - padR} y={H - 8} fontSize="12" fill="var(--muted)" textAnchor="end">
        {label(all.reduce((a, b) => (a > b ? a : b)))}
      </text>
      {band && <path d={band} fill="var(--accent2)" opacity="0.14" />}
      {forecast.length > 1 && <path d={line(forecast.map((f) => ({ d: f.date, v: f.mid })))} fill="none" stroke="var(--accent2)" strokeWidth="2" strokeDasharray="5 5" />}
      {points.map((p) => (
        <circle key={p.date} cx={X(p.date)} cy={Y(p.kg)} r="3" fill="var(--muted)" opacity="0.45" />
      ))}
      {points.length > 1 && <path d={line(points.map((p) => ({ d: p.date, v: p.trend })))} fill="none" stroke="var(--accent)" strokeWidth="2.5" />}
      {last && <circle cx={X(last.date)} cy={Y(last.trend)} r="5" fill="var(--accent)" />}
    </svg>
  );
}
