import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { endpointProblems } from "../src/endpoint.js";
import { ALL_ENDPOINTS } from "../src/tools/index.js";

interface SpecOperation {
  method: string;
  path: string;
  tag: string;
}

const spec: { operations: SpecOperation[] } = JSON.parse(
  readFileSync(new URL("../spec/endpoints.json", import.meta.url), "utf8"),
);

/** Which toolset each official spec tag belongs to. */
const TAG_TOOLSET: Record<string, string> = {
  activities: "activities",
  bot: "bot",
  modules: "bot",
  commands: "commands",
  timers: "timers",
  filters: "filters",
  channels: "channels",
  users: "channels",
  chatstats: "chatstats",
  contests: "contests",
  "single contest": "contests",
  giveaways: "giveaways",
  "single giveaway": "giveaways",
  loyalties: "loyalty",
  points: "loyalty",
  "single user": "loyalty",
  stats: "loyalty",
  overlays: "overlays",
  sessions: "sessions",
  songrequests: "songrequests",
  store: "store",
  redemptions: "store",
  themes: "themes",
  tips: "tips",
};

const key = (op: { method: string; path: string }) => `${op.method} ${op.path}`;

describe("coverage of the official StreamElements spec", () => {
  it("defines exactly 137 endpoints", () => {
    expect(spec.operations).toHaveLength(137);
    expect(ALL_ENDPOINTS).toHaveLength(137);
  });

  it("implements every operation in the spec", () => {
    const implemented = new Set(ALL_ENDPOINTS.map(key));
    expect(spec.operations.map(key).filter((op) => !implemented.has(op))).toEqual([]);
  });

  it("implements nothing outside the spec", () => {
    const documented = new Set(spec.operations.map(key));
    expect(ALL_ENDPOINTS.map(key).filter((op) => !documented.has(op))).toEqual([]);
  });

  it("implements each operation once", () => {
    const keys = ALL_ENDPOINTS.map(key);
    expect(keys.filter((op, i) => keys.indexOf(op) !== i)).toEqual([]);
  });

  it("puts each endpoint in the toolset for its spec tag", () => {
    const tagOf = new Map(spec.operations.map((op) => [key(op), op.tag]));
    const misplaced = ALL_ENDPOINTS.filter((def) => TAG_TOOLSET[tagOf.get(key(def)) ?? ""] !== def.toolset).map(
      (def) => `${def.name} (${def.toolset}) for tag ${tagOf.get(key(def))}`,
    );
    expect(misplaced).toEqual([]);
  });

  it("uses the v3 API for giveaways and v2 everywhere else", () => {
    const wrong = ALL_ENDPOINTS.filter(
      (def) => (def.version ?? "v2") !== (def.path.startsWith("/giveaways/") ? "v3" : "v2"),
    ).map((def) => def.name);
    expect(wrong).toEqual([]);
  });

  it("has consistent, uniquely named definitions", () => {
    const problems = ALL_ENDPOINTS.flatMap((def) => endpointProblems(def).map((p) => `${def.name}: ${p}`));
    expect(problems).toEqual([]);
    const names = ALL_ENDPOINTS.map((def) => def.name);
    expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([]);
  });

  it("gives every endpoint a title and a real description", () => {
    const thin = ALL_ENDPOINTS.filter((def) => def.title.trim() === "" || def.description.trim().length < 20).map(
      (def) => def.name,
    );
    expect(thin).toEqual([]);
  });
});
