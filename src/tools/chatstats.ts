import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { limit, offset } from "./common.js";

const toolset = "chatstats";

const channelName = z.string().min(1).describe("Channel name (lowercase login name, not an id)");

export const chatstatsEndpoints: EndpointDef[] = [
  {
    name: "chatstats_global",
    title: "Get global chat stats",
    description: "Get global chat statistics across all channels that StreamElements chat stats tracks.",
    toolset,
    method: "GET",
    path: "/chatstats",
    input: { limit: limit(), offset: offset() },
    query: ["limit", "offset"],
  },
  {
    name: "chatstats_search",
    title: "Search chat stats channels",
    description: "Search the channels tracked by chat stats by channel name.",
    toolset,
    method: "GET",
    path: "/chatstats/search",
    input: { channel: channelName },
    query: ["channel"],
  },
  {
    name: "chatstats_get",
    title: "Get channel chat stats",
    description: "Get a channel's chat stats summary by channel name.",
    toolset,
    method: "GET",
    path: "/chatstats/{username}",
    input: { username: channelName },
  },
  {
    name: "chatstats_epm",
    title: "Get emotes per minute",
    description: "Get a channel's 'emotes per minute' chat stats.",
    toolset,
    method: "GET",
    path: "/chatstats/{username}/epm",
    input: { username: channelName, limit: limit() },
    query: ["limit"],
  },
  {
    name: "chatstats_stats",
    title: "Get detailed chat stats",
    description: "Get a channel's detailed chat stats: top chatters, emotes, commands, hashtags and more.",
    toolset,
    method: "GET",
    path: "/chatstats/{username}/stats",
    input: { username: channelName, limit: limit() },
    query: ["limit"],
  },
  {
    name: "chatstats_item",
    title: "Get chat stats item",
    description: "Get the chat stats for one item in a category, e.g. one emote or one chatter.",
    toolset,
    method: "GET",
    path: "/chatstats/{username}/{category}/{item}",
    input: {
      username: channelName,
      category: z.string().min(1).describe("Category key as it appears in chatstats_stats output"),
      item: z.string().min(1).describe("Item within the category, e.g. an emote name or username"),
    },
  },
];
