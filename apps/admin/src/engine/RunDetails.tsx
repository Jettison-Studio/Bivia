import type { EngineRun } from "./api";
import { readable, stageLabels } from "./brief";
function dollars(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${value.toFixed(4)}`
    : "Unavailable";
}
function valueText(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "Unavailable";
}
export function RunDetails({ run }: { run: EngineRun }) {
  const usage = run.usage;
  return (
    <details className="engine-run-details">
      <summary>
        Usage, model, and run history{" "}
        <span>
          {usage ? dollars(usage.estimatedCostUsd) : "Cost unavailable"}{" "}
          estimated
        </span>
      </summary>
      <div className="run-detail-body">
        <div className="usage-grid">
          <div>
            <small>Model</small>
            <strong>{valueText(run.config.model)}</strong>
          </div>
          <div>
            <small>Input / output tokens</small>
            <strong>
              {usage
                ? `${usage.inputTokens.toLocaleString()} / ${usage.outputTokens.toLocaleString()}`
                : "Unavailable"}
            </strong>
          </div>
          <div>
            <small>Known cost estimate</small>
            <strong>{dollars(usage?.estimatedCostUsd)}</strong>
          </div>
          <div>
            <small>Reserved / uncertain cost</small>
            <strong>{dollars(usage?.reservedCostUsd)}</strong>
          </div>
          <div>
            <small>Run budget</small>
            <strong>{dollars(run.config.runBudgetUsd)}</strong>
          </div>
          <div>
            <small>Calls / web searches</small>
            <strong>
              {usage
                ? `${usage.calls} / ${usage.webSearchCalls}`
                : "Unavailable"}
            </strong>
          </div>
        </div>
        <p className="field-help">
          Costs are estimates from recorded usage and configured rates, not an
          invoice. Reserved cost can include a request whose final usage is
          unknown. Difficulty and playtest times are model estimates.
        </p>
        <div className="engine-call-table">
          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th>State</th>
                <th>Tokens in / out</th>
                <th>Estimate</th>
              </tr>
            </thead>
            <tbody>
              {run.calls.map((call, index) => (
                <tr key={String(call.id ?? index)}>
                  <td>
                    {stageLabels[String(call.stage)] ?? valueText(call.stage)}
                    <small>{valueText(call.model)}</small>
                  </td>
                  <td>{readable(String(call.status ?? "unknown"))}</td>
                  <td>
                    {call.usageSource === "provider"
                      ? `${valueText(call.inputTokens)} / ${valueText(call.outputTokens)}`
                      : "Not recorded"}
                  </td>
                  <td>
                    {dollars(call.estimatedCostUsd)}
                    {call.status === "reserved" ||
                    call.status === "uncertain" ? (
                      <small>{dollars(call.reservedCostUsd)} reserved</small>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!run.calls.length && (
            <p className="muted">No provider calls have been recorded.</p>
          )}
        </div>
        <details>
          <summary>Editorial audit trail</summary>
          <ul className="engine-audit">
            {run.audit.map((entry, index) => (
              <li key={index}>
                <strong>
                  {valueText(entry.action ?? entry.type ?? entry.event)}
                </strong>
                <span>
                  {valueText(entry.at ?? entry.createdAt ?? entry.timestamp)}
                </span>
                {typeof entry.reason === "string" && <p>{entry.reason}</p>}
                {entry.detail && typeof entry.detail === "object" ? <details><summary>Recorded details</summary><pre className="audit-detail">{JSON.stringify(entry.detail, null, 2)}</pre></details> : null}
              </li>
            ))}
          </ul>
          {!run.audit.length && (
            <p className="muted">No audit entries returned.</p>
          )}
        </details>
        <p className="field-help">
          Run {run.id} · Saved version {run.version} · Updated{" "}
          {new Date(run.updatedAt).toLocaleString()}
        </p>
      </div>
    </details>
  );
}
