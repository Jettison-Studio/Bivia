import { ScripturePreview } from "../ScripturePreview";
import { useState } from "react";
import type {
  Candidate,
  CandidateReviews,
} from "../../../../supabase/functions/_shared/trivia-types";
import type { Decision } from "./api";
import { readable, rejectionReasons, sourceLink } from "./brief";
function Evidence({ urls }: { urls: string[] }) {
  return urls.length ? (
    <ul className="evidence-links">
      {[...new Set(urls)].map((url) => {
        const href = sourceLink(url);
        return href ? (
          <li key={url}>
            <a href={href} target="_blank" rel="noreferrer">
              {new URL(href).hostname}
              <span className="sr-only"> {href}</span> ↗
            </a>
          </li>
        ) : null;
      })}
    </ul>
  ) : null;
}
export function CandidateReview({
  candidate,
  reviews,
  decision,
  selected,
  exactQuotation,
  gateReasons,
  busy,
  repairsRemaining,
  decide,
  retry,
}: {
  candidate: Candidate;
  reviews: CandidateReviews;
  decision?: Decision;
  selected: boolean;
  exactQuotation: boolean;
  gateReasons: string[];
  busy: boolean;
  repairsRemaining: number;
  decide: (
    candidate: Candidate,
    decision: "approved" | "rejected",
    reason: string,
  ) => Promise<void>;
  retry: (candidate: Candidate, reason: string) => Promise<void>;
}) {
  const [reason, setReason] =
    useState<(typeof rejectionReasons)[number]>("good");
  const [notes, setNotes] = useState("");
  const [confirmApproval, setConfirmApproval] = useState(false);
  const reviewRows = [
    reviews.accuracy && { label: "Fact check", ...reviews.accuracy },
    reviews.theology && { label: "Bible context", ...reviews.theology },
    reviews.clues && { label: "Clue quality", ...reviews.clues },
  ].filter(Boolean) as Array<{
    label: string;
    verdict: string;
    score: number;
    reasons: string[];
    evidenceUrls?: string[];
  }>;
  const combinedReason = `${reason}${notes.trim() ? `: ${notes.trim()}` : ""}`;
  const playtest = reviews.playtest;
  const disagreement =
    (reviews.accuracy &&
      reviews.accuracy.verifiedCorrectIndex !== candidate.correctIndex) ||
    (playtest && playtest.answerIndex !== candidate.correctIndex);
  return (
    <details className="candidate-card">
      <summary>
        <span>
          <span className="candidate-state">
            {selected ? "Selected by quality gates" : "Not selected"} · Revision{" "}
            {candidate.revision}
          </span>
          <strong>{candidate.prompt}</strong>
        </span>
        <span
          className={`status ${decision?.decision === "approved" ? "published" : decision?.decision === "rejected" ? "rejected" : "draft"}`}
        >
          {decision ? decision.decision : "Needs human review"}
        </span>
      </summary>
      <div className="candidate-body">
        <div className="candidate-metrics">
          <span>
            Reviewed fact difficulty{" "}
            <b>
              {reviews.accuracy?.estimatedFactDifficulty ?? "Pending"}
              {reviews.accuracy ? "/5" : ""}
            </b>
          </span>
          <span>
            Reviewed clue difficulty{" "}
            <b>
              {reviews.clues?.estimatedDifficulty ?? "Pending"}
              {reviews.clues ? "/5" : ""}
            </b>
          </span>
          <span>
            Writer estimates{" "}
            <b>
              {candidate.factDifficulty}/5 fact · {candidate.clueDifficulty}/5
              clue
            </b>
          </span>
          <span>
            Target <b>{candidate.estimatedSeconds}s</b>
          </span>
          <span>{candidate.subtopic}</span>
        </div>
        <ol className="candidate-answers" type="A">
          {candidate.answers.map((answer, index) => (
            <li
              key={index}
              className={index === candidate.correctIndex ? "answer-key" : ""}
            >
              {answer}
              {index === candidate.correctIndex && <span>Answer key</span>}
            </li>
          ))}
        </ol>
        <div className="candidate-hint">
          <span className="hint-label">
            {exactQuotation
              ? "Verified NIV quotation"
              : "Original clue · paraphrase"}
          </span>
          <p>{candidate.hint}</p>
          <cite>{candidate.reference}</cite>
          <ScripturePreview key={candidate.reference} reference={candidate.reference} />
        </div>
        <h3>The connection</h3>
        <p>{candidate.connectionExplanation}</p>
        <h3>Sources found by the research tools</h3>
        {candidate.sources.length ? (
          <ul className="candidate-sources">
            {candidate.sources.map((source, index) => {
              const href = sourceLink(source.url);
              return (
                <li key={`${source.url}-${index}`}>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer">
                      {source.title || new URL(href).hostname} ↗
                    </a>
                  ) : (
                    <span>Invalid source URL</span>
                  )}
                  <small>{readable(source.kind)}</small>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="review-warning">
            No research sources were recorded for this candidate.
          </p>
        )}
        {gateReasons.length > 0 && (
          <div className="error-box">
            <strong>Quality gate findings</strong>
            <ul>
              {gateReasons.map((finding, index) => (
                <li key={index}>{finding}</li>
              ))}
            </ul>
          </div>
        )}
        {disagreement && (
          <div className="review-warning">
            Reviewer disagreement: the answer key differs from a fact reviewer
            or blind playtester. Inspect the findings before deciding.
          </div>
        )}
        <div className="review-grid">
          {reviewRows.map((review) => (
            <section className="review-block" key={review.label}>
              <div className="section-heading">
                <h3>{review.label}</h3>
                <span
                  className={`status ${review.verdict === "pass" ? "published" : "rejected"}`}
                >
                  {review.verdict} · {review.score}/100
                </span>
              </div>
              <ul>
                {review.reasons.map((finding, index) => (
                  <li key={index}>{finding}</li>
                ))}
              </ul>
              {review.evidenceUrls && <Evidence urls={review.evidenceUrls} />}
            </section>
          ))}
        </div>
        {!reviewRows.length && (
          <p className="muted">
            Reviewer findings will appear after the review stages finish.
          </p>
        )}
        <section className="review-block playtest-block">
          <h3>Blind playtest</h3>
          {playtest ? (
            <>
              <div className="candidate-metrics">
                <span>
                  Picked{" "}
                  <b>
                    {candidate.answers[playtest.answerIndex] ??
                      "No valid answer"}
                  </b>
                </span>
                <span>
                  Confidence <b>{playtest.confidence}%</b>
                </span>
                <span>
                  Time <b>{playtest.estimatedSeconds}s</b>
                </span>
                <span>
                  {playtest.ambiguous
                    ? "Marked ambiguous"
                    : "Not marked ambiguous"}
                </span>
              </div>
              <p>{playtest.reasoning}</p>
            </>
          ) : (
            <p className="muted">
              The blind playtester has not reviewed this question yet.
            </p>
          )}
        </section>
        {decision && (
          <p className="editorial-decision">
            <strong>Your decision:</strong> {decision.decision} ·{" "}
            {decision.reason}{" "}
            <span>{new Date(decision.decidedAt).toLocaleString()}</span>
          </p>
        )}
        <fieldset className="editorial-review" disabled={busy}>
          <legend>Your editorial decision</legend>
          <div className="two-columns">
            <label>
              Review reason
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as typeof reason)}
              >
                {rejectionReasons.map((value) => (
                  <option key={value} value={value}>
                    {readable(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notes
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1500}
                placeholder="What works, or what needs to change?"
              />
            </label>
          </div>
          <label className="engine-checkbox">
            <input
              type="checkbox"
              checked={confirmApproval}
              onChange={(e) => setConfirmApproval(e.target.checked)}
            />
            I reviewed the answer, sources, full NIV passage, Bible context, and clue fairness for
            this revision.
          </label>
          <div className="button-row">
            <button
              className="primary"
              disabled={!confirmApproval || !selected}
              onClick={() => decide(candidate, "approved", combinedReason)}
            >
              Approve this revision
            </button>
            <button
              className="secondary"
              disabled={reason === "good"}
              onClick={() => decide(candidate, "rejected", combinedReason)}
            >
              Reject this revision
            </button>
            <button
              className="text-button"
              disabled={repairsRemaining === 0}
              onClick={() => retry(candidate, combinedReason)}
            >
              Request a revision
            </button>
          </div>
          {repairsRemaining === 0 && <p className="field-help">This run has reached its revision limit. Its quality gates remain unchanged.</p>}
          {!selected && (
            <p className="field-help">
              This candidate must pass the quality gates before it can be
              approved for export.
            </p>
          )}
        </fieldset>
      </div>
    </details>
  );
}
