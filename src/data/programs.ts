import type { Goal } from '../engine/types';

export interface Program {
  id: string;
  name: string;
  forWho: string;
  weeks: number | null;
  goal: Goal;
  includes: string[];
  requires: { strength: boolean; minTrainingDays: number };
  expect: string;
  sources: string[];
  author: string | null; // spec: written/approved by a licensed professional; null = pending
}

export const PROGRAMS: Program[] = [
  {
    id: 'cut_keep_muscle',
    name: 'ירידה בשומן ושמירה על שריר',
    forWho: 'מתאמנים עם ניסיון באימוני כוח',
    weeks: 12,
    goal: 'fat_loss',
    includes: ['גירעון מתון של כ-0.5% ממשקל הגוף בשבוע', 'חלבון 2.0 גרם לק"ג', 'שבוע הפסקה מתוכנן אחרי שבוע 8', 'עדכון יעד כל שבועיים לפי המגמה'],
    requires: { strength: true, minTrainingDays: 3 },
    expect: 'ירידה הדרגתית במשקל ובהיקף המותן, כשרוב הירידה היא שומן.',
    sources: ['issnProtein', 'hall2011', 'forbes'],
    author: null,
  },
  {
    id: 'lean_bulk',
    name: 'בניית שריר נקייה',
    forWho: 'מתאמנים שרוצים להוסיף מסה',
    weeks: 16,
    goal: 'muscle_gain',
    includes: ['עודף קטן של 150-350 קק"ל ביום', 'מעקב אחרי קצב העלייה במשקל', 'חלבון 1.8 גרם לק"ג'],
    requires: { strength: true, minTrainingDays: 3 },
    expect: 'עלייה איטית במשקל, ועלייה הדרגתית בכוח באימונים.',
    sources: ['issnProtein', 'acsmNutrition'],
    author: null,
  },
  {
    id: 'recomp',
    name: 'ריקומפוזיציה',
    forWho: 'מתחילים או חוזרים לאימונים',
    weeks: 12,
    goal: 'recomp',
    includes: ['קלוריות קרובות לתחזוקה', 'חלבון גבוה', 'אימוני כוח 3 פעמים בשבוע'],
    requires: { strength: true, minTrainingDays: 3 },
    expect: 'המשקל כמעט לא משתנה, אבל ההיקפים והכוח משתפרים. לכן מודדים היקפים ולא רק משקל.',
    sources: ['issnProtein', 'forbes'],
    author: null,
  },
  {
    id: 'endurance',
    name: 'סבולת: 10K עד מרתון',
    forWho: 'רצים',
    weeks: null,
    goal: 'performance',
    includes: ['פחמימות לפי עומס האימון של כל יום', 'תזונה במהלך ריצות ארוכות', 'העמסת פחמימות לפני תחרות'],
    requires: { strength: false, minTrainingDays: 3 },
    expect: 'יותר אנרגיה באימונים הארוכים ובימים שאחריהם.',
    sources: ['acsmNutrition'],
    author: null,
  },
  {
    id: 'strength_weightclass',
    name: 'כוח והרמת משקולות',
    forWho: 'מרימים ומתאמני קרוספיט',
    weeks: 12,
    goal: 'performance',
    includes: ['תזונה לפי קטגוריית המשקל', 'התכווננות לשקילה בלי התייבשות קיצונית'],
    requires: { strength: true, minTrainingDays: 3 },
    expect: 'שמירה על כוח, ומשקל יציב לקראת התחרות.',
    sources: ['acsmNutrition', 'issnProtein'],
    author: null,
  },
  {
    id: 'metabolic_40',
    name: 'בריאות מטבולית בגיל הביניים',
    forWho: 'בני 40 ומעלה עם עודף משקל',
    weeks: 16,
    goal: 'fat_loss',
    includes: ['גירעון מתון', 'סיבים לפי ההמלצה', 'יעד צעדים יומי', 'כוח בסיסי פעמיים בשבוע'],
    requires: { strength: false, minTrainingDays: 0 },
    expect: 'ירידה הדרגתית במשקל, ושיפור בכושר היומיומי.',
    sources: ['whoActivity', 'dga', 'hall2011'],
    author: null,
  },
  {
    id: 'vegan_athlete',
    name: 'תזונה טבעונית לספורטאים',
    forWho: 'צמחונים וטבעונים',
    weeks: null,
    goal: 'performance',
    includes: ['שילוב מקורות חלבון מהצומח', 'תשומת לב ל-B12, ברזל ואומגה 3'],
    requires: { strength: false, minTrainingDays: 0 },
    expect: 'מספיק חלבון ומיקרו מהצומח, בלי לוותר על ביצועים.',
    sources: ['acsmNutrition', 'issnProtein'],
    author: null,
  },
  {
    id: 'reverse',
    name: 'הפסקת דיאטה ותחזוקה',
    forWho: 'מי שסיים גירעון קלורי',
    weeks: 6,
    goal: 'health',
    includes: ['עלייה הדרגתית לרמת תחזוקה', 'מעקב מגמה כדי לא לעלות בשומן'],
    requires: { strength: false, minTrainingDays: 0 },
    expect: 'יותר אנרגיה ותיאבון יציב, כשהמשקל נשאר בטווח.',
    sources: ['hall2011'],
    author: null,
  },
];
