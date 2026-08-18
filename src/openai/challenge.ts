const MAX_CHALLENGE_TOKEN_LENGTH = 2048;

export function normalizeOpenAiAppsChallengeToken(value: string | undefined): string | null {
  const token = value?.trim();
  if (!token || token.length > MAX_CHALLENGE_TOKEN_LENGTH) return null;
  if (/[\u0000-\u001f\u007f]/u.test(token)) return null;
  return token;
}
