/**
 * Back-button support. Tabs and open sheets each add a history entry, so the phone's back button
 * (or gesture) closes the sheet or returns to the previous tab instead of leaving the app.
 * Everything is wrapped: where history is not available (some embedded viewers) the app works as before.
 */
type NavState = { tab?: string; sheet?: number };
const subs = new Set<(s: NavState) => void>();
let skip = 0;

if (typeof window !== 'undefined')
  window.addEventListener('popstate', (e) => {
    if (skip > 0) {
      skip--; // a back() the app made itself
      return;
    }
    const s = (e.state ?? {}) as NavState;
    [...subs].forEach((f) => f(s));
  });

export const navState = (): NavState => {
  try {
    return (history.state ?? {}) as NavState;
  } catch {
    return {};
  }
};

export function pushNav(patch: NavState) {
  try {
    history.pushState({ ...navState(), ...patch }, '');
  } catch {
    /* not available here */
  }
}

export function replaceNav(patch: NavState) {
  try {
    history.replaceState({ ...navState(), ...patch }, '');
  } catch {
    /* not available here */
  }
}

/** Steps back one entry without telling the subscribers (used when a sheet is closed from the screen). */
export function backQuietly() {
  try {
    skip++;
    history.back();
    // if no popstate arrives (nothing to go back to), do not swallow the next real one
    setTimeout(() => {
      if (skip > 0) skip--;
    }, 400);
  } catch {
    skip = Math.max(0, skip - 1);
  }
}

export function onNav(fn: (s: NavState) => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
