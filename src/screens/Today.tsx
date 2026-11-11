import { SUPP_BY_ID } from '../data/supplements';
import { CARDIO } from '../training/plan';
import { dayLink, fmtMin } from '../state/daylink';
import { SLOT_LABEL as SLOTS } from '../engine/menu';
import { useEffect, useState } from 'react';
import { Banner, Button, Card, Empty, InfoDot, MacroBar, Ring, Sheet, WhyButton, fmt, parseNum } from '../ui/kit';
import { WEEK_TIPS } from '../ui/Tour';
import { recordRecipe } from '../engine/learning';
import { addLog, addWeighIn, getState, learn, logSafetyEvent, markHint, nowTime, recomputeTargets, removeLog, saveProfile, setState, todayISO, useStore } from '../state/store';
import { phaseMismatch } from '../training/state';
import { GOAL_HE } from '../engine/targets';
import { eatenOn, fullDayTargets, mealsDone, useAdaptive, useAlerts, usePlan, useSafety } from '../state/derived';
import { RECIPES } from '../data/recipes';
import { SLOT_LABEL } from '../engine/menu';
import { FOOD_BY_ID, nutrientsFor } from '../data/foods';
import type { Tab } from '../App';

const DAY_MISSION: Record<string, string> = {
  fat_loss: 'היום: להגיע ליעד החלבון. הוא שומר על השריר בזמן הירידה.',
  muscle_gain: 'היום: לאכול את כל הארוחות בתפריט. בבניית שריר, עקביות חשובה יותר משלמות.',
  bulk: 'היום: לא לדלג על אף ארוחה. במסה, העודף הקלורי הוא שבונה.',
  recomp: 'היום: חלבון ביעד ואימון כוח. זה השילוב שעובד.',
  performance: 'היום: לאכול פחמימות לפני האימון ואחריו.',
  health: 'היום: חצי צלחת ירקות בארוחת הצהריים.',
};

export function Today({ go }: { go: (t: Tab) => void }) {
  const s = useStore((x) => x);
  const date = todayISO();
  const plan = usePlan(date);
  const alerts = useAlerts();
  const adaptive = useAdaptive();
  const safety = useSafety();
  const [weighOpen, setWeighOpen] = useState(false);
  const [kg, setKg] = useState('');
  useEffect(() => {
    alerts.forEach((a) => logSafetyEvent(a.kind, a.message));
  }, [alerts]);
  if (!s.profile || !s.targets) return null;
  const t = s.targets;
  const eaten = eatenOn(s, date);
  const left = t.kcal.value - eaten.kcal;
  const logsToday = s.logs.filter((l) => l.date === date).sort((a, b) => a.time.localeCompare(b.time));
  const done = plan ? mealsDone(plan, s.logs) : [];
  const nextMeal = plan?.meals.find((_, i) => !done[i]);
  const day = fullDayTargets(s, date) ?? { kcal: t.kcal.value, protein: t.proteinG.value, fat: t.fatG.value, carbs: t.carbsG.value };
  const mismatch = phaseMismatch(s);
  const nextRecipe = nextMeal && RECIPES.find((r) => r.id === nextMeal.recipeId);
  const water = s.water[date] ?? 0;
  const cups = Math.round(t.waterMl.value / 250);
  const dayN = s.startedAt ? Math.floor((Date.now() - Date.parse(s.startedAt)) / 864e5) + 1 : 1;
  const tip = !s.seenHints.includes(`day-${dayN}`) ? WEEK_TIPS[dayN] : undefined;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב';
  const showTdeeSuggestion =
    adaptive?.ready && adaptive.suggestedTdee && Math.abs(adaptive.suggestedTdee - t.tdee.value) >= 50 && s.lastTdeeReview !== date;

  return (
    <div className="screen">
      <header className="hello">
        <h1>
          {hello}
          {s.profile.name ? `, ${s.profile.name}` : ''}
        </h1>
        <p className="mission">{DAY_MISSION[s.profile.goal]}</p>
      </header>

      {tip && (
        <Card className="tip" title={`יום ${dayN} · ${tip.title}`} action={<button className="link" onClick={() => markHint(`day-${dayN}`)}>הבנתי</button>}>
          <p>{tip.text}</p>
        </Card>
      )}

      {alerts.map((a) => (
        <Banner key={a.kind} kind="safety">
          {a.message}
        </Banner>
      ))}
      {safety?.flags.includes('no_deficit') && <Banner kind="info">התוכנית שלך מכוונת לאכילה מסודרת ברמת תחזוקה, בלי גירעון.</Banner>}

      {showTdeeSuggestion && adaptive && (
        <Banner
          kind="info"
          action={
            <div className="row">
              <Button
                onClick={() => {
                  setState({ tdeeOverride: adaptive.suggestedTdee, lastTdeeReview: date });
                  recomputeTargets();
                }}
              >
                לעדכן
              </Button>
              <Button kind="ghost" onClick={() => setState({ lastTdeeReview: date })}>
                לא עכשיו
              </Button>
            </div>
          }
        >
          <strong>עדכון מוצע להוצאה היומית:</strong> לפי הנתונים שלך ({adaptive.reason}), נראה שההוצאה היומית שלך היא בערך {fmt(adaptive.estimatedTdee!)} קק"ל. מוצע לעדכן ל-{fmt(adaptive.suggestedTdee!)} (שינוי הדרגתי).
        </Banner>
      )}

      {mismatch && (
        <Banner
          kind="info"
          action={
            <Button kind="secondary" onClick={() => saveProfile({ ...s.profile!, goal: mismatch.goal, targetWeightKg: undefined, targetDate: undefined })}>
              לעדכן את היעדים
            </Button>
          }
        >
          <strong>שלב חדש בתוכנית: {mismatch.phase.title}.</strong> {mismatch.phase.why} היעד התזונתי עדיין מכוון ל{GOAL_HE[s.profile.goal]}.
        </Banner>
      )}

      <Card className="today-ring">
        <div className="ring-row" data-tour="ring">
          <Ring
            value={eaten.kcal}
            max={t.kcal.value}
            label={
              <>
                <span className="big">{fmt(Math.abs(left))}</span>
                <span>{left >= 0 ? 'קק"ל נשארו' : 'קק"ל מעל היעד'}</span>
              </>
            }
            sub={
              <>
                מתוך {fmt(t.kcal.value)} <WhyButton title="יעד קלורי" e={t.kcal} />
              </>
            }
          />
        </div>
        <div className="macros" data-tour="macros">
          <MacroBar name="חלבון" value={eaten.protein} target={t.proteinG.value} color="var(--protein)" why={<WhyButton title="יעד חלבון" e={t.proteinG} />} />
          <MacroBar name="פחמימה" value={eaten.carbs} target={day.carbs} color="var(--carbs)" why={<WhyButton title="יעד פחמימה" e={t.carbsG} />} />
          <MacroBar name="שומן" value={eaten.fat} target={day.fat} color="var(--fat)" why={<WhyButton title="יעד שומן" e={t.fatG} />} />
        </div>
        {s.settings.detailed && (
          <div className="detail-row">
            <span>
              סיבים: {fmt(eaten.fiber)} / {t.fiberG.value} ג׳ <WhyButton title="סיבים" e={t.fiberG} />
            </span>
            <span>
              BMR <InfoDot id="bmr" />: {fmt(t.bmr.value)}
            </span>
          </div>
        )}
      </Card>

      {nextMeal && nextRecipe && (
        <Card title={`הארוחה הבאה · ${SLOT_LABEL[nextMeal.slot]}`} action={<button className="link" onClick={() => go('menu')}>לתפריט</button>}>
          <div className="next-meal">
            <div>
              <strong>{nextRecipe.name}</strong>
              <div className="muted">
                {fmt(nextMeal.nutrients.kcal)} קק"ל · {fmt(nextMeal.nutrients.protein)} ג׳ חלבון
              </div>
            </div>
            <Button
              onClick={() => {
                addLog({
                  date,
                  time: nowTime(),
                  slot: nextMeal.slot,
                  items: [{ foodId: nextRecipe.id, name: nextRecipe.name, grams: 0 }],
                  method: 'plan',
                  nutrients: nextMeal.nutrients,
                });
                learn((l) => recordRecipe(l, nextRecipe.id, 'eaten'));
              }}
            >
              אכלתי בדיוק את זה
            </Button>
          </div>
        </Card>
      )}

      <DayTimeline date={date} go={go} />

      {(s.profile?.supplements?.length ?? 0) > 0 && (
        <Card title="התוספים שלי היום">
          <ul className="supp-today">
            {s.profile!.supplements!.map((id) => SUPP_BY_ID[id]).filter(Boolean).map((sp) => {
              const taken = s.suppTaken?.[date]?.[sp.id];
              const on = taken !== undefined;
              const f = sp.foodId ? FOOD_BY_ID[sp.foodId] : undefined;
              return (
                <li key={sp.id}>
                  <button
                    className={on ? 'on' : ''}
                    aria-pressed={on}
                    onClick={() => {
                      if (on) {
                        if (taken) removeLog(taken);
                        setState((x) => {
                          const day = { ...(x.suppTaken?.[date] ?? {}) };
                          delete day[sp.id];
                          return { suppTaken: { ...x.suppTaken, [date]: day } };
                        });
                        return;
                      }
                      let logId = '';
                      if (f && sp.serving) {
                        const n = nutrientsFor(f.id, sp.serving.grams);
                        addLog({ date, time: nowTime(), slot: 'snack', items: [{ foodId: f.id, name: f.name, grams: sp.serving.grams }], method: 'supplement', nutrients: sp.id === 'collagen' ? { ...n, protein: 0 } : n });
                        logId = getState().logs[getState().logs.length - 1].id;
                      }
                      setState((x) => ({ suppTaken: { ...x.suppTaken, [date]: { ...(x.suppTaken?.[date] ?? {}), [sp.id]: logId } } }));
                    }}
                  >
                    <span className="box" aria-hidden="true">{on ? '✓' : ''}</span>
                    <span>
                      <b>{sp.name}</b>
                      <br />
                      <small className="muted">
                        {sp.when}
                        {f && sp.serving ? ` · ${sp.serving.label}, ${fmt(nutrientsFor(f.id, sp.serving.grams).kcal)} קק"ל` : ''}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title="מה אכלתי היום">
        {logsToday.length === 0 ? (
          <Empty title="עוד לא נרשם כלום" text="צלמו את הארוחה הראשונה, או סמנו ארוחה מהתפריט." action={<Button onClick={() => go('camera')}>לצלם ארוחה</Button>} />
        ) : (
          <ul className="timeline">
            {logsToday.map((l) => (
              <li key={l.id}>
                {l.photo ? <img src={l.photo} alt="" className="thumb" /> : <span className="thumb ph">{SLOT_LABEL[l.slot][0]}</span>}
                <div className="tl-body">
                  <div className="tl-top">
                    <strong>{l.items.map((i) => (i.grams ? `${FOOD_BY_ID[i.foodId]?.name ?? i.name} ${Math.round(i.grams)} ג׳` : i.name)).join(' · ')}</strong>
                  </div>
                  <div className="muted">
                    {l.time} · {l.method === 'supplement' ? 'תוסף' : SLOT_LABEL[l.slot]} · {fmt(l.nutrients.kcal)} קק"ל · {fmt(l.nutrients.protein)} ג׳ חלבון
                  </div>
                </div>
                <button className="icon-btn" aria-label="מחיקה" onClick={() => removeLog(l.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="habits" data-tour="habits">
        <div className="habit">
          <span className="habit-name">
            מים <WhyButton title="מים" e={t.waterMl} />
          </span>
          <span className="habit-val">
            {water} / {cups} כוסות
          </span>
          <div className="row">
            <button className="round" aria-label="פחות כוס" onClick={() => setState((x) => ({ water: { ...x.water, [date]: Math.max(0, (x.water[date] ?? 0) - 1) } }))}>
              −
            </button>
            <button className="round accent" aria-label="עוד כוס" onClick={() => setState((x) => ({ water: { ...x.water, [date]: (x.water[date] ?? 0) + 1 } }))}>
              +
            </button>
          </div>
        </div>
        <div className="habit">
          <span className="habit-name">שקילה</span>
          <span className="habit-val">{s.weighIns.length ? `${fmt(s.weighIns[s.weighIns.length - 1].kg, 1)} ק"ג` : 'עוד לא'}</span>
          <Button kind="secondary" onClick={() => setWeighOpen(true)}>
            להישקל
          </Button>
        </div>
      </div>

      {s.deviceData.length > 0 &&
        (() => {
          const last = [...s.deviceData].reverse();
          const steps = last.find((d) => d.date === date && d.steps)?.steps;
          const sleep = last.find((d) => d.sleepHours)?.sleepHours;
          const hr = last.find((d) => d.restingHr)?.restingHr;
          return (
            <button className="device-strip as-link" onClick={() => go('devices')} aria-label="נתוני מכשירים">
              <div>
                <b>{steps ? fmt(steps) : '—'}</b>
                <span>צעדים היום</span>
              </div>
              <div>
                <b>{sleep ? fmt(sleep, 1) : '—'}</b>
                <span>שעות שינה</span>
              </div>
              <div>
                <b>{hr ?? '—'}</b>
                <span>דופק במנוחה</span>
              </div>
            </button>
          );
        })()}

      <Sheet open={weighOpen} onClose={() => setWeighOpen(false)} title="שקילה">
        <p className="fineprint">הכי מדויק: בבוקר, אחרי שירותים ולפני אוכל. פעם ביום מספיק.</p>
        <label className="field">
          <span className="field-label">משקל (ק"ג)</span>
          <span className="field-input">
            <input inputMode="decimal" dir="ltr" value={kg} onChange={(e) => setKg(e.target.value.replace(/[^\d.,]/g, ''))} autoFocus aria-label='משקל בק"ג' />
          </span>
        </label>
        <Button
          full
          disabled={!(parseNum(kg) >= 30 && parseNum(kg) <= 300)}
          onClick={() => {
            addWeighIn(Math.round(parseNum(kg) * 10) / 10);
            setKg('');
            setWeighOpen(false);
          }}
        >
          שמירה
        </Button>
      </Sheet>
    </div>
  );
}

/** The whole day in one line: meals and training in time order, linked to each other. */
function DayTimeline({ date, go }: { date: string; go: (t: Tab) => void }) {
  const s = useStore((x) => x);
  const plan = usePlan(date);
  if (!plan) return null;
  const link = dayLink(s, date);
  const doneMeals = mealsDone(plan, s.logs);
  const trained = s.training?.sessions.some((x) => x.date === date);
  type Row = { t: number; key: string; node: JSX.Element };
  const rows: Row[] = plan.meals.map((m, i) => {
    const r = RECIPES.find((x) => x.id === m.recipeId);
    const done = doneMeals[i];
    return {
      t: link.mealTimes[m.slotIndex ?? i] ?? 0,
      key: 'm' + i,
      node: (
        <li key={'m' + i} className={done ? 'done' : ''}>
          <span className="tl-time">{fmtMin(link.mealTimes[m.slotIndex ?? i] ?? 0)}</span>
          <span className="tl-dot" aria-hidden="true" />
          <span className="tl-main">
            <b>
              {SLOTS[m.slot]}
              {m.role && <span className={`role-tag ${m.role}`}>{m.role === 'pre' ? 'לפני אימון' : 'אחרי אימון'}</span>}
            </b>
            <small>
              {r?.name} · {fmt(m.nutrients.kcal)} קק"ל · {fmt(m.nutrients.protein)} ג׳ חלבון
            </small>
          </span>
          {done && <span className="tl-act muted">✓</span>}
        </li>
      ),
    };
  });
  if (link.kind !== 'rest' && link.startMin !== undefined) {
    const title = link.workout?.title ?? (link.cardio ? CARDIO[link.cardio.type].name : 'אימון');
    rows.push({
      t: link.startMin,
      key: 'w',
      node: (
        <li key="w" className={`workout ${trained ? 'done' : ''}`}>
          <span className="tl-time">{fmtMin(link.startMin)}</span>
          <span className="tl-dot" aria-hidden="true" />
          <span className="tl-main">
            <b>{title}</b>
            <small>
              {link.workout ? `${link.workout.exercises.length} תרגילים · כ-${link.workout.estMinutes} דק׳` : `${link.cardio?.minutes ?? 0} דק׳ אירובי`}
            </small>
          </span>
          {trained ? (
            <span className="tl-act muted">✓</span>
          ) : (
            <button className="link tl-act" onClick={() => go('training')}>
              להתחיל
            </button>
          )}
        </li>
      ),
    });
  }
  rows.sort((a, b) => a.t - b.t);
  return (
    <Card
      title={link.kind === 'lift' ? 'היום שלך · יום אימון' : link.kind === 'cardio' ? 'היום שלך · יום אירובי' : 'היום שלך · יום מנוחה'}
      action={
        <button className="link" onClick={() => go(s.training?.plan ? 'training' : 'menu')}>
          {s.training?.plan ? 'לאימון' : 'לתפריט'}
        </button>
      }
    >
      <div data-tour="day">
        <ol className="timeline">{rows.map((r) => r.node)}</ol>
        {!s.training?.plan ? (
          <div className="row between" style={{ marginTop: 8 }}>
            <span className="muted">אין עדיין תוכנית אימונים. כשתהיה, התפריט יתאים את עצמו אליה.</span>
            <Button kind="secondary" onClick={() => go('training')}>
              לבנות
            </Button>
          </div>
        ) : link.kind !== 'rest' ? (
          <p className="fineprint">הארוחות לפני ואחרי האימון מותאמות אוטומטית: פחמימה לפני, חלבון ופחמימה אחרי.</p>
        ) : (
          <p className="fineprint">ביום מנוחה הפחמימה מעט נמוכה יותר והשומן מעט גבוה יותר. הקלוריות זהות.</p>
        )}
      </div>
    </Card>
  );
}
