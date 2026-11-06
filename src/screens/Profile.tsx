import { useRef, useState } from 'react';
import { summarize, EMPTY_LEARNING } from '../engine/learning';
import { RECIPES } from '../data/recipes';
import { Banner, Button, Card, ChoiceCards, NumberField, Segmented, Toggle, fmt } from '../ui/kit';
import { deleteAllData, exportData, saveProfile, setState, useStore } from '../state/store';
import { ACTIVITY_FACTORS } from '../engine/targets';
import { minHealthyWeight } from '../engine/pace';
import { SupplementPicker } from '../ui/SupplementPicker';
import type { Profile as P } from '../engine/types';
import type { Tab } from '../App';

export function Profile({ go, replayTour }: { go: (t: Tab) => void; replayTour: () => void }) {
  const s = useStore((x) => x);
  const [key, setKey] = useState(s.settings.apiKey ?? '');
  const [keyState, setKeyState] = useState<null | 'checking' | 'ok' | 'no_credit' | 'invalid' | 'error'>(null);
  const inClaude = typeof window !== 'undefined' && window.top !== window.self;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const learned = summarize(s.learning, (id) => RECIPES.find((r) => r.id === id)?.name ?? id);
  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    const bmp = await createImageBitmap(f);
    const side = Math.min(bmp.width, bmp.height);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    c.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
    setState({ profilePhoto: c.toDataURL('image/jpeg', 0.82) });
  };
  if (!s.profile) return null;
  const p = s.profile;
  const upd = (patch: Partial<P>) => saveProfile({ ...p, ...patch });
  const setSettings = (patch: Partial<typeof s.settings>) => setState((x) => ({ settings: { ...x.settings, ...patch } }));

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `prime-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="screen">
      <h1>פרופיל והגדרות</h1>

      <Card className="me">
        <div className="me-row">
          <button className="me-photo" onClick={() => photoRef.current?.click()} aria-label="החלפת תמונת פרופיל">
            {s.profilePhoto ? <img src={s.profilePhoto} alt="תמונת הפרופיל שלך" /> : <span>{p.name ? p.name.trim()[0] : '+'}</span>}
            <i className="me-edit" aria-hidden="true">✎</i>
          </button>
          <div className="me-text">
            <label className="field">
              <span className="field-label">שם</span>
              <input value={p.name} onChange={(e) => upd({ name: e.target.value.slice(0, 30) })} />
            </label>
            {s.profilePhoto && (
              <button className="link" onClick={() => setState({ profilePhoto: undefined })}>
                הסרת התמונה
              </button>
            )}
          </div>
        </div>
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
        <p className="fineprint">התמונה נשמרת רק במכשיר הזה.</p>
      </Card>

      <Card title="תזכורות והתראות" action={<Button kind="secondary" onClick={() => go('reminders')}>ניהול</Button>}>
        <p className="muted">{s.settings.reminders ? 'שעות ארוחה, שקילה, הודעת עידוד ותזכורות משלך.' : 'התזכורות כבויות.'}</p>
      </Card>

      <Card title="נתונים מהשעון או מהמשקל" action={<Button kind="secondary" onClick={() => go('devices')}>ייבוא</Button>}>
        <p className="muted">{s.devices.length ? `יובא מ: ${s.devices.map((d) => d.name).join(', ')}` : 'ייבוא צעדים, שינה, דופק ומשקל מקובץ הייצוא של השעון.'}</p>
      </Card>

      <Card title="מה המערכת למדה עליך">
        {learned.length === 0 ? (
          <p className="muted">עדיין לומדת. אחרי כמה ימים של רישום, החלפות מנות ותיקוני צילום, יופיע כאן מה למדנו ואיך זה משנה את התפריט וההערכות.</p>
        ) : (
          <ul className="learned">
            {learned.map((f) => (
              <li key={f.title}>
                <strong>{f.title}</strong>
                <span>{f.detail}</span>
              </li>
            ))}
          </ul>
        )}
        {s.tdeeOverride && <p className="muted">ההוצאה היומית שלך עודכנה לפי הנתונים בפועל: {fmt(s.tdeeOverride)} קק"ל.</p>}
        <p className="fineprint">הלמידה משנה רק את סדר ההעדפות והכיול. היא לא משנה את מעקות הבטיחות.</p>
        {(learned.length > 0 || s.tdeeOverride) && (
          <Button kind="ghost" onClick={() => setState({ learning: EMPTY_LEARNING, tdeeOverride: undefined })}>
            איפוס הלמידה
          </Button>
        )}
      </Card>

      <Card title="המטרה">
        <ChoiceCards
          value={p.goal}
          onChange={(goal) => upd({ goal })}
          options={[
            { value: 'fat_loss', label: 'ירידה בשומן' },
            { value: 'muscle_gain', label: 'בניית שריר' },
            { value: 'recomp', label: 'ריקומפוזיציה' },
            { value: 'performance', label: 'ביצועי ספורט' },
            { value: 'health', label: 'בריאות כללית' },
          ]}
        />
        <div className="grid2">
          <NumberField label="משקל יעד" value={p.targetWeightKg} onChange={(v) => (v === undefined ? upd({ targetWeightKg: undefined, targetDate: undefined }) : v >= minHealthyWeight(p.heightCm) && v <= 250 && upd({ targetWeightKg: v }))} unit='ק"ג' min={minHealthyWeight(p.heightCm)} max={250} step={0.5} hint="לא חובה" />
          <label className="field">
            <span className="field-label">תאריך יעד</span>
            <span className="field-input">
              <input type="date" value={p.targetDate ?? ''} min={new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)} onChange={(e) => upd({ targetDate: e.target.value || undefined })} disabled={!p.targetWeightKg} />
            </span>
          </label>
        </div>
        {s.targets?.goalPlan ? (
          <div className={`insight ${s.targets.goalPlan.feasible === false ? 'warn' : ''}`}>
            <p>{s.targets.goalPlan.insight}</p>
          </div>
        ) : (
          <Segmented
            label="קצב"
            value={p.pace}
            onChange={(pace) => upd({ pace })}
            options={[
              { value: 'gentle', label: 'רגוע' },
              { value: 'balanced', label: 'מאוזן' },
              { value: 'fast', label: 'מהיר' },
            ]}
          />
        )}
      </Card>

      <Card title="תוספי תזונה">
        <SupplementPicker
          value={p.supplements ?? []}
          vegan={p.diet === 'vegan'}
          onChange={(supplements) => {
            upd({ supplements });
            setState((x) => (x.reminders ? { reminders: x.reminders.filter((r) => !r.id.startsWith('supp-')) } : {}));
          }}
        />
        <p className="fineprint">המידע כללי. בהריון, במחלה כרונית או בנטילת תרופות, כדאי לבדוק תוספים עם רופא או רוקח.</p>
      </Card>

      <Card title="נתונים">
        <div className="grid2">
          <NumberField label="גיל" value={p.age} onChange={(v) => v && v >= 18 && v <= 100 && upd({ age: v })} min={18} max={100} />
          <NumberField label="גובה" value={p.heightCm} onChange={(v) => v && v >= 120 && v <= 230 && upd({ heightCm: v })} unit='ס"מ' min={120} max={230} />
          <NumberField label="אחוז שומן" value={p.bodyFatPct} onChange={(v) => v && v >= 3 && v <= 60 && upd({ bodyFatPct: v, bodyFatSource: 'estimate' })} unit="%" min={3} max={60} hint={p.bodyFatSource === 'estimate' ? 'הערכה' : p.bodyFatSource === 'navy' ? 'לפי היקפים' : p.bodyFatSource.toUpperCase()} />
          <NumberField label="ארוחות ביום" value={p.mealsPerDay} onChange={(v) => v && v >= 3 && v <= 5 && upd({ mealsPerDay: v })} min={3} max={5} />
        </div>
        <label className="field">
          <span className="field-label">רמת פעילות</span>
          <select value={p.activity} onChange={(e) => upd({ activity: e.target.value as P['activity'] })}>
            {Object.entries(ACTIVITY_FACTORS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <Toggle label="אימוני כוח" checked={p.strengthTraining} onChange={(strengthTraining) => upd({ strengthTraining })} />
        <p className="fineprint">משקל מתעדכן מהשקילות. נוכחי: {fmt(p.weightKg, 1)} ק"ג.</p>
        <Button
          kind="secondary"
          onClick={() => {
            try {
              localStorage.setItem('prime.draft', JSON.stringify({ ...p, step: 3, bfMode: 'known' }));
            } catch {
              /* ignore */
            }
            setState({ onboardingDone: false });
          }}
        >
          למלא שוב את שאלון ההתאמה
        </Button>
      </Card>

      <Card title="תצוגה">
        <Toggle label="תצוגה מפורטת" desc="סיבים, BMR ועוד מספרים במסך הבית" checked={s.settings.detailed} onChange={(detailed) => setSettings({ detailed })} />
        <Toggle label="להסתיר את הגוף התלת־ממדי" desc="לעבוד רק עם מספרים" checked={s.settings.hideAvatar} onChange={(hideAvatar) => setSettings({ hideAvatar })} />
        <Segmented
          label="ערכת צבעים"
          value={s.settings.theme}
          onChange={(theme) => setSettings({ theme })}
          options={[
            { value: 'system', label: 'לפי המכשיר' },
            { value: 'light', label: 'בהיר' },
            { value: 'dark', label: 'כהה' },
          ]}
        />
        <Button kind="ghost" onClick={replayTour}>
          להציג שוב את הסיור המודרך
        </Button>
      </Card>

      {!inClaude && (
        <Card title="זיהוי תמונות">
          <p className="muted">כדי שהאפליקציה תזהה אוכל ותוויות מתמונה, מזינים פעם אחת קוד גישה אישי. הקוד נשמר רק בטלפון הזה.</p>
          <label className="field">
            <span className="field-label">קוד גישה</span>
            <span className="field-input">
              <input type="password" dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" aria-label="קוד גישה לזיהוי תמונות" />
            </span>
          </label>
          <div className="row wrap">
            <Button
              kind="secondary"
              disabled={!key.trim() || keyState === 'checking'}
              onClick={async () => {
                setKeyState('checking');
                const { checkKey } = await import('../engine/vision');
                const r = await checkKey(key.trim());
                setKeyState(r);
                if (r === 'ok') setSettings({ apiKey: key.trim() });
              }}
            >
              {keyState === 'checking' ? 'בודק…' : 'שמירה והפעלה'}
            </Button>
            {s.settings.apiKey && (
              <Button
                kind="ghost"
                onClick={() => {
                  setKey('');
                  setKeyState(null);
                  setSettings({ apiKey: undefined });
                }}
              >
                ביטול
              </Button>
            )}
          </div>
          {keyState && keyState !== 'checking' && (
            <Banner kind={keyState === 'ok' ? 'info' : 'warn'}>
              {keyState === 'ok' ? 'זיהוי התמונות פעיל.' : keyState === 'no_credit' ? 'הקוד תקין, אבל אין יתרה בחשבון. אחרי טעינת יתרה, לחצו שוב "שמירה והפעלה".' : keyState === 'invalid' ? 'הקוד לא תקין. בדקו שהעתקתם אותו במלואו.' : 'לא הצלחנו לבדוק עכשיו. נסו שוב בעוד רגע.'}
            </Banner>
          )}
          {s.settings.apiKey && !keyState && <p className="fineprint">זיהוי התמונות פעיל.</p>}
        </Card>
      )}

      <Card title="פרטיות ומידע">
        <ul className="plain">
          <li>כל המידע נשמר רק בדפדפן הזה. אין שרת, ואין שיתוף עם צד שלישי.</li>
          <li>תמונות הגוף נשמרות במכשיר בלבד.</li>
        </ul>
        <div className="row wrap">
          <Button kind="secondary" onClick={download}>
            הורדת כל המידע
          </Button>
          {!confirmDelete ? (
            <Button kind="danger" onClick={() => setConfirmDelete(true)}>
              מחיקת כל המידע
            </Button>
          ) : (
            <Banner
              kind="warn"
              action={
                <div className="row">
                  <Button
                    kind="danger"
                    onClick={() => {
                      try {
                        localStorage.removeItem('prime.photos');
                      } catch {
                        /* ignore */
                      }
                      deleteAllData();
                    }}
                  >
                    כן, למחוק
                  </Button>
                  <Button kind="ghost" onClick={() => setConfirmDelete(false)}>
                    ביטול
                  </Button>
                </div>
              }
            >
              המחיקה סופית: פרופיל, רישומים, שקילות ותמונות.
            </Banner>
          )}
        </div>
      </Card>

      <Card title="הצהרה">
        <p className="muted">PRIME היא אפליקציה לאורח חיים בריא. המידע וההמלצות בה הם כלליים, ואינם מחליפים ייעוץ, אבחון או טיפול של רופא, דיאטנית או איש מקצוע מוסמך. במצב רפואי, בהריון, בהנקה או בנטילת תרופות, התייעצו עם איש מקצוע לפני שינוי תזונה.</p>
      </Card>
    </div>
  );
}
