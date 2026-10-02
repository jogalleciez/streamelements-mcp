import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { datetime, jsonObject, limit, offset, username } from "./common.js";

const toolset = "loyalty";

const viewer = username("Viewer username");

export const loyaltyEndpoints: EndpointDef[] = [
  {
    name: "loyalty_get_settings",
    title: "Get loyalty settings",
    description:
      "Get the channel's loyalty (points) settings: currency name, points per interval (amount), subscriber " +
      "multiplier, per-event bonuses (follow, tip, subscriber, cheer, host) and ignored users.",
    toolset,
    method: "GET",
    path: "/loyalty/{channel}",
  },
  {
    name: "loyalty_update_settings",
    title: "Update loyalty settings",
    description:
      "Update the channel's loyalty settings. StreamElements does not document the body. Send the document shape " +
      "returned by loyalty_get_settings (at least its `loyalty` object) with your changes applied.",
    toolset,
    method: "PUT",
    path: "/loyalty/{channel}",
    input: { settings: jsonObject("Loyalty settings document, e.g. { \"loyalty\": { \"name\": \"gems\", \"amount\": 5, ... } }") },
    body: { from: "settings" },
    annotations: { destructiveHint: true },
  },
  {
    name: "loyalty_stats",
    title: "Get channel stats",
    description: "Get the channel's StreamElements statistics for a period (year, month, week or day) around a date.",
    toolset,
    method: "GET",
    path: "/stats/{channel}",
    input: {
      interval: z.enum(["year", "month", "week", "day"]).describe("Length of the period"),
      date: datetime("A date inside the period"),
      tz: z.number().int().optional().describe("StreamElements timezone index"),
    },
    query: ["interval", "date", "tz"],
  },
  {
    name: "points_get_user",
    title: "Get viewer points",
    description: "Get a viewer's current points, all-time points and watchtime on the channel.",
    toolset,
    method: "GET",
    path: "/points/{channel}/{user}",
    input: { user: viewer },
  },
  {
    name: "points_get_user_rank",
    title: "Get viewer rank",
    description: "Get a viewer's rank on the channel's points leaderboard.",
    toolset,
    method: "GET",
    path: "/points/{channel}/{user}/rank",
    input: { user: viewer },
  },
  {
    name: "points_add",
    title: "Add or remove viewer points",
    description: "Add points to a viewer's current balance, or remove points with a negative amount.",
    toolset,
    method: "PUT",
    path: "/points/{channel}/{user}/{amount}",
    input: {
      user: viewer,
      amount: z.number().int().describe("Points to add; negative to remove"),
    },
    annotations: { idempotentHint: false },
  },
  {
    name: "points_reset_user",
    title: "Reset viewer points",
    description: "Reset a viewer's current points by removing them from the points table. Cannot be undone.",
    toolset,
    method: "DELETE",
    path: "/points/{channel}/{user}",
    input: { user: viewer },
  },
  {
    name: "points_add_alltime",
    title: "Adjust viewer all-time points",
    description: "Add to a viewer's all-time points total, or subtract with a negative amount.",
    toolset,
    method: "PUT",
    path: "/points/{channel}/alltime/{user}/{amount}",
    input: {
      user: viewer,
      amount: z.number().int().describe("All-time points to add; negative to remove"),
    },
    annotations: { idempotentHint: false },
  },
  {
    name: "points_reset_user_alltime",
    title: "Reset viewer all-time points",
    description: "Reset a viewer's all-time points. Cannot be undone.",
    toolset,
    method: "DELETE",
    path: "/points/{channel}/alltime/{user}",
    input: { user: viewer },
  },
  {
    name: "points_list_alltime",
    title: "List all-time points",
    description: "List viewers ranked by all-time points.",
    toolset,
    method: "GET",
    path: "/points/{channel}/alltime",
    input: { limit: limit(), offset: offset() },
    query: ["limit", "offset"],
  },
  {
    name: "points_list_top",
    title: "List top points",
    description: "List viewers ranked by current points (the points leaderboard).",
    toolset,
    method: "GET",
    path: "/points/{channel}/top",
    input: { limit: limit(), offset: offset() },
    query: ["limit", "offset"],
  },
  {
    name: "points_list_watchtime",
    title: "List watchtime",
    description: "List viewers ranked by watchtime.",
    toolset,
    method: "GET",
    path: "/points/{channel}/watchtime",
    input: { limit: limit(), offset: offset() },
    query: ["limit", "offset"],
  },
  {
    name: "points_bulk_update",
    title: "Bulk add or set points",
    description: "Change points for many viewers at once. mode 'add' adds each amount to the balance; 'set' replaces the balance.",
    toolset,
    method: "PUT",
    path: "/points/{channel}",
    input: {
      users: z
        .array(
          z.object({
            username: z.string().min(1).describe("Viewer username"),
            current: z.number().int().describe("Points to add (mode add) or the new balance (mode set)"),
          }),
        )
        .min(1)
        .describe("Viewers and amounts"),
      mode: z.enum(["add", "set"]).describe("add: add to balances; set: replace balances"),
    },
    body: ["users", "mode"],
    // mode "set" overwrites balances.
    annotations: { destructiveHint: true, idempotentHint: false },
  },
  {
    name: "points_reset_all",
    title: "Reset all points",
    description:
      "Reset the points of EVERY viewer on the channel for a leaderboard context. Cannot be undone. Only run it " +
      "if the user explicitly asks.",
    toolset,
    method: "DELETE",
    path: "/points/{channel}/reset/{context}",
    input: {
      context: z.string().min(1).describe("Which points to reset, e.g. 'current' or 'alltime' (the dashboard's reset options)"),
    },
  },
];
