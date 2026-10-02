import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { SEClient } from "../client.js";
import { DEFAULT_CHANNEL_DESCRIPTION, pathSegment } from "../endpoint.js";
import { formatToolError } from "../errors.js";
import { TOOLSET_SCOPES } from "../toolsets.js";
import { objectId } from "./common.js";

type JsonObject = Record<string, unknown>;

export interface WidgetChange {
  id: string | number;
  changes: JsonObject;
}

export interface OverlayChanges {
  name?: string;
  settings?: JsonObject;
  widgets?: WidgetChange[];
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Merges `patch` into `target`: nested objects merge key by key, anything else (arrays included) replaces. */
export function deepMerge(target: JsonObject, patch: JsonObject): JsonObject {
  const merged: JsonObject = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    const current = merged[key];
    merged[key] = isPlainObject(value) && isPlainObject(current) ? deepMerge(current, value) : value;
  }
  return merged;
}

function describeWidgets(widgets: JsonObject[]): string {
  if (widgets.length === 0) {
    return "none";
  }
  return widgets.map((widget) => `${String(widget.id)} (${String(widget.type ?? "unknown type")})`).join(", ");
}

/**
 * Applies `changes` to a full overlay document as returned by GET, keeping everything else as-is.
 * Throws when a widget id is not on the overlay, so nothing is written.
 */
export function applyOverlayChanges(overlay: JsonObject, changes: OverlayChanges): JsonObject {
  const widgets = Array.isArray(overlay.widgets) ? (overlay.widgets as JsonObject[]) : [];
  const widgetChanges = changes.widgets ?? [];
  const ids = new Set(widgets.map((widget) => String(widget.id)));
  const missing = widgetChanges.map((change) => String(change.id)).filter((id) => !ids.has(id));
  if (missing.length > 0) {
    throw new Error(
      `Widget id ${missing.join(", ")} is not on this overlay. Widgets on it: ${describeWidgets(widgets)}.`,
    );
  }

  const updated: JsonObject = { ...overlay };
  if (changes.name !== undefined) {
    updated.name = changes.name;
  }
  if (changes.settings !== undefined) {
    updated.settings = deepMerge(isPlainObject(overlay.settings) ? overlay.settings : {}, changes.settings);
  }
  if (widgetChanges.length > 0) {
    updated.widgets = widgets.map((widget) =>
      widgetChanges
        .filter((change) => String(change.id) === String(widget.id))
        .reduce((merged, change) => ({ ...deepMerge(merged, change.changes), id: widget.id }), widget),
    );
  }
  return updated;
}

const inputSchema = {
  channel: z.string().optional().describe(DEFAULT_CHANNEL_DESCRIPTION),
  overlayId: objectId("Overlay id"),
  name: z.string().min(1).optional().describe("New overlay name"),
  settings: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Canvas settings to change, merged into the current ones, e.g. { width: 2560, height: 1440, name: '1440p' }"),
  widgets: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).describe("Widget id, the `id` field of the widget in overlays_get"),
        changes: z
          .record(z.string(), z.unknown())
          .describe(
            "Fields to change, deep-merged into the widget: nested objects merge key by key, other values " +
              "(arrays included) replace. E.g. { visible: false } or { css: { top: 40, left: 1500 } }",
          ),
      }),
    )
    .optional()
    .describe("Changes to individual widgets. Widgets not listed are left as they are."),
};

const DESCRIPTION =
  "Change an overlay's name, canvas settings or individual widgets (position, size, visibility, text, colors " +
  "and other widget fields). Fetches the current overlay, applies only the given changes and saves it back, so " +
  "widgets you don't mention are kept intact. Use overlays_get first to find widget ids and field names. " +
  "Undocumented endpoint (PUT /overlays/{channel}/{overlayId}): not in the official API reference, so it may " +
  "change without notice.";

/** Registers `overlays_update`, a read-modify-write over GET and PUT /overlays/{channel}/{overlayId}. */
export function registerOverlayUpdate(server: McpServer, client: SEClient): void {
  server.registerTool(
    "overlays_update",
    {
      title: "Update overlay",
      description: DESCRIPTION,
      inputSchema,
      annotations: {
        title: "Update overlay",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args): Promise<CallToolResult> => {
      try {
        const changed = [
          args.name !== undefined ? "name" : undefined,
          args.settings !== undefined ? "settings" : undefined,
          args.widgets?.length ? `widgets ${args.widgets.map((widget) => String(widget.id)).join(", ")}` : undefined,
        ].filter((part) => part !== undefined);
        if (changed.length === 0) {
          throw new Error("Nothing to change: pass name, settings or widgets.");
        }
        const channel = args.channel ?? (await client.getChannelId());
        const path = `/overlays/${pathSegment("channel", channel)}/${pathSegment("overlayId", args.overlayId)}`;
        const current = await client.request<JsonObject>({ method: "GET", path });
        const updated = applyOverlayChanges(current, args);
        await client.request({ method: "PUT", path, body: updated });
        return {
          content: [
            {
              type: "text",
              text:
                `Updated overlay "${String(updated.name)}" (${args.overlayId}): changed ${changed.join("; ")}. ` +
                "If an open browser source doesn't show the change, run overlays_reload.",
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: formatToolError(error, TOOLSET_SCOPES.overlays) }], isError: true };
      }
    },
  );
}
