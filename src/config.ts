export type RuntimeConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  aiDataKey: string;
  gapwiseAppOrigin: string;
  aiOrigin: string | null;
};

const REQUIRED = [
  "GAPWISE_SUPABASE_URL",
  "GAPWISE_SUPABASE_PUBLISHABLE_KEY",
  "GAPWISE_AI_DATA_KEY",
  "GAPWISE_APP_ORIGIN",
] as const;

function normalizedOrigin(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must contain only an origin.`);
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production.`);
  }
  return url.origin;
}

export function runtimeConfigStatus(): { configured: boolean; missing: string[] } {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  return { configured: missing.length === 0, missing: [...missing] };
}

export function getRuntimeConfig(): RuntimeConfig {
  const status = runtimeConfigStatus();
  if (!status.configured) {
    throw new Error(`Gapwise AI is missing required configuration: ${status.missing.join(", ")}`);
  }

  const supabaseUrl = normalizedOrigin(process.env.GAPWISE_SUPABASE_URL!, "GAPWISE_SUPABASE_URL");
  const gapwiseAppOrigin = normalizedOrigin(process.env.GAPWISE_APP_ORIGIN!, "GAPWISE_APP_ORIGIN");
  const aiOrigin = process.env.GAPWISE_AI_ORIGIN?.trim()
    ? normalizedOrigin(process.env.GAPWISE_AI_ORIGIN, "GAPWISE_AI_ORIGIN")
    : null;
  const supabasePublishableKey = process.env.GAPWISE_SUPABASE_PUBLISHABLE_KEY!.trim();
  const aiDataKey = process.env.GAPWISE_AI_DATA_KEY!.trim();

  if (supabasePublishableKey.length < 20) {
    throw new Error("GAPWISE_SUPABASE_PUBLISHABLE_KEY is malformed.");
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
    aiDataKey,
    gapwiseAppOrigin,
    aiOrigin,
  };
}

export function supabaseIssuer(config = getRuntimeConfig()): string {
  return `${config.supabaseUrl}/auth/v1`;
}
