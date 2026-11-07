import { useEffect, useMemo, useState } from 'react';
import { simulateJourney } from '../engine/forecast';
import { HoloFigure, figureWidths, lerpWidths } from './HoloFigure';
import { fmt } from './kit';
import type { Profile, Targets } from '../engine/types';

const DAY = 864e5;
const TODAY_COLOR = '#38bdf8'; // blue
const FUTURE_COLOR = '#34d399'; // green
const OUTLINE = '#ff9f43'; // orange, dashed
const EMPHASIS = 2.2;

/**
 * Today vs. a chosen point in time, side by side. Time is picked with buttons (and a play
 * button that steps through them). Each body has a large caption under it.
 */
export function BodyJourney({ profile, targets, startISO }: { profile: Profile; targets: Targets; height?: number; startISO?: string }) {
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
        maxWeeks: plan ? 104 : 26,
      }),
    [profile.sex, profile.age, profile.heightCm, profile.weightKg, profile.bodyFatPct, profile.strengthTraining, targets.tdee.value, targets.weeklyChangeKg.value, plan?.targetKg],
  );
  const last = path.length - 1;
  const marks = useMemo(() => journeyMarks(path), [path]);

  const [sel, setSel] = useState(marks.length - 1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => setSel(marks.length - 1), [marks.length]);

  // play: step through the time buttons
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setSel((i) => {
        if (i >= marks.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1300);
    return () => window.clearInterval(id);
  }, [playing, marks.length]);

  const start = path[0];
  const week = marks[Math.min(sel, marks.length - 1)]?.w ?? last;
  const pt = path[Math.min(week, last)] ?? start;
  const todayBody = { sex: profile.sex, heightCm: profile.heightCm, weightKg: start.weightKg, bodyFatPct: start.bodyFatPct };
  const todayW = useMemo(() => figureWidths(todayBody), [todayBody.weightKg, todayBody.bodyFatPct, todayBody.heightCm, todayBody.sex]); // eslint-disable-line react-hooks/exhaustive-deps
  const targetW = figureWidths({ ...todayBody, weightKg: pt.weightKg, bodyFatPct: pt.bodyFatPct }, todayBody, EMPHASIS);

  // animate the future body between selections
  const [shown, setShown] = useState(targetW);
  const key = `${pt.weightKg}|${pt.bodyFatPct}`;
  useEffect(() => {
    const from = shown;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(targetW);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setShown(lerpWidths(from, targetW, e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const flat = Math.abs(targets.weeklyChangeKg.value) < 0.05 || last === 0;
  const base = startISO ? Date.parse(startISO) : Date.now();
  const dateOf = (w: number) => new Date(base + w * 7 * DAY).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: w > 40 ? 'numeric' : undefined });
  const dKg = pt.weightKg - start.weightKg;
  const fatLost = (start.weightKg * start.bodyFatPct) / 100 - (pt.weightKg * pt.bodyFatPct) / 100;
  const losing = targets.weeklyChangeKg.value < 0;

  if (flat)
    return (
      <div className="journey">
        <div className="holo-stage single">
          <figure>
            <HoloFigure id="today" w={todayW} sex={profile.sex} color={TODAY_COLOR} />
            <figcaption>
              <b style={{ color: TODAY_COLOR }}>היום</b>
              <span>{fmt(start.weightKg, 1)} ק"ג</span>
            </figcaption>
          </figure>
        </div>
        <p className="fineprint">במטרה הנוכחית המשקל נשמר. הוסיפו משקל יעד בפרופיל כדי לראות את הדרך אליו.</p>
      </div>
    );

  return (
    <div className="journey">
      <div className="holo-stage" role="img" aria-label={`היום ${fmt(start.weightKg, 1)} ק"ג. בעוד ${week} שבועות בערך ${fmt(pt.weightKg, 1)} ק"ג.`}>
        <figure>
          <HoloFigure id="today" w={todayW} sex={profile.sex} color={TODAY_COLOR} />
          <figcaption>
            <b style={{ color: TODAY_COLOR }}>אתה היום</b>
            <span className="cap-kg">{fmt(start.weightKg, 1)} ק"ג</span>
            <small>{fmt(start.bodyFatPct, 0)}% שומן</small>
          </figcaption>
        </figure>
        <div className="holo-arrow" aria-hidden="true">←</div>
        <figure>
          <HoloFigure id="future" w={shown} sex={profile.sex} color={FUTURE_COLOR} outline={todayW} outlineColor={OUTLINE} />
          <figcaption>
            <b style={{ color: FUTURE_COLOR }}>אתה {marks[sel]?.label === 'ביעד' ? 'ביעד' : `בעוד ${marks[sel]?.label}`}</b>
            <span className="cap-kg">
              {fmt(pt.weightKg, 1)} ק"ג <em><bdi dir="ltr">{dKg > 0 ? '+' : ''}{fmt(dKg, 1)}</bdi></em>
            </span>
            <small>{dateOf(week)}</small>
          </figcaption>
        </figure>
      </div>

      <ul className="holo-legend">
        <li>
          <i style={{ background: TODAY_COLOR }} /> כחול: הגוף שלך היום
        </li>
        <li>
          <i style={{ background: FUTURE_COLOR }} /> ירוק: הגוף שלך בזמן שבחרת
        </li>
        <li>
          <i className="dash" style={{ borderColor: OUTLINE }} /> קו כתום מקווקו: איפה היית היום, כדי לראות כמה ירד
        </li>
      </ul>

      <div className="journey-times" role="group" aria-label="בחירת זמן">
        <button className="play" onClick={() => { if (sel >= marks.length - 1) setSel(0); setPlaying((p) => !p); }} aria-label={playing ? 'עצירה' : 'להציג את השינוי לאורך הזמן'}>
          {playing ? '❚❚' : '▶'}
        </button>
        {marks.map((m, i) => (
          <button key={m.w} className={`chip ${sel === i ? 'on' : ''}`} aria-pressed={sel === i} onClick={() => { setPlaying(false); setSel(i); }}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="journey-stats">
        <div>
          <span>{losing ? 'ירידה במשקל' : 'שינוי במשקל'}</span>
          <b dir="ltr">{dKg > 0 ? '+' : ''}{fmt(dKg, 1)} ק"ג</b>
        </div>
        <div>
          <span>{losing ? 'שומן שירד' : 'אחוז שומן'}</span>
          <b>{losing ? `${fmt(Math.max(0, fatLost), 1)} ק"ג` : `${fmt(pt.bodyFatPct, 1)}%`}</b>
        </div>
        <div>
          <span>מתי</span>
          <b>{week} שבועות</b>
        </div>
      </div>
      <p className="fineprint">
        המספרים הם תחזית לפי מודל מחקרי, בהנחה שתעמוד ביעד הקלורי. הדמות מדגישה את השינוי כדי שיהיה קל לראות אותו, וכל גוף מגיב קצת אחרת.
        {profile.bodyFatSource === 'estimate' && ' אחוז השומן ההתחלתי הוא הערכה.'}
      </p>
    </div>
  );
}

/** Today → two checkpoints → goal. Exported for tests. */
export function journeyMarks(path: { weightKg: number; reached: boolean }[]): { w: number; label: string }[] {
  const last = path.length - 1;
  const months = (w: number) => Math.round(w / 4.33);
  const label = (w: number) =>
    w === 1 ? 'שבוע' : w === 2 ? 'שבועיים' : w < 4 ? `${w} שבועות` : w === 4 ? 'חודש' : w < 8 ? `${w} שבועות` : months(w) === 2 ? 'חודשיים' : months(w) === 6 ? 'חצי שנה' : months(w) === 12 ? 'שנה' : `${months(w)} חודשים`;
  // two checkpoints between today and the goal, at one third and two thirds of the change in weight,
  // so every button shows a visibly different body whatever the goal date
  const total = Math.abs(path[last].weightKg - path[0].weightKg);
  const at = (f: number) => path.findIndex((p) => Math.abs(p.weightKg - path[0].weightKg) >= total * f);
  const snap = (w: number, lo: number, hi: number) => {
    const nice = [4, 8, 13, 17, 26, 39, 52].find((n) => Math.abs(n - w) <= Math.max(1, w * 0.12) && n > lo && n < hi);
    return nice ?? w;
  };
  let w1 = at(1 / 3);
  let w2 = at(2 / 3);
  if (w1 < 1) w1 = Math.max(1, Math.round(last / 3));
  if (w2 <= w1) w2 = Math.max(w1 + 1, Math.round((last * 2) / 3));
  w1 = snap(w1, 0, w2);
  w2 = snap(w2, w1, last);
  const steps = [w1, w2].filter((w, i, a) => w >= 1 && w < last && a.indexOf(w) === i);
  const m = steps.map((w) => ({ w, label: label(w) }));
  // labels must differ too (e.g. two "3 חודשים"): fall back to weeks
  if (m.length === 2 && m[0].label === m[1].label) m.forEach((x) => (x.label = `${x.w} שבועות`));
  m.push({ w: last, label: path[last]?.reached ? 'ביעד' : label(last) });
  return m;
}
