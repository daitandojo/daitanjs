import ExcelJS from 'exceljs';

/**
 * Converts a table to an Excel file and triggers a download.
 * 
 * @param {Array} table - Array of objects representing table rows.
 * @param {String} filename - Desired name of the downloaded file.
 * @returns {Object} Result object with success status and message.
 */
export const downloadTableAsExcel = async ({
    table, 
    filename = 'download.xlsx'
}) => {
    try {
        if (!Array.isArray(table) || table.length === 0) {
            throw new Error('Table data is empty or invalid');
        }

        // Create a new workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');

        // Add the table headers
        const headers = Object.keys(table[0]);
        worksheet.addRow(headers);

        // Add the table rows
        table.forEach(row => {
            const rowData = headers.map(header => row[header]);
            worksheet.addRow(rowData);
        });

        // Create a blob and trigger a download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();

        return { success: true, message: 'File downloaded successfully.' };
    } catch (error) {
        console.error('Error downloading table as Excel:', error);
        return { success: false, message: error.message };
    }
};
