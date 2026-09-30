import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z, type ZodType } from "zod";
import type { ApiVersion, HttpMethod, RequestOptions, SEClient } from "./client.js";
import { formatToolError } from "./errors.js";
import { TOOLSET_SCOPES, type Toolset } from "./toolsets.js";

/** One StreamElements REST operation, exposed as one MCP tool. */
export interface EndpointDef {
  name: string;
  title: string;
  description: string;
  toolset: Toolset;
  method: HttpMethod;
  /** Path with `{placeholders}`, e.g. `/bot/commands/{channel}/{commandId}`. `{channel}` is filled automatically. */
  path: string;
  version?: ApiVersion;
  /** Inputs for path placeholders, query and body (never `channel`). */
  input?: Record<string, ZodType>;
  /** Input keys sent as query parameters. */
  query?: readonly string[];
  /**
   * Input keys sent as JSON body fields, or `{ from }` to send one input as the entire body
   * (`{ from, as }` wraps it: `{ [as]: input }`).
   */
  body?: readonly string[] | { from: string; as?: string };
  /** Description for the automatic `channel` input, when the default wording doesn't fit. */
  channelDescription?: string;
  annotations?: Partial<ToolAnnotations>;
}

export interface RegisterOptions {
  maxResponseChars: number;
}

const NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const PLACEHOLDER = /\{(\w+)\}/g;
const DEFAULT_CHANNEL_DESCRIPTION =
  "StreamElements channel id (24-char hex). Defaults to SE_CHANNEL_ID or the channel that owns the token.";

function placeholders(path: string): string[] {
  return [...path.matchAll(PLACEHOLDER)].map((match) => match[1]);
}

function bodyKeys(body: EndpointDef["body"]): string[] {
  if (body === undefined) {
    return [];
  }
  return "from" in body ? [body.from] : [...body];
}

function hasChannel(def: EndpointDef): boolean {
  return placeholders(def.path).includes("channel");
}

/** Consistency problems in a definition; empty when the definition is usable. */
export function endpointProblems(def: EndpointDef): string[] {
  const problems: string[] = [];
  if (!NAME_PATTERN.test(def.name)) {
    problems.push(`name "${def.name}" must match ${NAME_PATTERN.source}`);
  }
  const inputs = Object.keys(def.input ?? {});
  const channelPath = hasChannel(def);
  if (channelPath && inputs.includes("channel")) {
    problems.push('input "channel" is reserved; it is added automatically for {channel} paths');
  }
  const pathKeys = placeholders(def.path).filter((key) => key !== "channel");
  const queryKeys = [...(def.query ?? [])];
  const sentBody = bodyKeys(def.body);

  for (const key of pathKeys) {
    if (!inputs.includes(key)) {
      problems.push(`path placeholder {${key}} has no input`);
    }
  }
  for (const key of queryKeys) {
    if (!inputs.includes(key)) {
      problems.push(`query key "${key}" is not an input`);
    }
  }
  for (const key of sentBody) {
    if (!inputs.includes(key)) {
      problems.push(`body key "${key}" is not an input`);
    }
  }
  for (const key of inputs) {
    if (channelPath && key === "channel") {
      continue;
    }
    const uses = [pathKeys, queryKeys, sentBody].filter((keys) => keys.includes(key)).length;
    if (uses === 0) {
      problems.push(`input "${key}" is not used in the path, query or body`);
    } else if (uses > 1) {
      problems.push(`input "${key}" is sent in more than one place`);
    }
  }
  return problems;
}

/** Turns tool arguments into an API request. `channel` fills `{channel}` when the path has one. */
export function buildRequest(def: EndpointDef, args: Record<string, unknown>, channel?: string): RequestOptions {
  const path = def.path.replace(PLACEHOLDER, (_match, key: string) =>
    encodeURIComponent(String(key === "channel" ? channel : args[key])),
  );

  let query: Record<string, unknown> | undefined;
  if (def.query?.length) {
    query = Object.fromEntries(def.query.map((key) => [key, args[key]]));
  }

  let body: unknown;
  if (def.body !== undefined) {
    if ("from" in def.body) {
      body = def.body.as === undefined ? args[def.body.from] : { [def.body.as]: args[def.body.from] };
    } else {
      body = Object.fromEntries(def.body.filter((key) => args[key] !== undefined).map((key) => [key, args[key]]));
    }
  }

  return { method: def.method, path, version: def.version ?? "v2", query, body };
}

const METHOD_ANNOTATIONS: Record<HttpMethod, ToolAnnotations> = {
  GET: { readOnlyHint: true },
  POST: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  PUT: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  DELETE: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
};

export function buildToolAnnotations(def: EndpointDef): ToolAnnotations {
  return { title: def.title, ...METHOD_ANNOTATIONS[def.method], openWorldHint: true, ...def.annotations };
}

function formatResult(data: unknown, request: RequestOptions, maxChars: number): string {
  if (data === null || data === undefined) {
    return `Success (${request.method} ${request.path} returned no content).`;
  }
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  if (text.length <= maxChars) {
    return text;
  }
  return (
    `${text.slice(0, maxChars)}\n\n[Truncated: showing ${maxChars} of ${text.length} characters. ` +
    "Use paging inputs (limit/offset) or a narrower query to see the rest.]"
  );
}

export function registerEndpoint(
  server: McpServer,
  client: SEClient,
  def: EndpointDef,
  options: RegisterOptions,
): void {
  const problems = endpointProblems(def);
  if (problems.length > 0) {
    throw new Error(`Invalid endpoint definition ${def.name}: ${problems.join("; ")}`);
  }

  const withChannel = hasChannel(def);
  const inputSchema: Record<string, ZodType> = {
    ...(withChannel
      ? { channel: z.string().optional().describe(def.channelDescription ?? DEFAULT_CHANNEL_DESCRIPTION) }
      : {}),
    ...def.input,
  };

  server.registerTool(
    def.name,
    { title: def.title, description: def.description, inputSchema, annotations: buildToolAnnotations(def) },
    async (args: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        const channel = withChannel ? ((args.channel as string | undefined) ?? (await client.getChannelId())) : undefined;
        const request = buildRequest(def, args, channel);
        const data = await client.request(request);
        return { content: [{ type: "text", text: formatResult(data, request, options.maxResponseChars) }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: formatToolError(error, TOOLSET_SCOPES[def.toolset]) }],
          isError: true,
        };
      }
    },
  );
}
