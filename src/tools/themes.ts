import { z } from "zod";
import type { EndpointDef } from "../endpoint.js";
import { objectId } from "./common.js";

const toolset = "themes";

export const themeEndpoints: EndpointDef[] = [
  {
    name: "themes_list",
    title: "List themes",
    description: "Browse the StreamElements theme gallery (ready-made overlay and alert packages).",
    toolset,
    method: "GET",
    path: "/themes",
    input: {
      type: z.string().optional().describe("Theme type, e.g. alert, regular or widget"),
      mobile: z.boolean().optional().describe("Only themes for mobile streaming"),
    },
    query: ["type", "mobile"],
  },
  {
    name: "themes_get",
    title: "Get theme",
    description: "Get one theme from the StreamElements gallery by id.",
    toolset,
    method: "GET",
    path: "/themes/{themeId}",
    input: { themeId: objectId("Theme id") },
  },
];
