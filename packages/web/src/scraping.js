// web/src/scraping.js
/**
 * @file Main web scraping functionalities using various parsing engines.
 * @module @daitanjs/web/scraping
 *
 * @description
 * This module provides the primary `downloadAndExtract` function for fetching web content
 * and extracting data. It features an intelligent, cascading strategy that automatically
 * selects the best parsing engine (static vs. browser-based) to ensure robust and
 * efficient content extraction, similar to a "reader mode".
 */

import { retryWithBackoff, truncateString } from '@daitanjs/utilities';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import playwright from 'playwright';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanScrapingError,
  DaitanOperationError,
  DaitanError,
} from '@daitanjs/error';
import { isValidURL } from '@daitanjs/validation';
import { fetchHtmlWithTimeout } from './scraping/htmlFetch.js';
import {
  extractContentWithStaticParser,
  logExtractionSummary,
} from './scraping/staticParser.js';
import { extractContentFromBrowserPage } from './scraping/browserParser.js';
import { JSDOM } from 'jsdom';
import { load as cheerioLoad } from 'cheerio';

const defaultScrapingLogger = getLogger('daitan-web-scraping');

puppeteer.use(StealthPlugin());

const DEFAULT_REQUEST_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES_BROWSER = 2;
const DEFAULT_RETRY_DELAY_BROWSER = 2000;
const MIN_SUFFICIENT_CONTENT_LENGTH = 250;

// --- DEFINITIVE FIX: Define all internal helper functions BEFORE they are called. ---

async function handleCookieBanners(page, logger, label) {
  const commonSelectors = [
    'button:has-text("Accept all")',
    'button:has-text("Tillad alle")',
    'button:has-text("Accepter alle")',
    'button:has-text("Godkend alle")',
    'button:has-text("Jeg accepterer")',
    'button[id*="cookie"]',
    'button[class*="cookie"]',
    'a[id*="cookie"]',
    'div[aria-label*="cookie"] button',
  ];

  for (const selector of commonSelectors) {
    try {
      const button = page.locator(selector).first();
      const count = await button.count();
      if (count > 0 && (await button.isVisible())) {
        logger.debug(
          `[${label}] Found cookie consent button with selector: "${selector}". Attempting to click.`
        );
        await button.click({ timeout: 2000 });
        logger.info(`[${label}] Clicked a potential cookie consent button.`);
        await page.waitForTimeout(1000);
        return;
      }
    } catch (e) {
      // Ignore errors
    }
  }
}

function cleanExtractedText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

function isContentSufficient(html) {
  if (!html || typeof html !== 'string') return false;
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (textContent.length < MIN_SUFFICIENT_CONTENT_LENGTH) return false;
  const jsRequiredPatterns =
    /javascript is required|enable javascript|checking your browser|recaptcha/i;
  if (jsRequiredPatterns.test(textContent.substring(0, 2000))) return false;
  return true;
}

function processExtraction(extractedData, outputFormat) {
  if (outputFormat === 'cleanText') {
    if (typeof extractedData === 'object' && extractedData !== null) {
      const combinedText = Object.values(extractedData).flat().join(' ');
      return cleanExtractedText(combinedText);
    }
    return cleanExtractedText(String(extractedData));
  }
  return extractedData;
}

async function downloadWithCheerioInternal(args) {
  const {
    url,
    logger,
    label,
    timeout,
    mainContentSelectors,
    outputFormat,
    htmlData,
    ...parserOpts
  } = args;
  logger.debug(`[${label}] Executing with Cheerio (fast) parser.`);
  const effectiveHtml =
    htmlData ||
    (await fetchHtmlWithTimeout(
      url,
      timeout || DEFAULT_REQUEST_TIMEOUT,
      logger
    ));
  const $ = cheerioLoad(effectiveHtml);

  const effectiveStructure =
    parserOpts.articleStructure ||
    mainContentSelectors.map((s) => ({
      elementName: 'main_content',
      selector: s,
    }));
  const extracted = extractContentWithStaticParser(
    $,
    effectiveStructure,
    parserOpts.className,
    parserOpts.linkSelector,
    parserOpts.extractLinks,
    true,
    logger,
    label
  );

  const processedData = processExtraction(extracted, outputFormat);
  return { status: 'success', data: processedData, url };
}

async function downloadWithJSDOMInternal(args) {
  const {
    url,
    logger,
    label,
    timeout,
    mainContentSelectors,
    outputFormat,
    htmlData,
    ...parserOpts
  } = args;
  logger.debug(`[${label}] Executing with JSDOM parser.`);
  const effectiveHtml =
    htmlData ||
    (await fetchHtmlWithTimeout(
      url,
      timeout || DEFAULT_REQUEST_TIMEOUT,
      logger
    ));
  const dom = new JSDOM(effectiveHtml);
  const document = dom.window.document;

  const effectiveStructure =
    parserOpts.articleStructure ||
    mainContentSelectors.map((s) => ({
      elementName: 'main_content',
      selector: s,
    }));
  const extracted = extractContentWithStaticParser(
    document,
    effectiveStructure,
    parserOpts.className,
    parserOpts.linkSelector,
    parserOpts.extractLinks,
    false,
    logger,
    label
  );

  const processedData = processExtraction(extracted, outputFormat);
  return { status: 'success', data: processedData, url };
}

async function downloadWithJsonAttrInternal(args) {
  const { url, logger, label, timeout, jsonAttrConfig, htmlData } = args;
  logger.debug(`[${label}] Executing with json-attr parser.`);

  if (
    !jsonAttrConfig ||
    !jsonAttrConfig.selector ||
    !jsonAttrConfig.attribute
  ) {
    throw new DaitanConfigurationError(
      'json-attr strategy requires `jsonAttrConfig` with `selector` and `attribute` properties.'
    );
  }

  const effectiveHtml =
    htmlData ||
    (await fetchHtmlWithTimeout(
      url,
      timeout || DEFAULT_REQUEST_TIMEOUT,
      logger
    ));
  const $ = cheerioLoad(effectiveHtml);

  const elementWithJson = $(jsonAttrConfig.selector).first();
  if (elementWithJson.length === 0) {
    logger.warn(
      `[${label}] json-attr selector "${jsonAttrConfig.selector}" not found.`
    );
    return { status: 'success', data: [], url };
  }

  const jsonString = elementWithJson.attr(jsonAttrConfig.attribute);
  if (!jsonString) {
    logger.warn(
      `[${label}] json-attr attribute "${jsonAttrConfig.attribute}" not found on element with selector "${jsonAttrConfig.selector}".`
    );
    return { status: 'success', data: [], url };
  }

  try {
    const parsedData = JSON.parse(jsonString);
    if (!Array.isArray(parsedData)) {
      logger.warn(`[${label}] Parsed JSON from attribute is not an array.`, {
        dataType: typeof parsedData,
      });
      return { status: 'success', data: [], url };
    }
    logger.info(
      `[${label}] Successfully extracted and parsed ${parsedData.length} items from JSON attribute.`
    );
    return { status: 'success', data: parsedData, url };
  } catch (e) {
    throw new DaitanScrapingError(
      `Failed to parse JSON from attribute "${jsonAttrConfig.attribute}": ${e.message}`,
      { url },
      e
    );
  }
}

async function downloadWithPlaywrightInternal(args) {
  const {
    url,
    logger,
    label,
    timeout,
    playwrightLaunchOptions,
    playwrightBrowserType = 'chromium',
    mainContentSelectors,
    outputFormat,
    ...parserOpts
  } = args;
  logger.debug(
    `[${label}] Executing with Playwright (${playwrightBrowserType}) parser.`
  );
  return retryWithBackoff(
    async () => {
      let browser = null;
      try {
        const configManager = getConfigManager();
        browser = await playwright[playwrightBrowserType].launch({
          headless: configManager.get('PLAYWRIGHT_HEADLESS_MODE', true),
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          ...playwrightLaunchOptions,
        });
        const context = await browser.newContext({ javaScriptEnabled: true });
        const page = await context.newPage();
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: timeout || DEFAULT_REQUEST_TIMEOUT,
        });
        await handleCookieBanners(page, logger, label);
        await page.waitForLoadState('networkidle', { timeout: 15000 });

        const effectiveStructure =
          parserOpts.articleStructure ||
          mainContentSelectors.map((s) => ({
            elementName: 'main_content',
            selector: s,
          }));
        const extracted = await extractContentFromBrowserPage({
          page,
          articleStructure: effectiveStructure,
          ...parserOpts,
        });

        const processedData = processExtraction(extracted, outputFormat);
        return { status: 'success', data: processedData, url };
      } finally {
        if (browser) await browser.close();
      }
    },
    DEFAULT_MAX_RETRIES_BROWSER,
    {
      loggerInstance: logger,
      operationName: `Playwright for ${url}`,
      initialDelayMs: DEFAULT_RETRY_DELAY_BROWSER,
    }
  );
}

async function downloadWithPuppeteerInternal(args) {
  const {
    url,
    logger,
    label,
    timeout,
    puppeteerLaunchOptions,
    mainContentSelectors,
    outputFormat,
    ...parserOpts
  } = args;
  logger.debug(`[${label}] Executing with Puppeteer parser.`);
  return retryWithBackoff(
    async () => {
      let browser = null;
      try {
        const configManager = getConfigManager();
        browser = await puppeteer.launch({
          headless: configManager.get('PUPPETEER_HEADLESS_MODE', 'new'),
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          ...puppeteerLaunchOptions,
        });
        const page = await browser.newPage();
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: timeout || DEFAULT_REQUEST_TIMEOUT,
        });

        const effectiveStructure =
          parserOpts.articleStructure ||
          mainContentSelectors.map((s) => ({
            elementName: 'main_content',
            selector: s,
          }));
        const extracted = await extractContentFromBrowserPage({
          page,
          articleStructure: effectiveStructure,
          ...parserOpts,
        });

        const processedData = processExtraction(extracted, outputFormat);
        return { status: 'success', data: processedData, url };
      } finally {
        if (browser) await browser.close();
      }
    },
    DEFAULT_MAX_RETRIES_BROWSER,
    {
      loggerInstance: logger,
      operationName: `Puppeteer for ${url}`,
      initialDelayMs: DEFAULT_RETRY_DELAY_BROWSER,
    }
  );
}

async function downloadAndExtractRobustInternal(args) {
  const { logger, label, callId } = args;
  logger.info(`[${callId}] ${label}: Starting ROBUST strategy.`);

  try {
    const htmlData = await fetchHtmlWithTimeout(
      args.url,
      args.timeout || DEFAULT_REQUEST_TIMEOUT,
      logger
    );
    if (isContentSufficient(htmlData)) {
      logger.info(
        `[${callId}] ${label}: Static content sufficient. Proceeding with fast parser (Cheerio).`
      );
      return await downloadWithCheerioInternal({ ...args, htmlData });
    }
    logger.info(
      `[${callId}] ${label}: Static content insufficient or JS-gated. Escalating to browser-based scrape (Playwright).`
    );
  } catch (staticError) {
    logger.warn(
      `[${callId}] ${label}: Static scrape attempt failed: ${staticError.message}. Escalating to browser (Playwright).`
    );
  }
  return downloadWithPlaywrightInternal(args);
}

// --- Main Exported Function ---

export const downloadAndExtract = async (url, options = {}, loggerInstance) => {
  const logger = loggerInstance || defaultScrapingLogger;
  const callId = `scrape-${Date.now().toString(36)}`;
  const {
    strategy = 'robust',
    outputFormat = 'structured',
    mainContentSelectors = [
      'main',
      'article',
      '[role=main]',
      '#content',
      '.content',
      'body',
    ],
    parserType,
    ...restOptions
  } = options;

  const effectiveStrategy = parserType || strategy;
  const label = `[${effectiveStrategy.toUpperCase()}] ${truncateString(
    url,
    50
  )}`;

  logger.info(`[${callId}] ${label}: downloadAndExtract initiated.`, {
    url,
    strategy: effectiveStrategy,
    outputFormat,
  });

  if (!isValidURL(url)) {
    throw new DaitanConfigurationError(
      `Invalid URL provided for scraping: ${url}`
    );
  }

  const commonArgs = {
    url,
    logger,
    label,
    callId,
    mainContentSelectors,
    outputFormat,
    ...restOptions,
  };

  try {
    let extractionResult;

    switch (effectiveStrategy.toLowerCase()) {
      case 'fast':
      case 'cheerio':
        extractionResult = await downloadWithCheerioInternal(commonArgs);
        break;
      case 'robust':
        extractionResult = await downloadAndExtractRobustInternal(commonArgs);
        break;
      case 'jsdom':
        extractionResult = await downloadWithJSDOMInternal(commonArgs);
        break;
      case 'puppeteer':
        extractionResult = await downloadWithPuppeteerInternal(commonArgs);
        break;
      case 'playwright':
        extractionResult = await downloadWithPlaywrightInternal(commonArgs);
        break;
      case 'json-attr':
        extractionResult = await downloadWithJsonAttrInternal(commonArgs);
        break;
      default:
        throw new DaitanConfigurationError(
          `Unsupported strategy: ${effectiveStrategy}`
        );
    }

    const finalData = extractionResult.data;
    logger.info(`[${callId}] ✅ ${label}: Successfully extracted content.`);
    return finalData;
  } catch (error) {
    logger.error(
      `[${callId}] ❌ ${label}: downloadAndExtract FAILED. ${error.message}`,
      {
        errorMessage: error.message,
        errorName: error.name,
        errorDetails: error.details,
      }
    );
    if (error instanceof DaitanError) throw error;
    throw new DaitanScrapingError(
      `Unexpected error during scraping for URL "${url}" with strategy "${effectiveStrategy}": ${error.message}`,
      { url, strategy: effectiveStrategy },
      error
    );
  }
};
