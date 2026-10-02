import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { jsonObject, limit, offset } from "./common.js";

const toolset = "sessions";

export const sessionEndpoints: EndpointDef[] = [
  {
    name: "sessions_get",
    title: "Get session data",
    description:
      "Get the channel's session data: latest follower/subscriber/tip/cheer, and the session, week, month and " +
      "total counters that overlay widgets display.",
    toolset,
    method: "GET",
    path: "/sessions/{channel}",
  },
  {
    name: "sessions_update",
    title: "Update session data",
    description:
      "Overwrite session data values, e.g. to correct a counter shown on overlays. Send the fields to change, " +
      "keyed as they appear in sessions_get's data.",
    toolset,
    method: "PUT",
    path: "/sessions/{channel}",
    input: { data: jsonObject("Session data fields to save") },
    body: { from: "data" },
    annotations: { destructiveHint: true },
  },
  {
    name: "sessions_get_settings",
    title: "Get session settings",
    description: "Get the channel's session settings, such as when the session resets and which events count toward it.",
    toolset,
    method: "GET",
    path: "/sessions/{channel}/settings",
  },
  {
    name: "sessions_update_settings",
    title: "Update session settings",
    description: "Update the channel's session settings. Get the current settings with sessions_get_settings, change them, and send them back.",
    toolset,
    method: "PUT",
    path: "/sessions/{channel}/settings",
    input: { settings: jsonObject("Session settings to save") },
    body: { from: "settings" },
  },
  {
    name: "sessions_reset",
    title: "Reset session",
    description: "Reset the channel's session data (session counters and latest events). Cannot be undone.",
    toolset,
    method: "PUT",
    path: "/sessions/{channel}/reset",
    annotations: { destructiveHint: true },
  },
  {
    name: "sessions_top",
    title: "Get top session events",
    description: "Get the top events (e.g. biggest tips or cheers) aggregated over an interval.",
    toolset,
    method: "GET",
    path: "/sessions/{channel}/top",
    input: {
      type: z.string().default("tip").describe("Event type to rank, e.g. tip, cheer, stars or embers"),
      interval: z.enum(["alltime", "monthly", "weekly", "session"]).default("alltime").describe("Aggregation interval"),
      limit: limit(),
      offset: offset(),
    },
    query: ["type", "interval", "limit", "offset"],
  },
];
