import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";

const toolset = "channels";

export const channelEndpoints: EndpointDef[] = [
  {
    name: "channels_me",
    title: "Get my channel",
    description:
      "Get the StreamElements channel that owns the configured token: channel id (_id), username, display name, " +
      "provider (twitch/youtube/...), avatar and more. Use it to find your channel id.",
    toolset,
    method: "GET",
    path: "/channels/me",
  },
  {
    name: "channels_get",
    title: "Get channel",
    description: "Get public details of a StreamElements channel by channel id or channel name.",
    toolset,
    method: "GET",
    path: "/channels/{channel}",
    channelDescription: "Channel id (24-char hex) or channel name. Defaults to your channel.",
  },
  {
    name: "channels_get_details",
    title: "Get channel details",
    description: "Get extended details for a channel (profile, settings and linked provider information).",
    toolset,
    method: "GET",
    path: "/channels/{channel}/details",
  },
  {
    name: "channels_emotes",
    title: "List channel emotes",
    description: "List the emotes usable on a channel: Twitch, BetterTTV (BTTV) and FrankerFaceZ (FFZ).",
    toolset,
    method: "GET",
    path: "/channels/{channel}/emotes",
  },
  {
    name: "channels_socket",
    title: "Channel socket (undocumented)",
    description:
      "POST /channels/{channel}/socket. StreamElements documents this endpoint without any description; it " +
      "appears to relate to the channel's realtime socket connection. Only use it if you know what it does.",
    toolset,
    method: "POST",
    path: "/channels/{channel}/socket",
  },
  {
    name: "channels_revoke_access_token",
    title: "Revoke channel access token (undocumented)",
    description:
      "DELETE /channels/{channel}/accesstoken. Undocumented; it appears to revoke the channel's access token. " +
      "WARNING: this may invalidate the token this server is using, so every later call fails until you put a " +
      "new token in SE_JWT_TOKEN / SE_OAUTH_TOKEN. Only run it if the user explicitly asks for it.",
    toolset,
    method: "DELETE",
    path: "/channels/{channel}/accesstoken",
    annotations: { idempotentHint: false },
  },
  {
    name: "users_current",
    title: "Get current user",
    description: "Get the StreamElements user account behind the token, including the channels it can access.",
    toolset,
    method: "GET",
    path: "/users/current",
  },
  {
    name: "users_channels",
    title: "List user channels",
    description: "List the channels the current StreamElements user can access.",
    toolset,
    method: "GET",
    path: "/users/channels",
    input: {
      type: z.string().optional().describe("Optional filter; undocumented by StreamElements (their example value is 'tip')"),
    },
    query: ["type"],
  },
  {
    name: "users_access",
    title: "List channel access",
    description: "List the channel's access list: users who have been granted access to manage this channel.",
    toolset,
    method: "GET",
    path: "/users/access",
  },
];
