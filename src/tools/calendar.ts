import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GetCalendarEventsInput {
  calendarId?: string;
  timeMin?: string;
  maxResults?: number;
}

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
    calendarId: input.calendarId ?? 'primary',
    timeMin,
    maxResults: input.maxResults ?? 10,
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
