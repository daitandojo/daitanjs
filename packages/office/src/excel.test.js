/**
 * @jest-environment jsdom
 */
// src/office/src/excel.test.js
import { downloadTableAsExcel } from './excel.js';
import { DaitanInvalidInputError } from '@daitanjs/error';
import ExcelJS from 'exceljs';

// Mock the logger
jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock ExcelJS
jest.mock('exceljs', () => {
  const mockWorksheet = {
    columns: [],
    getRow: jest.fn(() => ({
      font: {},
      fill: {},
      alignment: {},
      eachCell: jest.fn(),
    })),
    addRow: jest.fn(() => ({
      eachCell: jest.fn(),
    })),
    autoFilter: '',
  };
  const mockWorkbook = {
    creator: '',
    lastModifiedBy: '',
    created: '',
    modified: '',
    addWorksheet: jest.fn(() => mockWorksheet),
    xlsx: {
      writeBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)), // Return a mock buffer
    },
  };
  return jest.fn().mockImplementation(() => mockWorkbook);
});

const isXlsx = (buffer) => {
  // A simplified check for the PKZIP signature at the start of XLSX files.
  // In a real scenario, this would be more robust. Our mock returns a generic ArrayBuffer.
  return buffer.byteLength > 0;
};

describe('@daitanjs/office/excel', () => {
  const sampleData = [
    { id: 1, name: 'Alice', role: 'Developer', age: 30 },
    { id: 2, name: 'Bob', role: 'Manager', age: 42 },
  ];

  const sampleColumns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Full Name', key: 'name', width: 30 },
    { header: 'Position', key: 'role', width: 20 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('downloadTableAsExcel (Node.js Environment simulation)', () => {
    let originalWindow;
    beforeAll(() => {
      originalWindow = global.window;
      delete global.window; // Simulate Node.js
    });
    afterAll(() => {
      global.window = originalWindow; // Restore
    });

    it('should generate a valid Excel buffer', async () => {
      const result = await downloadTableAsExcel({ data: sampleData });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Excel buffer generated');
      expect(result.buffer).toBeInstanceOf(ArrayBuffer);
      expect(isXlsx(result.buffer)).toBe(true);
    });

    it('should use provided column definitions', async () => {
      await downloadTableAsExcel({ data: sampleData, columns: sampleColumns });
      const mockWorkbookInstance = new ExcelJS();
      const mockWorksheetInstance = mockWorkbookInstance.addWorksheet();
      expect(mockWorksheetInstance.columns[0].header).toBe('ID');
    });

    it('should throw DaitanInvalidInputError for invalid data', async () => {
      await expect(downloadTableAsExcel({ data: [] })).rejects.toThrow(
        DaitanInvalidInputError
      );
      await expect(downloadTableAsExcel({ data: [1, 2, 3] })).rejects.toThrow(
        DaitanInvalidInputError
      );
    });
  });

  describe('downloadTableAsExcel (Browser Environment)', () => {
    let createElementSpy,
      appendChildSpy,
      removeChildSpy,
      clickSpy,
      createObjectURLSpy,
      revokeObjectURLSpy;

    beforeEach(() => {
      // Mock browser APIs
      createObjectURLSpy = jest.fn(() => 'blob:mock-url');
      revokeObjectURLSpy = jest.fn();

      global.document.createElement = jest.fn((tag) => {
        if (tag === 'a') {
          return { href: '', download: '', click: (clickSpy = jest.fn()) };
        }
        return {};
      });
      global.document.body.appendChild = appendChildSpy = jest.fn();
      global.document.body.removeChild = removeChildSpy = jest.fn();
      global.Blob = jest.fn((content, options) => ({
        size: content[0]?.byteLength || 0,
      }));
      global.URL.createObjectURL = createObjectURLSpy;
      global.URL.revokeObjectURL = revokeObjectURLSpy;
    });

    it('should trigger a download in a mocked browser environment', async () => {
      const result = await downloadTableAsExcel({
        data: sampleData,
        filename: 'report.xlsx',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('download initiated');
      expect(result.blob).toBeDefined();

      expect(global.Blob).toHaveBeenCalled();
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
