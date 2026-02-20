# Google Workspace MCP Server

An implementation of the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that provides AI models with secure, real-time access to Google Workspace tools (Gmail, Calendar, Drive, and Docs).

## 🚀 Features

* **📧 Gmail Integration:** Search threads, read messages, and draft replies.
* **📅 Calendar Management:** Check availability, list events, and schedule new meetings.
* **📂 Drive & Docs:** Search for files, export content, and create new documents.
* **🛡️ Secure OAuth2:** Built-in handling for Google Cloud authentication.
* **✅ Type-Safe:** Fully implemented in TypeScript using the official MCP SDK and Zod for schema validation.

## 🛠 Prerequisites

* **Node.js:** v18.x or higher
* **Google Cloud Project:** An active project with the Workspace APIs enabled.
* **OAuth2 Credentials:** A `credentials.json` file from your Google Cloud Console.

## 📦 Installation

1. **Clone the repository:**
```bash
git clone https://github.com/your-username/google-workspace-mcp.git
cd google-workspace-mcp

```


2. **Install dependencies:**
```bash
npm install

```


3. **Configure Environment Variables:**
Create a `.env` file in the root directory:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback

```


4. **Build the project:**
```bash
npm run build

```



## 🔌 Configuration for LLM Clients

To use this with a client like **Claude Desktop** or **Cursor**, add the following to your configuration file (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["/path/to/your/repo/build/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "...",
        "GOOGLE_CLIENT_SECRET": "...",
        "GOOGLE_REDIRECT_URI": "..."
      }
    }
  }
}

```

## 🛠 Available Tools

| Tool | Description | Input Parameters |
| --- | --- | --- |
| `list_gmail_messages` | Retrieves a list of recent emails. | `maxResults` (number), `q` (search query) |
| `get_calendar_events` | Fetches upcoming events from a specific calendar. | `calendarId` (string), `timeMin` (ISO date) |
| `search_drive` | Searches for files and folders in Google Drive. | `query` (string) |
| `create_doc` | Creates a new Google Document with specified content. | `title` (string), `content` (string) |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](https://www.google.com/search?q=LICENSE)

