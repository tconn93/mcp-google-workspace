import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';

export const ListGmailMessagesSchema = z.object({
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
});

export type ListGmailMessagesInput = z.infer<typeof ListGmailMessagesSchema>;

interface MessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  labelIds: string[];
}

function extractHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export async function listGmailMessages(
  auth: OAuth2Client,
  input: ListGmailMessagesInput
): Promise<MessageSummary[]> {
  const gmail = google.gmail({ version: 'v1', auth });

  // Fetch message list
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults: input.maxResults,
    q: input.q,
  });

  const messages = listResponse.data.messages ?? [];
  if (messages.length === 0) {
    return [];
  }

  // Fetch details for each message in parallel (metadata format for efficiency)
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
