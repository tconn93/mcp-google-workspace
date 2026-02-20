import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface ListGmailMessagesInput {
  maxResults?: number;
  q?: string;
}

interface MessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  labelIds: string[];
}

function extractHeader(
  headers: Array<{ name?: string | null; value?: string | null }>,
  name: string
): string {
  return headers.find((h) => (h.name ?? '').toLowerCase() === name.toLowerCase())?.value ?? '';
}

export async function listGmailMessages(
  auth: OAuth2Client,
  input: ListGmailMessagesInput
): Promise<MessageSummary[]> {
  const gmail = google.gmail({ version: 'v1', auth });

  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults: input.maxResults ?? 10,
    q: input.q,
  });

  const messages = listResponse.data.messages ?? [];
  if (messages.length === 0) {
    return [];
  }

  // Fetch metadata for each message in parallel
  const details = await Promise.all(
    messages.map((msg) =>
      gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      })
    )
  );

  return details.map((res) => {
    const data = res.data;
    const headers = data.payload?.headers ?? [];
    return {
      id: data.id ?? '',
      threadId: data.threadId ?? '',
      snippet: data.snippet ?? '',
      subject: extractHeader(headers, 'Subject'),
      from: extractHeader(headers, 'From'),
      date: extractHeader(headers, 'Date'),
      labelIds: data.labelIds ?? [],
    };
  });
}
