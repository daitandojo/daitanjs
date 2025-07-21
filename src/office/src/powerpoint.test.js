/**
 * @jest-environment jsdom
 */
// src/office/src/word.test.js
import { Document, Packer, Paragraph } from 'docx';
import mammoth from 'mammoth';
import fs from 'fs/promises';
import {
  createWordDocument,
  addWordParagraph,
  addWordTable,
  saveWordDocument,
  readWordDocument,
} from './word.js';
import { DaitanInvalidInputError } from '@daitanjs/error';
import { Buffer } from 'buffer';

// --- Mocking Setup ---
jest.mock('docx', () => {
  const actualDocx = jest.requireActual('docx');
  return {
    ...actualDocx,
    Document: jest.fn().mockImplementation(() => ({
      addSection: jest.fn(),
      Sections: [],
    })),
    Packer: {
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-docx-buffer')),
      toBlob: jest.fn().mockResolvedValue({ isMockBlob: true }),
    },
  };
});
jest.mock('mammoth');
jest.mock('fs/promises');

jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('@daitanjs/office/word', () => {
  let mockDoc;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc = new Document();
    mammoth.extractRawText.mockResolvedValue({
      value: 'This is the doc text.',
    });
    fs.writeFile.mockResolvedValue(undefined);
    fs.mkdir.mockResolvedValue(undefined);
    fs.readFile.mockResolvedValue(Buffer.from('mock-docx-file-content'));

    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
    document.createElement = jest.fn(() => ({
      click: jest.fn(),
      href: '',
      download: '',
    }));
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();
  });

  describe('createWordDocument', () => {
    it('should return a new docx Document instance', () => {
      const doc = createWordDocument({ title: 'My Doc' });
      expect(Document).toHaveBeenCalled();
      expect(doc).toBeDefined();
    });

    it('should pass title and other options to the Document constructor', () => {
      createWordDocument({ title: 'Test Title' });
      const constructorOptions = Document.mock.calls[0][0];
      expect(constructorOptions.sections[0].children[0]).toBeInstanceOf(
        Paragraph
      );
    });
  });

  describe('addWordParagraph', () => {
    it('should not throw when adding a valid paragraph', () => {
      expect(() => addWordParagraph(mockDoc, 'Hello, World!')).not.toThrow();
    });

    it('should throw DaitanInvalidInputError for an invalid document object', () => {
      expect(() => addWordParagraph({}, 'test')).toThrow(
        DaitanInvalidInputError
      );
    });
  });

  describe('addWordTable', () => {
    it('should not throw when adding a valid table', () => {
      const tableData = {
        headersData: ['Col1', 'Col2'],
        rowsData: [
          ['A1', 'B1'],
          ['A2', 'B2'],
        ],
      };
      expect(() => addWordTable(mockDoc, tableData)).not.toThrow();
    });
  });

  describe('saveWordDocument', () => {
    it('should call Packer.toBlob in a browser environment', async () => {
      await saveWordDocument(mockDoc, 'browser-test.docx');
      expect(Packer.toBlob).toHaveBeenCalledWith(mockDoc);
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it('should call Packer.toBuffer and fs.writeFile in a Node.js environment', async () => {
      const originalWindow = global.window;
      delete global.window;

      await saveWordDocument(mockDoc, './output/node-test.docx');
      expect(Packer.toBuffer).toHaveBeenCalledWith(mockDoc);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('node-test.docx'),
        expect.any(Buffer)
      );

      global.window = originalWindow;
    });

    it('should return a buffer in Node.js if no filename is provided', async () => {
      const originalWindow = global.window;
      delete global.window;

      const buffer = await saveWordDocument(mockDoc);
      expect(Packer.toBuffer).toHaveBeenCalled();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(fs.writeFile).not.toHaveBeenCalled();

      global.window = originalWindow;
    });
  });

  describe('readWordDocument', () => {
    it('should parse a DOCX file from a buffer and return text content', async () => {
      const buffer = Buffer.from('fake-docx-data');
      const result = await readWordDocument(buffer);
      expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer });
      expect(result).toBe('This is the doc text.');
    });
  });
});
