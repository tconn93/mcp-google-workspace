/**
 * Tool definitions for the Google Workspace MCP server.
 *
 * Each entry in the exported `tools` array bundles:
 *  - name        — the tool identifier sent to Apps Script
 *  - description — shown to the AI client in tools/list
 *  - schema      — Zod object schema; McpServer derives JSON Schema from it automatically
 *
 * No separate JSON Schema toolDefinitions array is needed with McpServer.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const toolSchemas = {
    // -- Gmail ----------------------------------------------------------------

    gmail_search: z.object({
        query: z.string().describe('Gmail search query (same syntax as the Gmail search bar)'),
        maxResults: z.number().int().min(1).max(50).optional().default(10)
            .describe('Maximum number of threads to return (1-50, default 10)'),
    }),

    gmail_get_message: z.object({
        messageId: z.string().describe('The Gmail message ID to retrieve'),
    }),

    gmail_send_draft: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject'),
        body: z.string().describe('Plain text email body'),
        cc: z.string().optional().describe('CC recipients (comma-separated)'),
        bcc: z.string().optional().describe('BCC recipients (comma-separated)'),
    }),

    gmail_get_messages: z.object({
        query: z.string().describe('Gmail search query (e.g. "is:unread", "from:boss@company.com")'),
        maxResults: z.number().int().min(1).max(20).optional().default(5)
            .describe('Max threads to expand, each with all messages (1-20, default 5)'),
    }),

    gmail_modify_message: z.object({
        messageId: z.string().describe('The Gmail message ID to modify'),
        markRead: z.boolean().optional().describe('true = mark as read, false = mark as unread'),
        star: z.boolean().optional().describe('true = star the message, false = unstar'),
        trash: z.boolean().optional().describe('true = move the message to Trash'),
        archive: z.boolean().optional().describe('true = archive the thread (remove from Inbox)'),
    }),

    gmail_label_message: z.object({
        threadId: z.string().describe('The Gmail thread ID to label'),
        labelName: z.string().describe('Label name to apply or remove. Created automatically on "add" if it does not exist.'),
        action: z.enum(['add', 'remove']).describe('"add" to apply the label, "remove" to remove it'),
    }),

    // -- Calendar -------------------------------------------------------------

    calendar_list_events: z.object({
        calendarId: z.string().optional().default('primary').describe('Calendar ID (default: "primary")'),
        timeMin: z.string().optional().describe('Start of time range in ISO 8601 format (defaults to now)'),
        timeMax: z.string().optional().describe('End of time range in ISO 8601 format'),
        maxResults: z.number().int().min(1).max(50).optional().default(10).describe('Max events to return (1-50, default 10)'),
    }),

    calendar_create_event: z.object({
        title: z.string().describe('Event title / summary'),
        start: z.string().describe('Event start time in ISO 8601 format'),
        end: z.string().describe('Event end time in ISO 8601 format'),
        calendarId: z.string().optional().default('primary').describe('Calendar ID (default: "primary")'),
        description: z.string().optional().describe('Event description'),
        location: z.string().optional().describe('Event location'),
        attendees: z.array(z.string()).optional().describe('List of attendee email addresses'),
        sendInvites: z.boolean().optional().default(true).describe('Whether to send invite emails (default: true)'),
    }),

    calendar_smart_search: z.object({
        startDate: z.string().describe('Start of the date range in ISO 8601 format (e.g. "2026-02-20")'),
        endDate: z.string().describe('End of the date range in ISO 8601 format (e.g. "2026-02-27")'),
    }),

    calendar_check_conflicts: z.object({
        proposedStart: z.string().describe('Proposed event start time in ISO 8601 format'),
        proposedEnd: z.string().describe('Proposed event end time in ISO 8601 format'),
    }),

    calendar_quick_add: z.object({
        text: z.string().describe('Natural-language event description (e.g. "Lunch with Sarah next Tuesday at 1pm")'),
        calendarId: z.string().optional().default('primary').describe('Calendar ID (default: "primary")'),
    }),

    calendar_daily_briefing: z.object({
        date: z.string().optional().describe('Date in ISO 8601 format (e.g. "2026-02-20"). Defaults to today.'),
    }),

    calendar_block_focus_time: z.object({
        durationMinutes: z.number().int().min(15).describe('Focus block length in minutes (e.g. 90 for 1.5 hours)'),
        withinNextNDays: z.number().int().min(1).max(30).optional().default(7)
            .describe('Days ahead to scan for a free slot (default: 7, max: 30). Weekdays 9 AM–6 PM only.'),
        calendarId: z.string().optional().default('primary').describe('Calendar to book the focus block on (default: "primary")'),
    }),

    // -- Drive ----------------------------------------------------------------

    drive_search: z.object({
        query: z.string().describe("Drive search query (e.g. \"name contains 'report'\" or \"mimeType='application/vnd.google-apps.document'\")"),
        maxResults: z.number().int().min(1).max(50).optional().default(10).describe('Max files to return (1-50, default 10)'),
    }),

    drive_get_file: z.object({
        fileId: z.string().describe('The Drive file ID'),
    }),

    drive_export_file: z.object({
        fileId: z.string().describe('The Drive file ID to export'),
        mimeType: z.string().optional().default('text/plain')
            .describe('Target MIME type (default: "text/plain"). Use "application/pdf" for PDFs. Binary files are returned as base64.'),
    }),

    drive_list_folder: z.object({
        folderId: z.string().describe('The Drive folder ID to list. Use "root" for My Drive root.'),
        maxResults: z.number().int().min(1).max(100).optional().default(50).describe('Max items to return (default: 50)'),
    }),

    drive_read_doc_markdown: z.object({
        fileId: z.string().describe('The Google Doc file ID to convert to Markdown'),
    }),

    drive_read_sheet_csv: z.object({
        fileId: z.string().describe('The Google Sheets file ID to export as CSV'),
        sheetName: z.string().optional().describe('Sheet/tab name (defaults to the active sheet)'),
        range: z.string().optional().describe('A1 notation range (e.g. "A1:E20"). Defaults to all data.'),
    }),

    drive_slides_as_text: z.object({
        fileId: z.string().describe('The Google Slides file ID to extract text from'),
    }),

    drive_organize_files: z.object({
        fileIds: z.array(z.string()).min(1).describe('Array of Drive file IDs to move'),
        targetFolderId: z.string().describe('The destination folder ID'),
    }),

    drive_create_shortcut: z.object({
        fileId: z.string().describe('The Drive file ID to create a shortcut for'),
        folderId: z.string().describe('Folder ID where the shortcut is placed. Use "root" for My Drive root.'),
    }),

    drive_manage_permissions: z.object({
        fileId: z.string().describe('The Drive file ID to manage permissions for'),
        email: z.string().email().describe('Email address of the user to grant or revoke access'),
        role: z.enum(['viewer', 'commenter', 'editor']).optional().default('viewer')
            .describe('Access level (default: "viewer"). Only used when action is "add".'),
        action: z.enum(['add', 'remove']).describe('"add" to grant access, "remove" to revoke it'),
    }),

    drive_summarize_folder: z.object({
        folderId: z.string().describe('The Drive folder ID to summarize. Use "root" for My Drive root.'),
        maxFiles: z.number().int().min(1).max(20).optional().default(10).describe('Max files to include (default: 10, max: 20)'),
    }),

    drive_find_and_replace: z.object({
        fileIds: z.array(z.string()).min(1).describe('Array of Google Doc file IDs to run find-and-replace on'),
        find: z.string().describe('Text (or regex) to search for'),
        replace: z.string().describe('Replacement text'),
    }),

    // -- Docs -----------------------------------------------------------------

    docs_create: z.object({
        title: z.string().describe('Title for the new Google Doc'),
        content: z.string().optional().describe('Initial body text for the document'),
    }),

    docs_get: z.object({
        docId: z.string().describe('The Google Doc ID'),
    }),

    docs_append: z.object({
        docId: z.string().describe('The Google Doc ID to append to'),
        content: z.string().describe('The text content to append'),
        addNewline: z.boolean().optional().default(true).describe('Add a blank line before the appended content (default: true)'),
    }),
} as const;

export type ToolName = keyof typeof toolSchemas;
export type ToolInput<T extends ToolName> = z.infer<typeof toolSchemas[T]>;

// ---------------------------------------------------------------------------
// Descriptions (co-located here so McpServer can use them)
// ---------------------------------------------------------------------------

const toolDescriptions: Record<ToolName, string> = {
    gmail_search: 'Search Gmail threads using the same query syntax as the Gmail search bar. Returns thread metadata including subject, sender, date, and read status.',
    gmail_get_message: 'Retrieve the full content of a single Gmail message by its ID, including headers, plain-text body, and attachment metadata.',
    gmail_send_draft: 'Create a Gmail draft and immediately send it.',
    gmail_get_messages: 'Bulk-fetch full message content (subject, headers, body, attachments) for all emails matching a Gmail search query. Ideal for "get all unread emails" type requests.',
    gmail_modify_message: 'Modify the state of a Gmail message: mark it read/unread, star/unstar it, move it to trash, or archive its thread.',
    gmail_label_message: 'Apply or remove a named Gmail label on a thread. The label is created automatically if it does not exist.',
    calendar_list_events: 'List upcoming Google Calendar events within a time range.',
    calendar_create_event: 'Create a new Google Calendar event with optional attendees and send invites.',
    calendar_smart_search: 'Retrieve events in a date range and return a clean, noise-free summary. Ideal for understanding current commitments before scheduling.',
    calendar_check_conflicts: 'Check whether a proposed time window overlaps with any existing events. Returns isFree: true if the slot is open.',
    calendar_quick_add: "Create a calendar event from a natural-language description using Google's own parser.",
    calendar_daily_briefing: 'Get a clean, time-ordered briefing of all events for a given day across every owned calendar.',
    calendar_block_focus_time: 'Find the first available free slot and insert a 🛡️ Focus Time event. Checks all owned calendars for conflicts.',
    drive_search: 'Search for files and folders in Google Drive using Drive query syntax.',
    drive_get_file: 'Get metadata for a specific Google Drive file by its ID.',
    drive_export_file: 'Export or download the content of a Google Drive file. Google Workspace files are exported; binary files are returned as base64.',
    drive_list_folder: 'List the contents of a Google Drive folder (subfolders first, then files).',
    drive_read_doc_markdown: 'Convert a Google Doc to Markdown, preserving headings, bold/italic, lists, and tables.',
    drive_read_sheet_csv: 'Export a Google Sheet tab as CSV text.',
    drive_slides_as_text: 'Extract text from every shape in a Google Slides presentation, returned slide-by-slide.',
    drive_organize_files: 'Move one or more Drive files into a target folder.',
    drive_create_shortcut: 'Create a Drive shortcut to a file inside a specified folder.',
    drive_manage_permissions: "Grant or revoke a specific user's access to a Drive file. Supports viewer, commenter, and editor roles.",
    drive_summarize_folder: 'Get a briefing of a folder — returns names, descriptions, and types of files without reading full content.',
    drive_find_and_replace: 'Find and replace text (or regex) across an array of Google Docs in a single call.',
    docs_create: 'Create a new Google Doc with an optional initial body.',
    docs_get: 'Read the full content of a Google Doc, returning body text and structured paragraphs with heading styles.',
    docs_append: 'Append a paragraph of text to the end of an existing Google Doc.',
};

// ---------------------------------------------------------------------------
// Unified tools array — consumed by McpServer.registerTool() in index.ts
// ---------------------------------------------------------------------------

export const tools = (Object.keys(toolSchemas) as ToolName[]).map((name) => ({
    name,
    description: toolDescriptions[name],
    schema: toolSchemas[name],
}));
