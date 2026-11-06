import { useRef, useState } from 'react';
import { Banner, Button, Card, Empty, fmt } from '../ui/kit';
import { addDeviceData, addWeighIn, setState, todayISO, useStore } from '../state/store';
import { PROVIDERS, bluetoothSupported, type Provider } from '../engine/devices';

export function Devices({ back }: { back: () => void }) {
  const s = useStore((x) => x);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'info' | 'warn'; text: string } | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const hrStop = useRef<(() => void) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<Provider | null>(null);
  const bt = bluetoothSupported();
  const recent = s.deviceData.slice(-7).reverse();

  const importFile = async (files: FileList | null) => {
    const p = pending.current;
    if (!files?.length || !p) return;
    setMsg(null);
    setBusy(`מייבא מ-${p.name}…`);
    try {
      const { importHealthFile } = await import('../engine/devices');
      const all = (await Promise.all([...files].map((f) => importHealthFile(f, p.name)))).flat();
      if (!all.length) setMsg({ kind: 'warn', text: 'לא מצאנו בקובץ נתונים שאנחנו יודעים לקרוא. בדקו שזה קובץ הייצוא הנכון (ראו ההוראות).' });
      else {
        addDeviceData(all, { id: p.id, name: p.name, kind: 'file' });
        const fields = new Set(all.flatMap((d) => Object.keys(d).filter((k) => !['date', 'source'].includes(k))));
        setMsg({ kind: 'info', text: `יובאו ${all.length} ימים (${[...fields].map((f) => FIELD[f] ?? f).join(', ')}).` });
      }
    } catch {
      setMsg({ kind: 'warn', text: 'קריאת הקובץ נכשלה. נסו את קובץ הייצוא המקורי, בלי לפתוח ולשמור אותו מחדש.' });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const connectBt = async (p: Provider) => {
    setMsg(null);
    try {
      const { connectHeartRate, connectScale } = await import('../engine/devices');
      if (p.id === 'ble-hr') {
        const c = await connectHeartRate((v) => setBpm(v));
        hrStop.current = c.stop;
        addDeviceData([], { id: p.id, name: c.name, kind: 'bluetooth-hr' });
        setMsg({ kind: 'info', text: `מחובר ל-${c.name}.` });
      } else {
        setBusy('עלו על המשקל…');
        const c = await connectScale((kg) => {
          addWeighIn(kg);
          addDeviceData([{ date: todayISO(), source: c.name, weightKg: kg }], { id: p.id, name: c.name, kind: 'bluetooth-scale' });
          setBusy(null);
          setMsg({ kind: 'info', text: `נשקל: ${fmt(kg, 1)} ק"ג. נשמר במגמת המשקל.` });
          c.stop();
        });
      }
    } catch (e) {
      setBusy(null);
      const name = (e as { name?: string })?.name;
      if (name === 'NotFoundError') return; // the viewer closed the chooser
      setMsg({ kind: 'warn', text: name === 'SecurityError' ? 'אין גישה ל-Bluetooth כאן. פתחו את PRIME בכרום, או ייבאו קובץ מהשעון.' : 'החיבור נכשל. ודאו שהמכשיר במצב שידור וקרוב לטלפון.' });
    }
  };

  return (
    <div className="screen">
      <div className="row between">
        <h1>מכשירים ונתוני בריאות</h1>
        <Button kind="ghost" onClick={back}>
          חזרה
        </Button>
      </div>
      <p className="lead">מייבאים את הנתונים מהשעון, מהטבעת או מהמשקל: צעדים, שינה, דופק ומשקל. הנתונים נשמרים רק בטלפון הזה.</p>
      {busy && (
        <Banner kind="info">
          <span className="spinner" aria-hidden="true" /> {busy}
        </Banner>
      )}
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {bpm !== null && (
        <Card className="live-hr">
          <div className="row between">
            <span>דופק עכשיו</span>
            <b className="big-num" aria-live="polite">
              {bpm} <small>פעימות לדקה</small>
            </b>
          </div>
          <Button
            kind="secondary"
            onClick={() => {
              hrStop.current?.();
              setBpm(null);
            }}
          >
            ניתוק
          </Button>
        </Card>
      )}

      <input ref={fileRef} type="file" accept=".zip,.xml,.csv,text/csv,application/zip,text/xml" multiple hidden onChange={(e) => importFile(e.target.files)} />

      <div className="providers">
        {PROVIDERS.filter((p) => p.how !== 'bluetooth' || bt).map((p) => {
          const conn = s.devices.find((d) => d.id === p.id);
          const isOpen = open === p.id;
          return (
            <Card key={p.id} className={`provider ${conn ? 'connected' : ''}`}>
              <button className="provider-head" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
                <span className="provider-name">
                  {conn && <span className="check" aria-hidden="true">✓</span>}
                  {p.name}
                </span>
                <span className="muted">{conn ? `סונכרן ${new Date(conn.lastSync).toLocaleDateString('he-IL')}` : p.what}</span>
              </button>
              {isOpen && (
                <div className="provider-body">
                  <p className="muted">
                    <strong>מה נקבל:</strong> {p.what}
                  </p>
                  <p className="muted">
                    <strong>איך:</strong> {p.exportHelp}
                  </p>
                  {p.how === 'bluetooth' ? (
                    <Button onClick={() => connectBt(p)}>התחברות ב-Bluetooth</Button>
                  ) : (
                    <Button
                      onClick={() => {
                        pending.current = p;
                        fileRef.current?.click();
                      }}
                    >
                      ייבוא קובץ
                    </Button>
                  )}
                  {conn && (
                    <Button
                      kind="ghost"
                      onClick={() => setState((x) => ({ devices: x.devices.filter((d) => d.id !== p.id), deviceData: x.deviceData.filter((d) => d.source !== p.name && d.source !== conn.name) }))}
                    >
                      ניתוק ומחיקת הנתונים שיובאו
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card title="הנתונים האחרונים">
        {recent.length === 0 ? (
          <Empty title="אין עדיין נתונים" text="חברו מכשיר או ייבאו קובץ, והנתונים יופיעו כאן ובמסך ההתקדמות." />
        ) : (
          <table className="mtable">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>צעדים</th>
                <th>שינה</th>
                <th>דופק מנוחה</th>
                <th>HRV</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => (
                <tr key={d.date + d.source}>
                  <td>{d.date.slice(5).split('-').reverse().join('/')}</td>
                  <td>{d.steps ? fmt(d.steps) : '—'}</td>
                  <td>{d.sleepHours ? `${fmt(d.sleepHours, 1)} ש׳` : '—'}</td>
                  <td>{d.restingHr ?? '—'}</td>
                  <td>{d.hrv ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="fineprint">קלוריות פעילות משעונים מוצגות לעיון, ולא מוסיפות ליעד היומי. שעונים נוטים להעריך יותר מדי, ולכן היעד מתעדכן לפי מגמת המשקל שלך.</p>
      </Card>
    </div>
  );
}

const FIELD: Record<string, string> = { steps: 'צעדים', activeKcal: 'קלוריות פעילות', restingHr: 'דופק במנוחה', hrv: 'HRV', sleepHours: 'שינה', weightKg: 'משקל', bodyFatPct: 'אחוז שומן' };
