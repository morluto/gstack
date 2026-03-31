/**
 * MCP stdio server for gstack browse.
 *
 * Run by Factory Droid via `.factory/mcp.json`:
 *   { "command": "browse", "args": ["--mcp"] }
 *
 * Architecture:
 *   Factory Droid spawns browse --mcp
 *     → ensureServer() starts daemon (or connects to existing)
 *     → MCP stdio transport ←→ AI agent
 *     → Each tool call → daemon HTTP API → response
 *
 * Daemon lifecycle is handled by daemon.ts. The MCP server is stateless —
 * it reads state from the state file on each request in case the daemon
 * restarted between calls.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { COMMAND_SCHEMAS } from './mcp-schemas';
import { ensureServer, sendCommand, readState } from './daemon';
import type { ServerState } from './daemon';

const SERVER_NAME = 'gstack-browse';
const SERVER_VERSION = '0.1.0';

export async function main() {
  // Start (or connect to) the browse daemon
  let state = await ensureServer();

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  // Register every browse command as an MCP tool
  // Use registerTool() (not tool()) because it properly handles full ZodObject
  // schemas — the deprecated tool() overload has a heuristic check that rejects
  // Zod schemas with nested object values.
  for (const [cmd, entry] of Object.entries(COMMAND_SCHEMAS)) {
    server.registerTool(
      `browse_${cmd}`,
      {
        description: entry.description,
        inputSchema: entry.schema,
      },
      async (params: Record<string, unknown>) => {
        try {
          const result = await runCommand(state, cmd, params);
          return {
            content: [{ type: 'text', text: result }],
          };
        } catch (err: any) {
          return {
            content: [{ type: 'text', text: `Error: ${err.message}` }],
            isError: true,
          };
        }
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runCommand(
  state: ServerState,
  command: string,
  params: Record<string, unknown>,
): Promise<string> {
  // Build positional args from the schema's argOrder
  const entry = COMMAND_SCHEMAS[command];
  if (!entry) throw new Error(`Unknown command: ${command}`);

  const args: string[] = [];
  for (const key of entry.argOrder) {
    const val = params[key];
    if (val === undefined || val === null) {
      args.push('');
    } else if (typeof val === 'boolean') {
      args.push(val ? 'true' : 'false');
    } else if (typeof val === 'number') {
      args.push(String(val));
    } else {
      args.push(String(val));
    }
  }

  // Re-read state in case daemon restarted
  const currentState = readState();
  if (!currentState) throw new Error('Browse daemon state not found');

  return sendCommand(currentState, command, args);
}

main().catch((err) => {
  console.error(`[browse-mcp] ${err.message}`);
  process.exit(1);
});
