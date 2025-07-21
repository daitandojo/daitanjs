// pdf/src/reporting.js
/**
 * @file Provides high-level, "one-shot" functions for generating common PDF documents like reports.
 * @module @daitanjs/pdf/reporting
 */

import { createTable, createHeading, createEmailWrapper } from '@daitanjs/html';
import { htmlToPDF } from './creation.js';
import { savePDFBufferToFile } from './manipulation.js';
import { getLogger } from '@daitanjs/development';
import { DaitanInvalidInputError, DaitanOperationError } from '@daitanjs/error';

const pdfReportingLogger = getLogger('daitan-pdf-reporting');

/**
 * @typedef {import('@daitanjs/html').ColumnDefinition} ColumnDefinition
 */

/**
 * @typedef {Object} GeneratePdfReportParams
 * @property {Array<object>} data
 * @property {Array<ColumnDefinition | string>} columns
 * @property {string} title
 * @property {string} outputPath
 * @property {string} [subTitle]
 * @property {'A4'|'Letter'|'Legal'} [format='A4']
 * @property {boolean} [landscape=false]
 * @property {object} [puppeteerLaunchOptions]
 */

/**
 * Generates a complete PDF report from structured data and saves it to a file.
 *
 * @public
 * @async
 * @param {GeneratePdfReportParams} params
 * @returns {Promise<{success: boolean, path: string, size: number}>}
 */
export const generatePdfReport = async ({
  data,
  columns,
  title,
  outputPath,
  subTitle,
  format = 'A4',
  landscape = false,
  puppeteerLaunchOptions,
}) => {
  const callId = `pdf-report-${Date.now().toString(36)}`;
  pdfReportingLogger.info(
    `[${callId}] Initiating PDF report generation for: "${title}"`
  );

  if (!Array.isArray(data))
    throw new DaitanInvalidInputError('`data` must be an array.');
  if (!Array.isArray(columns) || columns.length === 0)
    throw new DaitanInvalidInputError('`columns` must be a non-empty array.');
  if (!title || typeof title !== 'string')
    throw new DaitanInvalidInputError('`title` must be a non-empty string.');
  if (!outputPath || typeof outputPath !== 'string')
    throw new DaitanInvalidInputError(
      '`outputPath` must be a non-empty string.'
    );

  try {
    let reportHtml = createHeading({
      text: title,
      level: 1,
      customStyles: { textAlign: 'center', marginBottom: '5px' },
    });
    if (subTitle) {
      reportHtml += createHeading({
        text: subTitle,
        level: 4,
        customStyles: {
          textAlign: 'center',
          color: '#666',
          marginTop: '0',
          marginBottom: '30px',
        },
      });
    }
    reportHtml += createTable({
      headers: columns.map((c) => (typeof c === 'string' ? c : c.header)),
      rows: data.map((row) =>
        columns.map((col) => row[typeof col === 'string' ? col : col.key])
      ),
    });

    const finalHtml = createEmailWrapper({
      bodyContent: reportHtml,
      config: {
        title: title,
        fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
        maxWidth: '1200px',
      },
    });

    const pdfBuffer = await htmlToPDF({
      htmlContent: finalHtml,
      pdfOptions: { format, landscape, printBackground: true },
      launchOptions: puppeteerLaunchOptions,
    });

    const finalPath = await savePDFBufferToFile({ pdfBuffer, outputPath });

    const result = { success: true, path: finalPath, size: pdfBuffer.length };
    pdfReportingLogger.info(
      `[${callId}] PDF report generated and saved successfully.`,
      result
    );
    return result;
  } catch (error) {
    if (
      error instanceof DaitanInvalidInputError ||
      error instanceof DaitanOperationError
    )
      throw error;
    throw new DaitanOperationError(
      `Failed to generate PDF report "${title}": ${error.message}`,
      {},
      error
    );
  }
};
