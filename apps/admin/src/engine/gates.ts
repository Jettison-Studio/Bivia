import type { EngineRun } from "./api";
export function exportBlockers(run: EngineRun): string[] {
  const blockers: string[] = [];
  if (!run.state.assembly)
    return ["Finish every review stage before exporting."];
  if (
    run.state.assembly.shortfall > 0 ||
    run.state.assembly.selectedIds.length !== run.state.brief.count ||
    new Set(run.state.assembly.selectedIds).size !== run.state.brief.count
  )
    blockers.push(
      `This round needs ${run.state.brief.count} quality candidates; ${run.state.assembly.selectedIds.length} passed the gates.`,
    );
  for (const id of run.state.assembly.selectedIds) {
    const candidate = run.state.candidates.find((item) => item.id === id);
    if (
      !candidate ||
      [...run.decisions]
        .reverse()
        .find(
          (decision) =>
            decision.candidateId === id &&
            decision.revision === candidate.revision,
        )?.decision !== "approved"
    )
      blockers.push(
        "Every selected candidate needs explicit approval of its current revision.",
      );
  }
  if (
    run.status !== "review" && run.status !== "exported"
  )
    blockers.push("Resolve the run status before exporting.");
  return [...new Set(blockers)];
}
