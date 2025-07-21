// office/src/powerpoint.js
/**
 * @file PowerPoint (PPTX) document generation and manipulation utilities using PptxGenJS and pptx-parser.
 * @module @daitanjs/office/powerpoint
 */
import fs from 'fs/promises';
import path from 'path';
import PptxGenJS from 'pptxgenjs';
import PptxParser from 'pptx-parser';
import { getLogger } from '@daitanjs/development';
import {
  DaitanInvalidInputError,
  DaitanFileOperationError,
  DaitanOperationError,
  DaitanBrowserSpecificError,
  DaitanConfigurationError,
} from '@daitanjs/error';
import { Buffer } from 'buffer';

const logger = getLogger('daitan-office-powerpoint');

/**
 * Creates a new PowerPoint presentation instance.
 * @public
 * @returns {PptxGenJS} A new PptxGenJS presentation instance.
 */
export function createPresentation() {
  logger.debug('Creating new PptxGenJS presentation instance.');
  const pres = new PptxGenJS();
  pres.author = 'DaitanJS Office Module';
  pres.company = 'DaitanJS';
  pres.layout = 'LAYOUT_16X9';
  return pres;
}

/**
 * Adds a new slide to the presentation.
 * @public
 * @param {PptxGenJS} pres
 * @param {object} [options={}]
 * @returns {PptxGenJS.Slide} The newly created slide object.
 */
export function addSlide(pres, options = {}) {
  if (!pres || typeof pres.addSlide !== 'function') {
    throw new DaitanInvalidInputError(
      'Invalid PptxGenJS presentation instance provided to addSlide.'
    );
  }
  const {
    masterName,
    title,
    mainContent,
    titleOptions = {},
    contentOptions = {},
    slideLayoutOptions = {},
  } = options;
  logger.debug('Adding new slide.', {
    masterName,
    titlePreview: String(title).substring(0, 30),
  });

  const slide = pres.addSlide({ masterName, ...slideLayoutOptions });
  if (title) {
    slide.addText(title, {
      placeholder: 'title',
      x: 0.5,
      y: 0.25,
      fontSize: 32,
      bold: true,
      w: '90%',
      h: 1.0,
      ...titleOptions,
    });
  }
  if (mainContent) {
    slide.addText(mainContent, {
      placeholder: 'body',
      x: 0.5,
      y: 1.5,
      fontSize: 18,
      w: '90%',
      h: '75%',
      ...contentOptions,
    });
  }
  return slide;
}

/**
 * Adds an image to a slide.
 * @public
 * @param {PptxGenJS.Slide} slide
 * @param {string} imageSource - Path (Node.js) or base64 data URL.
 * @param {PptxGenJS.ImageProps} [options={}]
 */
export function addImageToSlide(slide, imageSource, options = {}) {
  if (!slide || typeof slide.addImage !== 'function') {
    throw new DaitanInvalidInputError(
      'Invalid PptxGenJS slide object provided to addImageToSlide.'
    );
  }
  if (!imageSource || typeof imageSource !== 'string' || !imageSource.trim()) {
    throw new DaitanInvalidInputError(
      'Image source (path or data URL) must be a non-empty string.'
    );
  }

  const imageOpts = { x: 1.0, y: 1.0, w: '50%', h: '50%', ...options };
  if (imageSource.startsWith('data:image')) {
    imageOpts.data = imageSource;
  } else {
    if (typeof window !== 'undefined') {
      throw new DaitanConfigurationError(
        'Local image file paths are not supported in browser for addImageToSlide. Use data URL.'
      );
    }
    imageOpts.path = imageSource;
  }
  slide.addImage(imageOpts);
}

/**
 * Adds a chart to a slide.
 * @public
 * @param {PptxGenJS.Slide} slide
 * @param {PptxGenJS.CHART_NAME | PptxGenJS.ChartType} type
 * @param {Array<PptxGenJS.ChartData>} data
 * @param {PptxGenJS.OptsChartData} [options={}]
 */
export function addChartToSlide(slide, type, data, options = {}) {
  if (!slide || typeof slide.addChart !== 'function') {
    throw new DaitanInvalidInputError(
      'Invalid PptxGenJS slide object provided to addChartToSlide.'
    );
  }
  if (!type || typeof type !== 'string') {
    throw new DaitanInvalidInputError(
      'Chart type must be a valid PptxGenJS chart type string.'
    );
  }
  if (!Array.isArray(data)) {
    throw new DaitanInvalidInputError(
      'Chart data must be an array of series objects.'
    );
  }
  const chartOpts = { x: 0.5, y: 2.0, w: '90%', h: '70%', ...options };
  slide.addChart(type, data, chartOpts);
}

/**
 * Saves the presentation to a file or triggers a download.
 * @public
 * @async
 * @param {PptxGenJS} pres
 * @param {string} [filename] - If provided, saves to this file path in Node.js or uses it as the download name in browser.
 * @returns {Promise<{success: boolean, message: string, buffer?: ArrayBuffer }>}
 */
export async function savePresentation(pres, filename) {
  if (!pres || typeof pres.writeFile !== 'function') {
    throw new DaitanInvalidInputError(
      'Invalid PptxGenJS presentation instance provided to savePresentation.'
    );
  }
  const finalFilename = filename
    ? filename.endsWith('.pptx')
      ? filename
      : `${filename}.pptx`
    : null;

  try {
    if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
      if (!finalFilename)
        throw new DaitanConfigurationError(
          'Filename is required for browser download.'
        );
      await pres.writeFile({ fileName: finalFilename });
      return {
        success: true,
        message: `Download of "${finalFilename}" initiated.`,
      };
    } else {
      if (finalFilename) {
        const outputDir = path.dirname(path.resolve(finalFilename));
        await fs.mkdir(outputDir, { recursive: true });
      }
      const buffer = await pres.write({ outputType: 'arraybuffer' });
      if (finalFilename) await fs.writeFile(finalFilename, Buffer.from(buffer));
      return {
        success: true,
        message: finalFilename
          ? `File "${finalFilename}" saved.`
          : 'Buffer generated.',
        buffer,
      };
    }
  } catch (error) {
    throw new DaitanFileOperationError(
      `Failed to save PowerPoint file "${finalFilename || ''}": ${
        error.message
      }`,
      { path: finalFilename },
      error
    );
  }
}

/**
 * Reads a PowerPoint presentation and extracts text content.
 * @public
 * @async
 * @param {string | Buffer | ArrayBuffer} fileSource
 * @returns {Promise<Array<{ slideNumber: number, title?: string, content: string }>>}
 */
export async function readPresentation(fileSource) {
  if (!fileSource) {
    throw new DaitanInvalidInputError(
      'File source is required for readPresentation.'
    );
  }
  let bufferToParse;
  if (typeof fileSource === 'string') {
    if (typeof window !== 'undefined') {
      throw new DaitanConfigurationError(
        'Reading local PPTX paths is not supported in browser.'
      );
    }
    bufferToParse = await fs.readFile(fileSource);
  } else if (
    fileSource instanceof Buffer ||
    fileSource instanceof ArrayBuffer
  ) {
    bufferToParse = fileSource;
  } else {
    throw new DaitanInvalidInputError('Invalid fileSource type.');
  }

  try {
    const presentationData = await PptxParser.parse(bufferToParse);
    if (!presentationData?.slides) {
      throw new DaitanOperationError(
        'Failed to parse PPTX: Invalid structure returned.'
      );
    }
    return presentationData.slides.map((slide, index) => {
      const slideTitle =
        typeof slide.title === 'string' ? slide.title.trim() : undefined;
      let slideContentText = '';
      if (Array.isArray(slide.content)) {
        slideContentText = slide.content
          .map((item) =>
            typeof item?.text === 'string'
              ? item.text
              : typeof item === 'string'
              ? item
              : ''
          )
          .join('\n')
          .trim();
      } else if (typeof slide.content === 'string') {
        slideContentText = slide.content.trim();
      }
      return {
        slideNumber: index + 1,
        title: slideTitle,
        content: slideContentText,
      };
    });
  } catch (error) {
    throw new DaitanOperationError(
      `Error parsing PowerPoint presentation: ${error.message}`,
      {},
      error
    );
  }
}
