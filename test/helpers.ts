import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Connects a real MCP client to a server configured by `setup`, over an in-memory transport. */
export async function connectClient(setup: (server: McpServer) => void | McpServer): Promise<Client> {
  const server = new McpServer({ name: "test-server", version: "0.0.0" });
  const configured = setup(server) ?? server;
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([configured.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/** The text of a tool result's first content block. */
export function resultText(result: unknown): string {
  const content = (result as { content: Array<{ type: string; text?: string }> }).content;
  return content[0]?.text ?? "";
}

export interface RecordedCall {
  url: string;
  method: string;
  headers: Headers;
  body: string | undefined;
}

export type FakeFetch = typeof fetch & { calls: RecordedCall[] };

type Responder = (url: string, init: RequestInit) => Response | Promise<Response>;

/** A fetch double that records each request and answers with `respond` (default: 200 `{}`). */
export function fakeFetch(respond: Responder = () => jsonResponse({})): FakeFetch {
  const calls: RecordedCall[] = [];
  const fn = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({
      url,
      method: init.method ?? "GET",
      headers: new Headers(init.headers),
      body: typeof init.body === "string" ? init.body : undefined,
    });
    return respond(url, init);
  };
  return Object.assign(fn, { calls }) as FakeFetch;
}

export function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
