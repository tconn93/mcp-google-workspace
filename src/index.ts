import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getAuthClient } from './auth.js';
import { listGmailMessages } from './tools/gmail.js';
import { getCalendarEvents } from './tools/calendar.js';
import { searchDrive } from './tools/drive.js';
import { createDoc } from './tools/docs.js';

async function main(): Promise<void> {
  // Authenticate with Google once at startup
  let auth;
  try {
    auth = await getAuthClient();
  } catch (err) {
    process.stderr.write(`[mcp-google-workspace] ${(err as Error).message}\n`);
    process.exit(1);
  }

  const server = new McpServer({
    name: 'mcp-google-workspace',
    version: '1.0.0',
  });

  // ── Gmail ─────────────────────────────────────────────────────────────────
  server.tool(
    'list_gmail_messages',
    'Retrieves a list of recent emails from the authenticated Gmail account. ' +
    'Supports Gmail search queries to filter messages.',
    {
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .default(10)
        .describe('Maximum number of messages to return (1-500, default 10)'),
      q: z
        .string()
        .optional()
        .describe(
          'Gmail search query (e.g. "from:alice@example.com", "subject:meeting", "is:unread")'
        ),
    },
    async ({ maxResults, q }) => {
      try {
        const messages = await listGmailMessages(auth, { maxResults, q });
        return {
          content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Calendar ──────────────────────────────────────────────────────────────
  server.tool(
    'get_calendar_events',
    'Fetches upcoming events from a Google Calendar. Defaults to the primary calendar ' +
    'and events starting from the current time.',
    {
      calendarId: z
        .string()
        .optional()
        .default('primary')
        .describe('Calendar ID to fetch events from. Use "primary" for the main calendar.'),
      timeMin: z
        .string()
        .optional()
        .describe(
          'Lower bound (inclusive) for event start times as an ISO 8601 date-time string ' +
          '(e.g. "2024-01-01T00:00:00Z"). Defaults to the current time.'
        ),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(2500)
        .optional()
        .default(10)
        .describe('Maximum number of events to return (default 10)'),
    },
    async ({ calendarId, timeMin, maxResults }) => {
      try {
        const events = await getCalendarEvents(auth, { calendarId, timeMin, maxResults });
        return {
          content: [{ type: 'text', text: JSON.stringify(events, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Drive ─────────────────────────────────────────────────────────────────
  server.tool(
    'search_drive',
    'Searches for files and folders in Google Drive using the Drive query syntax.',
    {
      query: z
        .string()
        .min(1)
        .describe(
          'Drive search query string. Supports Drive query syntax, e.g. ' +
          '"name contains \'budget\'", "mimeType=\'application/vnd.google-apps.document\'"'
        ),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .default(10)
        .describe('Maximum number of files to return (default 10)'),
    },
    async ({ query, maxResults }) => {
      try {
        const files = await searchDrive(auth, { query, maxResults });
        return {
          content: [{ type: 'text', text: JSON.stringify(files, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Docs ──────────────────────────────────────────────────────────────────
  server.tool(
    'create_doc',
    'Creates a new Google Document with the specified title and plain-text content. ' +
    'Returns the document ID and a link to open it.',
    {
      title: z.string().min(1).describe('The title of the new Google Document.'),
      content: z
        .string()
        .describe('The plain-text content to insert into the document body.'),
    },
    async ({ title, content }) => {
      try {
        const doc = await createDoc(auth, { title, content });
        return {
          content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // Start the server with stdio transport (for Claude Desktop / Cursor)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write('[mcp-google-workspace] Server started and listening on stdio.\n');
}

main().catch((err) => {
  process.stderr.write(`[mcp-google-workspace] Fatal error: ${err.message}\n`);
  process.exit(1);
});
