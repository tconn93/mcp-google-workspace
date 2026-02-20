import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';

export const SearchDriveSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'Drive search query string. Supports Drive query syntax, e.g. ' +
      '"name contains \'budget\'", "mimeType=\'application/vnd.google-apps.document\'", ' +
      '"modifiedTime > \'2024-01-01\'"'
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(10)
    .describe('Maximum number of files to return (default 10)'),
});

export type SearchDriveInput = z.infer<typeof SearchDriveSchema>;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: string;
  webViewLink: string;
  owners: string[];
  parents: string[];
}

export async function searchDrive(
  auth: OAuth2Client,
  input: SearchDriveInput
): Promise<DriveFile[]> {
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.list({
    q: input.query,
    pageSize: input.maxResults,
    fields:
      'files(id, name, mimeType, modifiedTime, size, webViewLink, owners, parents)',
    orderBy: 'modifiedTime desc',
  });

  const files = response.data.files ?? [];

  return files.map((file) => ({
    id: file.id ?? '',
    name: file.name ?? '',
    mimeType: file.mimeType ?? '',
    modifiedTime: file.modifiedTime ?? '',
    size: file.size ?? '0',
    webViewLink: file.webViewLink ?? '',
    owners: (file.owners ?? []).map((o) => o.emailAddress ?? '').filter(Boolean),
    parents: file.parents ?? [],
  }));
}
