import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SEClient } from "../client.js";
import type { Config } from "../config.js";
import { buildToolAnnotations, registerEndpoint, type EndpointDef } from "../endpoint.js";
import { activityEndpoints } from "./activities.js";
import { botEndpoints } from "./bot.js";
import { channelEndpoints } from "./channels.js";
import { chatstatsEndpoints } from "./chatstats.js";
import { commandEndpoints } from "./commands.js";
import { contestEndpoints } from "./contests.js";
import { filterEndpoints } from "./filters.js";
import { giveawayEndpoints } from "./giveaways.js";
import { loyaltyEndpoints } from "./loyalty.js";
import { registerOverlayUpdate } from "./overlay-update.js";
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

/**
 * Registers every endpoint whose toolset is enabled, plus `overlays_update` (a read-modify-write that
 * doesn't fit a single `EndpointDef`). In read-only mode only read-only tools are registered.
 * Returns the number of tools registered.
 */
export function registerTools(
  server: McpServer,
  client: SEClient,
  config: Pick<Config, "toolsets" | "readOnly" | "maxResponseChars">,
): number {
  const enabled = ALL_ENDPOINTS.filter(
    (def) => config.toolsets.has(def.toolset) && (!config.readOnly || buildToolAnnotations(def).readOnlyHint === true),
  );
  for (const def of enabled) {
    registerEndpoint(server, client, def, { maxResponseChars: config.maxResponseChars });
  }
  if (config.readOnly || !config.toolsets.has("overlays")) {
    return enabled.length;
  }
  registerOverlayUpdate(server, client);
  return enabled.length + 1;
}
