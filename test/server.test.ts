import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";
import { connectClient, fakeFetch, jsonResponse, resultText, type FakeFetch } from "./helpers.js";

const CH = "5b2e2007760aeb7729487dab";

function connect(env: Record<string, string>, fetch: FakeFetch = fakeFetch()) {
  const config = loadConfig({ SE_JWT_TOKEN: "jwt", SE_CHANNEL_ID: CH, ...env });
  return connectClient(() => createServer(config, fetch));
}

describe("createServer", () => {
  it("registers all 140 tools by default (137 official, 3 undocumented overlay tools)", async () => {
    const mcp = await connect({});
    expect((await mcp.listTools()).tools).toHaveLength(140);
  });

  it("registers only the tools of the selected toolsets", async () => {
    const mcp = await connect({ SE_TOOLSETS: "themes,overlays" });
    const names = (await mcp.listTools()).tools.map((tool) => tool.name).sort();
    expect(names).toEqual([
      "overlays_action",
      "overlays_create",
      "overlays_delete",
      "overlays_get",
      "overlays_list",
      "overlays_reload",
      "overlays_update",
      "themes_get",
      "themes_list",
    ]);
  });

  it("registers only read-only tools in read-only mode", async () => {
    const mcp = await connect({ SE_TOOLSETS: "overlays,filters", SE_READ_ONLY: "true" });
    const { tools } = await mcp.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "filters_banphrase_search",
      "filters_list",
      "filters_test_message",
      "overlays_get",
      "overlays_list",
    ]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("marks tools that overwrite data as destructive", async () => {
    const mcp = await connect({});
    const destructive = new Set(
      (await mcp.listTools()).tools.filter((tool) => tool.annotations?.destructiveHint).map((tool) => tool.name),
    );
    for (const name of [
      "points_bulk_update",
      "filters_update_settings",
      "loyalty_update_settings",
      "sessions_update",
      "sessions_reset",
      "points_reset_all",
    ]) {
      expect(destructive.has(name), name).toBe(true);
    }
  });

  it("reports the package.json version", async () => {
    const mcp = await connect({});
    const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(mcp.getServerVersion()?.version).toBe(version);
  });

  it("calls giveaways on the v3 API for the configured channel", async () => {
    const fetch = fakeFetch(() => jsonResponse({ active: null, giveaways: [] }));
    const mcp = await connect({}, fetch);
    const result = await mcp.callTool({ name: "giveaways_list", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(fetch.calls[0].url).toBe(`https://api.streamelements.com/kappa/v3/giveaways/${CH}`);
  });

  it("sends a chat message as the bot", async () => {
    const fetch = fakeFetch(() => new Response(null, { status: 200 }));
    const mcp = await connect({}, fetch);
    const result = await mcp.callTool({ name: "bot_say", arguments: { message: "Hello chat!" } });
    expect(fetch.calls[0]).toMatchObject({
      method: "POST",
      url: `https://api.streamelements.com/kappa/v2/bot/${CH}/say`,
      body: '{"message":"Hello chat!"}',
    });
    expect(resultText(result)).toMatch(/^Success/);
  });

  it("rejects arguments that fail the input schema without calling the API", async () => {
    const fetch = fakeFetch();
    const mcp = await connect({}, fetch);
    const result = await mcp.callTool({ name: "overlays_action", arguments: { action: "explode" } });
    expect(result.isError).toBe(true);
    expect(fetch.calls).toHaveLength(0);
  });
});
