import type { Brief } from "../../../../supabase/functions/_shared/trivia-types";
export type RoundBrief = Brief;
export const initialBrief: RoundBrief = {
  kind: "category",
  categoryIds: [],
  count: 5,
  difficulty: "medium",
  translation: "NIV",
  notes: "",
  sourceMode: "references",
};
export function validateBrief(
  brief: RoundBrief,
  availableCategoryIds: string[],
  licensedPassages: number,
): string[] {
  const errors: string[] = [];
  if (!["category", "progressive", "timed"].includes(brief.kind))
    errors.push("Choose a round mode.");
  if (!Number.isInteger(brief.count) || brief.count < 3 || brief.count > 10)
    errors.push("Choose 3–10 questions.");
  if (!["easy", "medium", "hard", "rising"].includes(brief.difficulty))
    errors.push("Choose a difficulty.");
  if (!brief.categoryIds.length) errors.push("Choose at least one category.");
  if (brief.categoryIds.some((id) => !availableCategoryIds.includes(id)))
    errors.push("One selected category is no longer available.");
  if (new Set(brief.categoryIds).size !== brief.categoryIds.length)
    errors.push("Select each category only once.");
  if (brief.sourceMode === "licensed_niv" && licensedPassages === 0)
    errors.push(
      "Add a verified, rights-attested NIV passage before using exact NIV text.",
    );
  if (brief.categoryIds.length > brief.count)
    errors.push("Allow at least one question for each selected category.");
  if (brief.kind === "category" && brief.categoryIds.length !== 1)
    errors.push("A category round needs exactly one category.");
  if (brief.kind === "progressive" && brief.difficulty !== "rising")
    errors.push("A progressive round requires rising difficulty.");
  if (brief.notes.length > 1600)
    errors.push("Keep the round notes under 1,600 characters.");
  return errors;
}
export const stageLabels: Record<string, string> = {
  plan: "Round plan",
  write: "Question writing",
  accuracy: "Fact check",
  theology: "Bible context",
  clues: "Clue review",
  playtest: "Blind playtest",
  assemble: "Round assembly",
};
export const rejectionReasons = [
  "too_obvious",
  "cheesy",
  "forced",
  "unfair",
  "factual",
  "theology",
  "good",
] as const;
export function readable(value: string): string {
  return value.replaceAll("_", " ");
}
export function sourceLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}
