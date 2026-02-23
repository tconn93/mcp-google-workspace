# MCP Server — Google Workspace

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that gives AI clients (Claude Desktop, Cursor, etc.) access to Google Workspace via a deployed Google Apps Script web app.

---

## Architecture

```
AI Client (Claude / Cursor)
    ↕ MCP stdio
MCP Server (this package, Node.js)
    ↕ HTTPS POST { tool, params }
Apps Script Web App (AppScripts/)
    ↕ Internal APIs
Google Workspace (Gmail / Calendar / Drive / Docs)
```

---

## Prerequisites

- **Node.js** v18 or higher
- A deployed **Apps Script web app** (see `../AppScripts/README.md`)
- The **web app URL** and **secret token** from that deployment

---

## Setup

### 1. Install dependencies

```bash
cd mcp
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
APPSCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
APPSCRIPT_SECRET=your-strong-random-secret-here
```

### 3. Build

```bash
npm run build
```

The compiled output is written to `dist/`.

---

## Running

```bash
# After building:
node dist/index.js
```

For development with auto-recompile on changes:

```bash
npm run dev
```

---

## Configuring AI Clients

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/dist/index.js"],
      "env": {
        "APPSCRIPT_URL": "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
        "APPSCRIPT_SECRET": "your-strong-random-secret-here"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/dist/index.js"],
      "env": {
        "APPSCRIPT_URL": "...",
        "APPSCRIPT_SECRET": "..."
      }
    }
  }
}
```

---

## Available Tools

| Tool | Description |
|---|---|
| `gmail_search` | Search Gmail threads |
| `gmail_get_message` | Get a single Gmail message by ID |
| `gmail_send_draft` | Create and send a Gmail draft |
| `calendar_list_events` | List calendar events in a time range |
| `calendar_create_event` | Create a calendar event with optional attendees |
| `drive_search` | Search Drive files by query |
| `drive_get_file` | Get Drive file metadata by ID |
| `drive_export_file` | Export/download file content |
| `docs_create` | Create a new Google Doc |
| `docs_get` | Read a Google Doc's content |
| `docs_append` | Append text to an existing Google Doc |

---

## Project Structure

```
mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── tools.ts              # Tool definitions (Zod schemas + MCP Tool objects)
│   └── appscript-client.ts  # HTTP client for the Apps Script web app
├── dist/                     # Compiled output (git-ignored)
├── .env.example              # Environment variable template
├── package.json
└── tsconfig.json
```
