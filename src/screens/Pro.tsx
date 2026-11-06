import { useMemo, useState } from 'react';
import { Banner, Button, Card, Sheet, fmt } from '../ui/kit';
import { WeightChart } from '../ui/WeightChart';
import { weightTrend } from '../engine/adaptive';
import { todayISO } from '../state/store';

type Status = 'on_track' | 'drifting' | 'silent';

interface DemoClient {
  id: string;
  label: string;
  goal: string;
  targetKcal: number;
  avgKcal: number;
  proteinHitPct: number;
  daysSinceLog: number;
  weighIns: { date: string; kg: number }[];
  shares: { food: boolean; weight: boolean; photos: boolean; medical: boolean };
}

function makeClients(): DemoClient[] {
  const goals = ['ירידה בשומן', 'בניית שריר', 'ריקומפוזיציה', 'סבולת', 'ירידה בשומן', 'בריאות כללית'];
  return goals.map((goal, i) => {
    const start = 70 + i * 6;
    const slope = goal === 'בניית שריר' ? 0.03 : goal === 'סבולת' ? 0 : -0.06 + (i === 4 ? 0.08 : 0);
    const weighIns = Array.from({ length: 21 }, (_, d) => {
      const dt = new Date();
      dt.setDate(dt.getDate() - (20 - d));
      return { date: todayISO(dt), kg: Math.round((start + slope * d + Math.sin(d * 1.3 + i) * 0.35) * 10) / 10 };
    });
    const daysSinceLog = i === 3 ? 4 : i === 5 ? 3 : 0;
    const targetKcal = 1900 + i * 150;
    return {
      id: `c${i + 1}`,
      label: `מתאמן/ת ${i + 1}`,
      goal,
      targetKcal,
      avgKcal: targetKcal + (i === 4 ? 420 : (i % 2 ? 60 : -40)),
      proteinHitPct: [92, 85, 60, 0, 70, 0][i],
      daysSinceLog,
      weighIns,
      shares: { food: true, weight: true, photos: i % 2 === 0, medical: false },
    };
  });
}

function status(c: DemoClient): Status {
  if (c.daysSinceLog >= 3) return 'silent';
  if (Math.abs(c.avgKcal - c.targetKcal) / c.targetKcal > 0.1 || c.proteinHitPct < 75) return 'drifting';
  return 'on_track';
}

const STATUS_LABEL: Record<Status, string> = { on_track: 'עומד ביעד', drifting: 'סוטה', silent: 'לא רשם 3 ימים' };
const ORDER: Record<Status, number> = { silent: 0, drifting: 1, on_track: 2 };

export function Pro({ back }: { back: () => void }) {
  const clients = useMemo(makeClients, []);
  const [open, setOpen] = useState<DemoClient | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState<Record<string, string[]>>({});
  const sorted = [...clients].sort((a, b) => ORDER[status(a)] - ORDER[status(b)]);

  return (
    <div className="screen pro">
      <div className="row between">
        <h1>פורטל מקצוענים</h1>
        <Button kind="ghost" onClick={back}>
          חזרה
        </Button>
      </div>
      <Banner kind="info">תצוגת הדגמה עם נתונים בדויים. בגרסה המלאה, המתאמנים מצטרפים בהזמנה ובוחרים מה לשתף.</Banner>

      <div className="pro-summary">
        {(['silent', 'drifting', 'on_track'] as Status[]).map((st) => (
          <div key={st} className={`pro-stat ${st}`}>
            <b>{clients.filter((c) => status(c) === st).length}</b>
            <span>{STATUS_LABEL[st]}</span>
          </div>
        ))}
      </div>

      <Card title="המתאמנים (ממוינים לפי צורך בתשומת לב)">
        <ul className="clients">
          {sorted.map((c) => {
            const st = status(c);
            const tr = weightTrend(c.weighIns);
            const ch = tr[tr.length - 1].trend - tr[Math.max(0, tr.length - 8)].trend;
            return (
              <li key={c.id}>
                <button onClick={() => setOpen(c)}>
                  <span className={`status-dot ${st}`} aria-hidden="true" />
                  <span className="c-main">
                    <strong>{c.label}</strong>
                    <span className="muted">
                      {c.goal} · {c.daysSinceLog ? `לא רשם ${c.daysSinceLog} ימים` : `ממוצע ${fmt(c.avgKcal)} / ${fmt(c.targetKcal)} קק"ל`}
                    </span>
                  </span>
                  <span className={`badge ${st === 'on_track' ? 'good' : 'warn'}`}>{STATUS_LABEL[st]}</span>
                  <span className="muted" dir="ltr">
                    {ch > 0 ? '+' : ''}
                    {fmt(ch, 1)} ק"ג/שבוע
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.label ?? ''}>
        {open && (
          <>
            <p className="muted">
              מטרה: {open.goal} · יעד: {fmt(open.targetKcal)} קק"ל · עמידה ביעד החלבון: {open.proteinHitPct}% מהימים
            </p>
            <div className="shares">
              משותף איתך:{' '}
              {Object.entries({ food: 'יומן אוכל', weight: 'משקל', photos: 'תמונות', medical: 'שאלון רפואי' }).map(([k, label]) => (
                <span key={k} className={`chip small ${open.shares[k as keyof DemoClient['shares']] ? 'on' : 'off'}`}>
                  {label}
                </span>
              ))}
            </div>
            <WeightChart points={weightTrend(open.weighIns)} forecast={[]} />
            <label className="field">
              <span className="field-label">הערות פנימיות (רק אתה רואה)</span>
              <textarea rows={3} value={notes[open.id] ?? ''} onChange={(e) => setNotes({ ...notes, [open.id]: e.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">הודעה למתאמן</span>
              <textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="למשל: שבוע מצוין! בוא ננסה להוסיף ארוחת ביניים עם חלבון." />
            </label>
            <Button
              disabled={!msg.trim()}
              onClick={() => {
                setSent({ ...sent, [open.id]: [...(sent[open.id] ?? []), msg.trim()] });
                setMsg('');
              }}
            >
              שליחה (הדגמה)
            </Button>
            {(sent[open.id] ?? []).length > 0 && (
              <ul className="msgs">
                {sent[open.id].map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </Sheet>
    </div>
  );
}
