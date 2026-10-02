import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const JWT = "eyJhbGciOiJIUzI1NiJ9.jwt-token";

describe("loadConfig auth", () => {
  it("rejects a config with no token, naming both env vars", () => {
    expect(() => loadConfig({})).toThrow(/SE_JWT_TOKEN.*SE_OAUTH_TOKEN/);
  });

  it("treats blank tokens as unset", () => {
    expect(() => loadConfig({ SE_JWT_TOKEN: "  ", SE_OAUTH_TOKEN: "" })).toThrow(/SE_JWT_TOKEN/);
  });

  it("uses a JWT token as jwt auth, trimmed", () => {
    expect(loadConfig({ SE_JWT_TOKEN: `  ${JWT}\n` }).auth).toEqual({ type: "jwt", token: JWT });
  });

  it("uses an OAuth token as oauth auth", () => {
    expect(loadConfig({ SE_OAUTH_TOKEN: "oauth-abc" }).auth).toEqual({ type: "oauth", token: "oauth-abc" });
  });

  it("prefers the JWT when both tokens are set and warns about it", () => {
    const config = loadConfig({ SE_JWT_TOKEN: JWT, SE_OAUTH_TOKEN: "oauth-abc" });
    expect(config.auth).toEqual({ type: "jwt", token: JWT });
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toMatch(/SE_OAUTH_TOKEN.*ignored/);
  });

  it("has no warnings for a single token", () => {
    expect(loadConfig({ SE_JWT_TOKEN: JWT }).warnings).toEqual([]);
  });
});

describe("loadConfig channel id", () => {
  it("leaves channelId undefined when unset", () => {
    expect(loadConfig({ SE_JWT_TOKEN: JWT }).channelId).toBeUndefined();
  });

  it("accepts a 24-character hex channel id", () => {
    expect(loadConfig({ SE_JWT_TOKEN: JWT, SE_CHANNEL_ID: "5b2e2007760aeb7729487dab" }).channelId).toBe(
      "5b2e2007760aeb7729487dab",
    );
  });

  it("rejects a channel name passed as SE_CHANNEL_ID", () => {
    expect(() => loadConfig({ SE_JWT_TOKEN: JWT, SE_CHANNEL_ID: "mychannel" })).toThrow(/SE_CHANNEL_ID/);
  });
});

describe("loadConfig toolsets", () => {
  it("enables all 16 toolsets when SE_TOOLSETS is unset", () => {
    const toolsets = loadConfig({ SE_JWT_TOKEN: JWT }).toolsets;
    expect(toolsets.size).toBe(16);
    expect(toolsets.has("giveaways")).toBe(true);
    expect(toolsets.has("themes")).toBe(true);
  });

  it("enables all toolsets for 'all'", () => {
    expect(loadConfig({ SE_JWT_TOKEN: JWT, SE_TOOLSETS: "all" }).toolsets.size).toBe(16);
  });

  it("enables only the listed toolsets, ignoring case and spaces", () => {
    const toolsets = loadConfig({ SE_JWT_TOKEN: JWT, SE_TOOLSETS: " Bot, songrequests ,LOYALTY" }).toolsets;
    expect([...toolsets].sort()).toEqual(["bot", "loyalty", "songrequests"]);
  });

  it("rejects an unknown toolset and lists the valid ones", () => {
    expect(() => loadConfig({ SE_JWT_TOKEN: JWT, SE_TOOLSETS: "bot,points" })).toThrow(
      /Unknown toolset "points".*activities.*tips/s,
    );
  });

  it("rejects an SE_TOOLSETS value that names no toolsets", () => {
    expect(() => loadConfig({ SE_JWT_TOKEN: JWT, SE_TOOLSETS: " , " })).toThrow(/SE_TOOLSETS/);
  });
});

describe("loadConfig read-only mode", () => {
  it("is off when SE_READ_ONLY is unset", () => {
    expect(loadConfig({ SE_JWT_TOKEN: JWT }).readOnly).toBe(false);
  });

  it.each(["true", "TRUE", "1", "yes"])("is on for SE_READ_ONLY=%s", (value) => {
    expect(loadConfig({ SE_JWT_TOKEN: JWT, SE_READ_ONLY: value }).readOnly).toBe(true);
  });

  it.each(["false", "0", "no", " "])("is off for SE_READ_ONLY=%j", (value) => {
    expect(loadConfig({ SE_JWT_TOKEN: JWT, SE_READ_ONLY: value }).readOnly).toBe(false);
  });

  it("rejects an SE_READ_ONLY value that is not a boolean", () => {
    expect(() => loadConfig({ SE_JWT_TOKEN: JWT, SE_READ_ONLY: "maybe" })).toThrow(/SE_READ_ONLY/);
  });
});

describe("loadConfig numeric settings", () => {
  it("defaults timeout to 15000ms and response cap to 100000 chars", () => {
    const config = loadConfig({ SE_JWT_TOKEN: JWT });
    expect(config.timeoutMs).toBe(15000);
    expect(config.maxResponseChars).toBe(100000);
  });

  it("reads custom numeric settings", () => {
    const config = loadConfig({ SE_JWT_TOKEN: JWT, SE_TIMEOUT_MS: "5000", SE_MAX_RESPONSE_CHARS: "2000" });
    expect(config.timeoutMs).toBe(5000);
    expect(config.maxResponseChars).toBe(2000);
  });

  it.each(["abc", "0", "-5", "1.5"])("rejects SE_TIMEOUT_MS=%s", (value) => {
    expect(() => loadConfig({ SE_JWT_TOKEN: JWT, SE_TIMEOUT_MS: value })).toThrow(/SE_TIMEOUT_MS/);
  });

  it("rejects a non-numeric SE_MAX_RESPONSE_CHARS", () => {
    expect(() => loadConfig({ SE_JWT_TOKEN: JWT, SE_MAX_RESPONSE_CHARS: "lots" })).toThrow(/SE_MAX_RESPONSE_CHARS/);
  });
});
