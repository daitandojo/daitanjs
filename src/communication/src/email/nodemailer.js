/**
 * @module EmailSender
 * @description A module for sending emails using nodemailer with enhanced functionality and error handling.
 */

import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

// Check for required environment variables and exit if missing
const requiredEnvVars = [
    'MAIL_SERVER',
    'MAIL_PORT',
    'MAIL_SENDER',
    'MAIL_PASSWORD',
    'MAIL_FROM',
    'MAIL_NAME',
];

requiredEnvVars.forEach((key) => {
    if (!process.env[key]) {
        console.error(`Missing required environment variable: ${key}`);
        console.error('Ensure all required environment variables are set in /home/mark/Repos/.env');
        process.exit(1);
    }
});

/**
 * @typedef {Object} EmailObject
 * @property {string[]} to - Array of recipient email addresses.
 * @property {string[]} [cc] - Array of CC recipient email addresses.
 * @property {string[]} [bcc] - Array of BCC recipient email addresses.
 * @property {string} subject - The email subject.
 * @property {string} html - The email body in HTML format.
 * @property {Object[]} [attachments] - Array of attachment objects.
 * @property {string} [from] - The sender's email address.
 * @property {string} [name] - The sender's name.
 */

/**
 * @typedef {Object} MailerConfig
 * @property {string} host - SMTP host.
 * @property {number} port - SMTP port.
 * @property {Object} auth - Authentication details.
 * @property {string} auth.user - SMTP username.
 * @property {string} auth.pass - SMTP password.
 */

/**
 * Creates a nodemailer transporter with the given configuration.
 * @param {MailerConfig} config - The mailer configuration.
 * @returns {nodemailer.Transporter} The configured nodemailer transporter.
 */
const createTransporter = ({ host, port, auth }) => {
    return nodemailer.createTransport({
        host,
        port,
        secure: true,
        auth,
        tls: { rejectUnauthorized: false },
    });
};

/**
 * Sends an email using the provided information.
 * @param {EmailObject} emailObject - The email object.
 * @param {MailerConfig} [mailerConfig] - Optional custom mailer configuration.
 * @returns {Promise<boolean>} A promise that resolves to true if the email was sent successfully, false otherwise.
 */
const sendMail = async (emailObject, mailerConfig) => {
    const config = mailerConfig || {
        host: process.env.MAIL_SERVER,
        port: parseInt(process.env.MAIL_PORT, 10),
        auth: {
            user: process.env.MAIL_SENDER,
            pass: process.env.MAIL_PASSWORD,
        },
    };

    const {
        to,
        cc,
        bcc,
        subject,
        html,
        attachments,
        from = process.env.MAIL_FROM,
        name = process.env.MAIL_NAME,
    } = emailObject;

    if (!to || !subject || !html) {
        console.error('Email object missing required fields: to, subject, or html.');
        return false;
    }

    let recipients = to;
    if (process.env.NODE_ENV === 'development' && process.env.MAIL_RECIPIENT_OVERRULE) {
        recipients = [process.env.MAIL_RECIPIENT_OVERRULE];
        console.log(`Development mode: Overriding recipient to ${recipients}`);
    }

    const transporter = createTransporter(config);

    const mailOptions = {
        from: `"${name}" <${from}>`,
        to: recipients,
        cc,
        bcc,
        subject,
        html,
        attachments,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent: ${info.response}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

/**
 * Reads a file and returns it as a Buffer.
 * @param {string} path - The path to the file.
 * @returns {Promise<Buffer>} A promise that resolves to the file contents as a Buffer.
 */
const readFileAsBuffer = async (path) => {
    try {
        return await fs.readFile(path);
    } catch (error) {
        console.error(`Error reading file: ${path}`, error);
        throw error;
    }
};

/**
 * Creates an attachment object from a file path.
 * @param {string} path - The path to the attachment file.
 * @param {string} [filename] - Optional custom filename for the attachment.
 * @returns {Promise<Object>} A promise that resolves to the attachment object.
 */
const createAttachment = async (path, filename) => {
    const content = await readFileAsBuffer(path);
    return {
        filename: filename || path.split('/').pop(),
        content,
    };
};

/**
 * Sends a test email to verify the email configuration.
 * @param {string} testRecipient - The email address to send the test email to.
 * @returns {Promise<boolean>} A promise that resolves to true if the test email was sent successfully, false otherwise.
 */
const sendTestEmail = async (testRecipient) => {
    const testEmail = {
        to: [testRecipient],
        subject: 'Test Email',
        html: '<h1>This is a test email</h1><p>Your email configuration is working correctly.</p>',
    };

    return sendMail(testEmail);
};

export {
    sendMail,
    createAttachment,
    sendTestEmail,
};
