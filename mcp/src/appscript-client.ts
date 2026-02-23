/**
 * AppScript HTTP Client
 *
 * Thin wrapper around fetch that POSTs { tool, params } to the deployed
 * Google Apps Script web app. Reads config from environment variables:
 *
 *   APPSCRIPT_URL    — The web app deployment URL
 *   APPSCRIPT_SECRET — The value set in Script Properties as MCP_SECRET
 */

import 'dotenv/config';

export interface ToolResult {
    ok: boolean;
    result?: unknown;
    error?: string;
    _status?: number;
}

function getConfig() {
    const url = process.env.APPSCRIPT_URL;
    const secret = process.env.APPSCRIPT_SECRET;

    if (!url) {
        throw new Error(
            'APPSCRIPT_URL environment variable is not set. ' +
            'Copy .env.example to .env and fill in your Apps Script web app URL.'
        );
    }
    if (!secret) {
        throw new Error(
            'APPSCRIPT_SECRET environment variable is not set. ' +
            'Copy .env.example to .env and fill in the MCP_SECRET you set in Script Properties.'
        );
    }

    return { url, secret };
}

/**
 * Call a tool on the Apps Script web app.
 *
 * @param tool   The tool name (e.g. "gmail_search")
 * @param params Tool parameters object
 * @returns      The parsed result from the Apps Script handler
 * @throws       An Error if the request fails or the web app returns an error
 */
export async function callTool(tool: string, params: Record<string, unknown>): Promise<unknown> {
    const { url, secret } = getConfig();

    // Apps Script web apps strip custom headers in some configurations,
    // so we pass the secret both as a header AND as a query parameter as fallback.
    const requestUrl = `${url}?secret=${encodeURIComponent(secret)}`;

    let response: Response;
    try {
        response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Secret': secret,
            },
            body: JSON.stringify({ tool, params }),
            // Follow redirects — Apps Script often issues a 302 before serving the response
            redirect: 'follow',
        });
    } catch (err) {
        throw new Error(`Network error calling Apps Script web app: ${(err as Error).message}`);
    }

    let data: ToolResult;
    try {
        data = (await response.json()) as ToolResult;
    } catch {
        const text = await response.text().catch(() => '(unreadable)');
        throw new Error(
            `Failed to parse JSON response from Apps Script (HTTP ${response.status}): ${text}`
        );
    }

    // The web app embeds the logical status in _status since ContentService
    // does not support setting arbitrary HTTP status codes.
    const status = data._status ?? response.status;

    if (status === 401) {
        throw new Error('Unauthorized: check that APPSCRIPT_SECRET matches MCP_SECRET in Script Properties.');
    }

    if (!data.ok || data.error) {
        throw new Error(`Apps Script error for tool "${tool}": ${data.error ?? 'Unknown error'}`);
    }

    return data.result;
}
