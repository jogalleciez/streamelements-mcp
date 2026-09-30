import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { ACCESS_LEVELS, cooldown, jsonObject, objectId } from "./common.js";

const toolset = "commands";

const commandFields = {
  command: z.string().min(1).describe("Command name without the ! prefix, e.g. 'discord'"),
  reply: z.string().min(1).describe("Response text; supports StreamElements variables such as ${user} and ${count}"),
  enabled: z.boolean().optional().describe("Whether the command is enabled"),
  enabledOnline: z.boolean().optional().describe("Whether it works while the stream is live"),
  enabledOffline: z.boolean().optional().describe("Whether it works while the stream is offline"),
  hidden: z.boolean().optional().describe("Hide it from the public command list"),
  cooldown: cooldown.optional(),
  aliases: z.array(z.string()).optional().describe("Other names that trigger the command"),
  keywords: z.array(z.string()).optional().describe("Words that trigger the command anywhere in a message"),
  regex: z.string().optional().describe("Regular expression that triggers the command"),
  cost: z.number().int().min(0).optional().describe("Loyalty points it costs to use"),
  accessLevel: z.number().int().optional().describe(`Minimum permission level to use it. ${ACCESS_LEVELS}`),
  type: z.string().optional().describe("Response type; 'say' (the default) posts the reply in chat"),
};

const commandBody = Object.keys(commandFields);

const optionalCommandFields = Object.fromEntries(
  Object.entries(commandFields).map(([key, schema]) => [key, schema.optional()]),
);

export const commandEndpoints: EndpointDef[] = [
  {
    name: "commands_list",
    title: "List custom commands",
    description: "List the channel's custom chat bot commands with their replies, cooldowns, costs and access levels.",
    toolset,
    method: "GET",
    path: "/bot/commands/{channel}",
  },
  {
    name: "commands_create",
    title: "Create custom command",
    description: "Create a custom chat bot command.",
    toolset,
    method: "POST",
    path: "/bot/commands/{channel}",
    input: commandFields,
    body: commandBody,
  },
  {
    name: "commands_list_public",
    title: "List public commands",
    description: "List the channel's public commands, as shown on its public StreamElements command page.",
    toolset,
    method: "GET",
    path: "/bot/commands/{channel}/public",
  },
  {
    name: "commands_list_default",
    title: "List default commands",
    description: "List the bot's built-in default commands (e.g. !points, !followage) and their settings on the channel.",
    toolset,
    method: "GET",
    path: "/bot/commands/{channel}/default",
    input: { language: z.string().default("en").describe("Lowercase ISO language code for command texts, e.g. en") },
    query: ["language"],
  },
  {
    name: "commands_update_default",
    title: "Update default command",
    description:
      "Change the settings of a built-in default command, e.g. { \"enabled\": false } or " +
      "{ \"cooldown\": { \"user\": 30, \"global\": 5 }, \"accessLevel\": 500 }. Get ids from commands_list_default.",
    toolset,
    method: "PUT",
    path: "/bot/commands/{channel}/default/{commandId}",
    input: {
      commandId: z.string().min(1).describe("Default command id, from commands_list_default"),
      settings: jsonObject("Command settings to change"),
    },
    body: { from: "settings" },
  },
  {
    name: "commands_get",
    title: "Get custom command",
    description: "Get one custom command by id.",
    toolset,
    method: "GET",
    path: "/bot/commands/{channel}/{commandId}",
    input: { commandId: objectId("Command id") },
  },
  {
    name: "commands_update",
    title: "Update custom command",
    description:
      "Update a custom command. The API may treat this as a full replacement, so the safest approach is to send " +
      "every field from commands_get with your changes applied.",
    toolset,
    method: "PUT",
    path: "/bot/commands/{channel}/{commandId}",
    input: { commandId: objectId("Command id"), ...optionalCommandFields },
    body: commandBody,
  },
  {
    name: "commands_delete",
    title: "Delete custom command",
    description: "Permanently delete a custom command.",
    toolset,
    method: "DELETE",
    path: "/bot/commands/{channel}/{commandId}",
    input: { commandId: objectId("Command id") },
  },
];
