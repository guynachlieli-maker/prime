import { useState } from 'react';
import { Banner, Button, Card, Sheet, WhyContent } from '../ui/kit';
import { saveProfile, setState, useStore } from '../state/store';
import { useSafety } from '../state/derived';
import { PROGRAMS, type Program } from '../data/programs';
import { ARTICLES, type Article } from '../data/articles';
import type { Profile } from '../engine/types';
import type { SafetyResult } from '../engine/safety';

function fit(pr: Program, p: Profile, safety: SafetyResult | null): { ok: boolean; reason: string; score: number } {
  if (safety?.flags.includes('no_deficit') && (pr.goal === 'fat_loss' || pr.goal === 'recomp'))
    return { ok: false, reason: 'נעולה: לפי שאלון ההתאמה, גירעון קלורי לא מתאים לך כרגע.', score: -1 };
  if (pr.requires.strength && !p.strengthTraining) return { ok: false, reason: 'נעולה: התוכנית בנויה סביב אימוני כוח, ולפי הפרופיל אתה לא עושה אותם.', score: 0 };
  if (p.trainingDaysPerWeek < pr.requires.minTrainingDays) return { ok: false, reason: `נעולה: צריך לפחות ${pr.requires.minTrainingDays} אימונים בשבוע.`, score: 0 };
  let score = pr.goal === p.goal ? 3 : 1;
  if (pr.id === 'vegan_athlete' && p.diet !== 'omnivore') score += 3;
  if (pr.id === 'metabolic_40') score += p.age >= 40 ? 1 : -2;
  if (pr.id === 'endurance' && p.goal === 'performance' && !p.strengthTraining) score += 1;
  const reason = pr.goal === p.goal ? 'מתאימה למטרה שבחרת.' : 'מתאימה לפרופיל שלך, גם אם המטרה שונה.';
  return { ok: true, reason, score };
}

export function Programs() {
  const s = useStore((x) => x);
  const safety = useSafety();
  const [article, setArticle] = useState<Article | null>(null);
  const [prog, setProg] = useState<Program | null>(null);
  if (!s.profile) return null;
  const p = s.profile;
  const ranked = PROGRAMS.map((pr) => ({ pr, f: fit(pr, p, safety) })).sort((a, b) => b.f.score - a.f.score);
  const active = PROGRAMS.find((x) => x.id === s.activeProgramId);
  const recommended = ranked.filter((x) => x.f.ok).slice(0, 3);

  return (
    <div className="screen">
      <h1>תכניות</h1>
      {active ? (
        <Card title="התוכנית הפעילה" className="active-prog">
          <strong>{active.name}</strong>
          <p className="muted">{active.expect}</p>
          <Button kind="ghost" onClick={() => setState({ activeProgramId: undefined })}>
            עצירת התוכנית
          </Button>
        </Card>
      ) : (
        <Banner>בחר תוכנית כדי שהתפריט והיעדים יתאימו לה.</Banner>
      )}

      <h2 className="section">מומלצות בשבילך</h2>
      {recommended.map(({ pr, f }, i) => (
        <ProgramCard key={pr.id} pr={pr} reason={f.reason} big={i === 0} onOpen={() => setProg(pr)} />
      ))}

      <h2 className="section">כל התכניות</h2>
      {ranked
        .filter((x) => !recommended.some((r) => r.pr.id === x.pr.id))
        .map(({ pr, f }) => (
          <ProgramCard key={pr.id} pr={pr} reason={f.reason} locked={!f.ok} onOpen={() => setProg(pr)} />
        ))}

      <h2 className="section">ספריית ידע</h2>
      <div className="articles">
        {ARTICLES.filter((a) => a.level === 'strong').map((a) => (
          <button key={a.id} className="article" onClick={() => setArticle(a)}>
            <strong>{a.title}</strong>
            <span className="muted">
              {a.minutes} דק׳ קריאה · <span className="evidence strong">ראיות חזקות</span>
            </span>
          </button>
        ))}
      </div>

      <Sheet open={!!article} onClose={() => setArticle(null)} title={article?.title ?? ''}>
        {article && (
          <>
            {article.body.map((b) => (
              <p key={b}>{b}</p>
            ))}
            <WhyContent why="" sources={article.sources} />
          </>
        )}
      </Sheet>

      <Sheet open={!!prog} onClose={() => setProg(null)} title={prog?.name ?? ''}>
        {prog && (
          <>
            <p>
              <strong>למי:</strong> {prog.forWho} · <strong>משך:</strong> {prog.weeks ? `${prog.weeks} שבועות` : 'פתוח'}
            </p>
            <h3 className="sub">מה כוללת</h3>
            <ul>
              {prog.includes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h3 className="sub">מה צפוי</h3>
            <p>{prog.expect}</p>
            <WhyContent why="" sources={prog.sources} />
            {fit(prog, p, safety).ok ? (
              <Button
                full
                onClick={() => {
                  setState({ activeProgramId: prog.id });
                  const goal = prog.goal === 'health' ? p.goal : prog.goal;
                  if (goal !== p.goal) saveProfile({ ...p, goal });
                  setProg(null);
                }}
              >
                להתחיל את התוכנית
              </Button>
            ) : (
              <Banner kind="warn">{fit(prog, p, safety).reason}</Banner>
            )}
          </>
        )}
      </Sheet>
    </div>
  );
}

function ProgramCard({ pr, reason, big, locked, onOpen }: { pr: Program; reason: string; big?: boolean; locked?: boolean; onOpen: () => void }) {
  return (
    <button className={`prog ${big ? 'big' : ''} ${locked ? 'locked' : ''}`} onClick={onOpen}>
      <div className="prog-top">
        <strong>{pr.name}</strong>
        <span className="muted">{pr.weeks ? `${pr.weeks} שבועות` : 'פתוח'}</span>
      </div>
      <span className="muted">{pr.forWho}</span>
      <span className={locked ? 'lock' : 'fit'}>{reason}</span>
    </button>
  );
}
