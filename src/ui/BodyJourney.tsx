import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar3D } from './LazyAvatar';
import { simulateJourney } from '../engine/forecast';
import { fmt } from './kit';
import type { Profile, Targets } from '../engine/types';

const DAY = 864e5;

/**
 * One hologram that walks from today's body to the target body. A slider (and a play button)
 * moves through the weeks; today's body stays as an orange outline so the change is obvious.
 */
export function BodyJourney({ profile, targets, height = 340, startISO }: { profile: Profile; targets: Targets; height?: number; startISO?: string }) {
  const plan = targets.goalPlan;
  const path = useMemo(
    () =>
      simulateJourney({
        sex: profile.sex,
        age: profile.age,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        bodyFatPct: profile.bodyFatPct ?? 25,
        tdee: targets.tdee.value,
        strengthTraining: profile.strengthTraining,
        weeklyKg: targets.weeklyChangeKg.value,
        targetKg: plan?.targetKg,
        maxWeeks: plan ? 104 : 24,
      }),
    [profile.sex, profile.age, profile.heightCm, profile.weightKg, profile.bodyFatPct, profile.strengthTraining, targets.tdee.value, targets.weeklyChangeKg.value, plan?.targetKg],
  );
  const last = path.length - 1;
  const [week, setWeek] = useState(last);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => setWeek(last), [last]);
  useEffect(() => {
    if (!playing) return;
    const stepMs = Math.max(60, Math.min(260, 4500 / Math.max(1, last)));
    timer.current = window.setInterval(() => {
      setWeek((w) => {
        if (w >= last) {
          setPlaying(false);
          return last;
        }
        return w + 1;
      });
    }, stepMs);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, last]);

  const flat = Math.abs(targets.weeklyChangeKg.value) < 0.05 || last === 0;
  const start = path[0];
  const pt = path[Math.min(week, last)];
  const base = startISO ? Date.parse(startISO) : Date.now();
  const dateOf = (w: number) => new Date(base + w * 7 * DAY).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: w > 40 ? 'numeric' : undefined });
  const fatNow = (start.weightKg * start.bodyFatPct) / 100;
  const fatThen = (pt.weightKg * pt.bodyFatPct) / 100;
  const dKg = pt.weightKg - start.weightKg;
  const losing = targets.weeklyChangeKg.value < 0;

  const marks = [
    { w: 0, label: 'היום' },
    { w: 4, label: 'חודש' },
    { w: 13, label: '3 חודשים' },
    { w: 26, label: 'חצי שנה' },
  ].filter((m) => m.w === 0 || m.w < last - 2);
  marks.push({ w: last, label: path[last].reached ? 'יעד' : `שבוע ${last}` });

  if (flat)
    return (
      <div className="journey">
        <Avatar3D height={height} bodies={[{ sex: profile.sex, heightCm: profile.heightCm, weightKg: start.weightKg, bodyFatPct: start.bodyFatPct, label: 'היום', color: '#4fd8ec' }]} />
        <p className="fineprint">במטרה הנוכחית המשקל נשמר. הוסיפו משקל יעד בפרופיל כדי לראות את הדרך אליו.</p>
      </div>
    );

  return (
    <div className="journey">
      <Avatar3D
        height={height}
        bodies={[
          { sex: profile.sex, heightCm: profile.heightCm, weightKg: start.weightKg, bodyFatPct: start.bodyFatPct, label: 'היום', sub: `${fmt(start.weightKg, 1)} ק"ג`, color: '#4fd8ec' },
          { sex: profile.sex, heightCm: profile.heightCm, weightKg: pt.weightKg, bodyFatPct: pt.bodyFatPct, label: week === 0 ? 'היום' : dateOf(week), sub: `${fmt(pt.weightKg, 1)} ק"ג`, color: '#7ef0b0' },
        ]}
      />
      <div className="journey-stats" aria-live="polite">
        <div>
          <span>משקל</span>
          <b>{fmt(pt.weightKg, 1)} ק"ג</b>
          {week > 0 && <small dir="ltr">{dKg > 0 ? '+' : ''}{fmt(dKg, 1)}</small>}
        </div>
        <div>
          <span>{losing ? 'שומן שירד' : 'אחוז שומן'}</span>
          <b>{losing ? `${fmt(Math.max(0, fatNow - fatThen), 1)} ק"ג` : `${fmt(pt.bodyFatPct, 1)}%`}</b>
          {losing && <small>{fmt(pt.bodyFatPct, 1)}% שומן</small>}
        </div>
        <div>
          <span>מתי</span>
          <b>{week === 0 ? 'היום' : dateOf(week)}</b>
          {week > 0 && <small>בעוד {week} שבועות</small>}
        </div>
      </div>
      <div className="journey-controls">
        <button
          className="play"
          onClick={() => {
            if (week >= last) setWeek(0);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? 'עצירה' : 'הצגת השינוי לאורך הזמן'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <input type="range" min={0} max={last} value={week} onChange={(e) => { setPlaying(false); setWeek(Number(e.target.value)); }} aria-label="שבוע בתחזית" />
      </div>
      <div className="journey-marks">
        {marks.map((m) => (
          <button key={m.w} className={`chip ${week === m.w ? 'on' : ''}`} aria-pressed={week === m.w} onClick={() => { setPlaying(false); setWeek(m.w); }}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="fineprint">
        התחזית מניחה שתעמוד ביעד הקלורי ותשקול את עצמך באופן קבוע. זו הערכה לפי מודל מחקרי, וכל גוף מגיב קצת אחרת. {profile.bodyFatSource === 'estimate' && 'אחוז השומן ההתחלתי הוא הערכה.'}
      </p>
    </div>
  );
}
