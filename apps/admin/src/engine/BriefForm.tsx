import type { EditorialCategory } from "../categories";
import { type RoundBrief } from "./brief";
export function BriefForm({
  brief,
  update,
  categories,
  disabled,
  passageCount,
}: {
  brief: RoundBrief;
  update: (brief: RoundBrief) => void;
  categories: EditorialCategory[];
  disabled: boolean;
  passageCount: number;
}) {
  return (
    <fieldset className="engine-brief" disabled={disabled}>
      <legend className="sr-only">Round brief</legend>
      <div className="two-columns">
        <label>
          Round mode
          <select
            value={brief.kind}
            onChange={(e) =>
              update({
                ...brief,
                kind: e.target.value as RoundBrief["kind"],
                difficulty:
                  e.target.value === "progressive"
                    ? "rising"
                    : brief.difficulty,
                categoryIds:
                  e.target.value === "category"
                    ? brief.categoryIds.slice(0, 1)
                    : brief.categoryIds,
              })
            }
          >
            <option value="category">Category round</option>
            <option value="progressive">Progressive round</option>
            <option value="timed">Timed round</option>
          </select>
        </label>
        <label>
          Difficulty
          <select
            disabled={brief.kind === "progressive"}
            value={brief.difficulty}
            onChange={(e) =>
              update({
                ...brief,
                difficulty: e.target.value as RoundBrief["difficulty"],
              })
            }
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="rising">Rising difficulty</option>
          </select>
        </label>
      </div>
      <div className="two-columns">
        <label>
          Questions
          <input
            type="number"
            min={3}
            max={10}
            step={1}
            value={brief.count}
            onChange={(e) =>
              update({ ...brief, count: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Bible clue source
          <select
            value={brief.sourceMode}
            onChange={(e) =>
              update({
                ...brief,
                sourceMode: e.target.value as RoundBrief["sourceMode"],
              })
            }
          >
            <option value="references">
              Original clue + scripture reference
            </option>
            <option value="licensed_niv" disabled={!passageCount}>
              Verified NIV passage library ({passageCount})
            </option>
          </select>
        </label>
      </div>
      <p className="field-help engine-source-note">
        {brief.sourceMode === "licensed_niv"
          ? "Exact NIV wording can only come from the verified passages you supplied and have permission to use."
          : "Clues use original wording and a Bible reference. They are labeled as paraphrases, never presented as an NIV quotation."}
      </p>
      <div className="engine-field">
        <span className="field-title">Categories</span>
        <div className="category-choices">
          {categories.map((category) => (
            <label
              className={`category-choice ${brief.categoryIds.includes(category.id) ? "chosen" : ""}`}
              key={category.id}
            >
              <input
                type="checkbox"
                checked={brief.categoryIds.includes(category.id)}
                onChange={() =>
                  update({
                    ...brief,
                    categoryIds:
                      brief.kind === "category"
                        ? [category.id]
                        : brief.categoryIds.includes(category.id)
                          ? brief.categoryIds.filter((id) => id !== category.id)
                          : [...brief.categoryIds, category.id],
                  })
                }
              />
              {category.name}
            </label>
          ))}
        </div>
      </div>
      <label>
        Round notes{" "}
        <span className="field-help">
          Optional — audience, themes, or things to avoid
        </span>
        <textarea
          rows={3}
          value={brief.notes}
          maxLength={1600}
          onChange={(e) => update({ ...brief, notes: e.target.value })}
          placeholder="Make it curious, fair, and fun. A helpful clue should reward the connection."
        />
      </label>
    </fieldset>
  );
}
