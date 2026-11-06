"""Builds public/exercises.json from free-exercise-db (public domain, github.com/yuhonas/free-exercise-db).

Hebrew names are composed from a phrase glossary: [movement] [variant] [position] [equipment] [grip].
Names the glossary can't fully cover keep a Hebrew movement word plus the original English name
(always shown under the Hebrew one), so nothing is invented.

usage: python3 -I scripts/build-exercises.py <exercises.json> public/exercises.json
"""
import json
import re
import sys

MUSCLE_HE = {
    'abdominals': 'בטן', 'abductors': 'מרחיקי ירך', 'adductors': 'מקרבי ירך', 'biceps': 'יד קדמית (ביספס)',
    'calves': 'שוקיים', 'chest': 'חזה', 'forearms': 'אמות', 'glutes': 'ישבן', 'hamstrings': 'ירך אחורית',
    'lats': 'גב רחב', 'lower back': 'גב תחתון', 'middle back': 'גב אמצעי', 'neck': 'צוואר',
    'quadriceps': 'ירך קדמית', 'shoulders': 'כתפיים', 'traps': 'טרפזים', 'triceps': 'יד אחורית (טריספס)',
}
EQUIP_HE = {
    'barbell': 'מוט', 'dumbbell': 'משקולות יד', 'other': 'אחר', 'body only': 'משקל גוף', 'cable': 'כבלים',
    'machine': 'מכונה', 'kettlebells': 'קטלבל', 'bands': 'גומיות', 'medicine ball': 'כדור כוח',
    'exercise ball': 'כדור פיזיו', 'foam roll': 'גליל עיסוי', 'e-z curl bar': 'מוט EZ', None: 'ללא ציוד',
}
CAT_HE = {
    'strength': 'כוח', 'stretching': 'מתיחות', 'plyometrics': 'פליומטריקה', 'powerlifting': 'פאוורליפטינג',
    'olympic weightlifting': 'הרמה אולימפית', 'strongman': 'סטרונגמן', 'cardio': 'אירובי',
}
LEVEL_HE = {'beginner': 'מתחילים', 'intermediate': 'בינוני', 'expert': 'מתקדמים'}

# movement phrases (longest first). Value = Hebrew movement name.
MOVES = [
    ('romanian deadlift', 'דדליפט רומני'), ('stiff-legged deadlift', 'דדליפט רגליים ישרות'), ('stiff legged deadlift', 'דדליפט רגליים ישרות'),
    ('sumo deadlift', 'דדליפט סומו'), ('deficit deadlift', 'דדליפט מגובה'), ('deadlift', 'דדליפט'), ('rack pull', 'משיכה מהמתקן'),
    ('good morning', 'גוד מורנינג'), ('hip thrust', 'היפ טראסט'), ('glute bridge', 'גשר ישבן'), ('glute ham raise', 'הרמת ירך אחורית (GHR)'),
    ('bench press', 'לחיצת חזה'), ('floor press', 'לחיצה מהרצפה'), ('chest press', 'לחיצת חזה'), ('shoulder press', 'לחיצת כתפיים'),
    ('military press', 'לחיצה צבאית'), ('overhead press', 'לחיצה מעל הראש'), ('arnold press', 'לחיצת ארנולד'), ('push press', 'פוש פרס'),
    ('leg press', 'לחיצת רגליים'), ('close-grip bench press', 'לחיצת חזה באחיזה צרה'), ('jm press', 'לחיצת JM'),
    ('push-up', 'שכיבת סמיכה'), ('push-ups', 'שכיבות סמיכה'), ('pushups', 'שכיבות סמיכה'), ('push up', 'שכיבת סמיכה'),
    ('pull-up', 'מתח'), ('pullup', 'מתח'), ('pullups', 'מתח'), ('chin-up', 'מתח באחיזה הפוכה'), ('chin up', 'מתח באחיזה הפוכה'),
    ('lat pulldown', 'פולי עליון'), ('pulldown', 'פולי עליון'), ('pulldowns', 'פולי עליון'), ('seated cable rows', 'חתירה בכבל בישיבה'),
    ('bent over row', 'חתירה בהטיה'), ('bent over barbell row', 'חתירה בהטיה עם מוט'), ('upright row', 'חתירה אנכית'), ('t-bar row', 'חתירת T'),
    ('inverted row', 'חתירה הפוכה'), ('row', 'חתירה'), ('rows', 'חתירה'), ('face pull', 'משיכת פנים'), ('pullover', 'פולאובר'),
    ('front squat', 'סקוואט קדמי'), ('goblet squat', 'סקוואט גביע'), ('hack squat', 'האק סקוואט'), ('split squat', 'סקוואט מפוצל'),
    ('pistol squat', 'סקוואט על רגל אחת'), ('box squat', 'סקוואט לארגז'), ('zercher squat', 'סקוואט זרכר'), ('squat', 'סקוואט'), ('squats', 'סקוואט'),
    ('walking lunge', 'מכרע בהליכה'), ('lunge', 'מכרע'), ('lunges', 'מכרעים'), ('step-up', 'עלייה על ספסל'), ('step up', 'עלייה על ספסל'),
    ('leg extension', 'פשיטת ברכיים'), ('leg extensions', 'פשיטת ברכיים'), ('leg curl', 'כפיפת ברכיים'), ('leg curls', 'כפיפת ברכיים'),
    ('calf raise', 'הרמות עקב'), ('calf raises', 'הרמות עקב'), ('calf press', 'לחיצת שוקיים'),
    ('hammer curl', 'כפיפת פטיש'), ('hammer curls', 'כפיפת פטיש'), ('preacher curl', 'כפיפת מרפקים בכיסא סקוט'), ('concentration curl', 'כפיפת ריכוז'),
    ('zottman curl', 'כפיפת זוטמן'), ('drag curl', 'כפיפת גרירה'), ('spider curl', 'כפיפת עכביש'), ('wrist curl', 'כפיפת שורש כף יד'),
    ('curl', 'כפיפת מרפקים'), ('curls', 'כפיפת מרפקים'),
    ('skull crusher', 'סקאל קראשר'), ('skullcrusher', 'סקאל קראשר'), ('triceps extension', 'פשיטת מרפקים'), ('tricep extension', 'פשיטת מרפקים'),
    ('triceps pushdown', 'פשיטת מרפקים בפולי'), ('pushdown', 'פשיטת מרפקים בפולי'), ('kickback', 'קיקבק'), ('dips', 'מקבילים'), ('dip', 'מקבילים'),
    ('lateral raise', 'הרחקת כתפיים'), ('lateral raises', 'הרחקת כתפיים'), ('side lateral raise', 'הרחקת כתפיים'), ('front raise', 'הרמה קדמית'),
    ('rear delt raise', 'הרחקה לכתף אחורית'), ('rear delt fly', 'פרפר הפוך'), ('reverse flyes', 'פרפר הפוך'), ('reverse fly', 'פרפר הפוך'),
    ('flyes', 'פרפר'), ('flye', 'פרפר'), ('fly', 'פרפר'), ('crossover', 'קרוס אובר'), ('shrug', 'משיכת כתפיים'), ('shrugs', 'משיכת כתפיים'),
    ('crunch', 'כפיפת בטן'), ('crunches', 'כפיפות בטן'), ('sit-up', 'בטן עליונה (סיט־אפ)'), ('sit up', 'סיט־אפ'), ('plank', 'פלאנק'),
    ('leg raise', 'הרמות רגליים'), ('knee raise', 'הרמות ברכיים'), ('russian twist', 'פיתול רוסי'), ('ab rollout', 'גלגלת בטן'), ('rollout', 'גלגלת בטן'),
    ('wood chop', 'חיתוך עצים'), ('pallof press', 'פאלוף פרס'), ('dead bug', 'דד באג'), ('mountain climbers', 'מטפסי הרים'), ('hyperextension', 'פשיטת גב'),
    ('hyperextensions', 'פשיטת גב'), ('superman', 'סופרמן'), ('bird dog', 'בירד דוג'),
    ('clean and jerk', 'הנפה וזריקה'), ('power clean', 'הנפה כוחנית'), ('hang clean', 'הנפה מתלייה'), ('clean', 'הנפה'), ('snatch', 'חטיפה'), ('jerk', 'זריקה'),
    ('thruster', 'ת׳ראסטר'), ('swing', 'סווינג'), ('swings', 'סווינג'), ('turkish get-up', 'קימה טורקית'), ('windmill', 'טחנת רוח'),
    ('farmer\'s walk', 'הליכת חקלאי'), ('box jump', 'קפיצה לארגז'), ('jump squat', 'סקוואט קפיצה'), ('burpee', 'ברפי'), ('jump', 'קפיצה'),
    ('sled push', 'דחיפת מזחלת'), ('sled drag', 'גרירת מזחלת'), ('battling ropes', 'חבלי כוח'), ('jogging', 'ריצה קלה'), ('running', 'ריצה'),
    ('sprint', 'ספרינט'), ('sprints', 'ספרינטים'), ('treadmill', 'הליכון'), ('elliptical', 'אליפטי'), ('stairmaster', 'מדרגות'),
    ('rowing', 'חתירה במכשיר'), ('bicycling', 'אופניים'), ('stationary bike', 'אופני כושר'), ('rope jumping', 'קפיצה בחבל'), ('walking', 'הליכה'),
    ('stretch', 'מתיחה'), ('smr', 'שחרור בגליל'), ('foam roll', 'גליל עיסוי'), ('bridge', 'גשר'),
]
MOVES.sort(key=lambda x: -len(x[0]))

MODS = [  # (english, hebrew) in the order they appear after the movement
    ('incline', 'בשיפוע עליון'), ('decline', 'בשיפוע שלילי'), ('flat', 'בספסל ישר'), ('reverse', 'הפוך'), ('single-leg', 'על רגל אחת'), ('one-legged', 'על רגל אחת'),
    ('single-arm', 'ביד אחת'), ('one arm', 'ביד אחת'), ('one-arm', 'ביד אחת'), ('alternating', 'לסירוגין'), ('alternate', 'לסירוגין'),
    ('standing', 'בעמידה'), ('seated', 'בישיבה'), ('lying', 'בשכיבה'), ('kneeling', 'בכריעה'), ('bent over', 'בהטיה'), ('bent-over', 'בהטיה'), ('hanging', 'בתלייה'),
    ('overhead', 'מעל הראש'), ('behind the neck', 'מאחורי העורף'), ('side', 'צידי'), ('rear', 'אחורי'), ('front', 'קדמי'), ('weighted', 'עם תוספת משקל'),
    ('close-grip', 'באחיזה צרה'), ('close grip', 'באחיזה צרה'), ('wide-grip', 'באחיזה רחבה'), ('wide grip', 'באחיזה רחבה'), ('neutral grip', 'באחיזה ניטרלית'),
    ('smith machine', 'במכונת סמית׳'), ('barbell', 'עם מוט'), ('dumbbell', 'עם משקולות'), ('cable', 'בכבל'), ('kettlebell', 'עם קטלבל'), ('band', 'עם גומייה'),
    ('bands', 'עם גומיות'), ('machine', 'במכונה'), ('lever', 'במכונה'), ('leverage', 'במכונה'), ('ez-bar', 'עם מוט EZ'), ('ez bar', 'עם מוט EZ'), ('e-z bar', 'עם מוט EZ'),
    ('medicine ball', 'עם כדור כוח'), ('exercise ball', 'על כדור פיזיו'), ('stability ball', 'על כדור פיזיו'), ('bodyweight', 'במשקל גוף'), ('box', 'על ארגז'),
    ('rope', 'עם חבל'), ('trx', 'ברצועות'), ('suspended', 'ברצועות'),
]
MODS.sort(key=lambda x: -len(x[0]))


def he_name(name: str) -> tuple[str, bool]:
    n = name.lower().replace('–', '-')
    move = next(((en, he) for en, he in MOVES if re.search(r'(^|[^a-z])' + re.escape(en) + r'($|[^a-z])', n)), None)
    if not move:
        return name, False
    rest = n.replace(move[0], ' ')
    mods = []
    for en, he in MODS:
        if re.search(r'(^|[^a-z])' + re.escape(en) + r'($|[^a-z])', rest):
            if he not in mods and not (he == 'עם מוט' and 'עם מוט EZ' in mods):
                mods.append(he)
            rest = re.sub(r'(^|[^a-z])' + re.escape(en) + r'($|[^a-z])', ' ', rest)
    leftover = [w for w in re.findall(r"[a-z']+", rest) if w not in {'with', 'the', 'on', 'to', 'a', 'and', 'of', 'from', 'in', 'up', 'down', 'exercise', 'version', 'your'}]
    full = not leftover
    return ' '.join([move[1], *mods]), full


def main(src: str, dst: str) -> None:
    data = json.load(open(src))
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    manual = {}
    for part in ('exercise-names-he-1.json', 'exercise-names-he-2.json'):
        manual.update(json.load(open(os.path.join(here, part))))
    out = []
    covered = 0
    for x in data:
        he, full = (manual[x['name']], True) if x['name'] in manual else he_name(x['name'])
        covered += full
        out.append([
            x['id'], he if he != x['name'] else '', x['name'], int(full),
            x['primaryMuscles'], x['secondaryMuscles'], x.get('equipment'), x.get('level'), x.get('category'), x.get('mechanic'), x.get('force'),
            x['instructions'], x['images'],
        ])
    json.dump({'license': 'free-exercise-db, public domain (Unlicense)', 'muscles': MUSCLE_HE, 'equipment': {k or 'none': v for k, v in EQUIP_HE.items()}, 'categories': CAT_HE, 'levels': LEVEL_HE, 'exercises': out}, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'{len(out)} exercises, {covered} fully translated names, {sum(1 for o in out if o[1])} with a Hebrew movement name')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
