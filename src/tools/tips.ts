import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { datetime, limit, objectId, offset } from "./common.js";

const toolset = "tips";

export const tipEndpoints: EndpointDef[] = [
  {
    name: "tips_list",
    title: "List tips",
    description: "List the channel's tips (donations), with optional filters by date range, tipper, email and message.",
    toolset,
    method: "GET",
    path: "/tips/{channel}",
    input: {
      limit: limit(100),
      offset: offset(),
      sort: z
        .enum(["createdAt", "-createdAt", "donation.amount", "-donation.amount", "donation.provider", "-donation.provider"])
        .default("-createdAt")
        .describe("Sort order; a leading - means descending"),
      after: datetime("Only tips after this time").optional(),
      before: datetime("Only tips before this time").optional(),
      username: z.string().optional().describe("Only tips from this username"),
      email: z.string().optional().describe("Only tips from this email address"),
      message: z.string().optional().describe("Only tips whose message matches this text"),
      tz: z.number().int().optional().describe("StreamElements timezone index"),
    },
    query: ["limit", "offset", "sort", "after", "before", "username", "email", "message", "tz"],
  },
  {
    name: "tips_create",
    title: "Record a tip",
    description:
      "Create a tip record on the channel, e.g. to import a donation received elsewhere. This writes to the " +
      "channel's real tip history.",
    toolset,
    method: "POST",
    path: "/tips/{channel}",
    input: {
      user: z
        .object({
          username: z.string().min(1).describe("Tipper's name"),
          email: z.string().optional().describe("Tipper's email"),
          userId: z.string().optional().describe("Tipper's user id, if known"),
        })
        .describe("Who sent the tip"),
      amount: z.number().positive().describe("Tip amount"),
      currency: z.string().regex(/^[A-Z]{3}$/, "currency must be a 3-letter ISO code").describe("ISO currency code, e.g. USD"),
      message: z.string().optional().describe("Tip message"),
      provider: z.string().optional().describe("Payment provider the tip came through, e.g. paypal"),
      imported: z.boolean().optional().describe("Mark the tip as imported from another service"),
    },
    body: ["user", "amount", "currency", "message", "provider", "imported"],
  },
  {
    name: "tips_top",
    title: "List top tippers",
    description: "List the channel's top tippers with tip count, total, average, and first/last tip dates.",
    toolset,
    method: "GET",
    path: "/tips/{channel}/top",
  },
  {
    name: "tips_leaderboard",
    title: "Get tips leaderboard",
    description: "Get the channel's tips leaderboard.",
    toolset,
    method: "GET",
    path: "/tips/{channel}/leaderboard",
  },
  {
    name: "tips_moderation_list",
    title: "List tips awaiting moderation",
    description: "List tips held for moderation before they are shown on stream.",
    toolset,
    method: "GET",
    path: "/tips/{channel}/moderation",
  },
  {
    name: "tips_get",
    title: "Get tip",
    description: "Get one tip by id, with the tipper, amount, currency, message and status.",
    toolset,
    method: "GET",
    path: "/tips/{channel}/{tipId}",
    input: { tipId: objectId("Tip id") },
  },
];
