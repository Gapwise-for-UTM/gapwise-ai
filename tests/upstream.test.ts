import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readBoundedJson,
  UpstreamResponseTooLargeError,
  UpstreamTimeoutError,
  withUpstreamDeadline,
} from "@/src/http/upstream";

afterEach(() => {
  vi.useRealTimers();
});

describe("bounded upstream requests", () => {
  it("passes an active AbortSignal through successful upstream work", async () => {
    const value = await withUpstreamDeadline(async (signal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
      return "ok";
    }, 100);
    expect(value).toBe("ok");
  });

  it("aborts a hung operation instead of waiting indefinitely", async () => {
    vi.useFakeTimers();
    const pending = withUpstreamDeadline(
      (signal) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
      25,
    );
    await vi.advanceTimersByTimeAsync(25);
    await expect(pending).rejects.toBeInstanceOf(UpstreamTimeoutError);
  });

  it("keeps the deadline active while an upstream body is being read", async () => {
    vi.useFakeTimers();
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        controller.enqueue(new TextEncoder().encode('{"partial":'));
      },
    });
    const response = new Response(stream);
    const pending = withUpstreamDeadline(
      async (signal) => {
        signal.addEventListener(
          "abort",
          () => streamController?.error(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
        return readBoundedJson(response, 1024);
      },
      25,
    );
    await vi.advanceTimersByTimeAsync(25);
    await expect(pending).rejects.toBeInstanceOf(UpstreamTimeoutError);
  });

  it("rejects declared and streamed response bodies above the bound", async () => {
    const declared = new Response("{}", {
      headers: { "content-length": "5000" },
    });
    await expect(readBoundedJson(declared, 100)).rejects.toBeInstanceOf(
      UpstreamResponseTooLargeError,
    );

    const actual = new Response(JSON.stringify({ payload: "x".repeat(200) }));
    await expect(readBoundedJson(actual, 100)).rejects.toBeInstanceOf(
      UpstreamResponseTooLargeError,
    );
  });
});
