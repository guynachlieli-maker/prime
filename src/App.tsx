import { Suspense, lazy, useEffect, useState } from 'react';
import { onNav, pushNav, replaceNav } from './ui/nav';
import { WhyProvider } from './ui/kit';
import { Tour, MAIN_TOUR } from './ui/Tour';
import { recomputeTargets, setState, useStore } from './state/store';
import { Today } from './screens/Today';
import { Menu } from './screens/Menu';

// The first screen loads at once; the rest arrive in the background and are ready before the first tap.
const load = {
  onboarding: () => import('./screens/Onboarding'),
  camera: () => import('./screens/Capture'),
  progress: () => import('./screens/Progress'),
  programs: () => import('./screens/Programs'),
  training: () => import('./screens/Training'),
  profile: () => import('./screens/Profile'),
  devices: () => import('./screens/Devices'),
  reminders: () => import('./screens/Reminders'),
};
const Onboarding = lazy(() => load.onboarding().then((m) => ({ default: m.Onboarding })));
const Capture = lazy(() => load.camera().then((m) => ({ default: m.Capture })));
const Progress = lazy(() => load.progress().then((m) => ({ default: m.Progress })));
const Programs = lazy(() => load.programs().then((m) => ({ default: m.Programs })));
const Training = lazy(() => load.training().then((m) => ({ default: m.Training })));
const Profile = lazy(() => load.profile().then((m) => ({ default: m.Profile })));
const Devices = lazy(() => load.devices().then((m) => ({ default: m.Devices })));
const Reminders = lazy(() => load.reminders().then((m) => ({ default: m.Reminders })));

function Loading() {
  return (
    <div className="screen loading-screen" aria-busy="true" aria-label="טוען">
      <div className="skeleton tall" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
import { onToast, startReminders } from './state/notify';
import { restoreMyProducts } from './engine/barcode';

restoreMyProducts();

export type Tab = 'today' | 'menu' | 'camera' | 'training' | 'progress' | 'programs' | 'profile' | 'devices' | 'reminders';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'היום', icon: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z' },
  { id: 'menu', label: 'תפריט', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'camera', label: 'מצלמה', icon: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z' },
  { id: 'training', label: 'אימון', icon: 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12' },
  { id: 'progress', label: 'התקדמות', icon: 'M4 19l5-6 4 3 7-9' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function App() {
  const done = useStore((s) => s.onboardingDone && !!s.profile);
  const tourDone = useStore((s) => s.tourDone);
  const theme = useStore((s) => s.settings.theme);
  const photo = useStore((s) => s.profilePhoto);
  const name = useStore((s) => s.profile?.name);
  const [tab, setTab] = useState<Tab>('today');
  const [tour, setTour] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const missingTargets = useStore((s) => !!s.profile && !s.targets);
  useEffect(() => {
    if (missingTargets) recomputeTargets(); // repairs saved data that has a profile but no targets
  }, [missingTargets]);

  useEffect(() => {
    if (!done) return;
    const stop = startReminders();
    const off = onToast((t) => setToast(t));
    return () => {
      stop();
      off();
    };
  }, [done]);

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (done && !tourDone) {
      setTab('today');
      const t = setTimeout(() => setTour(true), 400);
      return () => clearTimeout(t);
    }
  }, [done, tourDone]);

  const go = (t: Tab) => {
    if (t !== tab) pushNav({ tab: t, sheet: undefined });
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  // back button: previous tab
  useEffect(() => {
    replaceNav({ tab: 'today' });
    return onNav((st) => {
      setTab((st.tab as Tab) ?? 'today');
      window.scrollTo({ top: 0 });
    });
  }, []);

  // fetch the other screens while the first one is on screen
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 600));
    idle(() => {
      const order: (() => Promise<unknown>)[] = done ? [load.camera, load.training, load.progress, load.profile, load.programs, load.reminders, load.devices] : [load.onboarding];
      void order.reduce<Promise<void>>((p, f) => p.then(() => f()).then(() => undefined, () => undefined), Promise.resolve());
    });
  }, [done]);

  if (!done)
    return (
      <WhyProvider>
        <main className="app">
          <Suspense fallback={<Loading />}>
            <Onboarding />
          </Suspense>
        </main>
      </WhyProvider>
    );

  return (
    <WhyProvider>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="logo-mark">P</span> PRIME
          </div>
          <button className={`avatar-btn ${tab === 'profile' ? 'on' : ''}`} onClick={() => go('profile')} aria-label="פרופיל והגדרות">
            {photo ? <img src={photo} alt="" /> : name ? <span>{name.trim()[0]}</span> : <Icon d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" />}
          </button>
        </header>
        <main key={tab} className="view">
          <Suspense fallback={<Loading />}>
          {tab === 'today' && <Today go={go} />}
          {tab === 'menu' && <Menu go={go} />}
          {tab === 'camera' && <Capture go={go} />}
          {tab === 'progress' && <Progress />}
          {tab === 'programs' && <Programs />}
          {tab === 'training' && <Training />}
          {tab === 'profile' && (
            <Profile
              go={go}
              replayTour={() => {
                go('today');
                setTimeout(() => setTour(true), 300);
              }}
            />
          )}
          {tab === 'devices' && <Devices back={() => go('profile')} />}
          {tab === 'reminders' && <Reminders back={() => go('profile')} />}
          </Suspense>
        </main>
        <nav className="tabbar" aria-label="ניווט ראשי">
          {TABS.map((t) => (
            <button key={t.id} className={`tab tab-${t.id} ${tab === t.id ? 'on' : ''} ${t.id === 'camera' ? 'cam' : ''}`} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <span className="tab-icon">
                <Icon d={t.icon} />
              </span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
        {toast && (
          <div className="toast-note" role="status">
            <span aria-hidden="true">🔔</span>
            <div className="grow">
              <b>{toast.title}</b>
              {toast.body && <div className="muted">{toast.body}</div>}
            </div>
            <button className="link" onClick={() => setToast(null)} aria-label="סגירה">
              ✕
            </button>
          </div>
        )}
        {tour && (
          <Tour
            steps={MAIN_TOUR}
            onDone={() => {
              setTour(false);
              setState({ tourDone: true });
            }}
            onFinishAction={() => go('camera')}
          />
        )}
      </div>
    </WhyProvider>
  );
}
