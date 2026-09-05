import test from "node:test";
import assert from "node:assert/strict";
import { initialBrief, sourceLink, validateBrief } from "../src/engine/brief";
import { exportBlockers } from "../src/engine/gates";
import type { EngineRun } from "../src/engine/api";

const brief = { ...initialBrief, count: 3, categoryIds: ["science"] };
test("round briefs enforce category coverage and progressive difficulty", () => {
  assert.deepEqual(validateBrief(brief, ["science"], 0), []);
  assert.ok(
    validateBrief(
      { ...brief, categoryIds: ["science", "history"] },
      ["science", "history"],
      0,
    ).some((e) => e.includes("exactly one")),
  );
  assert.ok(
    validateBrief(
      { ...brief, kind: "progressive", difficulty: "medium" },
      ["science"],
      0,
    ).some((e) => e.includes("rising")),
  );
  assert.deepEqual(
    validateBrief(
      { ...brief, kind: "progressive", difficulty: "rising" },
      ["science"],
      0,
    ),
    [],
  );
});
test("licensed text cannot be selected without verified eligible passages", () => {
  assert.ok(
    validateBrief({ ...brief, sourceMode: "licensed_niv" }, ["science"], 0)
      .length,
  );
  assert.deepEqual(
    validateBrief({ ...brief, sourceMode: "licensed_niv" }, ["science"], 1),
    [],
  );
  assert.ok(validateBrief({ ...brief, count: 11 }, ["science"], 0).length);
});
function readyRun(): EngineRun {
  return {
    status: "review",
    decisions: [1, 2, 3].map((n) => ({
      candidateId: `q${n}`,
      revision: 1,
      decision: "approved",
      reason: "good",
      decidedAt: "2026-09-05T00:00:00Z",
    })),
    state: {
      brief,
      candidates: [1, 2, 3].map((n) => ({ id: `q${n}`, revision: 1 })),
      assembly: {
        selectedIds: ["q1", "q2", "q3"],
        shortfall: 0,
        rejected: [],
        reasons: [],
        requiresHumanApproval: true,
      },
    },
  } as EngineRun;
}
test("export requires a complete round and approval of every current revision", () => {
  const run = readyRun();
  assert.deepEqual(exportBlockers(run), []);
  run.state.candidates[1].revision = 2;
  assert.ok(
    exportBlockers(run).some((message) => message.includes("current revision")),
  );
  run.state.assembly!.shortfall = 1;
  run.state.assembly!.selectedIds.pop();
  assert.ok(
    exportBlockers(run).some((message) =>
      message.includes("3 quality candidates"),
    ),
  );
});
test("a later rejection overrides approval and uncertain runs cannot export", () => {
  const run = readyRun();
  run.decisions.push({
    candidateId: "q1",
    revision: 1,
    decision: "rejected",
    reason: "factual",
    decidedAt: "2026-09-05T01:00:00Z",
  });
  assert.ok(exportBlockers(run).length);
  run.status = "uncertain";
  assert.ok(
    exportBlockers(run).some((message) => message.includes("run status")),
  );
});
test("research links reject script and local-file schemes", () => {
  assert.equal(sourceLink("javascript:alert(1)"), null);
  assert.equal(sourceLink("file:///etc/passwd"), null);
  assert.equal(
    sourceLink("https://example.org/fact"),
    "https://example.org/fact",
  );
});
