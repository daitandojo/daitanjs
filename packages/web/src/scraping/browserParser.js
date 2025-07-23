// web/src/scraping/browserParser.js
/**
 * @file Content extraction logic for dynamic, browser-based parsers (Puppeteer, Playwright).
 * @module @daitanjs/web/scraping/browserParser
 * @private
 */
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';

/**
 * Extracts content from a Puppeteer/Playwright page object.
 * This function orchestrates the data extraction by executing code within the browser context.
 *
 * @param {object} params
 * @param {any} params.page - The Puppeteer or Playwright page object.
 * @param {Array<{elementName: string, selector: string}>} [params.articleStructure] - Priority extraction structure. Also used by `mainContentSelectors`.
 * @param {string} [params.className] - Legacy: class name for text/link extraction.
 * @param {string} [params.linkSelector] - Legacy: selector for link extraction.
 * @param {boolean} [params.extractLinks] - Legacy: flag to extract links with text.
 * @returns {Promise<Array<object> | object>} The extracted data.
 */
export const extractContentFromBrowserPage = async ({
  page,
  articleStructure,
  className,
  linkSelector,
  extractLinks,
}) => {
  if (typeof page.$$eval !== 'function') {
    throw new DaitanOperationError(
      'Page object passed to extractContentFromBrowserPage is invalid (missing $$eval).'
    );
  }

  // Priority 1: Structured data extraction using `articleStructure`.
  // This is also used by the new `mainContentSelectors` for "reader mode".
  if (
    articleStructure &&
    Array.isArray(articleStructure) &&
    articleStructure.length > 0
  ) {
    const content = {};
    for (const { elementName, selector } of articleStructure) {
      if (!elementName || !selector) continue;

      const elementTexts = await page.$$eval(selector, (els) =>
        els.map((el) => el.textContent?.trim()).filter(Boolean)
      );

      // Use a Set to store unique text values, especially if selectors overlap
      const uniqueTexts = new Set(content[elementName] || []);
      elementTexts.forEach((text) => uniqueTexts.add(text));

      content[elementName] = Array.from(uniqueTexts);
    }
    return content;
  }

  // Priority 2: Legacy support for `className` or `linkSelector`.
  const effectiveSelector =
    linkSelector || (className ? `.${className}` : null);

  if (effectiveSelector) {
    // This function is serialized and executed in the browser by puppeteer/playwright
    return await page.$$eval(
      effectiveSelector,
      (elsInBrowser, extractLinksFlagBrowser) =>
        elsInBrowser
          .map((elInBrowser) => {
            let linkInBrowser = null;
            if (extractLinksFlagBrowser) {
              const anchor =
                elInBrowser.closest?.('a') ||
                (elInBrowser.tagName === 'A' ? elInBrowser : null) ||
                elInBrowser.querySelector?.('a');
              linkInBrowser = anchor?.href || null;
            }
            return {
              text: elInBrowser.textContent?.trim() || '',
              link: linkInBrowser,
            };
          })
          .filter(
            (item) =>
              item.text &&
              (!extractLinksFlagBrowser ||
                (item.link &&
                  (item.link.startsWith('http') || item.link.startsWith('/'))))
          ),
      extractLinks // This argument is passed to the browser-side function
    );
  }

  throw new DaitanConfigurationError(
    'No valid extraction configuration provided (mainContentSelectors, articleStructure, className, or linkSelector).'
  );
};
