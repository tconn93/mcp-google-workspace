/**
 * Google Workspace MCP Server — Entry Point (Streamable HTTP Transport)
 *
 * Uses the high-level McpServer API to register tools with Zod schemas.
 * Transport: StreamableHTTPServerTransport (MCP spec-compliant HTTP)
 *
 * Endpoints:
 *   POST   /mcp  — initialize a session or send JSON-RPC messages
 *   GET    /mcp  — open SSE stream for server-initiated notifications
 *   DELETE /mcp  — terminate a session
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { ZodError } from 'zod';

import { tools } from './tools.js';
import { callTool } from './appscript-client.js';

// ---------------------------------------------------------------------------
// MCP server factory — one instance per session
// ---------------------------------------------------------------------------

function createMcpServer(): McpServer {
    const server = new McpServer(
        { name: 'mcp-google-workspace', version: '1.0.0' },
        { capabilities: { tools: {} } }
    );

    for (const { name, description, schema } of tools) {
        server.registerTool(
            name,
            { description, inputSchema: schema.shape },
            async (args: Record<string, unknown>) => {
                // McpServer already validates against the Zod shape, but we
                // parse again to apply defaults and coerce types (e.g. optional
                // fields with .default()) before forwarding to Apps Script.
                let params: Record<string, unknown>;
                try {
                    params = schema.parse(args) as Record<string, unknown>;
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
            }
        );
    }

    return server;
}

// ---------------------------------------------------------------------------
// HTTP server + session management
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const app = express();
app.use(express.json());

// Active transports keyed by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

// POST /mcp — initialize or continue a session
app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports.has(sessionId)) {
            transport = transports.get(sessionId)!;
        } else if (!sessionId && isInitializeRequest(req.body)) {
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id) => {
                    transports.set(id, transport);
                    process.stderr.write(`Session initialized: ${id}\n`);
                },
            });

            transport.onclose = () => {
                const id = transport.sessionId;
                if (id) {
                    transports.delete(id);
                    process.stderr.write(`Session closed: ${id}\n`);
                }
            };

            await createMcpServer().connect(transport);
        } else {
            res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Bad Request: missing or invalid session ID' },
                id: null,
            });
            return;
        }

        await transport.handleRequest(req, res, req.body);
    } catch (err) {
        process.stderr.write(`Error handling POST /mcp: ${(err as Error).message}\n`);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: { code: -32603, message: 'Internal server error' },
                id: null,
            });
        }
    }
});

// GET /mcp — SSE stream for server-initiated notifications
app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
        res.status(400).send('Invalid or missing Mcp-Session-Id header');
        return;
    }
    await transports.get(sessionId)!.handleRequest(req, res);
});

// DELETE /mcp — terminate a session
app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
        res.status(400).send('Invalid or missing Mcp-Session-Id header');
        return;
    }
    await transports.get(sessionId)!.handleRequest(req, res);
});

// ---------------------------------------------------------------------------
// Start + graceful shutdown
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
    process.stderr.write(`Google Workspace MCP server listening on http://localhost:${PORT}/mcp\n`);
});

process.on('SIGINT', async () => {
    process.stderr.write('Shutting down...\n');
    for (const [id, transport] of transports) {
        try { await transport.close(); } catch { /* ignore */ }
        transports.delete(id);
    }
    process.exit(0);
});
