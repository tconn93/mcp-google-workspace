import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface SearchDriveInput {
  query: string;
  maxResults?: number;
}

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
    pageSize: input.maxResults ?? 10,
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
