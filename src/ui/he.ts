import type { Sex } from '../engine/types';

/** Hebrew addresses people by gender: picks the masculine or feminine wording. */
export const gx = (sex: Sex | undefined, m: string, f: string) => (sex === 'female' ? f : m);
