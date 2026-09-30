import type { AuthConfig } from "./config.js";
import { SEApiError } from "./errors.js";

export const API_BASE = "https://api.streamelements.com/kappa";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
export type ApiVersion = "v2" | "v3";

export interface RequestOptions {
  method: HttpMethod;
  /** Path relative to the versioned base, e.g. `/bot/commands/<channel>`. */
  path: string;
  version?: ApiVersion;
  query?: Record<string, unknown>;
  body?: unknown;
}

export interface ClientOptions {
  auth: AuthConfig;
  channelId?: string;
  timeoutMs: number;
}

function buildUrl(version: ApiVersion, path: string, query: Record<string, unknown> | undefined): string {
  const url = `${API_BASE}/${version}${path}`;
  if (!query) {
    return url;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, String(item));
    }
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class SEClient {
  private readonly options: ClientOptions;
  private readonly fetchImpl: typeof fetch;
  private channelIdLookup?: Promise<string>;

  constructor(options: ClientOptions, fetchImpl: typeof fetch = fetch) {
    this.options = options;
    this.fetchImpl = fetchImpl;
  }

  async request<T = unknown>({ method, path, version = "v2", query, body }: RequestOptions): Promise<T> {
    const { auth, timeoutMs } = this.options;
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: auth.type === "jwt" ? `Bearer ${auth.token}` : `oAuth ${auth.token}`,
    };
    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(timeoutMs) };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(buildUrl(version, path, query), init);
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(`StreamElements request timed out after ${timeoutMs}ms: ${method} ${path}`);
      }
      throw new Error(
        `StreamElements request failed: ${method} ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const data = await readBody(response);
    if (!response.ok) {
      throw new SEApiError({
        status: response.status,
        statusText: response.statusText,
        method,
        path,
        body: data,
        retryAfter: response.headers.get("retry-after") ?? undefined,
      });
    }
    return data as T;
  }

  /** The configured channel id, or the token owner's channel id from /channels/me (looked up once). */
  getChannelId(): Promise<string> {
    if (this.options.channelId) {
      return Promise.resolve(this.options.channelId);
    }
    this.channelIdLookup ??= this.lookUpChannelId().catch((error: unknown) => {
      this.channelIdLookup = undefined;
      throw error;
    });
    return this.channelIdLookup;
  }

  private async lookUpChannelId(): Promise<string> {
    const me = await this.request<{ _id?: unknown }>({ method: "GET", path: "/channels/me" });
    if (typeof me?._id !== "string" || me._id === "") {
      throw new Error("GET /channels/me returned no _id; set SE_CHANNEL_ID explicitly.");
    }
    return me._id;
  }
}
