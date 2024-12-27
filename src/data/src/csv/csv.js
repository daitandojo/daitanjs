import fs from 'fs/promises';

export async function ensureCSVExists({
  path, 
  headers
}) {
  try {
    await fs.access(path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(path, headers.join(',') + '\n', 'utf8');
    } else {
      throw error;
    }
  }
}
