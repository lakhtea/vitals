// The stdio entry point Claude Code (or any MCP host) launches: it reads the
// dashboard URL and service token from the environment and serves the tools on
// stdin/stdout. stdout carries the protocol, so diagnostics go to stderr only.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createVitalsClient } from "./client";
import { createVitalsMcpServer } from "./server";

const DEFAULT_VITALS_URL = "http://localhost:3000";

const main = async (): Promise<void> => {
  const url = process.env.VITALS_URL?.trim() || DEFAULT_VITALS_URL;
  const serviceToken = process.env.VITALS_SERVICE_TOKEN?.trim();
  if (!serviceToken) {
    console.error(
      "vitals-mcp: VITALS_SERVICE_TOKEN is not set. Set it to the same value the dashboard was started with; " +
        "the agent mutations refuse requests without it.",
    );
    process.exit(1);
  }

  const client = createVitalsClient({ url, serviceToken });
  const server = createVitalsMcpServer({ client, baseUrl: url });
  await server.connect(new StdioServerTransport());
  console.error(`vitals-mcp: serving 4 tools over stdio against ${url}`);
};

main().catch((error: unknown) => {
  console.error("vitals-mcp: failed to start:", error);
  process.exit(1);
});
