/**
 * Access to the Claude app runtime ("sample" capability) when PRIME runs as a published
 * claude.ai page. Lets the page ask Claude (including with photos) on the viewer's own account,
 * after the viewer approves. Elsewhere it resolves null and the app falls back.
 */
export interface SampleFn {
  (input: string, opts?: Record<string, unknown>): Promise<{ text: string; truncated: boolean }>;
  json<T = unknown>(input: string, opts?: Record<string, unknown>): Promise<T>;
  limits(): Promise<{ maxPromptBytes: number; images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }>;
}

interface ClaudeWindow {
  claude?: { use(name: string): Promise<unknown> };
}

let samplePromise: Promise<SampleFn | null> | null = null;

export function getSample(): Promise<SampleFn | null> {
  if (samplePromise) return samplePromise;
  const w = window as unknown as ClaudeWindow;
  if (!w.claude?.use) return (samplePromise = Promise.resolve(null));
  samplePromise = w.claude
    .use('sample')
    .then((s) => (s ? (s as SampleFn) : null))
    .catch(() => null);
  return samplePromise;
}

export async function canSendImages(): Promise<boolean> {
  const s = await getSample();
  if (!s) return false;
  try {
    return Boolean((await s.limits()).images);
  } catch {
    return false;
  }
}

export interface SampleError {
  code: string;
  message: string;
  text?: string;
}

export function isSampleError(e: unknown): e is SampleError {
  return typeof e === 'object' && e !== null && 'code' in e && typeof (e as SampleError).code === 'string';
}

export function describeSampleError(e: SampleError): string {
  switch (e.code) {
    case 'not_granted':
      return 'לא אישרת לאפליקציה להשתמש ב-Claude. אפשר לאשר בתפריט ההרשאות של העמוד, או לרשום ידנית.';
    case 'rate_limited':
      return 'יותר מדי בקשות כרגע. נסו שוב בעוד כמה דקות.';
    case 'image_rejected':
      return 'התמונה לא התקבלה. נסו צילום אחר (JPG או PNG).';
    case 'refused':
      return 'לא הצלחנו לזהות את התמונה הזו. נסו צילום אחר או רישום ידני.';
    case 'invalid_json':
    case 'empty_completion':
      return 'הזיהוי לא הצליח הפעם. נסו שוב או רשמו ידנית.';
    case 'session_expired':
      return 'צריך להתחבר מחדש ל-Claude.';
    case 'images_unavailable':
    case 'sampling_disabled':
    case 'capability_disabled':
      return 'זיהוי תמונה לא זמין בחשבון הזה. אפשר לחבר מפתח API בהגדרות, או לרשום ידנית.';
    default:
      return 'תקלה זמנית בזיהוי. נסו שוב.';
  }
}
