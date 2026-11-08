import { useEffect, useState } from 'react';

/**
 * Exercise photos are packed inside the app (public/ex-img), so they show everywhere, including
 * embedded viewers that block external images. Packs load on demand and stay cached.
 */
let index: Promise<Record<string, number>> | null = null;
const packs = new Map<number, Promise<Record<string, string>>>();

function getIndex() {
  if (!index)
    index = fetch('./ex-img/index.json').then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).catch((e) => {
      index = null;
      throw e;
    });
  return index;
}

function getPack(n: number) {
  let p = packs.get(n);
  if (!p) {
    p = fetch(`./ex-img/pack-${n}.json`).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
    p.catch(() => packs.delete(n));
    packs.set(n, p);
  }
  return p;
}

/** path like "Barbell_Squat/0.jpg" */
export async function exerciseImage(path: string): Promise<string | null> {
  const id = path.split('/')[0];
  const n = (await getIndex())[id];
  if (n === undefined) return null;
  return (await getPack(n))[path] ?? null;
}

export function useExerciseImages(paths: string[]): (string | null)[] | null {
  const key = paths.join('|');
  const [urls, setUrls] = useState<(string | null)[] | null>(null);
  useEffect(() => {
    let live = true;
    setUrls(null);
    Promise.all(paths.map((p) => exerciseImage(p).catch(() => null))).then((u) => live && setUrls(u));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}
