// scraping.js
import { JSDOM } from 'jsdom';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import playwright from 'playwright';
import pkg from 'random-useragent';
import { load } from 'cheerio';
import fetch from 'node-fetch';
// import { getLogger } from '../development';
import { retryOperation } from '@daitanjs/utilities';

const { randomUserAgent } = pkg;

// Configure Puppeteer with Stealth Plugin
puppeteer.use(StealthPlugin());

// // Configure logger
// const logger = getLogger("scraping");

// Constants
const TIMEOUT = 60000; // 60 seconds
const MAX_RETRIES = 3;

// Unified Function to Download and Optionally Extract Content
const downloadAndExtract = async ({ url, options = {}, logger }) => {
  const {
    parserType = 'jsdom',
    articleStructure,
    className,
    extractLinks = false,
  } = options;

  try {
    let result;

    switch (parserType.toLowerCase()) {
      case 'jsdom':
        try {
          result = await downloadWithJSDOM({
            url,
            articleStructure,
            className,
            extractLinks,
            logger,
          });
        } catch (error) {
          console.log(`JSDOM download failed for URL: ${url}`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : 'No stack available',
          });
          throw error; // Re-throw for outer catch block
        }
        break;

      case 'cheerio':
        try {
          result = await downloadWithCheerio({
            url,
            articleStructure,
            className,
            extractLinks,
            logger,
          });
        } catch (error) {
          console.log(`Cheerio download failed for URL: ${url}`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : 'No stack available',
          });
          throw error;
        }
        break;

      case 'puppeteer':
        try {
          result = await retryOperation(
            () =>
              downloadWithPuppeteer({
                url,
                articleStructure,
                className,
                extractLinks,
                logger,
              }),
            MAX_RETRIES,
            'Puppeteer'
          );
        } catch (error) {
          console.log(`Puppeteer download failed for URL: ${url}`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : 'No stack available',
          });
          throw error;
        }
        break;

      case 'playwright':
        console.log(
          `Initiating Playwright download for URL: ${url} with ${MAX_RETRIES} retries allowed.`
        );
        try {
          result = await retryOperation(
            () =>
              downloadWithPlaywright({
                url,
                articleStructure,
                className,
                extractLinks,
                logger,
              }),
            MAX_RETRIES,
            'Playwright'
          );
        } catch (error) {
          console.log(`Playwright download failed for URL: ${url}`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : 'No stack available',
          });
          throw error;
        }
        break;

      default:
        const errorMsg = `Unsupported parser type: ${parserType}`;
        console.log(errorMsg);
        throw new Error(errorMsg);
    }

    // Handle the result after download
    if (result && result.status === 'success') {
      console.log(
        `Successfully extracted data from ${url} using ${parserType}`
      );
      return result.data;
    } else {
      const extractionError = `Extraction failed for ${url} with parser ${parserType}: ${
        result?.message || 'Unknown error'
      }`;
      console.log(extractionError);
      throw new Error(extractionError);
    }
  } catch (error) {
    // Extended error handling to ensure all error details are logged
    console.log(`downloadAndExtract failed for URL: ${url}`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack available',
    });
    throw error; // Re-throw the error to be handled by the calling function
  } finally {
    // console.log(`Finished downloadAndExtract for URL: ${url}`);
  }
};

// Function to Download Using JSDOM or Cheerio
const downloadWithJSDOM = async ({
  url,
  articleStructure,
  className,
  extractLinks,
  logger,
}) => {
  try {
    const response = await fetchWithTimeout(url, TIMEOUT);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.text();
    const document = new JSDOM(data).window.document;
    const content = extractContent(
      document,
      articleStructure,
      className,
      extractLinks,
      false
    );
    return { status: 'success', data: content };
  } catch (error) {
    console.log(`JSDOM download failed: ${error.message}`, { url });
    return { status: 'error', message: error.message, url };
  }
};

const downloadWithCheerio = async ({
  url,
  articleStructure,
  className,
  extractLinks,
  logger,
}) => {
  try {
    const response = await fetchWithTimeout(url, TIMEOUT);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.text();
    const $ = load(data);
    const content = extractContent(
      $,
      articleStructure,
      className,
      extractLinks,
      true
    );
    return { status: 'success', data: content };
  } catch (error) {
    console.log(`Cheerio download failed: ${error.message}`, { url });
    return { status: 'error', message: error.message, url };
  }
};

// Helper Function to Extract Content
const extractContent = (
  parser,
  articleStructure,
  className,
  extractLinks,
  isCheerio = false
) => {
  try {
    if (articleStructure) {
      // Extract using article structure
      return articleStructure.reduce((acc, { elementName, selector }) => {
        let elements;
        if (isCheerio) {
          elements = parser(selector)
            .map((_, el) => parser(el).text().trim())
            .get()
            .filter(Boolean);
        } else {
          elements = [...parser.querySelectorAll(selector)]
            .map((el) => el.textContent.trim())
            .filter(Boolean);
        }
        acc[elementName] = elements;
        return acc;
      }, {});
    } else if (className) {
      // Extract text or text and links by class name
      let elements = isCheerio
        ? parser(`.${className}`)
            .map((_, el) => extractElement(parser(el), extractLinks))
            .get()
        : [...parser.querySelectorAll(`.${className}`)].map((el) =>
            extractElement(el, extractLinks)
          );
      return elements.filter(
        (item) => item.text && (extractLinks ? item.link : true)
      );
    } else {
      return {};
    }
  } catch (error) {
    console.log(`Error extracting content: ${error.message}`);
    throw error;
  }
};

// Helper Function to Extract an Element's Text and Link
const extractElement = (el, extractLinks) => {
  const textContent = el.text ? el.text().trim() : el.textContent.trim();
  const link =
    extractLinks && el.attr
      ? el.attr('href')
      : el.tagName === 'a'
      ? el.getAttribute('href')
      : null;
  return { text: textContent, link };
};

// Helper Function for fetch with timeout
const fetchWithTimeout = (url, timeout) => {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const id = setTimeout(() => {
      controller.abort();
      reject(new Error('Fetch timeout'));
    }, timeout);

    fetch(url, { method: 'GET', signal: controller.signal })
      .then((response) => {
        clearTimeout(id);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(id);
        reject(error);
      });
  });
};

// Helper Function to Download Using Puppeteer and Playwright
// These functions remain largely unchanged but can be improved for better error logging and more specific checks.

const downloadWithPuppeteer = async ({
  url,
  articleStructure,
  className,
  extractLinks,
  logger,
}) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox'],
    }); // Updated headless mode to 'new'
    const page = await browser.newPage();
    await page.setUserAgent(randomUserAgent());
    await page.goto(url, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    const content = await extractFromPage({
      page,
      articleStructure,
      className,
      extractLinks,
    });
    await browser.close();
    return { status: 'success', data: content };
  } catch (error) {
    if (browser) await browser.close();
    console.log(`Puppeteer error: ${error.message}`, { url });
    return { status: 'error', message: error.message, url };
  }
};

const downloadWithPlaywright = async ({
  url,
  articleStructure,
  className,
  extractLinks,
  logger,
}) => {
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: randomUserAgent() });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT });

    const content = await extractFromPage({
      page,
      articleStructure,
      className,
      extractLinks,
    });
    await browser.close();
    return { status: 'success', data: content };
  } catch (error) {
    await browser.close();
    console.log(`Playwright error: ${error.message}`, { url });
    return { status: 'error', message: error.message, url };
  }
};

// Helper Function to Extract Content from Puppeteer or Playwright Page
const extractFromPage = async ({
  page,
  articleStructure,
  className,
  extractLinks,
}) => {
  if (articleStructure) {
    const content = {};
    for (const { elementName, selector } of articleStructure) {
      const elements = await page.$$eval(selector, (els) =>
        els.map((el) => el.textContent.trim()).filter(Boolean)
      );
      content[elementName] = elements;
    }
    return content;
  } else if (className) {
    return await page.$$eval(
      `.${className}`,
      (els, extractLinks) =>
        els
          .map((el) => {
            const text = el.textContent.trim();
            const linkElement = extractLinks
              ? el.tagName.toLowerCase() === 'a'
                ? el
                : el.querySelector('a')
              : null;
            const link = linkElement ? linkElement.href : null;
            return { text, link };
          })
          .filter((item) => item.text && (extractLinks ? item.link : true)),
      extractLinks
    );
  } else {
    return {};
  }
};

// Exporting functions
export {
  downloadAndExtract, // Unified function for downloading and extracting content
};
