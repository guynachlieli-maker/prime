import { SUPPLEMENTS, SUPP_BY_ID, SUPP_GROUPS } from '../data/supplements';

/** Chips to choose supplements, grouped, with a short note for each one chosen. */
export function SupplementPicker({ value, onChange, vegan }: { value: string[]; onChange: (v: string[]) => void; vegan?: boolean }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="supp-picker">
      {SUPP_GROUPS.map((g) => (
        <div key={g.id}>
          <h4 className="supp-group">{g.label}</h4>
          <div className="chips">
            {SUPPLEMENTS.filter((s) => s.group === g.id && (!vegan || s.id !== 'whey')).map((s) => {
              const on = value.includes(s.id);
              return (
                <button key={s.id} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(s.id)}>
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {value.length > 0 && (
        <ul className="supp-notes">
          {value.map((id) => SUPP_BY_ID[id]).filter(Boolean).map((s) => (
            <li key={s.id}>
              <b>{s.name}</b> · {s.when}
              {s.serving && <span className="badge">נספר בתפריט: {s.serving.label} ביום</span>}
              <div className="muted">{s.note}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
