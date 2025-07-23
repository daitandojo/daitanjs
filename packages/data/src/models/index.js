// data/src/models/index.js
/**
 * @file Central export point for all Mongoose models in the @daitanjs/data package.
 * @module @daitanjs/data/models
 *
 * @description
 * This module imports and re-exports all defined Mongoose models. This provides a single,
 * convenient entry point for other parts of the DaitanJS ecosystem or consuming applications
 * to access these models.
 *
 * Usage:
 * ```javascript
 * import { User, BlogPost, Company } from '@daitanjs/data/models';
 * // or
 * import * as DaitanModels from '@daitanjs/data/models';
 * // const user = new DaitanModels.User({...});
 * ```
 *
 * Each model file (e.g., `user.js`, `blogpost.js`) is responsible for defining its
 * schema and exporting the compiled Mongoose model. This index file then aggregates them.
 *
 * The JSDoc for each specific model (its schema, fields, methods, etc.) can be found
 * within its respective source file (e.g., `./user.js`).
 */
import { getLogger } from '@daitanjs/development';

const modelIndexLogger = getLogger('daitan-data-models-index');

modelIndexLogger.debug('Aggregating and exporting DaitanJS Mongoose models...');

// Import and re-export each model.
// Ensure model names are consistent (PascalCase, singular).
// The `default as ModelName` pattern is standard for Mongoose model exports from their definition files.

export { default as User } from './user.js';
export { default as BlogPost } from './blogpost.js';
export { default as Company } from './company.js';
export { default as Provider } from './provider.js';
export { default as Question } from './question.js';
export { default as Request } from './request.js';
export { default as Review } from './review.js';
export { default as Skill } from './skill.js';
export { default as Task } from './task.js';
export { default as Transaction } from './transaction.js';

// Note: If an 'Image' model were to be created for storing image metadata,
// it would be imported and exported here as well, e.g.:
// export { default as Image } from './image.js';

modelIndexLogger.info('DaitanJS Mongoose models module exports are ready.');
