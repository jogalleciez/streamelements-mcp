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
  it("registers all 137 tools by default", async () => {
    const mcp = await connect({});
    expect((await mcp.listTools()).tools).toHaveLength(137);
  });

  it("registers only the tools of the selected toolsets", async () => {
    const mcp = await connect({ SE_TOOLSETS: "themes,overlays" });
    const names = (await mcp.listTools()).tools.map((tool) => tool.name).sort();
    expect(names).toEqual([
      "overlays_action",
      "overlays_get",
      "overlays_list",
      "overlays_reload",
      "themes_get",
      "themes_list",
    ]);
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
