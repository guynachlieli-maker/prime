import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner, Button, Card, Empty, NumInput, Segmented, fmt } from '../ui/kit';
import { FOOD_BY_ID, loadFullDb, nutrientsFor, searchAll, sumNutrients, type Food } from '../data/foods';
import { addLog, learn, markHint, nowTime, setState, todayISO, useStore, uid, type LogItem, type LogMethod } from '../state/store';
import type { Recognition } from '../engine/vision';
import { parseFoodText } from '../engine/textparse';
import { SLOT_LABEL } from '../engine/menu';
import { likelySlot, photoFactor, recordPhotoCorrection } from '../engine/learning';
import type { Slot } from '../data/recipes';
import type { Tab } from '../App';

type Mode = 'photo' | 'barcode' | 'search' | 'text' | 'favorites';
type BasketItem = LogItem & { conf?: 'high' | 'medium' | 'low'; seen?: string; alts?: string[] };

const CONF_RANGE = { high: 0.1, medium: 0.2, low: 0.35 } as const;
const SITE = 'https://guynachlieli-maker.github.io/prime/';
const embedded = typeof window !== 'undefined' && window.top !== window.self;

function hourSlot(): Slot {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

/** The meal being built survives a visit to another tab (it is cleared once it is logged). */
const kept: { basket: BasketItem[]; method: LogMethod; photo?: string; preview?: string; estimateKcal: number | null } = { basket: [], method: 'search', estimateKcal: null };

type Speech = { lang: string; interimResults: boolean; start: () => void; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onerror: () => void; onend: () => void };

export function Capture({ go }: { go: (t: Tab) => void }) {
  const s = useStore((x) => x);
  const [mode, setMode] = useState<Mode>('photo');
  const [slot, setSlot] = useState<Slot>(() => likelySlot(s.learning) ?? hourSlot());
  const [basket, setBasket] = useState<BasketItem[]>(kept.basket);
  const [method, setMethod] = useState<LogMethod>(kept.method);
  const [photo, setPhoto] = useState<string | undefined>(kept.photo);
  const [preview, setPreview] = useState<string | undefined>(kept.preview);
  const [estimateKcal, setEstimateKcal] = useState<number | null>(kept.estimateKcal);
  const [favName, setFavName] = useState<string | null>(null);
  const basketRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    Object.assign(kept, { basket, method, photo, preview, estimateKcal });
  }, [basket, method, photo, preview, estimateKcal]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rec, setRec] = useState<Recognition | null>(null);
  const [q, setQ] = useState('');
  const [fullReady, setFullReady] = useState(false);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [code, setCode] = useState('');
  const [missingCode, setMissingCode] = useState<string | null>(null);
  const [known, setKnown] = useState<import('../engine/barcode').KnownProduct | null>(null);
  const [suggest, setSuggest] = useState<Food[]>([]);
  const [scanning, setScanning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [swapQ, setSwapQ] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopScan = useRef<(() => void) | null>(null);

  const total = useMemo(() => sumNutrients(basket.map((i) => nutrientsFor(i.foodId, i.grams))), [basket]);
  const worstConf = basket.reduce<number>((m, i) => Math.max(m, i.conf ? CONF_RANGE[i.conf] : 0), 0);
  const factor = photoFactor(s.learning);

  useEffect(() => () => stopScan.current?.(), []);
  useEffect(() => {
    if (mode !== 'search' || fullReady) return;
    loadFullDb()
      .then(() => setFullReady(true))
      .catch(() => setInfo('חלק מהמאגר לא נטען. נסו שוב בעוד רגע.'));
  }, [mode, fullReady]);

  const addFood = (f: Food, grams: number, conf?: BasketItem['conf']) => setBasket((b) => [...b, { foodId: f.id, name: f.name, grams: Math.round(grams), conf }]);
  const reset = () => {
    setErr(null);
    setInfo(null);
  };

  /* ---------- photo ---------- */
  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setRec(null);
    setMethod('photo');
    setBusy('מכין את התמונה…');
    try {
      const { prepareImage, recognizeFood, describeApiError, availableProvider } = await import('../engine/vision');
      const img = await prepareImage(file);
      setPhoto(img.thumb);
      setPreview(img.preview);
      const provider = await availableProvider(s.settings.apiKey);
      if (!provider) {
        setErr('זיהוי מתמונה עדיין לא פעיל. אפשר להפעיל אותו בפרופיל (זיהוי תמונות), ובינתיים לבחור את המנות מהרשימה.');
        setMode('search');
        return;
      }
      setBusy('מזהה את הצלחת…');
      try {
        const r = await recognizeFood({ file: img.blob, apiKey: s.settings.apiKey });
        setRec(r);
        const items = r.items.map((i) => ({ foodId: i.foodId, name: FOOD_BY_ID[i.foodId].name, grams: Math.round(i.grams * factor), conf: i.confidence, seen: i.name, alts: i.alternatives }));
        setBasket(items);
        setEstimateKcal(sumNutrients(items.map((i) => nutrientsFor(i.foodId, i.grams))).kcal);
        if (!items.length) setErr(r.notes || 'לא זיהינו אוכל בתמונה. נסו שוב או חפשו ידנית.');
      } catch (e) {
        setErr(describeApiError(e));
      }
    } catch {
      setErr('לא הצלחנו לפתוח את התמונה. נסו קובץ JPG או PNG.');
    } finally {
      setBusy(null);
    }
  };

  /* ---------- barcode ---------- */
  const handleCode = async (c: string) => {
    reset();
    setCode(c);
    setMissingCode(null);
    setKnown(null);
    setSuggest([]);
    setBusy('מחפש את המוצר…');
    try {
      const { lookupBarcode } = await import('../engine/barcode');
      const hit = await lookupBarcode(c);
      if (hit) {
        const f = hit.food;
        setMethod('barcode');
        const serving = f.units.find((u) => u.label === 'מנה לפי האריזה');
        addFood(f, serving?.grams ?? 100);
        setInfo(
          hit.from === 'mine'
            ? `נמצא: ${f.name} (מתווית שצילמת בעבר).`
            : `נמצא: ${f.name}. כדאי לוודא שהערכים תואמים לתווית.`,
        );
      } else {
        setMissingCode(c);
        const { identifyBarcode, nameKeywords } = await import('../engine/barcode');
        const k = await identifyBarcode(c);
        setKnown(k);
        if (k) {
          try {
            await loadFullDb();
          } catch {
            /* suggestions from core foods only */
          }
          setSuggest(searchAll(nameKeywords(k.name), 3));
        } else setSuggest([]);
      }
    } catch {
      setErr('טבלת המוצרים לא נטענה. אפשר לצלם את התווית התזונתית.');
      setMissingCode(c);
    } finally {
      setBusy(null);
    }
  };

  const startLive = async () => {
    reset();
    if (!videoRef.current) return;
    setScanning(true);
    try {
      const { startLiveScan } = await import('../engine/barcode');
      stopScan.current = await startLiveScan(videoRef.current, (c) => {
        stopScan.current?.();
        stopScan.current = null;
        setScanning(false);
        navigator.vibrate?.(60);
        handleCode(c);
      });
    } catch {
      setScanning(false);
      setErr('אין גישה למצלמה כאן. אפשר לצלם את הברקוד כתמונה או להקליד את המספר.');
    }
  };

  const onBarcodeImage = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setBusy('קורא את הברקוד…');
    let c: string | null = null;
    try {
      const { scanImage } = await import('../engine/barcode');
      c = await scanImage(file);
    } catch {
      c = null;
    } finally {
      setBusy(null);
    }
    if (c) handleCode(c);
    else setErr('לא נמצא ברקוד בתמונה. נסו צילום קרוב וחד יותר, או הקלידו את המספר.');
  };

  const onLabel = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setBusy('קורא את התווית התזונתית…');
    try {
      const { prepareImage, readNutritionLabel, labelLooksConsistent, describeApiError } = await import('../engine/vision');
      const { foodFromLabel } = await import('../engine/barcode');
      const img = await prepareImage(file);
      try {
        const r = await readNutritionLabel({ file: img.blob, apiKey: s.settings.apiKey });
        const f = foodFromLabel(missingCode, { ...r, name: r.name || known?.name || '' });
        setMethod('barcode');
        addFood(f, r.servingGrams ?? 100);
        setMissingCode(null);
        setInfo(labelLooksConsistent(r) ? `נקרא מהתווית: ${f.name}. בדקו שהמספרים נכונים.` : 'נקרא מהתווית, אבל הקלוריות לא מתיישבות עם החלבון, הפחמימה והשומן. בדקו את המספרים מול התווית.');
      } catch (e) {
        const msg = describeApiError(e);
        setErr(msg === 'NO_PROVIDER' ? 'קריאת תווית דורשת זיהוי תמונות פעיל (בפרופיל). בינתיים אפשר לחפש את המוצר ברשימה.' : msg);
      }
    } finally {
      setBusy(null);
    }
  };

  /* ---------- voice ---------- */
  const listen = () => {
    const w = window as unknown as { SpeechRecognition?: new () => Speech; webkitSpeechRecognition?: new () => Speech };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
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
    addLog({ date: todayISO(), time: nowTime(), slot, items: basket.map(({ foodId, name, grams }) => ({ foodId, name, grams })), method, nutrients: total, photo, aiEstimate: estimateKcal ? { ...total, kcal: estimateKcal } : undefined });
    if (method === 'photo' && estimateKcal) learn((l) => recordPhotoCorrection(l, estimateKcal / factor, total.kcal));
    markHint('first-log');
    setBasket([]);
    setPhoto(undefined);
    setPreview(undefined);
    setEstimateKcal(null);
    setRec(null);
    setInfo(null);
    setFavName(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const results = mode === 'search' ? searchAll(q, 20) : [];

  return (
    <div className="screen">
      <h1>רישום ארוחה</h1>
      <Segmented
        label="דרך רישום"
        value={mode}
        onChange={(m) => {
          stopScan.current?.();
          setScanning(false);
          setMode(m);
          reset();
        }}
        options={[
          { value: 'photo', label: 'צילום' },
          { value: 'barcode', label: 'ברקוד' },
          { value: 'search', label: 'חיפוש' },
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

      {embedded && (mode === 'photo' || mode === 'barcode') && (
        <Banner kind="info">
          המצלמה לא נפתחת כאן?{' '}
          <a href={SITE} target="_blank" rel="noreferrer">
            פתחו את PRIME בדפדפן
          </a>
          .
        </Banner>
      )}
      {saved && <Banner kind="info">נרשם. הטבעת במסך "היום" כבר מעודכנת.</Banner>}
      {busy && (
        <Banner kind="info">
          <span className="spinner" aria-hidden="true" /> {busy}
        </Banner>
      )}
      {err && (
        <Banner
          kind="warn"
          action={
            /פרופיל/.test(err) ? (
              <Button kind="secondary" onClick={() => go('profile')}>
                לפרופיל
              </Button>
            ) : undefined
          }
        >
          {err}
        </Banner>
      )}
      {info && <Banner kind="info">{info}</Banner>}

      {mode === 'photo' && (
        <Card>
          <div className="camera-box">
            {photo ? <img src={preview ?? photo} alt="התמונה שצילמת" className="preview" /> : <div className="frame-guide">צלחת שלמה בתוך המסגרת · מלמעלה · באור טוב</div>}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onPhoto(f); }} />
            <Button full onClick={() => fileRef.current?.click()} disabled={!!busy}>
              {photo ? 'לצלם שוב' : 'לצלם ארוחה'}
            </Button>
            <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onPhoto(f); }} />
            <Button full kind="secondary" onClick={() => galleryRef.current?.click()} disabled={!!busy}>
              בחירת תמונה מהגלריה
            </Button>
            {factor !== 1 && <p className="fineprint">ההערכה מכוילת לפי התיקונים שלך ({factor > 1 ? '+' : ''}{Math.round((factor - 1) * 100)}%).</p>}
          </div>
          {rec?.notes && <p className="muted">{rec.notes}</p>}
          {rec?.clarifyingQuestion && (
            <Banner kind="info">
              <strong>שאלה אחת:</strong> {rec.clarifyingQuestion}
              <div className="row wrap" style={{ marginTop: 8 }}>
                {rec.clarifyingFoodId && (
                  <Button
                    kind="secondary"
                    onClick={() => {
                      const f = FOOD_BY_ID[rec.clarifyingFoodId!];
                      addFood(f, f.per100g.kcal > 500 ? 10 : 50, 'medium');
                      setRec({ ...rec, clarifyingQuestion: null });
                    }}
                  >
                    כן, להוסיף {FOOD_BY_ID[rec.clarifyingFoodId]?.name}
                  </Button>
                )}
                <Button kind="ghost" onClick={() => setRec({ ...rec, clarifyingQuestion: null })}>
                  לא
                </Button>
              </div>
            </Banner>
          )}
        </Card>
      )}

      {mode === 'barcode' && (
        <Card>
          <div className={`scanner ${scanning ? 'on' : ''}`}>
            <video ref={videoRef} muted playsInline aria-label="תצוגת מצלמה לסריקת ברקוד" />
            {scanning && <div className="scan-line" aria-hidden="true" />}
            {!scanning && <div className="scan-idle">כוונו את המצלמה לברקוד שעל האריזה</div>}
          </div>
          <div className="row wrap" style={{ marginTop: 10 }}>
            {!scanning ? (
              <Button onClick={startLive} disabled={!!busy}>
                סריקה במצלמה
              </Button>
            ) : (
              <Button
                kind="secondary"
                onClick={() => {
                  stopScan.current?.();
                  setScanning(false);
                }}
              >
                עצירה
              </Button>
            )}
            <input ref={barcodeRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onBarcodeImage(f); }} />
            <Button kind="secondary" onClick={() => barcodeRef.current?.click()} disabled={!!busy}>
              תמונה של ברקוד
            </Button>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <input className="search" dir="ltr" inputMode="numeric" placeholder="או הקלידו את מספר הברקוד" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="מספר ברקוד" />
            <Button kind="secondary" disabled={code.length < 8} onClick={() => handleCode(code)}>
              חיפוש
            </Button>
          </div>
          {missingCode && (
            <Banner kind="warn">
              {known ? (
                <>
                  <strong>זיהינו: {known.name}</strong>
                  <span className="muted">
                    {[known.manufacturer, known.country, known.quantity && `${known.quantity} ${known.unit}`].filter(Boolean).join(' · ')}
                  </span>
                  <span>לא מצאנו ערכים תזונתיים מאומתים למוצר הזה.</span>
                  {suggest.length > 0 && (
                    <div className="suggest">
                      <span className="muted">מוצרים דומים במאגר משרד הבריאות:</span>
                      {suggest.map((f) => (
                        <button
                          key={f.id}
                          className="suggest-item"
                          onClick={() => {
                            setMethod('barcode');
                            addFood(f, 100);
                            setMissingCode(null);
                            setInfo(`נוסף לפי ${f.name} (משרד הבריאות). כדי לדייק, אפשר לצלם את התווית.`);
                          }}
                        >
                          <b>{f.name}</b>
                          <small>{Math.round(f.per100g.kcal)} קק"ל ל-100 ג׳</small>
                        </button>
                      ))}
                    </div>
                  )}
                  <span>הכי מדויק: צלמו פעם אחת את התווית התזונתית, והמוצר יישמר לסריקות הבאות.</span>
                </>
              ) : (
                <>
                  <strong>הברקוד {missingCode} לא נמצא במאגרים.</strong> צלמו פעם אחת את התווית התזונתית שעל האריזה. נקרא ממנה את הערכים, והמוצר יישמר לסריקות הבאות.
                </>
              )}
              <input ref={labelRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onLabel(f); }} />
              <div className="row wrap" style={{ marginTop: 8 }}>
                <Button onClick={() => labelRef.current?.click()}>צילום התווית</Button>
                <Button kind="ghost" onClick={() => setMode('search')}>
                  חיפוש ידני
                </Button>
              </div>
            </Banner>
          )}
        </Card>
      )}

      {mode === 'search' && (
        <Card>
          <input className="search" placeholder="חפשו מאכל או מוצר: חומוס, קוטג׳, במבה…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="חיפוש מאכל" />
          <p className="fineprint">{fullReady ? 'חיפוש בכל 4,500 המזונות של מאגר התזונה של משרד הבריאות.' : 'טוען את מאגר המזון…'}</p>
          <ul className="results">
            {results.map((f) => (
              <FoodRow key={f.id} food={f} onAdd={(g) => addFood(f, g)} />
            ))}
          </ul>
          {q && results.length === 0 && <Empty title="לא נמצא" text="נסו מילה אחרת, או סרקו את הברקוד של המוצר." />}
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
                  reset();
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
                    <button className="icon-btn" aria-label={`מחיקת ${f.name}`} onClick={() => setState((x) => ({ favorites: x.favorites.filter((y) => y.id !== f.id) }))}>
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
        <div ref={basketRef} className="basket-anchor">
        <Card title="אישור הארוחה" className="basket">
          <ul className="basket-list">
            {basket.map((i, idx) => {
              const f = FOOD_BY_ID[i.foodId];
              if (!f) return null;
              const n = nutrientsFor(i.foodId, i.grams);
              return (
                <li key={idx}>
                  <div className="b-top">
                    <strong>{f.name}</strong>
                    {i.conf && <span className={`conf ${i.conf}`}>{i.conf === 'high' ? 'זיהוי בטוח' : i.conf === 'medium' ? 'זיהוי סביר' : 'לא בטוח'}</span>}
                    {method === 'photo' && (
                      <button className="link" onClick={() => { setSwapIdx(swapIdx === idx ? null : idx); setSwapQ(''); loadFullDb().then(() => setFullReady(true)).catch(() => undefined); }} aria-expanded={swapIdx === idx}>
                        לא זה?
                      </button>
                    )}
                    <button className="icon-btn" aria-label={`הסרת ${f.name}`} onClick={() => setBasket((b) => b.filter((_, j) => j !== idx))}>
                      ✕
                    </button>
                  </div>
                  {swapIdx === idx && (
                    <div className="swap">
                      {(() => {
                        const opts = [...new Set([...(i.alts ?? []), ...(i.seen ? searchAll(i.seen, 4).map((x) => x.id) : [])])].filter((id) => id !== i.foodId && FOOD_BY_ID[id]).slice(0, 5);
                        const pick = (nf: Food) => {
                          setBasket((b) => b.map((x, j) => (j === idx ? { ...x, foodId: nf.id, name: nf.name, conf: 'high' } : x)));
                          setSwapIdx(null);
                        };
                        return (
                          <>
                            {opts.length > 0 && (
                              <div className="chips">
                                {opts.map((id) => (
                                  <button key={id} className="chip" onClick={() => pick(FOOD_BY_ID[id])}>
                                    {FOOD_BY_ID[id].name}
                                  </button>
                                ))}
                              </div>
                            )}
                            <input className="search" value={swapQ} onChange={(e) => setSwapQ(e.target.value)} placeholder="מה זה באמת? למשל: פתיתים" aria-label="חיפוש המאכל הנכון" autoFocus />
                            {swapQ.trim().length > 1 && (
                              <div className="chips">
                                {searchAll(swapQ, 8).map((nf) => (
                                  <button key={nf.id} className="chip" onClick={() => pick(nf)}>
                                    {nf.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div className="b-amount">
                    <input type="range" min={5} max={Math.max(600, i.grams * 2)} step={5} value={i.grams} onChange={(e) => setBasket((b) => b.map((x, j) => (j === idx ? { ...x, grams: Number(e.target.value) } : x)))} aria-label={`כמות ${f.name} בגרמים`} />
                    <NumInput className="qty" integer value={i.grams} onChange={(g) => setBasket((b) => b.map((x, j) => (j === idx ? { ...x, grams: g } : x)))} aria-label={`גרמים של ${f.name}`} />
                    <span className="unit">ג׳</span>
                  </div>
                  <div className="muted">
                    {fmt(n.kcal)} קק"ל · {fmt(n.protein)} חלבון · {fmt(n.carbs)} פחמימה · {fmt(n.fat)} שומן
                    <SourceTag food={f} />
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
          {worstConf > 0 && <p className="fineprint">הטווח מבטא את אי־הוודאות בזיהוי מתמונה. התיקונים שלך משפרים את ההערכות הבאות.</p>}
          <div className="row wrap">
            <Button onClick={confirm} disabled={total.kcal <= 0}>
              אישור ורישום
            </Button>
            <Button kind="ghost" onClick={() => setFavName(basket.map((b) => b.name).join(' + ').slice(0, 40))}>
              שמירה כקבועה
            </Button>
          </div>
          {favName !== null && (
            <div className="row" style={{ marginTop: 8 }}>
              <input className="search" value={favName} onChange={(e) => setFavName(e.target.value.slice(0, 40))} aria-label="שם לארוחה הקבועה" autoFocus />
              <Button
                kind="secondary"
                disabled={!favName.trim()}
                onClick={() => {
                  setState((x) => ({ favorites: [...x.favorites, { id: uid(), name: favName.trim(), items: basket.map(({ foodId, name: n, grams }) => ({ foodId, name: n, grams })) }] }));
                  setFavName(null);
                  setInfo('נשמרה בארוחות הקבועות.');
                }}
              >
                שמירה
              </Button>
            </div>
          )}
        </Card>
        </div>
      )}
      {basket.length > 0 && (mode === 'search' || mode === 'text' || mode === 'favorites') && (
        <button className="basket-bar" onClick={() => basketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <span>
            {basket.length} {basket.length === 1 ? 'פריט' : 'פריטים'} · {fmt(total.kcal)} קק"ל
          </span>
          <b>לאישור הארוחה ↓</b>
        </button>
      )}
    </div>
  );
}

function SourceTag({ food }: { food: Food }) {
  if (food.source === 'moh') return <span className="src moh"> · משרד הבריאות{food.allergens.length === 0 && food.id.startsWith('moh:') ? ' · אלרגנים לא ידועים' : ''}</span>;
  if (food.source === 'openfoodfacts') return <span className="src check"> · כדאי לבדוק מול התווית</span>;
  return <span className="src check"> · מהתווית שצילמת</span>;
}

function FoodRow({ food, onAdd }: { food: Food; onAdd: (grams: number) => void }) {
  const [unit, setUnit] = useState(food.units.find((u) => u.grams > 1) ?? food.units[0]);
  const [qty, setQty] = useState(unit.grams === 1 ? 100 : 1);
  const grams = unit.grams * qty;
  const n = nutrientsFor(food.id, grams);
  return (
    <li className="result">
      <div className="result-main">
        <strong>{food.name}</strong>
        <div className="muted">
          {fmt(n.kcal)} קק"ל · {fmt(n.protein)} ג׳ חלבון
          {food.officialName !== food.name && <span className="official"> · {food.officialName}</span>}
        </div>
      </div>
      <div className="row">
        <NumInput className="qty" value={qty} onChange={setQty} aria-label={`כמות של ${food.name}`} />
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
              {u.grams > 1 ? ` (${u.grams} ג׳)` : ''}
            </option>
          ))}
        </select>
        <Button kind="secondary" disabled={grams <= 0} onClick={() => onAdd(Math.round(grams))}>
          + הוספה
        </Button>
      </div>
    </li>
  );
}
