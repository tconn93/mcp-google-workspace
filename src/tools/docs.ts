import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';

export const CreateDocSchema = z.object({
  title: z.string().min(1).describe('The title of the new Google Document.'),
  content: z
    .string()
    .describe('The plain-text content to insert into the document body.'),
});

export type CreateDocInput = z.infer<typeof CreateDocSchema>;

interface CreatedDoc {
  documentId: string;
  title: string;
  url: string;
}

export async function createDoc(
  auth: OAuth2Client,
  input: CreateDocInput
): Promise<CreatedDoc> {
  const docs = google.docs({ version: 'v1', auth });

  // Step 1: Create the document with the specified title
  const createResponse = await docs.documents.create({
    requestBody: {
      title: input.title,
    },
  });

  const documentId = createResponse.data.documentId;
  if (!documentId) {
    throw new Error('Failed to create document: no documentId returned');
  }

  // Step 2: Insert content into the document body
  if (input.content.length > 0) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: {
                // Index 1 is the start of the document body (after the implicit \n)
                index: 1,
              },
              text: input.content,
            },
          },
        ],
      },
    });
  }

  return {
    documentId,
    title: input.title,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}
