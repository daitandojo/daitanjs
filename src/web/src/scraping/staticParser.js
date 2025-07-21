// web/src/scraping/staticParser.js
/**
 * @file Content extraction logic for static parsers (JSDOM, Cheerio).
 * @module @daitanjs/web/scraping/staticParser
 * @private
 */
import { DaitanConfigurationError, DaitanScrapingError } from '@daitanjs/error';
import { isValidURL } from '@daitanjs/validation';
import { truncateString } from '@daitanjs/utilities';

/**
 * Extracts element text and optionally a link.
 * This function is used for the legacy `className` and `linkSelector` options.
 * @private
 */
const extractElementDetails = (el, extractLinks, isCheerioEl) => {
  const text = (isCheerioEl ? el.text() : el.textContent)?.trim();
  let link = null;
  if (extractLinks) {
    const getHref = (anchor) =>
      anchor
        ? isCheerioEl
          ? anchor.attr('href')
          : anchor.getAttribute('href')
        : null;
    let anchor;
    if (isCheerioEl) {
      anchor = el.is('a')
        ? el
        : el.closest('a').length
        ? el.closest('a')
        : el.find('a').first();
      if (!anchor.length) anchor = el.parents('a').first();
      if (!anchor.length) anchor = null;
    } else {
      anchor =
        el.closest?.('a') ||
        (el.tagName === 'A' ? el : null) ||
        el.querySelector?.('a');
    }
    const rawLink = getHref(anchor);
    if (rawLink && typeof rawLink === 'string' && rawLink.trim()) {
      link = rawLink.trim();
    }
  }
  return { text, link };
};

/**
 * Extracts structured content or links/text using a static parser.
 * It now prioritizes the `articleStructure` which is also used for the new "reader mode"
 * via `mainContentSelectors`.
 */
export const extractContentWithStaticParser = (
  parserInstance,
  articleStructure,
  className,
  linkSelector,
  extractLinks,
  isCheerio,
  logger,
  label
) => {
  try {
    // Priority 1: Structured data extraction using `articleStructure`.
    // This is also used by the new `mainContentSelectors` for "reader mode".
    if (
      articleStructure &&
      Array.isArray(articleStructure) &&
      articleStructure.length > 0
    ) {
      const content = {};
      for (const { elementName, selector } of articleStructure) {
        if (!elementName || !selector) {
          logger.warn(
            `[${label}] Invalid element definition in articleStructure, skipping.`,
            { elementName, selector }
          );
          continue;
        }

        // Use a set to avoid duplicate text content from overlapping selectors.
        const elementTexts = new Set();
        const elements = isCheerio
          ? parserInstance(selector)
          : parserInstance.querySelectorAll(selector);

        if (isCheerio) {
          elements.each((_, el) => {
            const text = parserInstance(el).text()?.trim();
            if (text) elementTexts.add(text);
          });
        } else {
          elements.forEach((el) => {
            const text = el.textContent?.trim();
            if (text) elementTexts.add(text);
          });
        }

        // Accumulate texts for the same elementName if selectors overlap
        if (!content[elementName]) {
          content[elementName] = [];
        }
        content[elementName].push(...Array.from(elementTexts));
      }
      return content;
    }

    // Priority 2: Legacy support for `className` or `linkSelector`.
    if (className || linkSelector) {
      logger.debug(
        `[${label}] Using legacy selectors (className/linkSelector). For robust extraction, prefer 'mainContentSelectors' or 'articleStructure'.`
      );
      const effectiveSelector =
        linkSelector || (className ? `.${className}` : null);
      if (!effectiveSelector) {
        // This case should be rare given the outer check, but for safety:
        throw new DaitanConfigurationError(
          'No valid selector could be determined from className or linkSelector.'
        );
      }

      const elements = isCheerio
        ? parserInstance(effectiveSelector)
            .map((_, el) =>
              extractElementDetails(parserInstance(el), extractLinks, true)
            )
            .get()
        : [...parserInstance.querySelectorAll(effectiveSelector)].map((el) =>
            extractElementDetails(el, extractLinks, false)
          );

      return elements.filter(
        (item) =>
          item.text && (!extractLinks || (item.link && isValidURL(item.link)))
      );
    }

    throw new DaitanConfigurationError(
      'No valid extraction configuration provided (mainContentSelectors, articleStructure, className, or linkSelector).'
    );
  } catch (error) {
    logger.warn(
      `[${label}] Content extraction (${
        isCheerio ? 'Cheerio' : 'JSDOM'
      }) failed: ${error.message}`
    );
    if (error instanceof DaitanConfigurationError) throw error;
    throw new DaitanScrapingError(
      `Content extraction error with ${isCheerio ? 'Cheerio' : 'JSDOM'}: ${
        error.message
      }`,
      {},
      error
    );
  }
};

/**
 * Logs a summary of the extraction results.
 */
export const logExtractionSummary = ({
  logger,
  label,
  extracted,
  className,
  linkSelector,
  articleStructure,
}) => {
  const isArray = Array.isArray(extracted);
  let count = 0;
  if (isArray) {
    count = extracted.length;
  } else if (extracted && typeof extracted === 'object') {
    count = Object.values(extracted).flat().length;
  }

  const selectorUsed = articleStructure
    ? 'articleStructure'
    : linkSelector || (className ? `.${className}` : 'N/A');

  if (count === 0) {
    logger.warn(
      `[${label}] Extracted 0 elements/values using selector/structure: "${selectorUsed}"`
    );
  } else if (logger.isLevelEnabled('debug')) {
    logger.debug(
      `[${label}] Extracted ${count} elements/values using: "${selectorUsed}"`,
      {
        preview: isArray
          ? extracted.slice(0, 2).map((d) => ({
              text: truncateString(d.text || JSON.stringify(d), 50),
              link: d.link ? truncateString(d.link, 40) : null,
            }))
          : Object.fromEntries(
              Object.entries(extracted)
                .slice(0, 2)
                .map(([k, v]) => [
                  k,
                  Array.isArray(v)
                    ? v.slice(0, 1).map((s) => truncateString(s, 30))
                    : truncateString(String(v), 30),
                ])
            ),
      }
    );
  }
};
