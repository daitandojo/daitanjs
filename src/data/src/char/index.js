import fs from 'fs/promises';
import path from 'path';
import { createLogger, format, transports } from 'winston';

const FILE_PATH = '/tmp/charOperations.txt';

// Configure logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: '/tmp/charOperations.log' }),
    new transports.Console()
  ]
});

/**
 * Reads the content of the file and parses it into an array of objects.
 * @returns {Promise<Array<{identifierArray: string[], value: string}>>}
 */
async function readFile() {
  try {
    const content = await fs.readFile(FILE_PATH, 'utf-8');
    return content.split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        const [identifierArray, value] = line.split('::');
        return { identifierArray: identifierArray.split('|'), value };
      });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Writes the given data to the file.
 * @param {Array<{identifierArray: string[], value: string}>} data
 * @returns {Promise<void>}
 */
async function writeFile(data) {
  const content = data.map(item => `${item.identifierArray.join('|')}::${item.value}`).join('\n');
  await fs.writeFile(FILE_PATH, content, 'utf-8');
}

/**
 * Sets a value for the given identifierArray.
 * @param {string[]} identifierArray - Array of identifier strings
 * @param {string} value - Value to be stored
 * @returns {Promise<void>}
 */
export async function charSet(identifierArray, value) {
  try {
    if (!Array.isArray(identifierArray) || identifierArray.length === 0 || typeof value !== 'string') {
      throw new Error('Invalid arguments');
    }

    const sortedidentifierArray = identifierArray.sort();
    const data = await readFile();
    const index = data.findIndex(item => 
      item.identifierArray.length === sortedidentifierArray.length && 
      item.identifierArray.every((id, i) => id === sortedidentifierArray[i])
    );

    if (index !== -1) {
      data[index].value = value;
    } else {
      data.push({ identifierArray: sortedidentifierArray, value });
    }

    await writeFile(data);
    logger.info(`Value set for identifierArray: ${sortedidentifierArray.join('|')}`);
  } catch (error) {
    logger.error(`Error in charSet: ${error.message}`);
    throw error;
  }
}

/**
 * Gets values for the given identifierArray.
 * @param {string[]} identifierArray - Array of identifier strings
 * @returns {Promise<Array<{identifierArray: string[], value: string}>>}
 */
export async function charGet(identifierArray = []) {
  try {
    const data = await readFile();
    if (identifierArray.length === 0) {
      return data;
    }

    const sortedidentifierArray = identifierArray.sort();
    return data.filter(item => 
      sortedidentifierArray.every(id => item.identifierArray.includes(id))
    );
  } catch (error) {
    logger.error(`Error in charGet: ${error.message}`);
    throw error;
  }
}

/**
 * Deletes entries that match the given identifierArray.
 * @param {string[]} identifierArray - Array of identifier strings
 * @returns {Promise<number>} - Number of deleted entries
 */
export async function charDel(identifierArray) {
  try {
    if (!Array.isArray(identifierArray) || identifierArray.length === 0) {
      throw new Error('Invalid arguments');
    }

    const sortedidentifierArray = identifierArray.sort();
    const data = await readFile();
    const initialLength = data.length;

    const filteredData = data.filter(item => 
      !sortedidentifierArray.every(id => item.identifierArray.includes(id))
    );

    await writeFile(filteredData);
    const deletedCount = initialLength - filteredData.length;
    logger.info(`Deleted ${deletedCount} entries for identifierArray: ${sortedidentifierArray.join('|')}`);
    return deletedCount;
  } catch (error) {
    logger.error(`Error in charDel: ${error.message}`);
    throw error;
  }
} 

/**
 * Gets the total number of entries in the file.
 * @returns {Promise<number>}
 */
export async function charCount() {
  try {
    const data = await readFile();
    return data.length;
  } catch (error) {
    logger.error(`Error in charCount: ${error.message}`);
    throw error;
  }
}

/**
 * Backs up the current file to a timestamped file in the same directory.
 * @returns {Promise<string>} - Path of the backup file
 */
export async function charBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupPath = path.join(path.dirname(FILE_PATH), `charOperations_backup_${timestamp}.txt`);
    await fs.copyFile(FILE_PATH, backupPath);
    logger.info(`Backup created: ${backupPath}`);
    return backupPath;
  } catch (error) {
    logger.error(`Error in charBackup: ${error.message}`);
    throw error;
  }
}