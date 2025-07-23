// pdf/src/manipulation.js
/**
 * @file Contains PDF manipulation functionalities, such as merging and splitting.
 * @module @daitanjs/pdf/manipulation
 *
 * @description
 * This module is dedicated to manipulating existing PDF documents. It leverages the
 * `pdf-lib` library to perform operations directly on PDF data in memory (as Buffers
 * or ArrayBuffers), making it efficient and suitable for server-side processing.
 */

import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { Buffer } from 'buffer';
import { getLogger } from '@daitanjs/development';
import {
  DaitanInvalidInputError,
  DaitanOperationError,
  DaitanExternalDependencyError,
  DaitanFileOperationError,
} from '@daitanjs/error';

const logger = getLogger('daitan-pdf-manipulation');

/**
 * Merges multiple PDF documents into a single PDF document.
 * @public
 * @async
 * @param {{pdfBuffers: Array<Buffer | ArrayBuffer | Uint8Array>}} params
 * @returns {Promise<Buffer>} A Node.js Buffer containing the merged PDF data.
 */
export const mergePDFs = async ({ pdfBuffers }) => {
  if (!Array.isArray(pdfBuffers) || pdfBuffers.length === 0) {
    throw new DaitanInvalidInputError(
      'Input for mergePDFs must be a non-empty array of Buffers or ArrayBuffers.'
    );
  }
  if (
    !pdfBuffers.every(
      (b) =>
        b instanceof Buffer ||
        b instanceof ArrayBuffer ||
        b instanceof Uint8Array
    )
  ) {
    throw new DaitanInvalidInputError(
      'All items in pdfBuffers array must be Buffer, ArrayBuffer, or Uint8Array.'
    );
  }
  if (pdfBuffers.length === 1) {
    return pdfBuffers[0] instanceof Buffer
      ? pdfBuffers[0]
      : Buffer.from(pdfBuffers[0]);
  }

  try {
    const mergedPdfDoc = await PDFDocument.create();
    for (const pdfBuffer of pdfBuffers) {
      const sourcePdfDoc = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdfDoc.copyPages(
        sourcePdfDoc,
        sourcePdfDoc.getPageIndices()
      );
      copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
    }
    if (mergedPdfDoc.getPageCount() === 0) return Buffer.alloc(0);
    const mergedPdfBytes = await mergedPdfDoc.save();
    return Buffer.from(mergedPdfBytes);
  } catch (error) {
    throw new DaitanOperationError(
      `PDF merging failed: ${error.message}`,
      {},
      error
    );
  }
};

/**
 * Splits a PDF document into multiple PDF documents based on specified page selections.
 * @public
 * @async
 * @param {{pdfInput: Buffer | ArrayBuffer | Uint8Array, pageSelections: Array<number | number[]>}} params
 * @returns {Promise<Buffer[]>} An array of Node.js Buffers, each a split PDF document.
 */
export const splitPDF = async ({ pdfInput, pageSelections }) => {
  if (
    !(
      pdfInput instanceof Buffer ||
      pdfInput instanceof ArrayBuffer ||
      pdfInput instanceof Uint8Array
    )
  ) {
    throw new DaitanInvalidInputError(
      'Input `pdfInput` must be a Buffer, ArrayBuffer, or Uint8Array.'
    );
  }
  if (!Array.isArray(pageSelections) || pageSelections.length === 0) {
    throw new DaitanInvalidInputError(
      '`pageSelections` must be a non-empty array of page numbers or arrays of page numbers (0-indexed).'
    );
  }

  try {
    const sourcePdfDoc = await PDFDocument.load(pdfInput);
    const totalPages = sourcePdfDoc.getPageCount();
    if (totalPages === 0) return [];

    const splitPdfBuffers = [];
    for (const selection of pageSelections) {
      const pageIndicesToCopy = (
        Array.isArray(selection) ? selection : [selection]
      ).filter((p) => Number.isInteger(p) && p >= 0 && p < totalPages);
      if (pageIndicesToCopy.length > 0) {
        const newPdfDoc = await PDFDocument.create();
        const copiedPages = await newPdfDoc.copyPages(
          sourcePdfDoc,
          pageIndicesToCopy
        );
        copiedPages.forEach((page) => newPdfDoc.addPage(page));
        const newPdfBytes = await newPdfDoc.save();
        splitPdfBuffers.push(Buffer.from(newPdfBytes));
      }
    }
    return splitPdfBuffers;
  } catch (error) {
    throw new DaitanOperationError(
      `PDF splitting failed: ${error.message}`,
      {},
      error
    );
  }
};

/**
 * Saves a PDF buffer to a file in a Node.js environment.
 * @public
 * @async
 * @param {{pdfBuffer: Buffer | ArrayBuffer | Uint8Array, outputPath: string}} params
 * @returns {Promise<string>} A promise that resolves with the `outputPath` upon success.
 */
export const savePDFBufferToFile = async ({ pdfBuffer, outputPath }) => {
  if (typeof window !== 'undefined') {
    throw new DaitanOperationError(
      'savePDFBufferToFile is intended for Node.js environments only.'
    );
  }
  if (
    !(
      pdfBuffer instanceof Buffer ||
      pdfBuffer instanceof ArrayBuffer ||
      pdfBuffer instanceof Uint8Array
    ) ||
    pdfBuffer.byteLength === 0
  ) {
    throw new DaitanInvalidInputError('Invalid or empty pdfBuffer provided.');
  }
  if (!outputPath || typeof outputPath !== 'string' || !outputPath.trim()) {
    throw new DaitanInvalidInputError('Invalid outputPath provided.');
  }

  const resolvedPath = path.resolve(outputPath);
  const outputDir = path.dirname(resolvedPath);

  try {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      resolvedPath,
      pdfBuffer instanceof Buffer ? pdfBuffer : Buffer.from(pdfBuffer)
    );
    return resolvedPath;
  } catch (error) {
    throw new DaitanFileOperationError(
      `Failed to save PDF to file "${resolvedPath}": ${error.message}`,
      { path: resolvedPath },
      error
    );
  }
};
