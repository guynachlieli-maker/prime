import { useState } from 'react';
import { Banner, Button, Card, ChoiceCards, NumberField, Segmented, Toggle, fmt } from '../ui/kit';
import { deleteAllData, exportData, loadDemoData, saveProfile, setState, useStore } from '../state/store';
import { SAFETY_CONFIG } from '../engine/safety';
import { ACTIVITY_FACTORS } from '../engine/targets';
import type { Profile as P } from '../engine/types';
import type { Tab } from '../App';

export function Profile({ go, replayTour }: { go: (t: Tab) => void; replayTour: () => void }) {
  const s = useStore((x) => x);
  const [key, setKey] = useState(s.settings.apiKey ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
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

      <Card title="זיהוי אוכל מתמונה">
        <p className="muted">הזיהוי עובד דרך שירות AI חיצוני. באפליקציה המלאה, הקריאה עוברת דרך השרת שלנו. בגרסה הזו אפשר לחבר מפתח API אישי של Anthropic, והוא נשמר רק במכשיר.</p>
        <label className="field">
          <span className="field-label">מפתח API</span>
          <span className="field-input">
            <input type="password" dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-..." autoComplete="off" />
          </span>
        </label>
        <div className="row">
          <Button kind="secondary" onClick={() => setSettings({ apiKey: key.trim() || undefined })}>
            שמירה
          </Button>
          {s.settings.apiKey && (
            <Button
              kind="ghost"
              onClick={() => {
                setKey('');
                setSettings({ apiKey: undefined });
              }}
            >
              ניתוק
            </Button>
          )}
        </div>
        <Toggle label="לאפשר שימוש בתמונות לשיפור הזיהוי" desc="כבוי כברירת מחדל. בגרסה הזו אין שליחה כזו בכלל." checked={s.settings.trainingConsent} onChange={(trainingConsent) => setSettings({ trainingConsent })} />
      </Card>

      <Card title="מאמן או דיאטנית">
        <p className="muted">פורטל המקצוענים מציג למאמן את המתאמנים שלו. בגרסה הזו יש תצוגת הדגמה.</p>
        <Button kind="secondary" onClick={() => go('pro')}>
          לפורטל המקצוענים (הדגמה)
        </Button>
      </Card>

      <Card title="פרטיות ומידע">
        <ul className="plain">
          <li>כל המידע נשמר רק בדפדפן הזה. אין שרת, ואין שיתוף עם צד שלישי.</li>
          <li>תמונות הגוף נשמרות במכשיר בלבד.</li>
        </ul>
        <div className="row wrap">
          <Button kind="secondary" onClick={download}>
            הורדת כל המידע
          </Button>
          <Button kind="secondary" onClick={loadDemoData}>
            טעינת נתוני הדגמה (3 שבועות)
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

      <Card title="על האפליקציה">
        <p className="muted">PRIME היא אפליקציה לאורח חיים בריא. היא לא מאבחנת ולא מטפלת במחלות, והמידע בה לא מחליף ייעוץ רפואי.</p>
        <p className="fineprint">
          ערכי הבטיחות (רצפת קלוריות {SAFETY_CONFIG.absoluteKcalFloor.male}/{SAFETY_CONFIG.absoluteKcalFloor.female}, קצב ירידה עד {SAFETY_CONFIG.maxWeeklyLossPctOfBodyweight}% בשבוע):{' '}
          {SAFETY_CONFIG.approvedByClinician ? 'אושרו קלינית.' : 'ערכים שמרניים זמניים, ממתינים לאישור היועץ הקליני.'} ערכי המזון בגרסה הזו הם ערכים משוערים לפיתוח, ויוחלפו בערכי המאגר הרשמי.
        </p>
      </Card>
    </div>
  );
}
