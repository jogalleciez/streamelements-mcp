import { describe, expect, it } from "vitest";
import { SEApiError, formatToolError } from "../src/errors.js";

function apiError(status: number, body: unknown, retryAfter?: string): SEApiError {
  return new SEApiError({ status, statusText: "X", method: "GET", path: "/bot/commands/abc", body, retryAfter });
}

describe("SEApiError", () => {
  it("includes status, request and the API's message", () => {
    const error = new SEApiError({
      status: 404,
      statusText: "Not Found",
      method: "DELETE",
      path: "/bot/commands/abc/123",
      body: { statusCode: 404, error: "Not Found", message: "Command not found" },
    });
    expect(error.message).toBe("StreamElements API error 404 Not Found on DELETE /bot/commands/abc/123: Command not found");
  });

  it("falls back to a string body", () => {
    expect(apiError(500, "upstream exploded").message).toMatch(/: upstream exploded$/);
  });

  it("falls back to JSON for bodies without a message", () => {
    expect(apiError(400, { errors: ["bad"] }).message).toMatch(/: \{"errors":\["bad"\]\}$/);
  });

  it("omits the detail when the body is empty", () => {
    expect(apiError(502, null).message).toBe("StreamElements API error 502 X on GET /bot/commands/abc");
  });
});

describe("formatToolError", () => {
  it("explains 401 as a bad or expired token and where to get a new JWT", () => {
    const text = formatToolError(apiError(401, { message: "Unauthorized" }));
    expect(text).toMatch(/invalid or expired/);
    expect(text).toMatch(/Show secrets/);
  });

  it("names the OAuth scope for a 403 when one is known", () => {
    expect(formatToolError(apiError(403, null), "bot:read / bot:write")).toMatch(/bot:read \/ bot:write/);
  });

  it("gives a generic permission hint for a 403 without a scope", () => {
    const text = formatToolError(apiError(403, null));
    expect(text).toMatch(/permission/i);
    expect(text).not.toMatch(/scope/);
  });

  it("suggests checking ids for a 404", () => {
    expect(formatToolError(apiError(404, null))).toMatch(/check the ids/i);
  });

  it("reports Retry-After for a 429", () => {
    expect(formatToolError(apiError(429, null, "30"))).toMatch(/retry after 30 seconds/i);
  });

  it("reports rate limiting without Retry-After", () => {
    expect(formatToolError(apiError(429, null))).toMatch(/rate limit/i);
  });

  it("flags 5xx as a StreamElements-side problem", () => {
    expect(formatToolError(apiError(503, null))).toMatch(/server-side/i);
  });

  it("keeps the API message for a 400", () => {
    expect(formatToolError(apiError(400, { message: "\"cost\" must be a number" }))).toMatch(/"cost" must be a number/);
  });

  it("passes plain Error messages through", () => {
    expect(formatToolError(new Error("Request timed out"))).toBe("Error: Request timed out");
  });

  it("stringifies non-Error throwables", () => {
    expect(formatToolError("boom")).toBe("Error: boom");
  });
});
