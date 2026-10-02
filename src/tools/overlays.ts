import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { objectId } from "./common.js";

const toolset = "overlays";

export const overlayEndpoints: EndpointDef[] = [
  {
    name: "overlays_list",
    title: "List overlays",
    description: "List the channel's overlays, optionally filtered by name or type.",
    toolset,
    method: "GET",
    path: "/overlays/{channel}",
    input: {
      search: z.string().optional().describe("Text to match in overlay names"),
      type: z.string().optional().describe("Overlay type filter (StreamElements' example value is 'tip')"),
    },
    query: ["search", "type"],
  },
  {
    name: "overlays_get",
    title: "Get overlay",
    description: "Get one overlay with all of its widgets and their settings. Responses can be large.",
    toolset,
    method: "GET",
    path: "/overlays/{channel}/{overlayId}",
    input: { overlayId: objectId("Overlay id") },
  },
  {
    name: "overlays_reload",
    title: "Reload overlays",
    description: "Reload all of the channel's overlays, like refreshing every overlay browser source.",
    toolset,
    method: "PUT",
    path: "/overlays/{channel}/reload",
  },
  {
    name: "overlays_action",
    title: "Control overlay alerts",
    description: "Control alerts on the channel's overlays: pause or play the alert queue, mute or unmute alert sounds, or reload.",
    toolset,
    method: "PUT",
    path: "/overlays/{channel}/action/{action}",
    input: { action: z.enum(["reload", "mute", "unmute", "pause", "play"]).describe("Action to apply") },
  },
  {
    name: "overlays_create",
    title: "Create overlay",
    description:
      "Create a new overlay on the channel, empty by default. Undocumented endpoint: not in the official API " +
      "reference, so it may change without notice. To copy an overlay, pass the widgets from overlays_get.",
    toolset,
    method: "POST",
    path: "/overlays/{channel}",
    input: {
      name: z.string().min(1).describe("Overlay name"),
      settings: z
        .object({
          width: z.number().int().positive().describe("Canvas width in pixels"),
          height: z.number().int().positive().describe("Canvas height in pixels"),
          name: z.string().describe("Resolution label, e.g. '1080p'"),
        })
        .default({ width: 1920, height: 1080, name: "1080p" })
        .describe("Canvas size (default 1920x1080)"),
      widgets: z.array(z.record(z.string(), z.unknown())).default([]).describe("Widget objects (default none)"),
    },
    body: ["name", "settings", "widgets"],
    unofficial: true,
  },
  {
    name: "overlays_delete",
    title: "Delete overlay",
    description:
      "Permanently delete an overlay and all of its widgets. Browser sources pointing at it stop working. " +
      "Undocumented endpoint: not in the official API reference, so it may change without notice.",
    toolset,
    method: "DELETE",
    path: "/overlays/{channel}/{overlayId}",
    input: { overlayId: objectId("Overlay id") },
    unofficial: true,
  },
];
