// word-document-utils.mjs

import fs from 'fs/promises';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  Packer,
  UnderlineType,
  AlignmentType,
  convertInchesToTwip,
  VerticalAlign,
  WidthType
} from 'docx';
import officegen from 'officegen';
import mammoth from 'mammoth';

/**
 * Creates a new Word document.
 * @param {string} title - The title of the document.
 * @returns {Document} A new Document object.
 */
export function createDocument(title) {
  return new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: title,
          heading: HeadingLevel.TITLE,
        }),
      ],
    }],
  });
}

/**
 * Adds a paragraph to the document.
 * @param {Document} doc - The Document object.
 * @param {string} text - The text content of the paragraph.
 * @param {Object} options - Styling options (optional).
 */
export function addParagraph(doc, text, options = {}) {
  const paragraph = new Paragraph({
    children: [new TextRun({ text, ...options })],
    alignment: options.alignment,
  });
  doc.addSection({ children: [paragraph] });
}

/**
 * Adds a table to the document.
 * @param {Document} doc - The Document object.
 * @param {Array<Array<string>>} data - 2D array representing table data.
 * @param {Object} options - Table styling options (optional).
 */
export function addTable(doc, data, options = {}) {
  const table = new Table({
    rows: data.map(row =>
      new TableRow({
        children: row.map(cell =>
          new TableCell({
            children: [new Paragraph(cell)],
          })
        ),
      })
    ),
    width: {
      size: options.width || convertInchesToTwip(6),
      type: WidthType.PERCENTAGE,
    },
  });
  doc.addSection({ children: [table] });
}

/**
 * Saves the document to a file.
 * @param {Document} doc - The Document object.
 * @param {string} filename - The name of the file to save.
 * @returns {Promise<void>}
 */
export async function saveDocument(doc, filename) {
  try {
    const buffer = await Packer.toBuffer(doc);
    await fs.writeFile(filename, buffer);
    console.log(`Document saved successfully: ${filename}`);
  } catch (error) {
    console.error('Error saving document:', error);
    throw error;
  }
}

/**
 * Reads a Word document and extracts its text content.
 * @param {string} filename - The name of the file to read.
 * @returns {Promise<string>} The extracted text content.
 */
export async function readDocument(filename) {
  try {
    const buffer = await fs.readFile(filename);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error reading document:', error);
    throw error;
  }
}

/**
 * Generates a Word document with charts (using officegen).
 * @param {string} filename - The name of the file to save.
 * @param {Array<Object>} chartData - Array of chart configurations.
 * @returns {Promise<void>}
 */
export function generateChartDocument(filename, chartData) {
  return new Promise((resolve, reject) => {
    const docx = officegen('docx');

    chartData.forEach(chart => {
      const chartObj = docx.createChart(chart);
      docx.createP().addChart(chartObj, chart.opts);
    });

    const out = fs.createWriteStream(filename);
    out.on('error', reject);
    out.on('close', resolve);

    docx.generate(out);
  });
}

// Extensive use case demonstration
// async function demonstrateUsage() {
//   try {
//     // Create a new document
//     const doc = createDocument('Sample Document');

//     // Add paragraphs with different styles
//     addParagraph(doc, 'This is a normal paragraph.');
//     addParagraph(doc, 'This is bold and underlined.', { bold: true, underline: { type: UnderlineType.SINGLE } });
//     addParagraph(doc, 'This is centered.', { alignment: AlignmentType.CENTER });

//     // Add a table
//     const tableData = [
//       ['Name', 'Age', 'City'],
//       ['John Doe', '30', 'New York'],
//       ['Jane Smith', '25', 'London'],
//     ];
//     addTable(doc, tableData);

//     // Save the document
//     await saveDocument(doc, 'sample.docx');

//     // Read the document
//     const content = await readDocument('sample.docx');
//     console.log('Extracted content:', content);

//     // Generate a document with charts
//     const chartData = [{
//       title: 'Sample Bar Chart',
//       renderType: 'bar',
//       data: [
//         {
//           name: 'Series 1',
//           labels: ['Category 1', 'Category 2', 'Category 3'],
//           values: [4.3, 2.5, 3.5],
//         },
//       ],
//     }];
//     await generateChartDocument('chart_sample.docx', chartData);

//     console.log('All operations completed successfully.');
//   } catch (error) {
//     console.error('An error occurred during the demonstration:', error);
//   }
// }

// // Run the demonstration
// demonstrateUsage();