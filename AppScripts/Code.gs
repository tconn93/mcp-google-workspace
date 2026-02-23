/**
 * Google Workspace MCP - Apps Script Web App
 * Main entry point: handles all POST requests from the MCP server.
 *
 * Setup:
 *   1. In the Apps Script editor go to Project Settings → Script Properties
 *   2. Add a property named MCP_SECRET with a strong random value
 *   3. Deploy as a Web App (Execute as: Me, Access: Anyone)
 *   4. Copy the deployment URL into your MCP server's .env as APPSCRIPT_URL
 */

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Entry point for all HTTP POST requests from the MCP server.
 * Expected body: { "tool": "<toolName>", "params": { ... } }
 * Required header: X-Secret: <value of MCP_SECRET script property>
 */
function doPost(e) {
  try {
    // --- Auth ---
    const secret = PropertiesService.getScriptProperties().getProperty('MCP_SECRET');
    const incomingSecret = e.parameter['x-secret'] || (e.headers && e.headers['X-Secret']);

    // For web apps, headers arrive via e.parameter for custom headers
    // We accept the secret via query param ?secret= as a fallback for clients
    // that cannot set custom headers (e.g., testing via browser).
    const providedSecret = incomingSecret || e.parameter['secret'];

    if (!secret || providedSecret !== secret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // --- Parse body ---
    const body = JSON.parse(e.postData.contents);
    const tool = body.tool;
    const params = body.params || {};

    if (!tool) {
      return jsonResponse({ error: 'Missing "tool" field in request body' }, 400);
    }

    // --- Dispatch ---
    const result = dispatch(tool, params);
    return jsonResponse({ ok: true, result });

  } catch (err) {
    Logger.log('doPost error: ' + err.message + '\n' + err.stack);
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
}

/**
 * Routes a tool name to its handler function.
 */
function dispatch(tool, params) {
  switch (tool) {
    // Gmail
    case 'gmail_search':          return gmailSearch(params);
    case 'gmail_get_message':     return gmailGetMessage(params);
    case 'gmail_get_messages':    return gmailGetMessages(params);
    case 'gmail_modify_message':  return gmailModifyMessage(params);
    case 'gmail_label_message':   return gmailLabelMessage(params);
    case 'gmail_send_draft':      return gmailSendDraft(params);

    // Calendar
    case 'calendar_list_events':     return calendarListEvents(params);
    case 'calendar_create_event':    return calendarCreateEvent(params);
    case 'calendar_smart_search':    return calendarSmartSearch(params);
    case 'calendar_check_conflicts': return calendarCheckConflicts(params);
    case 'calendar_quick_add':       return calendarQuickAdd(params);
    case 'calendar_daily_briefing':  return calendarDailyBriefing(params);
    case 'calendar_block_focus_time':return calendarBlockFocusTime(params);

    // Drive
    case 'drive_search':              return driveSearch(params);
    case 'drive_get_file':            return driveGetFile(params);
    case 'drive_export_file':         return driveExportFile(params);
    case 'drive_list_folder':         return driveListFolder(params);
    case 'drive_read_doc_markdown':   return driveReadDocMarkdown(params);
    case 'drive_read_sheet_csv':      return driveReadSheetCsv(params);
    case 'drive_slides_as_text':      return driveSlidesAsText(params);
    case 'drive_organize_files':      return driveOrganizeFiles(params);
    case 'drive_create_shortcut':     return driveCreateShortcut(params);
    case 'drive_manage_permissions':  return driveManagePermissions(params);
    case 'drive_summarize_folder':    return driveSummarizeFolder(params);
    case 'drive_find_and_replace':    return driveFindAndReplace(params);

    // Docs
    case 'docs_create': return docsCreate(params);
    case 'docs_get':    return docsGet(params);
    case 'docs_append': return docsAppend(params);

    default:
      throw new Error('Unknown tool: ' + tool);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a value in a JSON ContentService response.
 */
function jsonResponse(data, statusCode) {
  // Apps Script ContentService does not support setting arbitrary HTTP status codes;
  // we embed the status in the JSON payload so the MCP server can inspect it.
  data._status = statusCode || 200;
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
