// pdf/src/creation.js
/**
 * @file Contains PDF creation functionalities, specifically converting HTML to PDF using Puppeteer.
 * @module @daitanjs/pdf/creation
 *
 * @description
 * This module is dedicated to generating PDF documents from HTML content. It leverages
 * the Puppeteer library to render HTML in a headless browser instance and then prints
 * the result to a PDF buffer. This functionality is strictly for Node.js environments.
 */

import puppeteer from 'puppeteer';
import { getLogger } from '@daitanjs/development';
import {
  DaitanInvalidInputError,
  DaitanOperationError,
  DaitanExternalDependencyError,
} from '@daitanjs/error';

const logger = getLogger('daitan-pdf-creation');

/**
 * @typedef {import('puppeteer').PDFOptions} PuppeteerPDFOptions
 * @typedef {import('puppeteer').LaunchOptions} PuppeteerLaunchOptions
 */

/**
 * @typedef {Object} HtmlToPdfParams
 * @property {string} htmlContent - The HTML string to convert.
 * @property {PuppeteerPDFOptions} [pdfOptions] - Options for `page.pdf()`.
 * @property {PuppeteerLaunchOptions} [launchOptions] - Options for `puppeteer.launch()`.
 */

/**
 * Converts HTML content to a PDF buffer using Puppeteer.
 * This function is intended for Node.js environments where Puppeteer can run.
 *
 * @public
 * @async
 * @param {HtmlToPdfParams} params - The parameters for PDF creation.
 * @returns {Promise<Buffer>} A Node.js Buffer containing the PDF data.
 */
export const htmlToPDF = async ({
  htmlContent,
  pdfOptions = { format: 'A4', printBackground: true },
  launchOptions = {},
}) => {
  const callId = `htmlToPdf-${Date.now().toString(36)}`;
  logger.info(`[${callId}] htmlToPDF: Initiated.`);

  if (typeof window !== 'undefined') {
    throw new DaitanOperationError(
      'htmlToPDF using Puppeteer is not supported in browser environments.'
    );
  }

  if (!htmlContent || typeof htmlContent !== 'string' || !htmlContent.trim()) {
    throw new DaitanInvalidInputError(
      'HTML content for PDF generation must be a non-empty string.'
    );
  }

  let browser = null;
  try {
    const effectiveLaunchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      ...launchOptions,
    };
    browser = await puppeteer.launch(effectiveLaunchOptions);
    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf(pdfOptions);

    logger.info(
      `[${callId}] PDF generated successfully. Buffer size: ${buffer.length} bytes.`
    );
    return buffer;
  } catch (error) {
    throw new DaitanExternalDependencyError(
      `Puppeteer operation failed during PDF generation: ${error.message}`,
      { puppeteerError: error.message },
      error
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
