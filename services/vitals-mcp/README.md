# vitals-mcp

The MCP server that lets an agent work on Vitals incidents.
It is a thin, model-free boundary: every tool is one or two GraphQL operations against the dashboard's `/api/graphql`, sent with the service token, so an agent can do exactly what the schema allows and nothing more.
Nothing here calls a model; the agent that calls these tools is the one that thinks.

## Tools

| Tool | Input | What it does |
| --- | --- | --- |
| `list_open_incidents` | `siteId` (default `"demo"`), `status` (default `OPEN`) | Lists a site's incidents in one status, each with a one-line evidence summary. |
| `get_incident_context` | `incidentId` | Everything about one incident as JSON: evidence, device and connection breakdown, steps so far, the latest proposed fix revision (number, author, summary, whether a review covers it, its files), the person's note, and for a health check the check's last 20 observations. |
| `record_step` | `incidentId`, `role` (`summarize`, `propose-fix`, `review`, `open-pr`), `status` (`running`, `succeeded`, `failed`), `summary`, and optional `detail`, `startedAt`, `finishedAt`, `model`, `inputTokens`, `outputTokens`, `costUsd`, `link` | Appends a step to the incident's timeline. The `human` role is not offered: a person decides on the incident page. |
| `submit_fix` | `incidentId`, `targetRepo`, `baseSha`, `summary`, `files` (each `path`, `action` (`add`, `modify`, `delete`), optional `before` and `after`) | Proposes a change as whole file contents read at `baseSha`; the server derives the diff a person reviews and edits. Writes the next revision and returns its `id` and `number` with the incident page's URL. At most 20 files and 200,000 bytes per content. |
| `request_human_review` | `incidentId`, `summary` | Moves a `REVIEWED` incident to `AWAITING_HUMAN` and returns the incident page's URL for the person. Records no step itself. |

Approving and dismissing are deliberately absent: those are a person's decisions.
A refused call (wrong token, illegal status move, unknown id) comes back as a tool result with `isError: true` and the server's message, so the agent can read it and react.

## Running it

The dashboard must be running with a service token set, and the MCP server needs the same token:

```bash
export VITALS_SERVICE_TOKEN=$(openssl rand -hex 32)
npm run dev                # the dashboard, in one terminal
npm run mcp:vitals         # the MCP server on stdio, for a quick manual start
```

Claude Code picks the server up from the repo's `.mcp.json`, which runs `npx tsx services/vitals-mcp/main.ts` and passes the two variables through from your environment.
Start Claude Code from a shell where `VITALS_SERVICE_TOKEN` is exported.

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITALS_URL` | `http://localhost:3000` | The dashboard's origin; tool results link to pages under it. |
| `VITALS_SERVICE_TOKEN` | none, required | Sent as `Authorization: Bearer`; the server exits with an error when it is missing. |

stdout carries the MCP protocol, so the server writes its diagnostics to stderr only.

## Files

- `client.ts`: the GraphQL-over-HTTP client, with an injectable `fetch` for tests.
- `documents.ts`: the operations, typed by `npm run codegen`.
- `tools.ts`: each tool's description, input schema, and handler.
- `server.ts`: registers the tools on an `McpServer`, transport-free.
- `main.ts`: the stdio entry point.
- `tools.test.ts`: drives the tools through a real MCP client against the real schema on an in-memory database.
