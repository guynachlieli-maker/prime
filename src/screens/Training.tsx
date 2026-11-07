import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner, Button, Card, ChoiceCards, Segmented, Sheet, WhyContent, fmt } from '../ui/kit';
import { saveProfile, todayISO, useStore } from '../state/store';
import { CORE_BY_ID, CORE_BY_REF, IMG_BASE, MUSCLE_HE, type Limit } from '../training/exercises';
import { MuscleMap } from '../training/MuscleMap';
import { CARDIO, GOAL_LABEL, e1rm, kcalForCardio, planWeek, suggestNext, weeklyVolume, type CardioType, type ExerciseLog, type PlannedExercise, type TrainingPrefs, type WorkoutDay } from '../training/plan';
import { createPlan, currentPhase, saveSession, EMPTY_TRAINING } from '../training/state';
import { loadLibrary, searchLibrary, type LibExercise, type Library } from '../training/library';
import { TRAINING_ARTICLES } from '../training/articles';
import type { Article } from '../data/articles';
import { planFor } from '../state/derived';
import { RECIPES } from '../data/recipes';

export const WEEKDAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
type View = 'plan' | 'library' | 'progress' | 'learn';

const repsText = (e: PlannedExercise) => (e.unit === 'sec' ? `${e.reps[0]}-${e.reps[1]} שניות` : `${e.reps[0]}-${e.reps[1]} חזרות`);

export function Training() {
  const s = useStore((x) => x);
  const t = s.training ?? EMPTY_TRAINING;
  const [view, setView] = useState<View>('plan');
  const [editing, setEditing] = useState(false);
  const [openDay, setOpenDay] = useState<WorkoutDay | null>(null);
  const [session, setSession] = useState<WorkoutDay | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  if (session) return <SessionView day={session} onClose={() => setSession(null)} onInfo={setDetail} detail={detail} closeDetail={() => setDetail(null)} />;

  return (
    <div className="screen training">
      <header className="screen-head">
        <span className="eyebrow">המאמן האישי</span>
        <h1 className="display">אימון</h1>
      </header>
      {!t.plan || editing ? (
        <Setup initial={t.plan?.prefs} onDone={() => setEditing(false)} onCancel={t.plan ? () => setEditing(false) : undefined} />
      ) : (
        <>
          <Segmented
            label="אזור באימון"
            value={view}
            onChange={setView}
            options={[
              { value: 'plan', label: 'התוכנית' },
              { value: 'library', label: 'תרגילים' },
              { value: 'progress', label: 'התקדמות' },
              { value: 'learn', label: 'מאמרים' },
            ]}
          />
          {view === 'plan' && <PlanView onOpen={setOpenDay} onStart={setSession} onEdit={() => setEditing(true)} />}
          {view === 'library' && <LibraryView onOpen={setDetail} />}
          {view === 'progress' && <TrainingProgress />}
          {view === 'learn' && <Learn />}
        </>
      )}

      <Sheet open={!!openDay} onClose={() => setOpenDay(null)} title={openDay ? `${openDay.title} · יום ${WEEKDAY[openDay.weekday]}` : ''}>
        {openDay && (
          <DayDetail
            day={openDay}
            onInfo={setDetail}
            onStart={() => {
              setSession(openDay);
              setOpenDay(null);
            }}
          />
        )}
      </Sheet>
      <ExerciseSheet id={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/* ---------------- setup ---------------- */

const DEFAULT: TrainingPrefs = { goal: 'muscle', days: 3, minutes: 60, cardio: 'balanced', cardioTypes: ['walk', 'bike'], equipment: 'gym', level: 'beginner', limits: [], time: '18:00' };

function Setup({ initial, onDone, onCancel }: { initial?: TrainingPrefs; onDone: () => void; onCancel?: () => void }) {
  const profile = useStore((x) => x.profile);
  const guess: TrainingPrefs = {
    ...DEFAULT,
    goal: profile?.goal === 'fat_loss' ? 'cut' : profile?.goal === 'bulk' ? 'bulk' : profile?.goal === 'muscle_gain' ? 'muscle' : profile?.goal === 'recomp' ? 'recomp' : profile?.goal === 'performance' ? 'strength' : DEFAULT.goal,
    days: Math.min(6, Math.max(2, profile?.trainingDaysPerWeek ?? 3)),
  };
  const [p, setP] = useState<TrainingPrefs>(initial ?? guess);
  const up = (x: Partial<TrainingPrefs>) => setP((o) => ({ ...o, ...x }));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <div className="setup">
      <p className="lead">כמה שאלות, ונבנה לך תוכנית אימונים לחדר הכושר ולאירובי, לפי המטרה, הזמן והציוד שיש לך.</p>
      <Card title="מה המטרה?">
        <ChoiceCards
          value={p.goal}
          onChange={(goal) => up({ goal })}
          options={[
            { value: 'cut', label: 'חיטוב', desc: 'להוריד שומן ולשמור על השריר', icon: '↓' },
            { value: 'muscle', label: 'הגדלת שריר', desc: 'מסה נקייה, עודף קטן', icon: '↑' },
            { value: 'bulk', label: 'מסה', desc: 'לבנות מהר, ואחר כך חיטוב קצר', icon: '⇈' },
            { value: 'strength', label: 'כוח', desc: 'להרים יותר בתרגילים הגדולים', icon: '◆' },
            { value: 'recomp', label: 'ריקומפוזיציה', desc: 'שריר ופחות שומן במקביל', icon: '⇄' },
            { value: 'endurance', label: 'סיבולת ואירובי', desc: 'כושר לב־ריאה, ריצה, רכיבה', icon: '∿' },
            { value: 'health', label: 'כושר ובריאות', desc: 'להרגיש טוב ולהישאר פעיל', icon: '♥' },
          ]}
        />
      </Card>
      <Card title="כמה זמן יש לך?">
        <Segmented label="אימוני כוח בשבוע" value={String(p.days) as '3'} onChange={(v) => up({ days: Number(v) })} options={['2', '3', '4', '5', '6'].map((v) => ({ value: v as '3', label: `${v} בשבוע` }))} />
        <Segmented label="משך אימון" value={String(p.minutes) as '60'} onChange={(v) => up({ minutes: Number(v) })} options={['30', '45', '60', '75', '90'].map((v) => ({ value: v as '60', label: `${v} דק׳` }))} />
        <label className="field">
          <span className="field-label">שעה רגילה לאימון (לתזכורת)</span>
          <span className="field-input">
            <input type="time" value={p.time} onChange={(e) => e.target.value && up({ time: e.target.value })} />
          </span>
        </label>
      </Card>
      <Card title="אירובי">
        <Segmented
          label="כמה אירובי"
          value={p.cardio}
          onChange={(cardio) => up({ cardio })}
          options={[
            { value: 'little', label: 'מעט' },
            { value: 'balanced', label: 'מאוזן' },
            { value: 'lots', label: 'הרבה' },
          ]}
        />
        <p className="fineprint">איזה אירובי אתה אוהב?</p>
        <div className="chips">
          {(Object.keys(CARDIO) as CardioType[]).map((c) => {
            const on = p.cardioTypes.includes(c);
            return (
              <button key={c} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => up({ cardioTypes: toggle(p.cardioTypes, c).length ? toggle(p.cardioTypes, c) : p.cardioTypes })}>
                {CARDIO[c].name}
              </button>
            );
          })}
        </div>
      </Card>
      <Card title="איפה מתאמנים?">
        <ChoiceCards
          value={p.equipment}
          onChange={(equipment) => up({ equipment })}
          options={[
            { value: 'gym', label: 'חדר כושר', desc: 'מוטות, מכונות וכבלים' },
            { value: 'home_db', label: 'בבית עם משקולות', desc: 'משקולות יד וספסל' },
            { value: 'bands', label: 'בבית עם גומיות', desc: 'גומיות התנגדות' },
            { value: 'bodyweight', label: 'בלי ציוד', desc: 'משקל גוף בלבד' },
          ]}
        />
        <Segmented
          label="ניסיון"
          value={p.level}
          onChange={(level) => up({ level })}
          options={[
            { value: 'beginner', label: 'מתחיל' },
            { value: 'intermediate', label: 'בינוני (שנה+)' },
            { value: 'advanced', label: 'מתקדם (3 שנים+)' },
          ]}
        />
        <p className="fineprint">יש אזור שכואב או רגיש? נוציא תרגילים שמעמיסים עליו.</p>
        <div className="chips">
          {([['knee', 'ברכיים'], ['back', 'גב תחתון'], ['shoulder', 'כתפיים']] as [Limit, string][]).map(([v, l]) => {
            const on = p.limits.includes(v);
            return (
              <button key={v} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => up({ limits: toggle(p.limits, v) })}>
                {l}
              </button>
            );
          })}
        </div>
      </Card>
      {(profile?.screening && Object.entries(profile.screening).some(([k, v]) => k.startsWith('parq') && v)) && (
        <Banner kind="warn">לפי שאלון ההתאמה, לפני תחילת אימונים מומלץ לקבל אישור רופא.</Banner>
      )}
      <div className="row wrap">
        <Button
          full
          onClick={() => {
            createPlan(p);
            onDone();
          }}
        >
          {initial ? 'עדכון התוכנית' : 'בניית התוכנית'}
        </Button>
        {onCancel && (
          <Button kind="ghost" onClick={onCancel}>
            ביטול
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------- plan ---------------- */

function PlanView({ onOpen, onStart, onEdit }: { onOpen: (d: WorkoutDay) => void; onStart: (d: WorkoutDay) => void; onEdit: () => void }) {
  const s = useStore((x) => x);
  const t = s.training ?? EMPTY_TRAINING;
  const plan = t.plan!;
  const { week, deload } = planWeek(plan);
  const today = new Date().getDay();
  const doneToday = t.sessions.filter((x) => x.date === todayISO()).map((x) => x.dayId);
  const todayDay = plan.days.find((d) => d.weekday === today && !doneToday.includes(d.id));
  const nextDay = todayDay ?? [...plan.days].sort((a, b) => ((a.weekday - today + 7) % 7) - ((b.weekday - today + 7) % 7)).find((d) => d.weekday !== today) ?? plan.days[0];
  const ph = currentPhase(t);
  const nutritionGoal = ph?.phase.nutritionGoal;
  const goalLabel: Record<string, string> = { fat_loss: 'ירידה בשומן', muscle_gain: 'בניית שריר', bulk: 'מסה', performance: 'תחזוקה' };
  const vol = weeklyVolume(plan);
  const weekCardio = plan.days.reduce((a, d) => a + (d.cardio?.minutes ?? 0), 0) + plan.cardioDays.reduce((a, c) => a + c.block.minutes, 0);

  return (
    <>
      <section className="hero-card">
        <div className="hero-top">
          <span className="eyebrow">{GOAL_LABEL[plan.prefs.goal]}</span>
          <span className="pill">{deload ? `שבוע ${week} · שבוע קל` : `שבוע ${week}`}</span>
        </div>
        <h2 className="hero-title">{todayDay ? 'האימון של היום' : 'האימון הבא'}</h2>
        <div className="hero-main">
          <div>
            <strong className="hero-name">{nextDay.title}</strong>
            <span className="muted">
              {todayDay ? 'היום' : `יום ${WEEKDAY[nextDay.weekday]}`} · {nextDay.exercises.length} תרגילים · כ-{nextDay.estMinutes} דק׳
            </span>
          </div>
          <MuscleMap size="sm" primary={[...new Set(nextDay.exercises.flatMap((e) => CORE_BY_ID[e.exId]?.primary ?? []))]} secondary={[...new Set(nextDay.exercises.flatMap((e) => CORE_BY_ID[e.exId]?.secondary ?? []))]} />
        </div>
        <div className="row wrap">
          <Button onClick={() => onStart(nextDay)}>להתחיל אימון</Button>
          <Button kind="secondary" onClick={() => onOpen(nextDay)}>
            לפרטים
          </Button>
        </div>
        {(() => {
          const date = todayISO();
          const meals = planFor(s, date)?.meals ?? [];
          const pre = meals.find((m) => m.role === 'pre');
          const post = meals.find((m) => m.role === 'post');
          if (!todayDay || (!pre && !post)) return null;
          const name = (id: string) => RECIPES.find((r) => r.id === id)?.name ?? '';
          return (
            <div className="fuel">
              {pre && (
                <span>
                  <b>לפני:</b> {name(pre.recipeId)} · {fmt(pre.nutrients.carbs)} ג׳ פחמימה
                </span>
              )}
              {post && (
                <span>
                  <b>אחרי:</b> {name(post.recipeId)} · {fmt(post.nutrients.protein)} ג׳ חלבון
                </span>
              )}
            </div>
          );
        })()}
        {deload && <p className="fineprint">שבוע קל: עושים בערך 60% מהסטים באותם משקלים. זה חלק מהתוכנית, לא ויתור.</p>}
      </section>

      <Card title="השבוע שלך" action={<button className="link" onClick={onEdit}>שינוי העדפות</button>}>
        <ol className="week-list">
          {[0, 1, 2, 3, 4, 5, 6].map((w) => {
            const d = plan.days.find((x) => x.weekday === w);
            const c = plan.cardioDays.find((x) => x.weekday === w);
            const isToday = w === today;
            return (
              <li key={w} className={`${isToday ? 'today' : ''} ${d ? 'lift' : c ? 'cardio' : 'rest'}`}>
                <span className="wd">{WEEKDAY[w]}</span>
                {d ? (
                  <button className="wl-main" onClick={() => onOpen(d)}>
                    <b>{d.title}</b>
                    <small>
                      {d.focus} · {d.estMinutes} דק׳{d.cardio ? ` · כולל ${d.cardio.minutes} דק׳ ${CARDIO[d.cardio.type].name}` : ''}
                    </small>
                    {doneToday.includes(d.id) && isToday && <span className="done-tag">✓ בוצע</span>}
                  </button>
                ) : c ? (
                  <span className="wl-main">
                    <b>{CARDIO[c.block.type].name}</b>
                    <small>
                      {c.block.minutes} דק׳ · {c.block.intensity === 'intervals' ? 'אינטרוולים' : c.block.intensity === 'easy' ? 'קל' : 'בינוני'} · כ-{kcalForCardio(c.block, s.profile?.weightKg ?? 75)} קק"ל
                    </small>
                  </span>
                ) : (
                  <span className="wl-main rest">
                    <b>מנוחה</b>
                    <small>הליכה קלה ומתיחות זה מצוין</small>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="fineprint">
          {plan.split}. {plan.splitWhy} אירובי: {weekCardio} דק׳ בשבוע.
        </p>
      </Card>

      {ph && t.phases && (
        <Card title="התוכנית ארוכת הטווח">
          <ol className="phases">
            {t.phases.map((x, i) => (
              <li key={i} className={i === ph.index ? 'on' : i < ph.index ? 'past' : ''}>
                <b>{x.title}</b>
                <small>{x.weeks} שבועות</small>
              </li>
            ))}
          </ol>
          <p className="muted">
            עכשיו: <b>{ph.phase.title}</b>, שבוע {ph.weekIn} מתוך {ph.phase.weeks}. {ph.phase.why}
          </p>
          {s.profile && nutritionGoal && s.profile.goal !== nutritionGoal && (
            <Banner
              kind="info"
              action={
                <Button kind="secondary" onClick={() => saveProfile({ ...s.profile!, goal: nutritionGoal, targetWeightKg: undefined, targetDate: undefined })}>
                  לעדכן תזונה
                </Button>
              }
            >
              היעד התזונתי שלך ({goalLabel[s.profile.goal] ?? s.profile.goal}) לא מתאים לשלב הנוכחי ({goalLabel[nutritionGoal]}).
            </Banner>
          )}
        </Card>
      )}

      <Card title="נפח שבועי לכל שריר">
        <div className="vol-bars">
          {(['chest', 'lats', 'middle back', 'shoulders', 'quadriceps', 'hamstrings', 'glutes', 'biceps', 'triceps', 'abdominals'] as const).map((m) => {
            const v = Math.round(vol[m] ?? 0);
            return (
              <div key={m} className="vol-row">
                <span>{MUSCLE_HE[m]}</span>
                <div className="vol-track" aria-hidden="true">
                  <i className="vol-band" />
                  <i className="vol-fill" style={{ width: `${Math.min(100, (v / 24) * 100)}%` }} />
                </div>
                <b>{v}</b>
              </div>
            );
          })}
        </div>
        <p className="fineprint">סטים בשבוע (תרגיל משני נספר כחצי). הפס הבהיר הוא הטווח שהמחקר ממליץ עליו לבניית שריר: 10-20.</p>
      </Card>

      {plan.notes.length > 0 && (
        <Card title="דגשים">
          <ul className="plain">
            {plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function DayDetail({ day, onInfo, onStart }: { day: WorkoutDay; onInfo: (id: string) => void; onStart: () => void }) {
  return (
    <>
      <MuscleMap primary={[...new Set(day.exercises.flatMap((e) => CORE_BY_ID[e.exId]?.primary ?? []))]} secondary={[...new Set(day.exercises.flatMap((e) => CORE_BY_ID[e.exId]?.secondary ?? []))]} />
      <ol className="ex-list">
        {day.exercises.map((e, i) => {
          const ex = CORE_BY_ID[e.exId];
          return (
            <li key={e.exId}>
              <span className="ex-n">{i + 1}</span>
              <button className="ex-main" onClick={() => onInfo(ex.ref)}>
                <b>{ex.name}</b>
                <small>
                  {e.sets} סטים × {repsText(e)} · מנוחה {e.restSec >= 120 ? `${e.restSec / 60} דק׳` : `${e.restSec} שנ׳`} · {e.rir} חזרות ברזרבה
                </small>
              </button>
            </li>
          );
        })}
      </ol>
      {day.cardio && (
        <p className="muted">
          ואחרי זה: {day.cardio.minutes} דק׳ {CARDIO[day.cardio.type].name}. {day.cardio.note}
        </p>
      )}
      <p className="fineprint">חימום לפני: 5 דקות אירובי קל, ו-1-2 סטים קלים בתרגיל הראשון.</p>
      <Button full onClick={onStart}>
        להתחיל אימון
      </Button>
    </>
  );
}

/* ---------------- live session ---------------- */

function SessionView({ day, onClose, onInfo, detail, closeDetail }: { day: WorkoutDay; onClose: () => void; onInfo: (id: string) => void; detail: string | null; closeDetail: () => void }) {
  const s = useStore((x) => x);
  const t = s.training ?? EMPTY_TRAINING;
  const plan = t.plan!;
  const { deload } = planWeek(plan);
  const [list, setList] = useState<PlannedExercise[]>(() => day.exercises.map((e) => ({ ...e, exId: t.swaps?.[e.exId] ?? e.exId, sets: deload ? Math.max(1, Math.round(e.sets * 0.6)) : e.sets })));
  const [logs, setLogs] = useState<ExerciseLog[]>(() =>
    list.map((e) => {
      const sug = suggestNext(e.exId, e, t.sessions);
      return { exId: e.exId, sets: Array.from({ length: e.sets }, () => ({ kg: sug.kg ?? 0, reps: e.reps[1], done: false })) };
    }),
  );
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [swap, setSwap] = useState<number | null>(null);
  const started = useRef(Date.now());
  const [cardioDone, setCardioDone] = useState(false);

  useEffect(() => {
    if (!rest) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= rest.until) {
        setRest(null);
        try {
          navigator.vibrate?.(200);
        } catch {
          /* ignore */
        }
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [rest]);

  const setField = (i: number, j: number, patch: Partial<ExerciseLog['sets'][number]>) =>
    setLogs((L) => L.map((l, a) => (a === i ? { ...l, sets: l.sets.map((x, b) => (b === j ? { ...x, ...patch } : x)) } : l)));
  const doneSets = logs.reduce((a, l) => a + l.sets.filter((x) => x.done).length, 0);
  const totalSets = logs.reduce((a, l) => a + l.sets.length, 0);

  return (
    <div className="screen session">
      <header className="session-head">
        <button className="link" onClick={onClose}>
          יציאה
        </button>
        <div>
          <span className="eyebrow">{deload ? 'שבוע קל' : `יום ${WEEKDAY[day.weekday]}`}</span>
          <h1 className="display sm">{day.title}</h1>
        </div>
        <span className="pill">
          {doneSets}/{totalSets}
        </span>
      </header>
      <div className="progress-line" aria-hidden="true">
        <i style={{ width: `${(doneSets / Math.max(1, totalSets)) * 100}%` }} />
      </div>

      {rest && (
        <div className="rest-timer" role="timer" aria-live="polite">
          <span>מנוחה</span>
          <b>{Math.max(0, Math.ceil((rest.until - now) / 1000))}</b>
          <span>שניות</span>
          <div className="rt-track">
            <i style={{ width: `${Math.max(0, ((rest.until - now) / 1000 / rest.total) * 100)}%` }} />
          </div>
          <button className="link" onClick={() => setRest(null)}>
            דילוג
          </button>
        </div>
      )}

      {list.map((e, i) => {
        const ex = CORE_BY_ID[e.exId];
        const sug = suggestNext(e.exId, e, t.sessions);
        return (
          <section key={e.exId + i} className="card ex-card">
            <div className="ex-head">
              <Thumb refId={ex.ref} alt={ex.name} />
              <div className="ex-title">
                <b>{ex.name}</b>
                <small>
                  {e.sets} × {repsText(e)} · {e.rir} ברזרבה
                </small>
              </div>
              <div className="ex-actions">
                <button className="icon-btn" aria-label={`הסבר על ${ex.name}`} onClick={() => onInfo(ex.ref)}>
                  ⓘ
                </button>
                {e.alternatives.length > 0 && (
                  <button className="icon-btn" aria-label={`החלפת ${ex.name}`} onClick={() => setSwap(swap === i ? null : i)}>
                    ⇄
                  </button>
                )}
              </div>
            </div>
            {swap === i && (
              <div className="chips">
                {e.alternatives.map((a) => (
                  <button
                    key={a}
                    className="chip"
                    onClick={() => {
                      setList((L) => L.map((x, k) => (k === i ? { ...x, exId: a } : x)));
                      setLogs((L) => L.map((x, k) => (k === i ? { exId: a, sets: x.sets.map((y) => ({ ...y, kg: 0, done: false })) } : x)));
                      setSwap(null);
                    }}
                  >
                    {CORE_BY_ID[a].name}
                  </button>
                ))}
              </div>
            )}
            <p className="fineprint coach">{sug.note}</p>
            <table className="sets">
              <thead>
                <tr>
                  <th>סט</th>
                  <th>{ex.equip.every((q) => q === 'bw') ? 'תוספת ק"ג' : 'ק"ג'}</th>
                  <th>{e.unit === 'sec' ? 'שניות' : 'חזרות'}</th>
                  <th>
                    <span className="sr">בוצע</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs[i].sets.map((x, j) => (
                  <tr key={j} className={x.done ? 'done' : ''}>
                    <td>{j + 1}</td>
                    <td>
                      <input inputMode="decimal" dir="ltr" value={x.kg || ''} placeholder="0" onChange={(ev) => setField(i, j, { kg: Number(ev.target.value) || 0 })} aria-label={`משקל סט ${j + 1}`} />
                    </td>
                    <td>
                      <input inputMode="numeric" dir="ltr" value={x.reps || ''} onChange={(ev) => setField(i, j, { reps: Number(ev.target.value) || 0 })} aria-label={`חזרות סט ${j + 1}`} />
                    </td>
                    <td>
                      <button
                        className={`set-check ${x.done ? 'on' : ''}`}
                        aria-pressed={x.done}
                        aria-label={`סט ${j + 1} בוצע`}
                        onClick={() => {
                          setField(i, j, { done: !x.done });
                          if (!x.done) {
                            // carry the weight to the next set
                            if (logs[i].sets[j + 1] && !logs[i].sets[j + 1].kg) setField(i, j + 1, { kg: x.kg });
                            setRest({ until: Date.now() + e.restSec * 1000, total: e.restSec });
                            setNow(Date.now());
                          }
                        }}
                      >
                        ✓
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {day.cardio && (
        <Card title={`אירובי: ${CARDIO[day.cardio.type].name}`}>
          <p className="muted">
            {day.cardio.minutes} דק׳. {day.cardio.note}
          </p>
          <button className={`set-check wide ${cardioDone ? 'on' : ''}`} aria-pressed={cardioDone} onClick={() => setCardioDone((v) => !v)}>
            {cardioDone ? '✓ בוצע' : 'סימון כבוצע'}
          </button>
        </Card>
      )}

      <Button
        full
        disabled={doneSets === 0}
        onClick={() => {
          saveSession({
            date: todayISO(),
            dayId: day.id,
            planId: plan.id,
            exercises: logs.map((l) => ({ ...l, sets: l.sets.filter((x) => x.done) })).filter((l) => l.sets.length),
            cardio: cardioDone && day.cardio ? { type: day.cardio.type, minutes: day.cardio.minutes, intensity: day.cardio.intensity } : undefined,
            minutes: Math.round((Date.now() - started.current) / 60000),
          });
          onClose();
        }}
      >
        סיום ושמירה
      </Button>
      <ExerciseSheet id={detail} onClose={closeDetail} />
    </div>
  );
}

/* ---------------- exercise detail ---------------- */

function Thumb({ refId, alt }: { refId: string; alt: string }) {
  const [bad, setBad] = useState(false);
  if (bad) return <span className="thumb ph" aria-hidden="true">◆</span>;
  return <img className="thumb" src={`${IMG_BASE}${refId}/0.jpg`} alt={alt} loading="lazy" onError={() => setBad(true)} />;
}

function Frames({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    if (images.length < 2) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % images.length), 1100);
    return () => window.clearInterval(id);
  }, [images.length]);
  if (bad || !images.length) return null;
  return (
    <div className="frames" aria-label={`${alt}: תנוחת התחלה וסיום`} role="img">
      {images.map((src, k) => (
        <img key={src} src={IMG_BASE + src} alt="" className={k === i ? 'on' : ''} onError={() => setBad(true)} loading="lazy" />
      ))}
      <span className="frames-tag">{i === 0 ? 'התחלה' : 'סיום'}</span>
    </div>
  );
}

function ExerciseSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [lib, setLib] = useState<Library | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (id && !lib) loadLibrary().then(setLib).catch(() => setErr(true));
  }, [id, lib]);
  const e: LibExercise | undefined = id ? lib?.byId[id] : undefined;
  const core = id ? CORE_BY_REF[id] : undefined;
  const title = core?.name ?? e?.he ?? '';
  return (
    <Sheet open={!!id} onClose={onClose} title={title}>
      {!e && !err && <p className="muted">טוען…</p>}
      {err && !core && <Banner kind="warn">לא הצלחנו לטעון את מאגר התרגילים. נסו שוב בעוד רגע.</Banner>}
      {(e || core) && (
        <div className="ex-detail">
          {e && <p className="en-name" dir="ltr">{e.en}</p>}
          {e && <Frames images={e.images} alt={title} />}
          <MuscleMap primary={core?.primary ?? e?.primary ?? []} secondary={core?.secondary ?? e?.secondary ?? []} />
          <p className="muscles-line">
            <b>עובד על:</b> {(core?.primary ?? e?.primary ?? []).map((m) => MUSCLE_HE[m as keyof typeof MUSCLE_HE] ?? m).join(', ')}
            {(core?.secondary ?? e?.secondary ?? []).length > 0 && <> · <span className="muted">עוזרים: {(core?.secondary ?? e?.secondary ?? []).map((m) => MUSCLE_HE[m as keyof typeof MUSCLE_HE] ?? m).join(', ')}</span></>}
          </p>
          {e && lib && (
            <div className="tags">
              <span className="tag">{lib.equipment[e.equipment] ?? e.equipment}</span>
              <span className="tag">{lib.levels[e.level] ?? e.level}</span>
              <span className="tag">{lib.categories[e.category] ?? e.category}</span>
            </div>
          )}
          {core ? (
            <>
              <h3 className="sub">איך מבצעים</h3>
              <ol className="steps">
                {core.steps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
              <h3 className="sub">דגשים</h3>
              <ul className="plain good">
                {core.cues.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <h3 className="sub">טעויות נפוצות</h3>
              <ul className="plain bad">
                {core.mistakes.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          ) : (
            e && (
              <>
                <h3 className="sub">איך מבצעים</h3>
                <p className="fineprint">ההוראות לתרגיל הזה מגיעות מהמאגר הבינלאומי, ומוצגות באנגלית.</p>
                <ol className="steps" dir="ltr">
                  {e.steps.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
              </>
            )
          )}
          <p className="fineprint">כאב חד או כאב במפרק הוא סימן לעצור. תמונות והוראות: free-exercise-db (נחלת הכלל).</p>
        </div>
      )}
    </Sheet>
  );
}

/* ---------------- library ---------------- */

function LibraryView({ onOpen }: { onOpen: (id: string) => void }) {
  const [lib, setLib] = useState<Library | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState(40);
  useEffect(() => {
    loadLibrary().then(setLib).catch(() => setErr(true));
  }, []);
  const res = useMemo(() => (lib ? searchLibrary(lib, q, { muscle, equipment, category }).sort((a, b) => Number(!!CORE_BY_REF[b.id]) - Number(!!CORE_BY_REF[a.id])) : []), [lib, q, muscle, equipment, category]);
  useEffect(() => setLimit(40), [q, muscle, equipment, category]);
  if (err) return <Banner kind="warn">לא הצלחנו לטעון את מאגר התרגילים.</Banner>;
  if (!lib) return <p className="muted">טוען את מאגר התרגילים…</p>;
  return (
    <div className="library">
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש: סקוואט, חזה, משקולות…" aria-label="חיפוש תרגיל" />
      <div className="filters">
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="שריר">
          <option value="">כל השרירים</option>
          {Object.entries(lib.muscles).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)} aria-label="ציוד">
          <option value="">כל הציוד</option>
          {Object.entries(lib.equipment).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="סוג">
          <option value="">כל הסוגים</option>
          {Object.entries(lib.categories).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <p className="fineprint">
        {fmt(res.length)} תרגילים מתוך {fmt(lib.exercises.length)}
      </p>
      <ul className="lib-list">
        {res.slice(0, limit).map((e) => (
          <li key={e.id}>
            <button onClick={() => onOpen(e.id)}>
              <Thumb refId={e.id} alt="" />
              <span className="lib-text">
                <b>{e.he}</b>
                <small>
                  {e.primary.map((m) => lib.muscles[m] ?? m).join(', ')} · {lib.equipment[e.equipment] ?? e.equipment}
                  {CORE_BY_REF[e.id] && <span className="badge">הסבר מלא בעברית</span>}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {res.length > limit && (
        <Button kind="secondary" full onClick={() => setLimit((l) => l + 60)}>
          להציג עוד
        </Button>
      )}
    </div>
  );
}

/* ---------------- progress ---------------- */

function TrainingProgress() {
  const s = useStore((x) => x);
  const t = s.training ?? EMPTY_TRAINING;
  const since = todayISO(new Date(Date.now() - 6 * 864e5));
  const week = t.sessions.filter((x) => x.date >= since);
  const sets: Record<string, number> = {};
  for (const ses of week)
    for (const e of ses.exercises) {
      const ex = CORE_BY_ID[e.exId];
      ex?.primary.forEach((m) => (sets[m] = (sets[m] ?? 0) + e.sets.length));
    }
  const best: Record<string, { kg: number; reps: number; e: number; date: string }> = {};
  for (const ses of t.sessions)
    for (const e of ses.exercises)
      for (const x of e.sets) {
        if (!x.kg || CORE_BY_ID[e.exId]?.equip.every((q) => q === 'bw')) continue;
        const v = e1rm(x.kg, x.reps);
        if (!best[e.exId] || v > best[e.exId].e) best[e.exId] = { kg: x.kg, reps: x.reps, e: v, date: ses.date };
      }
  const cardioMin = week.reduce((a, x) => a + (x.cardio?.minutes ?? 0), 0);
  const plan = t.plan!;
  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <b>{week.length}</b>
          <span>אימונים השבוע</span>
          <small>מתוך {plan.days.length}</small>
        </div>
        <div className="stat">
          <b>{t.sessions.length}</b>
          <span>אימונים בסך הכול</span>
        </div>
        <div className="stat">
          <b>{cardioMin}</b>
          <span>דק׳ אירובי השבוע</span>
          <small>יעד {plan.weeklyCardioMin}</small>
        </div>
      </div>
      <Card title="סטים השבוע לפי שריר">
        {Object.keys(sets).length === 0 ? (
          <p className="muted">אחרי האימון הראשון, יופיע כאן כמה סטים עשית לכל שריר.</p>
        ) : (
          <>
            <MuscleMap primary={Object.keys(sets).filter((m) => sets[m] >= 10)} secondary={Object.keys(sets).filter((m) => sets[m] < 10)} />
            <div className="vol-bars">
              {Object.entries(sets)
                .sort((a, b) => b[1] - a[1])
                .map(([m, v]) => (
                  <div key={m} className="vol-row">
                    <span>{MUSCLE_HE[m as keyof typeof MUSCLE_HE] ?? m}</span>
                    <div className="vol-track" aria-hidden="true">
                      <i className="vol-band" />
                      <i className="vol-fill" style={{ width: `${Math.min(100, (v / 24) * 100)}%` }} />
                    </div>
                    <b>{v}</b>
                  </div>
                ))}
            </div>
            <p className="fineprint">מוזהב מלא = 10 סטים ומעלה השבוע.</p>
          </>
        )}
      </Card>
      <Card title="השיאים שלך">
        {Object.keys(best).length === 0 ? (
          <p className="muted">השיאים יופיעו כאן אחרי שתרשום משקלים באימון.</p>
        ) : (
          <ul className="prs">
            {Object.entries(best)
              .sort((a, b) => b[1].e - a[1].e)
              .slice(0, 8)
              .map(([id, b]) => (
                <li key={id}>
                  <span>{CORE_BY_ID[id]?.name ?? id}</span>
                  <b>
                    {b.kg} ק"ג × {b.reps}
                  </b>
                  <small>כ-{fmt(b.e, 1)} ק"ג לחזרה אחת</small>
                </li>
              ))}
          </ul>
        )}
        <p className="fineprint">"לחזרה אחת" היא הערכה לפי נוסחת Epley, לא משקל שצריך לנסות.</p>
      </Card>
    </>
  );
}

/* ---------------- articles ---------------- */

function Learn() {
  const [a, setA] = useState<Article | null>(null);
  return (
    <>
      <div className="articles">
        {TRAINING_ARTICLES.map((x) => (
          <button key={x.id} className="article" onClick={() => setA(x)}>
            <strong>{x.title}</strong>
            <span className="muted">
              {x.minutes} דק׳ קריאה · <span className="evidence strong">ראיות חזקות</span>
            </span>
          </button>
        ))}
      </div>
      <Sheet open={!!a} onClose={() => setA(null)} title={a?.title ?? ''}>
        {a && (
          <>
            {a.body.map((b) => (
              <p key={b}>{b}</p>
            ))}
            <WhyContent why="" sources={a.sources} />
          </>
        )}
      </Sheet>
    </>
  );
}
