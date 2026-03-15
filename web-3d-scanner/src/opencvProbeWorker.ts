/// <reference lib="webworker" />

type ProbeResultMessage = {
  type: "probe-result";
  ok: boolean;
  reason: string;
  durationMs: number;
};

function postResult(message: ProbeResultMessage): void {
  self.postMessage(message);
}

self.addEventListener("message", async (event: MessageEvent) => {
  const data = event.data as { type?: string };
  if (data.type !== "probe") {
    return;
  }

  const startedAt = performance.now();

  try {
    const imported = await import("@techstark/opencv-js");
    const maybeDefault = imported as { default?: unknown };
    let runtime: unknown = maybeDefault.default ?? imported;

    if (typeof runtime === "object" && runtime !== null) {
      const asRecord = runtime as Record<string, unknown>;
      if (typeof asRecord.Mat !== "function" && typeof asRecord.then === "function") {
        runtime = await Promise.resolve(runtime as Promise<unknown>);
      }
    }

    const ready =
      typeof runtime === "object" &&
      runtime !== null &&
      typeof (runtime as Record<string, unknown>).Mat === "function";

    if (ready) {
      postResult({
        type: "probe-result",
        ok: true,
        reason: "",
        durationMs: performance.now() - startedAt,
      });
    } else {
      postResult({
        type: "probe-result",
        ok: false,
        reason: "OpenCV załadowane, ale Mat niedostępne",
        durationMs: performance.now() - startedAt,
      });
    }
  } catch (error) {
    postResult({
      type: "probe-result",
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - startedAt,
    });
  }
});
