// intelligence/src/intelligence/rag/documentLoader.js
/**
 * @file Provides document loading and parsing capabilities from various file formats.
 * @module @daitanjs/intelligence/rag/documentLoader
 *
 * @description
 * This module is responsible for reading local files (PDF, DOCX, TXT, HTML, etc.) and
 * converting their content into a standardized format, specifically LangChain `Document` objects.
 * It also provides a helper to extract raw text content for preliminary analysis, such as
 * AI-driven metadata generation, before the full document is chunked and processed.
 */
import fs from 'fs-extra';
import path from 'path';
import mammoth from 'mammoth';
import { JSDOM } from 'jsdom';
import Papa from 'papaparse';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanFileOperationError,
} from '@daitanjs/error';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Document as LangchainDocumentCore } from '@langchain/core/documents';

const loaderHelperLogger = getLogger('daitan-rag-loader-helper');

/**
 * Loads documents from a local file path using appropriate loaders.
 * @public
 * @async
 * @param {string} filePath - The path to the file.
 * @param {object} [options={}] - Options for loading.
 * @returns {Promise<LangchainDocumentCore[]>} An array of LangChain Document objects.
 */
export const loadDocumentsFromFile = async (filePath, options = {}) => {
  const configManager = getConfigManager(); // Lazy-load
  const currentCallVerbose =
    options.localVerbose ??
    (configManager.get('RAG_LOADER_VERBOSE', false) ||
      configManager.get('DEBUG_INTELLIGENCE', false));
  const logContext = { filePath: path.basename(filePath) };

  if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
    throw new DaitanConfigurationError('filePath must be a non-empty string.');
  }

  const absoluteFilePath = path.resolve(filePath);
  const fileExtension = path.extname(absoluteFilePath).toLowerCase();
  logContext.fileExtension = fileExtension;

  if (!(await fs.pathExists(absoluteFilePath))) {
    throw new DaitanFileOperationError(`File not found: ${absoluteFilePath}`, {
      path: absoluteFilePath,
      operation: 'load',
    });
  }

  try {
    let documents = [];
    const plainTextExtensions = [
      '.txt',
      '.md',
      '.rtf',
      '.js',
      '.ts',
      '.py',
      '.java',
      '.c',
      '.cpp',
      '.h',
      '.hpp',
      '.cs',
      '.xml',
      '.yaml',
      '.yml',
      '.log',
      '.sh',
      '.bash',
      '.sql',
      '.rb',
      '.go',
      '.php',
      '.swift',
      '.kt',
    ];

    if (plainTextExtensions.includes(fileExtension)) {
      const textContent = await fs.readFile(absoluteFilePath, 'utf-8');
      documents = [
        new LangchainDocumentCore({
          pageContent: textContent,
          metadata: { source_type: fileExtension.substring(1) },
        }),
      ];
    } else {
      switch (fileExtension) {
        case '.pdf':
          const pdfLoader = new PDFLoader(absoluteFilePath, {
            splitPages: options.pdfSplitPages !== false,
          });
          documents = await pdfLoader.load();
          break;
        case '.docx':
          const docxBuffer = await fs.readFile(absoluteFilePath);
          const docxResult = await mammoth.extractRawText({
            buffer: docxBuffer,
          });
          documents = [
            new LangchainDocumentCore({
              pageContent: docxResult.value || '',
              metadata: { source_type: 'docx' },
            }),
          ];
          break;
        case '.html':
        case '.htm':
          const htmlContent = await fs.readFile(absoluteFilePath, 'utf-8');
          const dom = new JSDOM(htmlContent);
          const selectors = [
            'main',
            'article',
            '.main-content',
            '.content',
            '#main',
            '#content',
            '[role="main"]',
            'body',
          ];
          let extractedText = '';
          for (const selector of selectors) {
            const element = dom.window.document.querySelector(selector);
            if (element) {
              extractedText = element.textContent?.trim() || '';
              if (extractedText) break;
            }
          }
          const maxHtmlLength = options.maxHtmlContentLength || 500000;
          extractedText = extractedText
            .replace(/\s\s+/g, ' ')
            .replace(/\n\s*\n+/g, '\n')
            .trim()
            .substring(0, maxHtmlLength);
          documents = [
            new LangchainDocumentCore({
              pageContent: extractedText,
              metadata: { source_type: 'html' },
            }),
          ];
          break;
        case '.json':
          const jsonContent = await fs.readFile(absoluteFilePath, 'utf-8');
          documents = [
            new LangchainDocumentCore({
              pageContent: JSON.stringify(JSON.parse(jsonContent), null, 2),
              metadata: { source_type: 'json_object' },
            }),
          ];
          break;
        case '.csv':
          const csvContent = await fs.readFile(absoluteFilePath, 'utf-8');
          const parsedCsv = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
          });
          documents = parsedCsv.data.map(
            (row, index) =>
              new LangchainDocumentCore({
                pageContent: Object.values(row).join('; '),
                metadata: {
                  source_type: 'csv_row',
                  row_number: index + 1,
                  ...row,
                },
              })
          );
          break;
        default:
          throw new DaitanConfigurationError(
            `Unsupported file type: ${fileExtension}`
          );
      }
    }

    documents.forEach((doc) => {
      doc.metadata = {
        ...doc.metadata,
        source: absoluteFilePath,
        source_filename: path.basename(absoluteFilePath),
      };
    });

    if (currentCallVerbose) {
      loaderHelperLogger.debug(
        `Loaded ${documents.length} document(s) from "${absoluteFilePath}".`
      );
    }
    return documents;
  } catch (error) {
    throw new DaitanFileOperationError(
      `Failed to load or parse file ${absoluteFilePath}: ${error.message}`,
      { path: absoluteFilePath },
      error
    );
  }
};

/**
 * Extracts raw text content from a file for metadata generation purposes.
 * @public
 * @async
 * @param {string} filePath
 * @param {object} [options={}]
 * @returns {Promise<string>}
 */
export const extractRawTextForMetadata = async (filePath, options = {}) => {
  const docs = await loadDocumentsFromFile(filePath, options);
  return docs.map((doc) => doc.pageContent).join('\n\n');
};
