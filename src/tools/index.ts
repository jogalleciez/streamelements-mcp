import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SEClient } from "../client.js";
import type { Config } from "../config.js";
import { registerEndpoint, type EndpointDef } from "../endpoint.js";
import { activityEndpoints } from "./activities.js";
import { botEndpoints } from "./bot.js";
import { channelEndpoints } from "./channels.js";
import { chatstatsEndpoints } from "./chatstats.js";
import { commandEndpoints } from "./commands.js";
import { contestEndpoints } from "./contests.js";
import { filterEndpoints } from "./filters.js";
import { giveawayEndpoints } from "./giveaways.js";
import { loyaltyEndpoints } from "./loyalty.js";
import { overlayEndpoints } from "./overlays.js";
import { sessionEndpoints } from "./sessions.js";
import { songRequestEndpoints } from "./songrequests.js";
import { storeEndpoints } from "./store.js";
import { themeEndpoints } from "./themes.js";
import { timerEndpoints } from "./timers.js";
import { tipEndpoints } from "./tips.js";

export const ALL_ENDPOINTS: readonly EndpointDef[] = [
  ...channelEndpoints,
  ...botEndpoints,
  ...commandEndpoints,
  ...timerEndpoints,
  ...filterEndpoints,
  ...loyaltyEndpoints,
  ...storeEndpoints,
  ...tipEndpoints,
  ...activityEndpoints,
  ...songRequestEndpoints,
  ...contestEndpoints,
  ...giveawayEndpoints,
  ...sessionEndpoints,
  ...overlayEndpoints,
  ...chatstatsEndpoints,
  ...themeEndpoints,
];

/** Registers every endpoint whose toolset is enabled. Returns the number of tools registered. */
export function registerTools(
  server: McpServer,
  client: SEClient,
  config: Pick<Config, "toolsets" | "maxResponseChars">,
): number {
  const enabled = ALL_ENDPOINTS.filter((def) => config.toolsets.has(def.toolset));
  for (const def of enabled) {
    registerEndpoint(server, client, def, { maxResponseChars: config.maxResponseChars });
  }
  return enabled.length;
}
