// intelligence/src/intelligence/tools/googleDriveTools.js
/**
 * @file A suite of DaitanJS tools for interacting with Google Drive (Docs, Sheets).
 * @module @daitanjs/intelligence/tools/googleDriveTools
 *
 * @description
 * This module provides tools for an AI agent to create Google Docs and Sheets
 * in a user's Google Drive. This requires an authenticated Google OAuth2 client
 * with the necessary Drive and Sheets API scopes.
 *
 * Required Scopes:
 * - 'https://www.googleapis.com/auth/drive.file' (to create files)
 * - 'https://www.googleapis.com/auth/spreadsheets' (to create and write to Sheets)
 */

import { google } from 'googleapis';
import { createDaitanTool } from '../core/toolFactory.js'; // CORRECTED: Import from the new 'core' location
import { getGoogleAuthClient, getLogger } from '@daitanjs/development';

import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';
import { z } from 'zod';

const driveLogger = getLogger('daitan-tool-drive');

/**
 * Gets an authenticated Google APIs client for a specific service.
 * @private
 */
const getGoogleApiClient = (service) => {
  const oauth2Client = getGoogleAuthClient();
  if (!oauth2Client.credentials.access_token) {
    throw new DaitanConfigurationError(
      `Google Drive/Sheets tools require an authenticated OAuth2 client with an access token.`
    );
  }
  if (service === 'drive') {
    return google.drive({ version: 'v3', auth: oauth2Client });
  }
  if (service === 'sheets') {
    return google.sheets({ version: 'v4', auth: oauth2Client });
  }
  throw new DaitanConfigurationError(
    `Unsupported Google service requested: ${service}`
  );
};

// --- Tool 1: Create Google Doc ---
const CreateGoogleDocInputSchema = z
  .object({
    title: z.string().min(1, 'Document title cannot be empty.'),
    content: z
      .string()
      .describe('The plain text content to be placed in the document.'),
  })
  .strict();

export const createGoogleDocTool = createDaitanTool(
  'create_google_doc',
  `Creates a new Google Doc in the user's Google Drive with the provided title and content.
The input is an object with "title" and "content" string keys.
Returns the URL of the newly created document.`,
  async (input) => {
    const validatedInput = CreateGoogleDocInputSchema.parse(input);
    const drive = getGoogleApiClient('drive');

    driveLogger.debug(`Creating Google Doc titled: "${validatedInput.title}"`);

    // The Drive API can create a Google Doc by uploading plain text and specifying the MIME type.
    const fileMetadata = {
      name: validatedInput.title,
      mimeType: 'application/vnd.google-apps.document',
    };
    const media = {
      mimeType: 'text/plain',
      body: validatedInput.content,
    };

    const res = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'webViewLink, id', // Request the web link and file ID in the response
    });

    if (res.data.webViewLink) {
      return `Google Doc "${validatedInput.title}" created successfully. Link: ${res.data.webViewLink}`;
    } else {
      throw new DaitanOperationError(
        'Google Drive API created the document but did not return a link.'
      );
    }
  },
  CreateGoogleDocInputSchema
);

// --- Tool 2: Create Google Sheet ---
const CreateGoogleSheetInputSchema = z
  .object({
    title: z.string().min(1, 'Spreadsheet title cannot be empty.'),
    data: z
      .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
      .describe(
        'A 2D array of data representing rows and cells to populate the sheet. The first inner array is typically the headers.'
      ),
  })
  .strict();

export const createGoogleSheetTool = createDaitanTool(
  'create_google_sheet',
  `Creates a new Google Sheet in the user's Google Drive and populates it with the provided data.
The input is an object with "title" (string) and "data" (a 2D array of strings/numbers/booleans).
The first row of the data array will be treated as the header row.
Returns the URL of the newly created spreadsheet.`,
  async (input) => {
    const validatedInput = CreateGoogleSheetInputSchema.parse(input);
    const sheets = getGoogleApiClient('sheets');
    driveLogger.debug(
      `Creating Google Sheet titled: "${validatedInput.title}"`
    );

    // Step 1: Create an empty spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      resource: {
        properties: {
          title: validatedInput.title,
        },
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new DaitanOperationError(
        'Google Sheets API failed to create a new spreadsheet.'
      );
    }

    // Step 2: Populate the spreadsheet with data
    if (validatedInput.data.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: 'Sheet1!A1', // Start from the top-left cell of the first sheet
        valueInputOption: 'USER_ENTERED', // This allows Google to parse dates, numbers, etc., correctly
        resource: {
          values: validatedInput.data,
        },
      });
    }

    const spreadsheetUrl = createResponse.data.spreadsheetUrl;
    if (spreadsheetUrl) {
      return `Google Sheet "${validatedInput.title}" created and populated successfully. Link: ${spreadsheetUrl}`;
    } else {
      // This case is unlikely if creation succeeded, but as a fallback
      return `Google Sheet created with ID: ${spreadsheetId}, but the URL was not returned.`;
    }
  },
  CreateGoogleSheetInputSchema
);
