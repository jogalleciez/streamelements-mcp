import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const entry = fileURLToPath(new URL("../build/index.js", import.meta.url));

/** A minimal environment, so SE_* variables from the developer's shell can't leak in. */
function baseEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of ["PATH", "Path", "SystemRoot", "HOME", "USERPROFILE", "TEMP", "TMP"]) {
    const value = process.env[name];
    if (value !== undefined) {
      env[name] = value;
    }
  }
  return env;
}

describe("stdio entrypoint (built)", () => {
  let client: Client | undefined;

  beforeAll(() => {
    execSync("npm run build", { cwd: root, stdio: "pipe" });
  }, 120_000);

  afterAll(async () => {
    await client?.close();
  });

  it("exits with an error naming the env vars when no token is set", () => {
    const run = spawnSync(process.execPath, [entry], { env: baseEnv(), encoding: "utf8", timeout: 20_000 });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/SE_JWT_TOKEN/);
    expect(run.stdout).toBe("");
  });

  it("exits with an error for an unknown toolset", () => {
    const run = spawnSync(process.execPath, [entry], {
      env: { ...baseEnv(), SE_JWT_TOKEN: "x", SE_TOOLSETS: "nope" },
      encoding: "utf8",
      timeout: 20_000,
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/Unknown toolset "nope"/);
  });

  it("serves MCP over stdio with the selected toolsets", async () => {
    client = new Client({ name: "stdio-test", version: "0.0.0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [entry],
        env: { ...baseEnv(), SE_JWT_TOKEN: "not-a-real-token", SE_TOOLSETS: "bot,themes" },
        stderr: "pipe",
      }),
    );
    expect(client.getServerVersion()?.name).toBe("streamelements");
    const tools = (await client.listTools()).tools;
    expect(tools).toHaveLength(14);
  }, 30_000);
});
