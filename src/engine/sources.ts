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
    url: 'https://doi.org/10.1079/BJN19910073',
    level: 'moderate',
  },
  hackersDiet: {
    id: 'hackersDiet',
    title: 'מגמת משקל בממוצע נע מעריכי',
    citation: 'Walker J. The Hacker’s Diet. 1991 (moving-average weight trend method). שיטה סטטיסטית מקובלת, לא מחקר קליני.',
    url: 'https://www.fourmilab.ch/hackdiet/',
    level: 'moderate',
  },
  who_bmi: {
    id: 'who_bmi',
    title: 'סיווג BMI של WHO',
    citation: 'World Health Organization. Obesity: preventing and managing the global epidemic. WHO Technical Report Series 894. 2000.',
    level: 'strong',
  },
};

export function getSources(ids: string[]): Source[] {
  return ids.map((id) => SOURCES[id]).filter((s): s is Source => Boolean(s));
}
