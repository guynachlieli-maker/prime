import { useEffect, useMemo, useState } from 'react';
import { BodyJourney } from '../ui/BodyJourney';
import { Banner, Button, ChoiceCards, InfoDot, NumberField, Segmented, Toggle, WhyButton, YesNo, fmt } from '../ui/kit';
import { evaluateSafety, bmi } from '../engine/safety';
import { computeTargets, ACTIVITY_FACTORS } from '../engine/targets';
import { estimateBodyFatFromBmi, forecastBody, navyBodyFat } from '../engine/forecast';
import { EMPTY_SCREENING, type Allergen, type Profile } from '../engine/types';
import { saveProfile, setState } from '../state/store';
import { minHealthyWeight } from '../engine/pace';

const isoIn = (weeks: number) => new Date(Date.now() + weeks * 7 * 864e5).toISOString().slice(0, 10);

const DRAFT = 'prime.draft';
type Draft = Partial<Profile> & { step: number; bfMode?: 'unknown' | 'known' | 'tape'; waist?: number; neck?: number; hip?: number };

const ALLERGENS: { value: Allergen; label: string }[] = [
  { value: 'gluten', label: 'גלוטן' },
  { value: 'dairy', label: 'חלב' },
  { value: 'egg', label: 'ביצים' },
  { value: 'nuts', label: 'אגוזים' },
  { value: 'peanuts', label: 'בוטנים' },
  { value: 'sesame', label: 'שומשום' },
  { value: 'fish', label: 'דגים' },
  { value: 'soy', label: 'סויה' },
];

const STEPS = ['פתיחה', 'מטרה', 'נתוני גוף', 'שאלון התאמה', 'פעילות והרגלים', 'העדפות', 'משקל יעד', 'רגע הגילוי', 'התוכנית שלך'];

function loadDraft(): Partial<Draft> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT) ?? "{}") as Partial<Draft>;
  } catch {
    return {};
  }
}

function toProfile(d: Draft): Profile | null {
  if (!d.sex || !d.age || !d.heightCm || !d.weightKg || !d.goal) return null;
  let bodyFatPct = d.bodyFatPct;
  let bodyFatSource = d.bodyFatSource ?? 'unknown';
  if (d.bfMode === 'tape' && d.waist && d.neck) {
    const v = navyBodyFat({ sex: d.sex, heightCm: d.heightCm, waistCm: d.waist, neckCm: d.neck, hipCm: d.hip });
    if (v) {
      bodyFatPct = v;
      bodyFatSource = 'navy';
    }
  }
  if (d.bfMode === 'unknown' || bodyFatPct === undefined) {
    bodyFatPct = estimateBodyFatFromBmi(d.sex, d.age, bmi(d.weightKg, d.heightCm));
    bodyFatSource = 'estimate';
  }
  return {
    name: d.name ?? '',
    sex: d.sex,
    age: d.age,
    heightCm: d.heightCm,
    weightKg: d.weightKg,
    bodyFatPct,
    bodyFatSource,
    activity: d.activity ?? 'moderate',
    trainingDaysPerWeek: d.trainingDaysPerWeek ?? 3,
    strengthTraining: d.strengthTraining ?? true,
    sleepHours: d.sleepHours ?? 7,
    goal: d.goal,
    pace: d.pace ?? 'balanced',
    diet: d.diet ?? 'omnivore',
    kosher: d.kosher ?? false,
    allergies: d.allergies ?? [],
    dislikes: d.dislikes ?? [],
    mealsPerDay: d.mealsPerDay ?? 4,
    maxPrepMinutes: d.maxPrepMinutes ?? 30,
    screening: d.screening ?? { ...EMPTY_SCREENING },
    targetWeightKg: d.targetWeightKg,
    targetDate: d.targetDate,
  };
}

export function Onboarding() {
  const [d, setD] = useState<Draft>(() => ({ step: 0, ...loadDraft() }));
  const up = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }, [d]);
  const step = d.step;
  const go = (n: number) => {
    up({ step: n });
    window.scrollTo({ top: 0 });
  };
  const sc = d.screening ?? EMPTY_SCREENING;
  const setSc = (k: keyof typeof EMPTY_SCREENING, v: boolean) => up({ screening: { ...sc, [k]: v } });

  const profile = useMemo(() => toProfile(d), [d]);
  const safety = useMemo(() => (profile ? evaluateSafety(profile) : null), [profile]);
  const targets = useMemo(() => (profile ? computeTargets(profile) : null), [profile]);

  const canNext: Record<number, boolean> = {
    0: true,
    1: !!d.goal,
    2: !!d.sex && !!d.age && d.age >= 10 && d.age <= 100 && !!d.heightCm && d.heightCm >= 120 && d.heightCm <= 230 && !!d.weightKg && d.weightKg >= 30 && d.weightKg <= 300,
    3: true,
    4: true,
    5: true,
    6: d.targetWeightKg === undefined || !profile || d.targetWeightKg >= minHealthyWeight(profile.heightCm),
    7: true,
    8: true,
  };

  const finish = () => {
    if (!profile) return;
    saveProfile(profile);
    setState((x) => ({ onboardingDone: true, startedAt: x.startedAt ?? new Date().toISOString(), settings: { hideAvatar: safety?.flags.includes('hide_avatar') ?? false, trainingConsent: false, theme: x.settings.theme, detailed: x.settings.detailed, reminders: true, apiKey: x.settings.apiKey } }));
    try {
      localStorage.removeItem(DRAFT);
    } catch {
      /* ignore */
    }
  };

  if (profile && safety?.blocked && step > 2) {
    return (
      <div className="onb">
        <h1>תודה שבאת</h1>
        <p className="lead">PRIME מיועדת לבני 18 ומעלה. בגיל צעיר יותר, ההמלצות התזונתיות שונות, וכדאי לבנות תוכנית עם דיאטנית או רופא.</p>
        <Button kind="secondary" onClick={() => go(2)}>
          חזרה לתיקון הגיל
        </Button>
      </div>
    );
  }

  const fc = profile && targets ? forecastBody({ sex: profile.sex, age: profile.age, heightCm: profile.heightCm, weightKg: profile.weightKg, bodyFatPct: profile.bodyFatPct!, tdee: targets.tdee.value, intakeKcal: targets.kcal.value, strengthTraining: profile.strengthTraining, weeks: 12 }) : null;

  return (
    <div className="onb">
      <div className="onb-progress" aria-label={`שלב ${step + 1} מתוך ${STEPS.length}: ${STEPS[step]}`}>
        <div style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <div className="onb-step-name">
        שלב {step + 1} מתוך {STEPS.length} · {STEPS[step]}
      </div>

      {step === 0 && (
        <div className="onb-hero">
          <div className="logo-mark big">P</div>
          <h1>PRIME</h1>
          <p className="lead">תגיד לי מה המטרה. אני אגיד לך מה לאכול, אראה לך איך תיראה בדרך, ואראה לך את המקור לכל המלצה.</p>
          <ul className="promise">
            <li>כל המלצה מגיעה ממחקר מוסמך, עם קישור למקור.</li>
            <li>צלם את הצלחת, ונעשה את החישוב.</li>
            <li>המידע שלך נשמר אצלך במכשיר.</li>
          </ul>
          <label className="field">
            <span className="field-label">איך לקרוא לך? (לא חובה)</span>
            <input value={d.name ?? ''} onChange={(e) => up({ name: e.target.value })} maxLength={30} />
          </label>
        </div>
      )}

      {step === 1 && (
        <>
          <h1>מה המטרה שלך?</h1>
          <p className="lead">אפשר לשנות אחר כך בכל רגע.</p>
          <ChoiceCards
            value={d.goal}
            onChange={(goal) => up({ goal })}
            options={[
              { value: 'fat_loss', label: 'ירידה בשומן', desc: 'להוריד שומן ולשמור על השריר', icon: '↓' },
              { value: 'muscle_gain', label: 'בניית שריר', desc: 'להוסיף מסה בעודף קטן', icon: '↑' },
              { value: 'recomp', label: 'ריקומפוזיציה', desc: 'פחות שומן ויותר שריר במקביל', icon: '⇅' },
              { value: 'performance', label: 'ביצועי ספורט', desc: 'דלק נכון לאימונים ולתחרויות', icon: '⚡' },
              { value: 'health', label: 'בריאות כללית', desc: 'אכילה מאוזנת ומשקל תקין', icon: '♥' },
            ]}
          />
        </>
      )}

      {step === 2 && (
        <>
          <h1>נתוני גוף</h1>
          <p className="lead">כדי לחשב כמה הגוף שלך שורף ביום.</p>
          <Segmented
            label="מין ביולוגי"
            value={d.sex ?? ('' as 'male')}
            onChange={(sex) => up({ sex })}
            options={[
              { value: 'male', label: 'זכר' },
              { value: 'female', label: 'נקבה' },
            ]}
          />
          <p className="fineprint">משמש לנוסחת החישוב בלבד.</p>
          <div className="grid2">
            <NumberField label="גיל" value={d.age} onChange={(age) => up({ age })} unit="שנים" min={10} max={100} />
            <NumberField label="גובה" value={d.heightCm} onChange={(heightCm) => up({ heightCm })} unit='ס"מ' min={120} max={230} />
            <NumberField label="משקל" value={d.weightKg} onChange={(weightKg) => up({ weightKg })} unit='ק"ג' min={30} max={300} step={0.1} />
          </div>
          <h3 className="sub">אחוז שומן</h3>
          <Segmented
            label="אחוז שומן"
            value={d.bfMode ?? 'unknown'}
            onChange={(bfMode) => up({ bfMode })}
            options={[
              { value: 'unknown', label: 'לא יודע' },
              { value: 'known', label: 'יודע' },
              { value: 'tape', label: 'אמדוד בסרט' },
            ]}
          />
          {d.bfMode === 'known' && (
            <>
              <NumberField label="אחוז שומן" value={d.bodyFatPct} onChange={(bodyFatPct) => up({ bodyFatPct })} unit="%" min={3} max={60} />
              <Segmented
                label="מקור המדידה"
                value={(d.bodyFatSource as 'dexa') ?? 'estimate'}
                onChange={(bodyFatSource) => up({ bodyFatSource })}
                options={[
                  { value: 'dexa', label: 'DEXA' },
                  { value: 'bia', label: 'משקל חכם' },
                  { value: 'estimate', label: 'הערכה' },
                ]}
              />
            </>
          )}
          {d.bfMode === 'tape' && (
            <div className="grid2">
              <NumberField label="היקף מותן (בגובה הטבור)" value={d.waist} onChange={(waist) => up({ waist })} unit='ס"מ' min={40} max={200} />
              <NumberField label="היקף צוואר" value={d.neck} onChange={(neck) => up({ neck })} unit='ס"מ' min={20} max={70} />
              {d.sex === 'female' && <NumberField label="היקף ירכיים" value={d.hip} onChange={(hip) => up({ hip })} unit='ס"מ' min={50} max={200} />}
            </div>
          )}
          {(d.bfMode ?? 'unknown') === 'unknown' && <p className="fineprint">נעריך לפי גובה, משקל, גיל ומין. זו הערכה גסה, ואפשר לעדכן אחר כך.</p>}
        </>
      )}

      {step === 3 && (
        <>
          <h1>שאלון התאמה</h1>
          <p className="lead">התשובות קובעות איזו תוכנית מתאימה לך ומתי לעצור. האפליקציה לא מאבחנת מחלות.</p>
          <h3 className="sub">מוכנות לפעילות (PAR-Q+)</h3>
          <YesNo question="האם רופא אמר לך שיש לך בעיה בלב או ביתר לחץ דם?" value={sc.parqHeart} onChange={(v) => setSc('parqHeart', v)} />
          <YesNo question="האם יש לך כאבים בחזה במנוחה או במאמץ?" value={sc.parqChestPain} onChange={(v) => setSc('parqChestPain', v)} />
          <YesNo question="האם קרה לך שאיבדת שיווי משקל מסחרחורת או איבדת הכרה בשנה האחרונה?" value={sc.parqDizziness} onChange={(v) => setSc('parqDizziness', v)} />
          <YesNo question="האם אתה נוטל תרופות ללחץ דם או ללב?" value={sc.parqBloodPressureMeds} onChange={(v) => setSc('parqBloodPressureMeds', v)} />
          <YesNo question="האם יש לך בעיה בעצמות או במפרקים שעלולה להחמיר במאמץ?" value={sc.parqJointProblem} onChange={(v) => setSc('parqJointProblem', v)} />
          <h3 className="sub">מצב רפואי</h3>
          {d.sex === 'female' && <YesNo question="האם את בהריון או מניקה?" why="בהריון ובהנקה לא בונים גירעון קלורי." value={sc.pregnantOrBreastfeeding} onChange={(v) => setSc('pregnantOrBreastfeeding', v)} />}
          <YesNo question="סוכרת שמטופלת באינסולין?" why="שינוי בפחמימות משפיע על המינון." value={sc.diabetesInsulin} onChange={(v) => setSc('diabetesInsulin', v)} />
          <YesNo question="מחלת כליות?" why="משפיע על כמות החלבון המותרת." value={sc.kidneyDisease} onChange={(v) => setSc('kidneyDisease', v)} />
          <YesNo question="תרופה מקבוצת GLP-1 (למשל אוזמפיק)?" value={sc.glp1} onChange={(v) => setSc('glp1', v)} />
          <YesNo question="מחלת בלוטת התריס או מחלת מעי דלקתית?" value={sc.thyroid || sc.ibd} onChange={(v) => up({ screening: { ...sc, thyroid: v, ibd: v } })} />
          <h3 className="sub">הרגלי אכילה</h3>
          <p className="fineprint">חמש שאלות קצרות (שאלון SCOFF). הן עוזרות לנו לוודא שמעקב קלוריות יתאים לך.</p>
          <YesNo question="האם קורה שאתה גורם לעצמך להקיא כי אתה מרגיש מלא מדי?" value={sc.scoffSick} onChange={(v) => setSc('scoffSick', v)} />
          <YesNo question="האם אתה חושש שאיבדת שליטה על כמה שאתה אוכל?" value={sc.scoffControl} onChange={(v) => setSc('scoffControl', v)} />
          <YesNo question='האם ירדת לאחרונה יותר מ-6 ק"ג בתוך 3 חודשים?' value={sc.scoffLost6kg} onChange={(v) => setSc('scoffLost6kg', v)} />
          <YesNo question="האם אתה מרגיש שמן כשאחרים אומרים שאתה רזה מדי?" value={sc.scoffBelieveFat} onChange={(v) => setSc('scoffBelieveFat', v)} />
          <YesNo question="האם אוכל שולט בחיים שלך?" value={sc.scoffFoodDominates} onChange={(v) => setSc('scoffFoodDominates', v)} />
          {safety && safety.reasons.length > 0 && (
            <Banner kind="safety">
              <strong>מה זה אומר בשבילך:</strong>
              <ul>
                {safety.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Banner>
          )}
        </>
      )}

      {step === 4 && (
        <>
          <h1>פעילות והרגלים</h1>
          <label className="field">
            <span className="field-label">רמת פעילות כללית</span>
            <select value={d.activity ?? 'moderate'} onChange={(e) => up({ activity: e.target.value as Profile['activity'] })}>
              {Object.entries(ACTIVITY_FACTORS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid2">
            <NumberField label="אימונים בשבוע" value={d.trainingDaysPerWeek ?? 3} onChange={(v) => up({ trainingDaysPerWeek: v })} min={0} max={14} />
            <NumberField label="שעות שינה בלילה" value={d.sleepHours ?? 7} onChange={(v) => up({ sleepHours: v })} min={3} max={12} />
            <NumberField label="ארוחות ביום" value={d.mealsPerDay ?? 4} onChange={(v) => up({ mealsPerDay: v })} min={3} max={5} />
            <NumberField label="זמן הכנה מקסימלי" value={d.maxPrepMinutes ?? 30} onChange={(v) => up({ maxPrepMinutes: v })} unit="דקות" min={5} max={120} />
          </div>
          <Toggle label="אני עושה אימוני כוח" desc="משפיע על יעד החלבון ועל התחזית" checked={d.strengthTraining ?? true} onChange={(strengthTraining) => up({ strengthTraining })} />
          {(d.sleepHours ?? 7) < 6 && <Banner>שינה קצרה מקשה על שמירת שריר ועל התיאבון. נבחר קצב שמרני יותר.</Banner>}
        </>
      )}

      {step === 5 && (
        <>
          <h1>העדפות</h1>
          <Segmented
            label="סגנון תזונה"
            value={d.diet ?? 'omnivore'}
            onChange={(diet) => up({ diet })}
            options={[
              { value: 'omnivore', label: 'הכול' },
              { value: 'vegetarian', label: 'צמחוני' },
              { value: 'vegan', label: 'טבעוני' },
            ]}
          />
          <Toggle label="כשר" desc="בלי בשר וחלב באותה מנה" checked={d.kosher ?? false} onChange={(kosher) => up({ kosher })} />
          <h3 className="sub">אלרגיות</h3>
          <p className="fineprint">אלרגיה היא חסימה מוחלטת: מנות עם הרכיב לא יופיעו בתפריט.</p>
          <div className="chips">
            {ALLERGENS.map((a) => {
              const on = (d.allergies ?? []).includes(a.value);
              return (
                <button key={a.value} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => up({ allergies: on ? (d.allergies ?? []).filter((x) => x !== a.value) : [...(d.allergies ?? []), a.value] })}>
                  {a.label}
                </button>
              );
            })}
          </div>
          <label className="field">
            <span className="field-label">מאכלים שאתה לא אוהב (מופרדים בפסיק)</span>
            <input value={(d.dislikes ?? []).join(', ')} onChange={(e) => up({ dislikes: e.target.value.split(',').map((x) => x.trim()) })} placeholder="למשל: טונה, חציל" />
          </label>
        </>
      )}

      {step === 6 && profile && (
        <>
          <h1>משקל יעד</h1>
          <p className="lead">לאיזה משקל תרצה להגיע? אם יש תאריך שחשוב לך, נבדוק אם אפשר להגיע אליו בקצב בטוח, ונבנה את הקצב לפיו.</p>
          <NumberField label="משקל יעד" value={d.targetWeightKg} onChange={(v) => up({ targetWeightKg: v ?? undefined })} unit='ק"ג' min={35} max={250} step={0.5} hint={`היום: ${fmt(profile.weightKg, 1)} ק"ג`} />
          {d.targetWeightKg !== undefined && d.targetWeightKg < minHealthyWeight(profile.heightCm) && (
            <Banner kind="safety">המשקל הזה נמוך מהטווח הבריא לגובה שלך (BMI 18.5, כ-{fmt(minHealthyWeight(profile.heightCm), 1)} ק"ג). בחר יעד של {fmt(minHealthyWeight(profile.heightCm), 1)} ק"ג ומעלה.</Banner>
          )}
          <Toggle label="יש לי תאריך יעד" desc="למשל חתונה, תחרות או חופשה" checked={!!d.targetDate} onChange={(on) => up({ targetDate: on ? isoIn(12) : undefined })} />
          {d.targetDate && (
            <label className="field">
              <span className="field-label">עד מתי?</span>
              <span className="field-input">
                <input type="date" value={d.targetDate} min={isoIn(2)} onChange={(e) => up({ targetDate: e.target.value || undefined })} />
              </span>
            </label>
          )}
          {targets?.goalPlan ? (
            <div className={`insight ${targets.goalPlan.feasible === false ? 'warn' : ''}`}>
              <strong>{targets.goalPlan.feasible === false ? 'התאריך קרוב מדי לקצב בטוח' : 'הקצב שנבחר עבורך'}</strong>
              <p>{targets.goalPlan.insight}</p>
              <div className="insight-nums">
                <span>
                  <b dir="ltr">{fmt(targets.weeklyChangeKg.value, 2)}</b> ק"ג בשבוע
                </span>
                <span>
                  <b>{fmt(targets.kcal.value)}</b> קק"ל ביום
                </span>
                {targets.goalPlan.etaISO && (
                  <span>
                    יעד: <b>{new Date(targets.goalPlan.etaISO).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
                  </span>
                )}
              </div>
              {targets.floorApplied && <p className="fineprint">היעד הקלורי נעצר ברצפה הבטוחה, ולכן ההתקדמות תהיה מעט איטית יותר מהחישוב.</p>}
            </div>
          ) : (
            <p className="fineprint">אפשר גם בלי משקל יעד: נבחר קצב לפי המטרה שלך, ותוכל להוסיף יעד בפרופיל.</p>
          )}
        </>
      )}

      {step === 7 && profile && targets && fc && (
        <>
          <h1>רגע הגילוי</h1>
          {safety?.flags.includes('hide_avatar') ? (
            <Banner kind="safety">בחרנו לא להציג תחזית גוף בשלב הזה. נתמקד באכילה מסודרת ובהרגשה שלך.</Banner>
          ) : (
            <>
              <p className="lead">{targets.goalPlan ? `ככה הגוף שלך משתנה בדרך ל-${fmt(targets.goalPlan.targetKg, 1)} ק"ג. לחצו ▶ כדי לראות את השינוי, או גררו את הסרגל.` : 'ככה הגוף שלך צפוי להשתנות בחצי השנה הקרובה. לחצו ▶ כדי לראות את השינוי.'}</p>
              {!targets.goalPlan && (
                <Segmented
                  label="קצב"
                  value={d.pace ?? 'balanced'}
                  onChange={(pace) => up({ pace })}
                  options={[
                    { value: 'gentle', label: 'רגוע' },
                    { value: 'balanced', label: 'מאוזן' },
                    { value: 'fast', label: 'מהיר' },
                  ]}
                />
              )}
              <BodyJourney profile={profile} targets={targets} height={340} />
            </>
          )}
        </>
      )}

      {step === 8 && targets && (
        <>
          <h1>התוכנית שלך</h1>
          {targets.floorApplied && <Banner kind="warn">היעד הועלה לרצפה הבטוחה. לא נוריד אותו מתחתיה.</Banner>}
          <div className="plan-summary">
            <div className="big-num">
              {fmt(targets.kcal.value)} <small>קק"ל ביום</small> <WhyButton title="יעד קלורי" e={targets.kcal} />
            </div>
            <div className="plan-row">
              <span>
                חלבון <WhyButton title="יעד חלבון" e={targets.proteinG} />
              </span>
              <b>{targets.proteinG.value} ג׳</b>
            </div>
            <div className="plan-row">
              <span>
                פחמימה <WhyButton title="יעד פחמימה" e={targets.carbsG} />
              </span>
              <b>{targets.carbsG.value} ג׳</b>
            </div>
            <div className="plan-row">
              <span>
                שומן <WhyButton title="יעד שומן" e={targets.fatG} />
              </span>
              <b>{targets.fatG.value} ג׳</b>
            </div>
            <div className="plan-row">
              <span>
                הוצאה יומית משוערת <InfoDot id="tdee" /> <WhyButton title="הוצאה יומית" e={targets.tdee} />
              </span>
              <b>{fmt(targets.tdee.value)} קק"ל</b>
            </div>
            <div className="plan-row">
              <span>
                שינוי צפוי בשבוע <WhyButton title="קצב שינוי" e={targets.weeklyChangeKg} />
              </span>
              <b dir="ltr">{targets.weeklyChangeKg.value > 0 ? '+' : ''}{fmt(targets.weeklyChangeKg.value, 2)} ק"ג</b>
            </div>
          </div>
          {safety?.flags.includes('refer_dietitian') && <Banner kind="warn">מומלץ לעבור על התוכנית עם דיאטנית קלינית.</Banner>}
          {safety?.flags.includes('needs_doctor_for_training') && <Banner kind="warn">לפני תוכנית אימונים, מומלץ לקבל אישור רופא.</Banner>}
          <div className="insight">
            <strong>תזכורות</strong>
            <p>נזכיר לך בשעות הארוחות, בבוקר השקילה ובערב נשלח הודעת עידוד קצרה. אפשר לשנות שעות ולהוסיף תזכורות משלך בפרופיל.</p>
            {typeof window !== 'undefined' && 'Notification' in window && window.top === window.self && Notification.permission === 'default' && (
              <Button kind="secondary" onClick={() => import('../state/notify').then((m) => m.askNotifyPermission())}>
                לאפשר התראות
              </Button>
            )}
          </div>
          <p className="fineprint">אחרי שבועיים של רישום, נבדוק אם ההוצאה היומית שלך שונה מההערכה, ונציע עדכון.</p>
        </>
      )}

      <div className="onb-nav">
        {step > 0 && (
          <Button kind="ghost" onClick={() => go(step - 1)}>
            חזרה
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={() => go(step + 1)} disabled={!canNext[step]}>
            {step === 0 ? 'בוא נתחיל' : step === 6 && d.targetWeightKg === undefined ? 'דלג' : 'המשך'}
          </Button>
        ) : (
          <Button onClick={finish}>יאללה, מתחילים</Button>
        )}
      </div>
    </div>
  );
}
