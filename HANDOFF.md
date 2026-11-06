# PRIME: מסמך מסירה לצוות הפיתוח

גרסה עובדת של האפליקציה (ווב, מותאמת לנייד, ניתנת להתקנה כ-PWA), בנויה לפי מסמך האפיון "אפיון אפליקציית משטר בריאותי למקצוענים".
הגרסה הזו היא אב טיפוס מלא של כל המסכים והחישובים. היא לא מוכנה להשקה מסחרית: יש תנאים קליניים, משפטיים ותשתיתיים שלא ניתן לסגור בקוד בלבד. הם מפורטים למטה.

## הרצה

```bash
npm install
npm run dev        # פיתוח
npm test           # 37 בדיקות יחידה (חישובים, בטיחות, תפריטים על 297 פרופילים, ייבוא מכשירים, למידה)
npm run build      # בנייה ל-dist/
```

בדיקות דפדפן (Playwright), כשהשרת רץ על פורט 4173 (`npx vite preview --port 4173`):

```bash
node tests/e2e/flow.cjs <תיקייה לצילומי מסך>     # כל הזרימה: הרשמה, סיור, רישום, תפריט, התקדמות, פורטל
cd tests/e2e && node vision.cjs <תיקייה>          # זיהוי תמונה מול תשובת API מדומה
node tests/e2e/features.cjs <תיקייה> <קובץ CSV של Whoop>   # חיפוש במאגר, ברקוד, ייבוא מכשיר, תמונת פרופיל, למידה, נגישות
```

## מה בנוי (מול האפיון)

| פרק באפיון | מצב | איפה בקוד |
| --- | --- | --- |
| כניסה למערכת: 9 שלבים, שמירה בכל שלב, דילוג על שלבים לא בטיחותיים | בנוי | `src/screens/Onboarding.tsx` |
| סיור מודרך (5 עצירות) + הדרכה ימים 1-7 | בנוי | `src/ui/Tour.tsx`, `src/screens/Today.tsx` |
| שאלון התאמה: PAR-Q+, סינון רפואי, SCOFF | בנוי | `src/engine/safety.ts` |
| מעקות בטיחות: רצפת קלוריות, קצב מקסימלי, זיהוי דפוסים מסוכנים | בנוי, ערכים זמניים | `SAFETY_CONFIG` ב-`safety.ts` |
| BMR (Mifflin / Katch), TDEE, יעדים עם "למה?" ומקור לכל מספר | בנוי + נבדק | `src/engine/targets.ts` |
| כיול שבועי של ההוצאה היומית לפי מגמת משקל | בנוי + נבדק | `src/engine/adaptive.ts` |
| רישום: צילום, חיפוש, ברקוד, טקסט/קול, ארוחות קבועות | בנוי (ראו הערות) | `src/screens/Capture.tsx` |
| טווח קלוריות לפי רמת הביטחון בזיהוי, שאלת הבהרה אחת | בנוי | `Capture.tsx`, `src/engine/vision.ts` |
| מנוע תפריטים: יעד ±5%, אלרגיה = חסימה, כשרות, צמחוני/טבעוני, החלפת מנה, רשימת קניות + וואטסאפ | בנוי + נבדק | `src/engine/menu.ts`, `src/screens/Menu.tsx` |
| ספריית 8 תכניות, המלצה אחת + 2 חלופות, נעילה לפי השאלון | בנוי | `src/screens/Programs.tsx` |
| ספריית ידע עם דירוג ראיות | 5 מאמרים | `src/data/articles.ts` |
| גוף תלת־ממדי, היום מול התחזית, סרגל 4/8/12/24 שבועות, שכבת נתונים, כיבוי | בנוי | `src/ui/Avatar3D.tsx`, `src/screens/Progress.tsx` |
| תחזית הרכב גוף (מאזן אנרגיה + Forbes), טווח אי־ודאות, זמן ליעד | בנוי + נבדק | `src/engine/forecast.ts` |
| גרף מגמה, דוח שבועי (מה קרה / מה זה אומר / מה משתנה), היקפים, תמונות | בנוי | `Progress.tsx`, `src/ui/WeightChart.tsx` |
| פורטל מקצוענים: לוח לפי תשומת לב, תיק מתאמן, הערות, הודעות | הדגמה בלבד | `src/screens/Pro.tsx` |
| פרטיות: ייצוא ומחיקה מלאה, תמונות במכשיר בלבד, הסכמה נפרדת לשימוש בתמונות | בנוי | `src/screens/Profile.tsx`, `src/state/store.ts` |
| מצב כהה, RTL מלא, ניגודיות, קורא מסך, הפחתת תנועה | בנוי | `src/styles.css` |

## עדכון 2: מה נוסף בסבב השני

| נושא | מה נעשה | איפה |
| --- | --- | --- |
| מאגר מזון רשמי | 153 מזונות ליבה וכל 4,509 המזונות של **מאגר התזונה הלאומי של משרד הבריאות** (data.gov.il), עם יחידות מידה רשמיות. הערכים המשוערים מהגרסה הראשונה הוסרו | `scripts/build-foods.py`, `src/data/generated/core-foods.json`, `public/moh-foods.json` |
| מתכונים | 110 מתכונים ישראליים על בסיס המזונות הרשמיים, ממתינים לאישור דיאטנית | `src/data/recipes.ts` |
| מנוע תפריטים | התאמה ברמת הרכיב (לא "מנה ×2"), תקרות מנה ריאליות, כוונון יומי משותף. נבדק על 297 פרופילים: 96% ומעלה ביעד (±5% קלוריות, ±10% חלבון) | `src/engine/menu.ts` |
| זיהוי תמונה | עובד בעמוד שפורסם ב-claude.ai דרך יכולת "sample" (תמונה ל-Claude בחשבון של הצופה, אחרי אישור). חלופה: מפתח API | `src/engine/vision.ts`, `src/engine/claude-runtime.ts` |
| ברקוד | סריקה חיה במצלמה (BarcodeDetector או ZXing, כולל אייפון), צילום ברקוד, הקלדה. טבלת מוצרים ישראליים מ-Open Food Facts (770 מוצרים בשלב זה), מסומנת "לבדוק מול התווית". מוצר חסר: צילום התווית התזונתית וקריאה שלה | `src/engine/barcode.ts`, `scripts/build-products.py` |
| מכשירים | Bluetooth (רצועות דופק, משקלים בתקן Weight Scale). ייבוא קבצים מ-Apple Health, Garmin, Whoop, Oura, Samsung, Fitbit, Polar ו-Withings. כרטיסי חיבור לענן עם מה שנדרש לכל חברה | `src/engine/devices.ts`, `src/screens/Devices.tsx` |
| למידה אישית | העדפות מנות (אכילה והחלפה), כיול הערכת הצילום (±25%, רק אחרי 3 תיקונים), שעות ארוחות, הוצאה יומית לפי מגמה. מסך "מה המערכת למדה עליך" עם איפוס. לא משנה את מעקות הבטיחות | `src/engine/learning.ts` |
| הולוגרמה | גוף חלק יותר, אפקט זוהר, קרן מקרן וחלקיקים, מעבר רציף בין נקודות זמן, וקו המתאר של היום על גוף התחזית | `src/ui/Avatar3D.tsx` |
| נגישות | מצב נבחר עם ✓, מסגרת עבה ומילוי מלא (לא צבע בלבד, WCAG 1.4.1) | `src/styles.css` |
| תמונת פרופיל | העלאה, חיתוך לריבוע, שמירה במכשיר | `src/screens/Profile.tsx` |

**עדכון 3 (ברקוד ומצלמה):**
- חיפוש ברקוד בשלוש שכבות: מוצרים שהמשתמש צילם להם תווית (נשמרים במכשיר) ← Open Food Facts בזמן אמת (כ-3 מיליון מוצרים בעולם, כולל מוצרי יבוא) ← טבלה ישראלית מובנית (עובדת גם בלי רשת).
- בתוך claude.ai, לעמוד אין גישה למצלמה ולרשת חיצונית: הסריקה החיה והחיפוש בזמן אמת עובדים רק כשהאפליקציה רצה כאתר עצמאי (למשל GitHub Pages מענף `gh-pages`). נוסף כפתור "בחירת תמונה מהגלריה" כגיבוי.
- **אינדקס ברקודים ישראלי:** 67,624 ברקודים מקובצי שקיפות המחירים של 9 רשתות (רמי לוי, יוחננוף, אושר עד, טיב טעם, דור אלון, קשת, סלח דבאח, סטופ מרקט, פוליצר): שם, יצרן, ארץ ייצור, גודל. בדגימה של 40 מוצרים, ל-15% היו ערכים תזונתיים ב-Open Food Facts (חלק גדול מהמוצרים בקבצים אינם מזון). כשאין ערכים, האפליקציה מציעה מוצר דומה ממאגר משרד הבריאות או מבקשת צילום תווית פעם אחת. בנייה: `scripts/build-barcodes.py`. כדאי לרענן מדי שבוע משרת.
- האתר העצמאי: https://guynachlieli-maker.github.io/prime/ (ענף `gh-pages`).
- כיסוי מלא של כל מוצרי הסופר בישראל: המקור המלא הוא GS1 ישראל (מאגר המוצרים של היצרנים, כולל ערכים תזונתיים; דורש הסכם מסחרי). השלמה: קובצי שקיפות המחירים שרשתות מחויבות לפרסם (ברקוד, שם, יצרן, ארץ ייצור, בלי ערכים תזונתיים). השרתים של שופרסל, קרפור וויקטורי חוסמים גישה מחוץ לישראל: את האיסוף צריך להריץ משרת בישראל.

**מה עדיין דורש עבודה מחוץ לקוד:**
- **ברקודים:** טבלת Open Food Facts חלקית (השרת שלהם הגביל הורדות). להשקה צריך פיד מאומת מרשתות ויצרנים, כנדרש באפיון.
- **חיבור ענן לשעונים:** Garmin Health API דורש אישור שותף. Whoop, Oura, Fitbit, Withings ו-Polar דורשים רישום אפליקציה (OAuth) ושרת. ב-iOS, HealthKit זמין רק באפליקציה נייטיב.
- **Bluetooth:** עובד בכרום (אנדרואיד ומחשב). Safari באייפון לא תומך ב-Web Bluetooth.
- **זיהוי תמונה ב-claude.ai:** תלוי בכך שהצופה מאשר שימוש ב-Claude. בגרסה המסחרית, הזיהוי עובר דרך שרת החברה.

## מה חסר כדי להשיק (לא ניתן לסגור בקוד)

1. **אישור קליני.** `SAFETY_CONFIG.approvedByClinician = false`. רצפות הקלוריות (1500/1200), קצב הירידה, ספי SCOFF ו-BMI הם ערכים שמרניים זמניים. הדיאטנית הקלינית והרופא חייבים לקבוע אותם.
2. **מאגר מזון.** ~~ערכים משוערים~~: הוחלף במאגר הרשמי של משרד הבריאות (עדכון 2). נותר: אישור דיאטנית לבחירת הרשומה המתאימה לכל מזון ליבה (`CORE` ב-`scripts/build-foods.py`), ומידע על אלרגנים למזונות מהמאגר המלא (המאגר הרשמי לא כולל אלרגנים).
3. **מתכונים ותכניות.** 110 מתכונים ו-8 תכניות, כולם `approvedBy: null` (מוצג "ממתין לאישור"). יעד האפיון: כ-400 מתכונים מאושרים.
4. **מקורות.** `src/engine/sources.ts` נכתב מהידע המקצועי המוכר. היועץ הקליני צריך לאמת כל ציטוט, DOI ומהדורה.
5. **שרת.** כרגע הכול נשמר ב-localStorage בדפדפן. נדרש: חשבונות משתמשים, מסד נתונים מוצפן, וקריאה לזיהוי התמונה **דרך השרת**. כרגע המשתמש מדביק מפתח API אישי, וזה מתאים רק לבדיקות.
6. **ברקודים.** `VERIFIED_BARCODES` ריק בכוונה. לפי האפיון, ברקודים מגיעים רק משותפות עם רשתות ויצרנים, לא ממאגרים שמשתמשים מזינים.
7. **אפליקציות נייטיב.** חיבור ל-HealthKit ול-Health Connect, LiDAR לנפח מנה ו-AR לגוף מחייבים אפליקציה נייטיב (האפיון ממליץ על React Native). מנוע החישובים (`src/engine/`) הוא TypeScript נקי בלי תלות בדפדפן, ואפשר להעביר אותו כמו שהוא.
8. **משפטי ורגולציה.** חוות דעת על סיווג כמכשיר רפואי, ועל עמידה בחוק הגנת הפרטיות (תיקון 13), במדיניות החנויות ובתקנות הנגישות.
9. **פורטל מקצוענים.** הממשק קיים עם נתונים בדויים. צריך שרת, הזמנות, הרשאות שיתוף ואימות רישיונות.
10. **מודל הגוף.** האבטאר בנוי מצורות פרמטריות (בלי רישיון חיצוני). לשדרוג ריאליסטי, יש לבדוק רישוי של מודל כמו SMPL.

## הנחות במודל התחזית (לוועדה המדעית)

- אימוני כוח עם חלבון גבוה מקטינים בחצי את איבוד המסה הרזה בגירעון.
- בעודף קלורי עם אימוני כוח, חצי מהמשקל שעולה הוא מסה רזה.
- ההוצאה היומית משתנה לפי Mifflin ככל שהמשקל משתנה, בלי רכיב נוסף של הסתגלות מטבולית.
- הטווח בתחזית מבטא אי־ודאות של ±10% בהוצאה היומית.
- כשאחוז השומן לא ידוע, הוא מוערך מ-BMI (Deurenberg 1991). זו הערכה גסה, והמשתמש רואה זאת.

## מבנה

```
src/engine/   חישובים טהורים (יעדים, בטיחות, כיול, תחזית, תפריטים, זיהוי, ברקוד, מכשירים, למידה, פענוח טקסט) + בדיקות
scripts/      בניית נתוני המזון (משרד הבריאות) וטבלת המוצרים (Open Food Facts)
src/data/     מזונות, מתכונים, תכניות, מאמרים
src/state/    מצב האפליקציה ושמירה מקומית
src/ui/       רכיבים משותפים, אבטאר, גרף, סיור
src/screens/  המסכים
tests/e2e/    בדיקות דפדפן
```

## רישוי נתונים

- **מאגר התזונה הלאומי (משרד הבריאות)**: data.gov.il, רישיון "Other (Open)". יש לציין את המקור במוצר (כבר מוצג במסכי הרישום).
- **Open Food Facts**: רישיון ODbL. נדרש ייחוס, ושיתוף השינויים במסד הנתונים (share-alike) אם מפיצים אותו. יש לבדוק עם היועץ המשפטי לפני שימוש מסחרי.

## Update 4 — goal weight, body journey, reminders, module infrastructure

- **Goal weight + date** (`src/engine/pace.ts`): onboarding step 7 asks for target weight and an optional date. `planPace` derives the weekly change: inside the person's safe cap (≤1%/week; 0.5% when lean, 0.75% typical, 1% only with high body fat / BMI ≥ 32) the date sets the pace; beyond it the cap applies and the insight says when the target is realistically reached. Targets below BMI 18.5 are lifted to it. `computeTargets` exposes `goalPlan` (insight, ETA, feasibility).
- **Body journey** (`src/ui/BodyJourney.tsx`, `simulateJourney` in forecast.ts): today vs. the selected week side by side, play button + slider + milestones (month, 3 months, half year, goal). The future body carries an orange outline of today's body. Shape sensitivity raised in `src/engine/bodyshape.ts`.
- **Reminders** (`src/engine/reminders.ts`, `src/state/notify.ts`, `src/screens/Reminders.tsx`): meal times (learned from logging times), weigh-in, water, a daily motivation message written from the day's data, and custom fixed-time reminders. Delivery: in-app card when open; system notification via the service worker when in background; Notification Triggers where supported; `.ics` calendar export for alerts with the app closed on any phone. True push with the app closed on all phones needs a push server (Web Push + VAPID) — not built.
- **Removed**: coach portal, dietitian-approval badges, device step in onboarding, cloud-connection notes, developer notes in the UI. Only the medical disclaimer remains (Profile → הצהרה).
- **Modules** (`src/modules/registry.ts`, `src/modules/training/types.ts`): nutrition active; training data model + storage slot (`state.training`, `state.modules.training`, reminder kind `training`) ready for a later release.

## Update 5 — reliable body view, photo naming, varied menus, supplements

- **Body view** is now a 2D SVG hologram (`src/ui/HoloFigure.tsx`), no WebGL/three.js (removed): renders instantly on every phone. Today (blue) vs chosen time (green) with today's outline (orange dashed) and large captions. Time is chosen with buttons (month / 3 months / half year / year / goal) and a play button; no slider. The change is emphasized ×2.2 for visibility (clamped to a lean reference) and labelled as an illustration; the numbers are the real forecast.
- **Photo recognition**: the model returns the specific Hebrew name it saw plus look-alike alternatives; `resolveByName` (vision.ts) replaces a wrong closest match by looking that name up in the full national table. Each recognized item has a "לא זה?" button with alternatives and a search.
- **Menus**: per-user variety seed (`startedAt`), recipes planned in the previous 3 days are avoided, wider candidate pool; falls back to tighter selection when a varied day can't hit the targets (accuracy test unchanged).
- **Supplements** (`src/data/supplements.ts`): asked in onboarding (preferences) and editable in Profile. Protein powder / plant protein / gainer / protein bar / collagen are subtracted from the menu targets and logged from the Today checklist; all supplements get time-of-day reminders.
