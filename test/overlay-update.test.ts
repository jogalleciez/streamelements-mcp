import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";
import { applyOverlayChanges, deepMerge } from "../src/tools/overlay-update.js";
import { connectClient, fakeFetch, jsonResponse, resultText } from "./helpers.js";

const CH = "5b2e2007760aeb7729487dab";
const ID = "5c0a53cede9a4c207fa14d90";
const URL_PATH = `https://api.streamelements.com/kappa/v2/overlays/${CH}/${ID}`;

type Widget = Record<string, unknown> & { css: Record<string, unknown> };

function overlay(): { name: string; settings: Record<string, unknown>; widgets: Widget[] } & Record<string, unknown> {
  return {
    _id: ID,
    channel: CH,
    type: "regular",
    name: "In Game",
    settings: { width: 1920, height: 1080, name: "1080p" },
    widgets: [
      {
        id: 1,
        type: "se-widget-custom-event-list",
        visible: true,
        css: { "z-index": 3, top: 0, left: 0, width: "290px" },
        variables: { fieldData: { apiToken: "secret-value", color: "#fff" } },
      },
      { id: 2, type: "se-widget-image", visible: true, css: { top: 100, left: 100 }, listeners: ["a", "b"] },
    ],
  };
}

describe("deepMerge", () => {
  it("merges nested objects and replaces everything else", () => {
    expect(deepMerge({ a: { b: 1, c: 2 }, list: [1, 2], x: 1 }, { a: { c: 3 }, list: [9], x: null })).toEqual({
      a: { b: 1, c: 3 },
      list: [9],
      x: null,
    });
  });
});

describe("applyOverlayChanges", () => {
  it("changes only the given widget fields and keeps the rest of the overlay", () => {
    const updated = applyOverlayChanges(overlay(), {
      name: "In Game v2",
      settings: { name: "1080p60" },
      widgets: [{ id: 1, changes: { css: { top: 40 }, visible: false } }],
    });
    const expected = overlay();
    expected.name = "In Game v2";
    expected.settings.name = "1080p60";
    expected.widgets[0] = { ...expected.widgets[0], visible: false, css: { ...expected.widgets[0].css, top: 40 } };
    expect(updated).toEqual(expected);
  });

  it("matches widget ids given as strings and never changes a widget's id", () => {
    const updated = applyOverlayChanges(overlay(), { widgets: [{ id: "2", changes: { id: 99, visible: false } }] });
    expect((updated.widgets as Array<{ id: unknown; visible: boolean }>)[1]).toMatchObject({ id: 2, visible: false });
  });

  it("rejects widget ids that are not on the overlay, listing the ones that are", () => {
    expect(() => applyOverlayChanges(overlay(), { widgets: [{ id: 7, changes: { visible: false } }] })).toThrow(
      "Widget id 7 is not on this overlay. Widgets on it: 1 (se-widget-custom-event-list), 2 (se-widget-image).",
    );
  });
});

describe("overlays_update tool", () => {
  async function connect(respond = () => jsonResponse(overlay())) {
    const fetch = fakeFetch(respond);
    const config = loadConfig({ SE_JWT_TOKEN: "jwt", SE_CHANNEL_ID: CH });
    const mcp = await connectClient(() => createServer(config, fetch));
    return { fetch, mcp };
  }

  it("fetches the overlay, then saves it with only the requested changes", async () => {
    const { fetch, mcp } = await connect();
    const result = await mcp.callTool({
      name: "overlays_update",
      arguments: { overlayId: ID, widgets: [{ id: 2, changes: { css: { left: 1500 } } }] },
    });
    expect(result.isError, resultText(result)).toBeFalsy();
    expect(fetch.calls.map((call) => [call.method, call.url])).toEqual([
      ["GET", URL_PATH],
      ["PUT", URL_PATH],
    ]);
    const expected = overlay();
    expected.widgets[1] = { ...expected.widgets[1], css: { top: 100, left: 1500 } };
    // Sent unredacted: the secret-looking field round-trips as the API returned it.
    expect(JSON.parse(fetch.calls[1].body ?? "")).toEqual(expected);
    expect(resultText(result)).toMatch(/^Updated overlay "In Game" \(5c0a53cede9a4c207fa14d90\): changed widgets 2\./);
  });

  it("writes nothing when a widget id is unknown", async () => {
    const { fetch, mcp } = await connect();
    const result = await mcp.callTool({
      name: "overlays_update",
      arguments: { overlayId: ID, widgets: [{ id: 5, changes: { visible: false } }] },
    });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toMatch(/^Error: Widget id 5 is not on this overlay/);
    expect(fetch.calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("calls nothing when there is nothing to change", async () => {
    const { fetch, mcp } = await connect();
    const result = await mcp.callTool({ name: "overlays_update", arguments: { overlayId: ID } });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toBe("Error: Nothing to change: pass name, settings or widgets.");
    expect(fetch.calls).toHaveLength(0);
  });

  it("rejects a dot-segment channel without calling the API", async () => {
    const { fetch, mcp } = await connect();
    const result = await mcp.callTool({ name: "overlays_update", arguments: { channel: "..", overlayId: ID, name: "X" } });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toMatch(/Invalid channel/);
    expect(fetch.calls).toHaveLength(0);
  });

  it("reports API errors from the read without writing", async () => {
    const { fetch, mcp } = await connect(() => jsonResponse({ message: "Overlay not found" }, 404, "Not Found"));
    const result = await mcp.callTool({ name: "overlays_update", arguments: { overlayId: ID, name: "X" } });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("Overlay not found");
    expect(fetch.calls).toHaveLength(1);
  });
});
