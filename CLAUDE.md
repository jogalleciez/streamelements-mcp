# StreamElements MCP Server

MCP server (TypeScript, stdio) exposing all 137 StreamElements REST endpoints as tools.

## Commands

- `npm test`: vitest. Includes the spec coverage test and an end-to-end stdio test that runs `npm run build` first.
- `npm run typecheck`
- `npm run build`: compiles `src/` to `build/`.
- `npm run inspector`: MCP Inspector against `build/index.js`.

## Layout

- `src/tools/<toolset>.ts`: declarative `EndpointDef` arrays, one file per toolset. `src/tools/index.ts` aggregates them into `ALL_ENDPOINTS`.
- `src/endpoint.ts`: `registerEndpoint`, which turns a def into an MCP tool. Also `buildRequest`, annotation defaults and `endpointProblems` validation.
- `src/client.ts`: `SEClient` (fetch, auth header, v2/v3 base URL, timeout, `/channels/me` channel lookup).
- `src/config.ts`: env parsing. `src/errors.ts`: `SEApiError` plus hints. `src/toolsets.ts`: toolset names and OAuth scopes.
- `spec/endpoints.json`: the 137 operations from the official spec. `test/coverage.test.ts` enforces a 1:1 mapping, toolset placement and API version.

## Conventions

- ESM with `.js` extensions in relative imports; 2-space indent; semicolons; double quotes.
- Error text pattern: `error instanceof Error ? error.message : String(error)`.
- Log only to stderr (`console.error`), because stdout is the MCP channel.
- Tool names: snake_case `<domain>_<action>`, max 40 characters.
- Every input in a def must be used exactly once: as a path placeholder, a `query` key, or a `body` key. `endpointProblems` enforces this at registration.
- `{channel}` paths get an automatic optional `channel` input. Never declare `channel` in `input` for those paths.
- Giveaway endpoints use `version: "v3"`; everything else uses v2.
- The official spec's descriptions and body schemas are unreliable. Write descriptions by hand and say when something is undocumented.
- New endpoint behavior needs a case in `test/tools.test.ts` with hand-written expected method, path, query and body.
- Tests inject a fake `fetch` (`test/helpers.ts`) and drive tools through a real MCP `Client` over `InMemoryTransport`.
