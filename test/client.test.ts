import { describe, expect, it } from "vitest";
import { SEClient } from "../src/client.js";
import { SEApiError } from "../src/errors.js";
import { fakeFetch, jsonResponse } from "./helpers.js";

const CHANNEL = "5b2e2007760aeb7729487dab";

function client(overrides: Partial<ConstructorParameters<typeof SEClient>[0]> = {}, fetchImpl = fakeFetch()) {
  return {
    fetch: fetchImpl,
    client: new SEClient({ auth: { type: "jwt", token: "jwt-123" }, timeoutMs: 1000, ...overrides }, fetchImpl),
  };
}

describe("SEClient.request auth and URL", () => {
  it("sends the JWT as a Bearer token with a JSON Accept header", async () => {
    const { client: c, fetch } = client();
    await c.request({ method: "GET", path: "/bot/abc" });
    expect(fetch.calls[0].headers.get("authorization")).toBe("Bearer jwt-123");
    expect(fetch.calls[0].headers.get("accept")).toBe("application/json");
  });

  it("sends an OAuth token with the oAuth scheme", async () => {
    const { client: c, fetch } = client({ auth: { type: "oauth", token: "oa-9" } });
    await c.request({ method: "GET", path: "/bot/abc" });
    expect(fetch.calls[0].headers.get("authorization")).toBe("oAuth oa-9");
  });

  it("uses the v2 base URL by default", async () => {
    const { client: c, fetch } = client();
    await c.request({ method: "GET", path: "/bot/abc" });
    expect(fetch.calls[0].url).toBe("https://api.streamelements.com/kappa/v2/bot/abc");
  });

  it("uses the v3 base URL when asked", async () => {
    const { client: c, fetch } = client();
    await c.request({ method: "GET", path: "/giveaways/abc", version: "v3" });
    expect(fetch.calls[0].url).toBe("https://api.streamelements.com/kappa/v3/giveaways/abc");
  });

  it("serializes query values, repeating arrays and dropping empty ones", async () => {
    const { client: c, fetch } = client();
    await c.request({
      method: "GET",
      path: "/activities/abc",
      query: { limit: 10, types: ["tip", "follow"], mod: true, after: undefined, before: null },
    });
    expect(fetch.calls[0].url).toBe(
      "https://api.streamelements.com/kappa/v2/activities/abc?limit=10&types=tip&types=follow&mod=true",
    );
  });

  it("sends the method and a JSON body with a content type", async () => {
    const { client: c, fetch } = client();
    await c.request({ method: "POST", path: "/bot/abc/say", body: { message: "hi" } });
    expect(fetch.calls[0].method).toBe("POST");
    expect(fetch.calls[0].headers.get("content-type")).toBe("application/json");
    expect(fetch.calls[0].body).toBe('{"message":"hi"}');
  });

  it("sends no body or content type when there is no body", async () => {
    const { client: c, fetch } = client();
    await c.request({ method: "POST", path: "/bot/abc/join" });
    expect(fetch.calls[0].body).toBeUndefined();
    expect(fetch.calls[0].headers.has("content-type")).toBe(false);
  });
});

describe("SEClient.request responses", () => {
  it("returns parsed JSON", async () => {
    const { client: c } = client({}, fakeFetch(() => jsonResponse({ _id: "x", enabled: true })));
    await expect(c.request({ method: "GET", path: "/bot/abc" })).resolves.toEqual({ _id: "x", enabled: true });
  });

  it("returns null for a 204", async () => {
    const { client: c } = client({}, fakeFetch(() => new Response(null, { status: 204 })));
    await expect(c.request({ method: "DELETE", path: "/x" })).resolves.toBeNull();
  });

  it("returns null for an empty 200 body", async () => {
    const { client: c } = client({}, fakeFetch(() => new Response("", { status: 200 })));
    await expect(c.request({ method: "PUT", path: "/x" })).resolves.toBeNull();
  });

  it("returns raw text for a non-JSON body", async () => {
    const { client: c } = client({}, fakeFetch(() => new Response("OK", { status: 200 })));
    await expect(c.request({ method: "POST", path: "/x" })).resolves.toBe("OK");
  });

  it("throws SEApiError with the parsed body for a non-2xx response", async () => {
    const { client: c } = client(
      {},
      fakeFetch(() => jsonResponse({ statusCode: 404, error: "Not Found", message: "nope" }, 404, "Not Found")),
    );
    const error = (await c.request({ method: "GET", path: "/bot/commands/abc/1" }).catch((e: unknown) => e)) as SEApiError;
    expect(error).toBeInstanceOf(SEApiError);
    expect(error).toMatchObject({ status: 404, method: "GET", path: "/bot/commands/abc/1" });
    expect(error.body).toEqual({ statusCode: 404, error: "Not Found", message: "nope" });
  });

  it("captures Retry-After on a 429", async () => {
    const { client: c } = client(
      {},
      fakeFetch(() => new Response("slow down", { status: 429, headers: { "Retry-After": "12" } })),
    );
    await expect(c.request({ method: "GET", path: "/x" })).rejects.toMatchObject({ status: 429, retryAfter: "12" });
  });

  it("reports a timeout with the configured duration and request", async () => {
    const hanging = fakeFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    );
    const { client: c } = client({ timeoutMs: 20 }, hanging);
    await expect(c.request({ method: "GET", path: "/slow" })).rejects.toThrow(
      "StreamElements request timed out after 20ms: GET /slow",
    );
  });

  it("wraps network failures with the request", async () => {
    const failing = fakeFetch(() => Promise.reject(new TypeError("fetch failed")));
    const { client: c } = client({}, failing);
    await expect(c.request({ method: "GET", path: "/x" })).rejects.toThrow(
      "StreamElements request failed: GET /x: fetch failed",
    );
  });
});

describe("SEClient.getChannelId", () => {
  it("returns the configured channel id without calling the API", async () => {
    const { client: c, fetch } = client({ channelId: CHANNEL });
    await expect(c.getChannelId()).resolves.toBe(CHANNEL);
    expect(fetch.calls).toHaveLength(0);
  });

  it("looks up /channels/me once and caches the id", async () => {
    const fetch = fakeFetch(() => jsonResponse({ _id: CHANNEL, username: "me" }));
    const { client: c } = client({}, fetch);
    const [a, b] = await Promise.all([c.getChannelId(), c.getChannelId()]);
    await c.getChannelId();
    expect([a, b]).toEqual([CHANNEL, CHANNEL]);
    expect(fetch.calls.map((call) => call.url)).toEqual(["https://api.streamelements.com/kappa/v2/channels/me"]);
  });

  it("retries the lookup after a failure instead of caching it", async () => {
    let attempt = 0;
    const fetch = fakeFetch(() =>
      ++attempt === 1 ? jsonResponse({ message: "down" }, 503, "Unavailable") : jsonResponse({ _id: CHANNEL }),
    );
    const { client: c } = client({}, fetch);
    await expect(c.getChannelId()).rejects.toBeInstanceOf(SEApiError);
    await expect(c.getChannelId()).resolves.toBe(CHANNEL);
  });

  it("fails clearly when /channels/me has no _id", async () => {
    const { client: c } = client({}, fakeFetch(() => jsonResponse({ username: "me" })));
    await expect(c.getChannelId()).rejects.toThrow(/channels\/me.*_id/);
  });
});
