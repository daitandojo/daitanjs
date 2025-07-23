// data/src/file/index.js
/**
 * @file This module is deprecated. File system utilities have been centralized in @daitanjs/utilities.
 * @module @daitanjs/data/file
 * @deprecated As of version 1.0.0, all general-purpose file system utilities (`readFile`, `writeFile`, etc.) are canonical in the `@daitanjs/utilities` package. Please update all imports to use `@daitanjs/utilities` directly for these functions. This re-export layer will be removed in a future version to simplify the dependency graph.
 *
 * @description
 * The file system utility functions are no longer exported from the `@daitanjs/data` package.
 * This change clarifies the responsibility of each package:
 * - `@daitanjs/utilities`: Provides low-level, general-purpose utilities, including file system operations.
 * - `@daitanjs/data`: Provides higher-level data abstractions like database connections, models, and caching.
 */
import { getLogger } from '@daitanjs/development';

const fileIndexLogger = getLogger('daitan-data-file-deprecated');

fileIndexLogger.warn(
  'DEPRECATION WARNING: The @daitanjs/data/file module is deprecated. Please import file system utilities directly from the @daitanjs/utilities package.'
);

// To avoid breaking existing imports immediately, we re-export, but the ideal state is to remove this file.
// For the purpose of this refactor, we will keep the re-export to maintain functionality while the warning is in place.
// In a future step, this file would be completely emptied or deleted.
export {
  readFile,
  writeFile,
  deleteFile,
  createDirectory,
  listDirectory,
  getDirectoryContentsRecursive,
  copyFile,
  renameFileOrDirectory,
  getFileStats,
  ensureDirectoryExists,
  ensureDirectoryExistsSync,
} from '@daitanjs/utilities';
