const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;

export class UpstreamTimeoutError extends Error {
  constructor() {
    super("Upstream request timed out.");
  }
}

export class UpstreamResponseTooLargeError extends Error {
  constructor() {
    super("Upstream response exceeded the allowed size.");
  }
}

export async function fetchUpstream(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
): Promise<Response> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Upstream timeout must be a positive finite number.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new UpstreamTimeoutError();
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new Error("Maximum response size must be a positive safe integer.");
  }

  const declared = response.headers.get("content-length");
  if (declared) {
    const declaredBytes = Number(declared);
    if (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) {
      throw new UpstreamResponseTooLargeError();
    }
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new UpstreamResponseTooLargeError();
  }
  return text;
}

export async function readBoundedJson(
  response: Response,
  maximumBytes: number,
): Promise<unknown> {
  const text = await readBoundedText(response, maximumBytes);
  if (!text) return null;
  return JSON.parse(text) as unknown;
}
