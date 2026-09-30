import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { jsonObject, limit, objectId, offset } from "./common.js";

const toolset = "contests";

const contestId = { contestId: objectId("Contest id") };

const contestFields = {
  title: z.string().min(1).describe("Question viewers bet on, e.g. 'Will I win the next game?'"),
  options: z
    .array(
      z.object({
        title: z.string().min(1).describe("Option label, e.g. 'Win'"),
        command: z.string().min(1).describe("Word viewers type to bet on it, e.g. 'win' for !bet win"),
      }),
    )
    .min(2)
    .describe("At least two outcomes"),
  minBet: z.number().int().min(0).optional().describe("Minimum bet in loyalty points"),
  maxBet: z.number().int().min(0).optional().describe("Maximum bet in loyalty points"),
  duration: z.number().int().min(1).optional().describe("How long betting stays open, in minutes"),
  botResponses: z.boolean().optional().describe("Whether the bot announces the contest in chat"),
};

const contestBody = Object.keys(contestFields);

export const contestEndpoints: EndpointDef[] = [
  {
    name: "contests_list",
    title: "List contests",
    description: "List the channel's contests (points betting on outcomes), including the active one.",
    toolset,
    method: "GET",
    path: "/contests/{channel}",
  },
  {
    name: "contests_create",
    title: "Create contest",
    description: "Create a contest where viewers bet loyalty points on an outcome. Start it with contests_start.",
    toolset,
    method: "POST",
    path: "/contests/{channel}",
    input: contestFields,
    body: contestBody,
  },
  {
    name: "contests_history",
    title: "List past contests",
    description: "List the channel's previous contests.",
    toolset,
    method: "GET",
    path: "/contests/{channel}/history",
    input: { limit: limit(), offset: offset() },
    query: ["limit", "offset"],
  },
  {
    name: "contests_get",
    title: "Get contest",
    description: "Get one contest by id, with its options, totals and state.",
    toolset,
    method: "GET",
    path: "/contests/{channel}/{contestId}",
    input: contestId,
  },
  {
    name: "contests_update",
    title: "Update contest",
    description: "Update a contest that has not started yet.",
    toolset,
    method: "PUT",
    path: "/contests/{channel}/{contestId}",
    input: {
      ...contestId,
      ...contestFields,
      title: contestFields.title.optional(),
      options: contestFields.options.optional(),
    },
    body: contestBody,
  },
  {
    name: "contests_delete",
    title: "Delete contest",
    description:
      "DELETE /contests/{channel}/{contestId}. StreamElements labels it 'Close contest', the same as " +
      "contests_close. Prefer contests_close to end a running contest and contests_refund to return bets.",
    toolset,
    method: "DELETE",
    path: "/contests/{channel}/{contestId}",
    input: contestId,
  },
  {
    name: "contests_start",
    title: "Start contest",
    description: "Start a created contest so viewers can place bets.",
    toolset,
    method: "PUT",
    path: "/contests/{channel}/{contestId}/start",
    input: contestId,
  },
  {
    name: "contests_bet",
    title: "Place contest bet",
    description: "Place a bet on a contest option as the token owner.",
    toolset,
    method: "POST",
    path: "/contests/{channel}/{contestId}/bet",
    input: {
      ...contestId,
      optionID: objectId("Option id (the option's _id from contests_get)"),
      amount: z.number().int().min(1).describe("Points to bet"),
    },
    body: ["optionID", "amount"],
  },
  {
    name: "contests_list_bets",
    title: "List contest bets",
    description: "List the bets placed on a contest.",
    toolset,
    method: "GET",
    path: "/contests/{channel}/{contestId}/bet",
    input: contestId,
  },
  {
    name: "contests_draw_winner",
    title: "Pick contest winner",
    description:
      "Settle a contest by choosing the winning outcome, which pays out points. StreamElements does not document " +
      "the body; it presumably names the winning option, e.g. { \"winnerId\": \"<option _id>\" }.",
    toolset,
    method: "PUT",
    path: "/contests/{channel}/{contestId}/winner",
    input: { ...contestId, winner: jsonObject("Body identifying the winning option").optional() },
    body: { from: "winner" },
    annotations: { destructiveHint: true, idempotentHint: false },
  },
  {
    name: "contests_refund",
    title: "Refund contest",
    description: "Cancel a contest and refund every participant's bet.",
    toolset,
    method: "DELETE",
    path: "/contests/{channel}/{contestId}/refund",
    input: contestId,
  },
  {
    name: "contests_close",
    title: "Close contest betting",
    description: "Close betting on a running contest, so no new bets are accepted, before picking a winner.",
    toolset,
    method: "DELETE",
    path: "/contests/{channel}/{contestId}/close",
    input: contestId,
  },
];
