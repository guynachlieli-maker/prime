"""Replaces the English instructions in public/exercises.json with the concise Hebrew ones.

Run after build-exercises.py:  python3 scripts/apply-exercise-steps-he.py public/exercises.json
The Hebrew texts live in scripts/exercise-steps-he-*.json ({exercise id: [step, step, step]}).
Exercises without a Hebrew entry keep their original text (the app marks those as English).
"""
import glob, json, os, sys

NAME_FIXES = {'Wind_Sprints': 'הרמות ברכיים לסירוגין בתלייה'}


def main(path):
    here = os.path.dirname(os.path.abspath(__file__))
    he = {}
    for f in sorted(glob.glob(os.path.join(here, 'exercise-steps-he-*.json'))):
        he.update(json.load(open(f, encoding='utf8')))
    d = json.load(open(path, encoding='utf8'))
    done = 0
    for e in d['exercises']:
        e[:] = e[:13]
        if e[0] in NAME_FIXES:
            e[1] = NAME_FIXES[e[0]]
        if e[0] in he:
            e[11] = he[e[0]]
            e.append(1)  # the instructions are in Hebrew
            done += 1
    json.dump(d, open(path, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{done} of {len(d["exercises"])} exercises now have Hebrew instructions')


if __name__ == '__main__':
    main(sys.argv[1])
