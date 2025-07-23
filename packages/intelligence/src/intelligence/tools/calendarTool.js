// intelligence/src/intelligence/tools/calendarTool.js
/**
 * @file A tool for interacting with the Google Calendar API.
 * @module @daitanjs/intelligence/tools/calendarTool
 *
 * @description
 * This module provides the `calendarTool`, a DaitanJS tool that allows AI agents
 * to interact with a user's Google Calendar.
 */
import { google } from 'googleapis';
import { createDaitanTool } from '../core/toolFactory.js';
import { getGoogleAuthClient, getLogger } from '@daitanjs/development';
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';
import { z } from 'zod';

const calendarLogger = getLogger('daitan-tool-calendar');
const TOOL_NAME = 'google_calendar_tool';

// --- SCHEMA DEFINITIONS (Moved directly into this file) ---
// This co-location of schemas with their usage in `discriminatedUnion`
// is the definitive fix for the build-time initialization error.

const CheckEventsSchema = z.object({
  action: z.literal('check_events'),
  timeMin: z
    .string()
    .datetime({ message: 'timeMin must be a valid ISO 8601 datetime string.' })
    .optional(),
  timeMax: z
    .string()
    .datetime({ message: 'timeMax must be a valid ISO 8601 datetime string.' })
    .optional(),
  maxResults: z.number().int().min(1).max(25).optional().default(10),
  calendarId: z.string().optional().default('primary'),
});

const CreateEventSchema = z.object({
  action: z.literal('create_event'),
  title: z.string().min(1, 'Event title cannot be empty.'),
  startTime: z.string().datetime({
    message: 'startTime must be a valid ISO 8601 datetime string.',
  }),
  endTime: z
    .string()
    .datetime({ message: 'endTime must be a valid ISO 8601 datetime string.' }),
  attendees: z
    .array(z.string().email())
    .optional()
    .describe('An array of attendee email addresses.'),
  description: z
    .string()
    .optional()
    .describe('A description or notes for the event.'),
  location: z.string().optional().describe('The location of the event.'),
  calendarId: z.string().optional().default('primary'),
});

const CalendarToolInputSchema = z.discriminatedUnion('action', [
  CheckEventsSchema,
  CreateEventSchema,
]);

// --- Tool Implementation ---

const getCalendarClient = () => {
  const oauth2Client = getGoogleAuthClient();
  if (!oauth2Client.credentials.access_token) {
    throw new DaitanConfigurationError(
      'Google Calendar tool requires an authenticated OAuth2 client with an access token.'
    );
  }
  return google.calendar({ version: 'v3', auth: oauth2Client });
};

export const calendarTool = createDaitanTool(
  TOOL_NAME,
  `A tool to interact with Google Calendar. It can check for events or create new ones.
Input must be an object specifying the 'action'.
- For "check_events": {"action": "check_events", "timeMin": "ISO_DATETIME", "timeMax": "ISO_DATETIME" (optional)}.
- For "create_event": {"action": "create_event", "title": "Meeting Title", "startTime": "ISO_DATETIME", "endTime": "ISO_DATETIME"}.`,
  async (input) => {
    // The wrapper in toolFactory handles parsing and the Zod schema below handles validation
    const validatedInput = CalendarToolInputSchema.parse(input);

    const calendar = getCalendarClient();

    switch (validatedInput.action) {
      case 'check_events':
        const timeMin = validatedInput.timeMin || new Date().toISOString();
        const timeMax =
          validatedInput.timeMax ||
          new Date(
            new Date().getTime() + 7 * 24 * 60 * 60 * 1000
          ).toISOString();

        const res = await calendar.events.list({
          calendarId: validatedInput.calendarId,
          timeMin,
          timeMax,
          maxResults: validatedInput.maxResults,
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = res.data.items;
        if (!events || events.length === 0) {
          return `No upcoming events found between ${timeMin} and ${timeMax}.`;
        }

        return `Found ${events.length} event(s):\n${JSON.stringify(
          events.map((e) => ({
            summary: e.summary,
            start: e.start.dateTime || e.start.date,
          }))
        )}`;

      case 'create_event':
        const eventResource = {
          summary: validatedInput.title,
          location: validatedInput.location,
          description: validatedInput.description,
          start: { dateTime: validatedInput.startTime },
          end: { dateTime: validatedInput.endTime },
          attendees: validatedInput.attendees?.map((email) => ({ email })),
        };

        const createResponse = await calendar.events.insert({
          calendarId: validatedInput.calendarId,
          requestBody: eventResource,
          sendNotifications: true,
        });

        if (createResponse.data.htmlLink) {
          return `Event "${validatedInput.title}" created successfully. Link: ${createResponse.data.htmlLink}`;
        }
        throw new DaitanOperationError(
          'Google Calendar created the event but did not return a link.'
        );
    }
  },
  CalendarToolInputSchema
);