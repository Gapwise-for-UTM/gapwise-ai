import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");

const dependencyGroups = [
  ["dependencies", packageJson.dependencies ?? {}],
  ["devDependencies", packageJson.devDependencies ?? {}],
  ["optionalDependencies", packageJson.optionalDependencies ?? {}],
];

const forbiddenDependencies = new Set([
  "openai",
  "@anthropic-ai/sdk",
  "ai",
  "@ai-sdk/openai",
  "@ai-sdk/anthropic",
  "@ai-sdk/azure",
  "@google/generative-ai",
]);

const forbiddenEnvironmentVariables = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_API_KEY",
  "AI_GATEWAY_API_KEY",
  "VERCEL_AI_GATEWAY_API_KEY",
];

const violations = [];

for (const [groupName, dependencies] of dependencyGroups) {
  for (const dependencyName of Object.keys(dependencies)) {
    if (forbiddenDependencies.has(dependencyName)) {
      violations.push(
        `${groupName} contains server-side model/provider dependency: ${dependencyName}`,
      );
    }
  }
}

for (const variableName of forbiddenEnvironmentVariables) {
  const declaration = new RegExp(`^\\s*${variableName}\\s*=`, "m");
  if (declaration.test(envExample)) {
    violations.push(`.env.example declares billable model credential: ${variableName}`);
  }
}

if (!envExample.includes("GAPWISE_OPENAI_APPS_CHALLENGE_TOKEN")) {
  violations.push(
    ".env.example must retain GAPWISE_OPENAI_APPS_CHALLENGE_TOKEN as the explicitly non-billing OpenAI verification credential.",
  );
}

if (violations.length > 0) {
  console.error("Gapwise AI cost-model guard failed:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "\nIf a paid or metered runtime dependency is intentionally proposed, update docs/COST_MODEL.md and obtain an explicit architecture/cost review before changing this guard.",
  );
  process.exit(1);
}

console.log(
  "Cost-model guard passed: no server-side model SDK or billable model credential is declared.",
);
