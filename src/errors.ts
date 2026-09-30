export interface SEApiErrorDetails {
  status: number;
  statusText: string;
  method: string;
  path: string;
  body: unknown;
  retryAfter?: string;
}

const MAX_DETAIL_CHARS = 500;

function describeBody(body: unknown): string | undefined {
  if (body === null || body === undefined || body === "") {
    return undefined;
  }
  if (typeof body === "string") {
    return body;
  }
  if (typeof body === "object") {
    const { message, error } = body as { message?: unknown; error?: unknown };
    if (typeof message === "string" && message) {
      return message;
    }
    if (typeof error === "string" && error) {
      return error;
    }
  }
  return JSON.stringify(body);
}

/** A non-2xx response from the StreamElements API. */
export class SEApiError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly retryAfter?: string;

  constructor(details: SEApiErrorDetails) {
    const detail = describeBody(details.body)?.slice(0, MAX_DETAIL_CHARS);
    super(
      `StreamElements API error ${details.status} ${details.statusText} on ${details.method} ${details.path}` +
        (detail ? `: ${detail}` : ""),
    );
    this.name = "SEApiError";
    this.status = details.status;
    this.method = details.method;
    this.path = details.path;
    this.body = details.body;
    this.retryAfter = details.retryAfter;
  }
}

function hintFor(error: SEApiError, scope: string | undefined): string | undefined {
  const { status } = error;
  if (status === 401) {
    return (
      "The token is invalid or expired. Update SE_JWT_TOKEN (StreamElements dashboard → account → channels → " +
      "Show secrets) or SE_OAUTH_TOKEN."
    );
  }
  if (status === 403) {
    return scope
      ? `Access denied. With an OAuth token this endpoint needs the ${scope} scope; your account may also lack permission on this channel.`
      : "Access denied. Your account may lack permission on this channel.";
  }
  if (status === 404) {
    return "Not found. Check the ids and channel you passed.";
  }
  if (status === 429) {
    return error.retryAfter
      ? `Rate limited by StreamElements. Retry after ${error.retryAfter} seconds.`
      : "Rate limited by StreamElements. Wait before retrying.";
  }
  if (status >= 500) {
    return "StreamElements had a server-side error. Retrying later may help.";
  }
  return undefined;
}

/** Renders any thrown value as tool error text, with a hint for common API failures. */
export function formatToolError(error: unknown, scope?: string): string {
  if (error instanceof SEApiError) {
    const hint = hintFor(error, scope);
    return hint ? `${error.message}\n${hint}` : error.message;
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
