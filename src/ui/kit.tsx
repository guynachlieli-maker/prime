import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSources, SOURCES } from '../engine/sources';
import type { Explained } from '../engine/types';

/* ---------- Sheet (bottom modal) ---------- */
export function Sheet(props: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);
  if (!props.open) return null;
  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={props.title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{props.title}</h2>
          <button className="icon-btn" onClick={props.onClose} aria-label="סגירה">
            ✕
          </button>
        </div>
        <div className="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}

/* ---------- "Why?" explanations with sources ---------- */
interface WhyPayload {
  title: string;
  why: string;
  sources: string[];
}
const WhyCtx = createContext<(p: WhyPayload) => void>(() => {});

export function WhyProvider({ children }: { children: ReactNode }) {
  const [p, setP] = useState<WhyPayload | null>(null);
  return (
    <WhyCtx.Provider value={setP}>
      {children}
      <Sheet open={!!p} onClose={() => setP(null)} title={p?.title ?? ''}>
        {p && <WhyContent why={p.why} sources={p.sources} />}
      </Sheet>
    </WhyCtx.Provider>
  );
}

export function WhyContent({ why, sources }: { why: string; sources: string[] }) {
  const list = getSources(sources);
  return (
    <>
      {why && <p className="why-text">{why}</p>}
      {list.length > 0 && (
        <>
          <h3 className="sub">המקורות</h3>
          <ul className="sources">
            {list.map((s) => (
              <li key={s.id}>
                <span className={`evidence ${s.level}`}>{s.level === 'strong' ? 'ראיות חזקות' : 'ראיות בינוניות'}</span>
                <strong>{s.title}</strong>
                <span className="cite" dir="ltr">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.citation}
                    </a>
                  ) : (
                    s.citation
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="fineprint">המידע כאן לא מחליף ייעוץ רפואי.</p>
    </>
  );
}

export function useWhy() {
  return useContext(WhyCtx);
}

export function WhyButton({ title, e, label = 'למה?' }: { title: string; e: Pick<Explained<unknown>, 'why' | 'sources'>; label?: string }) {
  const open = useWhy();
  return (
    <button className="why-btn" onClick={() => open({ title, why: e.why, sources: e.sources })} aria-label={`${label} ${title}`}>
      {label}
    </button>
  );
}

/* ---------- Glossary info dot ---------- */
export const GLOSSARY: Record<string, { term: string; text: string; sources: string[] }> = {
  bmr: { term: 'BMR: חילוף חומרים במנוחה', text: 'כמה קלוריות הגוף שורף ביום של מנוחה מלאה, רק כדי לתפקד.', sources: ['mifflin'] },
  tdee: { term: 'TDEE: הוצאה יומית', text: 'כמה קלוריות אתה שורף ביום כולל תנועה ואימונים. זו הנקודה שבה המשקל נשאר יציב.', sources: ['mifflin'] },
  macros: { term: 'מאקרו', text: 'שלושת אבות המזון שנותנים אנרגיה: חלבון, פחמימה ושומן.', sources: ['dga'] },
  deficit: { term: 'גירעון קלורי', text: 'לאכול קצת פחות ממה שהגוף שורף, כדי שהגוף ישתמש באנרגיה מהשומן.', sources: ['hall2011'] },
  recomp: { term: 'ריקומפוזיציה', text: 'לרדת בשומן ולעלות בשריר בו־זמנית, כשהמשקל כמעט לא זז.', sources: ['forbes'] },
  trend: { term: 'מגמת משקל', text: 'ממוצע נע של השקילות. מבטל את הקפיצות היומיות של מים ומראה את הכיוון האמיתי.', sources: ['hackersDiet'] },
  periodization: { term: 'פריודיזציה', text: 'התאמת התזונה לעומס האימון: יותר פחמימות בימים קשים, פחות בימי מנוחה.', sources: ['acsmNutrition'] },
};

export function InfoDot({ id }: { id: keyof typeof GLOSSARY }) {
  const open = useWhy();
  const g = GLOSSARY[id];
  return (
    <button className="info-dot" aria-label={`הסבר: ${g.term}`} onClick={() => open({ title: g.term, why: g.text, sources: g.sources })}>
      i
    </button>
  );
}

/* ---------- Basic building blocks ---------- */
export function Card(props: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`card ${props.className ?? ''}`}>
      {(props.title || props.action) && (
        <div className="card-head">
          {props.title && <h3>{props.title}</h3>}
          {props.action}
        </div>
      )}
      {props.children}
    </section>
  );
}

export function Button(props: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean; full?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type={props.type ?? 'button'} className={`btn ${props.kind ?? 'primary'} ${props.full ? 'full' : ''}`} onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  );
}

export function Ring(props: { value: number; max: number; size?: number; label: ReactNode; sub?: ReactNode }) {
  const size = props.size ?? 200;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, props.max > 0 ? props.value / props.max : 0));
  const over = props.value > props.max;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--warn)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 300ms ease' }}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-label">{props.label}</div>
        {props.sub && <div className="ring-sub">{props.sub}</div>}
      </div>
    </div>
  );
}

export function MacroBar(props: { name: string; value: number; target: number; color: string; unit?: string; why?: ReactNode }) {
  const frac = Math.max(0, Math.min(1, props.target ? props.value / props.target : 0));
  return (
    <div className="macro">
      <div className="macro-top">
        <span className="macro-name">
          <i className="dot" style={{ background: props.color }} />
          {props.name}
          {props.why}
        </span>
        <span className="num">
          {Math.round(props.value)} / {Math.round(props.target)} {props.unit ?? 'ג׳'}
        </span>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={Math.round(props.value)} aria-valuemax={Math.round(props.target)} aria-label={props.name}>
        <div style={{ width: `${frac * 100}%`, background: props.color }} />
      </div>
    </div>
  );
}

export function Segmented<T extends string>(props: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={o.value} role="radio" aria-checked={props.value === o.value} className={props.value === o.value ? 'on' : ''} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChoiceCards<T extends string>(props: { value: T | undefined; onChange: (v: T) => void; options: { value: T; label: string; desc?: string; icon?: string }[] }) {
  return (
    <div className="choices">
      {props.options.map((o) => (
        <button key={o.value} className={`choice ${props.value === o.value ? 'on' : ''}`} aria-pressed={props.value === o.value} onClick={() => props.onChange(o.value)}>
          {o.icon && <span className="choice-icon">{o.icon}</span>}
          <span className="choice-label">{o.label}</span>
          {o.desc && <span className="choice-desc">{o.desc}</span>}
        </button>
      ))}
    </div>
  );
}

export function NumberField(props: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; unit?: string; min?: number; max?: number; step?: number; hint?: string }) {
  const [txt, setTxt] = useState(props.value === undefined ? '' : String(props.value));
  useEffect(() => setTxt(props.value === undefined ? '' : String(props.value)), [props.value]);
  const invalid = txt !== '' && (Number.isNaN(Number(txt)) || (props.min !== undefined && Number(txt) < props.min) || (props.max !== undefined && Number(txt) > props.max));
  return (
    <label className={`field ${invalid ? 'invalid' : ''}`}>
      <span className="field-label">{props.label}</span>
      <span className="field-input">
        <input
          inputMode="decimal"
          value={txt}
          onChange={(e) => {
            setTxt(e.target.value);
            const n = Number(e.target.value);
            props.onChange(e.target.value === '' || Number.isNaN(n) ? undefined : n);
          }}
          aria-invalid={invalid}
          dir="ltr"
        />
        {props.unit && <span className="unit">{props.unit}</span>}
      </span>
      {invalid ? <span className="field-err">ערך בין {props.min} ל-{props.max}</span> : props.hint && <span className="field-hint">{props.hint}</span>}
    </label>
  );
}

export function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void; desc?: string }) {
  return (
    <label className="toggle">
      <span>
        <span className="toggle-label">{props.label}</span>
        {props.desc && <span className="toggle-desc">{props.desc}</span>}
      </span>
      <input type="checkbox" role="switch" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

export function YesNo(props: { question: string; why?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="yesno">
      <div className="yesno-q">{props.question}</div>
      {props.why && <div className="yesno-why">{props.why}</div>}
      <div className="yesno-btns">
        <button className={props.value ? 'on' : ''} aria-pressed={props.value} onClick={() => props.onChange(true)}>
          כן
        </button>
        <button className={!props.value ? 'on' : ''} aria-pressed={!props.value} onClick={() => props.onChange(false)}>
          לא
        </button>
      </div>
    </div>
  );
}

export function Banner(props: { kind?: 'info' | 'warn' | 'safety'; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`banner ${props.kind ?? 'info'}`} role={props.kind === 'safety' ? 'alert' : undefined}>
      <div>{props.children}</div>
      {props.action}
    </div>
  );
}

export function Empty(props: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{props.title}</strong>
      <p>{props.text}</p>
      {props.action}
    </div>
  );
}


export const fmt = (n: number, digits = 0) => n.toLocaleString('he-IL', { maximumFractionDigits: digits, minimumFractionDigits: digits });
export { SOURCES };
