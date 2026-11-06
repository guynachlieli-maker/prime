import { useMemo, useRef, useState } from 'react';
import { Avatar3D } from '../ui/LazyAvatar';
import { WeightChart } from '../ui/WeightChart';
import { Banner, Button, Card, Empty, InfoDot, NumberField, Segmented, Sheet, WhyButton, fmt } from '../ui/kit';
import { setState, todayISO, useStore, type Measurement } from '../state/store';
import { forecastBody, weeksToTarget } from '../engine/forecast';
import { weightTrend } from '../engine/adaptive';
import { dailyIntake, useAdaptive, useSafety } from '../state/derived';

const WEEKS = [0, 4, 8, 12, 24] as const;
const PHOTOS = 'prime.photos';

function loadPhotos(): { date: string; src: string }[] {
  try {
    return JSON.parse(localStorage.getItem(PHOTOS) ?? '[]');
  } catch {
    return [];
  }
}

export function Progress() {
  const s = useStore((x) => x);
  const safety = useSafety();
  const adaptive = useAdaptive();
  const [week, setWeek] = useState<(typeof WEEKS)[number]>(12);
  const [twin, setTwin] = useState(true);
  const [mOpen, setMOpen] = useState(false);
  const [m, setM] = useState<Measurement>({ date: todayISO() });
  const [photos, setPhotos] = useState(loadPhotos);
  const [targetKg, setTargetKg] = useState<number | undefined>();
  const photoRef = useRef<HTMLInputElement>(null);
  const p = s.profile;
  const t = s.targets;

  const trend = useMemo(() => weightTrend(s.weighIns), [s.weighIns]);
  const currentKg = trend.length ? trend[trend.length - 1].trend : p?.weightKg ?? 0;
  const fc = useMemo(
    () =>
      p && t
        ? forecastBody({ sex: p.sex, age: p.age, heightCm: p.heightCm, weightKg: currentKg, bodyFatPct: p.bodyFatPct ?? 25, tdee: t.tdee.value, intakeKcal: t.kcal.value, strengthTraining: p.strengthTraining, weeks: 24 })
        : [],
    [p, t, currentKg],
  );
  if (!p || !t) return null;
  const hide = s.settings.hideAvatar || safety?.flags.includes('hide_avatar');
  const at = fc[week] ?? fc[0];
  const startIso = trend.length ? trend[trend.length - 1].date : todayISO();
  const fcBand = fc.slice(0, 7).map((f) => {
    const d = new Date(startIso + 'T12:00:00');
    d.setDate(d.getDate() + f.week * 7);
    return { date: todayISO(d), mid: f.weightKg, low: f.weightLowKg, high: f.weightHighKg };
  });
  const eta = targetKg ? weeksToTarget({ sex: p.sex, age: p.age, heightCm: p.heightCm, weightKg: currentKg, bodyFatPct: p.bodyFatPct ?? 25, tdee: t.tdee.value, intakeKcal: t.kcal.value, strengthTraining: p.strengthTraining, weeks: 104 }, targetKg) : null;
  const minHealthyKg = Math.round(18.5 * (p.heightCm / 100) ** 2 * 10) / 10;

  // Weekly report: last 7 days vs the 7 before
  const intake = dailyIntake(s);
  const last7 = intake.filter((d) => d.date > todayISO(new Date(Date.now() - 8 * 864e5)) && d.date < todayISO());
  const avgKcal = last7.length ? last7.reduce((a, b) => a + b.kcal, 0) / last7.length : 0;
  const trendWeekAgo = trend.filter((x) => x.date <= todayISO(new Date(Date.now() - 7 * 864e5))).pop();
  const weekChange = trendWeekAgo && trend.length ? trend[trend.length - 1].trend - trendWeekAgo.trend : null;
  const proteinDays = s.logs.length ? new Set(s.logs.filter((l) => l.date >= todayISO(new Date(Date.now() - 7 * 864e5))).map((l) => l.date)).size : 0;
  const lastM = s.measurements[s.measurements.length - 1];
  const firstM = s.measurements[0];

  return (
    <div className="screen">
      <h1>התקדמות</h1>

      {hide ? (
        <Banner kind="info">התצוגה של הגוף כבויה. אפשר להפעיל אותה בהגדרות. המעקב ממשיך עם מספרים בלבד.</Banner>
      ) : (
        <Card className="avatar-card">
          <div className="row between">
            <Segmented label="תצוגה" value={twin ? 'twin' : 'one'} onChange={(v) => setTwin(v === 'twin')} options={[{ value: 'twin', label: 'היום מול התחזית' }, { value: 'one', label: 'גוף אחד' }]} />
          </div>
          <Avatar3D
            height={340}
            bodies={
              twin
                ? [
                    { sex: p.sex, heightCm: p.heightCm, weightKg: fc[0].weightKg, bodyFatPct: fc[0].bodyFatPct, label: 'היום', color: '#5ad1e6' },
                    { sex: p.sex, heightCm: p.heightCm, weightKg: at.weightKg, bodyFatPct: at.bodyFatPct, label: week === 0 ? 'היום' : `בעוד ${week} שבועות`, color: '#9b8cff' },
                  ]
                : [{ sex: p.sex, heightCm: p.heightCm, weightKg: at.weightKg, bodyFatPct: at.bodyFatPct, label: '', color: week === 0 ? '#5ad1e6' : '#9b8cff' }]
            }
          />
          <div className="week-slider" role="radiogroup" aria-label="נקודת זמן">
            {WEEKS.map((w) => (
              <button key={w} role="radio" aria-checked={week === w} className={week === w ? 'on' : ''} onClick={() => setWeek(w)}>
                {w === 0 ? 'היום' : `${w} ש׳`}
              </button>
            ))}
          </div>
          <div className="data-layer">
            <div>
              <span>משקל</span>
              <b>
                {week === 0 ? fmt(at.weightKg, 1) : `${fmt(at.weightLowKg, 1)}-${fmt(at.weightHighKg, 1)}`} ק"ג
              </b>
            </div>
            <div>
              <span>אחוז שומן</span>
              <b>{fmt(at.bodyFatPct, 1)}%</b>
            </div>
            <div>
              <span>מסת שומן</span>
              <b>{fmt(at.fatKg, 1)} ק"ג</b>
            </div>
            <div>
              <span>מסה רזה</span>
              <b>{fmt(at.leanKg, 1)} ק"ג</b>
            </div>
          </div>
          <p className="fineprint">
            {week === 0 ? 'המצב היום לפי המגמה שלך.' : 'הערכה לפי היעד הנוכחי. כל גוף מגיב אחרת.'} {p.bodyFatSource === 'estimate' && 'אחוז השומן ההתחלתי הוא הערכה לפי BMI.'}{' '}
            <WhyButton title="איך מחושבת התחזית" e={{ why: 'מודל יומי של מאזן אנרגיה. השינוי מתחלק בין שומן לשריר לפי היחס של Forbes, ואימוני כוח מקטינים את חלק השריר שיורד. הטווח מבטא אי־ודאות של 10% בהוצאה היומית. כל שבוע התחזית מתעדכנת לפי המדידות שלך.', sources: ['hall2011', 'forbes'] }} />
          </p>
        </Card>
      )}

      <Card title={<>מגמת משקל <InfoDot id="trend" /></>}>
        {trend.length < 2 ? (
          <Empty title="עוד אין מספיק שקילות" text='הישקלו במסך "היום". אחרי שתי שקילות יופיע גרף, ואחרי שבועיים נוכל לעדכן את היעדים.' />
        ) : (
          <WeightChart points={trend} forecast={hide ? [] : fcBand} />
        )}
        <div className="legend">
          <span>
            <i className="dot" style={{ background: 'var(--accent)' }} /> מגמה
          </span>
          <span>
            <i className="dot" style={{ background: 'var(--muted)' }} /> שקילות
          </span>
          {!hide && (
            <span>
              <i className="dot" style={{ background: 'var(--accent2)' }} /> תחזית וטווח
            </span>
          )}
        </div>
        {!hide && (
          <div className="eta">
            <NumberField label="יעד משקל (לא חובה)" value={targetKg} onChange={setTargetKg} unit='ק"ג' min={minHealthyKg} max={250} hint={`מינימום ${fmt(minHealthyKg, 1)} ק"ג (BMI 18.5)`} />
            {eta && targetKg && targetKg >= minHealthyKg && (
              <p>
                {eta.earliest === null ? 'בקצב הנוכחי היעד לא מתקרב. שנו קצב או מטרה.' : `בקצב הנוכחי: בין שבוע ${eta.earliest} לשבוע ${eta.latest ?? 'מאוחר יותר'}.`}
              </p>
            )}
          </div>
        )}
      </Card>

      <Card title="הדוח השבועי">
        <div className="report">
          <div>
            <h4>מה קרה</h4>
            <p>
              {last7.length ? `ממוצע ${fmt(avgKcal)} קק"ל ביום ב-${last7.length} ימים עם רישום.` : 'השבוע לא נרשמו ארוחות.'}
              {weekChange !== null && ` המגמה זזה ${weekChange > 0 ? '+' : ''}${fmt(weekChange, 2)} ק"ג.`}
              {proteinDays ? ` רשמת אוכל ב-${proteinDays} ימים.` : ''}
            </p>
          </div>
          <div>
            <h4>מה זה אומר</h4>
            <p>
              {weekChange === null
                ? 'צריך עוד כמה שקילות כדי לדעת.'
                : Math.abs(weekChange - t.weeklyChangeKg.value) < 0.25
                  ? 'אתה בקצב שתכננו.'
                  : weekChange < t.weeklyChangeKg.value
                    ? 'הירידה מהירה מהמתוכנן. חשוב לאכול מספיק.'
                    : 'השינוי איטי מהמתוכנן. לפעמים זה מים; נבדוק שוב בשבוע הבא.'}
            </p>
          </div>
          <div>
            <h4>מה משתנה השבוע</h4>
            <p>
              {adaptive?.ready && adaptive.suggestedTdee && Math.abs(adaptive.suggestedTdee - t.tdee.value) >= 50
                ? `מוצע לעדכן את ההוצאה היומית ל-${fmt(adaptive.suggestedTdee)} קק"ל. אפשר לאשר במסך "היום".`
                : adaptive?.ready
                  ? 'היעדים מדויקים. אין שינוי.'
                  : `עוד לא מספיק נתונים לעדכון: ${adaptive?.reason ?? ''}`}
            </p>
          </div>
        </div>
      </Card>

      <Card title="היקפים" action={<Button kind="secondary" onClick={() => setMOpen(true)}>מדידה חדשה</Button>}>
        {!lastM ? (
          <Empty title="אין מדידות" text="מדידה שבועית של מותן וירכיים מראה התקדמות גם כשהמשקל לא זז." />
        ) : (
          <table className="mtable">
            <thead>
              <tr>
                <th>היקף</th>
                <th>התחלה</th>
                <th>אחרון</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['waistCm', 'מותן'],
                  ['hipCm', 'ירכיים'],
                  ['chestCm', 'חזה'],
                  ['armCm', 'זרוע'],
                  ['thighCm', 'ירך'],
                ] as const
              ).map(([k, label]) =>
                lastM[k] ? (
                  <tr key={k}>
                    <td>{label}</td>
                    <td>{firstM[k] ? fmt(firstM[k]!, 1) : '—'}</td>
                    <td>
                      {fmt(lastM[k]!, 1)}
                      {firstM[k] && firstM !== lastM ? <small dir="ltr"> ({lastM[k]! - firstM[k]! > 0 ? '+' : ''}{fmt(lastM[k]! - firstM[k]!, 1)})</small> : null}
                    </td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="תמונות התקדמות" action={<Button kind="secondary" onClick={() => photoRef.current?.click()}>תמונה חדשה</Button>}>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const bmp = await createImageBitmap(f);
            const sc = Math.min(1, 360 / Math.max(bmp.width, bmp.height));
            const c = document.createElement('canvas');
            c.width = bmp.width * sc;
            c.height = bmp.height * sc;
            c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
            const next = [...photos, { date: todayISO(), src: c.toDataURL('image/jpeg', 0.7) }].slice(-12);
            setPhotos(next);
            try {
              localStorage.setItem(PHOTOS, JSON.stringify(next));
            } catch {
              /* storage full */
            }
          }}
        />
        {photos.length === 0 ? (
          <Empty title="אין תמונות" text="תמונה כל שבועיים, באותה תאורה ובאותה תנוחה. התמונות נשמרות רק במכשיר הזה." />
        ) : (
          <div className="photos">
            {photos.length >= 2 && (
              <div className="compare-photos">
                <figure>
                  <img src={photos[0].src} alt={`תמונה מ-${photos[0].date}`} />
                  <figcaption>{photos[0].date}</figcaption>
                </figure>
                <figure>
                  <img src={photos[photos.length - 1].src} alt={`תמונה מ-${photos[photos.length - 1].date}`} />
                  <figcaption>{photos[photos.length - 1].date}</figcaption>
                </figure>
              </div>
            )}
            <p className="fineprint">{photos.length} תמונות · נשמרות במכשיר בלבד.</p>
          </div>
        )}
      </Card>

      <Sheet open={mOpen} onClose={() => setMOpen(false)} title="מדידת היקפים">
        <p className="fineprint">מודדים בבוקר, עם סרט רך, בלי למתוח. מותן: בגובה הטבור.</p>
        <div className="grid2">
          <NumberField label="מותן" value={m.waistCm} onChange={(v) => setM({ ...m, waistCm: v })} unit='ס"מ' min={40} max={200} />
          <NumberField label="ירכיים" value={m.hipCm} onChange={(v) => setM({ ...m, hipCm: v })} unit='ס"מ' min={50} max={200} />
          <NumberField label="חזה" value={m.chestCm} onChange={(v) => setM({ ...m, chestCm: v })} unit='ס"מ' min={50} max={200} />
          <NumberField label="זרוע" value={m.armCm} onChange={(v) => setM({ ...m, armCm: v })} unit='ס"מ' min={15} max={70} />
          <NumberField label="ירך" value={m.thighCm} onChange={(v) => setM({ ...m, thighCm: v })} unit='ס"מ' min={30} max={110} />
        </div>
        <Button
          full
          onClick={() => {
            setState((x) => ({ measurements: [...x.measurements, { ...m, date: todayISO() }] }));
            setMOpen(false);
            setM({ date: todayISO() });
          }}
        >
          שמירה
        </Button>
      </Sheet>
    </div>
  );
}
