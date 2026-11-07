// Every number the app shows must point to one or more of these sources.
// Status: compiled from the spec's source list. The clinical advisor must
// verify each entry (current edition, exact values) before launch.

export type EvidenceLevel = 'strong' | 'moderate';

export interface Source {
  id: string;
  title: string;
  citation: string;
  url?: string;
  level: EvidenceLevel;
}

export const SOURCES: Record<string, Source> = {
  mifflin: {
    id: 'mifflin',
    title: 'נוסחת Mifflin-St Jeor לחילוף חומרים במנוחה',
    citation:
      'Mifflin MD, St Jeor ST, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.',
    url: 'https://doi.org/10.1093/ajcn/51.2.241',
    level: 'strong',
  },
  katch: {
    id: 'katch',
    title: 'נוסחת Katch-McArdle לפי מסה רזה',
    citation: 'Katch FI, McArdle WD. Nutrition, Weight Control, and Exercise.',
    level: 'moderate',
  },
  hall2011: {
    id: 'hall2011',
    title: 'מודל דינמי של שינוי משקל והרכב גוף',
    citation:
      'Hall KD, Sacks G, Chandramohan D, et al. Quantification of the effect of energy imbalance on bodyweight. Lancet. 2011;378(9793):826-837.',
    url: 'https://doi.org/10.1016/S0140-6736(11)60812-X',
    level: 'strong',
  },
  forbes: {
    id: 'forbes',
    title: 'חלוקת שינוי המשקל בין שומן למסה רזה',
    citation:
      'Forbes GB. Body fat content influences the body composition response to nutrition and exercise. Ann N Y Acad Sci. 2000;904:359-365.',
    level: 'moderate',
  },
  issnProtein: {
    id: 'issnProtein',
    title: 'עמדת ISSN: חלבון ופעילות גופנית',
    citation:
      'Jäger R, Kerksick CM, et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.',
    url: 'https://doi.org/10.1186/s12970-017-0177-8',
    level: 'strong',
  },
  acsmNutrition: {
    id: 'acsmNutrition',
    title: 'תזונה וביצועים ספורטיביים (ACSM / AND / DC)',
    citation:
      'Thomas DT, Erdman KA, Burke LM. American College of Sports Medicine Joint Position Statement. Nutrition and Athletic Performance. Med Sci Sports Exerc. 2016;48(3):543-568.',
    url: 'https://doi.org/10.1249/MSS.0000000000000852',
    level: 'strong',
  },
  whoActivity: {
    id: 'whoActivity',
    title: 'הנחיות WHO לפעילות גופנית',
    citation: 'World Health Organization. WHO guidelines on physical activity and sedentary behaviour. 2020.',
    url: 'https://www.who.int/publications/i/item/9789240015128',
    level: 'strong',
  },
  dga: {
    id: 'dga',
    title: 'Dietary Guidelines for Americans 2020-2025',
    citation: 'U.S. Department of Agriculture and U.S. Department of Health and Human Services. Dietary Guidelines for Americans, 2020-2025.',
    url: 'https://www.dietaryguidelines.gov/',
    level: 'strong',
  },
  efsaWater: {
    id: 'efsaWater',
    title: 'ערכי ייחוס של EFSA לשתייה',
    citation: 'EFSA Panel on Dietetic Products, Nutrition, and Allergies. Scientific Opinion on Dietary Reference Values for water. EFSA Journal 2010;8(3):1459.',
    url: 'https://doi.org/10.2903/j.efsa.2010.1459',
    level: 'strong',
  },
  parq: {
    id: 'parq',
    title: 'שאלון מוכנות לפעילות גופנית PAR-Q+',
    citation: 'Warburton DER, Jamnik VK, Bredin SSD, Gledhill N. The Physical Activity Readiness Questionnaire for Everyone (PAR-Q+). Health & Fitness Journal of Canada. 2011;4(2):3-23.',
    url: 'https://eparmedx.com/',
    level: 'strong',
  },
  scoff: {
    id: 'scoff',
    title: 'שאלון SCOFF לסינון הפרעות אכילה',
    citation: 'Morgan JF, Reid F, Lacey JH. The SCOFF questionnaire: assessment of a new screening tool for eating disorders. BMJ. 1999;319(7223):1467-1468.',
    url: 'https://doi.org/10.1136/bmj.319.7223.1467',
    level: 'strong',
  },
  navy: {
    id: 'navy',
    title: 'הערכת אחוז שומן מהיקפים (U.S. Navy)',
    citation: 'Hodgdon JA, Beckett MB. Prediction of percent body fat for U.S. Navy men and women from body circumferences and height. Naval Health Research Center, 1984.',
    level: 'moderate',
  },
  deurenberg: {
    id: 'deurenberg',
    title: 'הערכת אחוז שומן מ-BMI, גיל ומין',
    citation: 'Deurenberg P, Weststrate JA, Seidell JC. Body mass index as a measure of body fatness: age- and sex-specific prediction formulas. Br J Nutr. 1991;65(2):105-114.',
    level: 'moderate',
  },
  hackersDiet: {
    id: 'hackersDiet',
    title: 'מגמת משקל בממוצע נע מעריכי',
    citation: 'Walker J. The Hacker’s Diet. 1991 (moving-average weight trend method). שיטה סטטיסטית מקובלת, לא מחקר קליני.',
    level: 'moderate',
  },
  who_bmi: {
    id: 'who_bmi',
    title: 'סיווג BMI של WHO',
    citation: 'World Health Organization. Obesity: preventing and managing the global epidemic. WHO Technical Report Series 894. 2000.',
    level: 'strong',
  },
  schoenfeldVolume: {
    id: 'schoenfeldVolume',
    title: 'נפח אימון ובניית שריר (מטא־אנליזה)',
    citation: 'Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis. J Sports Sci. 2017;35(11):1073-1082.',
    url: 'https://doi.org/10.1080/02640414.2016.1210197',
    level: 'strong',
  },
  schoenfeldFreq: {
    id: 'schoenfeldFreq',
    title: 'תדירות אימון ובניית שריר (מטא־אנליזה)',
    citation: 'Schoenfeld BJ, Ogborn D, Krieger JW. Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy: A Systematic Review and Meta-Analysis. Sports Med. 2016;46(11):1689-1697.',
    url: 'https://doi.org/10.1007/s40279-016-0543-8',
    level: 'strong',
  },
  schoenfeldLoad: {
    id: 'schoenfeldLoad',
    title: 'משקל כבד מול קל: כוח ומסת שריר (מטא־אנליזה)',
    citation: 'Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis. J Strength Cond Res. 2017;31(12):3508-3523.',
    url: 'https://doi.org/10.1519/JSC.0000000000002200',
    level: 'strong',
  },
  schoenfeldRest: {
    id: 'schoenfeldRest',
    title: 'מנוחה ארוכה בין סטים (ניסוי מבוקר)',
    citation: 'Schoenfeld BJ, Pope ZK, Benik FM, et al. Longer Interset Rest Periods Enhance Muscle Strength and Hypertrophy in Resistance-Trained Men. J Strength Cond Res. 2016;30(7):1805-1812.',
    url: 'https://doi.org/10.1519/JSC.0000000000001272',
    level: 'strong',
  },
  acsmProgression: {
    id: 'acsmProgression',
    title: 'עמדת ACSM: מודלים להתקדמות באימוני התנגדות',
    citation: 'American College of Sports Medicine. Progression models in resistance training for healthy adults. Med Sci Sports Exerc. 2009;41(3):687-708.',
    url: 'https://doi.org/10.1249/MSS.0b013e3181915670',
    level: 'strong',
  },
  acsmQuantity: {
    id: 'acsmQuantity',
    title: 'עמדת ACSM: כמות ואיכות של פעילות גופנית',
    citation: 'Garber CE, Blissmer B, Deschenes MR, et al. American College of Sports Medicine position stand. Quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy adults. Med Sci Sports Exerc. 2011;43(7):1334-1359.',
    url: 'https://doi.org/10.1249/MSS.0b013e318213fefb',
    level: 'strong',
  },
  robinsonFailure: {
    id: 'robinsonFailure',
    title: 'כמה קרוב לכשל להתאמן (מטא־רגרסיות)',
    citation: 'Robinson ZP, Pelland JC, Remmert JF, et al. Exploring the Dose-Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions. Sports Med. 2024;54(9):2209-2231.',
    url: 'https://doi.org/10.1007/s40279-024-02069-2',
    level: 'strong',
  },
  helmsPrep: {
    id: 'helmsPrep',
    title: 'המלצות מבוססות ראיות לחיטוב',
    citation: 'Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.',
    url: 'https://doi.org/10.1186/1550-2783-11-20',
    level: 'strong',
  },
  wilsonConcurrent: {
    id: 'wilsonConcurrent',
    title: 'שילוב אירובי ואימוני כוח (מטא־אנליזה)',
    citation: 'Wilson JM, Marin PJ, Rhea MR, et al. Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. J Strength Cond Res. 2012;26(8):2293-2307.',
    url: 'https://doi.org/10.1519/JSC.0b013e31823a3e2d',
    level: 'strong',
  },
  mortonProtein: {
    id: 'mortonProtein',
    title: 'חלבון ותוספת לשריר מאימון (מטא־אנליזה)',
    citation: 'Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376-384.',
    url: 'https://doi.org/10.1136/bjsports-2017-097608',
    level: 'strong',
  },
  compendium2024: {
    id: 'compendium2024',
    title: 'מדריך הפעילויות הגופניות 2024 (ערכי MET)',
    citation: 'Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities: A third update of the energy costs of human activities. J Sport Health Sci. 2024;13(1):6-12.',
    url: 'https://doi.org/10.1016/j.jshs.2023.10.010',
    level: 'strong',
  },
  kerksickTiming: {
    id: 'kerksickTiming',
    title: 'עמדת ISSN: תזמון תזונה סביב האימון',
    citation: 'Kerksick CM, Arent S, Schoenfeld BJ, et al. International society of sports nutrition position stand: nutrient timing. J Int Soc Sports Nutr. 2017;14:33.',
    url: 'https://doi.org/10.1186/s12970-017-0189-4',
    level: 'strong',
  },
  schoenfeldProteinDist: {
    id: 'schoenfeldProteinDist',
    title: 'כמה חלבון בכל ארוחה לבניית שריר',
    citation: 'Schoenfeld BJ, Aragon AA. How much protein can the body use in a single meal for muscle-building? Implications for daily protein distribution. J Int Soc Sports Nutr. 2018;15:10.',
    url: 'https://doi.org/10.1186/s12970-018-0215-1',
    level: 'strong',
  },
};

export function getSources(ids: string[]): Source[] {
  return ids.map((id) => SOURCES[id]).filter((s): s is Source => Boolean(s));
}
