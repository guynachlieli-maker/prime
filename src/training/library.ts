import type { Muscle } from './exercises';

/** The full exercise library (free-exercise-db, public domain), loaded on demand. */
export interface LibExercise {
  id: string;
  he: string;
  en: string;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: string;
  level: string;
  category: string;
  mechanic: string | null;
  force: string | null;
  steps: string[];
  images: string[];
}

export interface Library {
  exercises: LibExercise[];
  byId: Record<string, LibExercise>;
  muscles: Record<string, string>;
  equipment: Record<string, string>;
  categories: Record<string, string>;
  levels: Record<string, string>;
}

let lib: Library | null = null;
let loading: Promise<Library> | null = null;

type Row = [string, string, string, number, Muscle[], Muscle[], string | null, string, string, string | null, string | null, string[], string[]];

export function loadLibrary(): Promise<Library> {
  if (lib) return Promise.resolve(lib);
  if (loading) return loading;
  loading = fetch('./exercises.json')
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<{ exercises: Row[]; muscles: Record<string, string>; equipment: Record<string, string>; categories: Record<string, string>; levels: Record<string, string> }>;
    })
    .then((d) => {
      const exercises = d.exercises.map(([id, he, en, , primary, secondary, equipment, level, category, mechanic, force, steps, images]) => ({ id, he: he || en, en, primary, secondary, equipment: equipment ?? 'none', level, category, mechanic, force, steps, images }));
      lib = { exercises, byId: Object.fromEntries(exercises.map((e) => [e.id, e])), muscles: d.muscles, equipment: d.equipment, categories: d.categories, levels: d.levels };
      return lib;
    })
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

const norm = (s: string) => s.toLowerCase().replace(/[׳'"״\-_(),]/g, ' ').replace(/\s+/g, ' ').trim();

export function searchLibrary(l: Library, q: string, f: { muscle?: string; equipment?: string; category?: string } = {}): LibExercise[] {
  const n = norm(q);
  const words = n.split(' ').filter(Boolean);
  return l.exercises.filter((e) => {
    if (f.muscle && !e.primary.includes(f.muscle as Muscle)) return false;
    if (f.equipment && e.equipment !== f.equipment) return false;
    if (f.category && e.category !== f.category) return false;
    if (!words.length) return true;
    const hay = norm(e.he + ' ' + e.en + ' ' + e.primary.map((m) => l.muscles[m]).join(' '));
    return words.every((w) => hay.includes(w));
  });
}
