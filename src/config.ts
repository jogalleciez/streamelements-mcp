import { parseToolsets, type Toolset } from "./toolsets.js";

export type AuthConfig = { type: "jwt"; token: string } | { type: "oauth"; token: string };

export interface Config {
  auth: AuthConfig;
  /** Channel id used when a tool call omits `channel`. Resolved via /channels/me when unset. */
  channelId?: string;
  toolsets: ReadonlySet<Toolset>;
  timeoutMs: number;
  maxResponseChars: number;
  /** Non-fatal problems for the entrypoint to log to stderr. */
  warnings: string[];
}

type Env = Record<string, string | undefined>;

const CHANNEL_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

function readString(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function readPositiveInt(env: Env, name: string, fallback: number): number {
  const raw = readString(env, name);
  if (raw === undefined) {
    return fallback;
  }
  if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }
  return Number(raw);
}

export function loadConfig(env: Env = process.env): Config {
  const warnings: string[] = [];
  const jwt = readString(env, "SE_JWT_TOKEN");
  const oauth = readString(env, "SE_OAUTH_TOKEN");

  let auth: AuthConfig;
  if (jwt) {
    auth = { type: "jwt", token: jwt };
    if (oauth) {
      warnings.push("Both SE_JWT_TOKEN and SE_OAUTH_TOKEN are set; using the JWT, SE_OAUTH_TOKEN is ignored.");
    }
  } else if (oauth) {
    auth = { type: "oauth", token: oauth };
  } else {
    throw new Error(
      "No StreamElements credentials found. Set SE_JWT_TOKEN (dashboard → account → channels → Show secrets) " +
        "or SE_OAUTH_TOKEN (an OAuth2 access token).",
    );
  }

  const channelId = readString(env, "SE_CHANNEL_ID");
  if (channelId !== undefined && !CHANNEL_ID_PATTERN.test(channelId)) {
    throw new Error(
      `SE_CHANNEL_ID must be a 24-character hex channel id (not a channel name), got "${channelId}". ` +
        "Leave it unset to look it up automatically.",
    );
  }

  return {
    auth,
    channelId,
    toolsets: parseToolsets(env.SE_TOOLSETS),
    timeoutMs: readPositiveInt(env, "SE_TIMEOUT_MS", 15000),
    maxResponseChars: readPositiveInt(env, "SE_MAX_RESPONSE_CHARS", 100000),
    warnings,
  };
}
