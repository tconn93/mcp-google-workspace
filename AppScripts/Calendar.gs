/**
 * Google Calendar tools
 * All functions are called by the dispatcher in Code.gs
 */

// ---------------------------------------------------------------------------
// calendar_list_events
// Params: {
//   calendarId?: string,   // defaults to primary calendar
//   timeMin?: string,      // ISO 8601, defaults to now
//   timeMax?: string,      // ISO 8601
//   maxResults?: number    // defaults to 10, max 50
// }
// ---------------------------------------------------------------------------
function calendarListEvents(params) {
  const calendarId = params.calendarId || 'primary';
  const maxResults = Math.min(params.maxResults || 10, 50);
  const timeMin = params.timeMin ? new Date(params.timeMin) : new Date();
  const timeMax = params.timeMax ? new Date(params.timeMax) : null;

  var cal;
  if (calendarId === 'primary') {
    cal = CalendarApp.getDefaultCalendar();
  } else {
    cal = CalendarApp.getCalendarById(calendarId);
    if (!cal) throw new Error('Calendar not found: ' + calendarId);
  }

  var events;
  if (timeMax) {
    events = cal.getEvents(timeMin, timeMax);
  } else {
    // No timeMax — fetch next 90 days as a reasonable default
    const ninetyDaysOut = new Date(timeMin.getTime() + 90 * 24 * 60 * 60 * 1000);
    events = cal.getEvents(timeMin, ninetyDaysOut);
  }

  // Respect maxResults
  events = events.slice(0, maxResults);

  return events.map(function(ev) {
    return {
      eventId:     ev.getId(),
      title:       ev.getTitle(),
      description: ev.getDescription(),
      location:    ev.getLocation(),
      start:       ev.getStartTime().toISOString(),
      end:         ev.getEndTime().toISOString(),
      isAllDay:    ev.isAllDayEvent(),
      status:      ev.getMyStatus().toString(),
      attendees:   ev.getGuestList().map(function(g) {
        return { email: g.getEmail(), name: g.getName(), status: g.getGuestStatus().toString() };
      }),
      htmlLink:    'https://calendar.google.com/calendar/event?eid=' + ev.getId()
    };
  });
}

// ---------------------------------------------------------------------------
// calendar_create_event
// Params: {
//   title: string,
//   start: string,           // ISO 8601
//   end: string,             // ISO 8601
//   calendarId?: string,     // defaults to primary
//   description?: string,
//   location?: string,
//   attendees?: string[],    // array of email addresses
//   sendInvites?: boolean    // defaults to true
// }
// ---------------------------------------------------------------------------
function calendarCreateEvent(params) {
  if (!params.title) throw new Error('title is required');
  if (!params.start) throw new Error('start is required');
  if (!params.end)   throw new Error('end is required');

  const calendarId = params.calendarId || 'primary';
  var cal;
  if (calendarId === 'primary') {
    cal = CalendarApp.getDefaultCalendar();
  } else {
    cal = CalendarApp.getCalendarById(calendarId);
    if (!cal) throw new Error('Calendar not found: ' + calendarId);
  }

  const startDate = new Date(params.start);
  const endDate   = new Date(params.end);

  const options = {};
  if (params.description) options.description = params.description;
  if (params.location)    options.location    = params.location;
  if (params.attendees && params.attendees.length > 0) {
    options.guests = params.attendees.join(',');
    options.sendInvites = params.sendInvites !== false; // default true
  }

  const ev = cal.createEvent(params.title, startDate, endDate, options);

  return {
    eventId:  ev.getId(),
    title:    ev.getTitle(),
    start:    ev.getStartTime().toISOString(),
    end:      ev.getEndTime().toISOString(),
    htmlLink: 'https://calendar.google.com/calendar/event?eid=' + ev.getId()
  };
}

// ---------------------------------------------------------------------------
// calendar_smart_search
// Returns a clean, AI-friendly summary of events in a date range.
// Params: { startDate: string, endDate: string }
// ---------------------------------------------------------------------------
function calendarSmartSearch(params) {
  if (!params.startDate) throw new Error('startDate is required');
  if (!params.endDate)   throw new Error('endDate is required');

  const start = new Date(params.startDate);
  const end   = new Date(params.endDate);
  if (isNaN(start.getTime())) throw new Error('Invalid startDate: ' + params.startDate);
  if (isNaN(end.getTime()))   throw new Error('Invalid endDate: '   + params.endDate);

  const cal = CalendarApp.getDefaultCalendar();
  const events = cal.getEvents(start, end);

  return events.map(function(ev) {
    return {
      eventId:     ev.getId(),
      title:       ev.getTitle(),
      description: ev.getDescription() || '',
      location:    ev.getLocation()    || '',
      start:       ev.getStartTime().toISOString(),
      end:         ev.getEndTime().toISOString(),
      isAllDay:    ev.isAllDayEvent(),
      attendees:   ev.getGuestList().map(function(g) {
        return { name: g.getName(), email: g.getEmail() };
      })
    };
  });
}

// ---------------------------------------------------------------------------
// calendar_check_conflicts
// Checks all owned calendars for events overlapping a proposed time window.
// Params: { proposedStart: string, proposedEnd: string }
// ---------------------------------------------------------------------------
function calendarCheckConflicts(params) {
  if (!params.proposedStart) throw new Error('proposedStart is required');
  if (!params.proposedEnd)   throw new Error('proposedEnd is required');

  const start = new Date(params.proposedStart);
  const end   = new Date(params.proposedEnd);
  if (isNaN(start.getTime())) throw new Error('Invalid proposedStart');
  if (isNaN(end.getTime()))   throw new Error('Invalid proposedEnd');

  const allCalendars = CalendarApp.getAllOwnedCalendars();
  var conflicts = [];

  allCalendars.forEach(function(cal) {
    var events = cal.getEvents(start, end);
    events.forEach(function(ev) {
      conflicts.push({
        calendarName: cal.getName(),
        eventId:      ev.getId(),
        title:        ev.getTitle(),
        start:        ev.getStartTime().toISOString(),
        end:          ev.getEndTime().toISOString()
      });
    });
  });

  return {
    proposedStart: start.toISOString(),
    proposedEnd:   end.toISOString(),
    isFree:        conflicts.length === 0,
    conflictCount: conflicts.length,
    conflicts:     conflicts
  };
}

// ---------------------------------------------------------------------------
// calendar_quick_add
// Creates an event from a natural-language description using Google's parser.
// Params: { text: string, calendarId?: string }
// ---------------------------------------------------------------------------
function calendarQuickAdd(params) {
  if (!params.text) throw new Error('text is required');

  var cal;
  if (params.calendarId && params.calendarId !== 'primary') {
    cal = CalendarApp.getCalendarById(params.calendarId);
    if (!cal) throw new Error('Calendar not found: ' + params.calendarId);
  } else {
    cal = CalendarApp.getDefaultCalendar();
  }

  const ev = cal.createEventFromDescription(params.text);

  return {
    eventId:     ev.getId(),
    title:       ev.getTitle(),
    description: ev.getDescription() || '',
    start:       ev.getStartTime().toISOString(),
    end:         ev.getEndTime().toISOString(),
    isAllDay:    ev.isAllDayEvent(),
    htmlLink:    'https://calendar.google.com/calendar/event?eid=' + ev.getId()
  };
}

// ---------------------------------------------------------------------------
// calendar_daily_briefing
// Returns a clean, time-ordered text briefing of a day's events.
// Params: { date?: string }  — ISO date like "2026-02-20", defaults to today
// ---------------------------------------------------------------------------
function calendarDailyBriefing(params) {
  var targetDate;
  if (params.date) {
    targetDate = new Date(params.date);
    if (isNaN(targetDate.getTime())) throw new Error('Invalid date: ' + params.date);
  } else {
    targetDate = new Date();
  }

  // Clamp to start/end of that calendar day
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  const allCalendars = CalendarApp.getAllOwnedCalendars();
  var allEvents = [];

  allCalendars.forEach(function(cal) {
    cal.getEvents(start, end).forEach(function(ev) {
      allEvents.push({
        calendarName: cal.getName(),
        title:        ev.getTitle(),
        start:        ev.getStartTime().toISOString(),
        end:          ev.getEndTime().toISOString(),
        isAllDay:     ev.isAllDayEvent(),
        location:     ev.getLocation() || '',
        description:  ev.getDescription() || '',
        attendees:    ev.getGuestList().map(function(g) { return g.getEmail(); })
      });
    });
  });

  // Sort chronologically
  allEvents.sort(function(a, b) { return new Date(a.start) - new Date(b.start); });

  // Build a human-readable timeline string for the AI
  var lines = ['📅 Daily Briefing for ' + start.toDateString()];
  if (allEvents.length === 0) {
    lines.push('  No events scheduled.');
  } else {
    allEvents.forEach(function(ev) {
      var timeLabel = ev.isAllDay
        ? '[All Day]'
        : formatTime(new Date(ev.start)) + ' – ' + formatTime(new Date(ev.end));
      var line = '  ' + timeLabel + '  ' + ev.title;
      if (ev.location) line += ' 📍 ' + ev.location;
      if (ev.attendees.length > 0) line += ' 👥 ' + ev.attendees.join(', ');
      lines.push(line);
    });
  }

  return {
    date:      start.toDateString(),
    eventCount: allEvents.length,
    timeline:  lines.join('\n'),
    events:    allEvents
  };
}

function formatTime(date) {
  var h = date.getHours(), m = date.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

// ---------------------------------------------------------------------------
// calendar_block_focus_time
// Finds the largest free gap >= durationMinutes within the next N days
// and inserts a 🛡️ Focus Time event.
// Params: { durationMinutes: number, withinNextNDays?: number, calendarId?: string }
// ---------------------------------------------------------------------------
function calendarBlockFocusTime(params) {
  if (!params.durationMinutes) throw new Error('durationMinutes is required');
  const duration   = params.durationMinutes * 60 * 1000; // ms
  const nDays      = Math.min(params.withinNextNDays || 7, 30);
  const workdayStart = 9;  // 9 AM
  const workdayEnd   = 18; // 6 PM

  var cal;
  if (params.calendarId && params.calendarId !== 'primary') {
    cal = CalendarApp.getCalendarById(params.calendarId);
    if (!cal) throw new Error('Calendar not found: ' + params.calendarId);
  } else {
    cal = CalendarApp.getDefaultCalendar();
  }

  const allCals   = CalendarApp.getAllOwnedCalendars();
  const searchStart = new Date();
  const searchEnd   = new Date(searchStart.getTime() + nDays * 24 * 60 * 60 * 1000);

  // Collect all busy intervals across all calendars
  var busyIntervals = [];
  allCals.forEach(function(c) {
    c.getEvents(searchStart, searchEnd).forEach(function(ev) {
      if (!ev.isAllDayEvent()) {
        busyIntervals.push({ start: ev.getStartTime().getTime(), end: ev.getEndTime().getTime() });
      }
    });
  });

  // Sort busy intervals
  busyIntervals.sort(function(a, b) { return a.start - b.start; });

  // Walk through each workday and find the first gap
  for (var d = 0; d < nDays; d++) {
    var day = new Date(searchStart);
    day.setDate(day.getDate() + d);
    var dow = day.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends

    var dayStart = new Date(day);
    dayStart.setHours(workdayStart, 0, 0, 0);
    var dayEnd = new Date(day);
    dayEnd.setHours(workdayEnd, 0, 0, 0);

    // Skip if dayStart is in the past
    if (dayStart.getTime() < Date.now()) {
      dayStart = new Date(Math.max(dayStart.getTime(), Date.now()));
    }

    // Filter busy intervals for this day
    var dayBusy = busyIntervals.filter(function(iv) {
      return iv.end > dayStart.getTime() && iv.start < dayEnd.getTime();
    });

    // Walk the gaps
    var cursor = dayStart.getTime();
    var gapFound = null;

    for (var i = 0; i <= dayBusy.length; i++) {
      var gapEnd = (i < dayBusy.length) ? Math.min(dayBusy[i].start, dayEnd.getTime()) : dayEnd.getTime();
      if (gapEnd - cursor >= duration) {
        gapFound = { start: cursor, end: cursor + duration };
        break;
      }
      if (i < dayBusy.length) {
        cursor = Math.max(cursor, dayBusy[i].end);
      }
    }

    if (gapFound) {
      var focusStart = new Date(gapFound.start);
      var focusEnd   = new Date(gapFound.end);
      var ev = cal.createEvent('🛡️ Focus Time', focusStart, focusEnd, {
        description: 'Protected focus time — blocked by your MCP assistant.'
      });
      return {
        booked:    true,
        eventId:   ev.getId(),
        title:     ev.getTitle(),
        start:     focusStart.toISOString(),
        end:       focusEnd.toISOString(),
        durationMinutes: params.durationMinutes,
        htmlLink:  'https://calendar.google.com/calendar/event?eid=' + ev.getId()
      };
    }
  }

  return {
    booked:  false,
    message: 'No free gap of ' + params.durationMinutes + ' minutes found in the next ' + nDays + ' working days.'
  };
}
