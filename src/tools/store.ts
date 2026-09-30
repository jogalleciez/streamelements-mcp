import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { cooldown, jsonObject, limit, objectId, offset } from "./common.js";

const toolset = "store";

const itemFields = {
  name: z.string().min(1).describe("Item name"),
  cost: z.number().int().min(0).describe("Price in loyalty points"),
  description: z.string().optional().describe("Item description"),
  type: z.string().optional().describe("Item type, e.g. 'perk' (default) or 'code' (delivers access codes)"),
  enabled: z.boolean().optional().describe("Whether the item can be redeemed"),
  public: z.boolean().optional().describe("Whether it shows on the public store page"),
  featured: z.boolean().optional().describe("Whether it is featured in the store"),
  subscriberOnly: z.boolean().optional().describe("Only subscribers can redeem it"),
  quantity: z.object({ total: z.number().int().describe("Stock; -1 for unlimited") }).optional(),
  cooldown: cooldown.optional(),
  bot: z
    .object({
      enabled: z.boolean().describe("Allow redeeming from chat"),
      identifier: z.string().describe("Word used with !redeem <identifier>"),
    })
    .optional()
    .describe("Chat redemption settings"),
  userInput: z.array(z.string()).optional().describe("Questions the viewer must answer when redeeming"),
  accessCodes: z
    .object({
      keys: z.array(z.string()).describe("Codes to hand out"),
      mode: z.string().optional().describe("Code handout mode, e.g. 'multi'"),
      random: z.boolean().optional().describe("Hand out codes in random order"),
    })
    .optional()
    .describe("Access codes, for 'code' items"),
  alert: jsonObject("On-stream alert settings (graphics, audio, enabled)").optional(),
};

const itemBody = Object.keys(itemFields);

const optionalItemFields = Object.fromEntries(Object.entries(itemFields).map(([key, schema]) => [key, schema.optional()]));

export const storeEndpoints: EndpointDef[] = [
  {
    name: "store_items_list",
    title: "List store items",
    description: "List the channel's loyalty store items (name, cost, stock, cooldowns, redemption settings).",
    toolset,
    method: "GET",
    path: "/store/{channel}/items",
    input: { limit: limit(), offset: offset() },
    query: ["limit", "offset"],
  },
  {
    name: "store_items_create",
    title: "Create store item",
    description: "Add an item that viewers can redeem with loyalty points.",
    toolset,
    method: "POST",
    path: "/store/{channel}/items",
    input: itemFields,
    body: itemBody,
  },
  {
    name: "store_items_get",
    title: "Get store item",
    description: "Get one store item by id.",
    toolset,
    method: "GET",
    path: "/store/{channel}/items/{itemId}",
    input: { itemId: objectId("Item id") },
  },
  {
    name: "store_items_update",
    title: "Update store item",
    description:
      "Update a store item. The API may treat this as a full replacement, so the safest approach is to send every " +
      "field from store_items_get with your changes applied.",
    toolset,
    method: "PUT",
    path: "/store/{channel}/items/{itemId}",
    input: { itemId: objectId("Item id"), ...optionalItemFields },
    body: itemBody,
  },
  {
    name: "store_items_delete",
    title: "Delete store item",
    description: "Permanently delete a store item.",
    toolset,
    method: "DELETE",
    path: "/store/{channel}/items/{itemId}",
    input: { itemId: objectId("Item id") },
  },
  {
    name: "store_redemptions_list",
    title: "List redemptions",
    description: "List store redemptions, newest first. Set pending=true to see only redemptions still to be fulfilled.",
    toolset,
    method: "GET",
    path: "/store/{channel}/redemptions",
    input: {
      limit: limit(),
      offset: offset(),
      pending: z.boolean().optional().describe("true: only pending redemptions"),
    },
    query: ["limit", "offset", "pending"],
  },
  {
    name: "store_redemptions_search",
    title: "Search redemptions",
    description: "Search store redemptions by text, with optional date range, pending filter and sort.",
    toolset,
    method: "GET",
    path: "/store/{channel}/redemptions/search",
    input: {
      search: z.string().optional().describe("Text to search for"),
      searchBy: z.string().optional().describe("Field to search in, e.g. username or item name (undocumented values)"),
      from: z.string().optional().describe("Start of date range (ISO 8601)"),
      to: z.string().optional().describe("End of date range (ISO 8601)"),
      pending: z.boolean().optional().describe("true: only pending redemptions"),
      sort: z.string().optional().describe("Sort field, e.g. createdAt or -createdAt"),
      limit: limit(),
      offset: offset(),
    },
    query: ["search", "searchBy", "from", "to", "pending", "sort", "limit", "offset"],
  },
  {
    name: "store_redemptions_mine",
    title: "List my redemptions",
    description: "List the store redemptions made by the token owner on this channel.",
    toolset,
    method: "GET",
    path: "/store/{channel}/redemptions/me",
    input: { limit: limit(), offset: offset() },
    query: ["limit", "offset"],
  },
  {
    name: "store_redemptions_get",
    title: "Get redemption",
    description: "Get one store redemption by id, including the viewer's answers to the item's questions.",
    toolset,
    method: "GET",
    path: "/store/{channel}/redemptions/{redemptionId}",
    input: { redemptionId: objectId("Redemption id") },
  },
  {
    name: "store_redemptions_update",
    title: "Update redemption",
    description: "Update a store redemption, e.g. { \"completed\": true } to mark it fulfilled.",
    toolset,
    method: "PUT",
    path: "/store/{channel}/redemptions/{redemptionId}",
    input: { redemptionId: objectId("Redemption id"), changes: jsonObject("Fields to update, e.g. { \"completed\": true }") },
    body: { from: "changes" },
  },
  {
    name: "store_redemptions_delete",
    title: "Delete redemption",
    description: "Permanently delete a store redemption record.",
    toolset,
    method: "DELETE",
    path: "/store/{channel}/redemptions/{redemptionId}",
    input: { redemptionId: objectId("Redemption id") },
  },
];
