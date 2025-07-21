// office/src/word.js
/**
 * @file Word (.docx) document generation and manipulation utilities using the `docx` library.
 * @module @daitanjs/office/word
 */
import fs from 'fs/promises';
import path from 'path';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  Packer,
  AlignmentType,
  WidthType,
  BorderStyle,
  VerticalAlign,
} from 'docx';
import mammoth from 'mammoth';
import { getLogger } from '@daitanjs/development';
import {
  DaitanInvalidInputError,
  DaitanFileOperationError,
  DaitanOperationError,
  DaitanBrowserSpecificError,
  DaitanConfigurationError,
} from '@daitanjs/error';
import { Buffer } from 'buffer';

const logger = getLogger('daitan-office-word');

/**
 * Creates a new Word document (.docx) instance.
 * @public
 * @param {object} [options={}]
 * @returns {Document} A new `docx` Document object.
 */
export function createWordDocument(options = {}) {
  const {
    title,
    creator = 'DaitanJS Office Module',
    description = 'Document created with @daitanjs/office',
    addDefaultStyles = true,
    sections = [],
    ...docOptions
  } = options;
  const initialSections = [...sections];
  if (title) {
    const titleParagraph = new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    });
    if (initialSections.length > 0) {
      initialSections[0].children = [
        titleParagraph,
        ...(initialSections[0].children || []),
      ];
    } else {
      initialSections.push({ properties: {}, children: [titleParagraph] });
    }
  }

  return new Document({
    creator,
    description,
    title: title || 'Untitled DaitanJS Document',
    sections: initialSections,
    ...(addDefaultStyles && {
      styles: {
        default: {
          document: {
            run: { size: '11pt', font: 'Calibri' },
            paragraph: { spacing: { after: 120 } },
          },
          heading1: {
            run: { size: '16pt', bold: true },
            paragraph: { spacing: { before: 240, after: 120 } },
          },
        },
      },
    }),
    ...docOptions,
  });
}

/**
 * Adds a paragraph to the last section of the document.
 * @public
 * @param {Document} doc
 * @param {string | TextRun | Array<string | TextRun>} content
 * @param {object} [options={}]
 */
export function addWordParagraph(doc, content, options = {}) {
  if (!doc || typeof doc.addSection !== 'function') {
    throw new DaitanInvalidInputError(
      'Invalid Document object provided to addWordParagraph.'
    );
  }
  const { bold, color, size, font, italics, ...paraOpts } = options;
  const textRuns = (Array.isArray(content) ? content : [content]).map((item) =>
    item instanceof TextRun
      ? item
      : new TextRun({
          text: String(item ?? ''),
          bold,
          color,
          size,
          font,
          italics,
        })
  );
  const paragraph = new Paragraph({ children: textRuns, ...paraOpts });
  if (doc.Sections.length > 0) {
    doc.Sections[doc.Sections.length - 1].addParagraph(paragraph);
  } else {
    doc.addSection({ children: [paragraph] });
  }
}

/**
 * Adds a table to the last section of the document.
 * @public
 * @param {Document} doc
 * @param {object} params
 */
export function addWordTable(
  doc,
  {
    rowsData,
    headersData,
    tableOptions = { width: { size: 100, type: WidthType.PERCENTAGE } },
    ...stylingOptions
  }
) {
  if (!doc || typeof doc.addSection !== 'function') {
    throw new DaitanInvalidInputError(
      'Invalid Document object provided to addWordTable.'
    );
  }
  if (!Array.isArray(rowsData)) {
    throw new DaitanInvalidInputError(
      'Table `rowsData` must be an array of arrays.'
    );
  }

  const createCell = (content, defaultOptions) =>
    new TableCell({
      ...defaultOptions,
      children: [new Paragraph(String(content ?? ''))],
    });
  const tableRows = [];
  if (headersData) {
    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: headersData.map((h) =>
          createCell(h, stylingOptions.headerCellOptions)
        ),
      })
    );
  }
  rowsData.forEach((rowData) => {
    tableRows.push(
      new TableRow({
        children: rowData.map((c) =>
          createCell(c, stylingOptions.dataCellOptions)
        ),
      })
    );
  });

  if (tableRows.length === 0) return;

  const table = new Table({ ...tableOptions, rows: tableRows });
  if (doc.Sections.length > 0) {
    doc.Sections[doc.Sections.length - 1].addTable(table);
  } else {
    doc.addSection({ children: [table] });
  }
}

/**
 * Saves the `docx` Document object to a file or returns a buffer.
 * @public
 * @async
 * @param {Document} doc
 * @param {string} [filename]
 * @returns {Promise<Buffer | void>}
 */
export async function saveWordDocument(doc, filename) {
  if (!doc || typeof doc.addSection !== 'function') {
    throw new DaitanInvalidInputError(
      'Invalid Document object provided to saveWordDocument.'
    );
  }
  const finalFilename = filename
    ? filename.endsWith('.docx')
      ? filename
      : `${filename}.docx`
    : null;

  try {
    if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
      if (!finalFilename)
        throw new DaitanConfigurationError(
          'Filename is required for browser download.'
        );
      const blob = await Packer.toBlob(doc);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } else {
      const buffer = await Packer.toBuffer(doc);
      if (finalFilename) {
        await fs.mkdir(path.dirname(finalFilename), { recursive: true });
        await fs.writeFile(finalFilename, buffer);
      } else {
        return buffer;
      }
    }
  } catch (error) {
    throw new DaitanFileOperationError(
      `Error saving Word document "${finalFilename || ''}": ${error.message}`,
      { path: finalFilename },
      error
    );
  }
}

/**
 * Reads a Word document (.docx) and extracts its text content.
 * @public
 * @async
 * @param {string | Buffer | ArrayBuffer} fileSource
 * @returns {Promise<string>}
 */
export async function readWordDocument(fileSource) {
  if (!fileSource) {
    throw new DaitanInvalidInputError(
      'File source is required for readWordDocument.'
    );
  }
  let mammothInputOptions = {};
  if (typeof fileSource === 'string') {
    if (typeof window !== 'undefined')
      throw new DaitanConfigurationError(
        'Reading local DOCX paths not supported in browser.'
      );
    mammothInputOptions.path = fileSource;
  } else if (
    fileSource instanceof Buffer ||
    fileSource instanceof ArrayBuffer
  ) {
    mammothInputOptions.buffer = fileSource;
  } else {
    throw new DaitanInvalidInputError(
      'Invalid fileSource type for readWordDocument.'
    );
  }

  try {
    const result = await mammoth.extractRawText(mammothInputOptions);
    return result.value || '';
  } catch (error) {
    throw new DaitanFileOperationError(
      `Error reading/parsing Word document: ${error.message}`,
      { path: mammothInputOptions.path },
      error
    );
  }
}
