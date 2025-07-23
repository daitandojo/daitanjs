// office/src/excel.js
/**
 * @file Excel (XLSX) document generation and manipulation utilities using ExcelJS.
 * @module @daitanjs/office/excel
 */
import ExcelJS from 'exceljs';
import { getLogger } from '@daitanjs/development';
import {
  DaitanInvalidInputError,
  DaitanFileOperationError,
  DaitanBrowserSpecificError,
  DaitanOperationError, // For general operational errors
} from '@daitanjs/error';
import { Buffer } from 'buffer'; // Node.js Buffer, ensure available in environment for Node.js use cases

const logger = getLogger('daitan-office-excel');

/**
 * @typedef {Object} ExcelCellStyling
 * @property {Partial<ExcelJS.Font>} [font] - Font styling (e.g., { bold: true, color: { argb: 'FFFF0000' }, size: 12 }).
 * @property {Partial<ExcelJS.Fill>} [fill] - Cell fill styling (e.g., { type: 'pattern', pattern:'solid', fgColor:{argb:'FFC0C0C0'} }).
 * @property {Partial<ExcelJS.Alignment>} [alignment] - Text alignment (e.g., { vertical: 'middle', horizontal: 'center', wrapText: true }).
 * @property {Partial<ExcelJS.Borders>} [border] - Cell borders (e.g., { top: {style:'thin'}, left: {style:'thin'}, ... }).
 * @property {string} [numFmt] - Number format string (e.g., '0.00%', '$#,##0.00', 'dd/mm/yyyy').
 */

/**
 * @typedef {Object} ColumnDefinition
 * @property {string} header - The display text for the column header.
 * @property {string} key - The key in the data objects corresponding to this column.
 * @property {number} [width] - Optional width for the column.
 * @property {ExcelCellStyling} [headerStyle] - Optional specific style for this header cell.
 * @property {ExcelCellStyling} [cellStyle] - Optional default style for data cells in this column.
 * @property {(value: any, rowData: object) => any} [transform] - Optional function to transform cell value before adding.
 */

/**
 * Converts a table of data (array of objects) to an Excel file (XLSX format).
 * Returns a buffer in Node.js or triggers a download in the browser.
 *
 * @public
 * @async
 * @param {object} params - Parameters for Excel generation.
 * @param {Array<object>} params.data - Array of objects representing table rows.
 * @param {string} [params.filename='data-export.xlsx'] - Desired name for the downloaded file (browser) or output file (Node.js, if `outputPath` is also set).
 * @param {string} [params.sheetName='Sheet1'] - Name of the worksheet.
 * @param {Array<ColumnDefinition | string>} [params.columns] - Optional: Array of column definitions or string keys.
 *        If not provided, columns are inferred from the keys of the first data object.
 *        If strings, they are used as both header text and data keys.
 * @param {boolean} [params.autoFilter=false] - Apply autofilter to the header row.
 * @param {ExcelCellStyling} [params.defaultHeaderStyle] - Default style for all header cells.
 * @param {ExcelCellStyling} [params.defaultCellStyle] - Default style for all data cells.
 * @param {Function} [params.rowStyler] - Optional function `(rowData, rowIndex) => ExcelCellStyling` to dynamically style entire rows.
 * @returns {Promise<{success: boolean, message: string, buffer?: ArrayBuffer, blob?: Blob}>}
 *          Result object. In Node.js, `buffer` contains the ArrayBuffer.
 *          In browser, `blob` is populated, and download is triggered.
 * @throws {DaitanInvalidInputError} If `data` is empty or invalid.
 * @throws {DaitanOperationError} For general Excel generation errors.
 * @throws {DaitanBrowserSpecificError} If browser-only operations are attempted in Node.js (related to direct download).
 */
export const downloadTableAsExcel = async ({
  data, // Renamed from 'table' for clarity
  filename = 'data-export.xlsx', // More descriptive default filename
  sheetName = 'Sheet1',
  columns, // Enhanced column definition
  autoFilter = false,
  defaultHeaderStyle = { font: { bold: true } }, // Sensible default for headers
  defaultCellStyle = {},
  rowStyler, // (rowData, rowIndex) => ExcelCellStyling for the row's cells
}) => {
  const callId = `excelGen-${Date.now().toString(36)}`;
  logger.info(
    `[${callId}] downloadTableAsExcel: Initiated for filename "${filename}".`,
    { numRows: data?.length, sheetName }
  );

  if (!Array.isArray(data) || data.length === 0) {
    const errMsg = 'Input `data` must be a non-empty array of objects.';
    logger.error(`[${callId}] ${errMsg}`);
    throw new DaitanInvalidInputError(errMsg, {
      inputType: typeof data,
      length: data?.length,
    });
  }
  if (!data.every((item) => typeof item === 'object' && item !== null)) {
    const errMsg = 'All items in the `data` array must be objects.';
    logger.error(`[${callId}] ${errMsg}`);
    throw new DaitanInvalidInputError(errMsg, {
      firstItemType: typeof data[0],
    });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DaitanJS Office Module';
    workbook.lastModifiedBy = 'DaitanJS Office Module';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet(sheetName);

    // Determine and set columns
    let columnDefs;
    if (Array.isArray(columns) && columns.length > 0) {
      columnDefs = columns.map((col) =>
        typeof col === 'string' ? { header: col, key: col } : col
      );
    } else {
      // Infer from first data object
      const firstItemKeys = Object.keys(data[0]);
      columnDefs = firstItemKeys.map((key) => ({ header: key, key: key }));
    }
    worksheet.columns = columnDefs.map((cd) => ({
      header: cd.header,
      key: cd.key,
      width: cd.width || (cd.header.length > 15 ? cd.header.length * 1.2 : 15), // Auto-width based on header
      style: cd.headerStyle
        ? { ...defaultHeaderStyle, ...cd.headerStyle }
        : defaultHeaderStyle, // For header cell style
    }));

    // Style header row (ExcelJS applies header style from column defs)
    const headerRow = worksheet.getRow(1);
    headerRow.font = defaultHeaderStyle.font || { bold: true }; // Apply default bold if not overridden
    if (defaultHeaderStyle.fill) headerRow.fill = defaultHeaderStyle.fill;
    if (defaultHeaderStyle.alignment)
      headerRow.alignment = defaultHeaderStyle.alignment;
    // Individual column header styles are applied via worksheet.columns.style

    if (autoFilter && columnDefs.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columnDefs.length },
      };
    }

    // Add data rows and apply styles
    data.forEach((rowData, rowIndex) => {
      const row = {};
      columnDefs.forEach((cd) => {
        const rawValue = rowData[cd.key];
        row[cd.key] = cd.transform
          ? cd.transform(rawValue, rowData)
          : rawValue ?? '';
      });
      const addedRow = worksheet.addRow(row);

      // Apply default cell styles and column-specific cell styles
      addedRow.eachCell((cell, colNumber) => {
        const colDefForCell = columnDefs[colNumber - 1]; // colNumber is 1-based
        const cellSpecificStyle = colDefForCell?.cellStyle || {};
        cell.style = { ...defaultCellStyle, ...cellSpecificStyle };
      });

      // Apply dynamic row styler if provided
      if (typeof rowStyler === 'function') {
        const dynamicRowStyle = rowStyler(rowData, rowIndex);
        if (dynamicRowStyle && typeof dynamicRowStyle === 'object') {
          addedRow.eachCell((cell) => {
            cell.style = { ...cell.style, ...dynamicRowStyle };
          });
        }
      }
    });

    logger.debug(
      `[${callId}] Excel worksheet populated with ${data.length} data rows and ${columnDefs.length} columns.`
    );

    const buffer = await workbook.xlsx.writeBuffer(); // Returns ArrayBuffer
    logger.info(
      `[${callId}] Excel file buffer generated. Size: ${buffer.byteLength} bytes.`
    );

    if (
      typeof window !== 'undefined' &&
      typeof Blob !== 'undefined' &&
      document?.createElement
    ) {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename.endsWith('.xlsx')
        ? filename
        : `${filename}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      logger.info(
        `[${callId}] Excel download triggered in browser for "${link.download}".`
      );
      return {
        success: true,
        message: 'File download initiated in browser.',
        buffer,
        blob,
      };
    } else {
      logger.info(
        `[${callId}] Running in Node.js or non-browser environment. Returning buffer.`
      );
      return {
        success: true,
        message: 'Excel buffer generated (Node.js).',
        buffer,
      };
    }
  } catch (error) {
    logger.error(
      `[${callId}] Error generating Excel file "${filename}": ${error.message}`,
      { errorName: error.name, stackPreview: error.stack?.substring(0, 200) }
    );
    if (error instanceof DaitanInvalidInputError) throw error;
    if (
      typeof window === 'undefined' &&
      (error.message.includes('document is not defined') ||
        error.message.includes('Blob is not defined'))
    ) {
      throw new DaitanBrowserSpecificError(
        `Excel generation/download failed: Browser-specific operation used in Node.js. Error: ${error.message}`,
        {},
        error
      );
    }
    throw new DaitanOperationError(
      `Failed to generate Excel file "${filename}": ${error.message}`,
      { filename, operation: 'generateExcel' },
      error
    );
  }
};
