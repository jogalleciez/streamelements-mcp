export const TOOLSETS = [
  "activities",
  "bot",
  "commands",
  "timers",
  "filters",
  "channels",
  "chatstats",
  "contests",
  "giveaways",
  "loyalty",
  "overlays",
  "sessions",
  "songrequests",
  "store",
  "themes",
  "tips",
] as const;

export type Toolset = (typeof TOOLSETS)[number];

/** OAuth2 scope family each toolset needs, used to explain 403 responses to OAuth users. */
export const TOOLSET_SCOPES: Record<Toolset, string | undefined> = {
  activities: "activities:read / activities:write",
  bot: "bot:read / bot:write",
  commands: "bot:read / bot:write",
  timers: "bot:read / bot:write",
  filters: "bot:read / bot:write",
  channels: "channel:read",
  chatstats: undefined,
  contests: "contest:read / contest:write",
  giveaways: "giveaway:read / giveaway:write",
  loyalty: "loyalty:read / loyalty:write",
  overlays: "overlays:read / overlays:write",
  sessions: "session:read",
  songrequests: undefined,
  store: "store:read / store:write",
  themes: undefined,
  tips: "tips:read / tips:write",
};

function isToolset(name: string): name is Toolset {
  return (TOOLSETS as readonly string[]).includes(name);
}

/** Parses an SE_TOOLSETS value ("all", or a comma list). Unset or blank means all toolsets. */
export function parseToolsets(raw: string | undefined): Set<Toolset> {
  const trimmed = raw?.trim().toLowerCase() ?? "";
  if (trimmed === "" || trimmed === "all") {
    return new Set(TOOLSETS);
  }
  const names = trimmed
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  if (names.length === 0) {
    throw new Error("SE_TOOLSETS names no toolsets; set it to 'all' or a comma-separated list of toolsets.");
  }
  const toolsets = new Set<Toolset>();
  for (const name of names) {
    if (!isToolset(name)) {
      throw new Error(`Unknown toolset "${name}" in SE_TOOLSETS. Valid toolsets: ${TOOLSETS.join(", ")}.`);
    }
    toolsets.add(name);
  }
  return toolsets;
}
