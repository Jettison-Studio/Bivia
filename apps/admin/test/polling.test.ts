import test from "node:test";
import assert from "node:assert/strict";
import { driveStages, waitForStagePoll } from "../src/engine/polling";

type Snapshot = {
  id: string;
  version: number;
  status: string;
  state: { nextStage: string | null };
};
const snapshot = (
  version: number,
  status: string,
  nextStage: string | null,
): Snapshot => ({
  id: "same-persisted-run",
  version,
  status,
  state: { nextStage },
});

test("one-stage mode polls the saved job using current versions and stops before the next stage", async () => {
  const replies = [
    snapshot(2, "running", "plan"),
    snapshot(3, "running", "plan"),
    snapshot(4, "queued", "write"),
  ];
  const sent: Snapshot[] = [];
  let waits = 0;
  const final = await driveStages(snapshot(1, "queued", "plan"), {
    invoke: async (run) => {
      sent.push(run);
      return replies.shift()!;
    },
    onRun: () => {},
    continueAll: false,
    signal: new AbortController().signal,
    wait: async () => {
      waits++;
    },
  });
  assert.deepEqual(
    sent.map((run) => run.version),
    [1, 2, 3],
  );
  assert.ok(sent.every((run) => run.id === "same-persisted-run"));
  assert.equal(waits, 2);
  assert.equal(final.state.nextStage, "write");
  assert.equal(sent.length, 3);
});

test("continue-all advances only completed queued stages, then stops at review", async () => {
  const replies = [
    snapshot(2, "running", "plan"),
    snapshot(3, "queued", "write"),
    snapshot(4, "running", "write"),
    snapshot(5, "review", null),
  ];
  const stages: Array<string | null> = [];
  await driveStages(snapshot(1, "queued", "plan"), {
    invoke: async (run) => {
      stages.push(run.state.nextStage);
      return replies.shift()!;
    },
    onRun: () => {},
    continueAll: true,
    signal: new AbortController().signal,
    wait: async () => {},
  });
  assert.deepEqual(stages, ["plan", "plan", "write", "write"]);
});

test("pause stops further polling without issuing a cancellation or another stage", async () => {
  const controller = new AbortController();
  let calls = 0;
  const final = await driveStages(snapshot(7, "running", "write"), {
    invoke: async () => {
      calls++;
      return snapshot(8, "running", "write");
    },
    onRun: () => {},
    continueAll: true,
    signal: controller.signal,
    wait: async () => {
      controller.abort();
    },
  });
  assert.equal(calls, 1);
  assert.equal(final.status, "running");
});

test("a stale-version conflict stops immediately without automatic resubmission", async () => {
  let calls = 0;
  const conflict = Object.assign(new Error("Version changed"), { status: 409 });
  await assert.rejects(
    driveStages(snapshot(1, "running", "plan"), {
      invoke: async () => {
        calls++;
        throw conflict;
      },
      onRun: () => {},
      continueAll: true,
      signal: new AbortController().signal,
    }),
    (error) => error === conflict,
  );
  assert.equal(calls, 1);
});

test("uncertain and failed snapshots stop without automatically retrying provider work", async () => {
  for (const status of ["failed", "uncertain"]) {
    let calls = 0;
    const final = await driveStages(snapshot(1, "running", "plan"), {
      invoke: async () => {
        calls++;
        return snapshot(2, status, "plan");
      },
      onRun: () => {},
      continueAll: true,
      signal: new AbortController().signal,
    });
    assert.equal(calls, 1);
    assert.equal(final.status, status);
  }
});

test("pausing interrupts a pending poll timer", async () => {
  const controller = new AbortController();
  const waiting = waitForStagePoll(controller.signal, 60_000);
  controller.abort();
  await waiting;
  assert.equal(controller.signal.aborted, true);
});
