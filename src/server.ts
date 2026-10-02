import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SEClient } from "./client.js";
import type { Config } from "./config.js";
import { registerTools } from "./tools/index.js";

export const SERVER_NAME = "streamelements";
// package.json sits one level above both src/ and build/.
export const SERVER_VERSION: string = createRequire(import.meta.url)("../package.json").version;

/** Builds the MCP server with every endpoint in the configured toolsets registered as a tool. */
export function createServer(config: Config, fetchImpl: typeof fetch = fetch): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Tools for the StreamElements API: chat bot, commands, timers, spam filters, loyalty points, store, " +
        "tips, activities, song requests, contests, giveaways, sessions, overlays and chat stats. " +
        "Channel-scoped tools default to the authenticated channel when `channel` is omitted.",
    },
  );
  const client = new SEClient(
    { auth: config.auth, channelId: config.channelId, timeoutMs: config.timeoutMs },
    fetchImpl,
  );
  registerTools(server, client, config);
  return server;
}
