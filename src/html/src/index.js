// html/src/index.js
/**
 * @file Main entry point for the @daitanjs/html package.
 * @module @daitanjs/html
 *
 * @description
 * This package provides utilities for generating HTML strings for various components,
 * including general web components and email-specific components. It aims for ease of use,
 * sensible defaults, and customization through styles and attributes.
 *
 * Key Features:
 * - Functions for common HTML elements (headings, paragraphs, links, images, lists, tables, forms, etc.).
 * - Specific functions for email-safe HTML structures (wrappers, headers, footers, article cards).
 * - Style merging capabilities for inline CSS.
 * - Attribute building helpers.
 *
 * Security Reminder:
 * This library DOES NOT sanitize inputs passed to its component generation functions.
 * The responsibility for sanitizing any user-provided or untrusted data (e.g., text content,
 * URLs, style values) lies with the CALLER to prevent XSS vulnerabilities.
 * Use appropriate sanitization libraries (e.g., DOMPurify) for any dynamic content.
 */

import { getLogger } from '@daitanjs/development';

const htmlIndexLogger = getLogger('daitan-html-index');

htmlIndexLogger.debug('Exporting DaitanJS HTML module functionalities...');

// --- General HTML Component Generators ---
// These are from `components.js`
export {
  createHeading,
  createParagraph,
  createLink,
  createImage,
  createButton,
  createList,
  createCard,
  createBlock,
  createFlexContainer,
  createFlexItem,
  createForm,
  createInput,
  createLabel,
  createDivider,
  createBadge,
  createAlert,
  createTable,
} from './components.js';

// --- Email-Specific HTML Component Generators ---
// These are from `emailComponents.js`
export {
  createEmailWrapper,
  createEmailHeader,
  createEmailFooter,
  createArticleCardForEmail,
} from './emailComponents.js';

htmlIndexLogger.info('DaitanJS HTML module exports ready.');
