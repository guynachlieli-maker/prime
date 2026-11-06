import { useMemo, useRef, useState } from 'react';
import { Banner, Button, Card, Empty, Segmented, fmt } from '../ui/kit';
import { FOOD_BY_ID, nutrientsFor, searchFoods, sumNutrients, type Food } from '../data/foods';
import { addLog, markHint, nowTime, setState, todayISO, useStore, uid, type LogItem, type LogMethod } from '../state/store';
import type { Recognition } from '../engine/vision';
import { parseFoodText } from '../engine/textparse';
import { SLOT_LABEL } from '../engine/menu';
import type { Slot } from '../data/recipes';
import type { Tab } from '../App';

type Mode = 'photo' | 'search' | 'barcode' | 'text' | 'favorites';

const CONF_RANGE = { high: 0.1, medium: 0.2, low: 0.35 } as const;

function defaultSlot(): Slot {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

/**
 * Verified barcode table. Empty by design: per the spec, barcodes come only from a verified
 * retailer/manufacturer partnership, never from crowd-sourced databases.
 */
const VERIFIED_BARCODES: Record<string, { foodId: string; grams: number }> = {};

type Speech = { lang: string; interimResults: boolean; start: () => void; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onerror: () => void; onend: () => void };

export function Capture({ go }: { go: (t: Tab) => void }) {
  const s = useStore((x) => x);
  const [mode, setMode] = useState<Mode>('photo');
  const [slot, setSlot] = useState<Slot>(defaultSlot);
  const [basket, setBasket] = useState<(LogItem & { conf?: keyof typeof CONF_RANGE })[]>([]);
  const [method, setMethod] = useState<LogMethod>('search');
  const [photo, setPhoto] = useState<string | undefined>();
  const [aiEstimate, setAiEstimate] = useState<ReturnType<typeof sumNutrients> | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rec, setRec] = useState<Recognition | null>(null);
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const total = useMemo(() => sumNutrients(basket.map((i) => nutrientsFor(i.foodId, i.grams))), [basket]);
  const worstConf = basket.reduce<number>((m, i) => Math.max(m, i.conf ? CONF_RANGE[i.conf] : 0), 0);

  const addFood = (f: Food, grams: number, conf?: keyof typeof CONF_RANGE) => setBasket((b) => [...b, { foodId: f.id, name: f.name, grams, conf }]);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    setRec(null);
    setMethod('photo');
    setBusy(true);
    const { describeApiError, prepareImage, recognizeFood } = await import('../engine/vision');
    try {
      const img = await prepareImage(file);
      setPhoto(img.thumb);
      if (!s.settings.apiKey) {
        setErr('זיהוי אוטומטי דורש חיבור לשירות הזיהוי (מפתח API בהגדרות). התמונה נשמרה, ואפשר לבחור את המנות מהרשימה.');
        setMode('search');
        return;
      }
      const r = await recognizeFood({ apiKey: s.settings.apiKey, imageBase64: img.base64, mediaType: img.mediaType });
      setRec(r);
      const items = r.items.map((i) => ({ foodId: i.foodId, name: FOOD_BY_ID[i.foodId].name, grams: Math.round(i.grams), conf: i.confidence }));
      setBasket(items);
      setAiEstimate(sumNutrients(items.map((i) => nutrientsFor(i.foodId, i.grams))));
      if (!items.length) setErr(r.notes || 'לא זיהינו אוכל בתמונה. נסו שוב או חפשו ידנית.');
    } catch (e) {
      setErr(describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onBarcodeImage = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (i: ImageBitmap) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!BD) {
      setErr('הדפדפן הזה לא יודע לקרוא ברקוד מתמונה. אפשר להקליד את המספר.');
      return;
    }
    try {
      const codes = await new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(await createImageBitmap(file));
      if (!codes.length) setErr('לא נמצא ברקוד בתמונה. נסו צילום קרוב וחד יותר.');
      else lookupBarcode(codes[0].rawValue);
    } catch {
      setErr('קריאת הברקוד נכשלה. אפשר להקליד את המספר.');
    }
  };

  const lookupBarcode = (c: string) => {
    setCode(c);
    const hit = VERIFIED_BARCODES[c];
    if (hit) {
      setMethod('barcode');
      addFood(FOOD_BY_ID[hit.foodId], hit.grams);
    } else setErr(`ברקוד ${c} עדיין לא במאגר המוצרים המאומת. המאגר יגיע משותפות עם רשתות ויצרנים. בינתיים, חפשו את המוצר ברשימה.`);
  };

  const listen = () => {
    const SR = (window as unknown as { SpeechRecognition?: new () => Speech; webkitSpeechRecognition?: new () => Speech }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Speech }).webkitSpeechRecognition;
    if (!SR) {
      setErr('הדפדפן הזה לא תומך בהקלטה קולית. אפשר להקליד.');
      return;
    }
    const r = new SR();
    r.lang = 'he-IL';
    r.interimResults = false;
    r.onresult = (e) => setText(e.results[0][0].transcript);
    r.onerror = () => setErr('ההקלטה נכשלה. אפשר להקליד.');
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };

  const confirm = () => {
    addLog({ date: todayISO(), time: nowTime(), slot, items: basket.map(({ foodId, name, grams }) => ({ foodId, name, grams })), method, nutrients: total, photo, aiEstimate });
    markHint('first-log');
    setBasket([]);
    setPhoto(undefined);
    setAiEstimate(undefined);
    setRec(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const results = mode === 'search' ? searchFoods(q) : [];

  return (
    <div className="screen">
      <h1>רישום ארוחה</h1>
      <Segmented
        label="דרך רישום"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setErr(null);
        }}
        options={[
          { value: 'photo', label: 'צילום' },
          { value: 'search', label: 'חיפוש' },
          { value: 'barcode', label: 'ברקוד' },
          { value: 'text', label: 'מילים' },
          { value: 'favorites', label: 'קבועות' },
        ]}
      />
      <label className="field inline">
        <span className="field-label">לאיזו ארוחה?</span>
        <select value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
          {(Object.keys(SLOT_LABEL) as Slot[]).map((k) => (
            <option key={k} value={k}>
              {SLOT_LABEL[k]}
            </option>
          ))}
        </select>
      </label>

      {saved && <Banner kind="info">נרשם. הטבעת במסך "היום" כבר מעודכנת.</Banner>}
      {err && <Banner kind="warn">{err}</Banner>}

      {mode === 'photo' && (
        <Card>
          <div className="camera-box">
            {photo ? <img src={photo} alt="התמונה שצילמת" className="preview" /> : <div className="frame-guide">צלחת שלמה בתוך המסגרת · מלמעלה · באור טוב</div>}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            <Button full onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? 'מזהה…' : photo ? 'לצלם שוב' : 'לצלם ארוחה'}
            </Button>
            {!s.settings.apiKey && (
              <p className="fineprint">
                הזיהוי האוטומטי לא מחובר.{' '}
                <button className="link" onClick={() => go('profile')}>
                  לחיבור בהגדרות
                </button>
              </p>
            )}
          </div>
          {rec?.notes && <p className="muted">{rec.notes}</p>}
          {rec?.clarifyingQuestion && (
            <Banner kind="info">
              <strong>שאלה אחת:</strong> {rec.clarifyingQuestion}
              <div className="row wrap" style={{ marginTop: 8 }}>
                <Button kind="secondary" onClick={() => addFood(FOOD_BY_ID.olive_oil, 10, 'medium')}>
                  כן, נוסף שמן (כף)
                </Button>
                <Button kind="ghost" onClick={() => setRec({ ...rec, clarifyingQuestion: null })}>
                  לא
                </Button>
              </div>
            </Banner>
          )}
        </Card>
      )}

      {mode === 'search' && (
        <Card>
          <input className="search" placeholder="חפשו מאכל: חומוס, שניצל, יוגורט…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="חיפוש מאכל" />
          <ul className="results">
            {results.map((f) => (
              <FoodRow key={f.id} food={f} onAdd={(g) => addFood(f, g)} />
            ))}
          </ul>
        </Card>
      )}

      {mode === 'barcode' && (
        <Card>
          <p className="muted">ברקוד הוא הדרך המדויקת ביותר לרשום מוצר ארוז.</p>
          <input ref={barcodeRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onBarcodeImage(e.target.files?.[0])} />
          <Button full onClick={() => barcodeRef.current?.click()}>
            לצלם ברקוד
          </Button>
          <div className="row" style={{ marginTop: 12 }}>
            <input className="search" dir="ltr" inputMode="numeric" placeholder="או הקלידו מספר ברקוד" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="מספר ברקוד" />
            <Button kind="secondary" disabled={code.length < 8} onClick={() => lookupBarcode(code)}>
              חיפוש
            </Button>
          </div>
        </Card>
      )}

      {mode === 'text' && (
        <Card>
          <textarea className="search" rows={3} placeholder="למשל: אכלתי שתי ביצים, פרוסה לחם מלא וחצי פיתה עם חומוס" value={text} onChange={(e) => setText(e.target.value)} aria-label="מה אכלת" />
          <div className="row">
            <Button kind="secondary" onClick={listen} disabled={listening}>
              {listening ? 'מקשיב…' : '🎙 להגיד בקול'}
            </Button>
            <Button
              onClick={() => {
                const items = parseFoodText(text);
                if (!items.length) setErr('לא זיהינו מאכלים בטקסט. נסו לכתוב שם מאכל פשוט, או חפשו ברשימה.');
                else {
                  setErr(null);
                  setMethod('voice');
                  items.forEach((i) => addFood(i.food, Math.round(i.grams), 'medium'));
                }
              }}
            >
              לזהות
            </Button>
          </div>
        </Card>
      )}

      {mode === 'favorites' && (
        <Card>
          {s.favorites.length === 0 ? (
            <Empty title="אין עדיין ארוחות קבועות" text='אחרי שבונים ארוחה, אפשר לשמור אותה עם "שמירה כקבועה".' />
          ) : (
            <ul className="results">
              {s.favorites.map((f) => (
                <li key={f.id} className="result">
                  <div>
                    <strong>{f.name}</strong>
                    <div className="muted">{fmt(sumNutrients(f.items.map((i) => nutrientsFor(i.foodId, i.grams))).kcal)} קק"ל</div>
                  </div>
                  <div className="row">
                    <Button
                      kind="secondary"
                      onClick={() => {
                        setMethod('favorite');
                        setBasket(f.items);
                      }}
                    >
                      להוסיף
                    </Button>
                    <button className="icon-btn" aria-label="מחיקת ארוחה קבועה" onClick={() => setState((x) => ({ favorites: x.favorites.filter((y) => y.id !== f.id) }))}>
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {basket.length > 0 && (
        <Card title="אישור הארוחה" className="basket">
          <ul className="basket-list">
            {basket.map((i, idx) => {
              const f = FOOD_BY_ID[i.foodId];
              const n = nutrientsFor(i.foodId, i.grams);
              return (
                <li key={idx}>
                  <div className="b-top">
                    <strong>{f.name}</strong>
                    {i.conf && <span className={`conf ${i.conf}`}>{i.conf === 'high' ? 'זיהוי בטוח' : i.conf === 'medium' ? 'זיהוי סביר' : 'לא בטוח'}</span>}
                    <button className="icon-btn" aria-label={`הסרת ${f.name}`} onClick={() => setBasket((b) => b.filter((_, j) => j !== idx))}>
                      ✕
                    </button>
                  </div>
                  <div className="b-amount">
                    <input type="range" min={5} max={Math.max(600, i.grams * 2)} step={5} value={i.grams} onChange={(e) => setBasket((b) => b.map((x, j) => (j === idx ? { ...x, grams: Number(e.target.value) } : x)))} aria-label={`כמות ${f.name} בגרמים`} />
                    <span className="num">{i.grams} ג׳</span>
                  </div>
                  <div className="muted">
                    {fmt(n.kcal)} קק"ל · {fmt(n.protein)} חלבון · {fmt(n.carbs)} פחמימה · {fmt(n.fat)} שומן
                    {!f.verified && <span className="unverified"> · ערך לבדיקה</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="basket-total">
            {worstConf > 0 ? (
              <strong>
                בערך {fmt(total.kcal * (1 - worstConf), 0)}-{fmt(total.kcal * (1 + worstConf), 0)} קק"ל
              </strong>
            ) : (
              <strong>{fmt(total.kcal)} קק"ל</strong>
            )}
            <span className="muted">
              {fmt(total.protein)} ג׳ חלבון · {fmt(total.carbs)} ג׳ פחמימה · {fmt(total.fat)} ג׳ שומן
            </span>
          </div>
          {worstConf > 0 && <p className="fineprint">הטווח מבטא את אי־הוודאות של הזיהוי מתמונה. כשמתקנים את הכמויות, ההערכה משתפרת.</p>}
          <div className="row">
            <Button onClick={confirm}>אישור ורישום</Button>
            <Button
              kind="ghost"
              onClick={() => {
                const name = prompt('שם לארוחה הקבועה:', basket.map((b) => b.name).join(' + ').slice(0, 40));
                if (name) setState((x) => ({ favorites: [...x.favorites, { id: uid(), name, items: basket.map(({ foodId, name: n, grams }) => ({ foodId, name: n, grams })) }] }));
              }}
            >
              שמירה כקבועה
            </Button>
          </div>
        </Card>
      )}
      {s.settings.apiKey && s.settings.trainingConsent === false && mode === 'photo' && <p className="fineprint">התמונות לא נשמרות לשיפור המודל. אפשר לשנות בהגדרות.</p>}
    </div>
  );
}

function FoodRow({ food, onAdd }: { food: Food; onAdd: (grams: number) => void }) {
  const [unit, setUnit] = useState(food.units.find((u) => u.grams > 1) ?? food.units[0]);
  const [qty, setQty] = useState(unit.grams === 1 ? 100 : 1);
  const grams = unit.grams * qty;
  const n = nutrientsFor(food.id, grams);
  return (
    <li className="result">
      <div>
        <strong>{food.name}</strong>
        <div className="muted">
          {fmt(n.kcal)} קק"ל · {fmt(n.protein)} ג׳ חלבון
        </div>
      </div>
      <div className="row">
        <input className="qty" inputMode="decimal" dir="ltr" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} aria-label="כמות" />
        <select
          value={unit.label}
          onChange={(e) => {
            const u = food.units.find((x) => x.label === e.target.value)!;
            setUnit(u);
            setQty(u.grams === 1 ? 100 : 1);
          }}
          aria-label="יחידה"
        >
          {food.units.map((u) => (
            <option key={u.label} value={u.label}>
              {u.label}
            </option>
          ))}
        </select>
        <Button kind="secondary" disabled={grams <= 0} onClick={() => onAdd(Math.round(grams))}>
          +
        </Button>
      </div>
    </li>
  );
}
