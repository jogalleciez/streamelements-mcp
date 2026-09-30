import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { objectId } from "./common.js";

const toolset = "timers";

const schedule = (when: string) =>
  z
    .object({
      enabled: z.boolean().describe(`Run while the stream is ${when}`),
      interval: z.number().int().min(1).describe("Minutes between runs"),
    })
    .describe(`Schedule while the stream is ${when}`);

const timerFields = {
  name: z.string().min(1).describe("Timer name"),
  message: z.string().min(1).describe("Message the bot posts"),
  enabled: z.boolean().optional().describe("Whether the timer is enabled"),
  chatLines: z.number().int().min(0).optional().describe("Minimum chat lines since the last run before it fires again"),
  online: schedule("live").optional(),
  offline: schedule("offline").optional(),
};

const timerBody = Object.keys(timerFields);

export const timerEndpoints: EndpointDef[] = [
  {
    name: "timers_list",
    title: "List timers",
    description: "List the channel's bot timers (messages the bot posts on a schedule).",
    toolset,
    method: "GET",
    path: "/bot/timers/{channel}",
  },
  {
    name: "timers_create",
    title: "Create timer",
    description: "Create a bot timer that posts a message every N minutes, optionally only after enough chat activity.",
    toolset,
    method: "POST",
    path: "/bot/timers/{channel}",
    input: timerFields,
    body: timerBody,
  },
  {
    name: "timers_get",
    title: "Get timer",
    description: "Get one bot timer by id.",
    toolset,
    method: "GET",
    path: "/bot/timers/{channel}/{timerId}",
    input: { timerId: objectId("Timer id") },
  },
  {
    name: "timers_update",
    title: "Update timer",
    description:
      "Update a bot timer. The API may treat this as a full replacement, so the safest approach is to send every " +
      "field from timers_get with your changes applied.",
    toolset,
    method: "PUT",
    path: "/bot/timers/{channel}/{timerId}",
    input: {
      timerId: objectId("Timer id"),
      ...timerFields,
      name: timerFields.name.optional(),
      message: timerFields.message.optional(),
    },
    body: timerBody,
  },
  {
    name: "timers_delete",
    title: "Delete timer",
    description: "Permanently delete a bot timer.",
    toolset,
    method: "DELETE",
    path: "/bot/timers/{channel}/{timerId}",
    input: { timerId: objectId("Timer id") },
  },
];
