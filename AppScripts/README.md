# AppScripts — Google Workspace MCP

This directory contains the Google Apps Script project that acts as the backend for the MCP server. It is deployed as a **Web App** and handles all Google Workspace API calls.

---

## File Overview

| File | Purpose |
|---|---|
| `appsscript.json` | Project manifest — sets OAuth scopes and web app config |
| `Code.gs` | Entry point — `doPost()` dispatcher + auth guard |
| `Gmail.gs` | Gmail tools (search, get message, send draft) |
| `Calendar.gs` | Calendar tools (list events, create event) |
| `Drive.gs` | Drive tools (search, get file, export file) |
| `Docs.gs` | Docs tools (create, read, append) |

---

## Deployment Guide

### Step 1 — Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Give the project a name, e.g. `Google Workspace MCP`.

### Step 2 — Copy the Files

For each `.gs` file in this directory:
1. In the Apps Script editor, click **＋** next to "Files" to add a new script file.
2. Name it exactly (e.g. `Gmail`, `Calendar`, `Drive`, `Docs`).
3. Paste the corresponding file content.

For `Code.gs`, replace the default `myFunction()` stub with the contents of `Code.gs`.

For `appsscript.json`:
1. In the editor, click **Project Settings** (⚙️).
2. Check **Show "appsscript.json" manifest file in editor**.
3. Open `appsscript.json` and replace its content with the file from this directory.

### Step 3 — Set the Secret Token

1. In the editor, go to **Project Settings → Script Properties**.
2. Click **Add script property**.
3. Set **Property** = `MCP_SECRET` and **Value** = a strong random string (e.g. from `openssl rand -hex 32`).
4. Save.

> **Keep this value — you will need it for the MCP server `.env` file.**

### Step 4 — Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**.
3. Configure:
   - **Description**: `MCP Web App v1`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone` (the secret token handles auth)
4. Click **Deploy** and authorize the requested permissions.
5. Copy the **Web App URL** — you will need it for the MCP server `.env` file.

### Step 5 — (Re)deploying Updates

When you modify the script files:
1. Click **Deploy → Manage deployments**.
2. Click the pencil ✏️ icon next to your deployment.
3. Change **Version** to `New version`.
4. Click **Deploy**.

> The URL stays the same across versions.

---

## Available Tools

| Tool | Handler | Description |
|---|---|---|
| `gmail_search` | `Gmail.gs` | Search Gmail threads |
| `gmail_get_message` | `Gmail.gs` | Get a single Gmail message by ID |
| `gmail_send_draft` | `Gmail.gs` | Create and send a Gmail draft |
| `calendar_list_events` | `Calendar.gs` | List calendar events in a time range |
| `calendar_create_event` | `Calendar.gs` | Create a calendar event with optional attendees |
| `drive_search` | `Drive.gs` | Search Drive files by query |
| `drive_get_file` | `Drive.gs` | Get Drive file metadata by ID |
| `drive_export_file` | `Drive.gs` | Export/download file content |
| `docs_create` | `Docs.gs` | Create a new Google Doc |
| `docs_get` | `Docs.gs` | Read a Google Doc's content |
| `docs_append` | `Docs.gs` | Append text to an existing Google Doc |
