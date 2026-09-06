import { scriptureReference } from './scripture-reference.ts';
// Only the five public sample readings are available without an account.
const guestReferences = ["Leviticus 2:5 · NIV", "Job 37:3–4 · NIV", "Luke 3:17 · NIV", "Joshua 9:4–6 · NIV", "Judges 9:8–15 · NIV"];
const allowed = new Set(guestReferences.map(scriptureReference));
export function isGuestPassage(usfm: string): boolean { return allowed.has(usfm); }
