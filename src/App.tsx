import { useEffect, useState } from 'react';
import { WhyProvider } from './ui/kit';
import { Tour, MAIN_TOUR } from './ui/Tour';
import { setState, useStore } from './state/store';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { Menu } from './screens/Menu';
import { Capture } from './screens/Capture';
import { Progress } from './screens/Progress';
import { Programs } from './screens/Programs';
import { Profile } from './screens/Profile';
import { Pro } from './screens/Pro';

export type Tab = 'today' | 'menu' | 'camera' | 'progress' | 'programs' | 'profile' | 'pro';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'היום', icon: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z' },
  { id: 'menu', label: 'תפריט', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'camera', label: 'מצלמה', icon: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z' },
  { id: 'progress', label: 'התקדמות', icon: 'M4 19l5-6 4 3 7-9' },
  { id: 'programs', label: 'תכניות', icon: 'M5 4h11l3 3v13H5zM9 10h6M9 14h6' },
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
  const [tab, setTab] = useState<Tab>('today');
  const [tour, setTour] = useState(false);

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
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  if (!done)
    return (
      <WhyProvider>
        <main className="app">
          <Onboarding />
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
          <button className={`icon-btn ${tab === 'profile' ? 'on' : ''}`} onClick={() => go('profile')} aria-label="פרופיל והגדרות">
            <Icon d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" />
          </button>
        </header>
        <main>
          {tab === 'today' && <Today go={go} />}
          {tab === 'menu' && <Menu />}
          {tab === 'camera' && <Capture go={go} />}
          {tab === 'progress' && <Progress />}
          {tab === 'programs' && <Programs />}
          {tab === 'profile' && (
            <Profile
              go={go}
              replayTour={() => {
                go('today');
                setTimeout(() => setTour(true), 300);
              }}
            />
          )}
          {tab === 'pro' && <Pro back={() => go('profile')} />}
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
