import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";
import { connectClient, fakeFetch, type RecordedCall } from "./helpers.js";

const CH = "5b2e2007760aeb7729487dab";
const ID = "5c0a53cede9a4c207fa14d90";
const V2 = "/kappa/v2";
const V3 = "/kappa/v3";

interface Expected {
  method: string;
  path: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
}

function describeCall(call: RecordedCall): Expected {
  const url = new URL(call.url);
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  return {
    method: call.method,
    path: url.pathname,
    ...(Object.keys(query).length ? { query } : {}),
    ...(call.body !== undefined ? { body: JSON.parse(call.body) } : {}),
  };
}

const cases: Array<[tool: string, args: Record<string, unknown>, expected: Expected]> = [
  [
    "commands_create",
    { command: "discord", reply: "Join: discord.gg/x", cooldown: { user: 30, global: 5 }, accessLevel: 100 },
    {
      method: "POST",
      path: `${V2}/bot/commands/${CH}`,
      body: { command: "discord", reply: "Join: discord.gg/x", cooldown: { user: 30, global: 5 }, accessLevel: 100 },
    },
  ],
  ["commands_list_default", {}, { method: "GET", path: `${V2}/bot/commands/${CH}/default`, query: { language: "en" } }],
  [
    "commands_update_default",
    { commandId: "points", settings: { enabled: false } },
    { method: "PUT", path: `${V2}/bot/commands/${CH}/default/points`, body: { enabled: false } },
  ],
  [
    "timers_update",
    { timerId: ID, message: "Follow the socials!" },
    { method: "PUT", path: `${V2}/bot/timers/${CH}/${ID}`, body: { message: "Follow the socials!" } },
  ],
  [
    "filters_update",
    { filter: "caps", settings: { enabled: true, exclude: 300 } },
    { method: "PUT", path: `${V2}/bot/filters/${CH}/caps`, body: { filter: { enabled: true, exclude: 300 } } },
  ],
  [
    "filters_banphrase_search",
    { id: ID },
    { method: "GET", path: `${V2}/bot/filters/banphrases/search`, query: { id: ID } },
  ],
  [
    "bot_levels_add",
    { username: "trustedviewer", level: 500 },
    { method: "POST", path: `${V2}/bot/${CH}/levels`, body: { username: "trustedviewer", level: 500 } },
  ],
  ["bot_leave", {}, { method: "POST", path: `${V2}/bot/${CH}/part` }],
  ["bot_counter_get", { counter: "deaths" }, { method: "GET", path: `${V2}/bot/${CH}/counters/deaths` }],
  ["points_add", { user: "viewer1", amount: -50 }, { method: "PUT", path: `${V2}/points/${CH}/viewer1/-50` }],
  [
    "points_add_alltime",
    { user: "viewer1", amount: 234 },
    { method: "PUT", path: `${V2}/points/${CH}/alltime/viewer1/234` },
  ],
  [
    "points_bulk_update",
    { users: [{ username: "a", current: 200 }, { username: "b", current: 150 }], mode: "add" },
    {
      method: "PUT",
      path: `${V2}/points/${CH}`,
      body: { users: [{ username: "a", current: 200 }, { username: "b", current: 150 }], mode: "add" },
    },
  ],
  ["points_list_top", {}, { method: "GET", path: `${V2}/points/${CH}/top`, query: { limit: "25", offset: "0" } }],
  ["points_reset_all", { context: "alltime" }, { method: "DELETE", path: `${V2}/points/${CH}/reset/alltime` }],
  [
    "loyalty_stats",
    { interval: "week", date: "2026-09-01T00:00:00Z", tz: 4 },
    {
      method: "GET",
      path: `${V2}/stats/${CH}`,
      query: { interval: "week", date: "2026-09-01T00:00:00Z", tz: "4" },
    },
  ],
  [
    "store_items_create",
    { name: "VIP for a day", cost: 5000, bot: { enabled: true, identifier: "vip" } },
    {
      method: "POST",
      path: `${V2}/store/${CH}/items`,
      body: { name: "VIP for a day", cost: 5000, bot: { enabled: true, identifier: "vip" } },
    },
  ],
  [
    "store_redemptions_list",
    { pending: true },
    { method: "GET", path: `${V2}/store/${CH}/redemptions`, query: { limit: "25", offset: "0", pending: "true" } },
  ],
  [
    "store_redemptions_update",
    { redemptionId: ID, changes: { completed: true } },
    { method: "PUT", path: `${V2}/store/${CH}/redemptions/${ID}`, body: { completed: true } },
  ],
  [
    "tips_list",
    { username: "generous", after: 1756684800000 },
    {
      method: "GET",
      path: `${V2}/tips/${CH}`,
      query: { limit: "25", offset: "0", sort: "-createdAt", username: "generous", after: "1756684800000" },
    },
  ],
  [
    "tips_create",
    { user: { username: "Donor" }, amount: 12.5, currency: "USD", message: "gl", imported: true },
    {
      method: "POST",
      path: `${V2}/tips/${CH}`,
      body: { user: { username: "Donor" }, amount: 12.5, currency: "USD", message: "gl", imported: true },
    },
  ],
  [
    "activities_list",
    { types: ["follow", "tip"], limit: 10 },
    { method: "GET", path: `${V2}/activities/${CH}`, query: { types: ["follow", "tip"], limit: "10" } },
  ],
  [
    "activities_top",
    { type: "tip" },
    {
      method: "GET",
      path: `${V2}/activities/${CH}/top`,
      query: { type: "tip", period: "alltime", limit: "25", offset: "0" },
    },
  ],
  ["activities_update", { activityId: ID }, { method: "POST", path: `${V2}/activities/${CH}/${ID}` }],
  ["activities_replay", { activityId: ID }, { method: "POST", path: `${V2}/activities/${CH}/${ID}/replay` }],
  [
    "songrequests_add",
    { video: "dQw4w9WgXcQ" },
    { method: "POST", path: `${V2}/songrequest/${CH}/queue`, body: { video: "dQw4w9WgXcQ" } },
  ],
  ["songrequests_player_control", { state: "pause" }, { method: "POST", path: `${V2}/songrequest/${CH}/player/pause` }],
  [
    "songrequests_playlist",
    { page: "CAoQAA" },
    { method: "GET", path: `${V2}/songrequest/${CH}/playlist`, query: { limit: "25", page: "CAoQAA" } },
  ],
  [
    "songrequests_youtube_lookup",
    { search: "lofi beats" },
    { method: "GET", path: `${V2}/songrequest/youtube`, query: { search: "lofi beats" } },
  ],
  [
    "contests_create",
    { title: "Win?", options: [{ title: "Yes", command: "yes" }, { title: "No", command: "no" }], duration: 5 },
    {
      method: "POST",
      path: `${V2}/contests/${CH}`,
      body: { title: "Win?", options: [{ title: "Yes", command: "yes" }, { title: "No", command: "no" }], duration: 5 },
    },
  ],
  [
    "contests_bet",
    { contestId: ID, optionID: "5c0a53cede9a4cc345a14d92", amount: 100 },
    {
      method: "POST",
      path: `${V2}/contests/${CH}/${ID}/bet`,
      body: { optionID: "5c0a53cede9a4cc345a14d92", amount: 100 },
    },
  ],
  ["contests_close", { contestId: ID }, { method: "DELETE", path: `${V2}/contests/${CH}/${ID}/close` }],
  [
    "giveaways_get",
    { giveawayId: ID, entrants: true },
    { method: "GET", path: `${V3}/giveaways/${CH}/${ID}`, query: { entrants: "true" } },
  ],
  [
    "giveaways_create",
    { giveaway: { title: "Game key", subscriberLuck: 2 } },
    { method: "POST", path: `${V3}/giveaways/${CH}`, body: { title: "Game key", subscriberLuck: 2 } },
  ],
  ["giveaways_draw_winner", { giveawayId: ID }, { method: "PUT", path: `${V3}/giveaways/${CH}/${ID}/winner` }],
  [
    "sessions_top",
    {},
    {
      method: "GET",
      path: `${V2}/sessions/${CH}/top`,
      query: { type: "tip", interval: "alltime", limit: "25", offset: "0" },
    },
  ],
  ["sessions_reset", {}, { method: "PUT", path: `${V2}/sessions/${CH}/reset` }],
  ["overlays_action", { action: "mute" }, { method: "PUT", path: `${V2}/overlays/${CH}/action/mute` }],
  [
    "overlays_create",
    { name: "Just Chatting" },
    {
      method: "POST",
      path: `${V2}/overlays/${CH}`,
      body: { name: "Just Chatting", settings: { width: 1920, height: 1080, name: "1080p" }, widgets: [] },
    },
  ],
  ["overlays_delete", { overlayId: ID }, { method: "DELETE", path: `${V2}/overlays/${CH}/${ID}` }],
  [
    "chatstats_search",
    { channel: "somestreamer" },
    { method: "GET", path: `${V2}/chatstats/search`, query: { channel: "somestreamer" } },
  ],
  [
    "chatstats_item",
    { username: "somestreamer", category: "emotes", item: "Kappa" },
    { method: "GET", path: `${V2}/chatstats/somestreamer/emotes/Kappa` },
  ],
  ["themes_list", { mobile: true }, { method: "GET", path: `${V2}/themes`, query: { mobile: "true" } }],
  ["channels_get", { channel: "somestreamer" }, { method: "GET", path: `${V2}/channels/somestreamer` }],
  ["channels_me", {}, { method: "GET", path: `${V2}/channels/me` }],
  ["users_channels", {}, { method: "GET", path: `${V2}/users/channels` }],
];

describe("tool → request mapping", () => {
  it.each(cases)("%s", async (tool, args, expected) => {
    const fetch = fakeFetch();
    const config = loadConfig({ SE_JWT_TOKEN: "jwt", SE_CHANNEL_ID: CH });
    const mcp = await connectClient(() => createServer(config, fetch));
    const result = await mcp.callTool({ name: tool, arguments: args });
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    expect(fetch.calls).toHaveLength(1);
    expect(describeCall(fetch.calls[0])).toEqual(expected);
  });
});
