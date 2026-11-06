import type { Muscle } from './exercises';

/**
 * Front and back anatomical map. Primary muscles glow gold, secondary muscles are lighter gold,
 * the rest stay neutral, like the diagrams on gym machines.
 */
type Region = { m: Muscle; d: string };

const mirror = (d: string) =>
  d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(100 - Number(x)).toFixed(1)},${y}`);

const both = (m: Muscle, d: string): Region[] => [
  { m, d },
  { m, d: mirror(d) },
];

const FRONT: Region[] = [
  ...both('traps', 'M44,30 L38,36 L44,37 Z'),
  ...both('shoulders', 'M38,37 C30,37 27,43 27,50 C31,48 35,46 39,45 Z'),
  ...both('chest', 'M49,40 L40,41 C36,44 35,52 38,58 C43,60 48,59 49,56 Z'),
  ...both('biceps', 'M27,52 C25,58 25,66 27,72 L32,72 C34,66 34,58 33,51 Z'),
  ...both('forearms', 'M26,75 C24,84 23,92 23,100 L28,100 C30,92 32,84 32,75 Z'),
  { m: 'abdominals', d: 'M44,60 L56,60 L57,92 C54,96 46,96 43,92 Z' },
  ...both('abdominals', 'M43,60 L38,62 C37,72 37,84 40,94 L43,92 Z'),
  ...both('quadriceps', 'M39,104 C35,118 35,134 38,150 L46,150 C47,136 47,120 46,106 Z'),
  ...both('adductors', 'M46,106 L49,108 L49,132 C48,138 47,142 46,146 Z'),
  ...both('calves', 'M39,160 C37,172 38,184 40,196 L44,196 C45,184 45,172 44,160 Z'),
];

const BACK: Region[] = [
  { m: 'traps', d: 'M50,28 L38,37 L44,46 L50,58 L56,46 L62,37 Z' },
  ...both('shoulders', 'M38,37 C30,37 27,43 27,50 C31,48 35,46 39,45 Z'),
  ...both('triceps', 'M27,52 C25,58 25,66 27,72 L33,72 C34,66 34,58 33,51 Z'),
  ...both('forearms', 'M26,75 C24,84 23,92 23,100 L28,100 C30,92 32,84 32,75 Z'),
  ...both('lats', 'M40,47 C36,54 36,66 41,78 L48,74 L46,56 Z'),
  ...both('middle back', 'M46,47 L49,58 L49,72 L47,72 L45,56 Z'),
  { m: 'lower back', d: 'M44,76 L56,76 L57,92 L43,92 Z' },
  ...both('abductors', 'M38,94 C36,98 36,102 37,106 L40,104 L40,95 Z'),
  ...both('glutes', 'M40,94 C38,104 40,112 49,114 L49,94 Z'),
  ...both('hamstrings', 'M39,116 C37,128 37,140 39,152 L47,152 C48,140 48,128 48,116 Z'),
  ...both('calves', 'M38,158 C35,168 36,180 40,192 L46,192 C47,180 47,168 45,158 Z'),
];

// silhouette
const BODY =
  'M50,4 C56,4 59,9 59,15 C59,21 56,25 53,27 L54,30 C60,32 66,34 70,37 C74,40 74,46 74,52 C75,62 76,72 75,80 C77,88 78,96 78,104 L72,104 C71,96 70,88 68,80 C67,72 66,62 64,54 L63,60 C64,72 64,84 62,94 C64,106 64,120 62,134 C61,146 61,156 60,164 C61,176 60,188 58,198 L60,206 L52,206 L52,198 C52,186 52,174 52,162 L51,118 L49,118 L48,162 C48,174 48,186 48,198 L48,206 L40,206 L42,198 C40,188 39,176 40,164 C39,156 39,146 38,134 C36,120 36,106 38,94 C36,84 36,72 37,60 L36,54 C34,62 33,72 32,80 C30,88 29,96 28,104 L22,104 C22,96 23,88 25,80 C24,72 25,62 26,52 C26,46 26,40 30,37 C34,34 40,32 46,30 L47,27 C44,25 41,21 41,15 C41,9 44,4 50,4 Z';

export function MuscleMap({ primary, secondary = [], size = 'md' }: { primary: string[]; secondary?: string[]; size?: 'sm' | 'md' }) {
  const fill = (m: Muscle) => (primary.includes(m) ? 'var(--m-primary)' : secondary.includes(m) ? 'var(--m-secondary)' : 'var(--m-idle)');
  const view = (regions: Region[], label: string) => (
    <figure className="mm-view">
      <svg viewBox="0 0 100 210" role="img" aria-label={label}>
        <path d={BODY} className="mm-body" />
        {regions.map((r, i) => (
          <path key={i} d={r.d} fill={fill(r.m)} className={primary.includes(r.m) ? 'mm-on' : ''} />
        ))}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
  return (
    <div className={`muscle-map ${size}`}>
      {view(FRONT, 'מלפנים')}
      {view(BACK, 'מאחור')}
    </div>
  );
}
