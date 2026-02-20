import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';

export const GetCalendarEventsSchema = z.object({
  calendarId: z
    .string()
    .optional()
    .default('primary')
    .describe('Calendar ID to fetch events from. Use "primary" for the main calendar.'),
  timeMin: z
    .string()
    .optional()
    .describe(
      'Lower bound (inclusive) for event start times as an ISO 8601 date-time string ' +
      '(e.g. "2024-01-01T00:00:00Z"). Defaults to the current time.'
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(2500)
    .optional()
    .default(10)
    .describe('Maximum number of events to return (default 10)'),
});

export type GetCalendarEventsInput = z.infer<typeof GetCalendarEventsSchema>;

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  status: string;
  htmlLink: string;
  attendees: string[];
  organizer: string;
}

export async function getCalendarEvents(
  auth: OAuth2Client,
  input: GetCalendarEventsInput
): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: 'v3', auth });

  const timeMin = input.timeMin ?? new Date().toISOString();

  const response = await calendar.events.list({
    calendarId: input.calendarId,
    timeMin,
    maxResults: input.maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = response.data.items ?? [];

  return events.map((event) => ({
    id: event.id ?? '',
    summary: event.summary ?? '(No title)',
    description: event.description ?? '',
    location: event.location ?? '',
    start: event.start?.dateTime ?? event.start?.date ?? '',
    end: event.end?.dateTime ?? event.end?.date ?? '',
    status: event.status ?? '',
    htmlLink: event.htmlLink ?? '',
    attendees: (event.attendees ?? []).map((a) => a.email ?? '').filter(Boolean),
    organizer: event.organizer?.email ?? '',
  }));
}
