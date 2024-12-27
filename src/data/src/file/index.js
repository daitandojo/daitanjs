import fs from 'fs/promises';
import path from 'path';

export async function readFile(filePath) {
  return fs.readFile(filePath, 'utf8');
}

export async function writeFile(filePath, data) {
  await fs.writeFile(filePath, data, 'utf8');
}

export async function deleteFile(filePath) {
  await fs.unlink(filePath);
}

export async function createDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function listDirectory(dirPath) {
  return fs.readdir(dirPath);
}

export async function getDirectoryContents(dirPath) {
  const contents = {};
  
  async function processDirectory(currentPath) {
    const items = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item.name);
      const relativePath = path.relative(dirPath, itemPath);
      
      if (item.isDirectory()) {
        contents[relativePath] = {};
        await processDirectory(itemPath);
      } else {
        contents[relativePath] = null; // You could replace null with file size or other metadata if needed
      }
    }
  }
  
  await processDirectory(dirPath);
  return { [dirPath]: contents };
}

export async function copyFile(sourcePath, destinationPath) {
  await fs.copyFile(sourcePath, destinationPath);
}

export async function renameFile(oldPath, newPath) {
  await fs.rename(oldPath, newPath);
}

export async function getFileStats(filePath) {
  return fs.stat(filePath);
}