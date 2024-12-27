// powerpoint-utils.mjs

import fs from 'fs/promises';
import pptxgen from 'pptxgenjs';
import pkg from 'pptx-parser';
const { parse } = pkg;

/**
 * Creates a new PowerPoint presentation.
 * @returns {pptxgen} A new PptxGenJS instance.
 */
export function createPresentation() {
  return new pptxgen();
}

/**
 * Adds a new slide to the presentation.
 * @param {pptxgen} pres - The PptxGenJS instance.
 * @param {string} title - The title of the slide.
 * @param {string} content - The content of the slide.
 * @returns {object} The newly created slide.
 */
export function addSlide(pres, title, content) {
  const slide = pres.addSlide();
  slide.addText(title, { x: 0.5, y: 0.5, fontSize: 18, bold: true });
  slide.addText(content, { x: 0.5, y: 1.5, fontSize: 14 });
  return slide;
}

/**
 * Adds an image to a slide.
 * @param {object} slide - The slide object.
 * @param {string} imagePath - The path to the image file.
 * @param {object} options - Image placement options.
 */
export function addImage(slide, imagePath, options = {}) {
  slide.addImage({ path: imagePath, ...options });
}

/**
 * Adds a chart to a slide.
 * @param {object} slide - The slide object.
 * @param {string} type - The type of chart (e.g., 'bar', 'line', 'pie').
 * @param {object} data - The chart data.
 * @param {object} options - Chart options.
 */
export function addChart(slide, type, data, options = {}) {
  slide.addChart(type, data, options);
}

/**
 * Saves the presentation to a file.
 * @param {pptxgen} pres - The PptxGenJS instance.
 * @param {string} filename - The name of the file to save.
 * @returns {Promise<void>}
 */
export async function savePresentation(pres, filename) {
  try {
    await pres.writeFile({ fileName: filename });
    console.log(`Presentation saved successfully: ${filename}`);
  } catch (error) {
    console.error('Error saving presentation:', error);
    throw error;
  }
}

/**
 * Reads a PowerPoint presentation and extracts its text content.
 * @param {string} filename - The name of the file to read.
 * @returns {Promise<Array<object>>} An array of slide objects with text content.
 */
export async function readPresentation(filename) {
  try {
    const buffer = await fs.readFile(filename);
    const presentation = await parse(buffer);
    return presentation.slides.map(slide => ({
      title: slide.title,
      content: slide.content.map(item => item.text).join('\n')
    }));
  } catch (error) {
    console.error('Error reading presentation:', error);
    throw error;
  }
}

/**
 * Generates a PowerPoint presentation with various elements.
 * @param {string} filename - The name of the file to save.
 * @returns {Promise<void>}
 */
export async function generateSamplePresentation(filename) {
  const pres = createPresentation();

  // Title slide
  const titleSlide = pres.addSlide();
  titleSlide.addText("Sample Presentation", { x: 1, y: 1, fontSize: 44, bold: true });
  titleSlide.addText("Created with Node.js", { x: 1, y: 2.5, fontSize: 32 });

  // Content slide
  addSlide(pres, "Overview", "This is a sample presentation created using Node.js and PptxGenJS.");

  // Image slide
  const imageSlide = pres.addSlide();
  imageSlide.addText("Sample Image", { x: 0.5, y: 0.5, fontSize: 18, bold: true });
  addImage(imageSlide, "path/to/your/image.jpg", { x: 1, y: 1.5, w: 8, h: 4 });

  // Chart slide
  const chartSlide = pres.addSlide();
  chartSlide.addText("Sample Chart", { x: 0.5, y: 0.5, fontSize: 18, bold: true });
  addChart(chartSlide, 'bar', {
    labels: ['Category 1', 'Category 2', 'Category 3'],
    values: [4.3, 2.5, 3.5]
  }, { x: 1, y: 1.5, w: 8, h: 4 });

  await savePresentation(pres, filename);
}

// Extensive use case demonstration
async function demonstrateUsage() {
  try {
    // Create and save a sample presentation
    await generateSamplePresentation('sample_presentation.pptx');

    // Read the presentation
    const slides = await readPresentation('sample_presentation.pptx');
    console.log('Extracted slides:', slides);

    // Create a custom presentation
    const pres = createPresentation();

    addSlide(pres, "Welcome", "This is a custom presentation created with our PowerPoint utility module.");

    const dataSlide = pres.addSlide();
    dataSlide.addText("Data Visualization", { x: 0.5, y: 0.5, fontSize: 18, bold: true });
    addChart(dataSlide, 'pie', {
      labels: ['Segment 1', 'Segment 2', 'Segment 3'],
      values: [30, 45, 25]
    }, { x: 1, y: 1.5, w: 8, h: 4 });

    await savePresentation(pres, 'custom_presentation.pptx');

    console.log('All operations completed successfully.');
  } catch (error) {
    console.error('An error occurred during the demonstration:', error);
  }
}

// Run the demonstration
demonstrateUsage();