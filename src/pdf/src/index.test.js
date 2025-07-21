// src/pdf/src/index.test.js
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import {
  htmlToPDF,
  mergePDFs,
  splitPDF,
  savePDFBufferToFile,
  generatePdfReport, // Import the new function
} from './index.js';
import * as htmlComponents from '@daitanjs/html'; // For mocking HTML generation
import {
  DaitanInvalidInputError,
  DaitanExternalDependencyError,
} from '@daitanjs/error';

// --- Mocking Setup ---
jest.mock('puppeteer');
jest.mock('pdf-lib');
jest.mock('fs/promises');
jest.mock('@daitanjs/html'); // Mock the entire html package

jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('@daitanjs/pdf', () => {
  let mockPage;
  let mockBrowser;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPage = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-from-html')),
    };
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    puppeteer.launch.mockResolvedValue(mockBrowser);

    const mockPdfDoc = {
      copyPages: jest.fn().mockResolvedValue(['page1', 'page2']),
      addPage: jest.fn(),
      save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
      getPageCount: jest.fn().mockReturnValue(2),
      getPageIndices: jest.fn().mockReturnValue([0, 1]),
    };
    PDFDocument.create.mockResolvedValue(mockPdfDoc);
    PDFDocument.load.mockResolvedValue(mockPdfDoc);

    fs.writeFile.mockResolvedValue(undefined);
    fs.mkdir.mockResolvedValue(undefined);

    // Mock HTML component functions
    htmlComponents.createHeading.mockReturnValue('<h1>Mock Title</h1>');
    htmlComponents.createTable.mockReturnValue('<table>Mock Table</table>');
    htmlComponents.createEmailWrapper.mockReturnValue(
      '<html><body>Mock Content</body></html>'
    );
  });

  describe('htmlToPDF', () => {
    it('should convert HTML to a PDF buffer', async () => {
      const html = '<h1>Hello PDF</h1>';
      const buffer = await htmlToPDF({ htmlContent: html });
      expect(puppeteer.launch).toHaveBeenCalled();
      expect(mockPage.setContent).toHaveBeenCalledWith(html, {
        waitUntil: 'networkidle0',
      });
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString()).toBe('mock-pdf-from-html');
    });
  });

  describe('mergePDFs', () => {
    it('should merge multiple PDF buffers into one', async () => {
      const pdfs = [Buffer.from('pdf1'), Buffer.from('pdf2')];
      const mergedBuffer = await mergePDFs({ pdfBuffers: pdfs });
      expect(PDFDocument.create).toHaveBeenCalledTimes(1);
      expect(PDFDocument.load).toHaveBeenCalledTimes(2);
      expect(mergedBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('splitPDF', () => {
    it('should split a PDF based on page selections', async () => {
      const sourcePdf = Buffer.from('source-pdf');
      const selections = [0, [1]];
      const splitBuffers = await splitPDF({
        pdfInput: sourcePdf,
        pageSelections: selections,
      });
      expect(PDFDocument.load).toHaveBeenCalledWith(sourcePdf);
      expect(splitBuffers.length).toBe(2);
    });
  });

  describe('savePDFBufferToFile', () => {
    it('should write a buffer to the specified file path', async () => {
      const buffer = Buffer.from('my-pdf-content');
      const outputPath = './output/final.pdf';
      await savePDFBufferToFile({ pdfBuffer: buffer, outputPath });
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('final.pdf'),
        buffer
      );
    });
  });

  describe('generatePdfReport', () => {
    it('should orchestrate HTML creation, PDF conversion, and saving', async () => {
      const params = {
        data: [{ id: 1, name: 'Test' }],
        columns: ['id', 'name'],
        title: 'Test Report',
        outputPath: './reports/test.pdf',
      };

      const result = await generatePdfReport(params);

      // Verify HTML generation was called
      expect(htmlComponents.createHeading).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Test Report' })
      );
      expect(htmlComponents.createTable).toHaveBeenCalled();
      expect(htmlComponents.createEmailWrapper).toHaveBeenCalled();

      // Verify PDF conversion was called
      expect(puppeteer.launch).toHaveBeenCalled();

      // Verify file saving was called
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.pdf'),
        expect.any(Buffer)
      );

      // Verify final result object
      expect(result.success).toBe(true);
      expect(result.path).toBe(require('path').resolve(params.outputPath));
      expect(result.size).toBeGreaterThan(0);
    });

    it('should throw DaitanInvalidInputError for invalid input', async () => {
      await expect(
        generatePdfReport({ data: [], columns: [], title: '', outputPath: '' })
      ).rejects.toThrow(DaitanInvalidInputError);
    });
  });
});
