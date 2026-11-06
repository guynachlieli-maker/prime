import { useState } from 'react';
import { Banner, Button, Card, Toggle } from '../ui/kit';
import { setState, uid, useStore } from '../state/store';
import { askNotifyPermission, downloadCalendar, motivationNow, notifyStatus, remindersOf, setReminders, type NotifyStatus } from '../state/notify';
import { ALL_DAYS, DAY_LABELS, type Reminder } from '../engine/reminders';

const KIND_LABEL: Record<Reminder['kind'], string> = { meal: 'ארוחה', weigh: 'שקילה', water: 'מים', motivation: 'מוטיבציה', custom: 'תזכורת שלי', training: 'אימון' };

function Days({ value, onChange }: { value: number[]; onChange: (d: number[]) => void }) {
  return (
    <div className="rem-days" role="group" aria-label="ימים">
      {ALL_DAYS.map((d) => {
        const on = value.includes(d);
        return (
          <button key={d} className={on ? 'on' : ''} aria-pressed={on} aria-label={`יום ${DAY_LABELS[d]}`} onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}>
            {DAY_LABELS[d]}
          </button>
        );
      })}
    </div>
  );
}

export function Reminders({ back }: { back: () => void }) {
  const s = useStore((x) => x);
  const list = remindersOf(s);
  const [perm, setPerm] = useState<NotifyStatus>(notifyStatus);
  const [text, setText] = useState('');
  const [time, setTime] = useState('10:00');
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [open, setOpen] = useState<string | null>(null);
  const embedded = typeof window !== 'undefined' && window.top !== window.self;
  const sample = motivationNow(s);

  const upd = (id: string, patch: Partial<Reminder>) => setReminders(list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const master = s.settings.reminders;

  return (
    <div className="screen">
      <div className="row between">
        <h1>תזכורות והתראות</h1>
        <Button kind="ghost" onClick={back}>
          חזרה
        </Button>
      </div>
      <p className="lead">תזכורות לשעות הארוחות, לשקילה ולשתייה, הודעת עידוד בערב, ותזכורות משלך בשעות קבועות.</p>

      <Card>
        <Toggle label="תזכורות פעילות" checked={master} onChange={(reminders) => setState((x) => ({ settings: { ...x.settings, reminders } }))} />
        {master && perm !== 'granted' && !embedded && perm !== 'unsupported' && (
          <Banner
            kind="info"
            action={
              perm === 'default' ? (
                <Button onClick={async () => setPerm(await askNotifyPermission())}>לאפשר התראות</Button>
              ) : undefined
            }
          >
            {perm === 'default' ? 'כדי שהתזכורות יקפצו גם כשהטלפון נעול, צריך לאשר התראות.' : 'ההתראות חסומות בדפדפן. אפשר לפתוח אותן בהגדרות האתר, או להוסיף את התזכורות ליומן (למטה).'}
          </Banner>
        )}
        {master && (embedded || perm === 'unsupported') && <Banner kind="info">כאן ההתראות מוצגות כשהאפליקציה פתוחה. כדי לקבל אותן גם כשהיא סגורה, הוסיפו את התזכורות ליומן בטלפון (למטה).</Banner>}
        {master && perm === 'granted' && <p className="fineprint">ההתראות מאושרות. באייפון הן מגיעות אחרי הוספת PRIME למסך הבית (שיתוף ← הוספה למסך הבית).</p>}
      </Card>

      {master && (
        <>
          <Card title="התזכורות שלך">
            <ul className="rem-list">
              {list.map((r) => (
                <li key={r.id} style={{ flexWrap: 'wrap' }}>
                  <input type="checkbox" checked={r.enabled} onChange={(e) => upd(r.id, { enabled: e.target.checked })} aria-label={`הפעלה: ${r.title}`} style={{ width: 22, height: 22 }} />
                  <button className="rem-text link" style={{ textAlign: 'start' }} onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                    <b>{r.kind === 'motivation' ? 'הודעת עידוד יומית' : r.title}</b>
                    <br />
                    <small className="muted">
                      {KIND_LABEL[r.kind]} · {r.days.length === 7 ? 'כל יום' : r.days.map((d) => DAY_LABELS[d]).join(' ')}
                    </small>
                  </button>
                  <input type="time" value={r.time} onChange={(e) => e.target.value && upd(r.id, { time: e.target.value })} aria-label={`שעה: ${r.title}`} />
                  {open === r.id && (
                    <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                      <Days value={r.days} onChange={(d) => upd(r.id, { days: d })} />
                      {r.kind === 'motivation' ? (
                        <p className="fineprint">
                          ההודעה נכתבת לפי היום שלך. למשל עכשיו: <b>{sample.title}</b> · {sample.body}
                        </p>
                      ) : (
                        r.body && <p className="fineprint">{r.body}</p>
                      )}
                      {r.kind === 'custom' && (
                        <Button kind="ghost" onClick={() => setReminders(list.filter((x) => x.id !== r.id))}>
                          מחיקה
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="fineprint">שעות הארוחות מתעדכנות לפי השעות שבהן אתה בדרך כלל רושם. תזכורת לארוחה שכבר נרשמה לא תקפוץ.</p>
          </Card>

          <Card title="תזכורת חדשה">
            <label className="field">
              <span className="field-label">מה להזכיר?</span>
              <input value={text} onChange={(e) => setText(e.target.value.slice(0, 80))} placeholder="למשל: לקחת ויטמין D, להכין אוכל למחר" />
            </label>
            <div className="row wrap" style={{ alignItems: 'center', gap: 12 }}>
              <label className="field" style={{ margin: 0 }}>
                <span className="field-label">שעה</span>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <Days value={days} onChange={setDays} />
            </div>
            <Button
              disabled={!text.trim() || !time || !days.length}
              onClick={() => {
                setReminders([...list, { id: `custom-${uid()}`, kind: 'custom', title: text.trim(), time, days, enabled: true, module: 'nutrition' }]);
                setText('');
              }}
            >
              הוספה
            </Button>
          </Card>

          <Card title="התראות גם כשהאפליקציה סגורה">
            <p className="muted">מוסיפים את התזכורות ליומן של הטלפון (Google, Apple או Outlook), והיומן מתריע בשעה שבחרת, בכל טלפון. אחרי שינוי שעות, מורידים שוב.</p>
            <Button kind="secondary" onClick={() => downloadCalendar(list)}>
              הוספה ליומן
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}
