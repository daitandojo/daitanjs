// Now, let's explain how to use this Error Handling module:

// Custom Error Class:
// You can create application-specific errors using the AppError class:

import { AppError } from './errorHandler';

throw new AppError('User not found', 'USER_NOT_FOUND', { userId: 123 });

import { handleError } from './errorHandler';

try {
  // Some code that might throw an error
} catch (error) {
  handleError(error, { 
    context: { userId: user.id, action: 'profile_update' },
    shouldReport: true
  });
}

// Async Error Handler:
// For async functions, use the createAsyncErrorHandler to automatically catch and handle errors:

import { createAsyncErrorHandler } from './errorHandler';

const fetchUserData = createAsyncErrorHandler(async (userId) => {
  // Fetch user data
});

// Use it like a normal async function
fetchUserData(123).then(data => {
  // Handle success
}).catch(error => {
  // The error has already been logged and reported
  // Handle the error in the UI
});

// Integration with Express.js (example):
// You can use this error handler in an Express.js application like this:

import express from 'express';
import { handleError, AppError } from './errorHandler';

const app = express();

app.use((req, res, next) => {
  res.sendError = (error) => {
    handleError(error, { context: { url: req.url, method: req.method } });
    res.status(error.code || 500).json({ error: error.message });
  };
  next();
});

app.get('/user/:id', (req, res) => {
  try {
    // Fetch user
    // If user not found:
    throw new AppError('User not found', 404, { userId: req.params.id });
  } catch (error) {
    res.sendError(error);
  }
});

// Global error handler
app.use((error, req, res, next) => {
  handleError(error, { context: { url: req.url, method: req.method } });
  res.status(error.code || 500).json({ error: error.message });
});

// This Error Handling module provides a centralized way to handle errors across your application. It logs errors (which you can extend to log to a file or external service), reports them to a centralized service, and provides utilities to make error handling more consistent and easier to manage.
// Remember to replace the sendErrorReport import with your actual error reporting service (like Sentry, Rollbar, or a custom solution).