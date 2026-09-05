import { useEffect, useRef, useState } from "react";
import type { Candidate } from "../../../../supabase/functions/_shared/trivia-types";
import type { EditorialCategory } from "../categories";
import { BriefForm } from "./BriefForm";
import { CandidateReview } from "./CandidateReview";
import { PassageLibrary } from "./PassageLibrary";
import {
  engineRpc,
  EngineRequestError,
  runStage,
  type EngineRun,
  type Passage,
  type RunSummary,
} from "./api";
import {
  initialBrief,
  readable,
  stageLabels,
  validateBrief,
  type RoundBrief,
} from "./brief";
import { exportBlockers } from "./gates";
import { RunDetails } from "./RunDetails";
import { driveStages } from "./polling";
const selectedRunKey = "bivia.engine.selected-run";
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The engine request could not be completed.";
}
export function EngineWorkspace({
  categories,
  connected,
  connect,
  openDraft,
}: {
  categories: EditorialCategory[];
  connected: boolean;
  connect: () => void;
  openDraft: (quizId: string) => Promise<void>;
}) {
  const [brief, setBrief] = useState<RoundBrief>({
    ...initialBrief,
    categoryIds: categories.slice(0, 1).map((c) => c.id),
  });
  const [title, setTitle] = useState("");
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [run, setRun] = useState<EngineRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [library, setLibrary] = useState(false);
  const [automatic, setAutomatic] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [resolutionReason, setResolutionReason] = useState("");
  const [acknowledgeCost, setAcknowledgeCost] = useState(false);
  const active = useRef(true);
  const pollControl = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const pending = useRef<{
    requestId: string;
    brief: RoundBrief;
    title: string;
  } | null>(null);
  function selectRun(value: EngineRun) {
    if (!active.current) return;
    setRun(value);
    try {
      localStorage.setItem(selectedRunKey, value.id);
    } catch {
      /* Server history remains the source of truth. */
    }
  }
  async function refreshHistory() {
    const rows = await engineRpc<RunSummary[]>("list");
    if (active.current) setHistory(rows);
  }
  async function refreshPassages() {
    const rows = await engineRpc<Passage[]>("passages_list");
    if (active.current) setPassages(rows);
  }
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      pollControl.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!connected) return;
    let current = true;
    setLoading(true);
    Promise.all([
      engineRpc<RunSummary[]>("list"),
      engineRpc<Passage[]>("passages_list"),
    ])
      .then(async ([rows, sources]) => {
        if (!current) return;
        setHistory(rows);
        setPassages(sources);
        let previous: string | null = null;
        try {
          previous = localStorage.getItem(selectedRunKey);
        } catch {
          /* An unavailable browser store does not prevent history access. */
        }
        if (previous && rows.some((item) => item.id === previous)) {
          const saved = await engineRpc<EngineRun>("get", { id: previous });
          if (current) setRun(saved);
        }
      })
      .catch((error) => {
        if (current) setError(errorMessage(error));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [connected]);
  async function operation(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (error) {
      if (active.current) setError(errorMessage(error));
    } finally {
      inFlight.current = false;
      pollControl.current?.abort();
      if (active.current) {
        setBusy(false);
        setAutomatic(false);
        setChecking(false);
      }
    }
  }
  async function create() {
    const problems = validateBrief(
      brief,
      categories.map((c) => c.id),
      passages.filter((p) => p.verified && p.rightsAttested && p.aiUseAttested)
        .length,
    );
    if (!pending.current && problems.length) {
      setError(problems.join(" "));
      return;
    }
    await operation(async () => {
      if (!pending.current)
        pending.current = {
          requestId: crypto.randomUUID(),
          brief: structuredClone(brief),
          title,
        };
      setPendingCreate(true);
      const saved = await engineRpc<EngineRun>("create", pending.current);
      pending.current = null;
      setPendingCreate(false);
      selectRun(saved);
      await refreshHistory();
      setNotice(
        "Run created. Start the first stage when you are ready. Each stage is saved before the next begins.",
      );
    });
  }
  async function advance(all: boolean) {
    if (!run) return;
    const started = run;
    await operation(async () => {
      const controller = new AbortController();
      pollControl.current = controller;
      setAutomatic(all);
      setChecking(true);
      let latest = started;
      try {
        latest = await driveStages(started, {
          invoke: runStage,
          onRun: (value) => {
            latest = value;
            selectRun(value);
          },
          continueAll: all,
          signal: controller.signal,
        });
      } catch (error) {
        let refreshed = false;
        try {
          const saved = await engineRpc<EngineRun>("get", { id: latest.id });
          selectRun(saved);
          refreshed = true;
        } catch {
          /* Keep the original stage error; no automatic resubmission is made. */
        }
        if (
          error instanceof EngineRequestError &&
          error.status === 409 &&
          refreshed
        ) {
          if (active.current)
            setNotice(
              "This run changed in another request. The latest saved version has been loaded. Check its stage to continue; no new provider job was created by this refresh.",
            );
          return;
        }
        throw new Error(
          `${errorMessage(error)} Refresh the saved run before continuing. A provider job may still be running; no automatic retry was made.`,
        );
      }
      if (!active.current) return;
      await refreshHistory();
      if (controller.signal.aborted) {
        setNotice(
          "Checking paused. Any provider job already started continues on the server. Use Check current stage to resume the saved job; no next stage will start automatically.",
        );
      } else if (latest.status === "failed" || latest.status === "uncertain") {
        setNotice(
          "The stage needs your attention. Review the saved error before allowing another request.",
        );
      } else {
        setNotice(
          latest.state.nextStage
            ? "Stage complete. Your work is saved; the next stage has not started."
            : "Review finished. Inspect the findings and approve each selected question before creating a draft.",
        );
      }
    });
  }
  async function load(id: string) {
    await operation(async () => {
      selectRun(await engineRpc<EngineRun>("get", { id }));
      setResolutionReason("");
      setAcknowledgeCost(false);
    });
  }
  async function decide(
    candidate: Candidate,
    decision: "approved" | "rejected",
    reason: string,
  ) {
    if (!run) return;
    await operation(async () => {
      selectRun(
        await engineRpc<EngineRun>("decide", {
          id: run.id,
          candidateId: candidate.id,
          revision: candidate.revision,
          decision,
          reason,
        }),
      );
      setNotice(`Revision ${candidate.revision} ${decision}.`);
    });
  }
  async function retry(candidate: Candidate, reason: string) {
    if (
      !run ||
      !window.confirm(
        "Request a new candidate revision? Previous approval will not carry over. Continuing its stages may incur additional model cost.",
      )
    )
      return;
    await operation(async () => {
      selectRun(
        await engineRpc<EngineRun>("retry", {
          id: run.id,
          candidateIds: [candidate.id],
          reason,
        }),
      );
      await refreshHistory();
      setNotice(
        "Revision requested. Continue the saved run to write and review it.",
      );
    });
  }
  async function cancel() {
    if (
      !run ||
      !window.confirm(
        "Cancel future stages for this run? Saved history remains available. This cannot cancel provider work that already started.",
      )
    )
      return;
    await operation(async () => {
      selectRun(await engineRpc<EngineRun>("cancel", { id: run.id }));
      await refreshHistory();
      setNotice("Future stages cancelled. Saved history is preserved; already-started provider work is not cancelled.");
    });
  }
  async function exportDraft() {
    if (!run) return;
    const blockers = exportBlockers(run);
    if (blockers.length) {
      setError(blockers.join(" "));
      return;
    }
    await operation(async () => {
      const result = await engineRpc<{ quizId: string; reused: boolean }>(
        "export_draft",
        {
          id: run.id,
          title: run.title,
          candidateIds: run.state.assembly?.selectedIds,
        },
      );
      await openDraft(result.quizId);
    });
  }
  if (!connected)
    return (
      <>
        <div className="page-heading">
          <div>
            <h1>The trivia workshop.</h1>
            <p>Thoughtful questions. Clever clues. A human final say.</p>
          </div>
        </div>
        <section className="settings-panel">
          <h2>Connect your editorial workspace</h2>
          <p>
            The engine runs on your backend so credentials, research, reviews,
            and decisions stay together. Sign in with an administrator account
            to create and review rounds.
          </p>
          <button className="primary" onClick={connect}>
            Sign in to the content service
          </button>
        </section>
      </>
    );
  const blockers = run ? exportBlockers(run) : [];
  const canRun =
    run &&
    run.state.nextStage &&
    !["uncertain", "failed", "cancelled", "exported"].includes(run.status);
  const sourceCount = passages.filter(
    (p) => p.verified && p.rightsAttested && p.aiUseAttested,
  ).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>The trivia workshop.</h1>
          <p>Thoughtful questions. Clever clues. A human final say.</p>
        </div>
        <div className="button-row">
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setLibrary(!library)}
          >
            {library ? "Back to rounds" : "NIV passage library"}
          </button>
          <button
            className="primary"
            disabled={busy || pendingCreate}
            onClick={() => {
              setRun(null);
              setLibrary(false);
              setError("");
              setNotice("");
            }}
          >
            + New round
          </button>
        </div>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {loading && <p role="status">Loading saved runs…</p>}
      {library ? (
        <PassageLibrary
          passages={passages}
          refresh={refreshPassages}
          busy={busy}
        />
      ) : (
        <div className="engine-layout">
          <aside className="engine-history">
            <div className="section-heading">
              <h2>Recent runs</h2>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => operation(refreshHistory)}
              >
                Refresh
              </button>
            </div>
            {history.length ? (
              history.map((item) => (
                <button
                  className={`run-history-item ${run?.id === item.id ? "selected" : ""}`}
                  key={item.id}
                  disabled={busy}
                  onClick={() => load(item.id)}
                >
                  <strong>
                    {item.title || `${item.brief?.kind ?? "Trivia"} round`}
                  </strong>
                  <span
                    className={`status ${item.status === "exported" ? "published" : item.status === "failed" || item.status === "uncertain" ? "rejected" : "draft"}`}
                  >
                    {readable(item.status)}
                  </span>
                  <small>{new Date(item.createdAt).toLocaleString()}</small>
                </button>
              ))
            ) : (
              <p className="muted">Your saved runs will appear here.</p>
            )}
          </aside>
          <div className="engine-main">
            {!run ? (
              <section className="details-panel">
                <h2>Build a round brief</h2>
                <label>
                  Round title <span className="field-help">Optional</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    disabled={busy || pendingCreate}
                  />
                </label>
                <BriefForm
                  brief={brief}
                  update={setBrief}
                  categories={categories}
                  disabled={busy || pendingCreate}
                  passageCount={sourceCount}
                />
                <p className="engine-note">
                  Creating a brief does not generate content. You control when
                  each stage runs. Model, token usage, and estimated costs are
                  recorded with the run.
                </p>
                <button className="primary" disabled={busy} onClick={create}>
                  {busy
                    ? "Creating…"
                    : pendingCreate
                      ? "Retry creating the same run"
                      : "Create round brief"}
                </button>
                {pendingCreate && (
                  <p className="field-help">
                    The same request ID is reused so a lost response does not
                    create duplicate runs.
                  </p>
                )}
              </section>
            ) : (
              <>
                <section className="details-panel engine-run-heading">
                  <div className="section-heading">
                    <div>
                      <h2>{run.title || "Trivia round"}</h2>
                      <p>
                        {run.state.brief.count} questions ·{" "}
                        {readable(run.state.brief.kind)} ·{" "}
                        {readable(run.state.brief.difficulty)}
                      </p>
                    </div>
                    <span
                      className={`status ${run.status === "exported" ? "published" : "draft"}`}
                    >
                      {readable(run.status)}
                    </span>
                  </div>
                  <div className="stage-track">
                    {Object.entries(stageLabels).map(([key, label], index) => {
                      const next = run.state.nextStage;
                      const nextIndex = next
                        ? Object.keys(stageLabels).indexOf(next)
                        : Object.keys(stageLabels).length;
                      return (
                        <span
                          className={
                            next === key
                              ? "current"
                              : index < nextIndex
                                ? "complete"
                                : ""
                          }
                          key={key}
                        >
                          <b>{index < nextIndex ? "✓" : index + 1}</b>
                          {label}
                        </span>
                      );
                    })}
                  </div>
                  {run.lastError && (
                    <div className="error-box">{run.lastError}</div>
                  )}
                  <div className="button-row engine-actions">
                    {canRun && (
                      <>
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => advance(false)}
                        >
                          {busy
                            ? automatic
                              ? "Checking and continuing…"
                              : "Checking current stage…"
                            : run.status === "running"
                              ? "Check current stage"
                              : `Run ${stageLabels[run.state.nextStage!] ?? "next stage"}`}
                        </button>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => advance(true)}
                        >
                          Continue remaining stages
                        </button>
                      </>
                    )}
                    {busy && checking && (
                      <button
                        className="secondary"
                        onClick={() => {
                          pollControl.current?.abort();
                          setAutomatic(false);
                          setChecking(false);
                          setNotice(
                            "Checking paused. Any current server request may finish, but no additional check or stage will start.",
                          );
                        }}
                      >
                        Pause checks
                      </button>
                    )}
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => load(run.id)}
                    >
                      Refresh saved run
                    </button>
                    {!["running", "exported", "cancelled"].includes(
                      run.status,
                    ) && (
                      <button
                        className="text-button danger"
                        disabled={busy}
                        onClick={cancel}
                      >
                        Cancel run
                      </button>
                    )}
                  </div>
                  {run.status === "running" && (
                    <p className="engine-note">
                      A provider job is already running. Check current stage
                      resumes that saved job; it does not create another one.
                      While this screen is checking, updates arrive about every
                      three seconds. Pausing or leaving this screen stops
                      checks, not the provider job.
                    </p>
                  )}
                  {run.status === "failed" && (
                    <div className="recovery-panel">
                      <label>
                        Reason for retrying
                        <input
                          value={resolutionReason}
                          onChange={(e) => setResolutionReason(e.target.value)}
                          placeholder="What was corrected?"
                        />
                      </label>
                      <button
                        className="secondary"
                        disabled={busy || !resolutionReason.trim()}
                        onClick={() =>
                          operation(async () => {
                            selectRun(
                              await engineRpc<EngineRun>("retry_stage", {
                                id: run.id,
                                reason: resolutionReason,
                              }),
                            );
                            setNotice(
                              "Stage retry enabled. Review the run and continue when ready.",
                            );
                          })
                        }
                      >
                        Enable a deliberate stage retry
                      </button>
                    </div>
                  )}
                  {run.status === "uncertain" && (
                    <div className="recovery-panel">
                      <h3>Provider outcome uncertain</h3>
                      <p>
                        The last request may have completed and incurred a
                        charge even though its result could not be saved. No
                        automatic retry is made.
                      </p>
                      <label>
                        Resolution notes
                        <input
                          value={resolutionReason}
                          onChange={(e) => setResolutionReason(e.target.value)}
                        />
                      </label>
                      <label className="engine-checkbox">
                        <input
                          type="checkbox"
                          checked={acknowledgeCost}
                          onChange={(e) => setAcknowledgeCost(e.target.checked)}
                        />
                        I checked the run and understand a retry can duplicate
                        provider cost.
                      </label>
                      <button
                        className="secondary"
                        disabled={
                          busy || !acknowledgeCost || !resolutionReason.trim()
                        }
                        onClick={() =>
                          operation(async () => {
                            selectRun(
                              await engineRpc<EngineRun>("resolve_uncertain", {
                                id: run.id,
                                reason: resolutionReason,
                                acknowledgePotentialDuplicateCost: true,
                              }),
                            );
                            setAcknowledgeCost(false);
                          })
                        }
                      >
                        Record resolution and allow retry
                      </button>
                    </div>
                  )}
                </section>
                <RunDetails run={run} />
                {run.state.assembly && (
                  <section
                    className={`assembly-panel ${run.state.assembly.shortfall ? "shortfall" : ""}`}
                  >
                    <h2>
                      {run.state.assembly.shortfall
                        ? "This round needs more quality candidates."
                        : "Ready for your editorial review."}
                    </h2>
                    <p>
                      {run.state.assembly.selectedIds.length} of{" "}
                      {run.state.brief.count} candidates passed the quality
                      gates.{" "}
                      {run.state.assembly.shortfall
                        ? "The engine did not lower its standards to fill the round."
                        : "Machine review is complete; your explicit approval is still required."}
                    </p>
                    {run.state.assembly.reasons.length > 0 && (
                      <ul>
                        {run.state.assembly.reasons.map((reason, index) => (
                          <li key={index}>{reason}</li>
                        ))}
                      </ul>
                    )}
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        (run.status !== "exported" && blockers.length > 0)
                      }
                      onClick={() =>
                        run.exportedQuizId
                          ? operation(() => openDraft(run.exportedQuizId!))
                          : exportDraft()
                      }
                    >
                      {run.exportedQuizId
                        ? "Open existing draft"
                        : "Create approved round as draft"}
                    </button>
                    {blockers.length > 0 && run.status !== "exported" && (
                      <ul className="export-blockers">
                        {blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    )}
                    <p className="field-help">
                      Export creates a draft only. Publication remains a
                      separate action in the quiz editor.
                    </p>
                  </section>
                )}
                <div className="section-heading">
                  <h2>
                    Candidates{" "}
                    <span className="count">{run.state.candidates.length}</span>
                  </h2>
                  <span className="muted">
                    Expand to inspect sources and findings
                  </span>
                </div>
                {run.state.candidates.map((candidate) => (
                  <CandidateReview
                    key={`${candidate.id}-${candidate.revision}`}
                    candidate={candidate}
                    reviews={run.state.reviews[candidate.id] ?? {}}
                    decision={[...run.decisions]
                      .reverse()
                      .find(
                        (d) =>
                          d.candidateId === candidate.id &&
                          d.revision === candidate.revision,
                      )}
                    selected={
                      run.state.assembly?.selectedIds.includes(candidate.id) ??
                      false
                    }
                    exactQuotation={run.state.approvedPassages.some(
                      (p) =>
                        p.id === candidate.passageId &&
                        p.text === candidate.hint,
                    )}
                    gateReasons={
                      run.state.assembly?.rejected.find(
                        (item) => item.candidateId === candidate.id,
                      )?.reasons ?? []
                    }
                    busy={busy || run.status !== "review"}
                    repairsRemaining={Math.max(0, 2 - run.state.repairCycles)}
                    decide={decide}
                    retry={retry}
                  />
                ))}
                {!run.state.candidates.length && (
                  <div className="empty-state">
                    <h3>The questions are still ahead.</h3>
                    <p>
                      Run the planning and writing stages to see candidates
                      here.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
