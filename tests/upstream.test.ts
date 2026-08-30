import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchUpstream,
  readBoundedJson,
  UpstreamResponseTooLargeError,
  UpstreamTimeoutError,
} from "@/src/http/upstream";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("bounded upstream requests", () => {
  it("passes a bounded AbortSignal to successful upstream fetches", async () => {
    const fetchMock = vi.fn(async (_input: string | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchUpstream("https://example.test", {}, 100);
    expect(await response.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts a hung upstream instead of waiting indefinitely", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: string | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
      ),
    );

    const pending = fetchUpstream("https://example.test", {}, 25);
    await vi.advanceTimersByTimeAsync(25);
    await expect(pending).rejects.toBeInstanceOf(UpstreamTimeoutError);
  });

  it("rejects declared and actual response bodies above the bound", async () => {
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
