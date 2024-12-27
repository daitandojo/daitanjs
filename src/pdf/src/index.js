import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';

// Convert HTML to PDF
export const htmlToPDF = async (html) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html);
    const buffer = await page.pdf({ format: 'A4' });
    await browser.close();
    return buffer;
  } catch (error) {
    throw new Error(`Error creating PDF: ${error.message}`);
  }
};

// Merge multiple PDF buffers into one
export const mergePDFs = async (pdfBuffers) => {
  const mergedPdf = await PDFDocument.create();

  for (const buffer of pdfBuffers) {
    const pdfDoc = await PDFDocument.load(buffer);
    const [copiedPages] = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
};

// Split a PDF buffer into multiple buffers
export const splitPDF = async (pdfBuffer, pageNumbers) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const splitPDFBuffers = [];

  for (const pageNumber of pageNumbers) {
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNumber]);
    newPdf.addPage(copiedPage);

    const pdfBytes = await newPdf.save();
    splitPDFBuffers.push(pdfBytes);
  }

  return splitPDFBuffers;
};
