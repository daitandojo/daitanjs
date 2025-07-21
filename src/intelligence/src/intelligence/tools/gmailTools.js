// intelligence/src/intelligence/tools/gmailTools.js
/**
 * @file A suite of DaitanJS tools for interacting with the Gmail API.
 * @module @daitanjs/intelligence/tools/gmailTools
 *
 * @description
 * This module provides a set of granular, focused tools for an AI agent to
 * read, search, and draft emails in a user's Gmail account. This modular
 * approach is more effective for LLM reasoning than a single monolithic tool.
 * All tools require an authenticated Google OAuth2 client with the appropriate
 * Gmail scopes (e.g., 'https://www.googleapis.com/auth/gmail.readonly',
 * 'https://www.googleapis.com/auth/gmail.compose').
 */

import { google } from 'googleapis';
import { createDaitanTool } from '../core/toolFactory.js'; // CORRECTED: Import from the new 'core' location
import { getGoogleAuthClient, getLogger } from '@daitanjs/development';
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';
import { z } from 'zod';
import { Buffer } from 'buffer';

/**
 * Gets an authenticated Gmail API client.
 * @private
 */
const getGmailClient = () => {
  const oauth2Client = getGoogleAuthClient();
  if (!oauth2Client.credentials.access_token) {
    throw new DaitanConfigurationError(
      'Gmail tools require an authenticated OAuth2 client with an access token.'
    );
  }
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

// --- Tool 1: Search Gmail ---
const SearchGmailInputSchema = z
  .object({
    query: z
      .string()
      .min(1, 'A search query is required.')
      .describe(
        'A Gmail search query string, similar to the web interface (e.g., \'from:elon@x.com is:unread subject:"Launch Plans"\').'
      ),
    maxResults: z.number().int().min(1).max(20).optional().default(5),
  })
  .strict();

export const searchGmailTool = createDaitanTool(
  'search_gmail',
  `Searches for emails in the user's Gmail account using a standard Gmail query string.
Returns a list of email summaries (ID, Subject, From, Snippet) that match the query.
Use this to find specific emails before deciding to read one in full.`,
  async (input) => {
    const validatedInput = SearchGmailInputSchema.parse(input);
    const gmail = getGmailClient();

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: validatedInput.query,
      maxResults: validatedInput.maxResults,
    });

    if (!res.data.messages || res.data.messages.length === 0) {
      return `No emails found matching query: "${validatedInput.query}".`;
    }

    // Fetch snippets for each found message
    const summaries = await Promise.all(
      res.data.messages.map(async (msg) => {
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });
        const headers = message.data.payload.headers;
        return {
          id: msg.id,
          threadId: msg.threadId,
          subject:
            headers.find((h) => h.name === 'Subject')?.value || 'No Subject',
          from:
            headers.find((h) => h.name === 'From')?.value || 'Unknown Sender',
          date: headers.find((h) => h.name === 'Date')?.value || 'Unknown Date',
          snippet: message.data.snippet,
        };
      })
    );
    return `Found ${summaries.length} email(s):\n${JSON.stringify(
      summaries,
      null,
      2
    )}`;
  },
  SearchGmailInputSchema
);

// --- Tool 2: Read Email Content ---
const ReadEmailInputSchema = z
  .object({
    messageId: z.string().min(1, 'A message ID is required to read an email.'),
  })
  .strict();

export const readEmailContentTool = createDaitanTool(
  'read_email_content',
  `Retrieves the full plain-text body of a specific email using its message ID.
Use this tool after 'search_gmail' to get the full content of an email you want to analyze or respond to.
The input must be an object with a "messageId" key.`,
  async (input) => {
    const validatedInput = ReadEmailInputSchema.parse(input);
    const gmail = getGmailClient();

    const message = await gmail.users.messages.get({
      userId: 'me',
      id: validatedInput.messageId,
      format: 'full', // Get the full message payload
    });

    if (!message.data || !message.data.payload) {
      return 'Error: Could not retrieve email payload.';
    }

    let body = '';
    const findBodyPart = (parts) => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return part.body.data;
        }
        if (part.parts) {
          const nestedBody = findBodyPart(part.parts);
          if (nestedBody) return nestedBody;
        }
      }
      // Fallback for simple, non-multipart emails
      if (
        message.data.payload.mimeType === 'text/plain' &&
        message.data.payload.body?.data
      ) {
        return message.data.payload.body.data;
      }
      return null;
    };

    const bodyData = message.data.payload.parts
      ? findBodyPart(message.data.payload.parts)
      : findBodyPart([message.data.payload]);

    if (bodyData) {
      body = Buffer.from(bodyData, 'base64').toString('utf-8');
    } else {
      body =
        'Could not find a plain text body in this email. It might be HTML only or an attachment.';
    }

    const subject =
      message.data.payload.headers.find((h) => h.name === 'Subject')?.value ||
      'No Subject';
    return `Subject: ${subject}\n\nBody:\n${body}`;
  },
  ReadEmailInputSchema
);

// --- Tool 3: Create Email Draft ---
const CreateDraftInputSchema = z
  .object({
    to: z.string().email('A valid recipient email address is required.'),
    subject: z.string().min(1, 'Subject cannot be empty.'),
    body: z.string().min(1, 'Body content cannot be empty.'),
    inReplyTo: z
      .string()
      .optional()
      .describe(
        "Optional: The 'Message-ID' header of the email being replied to, to create a threaded reply."
      ),
    threadId: z
      .string()
      .optional()
      .describe('Optional: The ID of the thread to reply to.'),
  })
  .strict();

export const createGmailDraftTool = createDaitanTool(
  'create_gmail_draft',
  `Creates a new draft email in the user's Gmail account. This tool does NOT send the email.
The input is an object with "to", "subject", and "body".
Optionally include "inReplyTo" (the Message-ID of a previous email) and "threadId" to create a reply within a conversation thread.`,
  async (input) => {
    const validatedInput = CreateDraftInputSchema.parse(input);
    const gmail = getGmailClient();

    const emailLines = [
      `To: ${validatedInput.to}`,
      `Subject: ${validatedInput.subject}`,
    ];

    if (validatedInput.inReplyTo) {
      emailLines.push(`In-Reply-To: ${validatedInput.inReplyTo}`);
      emailLines.push(`References: ${validatedInput.inReplyTo}`);
    }

    emailLines.push('Content-Type: text/plain; charset="UTF-8"');
    emailLines.push('');
    emailLines.push(validatedInput.body);

    const rawEmail = emailLines.join('\n');
    const encodedMessage = Buffer.from(rawEmail).toString('base64url');

    const draftRequestBody = {
      message: {
        raw: encodedMessage,
      },
    };

    if (validatedInput.threadId) {
      draftRequestBody.message.threadId = validatedInput.threadId;
    }

    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: draftRequestBody,
    });

    if (res.data.id) {
      return `Email draft created successfully. Draft ID: ${res.data.id}. The user must review and send it manually.`;
    } else {
      throw new DaitanOperationError(
        'Gmail API created a draft but did not return an ID.'
      );
    }
  },
  CreateDraftInputSchema
);
