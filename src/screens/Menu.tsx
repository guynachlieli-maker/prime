import { useMemo, useState } from 'react';
import { Banner, Button, Card, Sheet, WhyButton, fmt } from '../ui/kit';
import { setState, todayISO, useStore, addLog, nowTime, learn } from '../state/store';
import { preferences, recordRecipe } from '../engine/learning';
import { dayTargets, planFor } from '../state/derived';
import { dayLink, fmtMin } from '../state/daylink';
import { CARDIO } from '../training/plan';
import { RECIPES } from '../data/recipes';
import { FOOD_BY_ID } from '../data/foods';
import { SLOT_LABEL, alternativesFor, describeAmount, shoppingList } from '../engine/menu';

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

export function Menu({ go }: { go?: (t: import('../App').Tab) => void }) {
  const s = useStore((x) => x);
  const dates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return { iso: todayISO(d), label: i === 0 ? 'היום' : DAYS[d.getDay()], day: d.getDate() };
      }),
    [],
  );
  const [date, setDate] = useState(dates[0].iso);
  const [open, setOpen] = useState<number | null>(null);
  const [swap, setSwap] = useState<number | null>(null);
  const [shop, setShop] = useState(false);
  const plan = planFor(s, date);
  const target = dayTargets(s, date);
  const link = dayLink(s, date);
  if (!plan || !target || !s.profile) return null;
  const profile = s.profile;
  const alts = swap !== null ? alternativesFor(plan, swap, { profile, target, preferences: preferences(s.learning) }) : [];
  const week = dates.map((d) => planFor(s, d.iso)!).filter(Boolean);
  const list = shop ? shoppingList(week) : [];
  const shopText = list.map((i) => `• ${FOOD_BY_ID[i.foodId].name}: ${i.grams >= 1000 ? fmt(i.grams / 1000, 1) + ' ק"ג' : i.grams + ' ג׳'}`).join('\n');

  return (
    <div className="screen">
      <div className="row between">
        <h1>תפריט</h1>
        <div className="row">
          {go && (
            <Button kind="ghost" onClick={() => go('programs')}>
              תוכניות ומאמרים
            </Button>
          )}
          <Button kind="secondary" onClick={() => setShop(true)}>
            רשימת קניות
          </Button>
        </div>
      </div>
      <div className="days" role="tablist" aria-label="בחירת יום">
        {dates.map((d) => (
          <button key={d.iso} role="tab" aria-selected={d.iso === date} className={d.iso === date ? 'on' : ''} onClick={() => setDate(d.iso)}>
            <span>{d.label}</span>
            <b>{d.day}</b>
          </button>
        ))}
      </div>

      {link.kind !== 'rest' && (
        <div className="train-day">
          <span className="eyebrow">{link.kind === 'lift' ? 'יום אימון' : 'יום אירובי'}</span>
          <p>
            <b>{link.workout?.title ?? (link.cardio ? CARDIO[link.cardio.type].name : '')}</b> בשעה {fmtMin(link.startMin!)}. התפריט מותאם: יותר פחמימה לפני האימון, חלבון ופחמימה אחריו
            {link.kind === 'lift' ? ', ופחמימה מעט גבוהה יותר היום על חשבון שומן.' : '.'}{' '}
            <WhyButton title="למה התפריט משתנה בימי אימון" e={{ why: 'הקלוריות היומיות נשארות זהות, כי מאזן האנרגיה השבועי הוא שקובע את השינוי במשקל. הפחמימה מותאמת לעומס האימון (עמדת ACSM 2016). ארוחה 1-4 שעות לפני אימון עם פחמימה ומעט שומן נותנת דלק בלי כבדות, וארוחה אחרי האימון עם כ-0.3-0.4 גרם חלבון לק"ג ופחמימה תומכת בבניית השריר ובמילוי מאגרי הגליקוגן (עמדת ISSN על תזמון תזונה, 2017).', sources: ['kerksickTiming', 'acsmNutrition', 'schoenfeldProteinDist'] }} />
          </p>
        </div>
      )}

      <Card className="day-total">
        <div className="row between">
          <span>
            סה"כ ביום: <b>{fmt(plan.totals.kcal)}</b> / {fmt(target.kcal)} קק"ל · {fmt(plan.totals.protein)} / {target.protein} ג׳ חלבון
          </span>
          <span className={`badge ${plan.withinTolerance ? 'good' : 'warn'}`}>{plan.withinTolerance ? 'ביעד' : `סטייה ${fmt(plan.deviation.kcalPct * 100)}%`}</span>
        </div>
        {!plan.withinTolerance && (
          <p className="fineprint">
            {profile.mealsPerDay < 5 && plan.deviation.kcalPct < 0
              ? 'היעד גבוה ביחס למספר הארוחות: המנות כבר בגודל המקסימלי הסביר. מומלץ להוסיף ארוחת ביניים (בפרופיל: ארוחות ביום).'
              : 'עם ההעדפות שבחרת אין מספיק מנות מתאימות כדי לעמוד ביעד בדיוק. אפשר להרחיב את ההעדפות בפרופיל.'}
          </p>
        )}
      </Card>

      {plan.meals.map((m, idx) => {
        const r = RECIPES.find((x) => x.id === m.recipeId)!;
        const isOpen = open === idx;
        return (
          <Card
            key={idx}
            className={m.role ? `meal-${m.role}` : ''}
            title={
              <>
                {SLOT_LABEL[m.slot]} <span className="meal-time">{fmtMin(link.mealTimes[idx] ?? 0)}</span>
                {m.role && <span className={`role-tag ${m.role}`}>{m.role === 'pre' ? 'לפני אימון' : 'אחרי אימון'}</span>}
              </>
            }
            action={<span className="muted">{r.prepMinutes} דק׳ הכנה</span>}
          >
            <button className="meal-head" onClick={() => setOpen(isOpen ? null : idx)} aria-expanded={isOpen}>
              <strong>{r.name}</strong>
              <span className="muted">
                {fmt(m.nutrients.kcal)} קק"ל · {fmt(m.nutrients.protein)} חלבון · {fmt(m.nutrients.carbs)} פחמימה · {fmt(m.nutrients.fat)} שומן
              </span>
            </button>
            {isOpen && (
              <div className="recipe">
                <h4>מצרכים</h4>
                <ul>
                  {m.items.map((it) => (
                    <li key={it.foodId}>
                      {FOOD_BY_ID[it.foodId].name}: {describeAmount(it.foodId, it.grams)}
                    </li>
                  ))}
                </ul>
                <h4>הכנה</h4>
                <ol>
                  {r.steps.map((st) => (
                    <li key={st}>{st}</li>
                  ))}
                </ol>
                <p className="fineprint">הכמויות מותאמות ליעדים שלך. הערכים התזונתיים לפי מאגר התזונה של משרד הבריאות.</p>
              </div>
            )}
            <div className="row">
              <Button kind="secondary" onClick={() => setSwap(idx)}>
                החלפת מנה
              </Button>
              {date === todayISO() && (
                <Button
                  kind="ghost"
                  onClick={() => {
                    addLog({ date, time: nowTime(), slot: m.slot, items: [{ foodId: r.id, name: r.name, grams: 0 }], method: 'plan', nutrients: m.nutrients });
                    learn((l) => recordRecipe(l, r.id, 'eaten'));
                  }}
                >
                  אכלתי את זה
                </Button>
              )}
            </div>
          </Card>
        );
      })}

      <Sheet open={swap !== null} onClose={() => setSwap(null)} title="שלוש חלופות ששומרות על היעד">
        {alts.length === 0 && <Banner>אין חלופות שמתאימות להעדפות שלך לארוחה הזו.</Banner>}
        <ul className="results">
          {alts.map((a) => (
            <li key={a.recipe.id} className="result">
              <div>
                <strong>{a.recipe.name}</strong>
                <div className="muted">
                  {fmt(a.nutrients.kcal)} קק"ל · {fmt(a.nutrients.protein)} חלבון
                </div>
              </div>
              <Button
                onClick={() => {
                  const old = plan.meals[swap!].recipeId;
                  learn((l) => recordRecipe(recordRecipe(l, old, 'swappedOut'), a.recipe.id, 'swappedIn'));
                  setState((x) => ({ planFixed: { ...x.planFixed, [date]: { ...(x.planFixed[date] ?? {}), [swap!]: a.recipe.id } } }));
                  setSwap(null);
                }}
              >
                לבחור
              </Button>
            </li>
          ))}
        </ul>
        <p className="fineprint">אחרי ההחלפה, שאר הארוחות של היום מתאזנות מחדש.</p>
      </Sheet>

      <Sheet open={shop} onClose={() => setShop(false)} title="רשימת קניות לשבוע">
        <ul className="shop">
          {list.map((i) => (
            <li key={i.foodId}>
              <span>{FOOD_BY_ID[i.foodId].name}</span>
              <b>{i.grams >= 1000 ? `${fmt(i.grams / 1000, 1)} ק"ג` : `${i.grams} ג׳`}</b>
            </li>
          ))}
        </ul>
        <div className="row">
          <a className="btn primary" href={`https://wa.me/?text=${encodeURIComponent('רשימת קניות לשבוע (PRIME)\n' + shopText)}`} target="_blank" rel="noreferrer">
            שיתוף בוואטסאפ
          </a>
          <Button kind="secondary" onClick={() => navigator.clipboard?.writeText(shopText)}>
            העתקה
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
