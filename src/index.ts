#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

// stdout carries the MCP protocol; all logging goes to stderr.
const log = (message: string) => console.error(`[streamelements-mcp] ${message}`);

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  for (const warning of config.warnings) {
    log(`Warning: ${warning}`);
  }

  const server = createServer(config);
  await server.connect(new StdioServerTransport());
  log(`Running on stdio (${config.auth.type} auth, toolsets: ${[...config.toolsets].join(", ")})`);
}

process.on("unhandledRejection", (reason) => {
  log(`Unhandled rejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
});

main().catch((error: unknown) => {
  log(`Fatal: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exit(1);
});
