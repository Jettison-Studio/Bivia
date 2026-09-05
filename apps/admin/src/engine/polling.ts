export type StageSnapshot = {
  status: string;
  state: { nextStage: string | null };
};

/** Pausing aborts only this browser's wait, never the provider's durable job. */
export function waitForStagePoll(
  signal: AbortSignal,
  milliseconds = 3000,
): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });
}

/** Each invocation uses the latest saved snapshot/version. Running invokes poll an existing job. */
export async function driveStages<T extends StageSnapshot>(
  initial: T,
  options: {
    invoke: (run: T) => Promise<T>;
    onRun: (run: T) => void;
    continueAll: boolean;
    signal: AbortSignal;
    wait?: (signal: AbortSignal) => Promise<void>;
  },
): Promise<T> {
  let current = initial;
  while (!options.signal.aborted) {
    if (
      current.status !== "running" &&
      (current.status !== "queued" || !current.state.nextStage)
    )
      return current;
    current = await options.invoke(current);
    options.onRun(current);
    if (options.signal.aborted) return current;
    if (current.status === "running") {
      await (options.wait ?? waitForStagePoll)(options.signal);
      continue;
    }
    if (
      current.status !== "queued" ||
      !current.state.nextStage ||
      !options.continueAll
    )
      return current;
  }
  return current;
}
