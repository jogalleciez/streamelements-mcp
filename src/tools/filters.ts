import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { jsonObject, objectId } from "./common.js";

const toolset = "filters";

export const filterEndpoints: EndpointDef[] = [
  {
    name: "filters_list",
    title: "Get spam filters",
    description:
      "Get the channel's spam filter configuration: the caps, links, emotes, symbols, paragraph and banphrases " +
      "filters (under botFilters), banned phrase groups, and activity-feed word filtering.",
    toolset,
    method: "GET",
    path: "/bot/filters/{channel}",
  },
  {
    name: "filters_update_settings",
    title: "Update spam filter document",
    description:
      "Replace the channel's spam filter document. The API documents the body as { banphrases, filter }. Get the " +
      "current document with filters_list, change it, and send it back. To change one filter, filters_update is simpler.",
    toolset,
    method: "PUT",
    path: "/bot/filters/{channel}",
    input: { settings: jsonObject("Filter document to save") },
    body: { from: "settings" },
  },
  {
    name: "filters_update",
    title: "Update one spam filter",
    description:
      "Update one bot spam filter. `settings` is that filter's object as returned under botFilters.<filter> by " +
      "filters_list, e.g. for caps: { \"enabled\": true, \"timeout\": { \"length\": 300 }, \"settings\": " +
      "{ \"limit\": 50, \"min\": 8, \"percent\": 60 }, \"exclude\": 300 }.",
    toolset,
    method: "PUT",
    path: "/bot/filters/{channel}/{filter}",
    input: {
      filter: z.enum(["caps", "links", "emotes", "symbols", "paragraph", "banphrases"]).describe("Which filter to update"),
      settings: jsonObject("The filter's full settings object"),
    },
    body: { from: "settings", as: "filter" },
  },
  {
    name: "filters_test_message",
    title: "Test message against filters",
    description:
      "Check whether a message would be caught by the channel's spam filters. StreamElements documents the body " +
      "only as { origin, data } with no further detail.",
    toolset,
    method: "POST",
    path: "/bot/filters/{channel}/test",
    input: {
      origin: z.unknown().describe("Where the message comes from, as StreamElements expects it (undocumented)"),
      data: z.unknown().describe("The message payload to test (undocumented; typically includes the message text)"),
    },
    body: ["origin", "data"],
    annotations: { readOnlyHint: true, destructiveHint: undefined, idempotentHint: undefined },
  },
  {
    name: "filters_banphrases_create",
    title: "Create banned phrase group",
    description: "Create a new, empty banned phrase group. Add phrases to it afterwards with filters_banphrases_update.",
    toolset,
    method: "POST",
    path: "/bot/filters/{channel}/banphrases",
    input: { name: z.string().min(1).describe("Group name") },
    body: ["name"],
  },
  {
    name: "filters_banphrases_update",
    title: "Update banned phrase group",
    description:
      "Update a banned phrase group (its name, phrases, enabled state and timeout). Send the group as returned in " +
      "filters_list's banphrases list, with your changes applied.",
    toolset,
    method: "PUT",
    path: "/bot/filters/{channel}/banphrases/{groupId}",
    input: { groupId: objectId("Banned phrase group id"), group: jsonObject("The banned phrase group to save") },
    body: { from: "group" },
  },
  {
    name: "filters_banphrases_delete",
    title: "Delete banned phrase group",
    description: "Permanently delete a banned phrase group and all of its phrases.",
    toolset,
    method: "DELETE",
    path: "/bot/filters/{channel}/banphrases/{groupId}",
    input: { groupId: objectId("Banned phrase group id") },
  },
  {
    name: "filters_banphrase_search",
    title: "Look up banned phrase",
    description: "Get the details of a banned phrase by its id.",
    toolset,
    method: "GET",
    path: "/bot/filters/banphrases/search",
    input: { id: objectId("Banned phrase id") },
    query: ["id"],
  },
];
