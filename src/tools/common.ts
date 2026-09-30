import { z } from "zod";

/** A StreamElements object id (24-character hex, a MongoDB ObjectId). */
export function objectId(what: string) {
  return z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, `${what} must be a 24-character hex id`)
    .describe(`${what} (24-character hex id)`);
}

export function limit(max?: number) {
  const base = z.number().int().min(1);
  return (max === undefined ? base : base.max(max))
    .default(25)
    .describe(max === undefined ? "Items per page" : `Items per page (1-${max})`);
}

export function offset() {
  return z.number().int().min(0).default(0).describe("Number of items to skip, for paging");
}

/** StreamElements accepts either epoch milliseconds or an ISO 8601 string. */
export function datetime(what: string) {
  return z.union([z.number().int(), z.string()]).describe(`${what}: Unix time in milliseconds or an ISO 8601 string`);
}

/** A free-form JSON object sent as-is, for documents the API does not specify field by field. */
export function jsonObject(description: string) {
  return z.record(z.string(), z.unknown()).describe(description);
}

export const username = (what = "Username") => z.string().min(1).describe(`${what} (login name, lowercase)`);

export const ACCESS_LEVELS =
  "StreamElements permission levels: 100 everyone, 250 subscriber, 300 regular, 400 VIP, 500 moderator, " +
  "1000 super moderator, 1500 broadcaster";

export const cooldown = z
  .object({
    user: z.number().int().min(0).describe("Per-user cooldown in seconds"),
    global: z.number().int().min(0).describe("Global cooldown in seconds"),
  })
  .describe("Cooldowns in seconds");
