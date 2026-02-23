/**
 * Google Workspace MCP Server — Entry Point (stdio Transport)
 *
 * Uses the low-level Server API with manual request handlers.
 * Transport: StdioServerTransport (communicates over stdin/stdout)
 */

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ZodError } from 'zod';

import { tools } from './tools.js';
import { callTool } from './appscript-client.js';

// ---------------------------------------------------------------------------
// Build the MCP server
// ---------------------------------------------------------------------------

const server = new Server(
    { name: 'mcp-google-workspace', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

// tools/list — advertise all available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, schema }) => ({
        name,
        description,
        inputSchema: zodToJsonSchema(schema, { target: 'jsonSchema7' }),
    })),
}));

// tools/call — dispatch a tool call to Apps Script
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const tool = tools.find((t) => t.name === name);

    if (!tool) {
        return { content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }], isError: true };
    }

    let params: Record<string, unknown>;
    try {
        params = tool.schema.parse(args) as Record<string, unknown>;
    } catch (err) {
        const msg = err instanceof ZodError
            ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
            : String(err);
        return { content: [{ type: 'text' as const, text: `Invalid params: ${msg}` }], isError: true };
    }

    try {
        const result = await callTool(name, params);
        return {
            content: [{
                type: 'text' as const,
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            }],
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: message }], isError: true };
    }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('Google Workspace MCP server running on stdio\n');
