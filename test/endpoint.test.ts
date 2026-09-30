import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SEClient } from "../src/client.js";
import {
  buildRequest,
  buildToolAnnotations,
  endpointProblems,
  registerEndpoint,
  type EndpointDef,
} from "../src/endpoint.js";
import { connectClient, fakeFetch, jsonResponse, resultText, type FakeFetch } from "./helpers.js";

const CH = "5b2e2007760aeb7729487dab";

function def(overrides: Partial<EndpointDef> = {}): EndpointDef {
  return {
    name: "commands_get",
    title: "Get command",
    description: "Get one custom command.",
    toolset: "commands",
    method: "GET",
    path: "/bot/commands/{channel}/{commandId}",
    input: { commandId: z.string().describe("Command id") },
    ...overrides,
  };
}

describe("buildRequest", () => {
  it("fills path placeholders with URL-encoded values", () => {
    const request = buildRequest(def(), { commandId: "a b/c" }, CH);
    expect(request.path).toBe(`/bot/commands/${CH}/a%20b%2Fc`);
  });

  it("fills numeric placeholders, keeping negative numbers", () => {
    const points = def({
      method: "PUT",
      path: "/points/{channel}/{user}/{amount}",
      input: { user: z.string(), amount: z.number().int() },
    });
    expect(buildRequest(points, { user: "viewer", amount: -50 }, CH).path).toBe(`/points/${CH}/viewer/-50`);
  });

  it("sends only the declared query keys as the query", () => {
    const list = def({
      path: "/activities/{channel}",
      input: { limit: z.number(), types: z.array(z.string()) },
      query: ["limit", "types"],
    });
    expect(buildRequest(list, { limit: 5, types: ["tip"] }, CH)).toEqual({
      method: "GET",
      path: `/activities/${CH}`,
      version: "v2",
      query: { limit: 5, types: ["tip"] },
      body: undefined,
    });
  });

  it("builds a body from the declared fields, leaving out undefined ones", () => {
    const say = def({
      method: "POST",
      path: "/bot/{channel}/say",
      input: { message: z.string(), mode: z.string().optional() },
      body: ["message", "mode"],
    });
    expect(buildRequest(say, { message: "hello" }, CH).body).toEqual({ message: "hello" });
  });

  it("uses a single input as the whole body for { from }", () => {
    const update = def({
      method: "PUT",
      path: "/loyalty/{channel}",
      input: { settings: z.record(z.string(), z.unknown()) },
      body: { from: "settings" },
    });
    expect(buildRequest(update, { settings: { enabled: true, name: "pts" } }, CH).body).toEqual({
      enabled: true,
      name: "pts",
    });
  });

  it("wraps a single input under another key for { from, as }", () => {
    const update = def({
      method: "PUT",
      path: "/bot/filters/{channel}/{filter}",
      input: { filter: z.string(), settings: z.record(z.string(), z.unknown()) },
      body: { from: "settings", as: "filter" },
    });
    const request = buildRequest(update, { filter: "caps", settings: { enabled: true } }, CH);
    expect(request.path).toBe(`/bot/filters/${CH}/caps`);
    expect(request.body).toEqual({ filter: { enabled: true } });
  });

  it("allows a plain input named channel when the path has no {channel}", () => {
    const search = def({
      name: "chatstats_search",
      path: "/chatstats/search",
      input: { channel: z.string() },
      query: ["channel"],
    });
    expect(endpointProblems(search)).toEqual([]);
    expect(buildRequest(search, { channel: "somestreamer" }).query).toEqual({ channel: "somestreamer" });
  });

  it("sends no body when none is declared", () => {
    expect(buildRequest(def(), { commandId: "1" }, CH).body).toBeUndefined();
  });

  it("passes the API version through", () => {
    const giveaway = def({ path: "/giveaways/{channel}", input: {}, version: "v3" });
    expect(buildRequest(giveaway, {}, CH).version).toBe("v3");
  });
});

describe("endpointProblems", () => {
  it("accepts a consistent definition", () => {
    expect(endpointProblems(def())).toEqual([]);
  });

  it("flags a path placeholder with no matching input", () => {
    expect(endpointProblems(def({ input: {} }))).toEqual(['path placeholder {commandId} has no input']);
  });

  it("flags an input that is never sent", () => {
    expect(endpointProblems(def({ input: { commandId: z.string(), extra: z.string() } }))).toEqual([
      'input "extra" is not used in the path, query or body',
    ]);
  });

  it("flags query and body keys that are not inputs", () => {
    expect(endpointProblems(def({ query: ["limit"], body: ["reply"] }))).toEqual([
      'query key "limit" is not an input',
      'body key "reply" is not an input',
    ]);
  });

  it("flags a { from } body that is not an input", () => {
    expect(endpointProblems(def({ method: "PUT", body: { from: "settings" } }))).toEqual([
      'body key "settings" is not an input',
    ]);
  });

  it("flags an input sent in two places", () => {
    expect(endpointProblems(def({ input: { commandId: z.string() }, query: ["commandId"] }))).toEqual([
      'input "commandId" is sent in more than one place',
    ]);
  });

  it("reserves the channel input", () => {
    expect(endpointProblems(def({ input: { commandId: z.string(), channel: z.string() } }))).toContain(
      'input "channel" is reserved; it is added automatically for {channel} paths',
    );
  });

  it("flags names that are not snake_case or too long", () => {
    expect(endpointProblems(def({ name: "Commands-Get" }))).toEqual(['name "Commands-Get" must match ^[a-z][a-z0-9_]{0,39}$']);
    expect(endpointProblems(def({ name: `a${"b".repeat(40)}` }))).toHaveLength(1);
  });
});

describe("buildToolAnnotations", () => {
  it("marks GET tools read-only", () => {
    expect(buildToolAnnotations(def())).toEqual({ title: "Get command", readOnlyHint: true, openWorldHint: true });
  });

  it("marks POST tools as non-destructive, non-idempotent writes", () => {
    expect(buildToolAnnotations(def({ method: "POST" }))).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    });
  });

  it("marks PUT tools as idempotent, non-destructive writes", () => {
    expect(buildToolAnnotations(def({ method: "PUT" }))).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    });
  });

  it("marks DELETE tools destructive", () => {
    expect(buildToolAnnotations(def({ method: "DELETE" }))).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  });

  it("applies per-endpoint overrides", () => {
    expect(
      buildToolAnnotations(def({ method: "PUT", annotations: { destructiveHint: true, idempotentHint: false } })),
    ).toMatchObject({ destructiveHint: true, idempotentHint: false });
  });
});

describe("registerEndpoint", () => {
  async function setup(
    endpoint: EndpointDef,
    fetch: FakeFetch,
    { channelId, maxResponseChars = 100000 }: { channelId?: string; maxResponseChars?: number } = {},
  ) {
    const client = new SEClient({ auth: { type: "jwt", token: "t" }, channelId, timeoutMs: 1000 }, fetch);
    return connectClient((server) => registerEndpoint(server, client, endpoint, { maxResponseChars }));
  }

  it("exposes an optional channel input for {channel} paths", async () => {
    const mcp = await setup(def(), fakeFetch());
    const [tool] = (await mcp.listTools()).tools;
    expect(tool.name).toBe("commands_get");
    expect(tool.description).toBe("Get one custom command.");
    expect(Object.keys(tool.inputSchema.properties ?? {}).sort()).toEqual(["channel", "commandId"]);
    expect(tool.inputSchema.required).toEqual(["commandId"]);
    expect(tool.annotations).toMatchObject({ readOnlyHint: true });
  });

  it("has no channel input when the path has no {channel}", async () => {
    const mcp = await setup(def({ name: "themes_get", path: "/themes/{themeId}", input: { themeId: z.string() } }), fakeFetch());
    const [tool] = (await mcp.listTools()).tools;
    expect(Object.keys(tool.inputSchema.properties ?? {})).toEqual(["themeId"]);
  });

  it("defaults the channel to the authenticated channel", async () => {
    const fetch = fakeFetch((url) =>
      url.endsWith("/channels/me") ? jsonResponse({ _id: CH }) : jsonResponse({ _id: "cmd1", command: "hi" }),
    );
    const mcp = await setup(def(), fetch);
    const result = await mcp.callTool({ name: "commands_get", arguments: { commandId: "cmd1" } });
    expect(fetch.calls.map((c) => c.url)).toEqual([
      "https://api.streamelements.com/kappa/v2/channels/me",
      `https://api.streamelements.com/kappa/v2/bot/commands/${CH}/cmd1`,
    ]);
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(resultText(result))).toEqual({ _id: "cmd1", command: "hi" });
  });

  it("uses an explicit channel without looking one up", async () => {
    const fetch = fakeFetch();
    const mcp = await setup(def(), fetch);
    await mcp.callTool({ name: "commands_get", arguments: { commandId: "c", channel: "aaaaaaaaaaaaaaaaaaaaaaaa" } });
    expect(fetch.calls.map((c) => c.url)).toEqual([
      "https://api.streamelements.com/kappa/v2/bot/commands/aaaaaaaaaaaaaaaaaaaaaaaa/c",
    ]);
  });

  it("pretty-prints JSON results", async () => {
    const mcp = await setup(def(), fakeFetch(() => jsonResponse({ a: 1 })), { channelId: CH });
    const result = await mcp.callTool({ name: "commands_get", arguments: { commandId: "c" } });
    expect(resultText(result)).toBe('{\n  "a": 1\n}');
  });

  it("reports success for an empty response", async () => {
    const mcp = await setup(def({ method: "DELETE" }), fakeFetch(() => new Response(null, { status: 204 })), {
      channelId: CH,
    });
    const result = await mcp.callTool({ name: "commands_get", arguments: { commandId: "c" } });
    expect(resultText(result)).toBe("Success (DELETE /bot/commands/5b2e2007760aeb7729487dab/c returned no content).");
  });

  it("truncates long responses with a note", async () => {
    const mcp = await setup(def(), fakeFetch(() => new Response("x".repeat(50), { status: 200 })), {
      channelId: CH,
      maxResponseChars: 10,
    });
    const text = resultText(await mcp.callTool({ name: "commands_get", arguments: { commandId: "c" } }));
    expect(text.startsWith("xxxxxxxxxx\n")).toBe(true);
    expect(text).toMatch(/Truncated: showing 10 of 50 characters/);
  });

  it("returns API failures as tool errors with the toolset's scope hint", async () => {
    const mcp = await setup(def(), fakeFetch(() => jsonResponse({ message: "Forbidden" }, 403, "Forbidden")), {
      channelId: CH,
    });
    const result = await mcp.callTool({ name: "commands_get", arguments: { commandId: "c" } });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toMatch(/403 Forbidden on GET .*bot:read \/ bot:write/s);
  });

  it("returns channel lookup failures as tool errors", async () => {
    const mcp = await setup(def(), fakeFetch(() => jsonResponse({ message: "bad token" }, 401, "Unauthorized")));
    const result = await mcp.callTool({ name: "commands_get", arguments: { commandId: "c" } });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toMatch(/401 Unauthorized on GET \/channels\/me/);
  });

  it("refuses to register an inconsistent definition", async () => {
    const client = new SEClient({ auth: { type: "jwt", token: "t" }, timeoutMs: 1000 }, fakeFetch());
    await expect(
      connectClient((server) => registerEndpoint(server, client, def({ input: {} }), { maxResponseChars: 10 })),
    ).rejects.toThrow(/commands_get.*\{commandId\} has no input/);
  });
});
