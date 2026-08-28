import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const RUNTIME_ROOTS = ["app", "src"] as const;

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (entry.isFile() && /\.(?:ts|tsx|js|jsx)$/u.test(entry.name)) files.push(path);
  }
  return files;
}

async function runtimeSources() {
  const paths = (await Promise.all(RUNTIME_ROOTS.map(sourceFiles))).flat();
  return Promise.all(paths.map(async (path) => ({ path, source: await readFile(path, "utf8") })));
}

function assertAbsent(
  files: Array<{ path: string; source: string }>,
  pattern: RegExp,
  description: string,
) {
  const offenders = files.filter(({ source }) => pattern.test(source)).map(({ path }) => path);
  if (offenders.length) throw new Error(`${description}: ${offenders.join(", ")}`);
  expect(offenders).toEqual([]);
}

describe("AI runtime security regressions", () => {
  it("does not expose shell or dynamic-code execution primitives", async () => {
    const files = await runtimeSources();
    const forbidden: Array<[RegExp, string]> = [
      [/from\s+["'](?:node:)?child_process["']/u, "child_process import"],
      [/require\(\s*["'](?:node:)?child_process["']\s*\)/u, "child_process require"],
      [/\bBun\.(?:spawn|spawnSync)\b/u, "Bun process spawning"],
      [/\bDeno\.Command\b/u, "Deno process spawning"],
      [/from\s+["']node:vm["']/u, "Node VM dynamic execution"],
      [/\beval\s*\(/u, "eval"],
      [/\bnew\s+Function\s*\(/u, "Function constructor"],
    ];
    for (const [pattern, description] of forbidden) assertAbsent(files, pattern, description);
  });

  it("keeps request parsing and rendered HTML on reviewed paths", async () => {
    const files = await runtimeSources();
    assertAbsent(files, /\brequest\.json\s*\(/u, "direct unbounded Request.json() parsing");
    assertAbsent(files, /\bdangerouslySetInnerHTML\b/u, "dangerouslySetInnerHTML");
  });

  it("does not reference client-exposed privileged secret names", async () => {
    const files = await runtimeSources();
    assertAbsent(
      files,
      /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|SERVICE_ROLE|DEK|KEK)/u,
      "client-exposed privileged secret",
    );
  });
});
