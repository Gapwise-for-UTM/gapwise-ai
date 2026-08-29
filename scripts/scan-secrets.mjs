import { spawnSync } from "node:child_process";

const excludedPath = "scripts/scan-secrets.mjs";
const highConfidencePatterns = [
  "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
  "(sk-proj-|sk-ant-|sk_live_|rk_live_|ghp_|github_pat_|glpat-|xox[baprs]-)[A-Za-z0-9_=-]{12,}",
  "AIza[0-9A-Za-z_-]{35}",
  "postgres(ql)?://[^[:space:]/:]+:[^[:space:]@]+@",
  "SUPABASE_(SERVICE_ROLE|SECRET)_KEY[[:space:]]*=[[:space:]]*eyJ[A-Za-z0-9._-]{40,}",
];
const pattern = highConfidencePatterns.map((value) => `(${value})`).join("|");

function runGit(args, { allowNoMatch = false } = {}) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (allowNoMatch && result.status === 1) return "";
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `git ${args.join(" ")} failed\n`);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function grepCommit(commit) {
  const output = runGit(
    [
      "grep",
      "-nI",
      "-E",
      pattern,
      commit,
      "--",
      ".",
      `:(exclude)${excludedPath}`,
    ],
    { allowNoMatch: true },
  );
  return output.trim();
}

const commits = runGit(["rev-list", "HEAD"])
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);

const findings = [];
for (const commit of commits) {
  const match = grepCommit(commit);
  if (match) findings.push({ commit, match });
}

if (findings.length > 0) {
  console.error("High-confidence credential material was found in reachable history.");
  for (const finding of findings) {
    console.error(`\ncommit ${finding.commit}\n${finding.match}`);
  }
  process.exit(1);
}

console.log(`Secret scan passed across ${commits.length} reachable commit(s).`);
