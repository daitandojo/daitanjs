/**
 * @jest-environment jsdom
 */
// src/office/src/powerpoint.test.js
import PptxGenJS from 'pptxgenjs';
import PptxParser from 'pptx-parser';
import fs from 'fs/promises';
import {
  createPresentation,
  addSlide,
  addImageToSlide,
  addChartToSlide,
  savePresentation,
  readPresentation,
} from './powerpoint.js';
import {
  DaitanInvalidInputError,
  DaitanConfigurationError,
  DaitanFileOperationError,
} from '@daitanjs/error';
import { Buffer } from 'buffer';

// --- Mocking Setup ---
jest.mock('pptxgenjs');
jest.mock('pptx-parser');
jest.mock('fs/promises');

jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('@daitanjs/office/powerpoint', () => {
  let mockPres;
  let mockSlide;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock PptxGenJS instance and its chainable methods
    mockSlide = {
      addText: jest.fn(),
      addImage: jest.fn(),
      addChart: jest.fn(),
    };
    mockPres = {
      addSlide: jest.fn(() => mockSlide),
      writeFile: jest.fn().mockResolvedValue(undefined),
      write: jest.fn().mockResolvedValue(new ArrayBuffer(100)), // For Node.js buffer saving
    };
    PptxGenJS.mockImplementation(() => mockPres);

    // Mock PptxParser
    PptxParser.parse.mockResolvedValue({
      slides: [
        {
          slideNumber: 1,
          title: 'Slide 1 Title',
          content: 'Content from slide 1.',
        },
        {
          slideNumber: 2,
          title: 'Slide 2 Title',
          content: 'Content from slide 2.',
        },
      ],
    });

    // Mock fs
    fs.writeFile.mockResolvedValue(undefined);
    fs.mkdir.mockResolvedValue(undefined);
    fs.readFile.mockResolvedValue(Buffer.from('mock-pptx-file-content'));
  });

  describe('createPresentation', () => {
    it('should return a new PptxGenJS instance', () => {
      const pres = createPresentation();
      expect(PptxGenJS).toHaveBeenCalledTimes(1);
      expect(pres).toBe(mockPres);
    });
  });

  describe('addSlide', () => {
    it('should add a slide and return the slide object', () => {
      const slide = addSlide(mockPres);
      expect(mockPres.addSlide).toHaveBeenCalled();
      expect(slide).toBe(mockSlide);
    });

    it('should add text to the slide if title and mainContent are provided', () => {
      addSlide(mockPres, { title: 'My Title', mainContent: 'My Content' });
      expect(mockSlide.addText).toHaveBeenCalledWith(
        'My Title',
        expect.any(Object)
      );
      expect(mockSlide.addText).toHaveBeenCalledWith(
        'My Content',
        expect.any(Object)
      );
    });

    it('should throw DaitanInvalidInputError for an invalid presentation object', () => {
      expect(() => addSlide({})).toThrow(DaitanInvalidInputError);
    });
  });

  describe('addImageToSlide', () => {
    it('should call slide.addImage with a data URL', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=...';
      addImageToSlide(mockSlide, dataUrl, { x: 1, y: 1, w: '50%', h: '50%' });
      expect(mockSlide.addImage).toHaveBeenCalledWith(
        expect.objectContaining({
          data: dataUrl,
          x: 1,
          y: 1,
        })
      );
    });

    it('should call slide.addImage with a file path in Node.js', () => {
      // Temporarily clear the jsdom window object to simulate Node.js env
      const originalWindow = global.window;
      delete global.window;

      const filePath = './images/my_image.png';
      addImageToSlide(mockSlide, filePath);
      expect(mockSlide.addImage).toHaveBeenCalledWith(
        expect.objectContaining({
          path: filePath,
        })
      );

      global.window = originalWindow; // Restore it
    });

    it('should throw DaitanConfigurationError if using file path in browser', () => {
      const filePath = './images/my_image.png';
      expect(() => addImageToSlide(mockSlide, filePath)).toThrow(
        DaitanConfigurationError
      );
    });
  });

  describe('addChartToSlide', () => {
    it('should call slide.addChart with correct parameters', () => {
      const chartType = 'BAR'; // Assuming PptxGenJS.charts.BAR is just a string
      const data = [{ name: 'Series1', labels: ['A'], values: [10] }];
      const options = { title: 'My Chart' };
      addChartToSlide(mockSlide, chartType, data, options);

      expect(mockSlide.addChart).toHaveBeenCalledWith(
        chartType,
        data,
        expect.objectContaining({
          title: 'My Chart',
        })
      );
    });
  });

  describe('savePresentation', () => {
    it('should call writeFile in a browser-like environment', async () => {
      await savePresentation(mockPres, 'browser-test.pptx');
      expect(mockPres.writeFile).toHaveBeenCalledWith({
        fileName: 'browser-test.pptx',
      });
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should call write and fs.writeFile in a Node.js environment', async () => {
      const originalWindow = global.window;
      delete global.window; // Simulate Node.js environment

      const filePath = './output/node-test.pptx';
      await savePresentation(mockPres, filePath);

      expect(mockPres.write).toHaveBeenCalledWith({
        outputType: 'arraybuffer',
      });
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('output'), {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledWith(filePath, expect.any(Buffer));
      expect(mockPres.writeFile).not.toHaveBeenCalled();

      global.window = originalWindow; // Restore
    });

    it('should return a buffer in Node.js if no filename is provided', async () => {
      const originalWindow = global.window;
      delete global.window; // Simulate Node.js

      const buffer = await savePresentation(mockPres); // No filename
      expect(mockPres.write).toHaveBeenCalledWith({
        outputType: 'arraybuffer',
      });
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(fs.writeFile).not.toHaveBeenCalled();

      global.window = originalWindow;
    });
  });

  describe('readPresentation', () => {
    it('should parse a PPTX file from a buffer and return slide content', async () => {
      const buffer = Buffer.from('fake-pptx-data');
      const result = await readPresentation(buffer);

      expect(PptxParser.parse).toHaveBeenCalledWith(buffer);
      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Slide 1 Title');
      expect(result[0].content).toBe('Content from slide 1.');
    });

    it('should read a PPTX file from a path and parse it (Node.js)', async () => {
      const originalWindow = global.window;
      delete global.window;

      const filePath = './test.pptx';
      await readPresentation(filePath);

      expect(fs.readFile).toHaveBeenCalledWith(filePath);
      expect(PptxParser.parse).toHaveBeenCalledWith(expect.any(Buffer));

      global.window = originalWindow;
    });
  });
});
