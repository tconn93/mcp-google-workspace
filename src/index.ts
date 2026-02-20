import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getAuthClient } from './auth.js';
import {
  ListGmailMessagesSchema,
  listGmailMessages,
} from './tools/gmail.js';
import {
  GetCalendarEventsSchema,
  getCalendarEvents,
} from './tools/calendar.js';
import {
  SearchDriveSchema,
  searchDrive,
} from './tools/drive.js';
import {
  CreateDocSchema,
  createDoc,
} from './tools/docs.js';

async function main(): Promise<void> {
  // Authenticate with Google once at startup
  let auth;
  try {
    auth = await getAuthClient();
  } catch (err) {
    // Print the auth instructions to stderr so they appear in the client logs
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
    ListGmailMessagesSchema.shape,
    async (input) => {
      try {
        const messages = await listGmailMessages(auth, input as Parameters<typeof listGmailMessages>[1]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(messages, null, 2),
            },
          ],
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
    GetCalendarEventsSchema.shape,
    async (input) => {
      try {
        const events = await getCalendarEvents(auth, input as Parameters<typeof getCalendarEvents>[1]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(events, null, 2),
            },
          ],
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
    SearchDriveSchema.shape,
    async (input) => {
      try {
        const files = await searchDrive(auth, input as Parameters<typeof searchDrive>[1]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(files, null, 2),
            },
          ],
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
    CreateDocSchema.shape,
    async (input) => {
      try {
        const doc = await createDoc(auth, input as Parameters<typeof createDoc>[1]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(doc, null, 2),
            },
          ],
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
