import { normalizeOpenAiAppsChallengeToken } from "@/src/openai/challenge";

export const dynamic = "force-dynamic";

export function GET() {
  const token = normalizeOpenAiAppsChallengeToken(
    process.env.GAPWISE_OPENAI_APPS_CHALLENGE_TOKEN,
  );

  if (!token) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // OpenAI domain verification requires the response body to contain exactly
  // the challenge token: no JSON wrapper, label, or trailing newline.
  return new Response(token, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
