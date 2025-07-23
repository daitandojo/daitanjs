// communication/src/email/index.js
/**
 * @file Re-exports email functionalities from the nodemailer module.
 * @module @daitanjs/communication/email
 *
 * @description
 * This index file serves as the public interface for email-related operations
 * within the `@daitanjs/communication` package. Currently, it exports all
 * functionalities from the `nodemailer.js` submodule.
 *
 * If other email providers or utilities were to be added (e.g., SendGrid, Mailgun adapters),
 * they would also be exported from here to maintain a consistent access point.
 */

// Re-export all named exports from nodemailer.js
export * from './nodemailer.js';

// If nodemailer.js had a default export that needed to be re-exported:
// export { default as DefaultEmailService } from './nodemailer.js';
