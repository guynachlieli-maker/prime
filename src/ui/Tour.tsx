import { useEffect, useLayoutEffect, useState } from 'react';

export interface TourStep {
  selector: string;
  title: string;
  text: string;
}

export const MAIN_TOUR: TourStep[] = [
  { selector: '[data-tour="ring"]', title: 'הטבעת', text: 'כמה קלוריות נשארו לך להיום. היא מתמלאת עם כל ארוחה שנרשמת.' },
  { selector: '[data-tour="macros"]', title: 'חלבון, פחמימה ושומן', text: 'ליד כל אחד יש כפתור "למה?" שמסביר מאיפה הגיע המספר, עם המחקר שמאחוריו.' },
  { selector: '[data-tour="day"]', title: 'היום שלך', text: 'הארוחות והאימון על ציר זמן אחד. ביום אימון, הארוחה שלפניו והארוחה שאחריו מותאמות לו אוטומטית.' },
  { selector: '.tab-menu', title: 'תפריט', text: 'תפריט שבועי לפי היעד שלך, שמשתנה בין ימי אימון למנוחה. אפשר להחליף מנה, ולקבל רשימת קניות.' },
  { selector: '.tab-camera', title: 'רישום אוכל', text: 'מצלמים צלחת, סורקים ברקוד, מחפשים או מקלידים במילים.' },
  { selector: '.tab-training', title: 'אימון', text: 'תוכנית האימונים שנבנתה מאותן תשובות: האימון של היום, רישום סטים, שעון מנוחה, מאגר תרגילים עם מפת שרירים.' },
  { selector: '.tab-progress', title: 'התקדמות', text: 'הגוף שלך לאורך הזמן, מגמת המשקל, והדוח השבועי של תזונה ואימונים.' },
  { selector: '[data-tour="habits"]', title: 'מים ושקילה', text: 'לחיצה אחת. שקילה בבוקר מספיקה כדי שהיעדים יתעדכנו לפי הגוף שלך.' },
  { selector: '.avatar-btn', title: 'פרופיל', text: 'המטרה, תוספי תזונה, תזכורות לארוחות ולאימונים, ונתונים מהשעון.' },
];

export function Tour({ steps, onDone, onFinishAction }: { steps: TourStep[]; onDone: () => void; onFinishAction?: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  useLayoutEffect(() => {
    const el = document.querySelector(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step.selector]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const pad = 8;
  const last = i === steps.length - 1;
  const bubbleTop = rect ? (rect.bottom + 180 < window.innerHeight ? rect.bottom + pad + 8 : Math.max(12, rect.top - pad - 172)) : window.innerHeight / 2 - 80;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="סיור מודרך">
      {rect ? (
        <div className="tour-spot" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-bubble" style={{ top: bubbleTop }}>
        <div className="tour-count">
          {i + 1} / {steps.length}
        </div>
        <strong>{step.title}</strong>
        <p>{step.text}</p>
        <div className="row between">
          <button className="link" onClick={onDone}>
            דילוג
          </button>
          <button
            className="btn primary"
            autoFocus
            onClick={() => {
              if (!last) setI(i + 1);
              else {
                onDone();
                onFinishAction?.();
              }
            }}
          >
            {last ? 'בוא נצלם את הארוחה הראשונה יחד' : 'הבא'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const WEEK_TIPS: Record<number, { title: string; text: string }> = {
  1: { title: 'איך מצלמים נכון', text: 'מלמעלה, באור טוב, כל הצלחת בפריים. אחרי הזיהוי, תקנו כמויות או לחצו "לא זה?" כדי להחליף מאכל. זה לוקח שנייה ומשפר את ההערכה.' },
  2: { title: 'ברקוד וארוחות קבועות', text: 'אוכל ארוז? ברקוד מדויק יותר מצילום. ארוחה שחוזרת על עצמה? שמרו אותה כ"קבועה" ורשמו בלחיצה.' },
  3: { title: 'למה המשקל קופץ', text: 'מים ואוכל במעיים משנים את המשקל מיום ליום. בגרף ההתקדמות מסתכלים על קו המגמה, לא על הנקודות.' },
  4: { title: 'החלפת מנה', text: 'לא בא לך מה שבתפריט? "החלפת מנה" נותנת 3 חלופות ששומרות על היעד.' },
  5: { title: 'ספריית הידע', text: 'במסך "תכניות" יש מאמרים קצרים עם מקורות. התחילו מהמאמר על חלבון.' },
  7: { title: 'הדוח השבועי הראשון', text: 'במסך "התקדמות": מה קרה השבוע, מה זה אומר, ומה משתנה. אחרי שבועיים נציע לעדכן את היעדים לפי הנתונים שלך.' },
};
