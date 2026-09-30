import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { datetime, jsonObject, limit, objectId, offset } from "./common.js";

const toolset = "activities";

const minimum = (what: string) => z.number().int().min(0).optional().describe(`Minimum ${what}`);

export const activityEndpoints: EndpointDef[] = [
  {
    name: "activities_list",
    title: "List activities",
    description:
      "List the channel's activity feed (follows, subs, tips, cheers, raids, hosts, redemptions and more), newest " +
      "first, filtered by type, date range and minimum amounts.",
    toolset,
    method: "GET",
    path: "/activities/{channel}",
    input: {
      types: z
        .array(z.string())
        .optional()
        .describe(
          "Activity types to include, e.g. follow, subscriber, tip, cheer, raid, host, redemption, superchat, sponsor, merch",
        ),
      after: datetime("Only activities after this time").optional(),
      before: datetime("Only activities before this time").optional(),
      limit: limit(100),
      mincheer: minimum("bits for cheers"),
      minhost: minimum("viewers for hosts"),
      minsub: minimum("months for subscriptions"),
      mintip: minimum("amount for tips"),
      origin: z.string().optional().describe("Origin filter (undocumented)"),
    },
    query: ["types", "after", "before", "limit", "mincheer", "minhost", "minsub", "mintip", "origin"],
  },
  {
    name: "activities_top",
    title: "List top activities",
    description: "List the channel's top cheerers or tippers for a period.",
    toolset,
    method: "GET",
    path: "/activities/{channel}/top",
    input: {
      type: z.enum(["cheer", "tip"]).describe("Rank cheers or tips"),
      period: z.enum(["alltime", "months", "weeks", "session"]).default("alltime").describe("Time period"),
      limit: limit(),
      offset: offset(),
    },
    query: ["type", "period", "limit", "offset"],
  },
  {
    name: "activities_get",
    title: "Get activity",
    description: "Get one activity by id.",
    toolset,
    method: "GET",
    path: "/activities/{channel}/{activityId}",
    input: { activityId: objectId("Activity id") },
  },
  {
    name: "activities_update",
    title: "Update activity",
    description:
      "Update an activity. StreamElements documents this endpoint only as 'Update activity' and gives no body " +
      "format; pass the fields to change in `changes`.",
    toolset,
    method: "POST",
    path: "/activities/{channel}/{activityId}",
    input: { activityId: objectId("Activity id"), changes: jsonObject("Fields to change").optional() },
    body: { from: "changes" },
  },
  {
    name: "activities_replay",
    title: "Replay activity alert",
    description: "Replay an activity's alert on the channel's overlays, e.g. to re-show a follow or tip alert on stream.",
    toolset,
    method: "POST",
    path: "/activities/{channel}/{activityId}/replay",
    input: { activityId: objectId("Activity id") },
  },
];
