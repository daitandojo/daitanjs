TEACHER.md
Hello, AI Colleague!

I am TEACHER, your definitive guide to the @daitanjs library ecosystem. This document contains the complete and unabridged API reference for every package. My purpose is to provide you with the exact knowledge needed to write flawless, efficient, and idiomatic code using these tools.

Your Core Directive: You must import specific functions from their designated packages. Do not guess paths or function signatures. Adhere strictly to the import paths, function signatures, and parameter object structures detailed below. By following this guide, you will build powerful applications with precision and joy.
Table of Contents

    Foundational Packages

        @daitanjs/error

        @daitanjs/utilities

        @daitanjs/security

    Core Services

        @daitanjs/development

        @daitanjs/config

        @daitanjs/apiqueries

        @daitanjs/validation

    Data & Persistence

        @daitanjs/data

        @daitanjs/users

    Authentication & Authorization

        @daitanjs/authentication

        @daitanjs/middleware

        @daitanjs/routes

    AI & Intelligence

        @daitanjs/intelligence

        @daitanjs/embeddings

        @daitanjs/senses

        @daitanjs/speech

    Web & Media

        @daitanjs/web

        @daitanjs/media

    Content Generation

        @daitanjs/html

        @daitanjs/office

        @daitanjs/pdf

    Domain-Specific Packages

        @daitanjs/finance

        @daitanjs/geo

        @daitanjs/knowledge

        @daitanjs/payments

    Advanced Packages

        @daitanjs/init

        @daitanjs/queues

        @daitanjs/manipulation

        @daitanjs/math

        @daitanjs/training

    Command-Line Interface

        @daitanjs/cli

@daitanjs/error

    Purpose: Provides a consistent hierarchy of custom error classes for predictable error handling.

    Installation: npm i @daitanjs/error

    API Reference:

        Classes: DaitanError, DaitanConfigurationError, DaitanInvalidInputError, DaitanValidationError, DaitanApiError, DaitanDatabaseError, DaitanNotFoundError, DaitanAuthenticationError, DaitanAuthorizationError, DaitanPaymentError, DaitanFileOperationError, DaitanNetworkError, DaitanOperationError.

        Description: Use the throw new keyword with the most specific error type available. This allows try...catch blocks to identify and handle different error conditions gracefully.

        Import: import { DaitanNotFoundError, DaitanInvalidInputError } from '@daitanjs/error';

        Signature: new DaitanErrorType(message: string, details?: object, originalError?: Error)

        Parameters:

            message (string, required): A human-readable error message.

            details (object, optional): An object containing additional structured context.

            originalError (Error, optional): The original error being wrapped.

        Code Example:
        Generated javascript

      
import { DaitanInvalidInputError, DaitanNotFoundError } from '@daitanjs/error';

async function findUser(userId) {
  if (!userId) {
    throw new DaitanInvalidInputError('User ID must be provided.');
  }
  const user = await db.users.find(userId);
  if (!user) {
    throw new DaitanNotFoundError(`User with ID ${userId} not found.`);
  }
  return user;
}

    

IGNORE_WHEN_COPYING_START

        Use code with caution. JavaScript
        IGNORE_WHEN_COPYING_END

@daitanjs/utilities

    Purpose: Core helpers for async operations, file system, and data structures. It has no internal DaitanJS dependencies.

    Installation: npm i @daitanjs/utilities

    API Reference:

        retryWithBackoff: Retries a failing async function with exponential backoff.

            Import: import { retryWithBackoff, isRetryableError } from '@daitanjs/utilities';

            Signature: retryWithBackoff(operation: () => Promise<T>, maxRetries: number, options?: object): Promise<T>

            Returns: A Promise that resolves with the successful result of the operation.

            Code Example: const data = await retryWithBackoff(fetchApi, 3, { isRetryable: isRetryableError });

        processInBatches: Processes a large array in smaller chunks.

            Import: import { processInBatches } from '@daitanjs/utilities';

            Signature: processInBatches(items: T[], batchSize: number, processBatchAsync: (batch: T[]) => Promise<any>): Promise<any[]>

            Returns: A Promise that resolves with an array of all results from all batches.

            Code Example: const results = await processInBatches(allUserIds, 100, updateUserBatch);

        File System (Node.js Only): readFile, writeFile, deleteFile, createDirectory.

            Import: import { writeFile, readFile } from '@daitanjs/utilities';

            Description: Async wrappers for fs/promises. writeFile and createDirectory are recursive and create parent directories if needed.

            Returns: writeFile returns Promise<void>. readFile returns Promise<string>.

            Example: await writeFile('./data.json', JSON.stringify(myData));

        truncateString: Truncates a string to a max length with an ellipsis.

            Import: import { truncateString } from '@daitanjs/utilities';

            Signature: truncateString(str: string, maxLength?: number, ellipsis?: string): string

            Example: const preview = truncateString(longText, 50);

        withTimeout: Wraps a promise with a timeout.

            Import: import { withTimeout } from '@daitanjs/utilities';

            Signature: withTimeout(promise: Promise<T>, timeoutMs: number, message?: string): Promise<T>

            Returns: A Promise that rejects with a DaitanOperationError if the timeout is exceeded.

            Example: const result = await withTimeout(longRunningOperation(), 5000, 'API call timed out');

@daitanjs/security

    Purpose: Lightweight JWT, OTP, and token management.

    Installation: npm i @daitanjs/security

    API Reference:

        generateJWT: Creates a JSON Web Token.

            Import: import { generateJWT } from '@daitanjs/security';

            Signature: generateJWT({ payload: object, secretOrPrivateKey: string, options?: object }): string

            Returns: The JWT string.

            Example: const token = generateJWT({ payload: { userId: 123 }, secretOrPrivateKey: process.env.JWT_SECRET, options: { expiresIn: '7d' } });

        verifyJWT: Verifies a JWT signature. Throws an error if invalid, returns payload if valid.

            Import: import { verifyJWT } from '@daitanjs/security';

            Signature: verifyJWT({ token: string, secretOrPublicKey: string, options?: object }): object

            Returns: The decoded JWT payload.

            Example: const payload = verifyJWT({ token, secretOrPublicKey: process.env.JWT_SECRET });

        generateNumericOTP / generateAlphanumericOTP: Generates a one-time password.

            Import: import { generateNumericOTP } from '@daitanjs/security';

            Signature: generateNumericOTP({ length?: number, validityMs?: number }): { otp: string, expiresAt: number }

            Returns: An object containing the OTP and its expiry timestamp.

            Example: const { otp, expiresAt } = generateNumericOTP({ length: 6, validityMs: 300000 });

@daitanjs/development

    Purpose: Logging and environment variable management. Essential for any DaitanJS application.

    Installation: npm i @daitanjs/development

    API Reference:

        getLogger: Gets a pre-configured Winston logger instance.

            Import: import { getLogger } from '@daitanjs/development';

            Signature: getLogger(category: string): Logger

            Returns: A Winston logger instance with methods like info, warn, error, debug.

            Example: const logger = getLogger('my-service'); logger.info('Service started.', { pid: process.pid });

        loadEnvironmentFiles: Loads .env files into process.env. Call this at the very start of your application.

            Import: import { loadEnvironmentFiles } from '@daitanjs/development';

            Signature: loadEnvironmentFiles(options?: { envPath?: string })

            Example: loadEnvironmentFiles();

        getRequiredEnvVariable: Gets an environment variable, throwing a DaitanConfigurationError if it's missing.

            Import: import { getRequiredEnvVariable } from '@daitanjs/development';

            Signature: getRequiredEnvVariable(key: string, type?: string, description?: string): any

            Example: const apiKey = getRequiredEnvVariable('STRIPE_API_KEY');

@daitanjs/config

    Purpose: Provides a centralized singleton manager for all configuration variables.

    Installation: npm i @daitanjs/config

    API Reference:

        initializeConfigManager: Initializes or reloads configuration from process.env. Must be called once at application startup, after loadEnvironmentFiles.

            Import: import { initializeConfigManager } from '@daitanjs/config';

            Signature: initializeConfigManager()

            Example: initializeConfigManager();

        getConfigManager: Retrieves the singleton config instance to read variables.

            Import: import { getConfigManager } from '@daitanjs/config';

            Signature: getConfigManager(): ConfigManager

            Returns: The config manager instance with a .get(key, defaultValue) method.

            Example: const config = getConfigManager(); const port = config.get('PORT', 3000);

@daitanjs/apiqueries

    Purpose: Standardized and simplified HTTP requests using Axios.

    Installation: npm i @daitanjs/apiqueries

    API Reference:

        query: The main function for making any HTTP request. Wraps Axios with standardized error handling.

            Import: import { query } from '@daitanjs/apiqueries';

            Signature: query(config: QueryConfig): Promise<any>

            Parameters (config object): url (string), method? (string), data? (object), params? (object), headers? (object), summary? (string), verbose? (boolean).

            Returns: A Promise resolving to the response data (e.g., the parsed JSON).

            Example: const user = await query({ url: 'https://api.example.com/users/1', summary: 'Fetch user data' });

        Convenience Methods: get, post, put, del, patch.

            Import: import { post } from '@daitanjs/apiqueries';

            Signatures: get(url, config?), post(url, data, config?), put(url, data, config?), del(url, config?), patch(url, data, config?).

            Example: const newUser = await post('https://api.example.com/users', { name: 'Jane Doe' });

@daitanjs/validation

    Purpose: A comprehensive set of data format validation functions.

    Installation: npm i @daitanjs/validation

    API Reference:

        Functions: isEmail, isPhone, isPassword, isURL, isIP (IPv4), isCreditCard (Luhn check), isDate (YYYY-MM-DD), isName.

        Import: import { isEmail, isPassword } from '@daitanjs/validation';

        Returns: All functions return a boolean.

        Example: if (!isPassword(newPassword, { minLength: 10, requireSpecialChar: true })) { return 'Password is too weak.'; }

        isValidJSON: Checks if a string is valid JSON.

            Import: import { isValidJSON } from '@daitanjs/validation';

            Signature: isValidJSON(jsonString: string): { isValid: boolean, parsedJson?: any, error?: string }

            Returns: An object indicating validity and including the parsed JSON or an error message.

            Example: const { isValid, parsedJson } = isValidJSON(userInput);

@daitanjs/data

    Purpose: The foundational data layer for caching, file-based stores, and MongoDB/Mongoose.

    Installation: npm i @daitanjs/data

    API Reference:

        CacheManager Class: For robust in-memory caching.

            Import: import { CacheManager } from '@daitanjs/data';

            Example: const myCache = new CacheManager({ stdTTL: 3600 }); myCache.set('key', { data: 1 });

        CSVSQL Class: To query a directory of CSV files using SQL-like syntax.

            Import: import { CSVSQL } from '@daitanjs/data';

            Example: const db = new CSVSQL('./data'); await db.initialize(); const results = await db.query("SELECT name FROM people");

        Mongoose Integration:

            connectToMongoose: Connects to your MongoDB database.

                Import: import { connectToMongoose } from '@daitanjs/data';

                Signature: connectToMongoose(uri?: string): Promise<Connection>

                Example: await connectToMongoose(process.env.MONGO_URI);

            Models: The package exports pre-defined Mongoose models like User, Company, BlogPost, etc.

                Import: import { User } from '@daitanjs/data';

                Example: const user = await User.findOne({ email: 'test@example.com' });

@daitanjs/users

    Purpose: A service layer for abstracting user CRUD operations. Uses @daitanjs/data underneath.

    Installation: npm i @daitanjs/users

    API Reference:

        createUser: Creates a new user or updates an existing one idempotently based on email.

            Import: import { createUser } from '@daitanjs/users';

            Signature: createUser(userData: object): Promise<UpsertResult>

            Returns: A Promise resolving to { document: object, status: 'inserted' | 'updated' | 'matched_no_update', isNew: boolean }.

            Example: const result = await createUser({ email: 'new@example.com', name: 'New User' });

        getUserById / getUserByEmail: Retrieves a single user.

            Import: import { getUserById } from '@daitanjs/users';

            Signature: getUserById(userId: string): Promise<object | null>

            Returns: The user object or null if not found.

            Example: const user = await getUserById('some-object-id');

        updateUser / deleteUser: Modifies or removes a user by their ID.

@daitanjs/authentication

    Purpose: Provides server-side authentication flows, primarily using Firebase.

    Installation: npm i @daitanjs/authentication

    API Reference:

        signUp: Server-side user creation with email/password via Firebase Admin.

            Import: import { signUp } from '@daitanjs/authentication';

            Signature: signUp(req: Request): Promise<Response>

            Description: Expects a generic Request object with a JSON body: { email, password, displayName? }. Returns a standard Response object with a custom_token for the client to sign in.

        login: Verifies any Firebase ID Token from a client.

            Import: import { login } from '@daitanjs/authentication';

            Signature: login(req: Request): Promise<Response>

            Description: Expects a Request with a JSON body: { idToken: "..." }. Returns a Response with user details.

        googleLogin: Verifies a Google ID Token from a client using Firebase Admin.

            Import: import { googleLogin } from '@daitanjs/authentication';

            Signature: googleLogin({ idToken: string }): Promise<{ success: boolean, user: object }>

            Returns: A Promise resolving to an object with user details.

        googleCallBack: Handles server-side OAuth 2.0 callback from Google.

            Import: import { googleCallBack } from '@daitanjs/authentication';

            Signature: googleCallBack(req: Request): Promise<Response>

            Description: Expects the incoming server Request object from the Google redirect. Returns a standard Response.

@daitanjs/middleware (Next.js)

    Purpose: Reusable Next.js middleware functions, primarily for authentication.

    Installation: npm i @daitanjs/middleware

    API Reference:

        withAuth: A higher-order function that wraps a Next.js API route handler to require JWT authentication.

            Import: import { withAuth } from '@daitanjs/middleware';

            Signature: withAuth(handler: Function, options?: object): Function

            Description: It checks for a JWT in the Authorization: Bearer header or an auth-token cookie. If valid, it attaches the decoded payload to req.user and calls the handler. If not, it returns a 401 response.

            Usage (in app/api/protected/route.js):
            Generated javascript

      
import { withAuth } from '@daitanjs/middleware';
async function myProtectedHandler(req) {
  const userId = req.user.id; // user is now available
  // ...
}
export const GET = withAuth(myProtectedHandler);

    

IGNORE_WHEN_COPYING_START

            Use code with caution. JavaScript
            IGNORE_WHEN_COPYING_END

@daitanjs/routes (Next.js)

    Purpose: Pre-built, plug-and-play Next.js App Router API route handlers. This is the fastest way to build a DaitanJS backend.

    Installation: npm i @daitanjs/routes

    API Reference: This package exports functions to be used directly in route.js files.

        Functions: handleLogin, handleSignUp, handleGetUserById, handleCreatePaymentIntent, handleLlmChat, handleTTS, handleForwardGeocode, etc.

        Usage: You export the handler for the corresponding HTTP method.

        Example (in app/api/auth/login/route.js):
        Generated javascript

      
import { handleLogin } from '@daitanjs/routes';
export const POST = handleLogin;

    

IGNORE_WHEN_COPYING_START
Use code with caution. JavaScript
IGNORE_WHEN_COPYING_END

Example (in app/api/users/[id]/route.js):
Generated javascript

      
import { handleGetUserById } from '@daitanjs/routes';
export const GET = handleGetUserById;

    

IGNORE_WHEN_COPYING_START

        Use code with caution. JavaScript
        IGNORE_WHEN_COPYING_END

@daitanjs/intelligence

    Purpose: The core AI package for LLM orchestration, agents, RAG, and tools.

    Installation: npm i @daitanjs/intelligence

    API Reference:

        generateIntelligence: The central function for all LLM calls.

            Import: import { generateIntelligence } from '@daitanjs/intelligence';

            Signature: generateIntelligence(params: { prompt: object, config?: object }): Promise<{ response: any, usage: object, rawResponse: string }>

            Parameters:

                prompt: An object with user (string) and optional system (object) and shots (array) keys.

                config: An object with llm ({ target, temperature }) and response ({ format: 'json' | 'text' }) keys.

            Returns: A Promise resolving to the LLM's response, token usage data, and the rawResponse string.

            Example: const { response } = await generateIntelligence({ prompt: { user: "Explain quantum computing simply." }, config: { llm: { target: 'MASTER_COMMUNICATOR' } } });

        loadAndEmbedFile: Ingests a local document into the RAG knowledge base.

            Import: import { loadAndEmbedFile } from '@daitanjs/intelligence';

            Signature: loadAndEmbedFile(params: { filePath: string, options?: object }): Promise<object>

            Returns: A Promise resolving to an object with stats about the embedding process.

            Example: await loadAndEmbedFile({ filePath: './project-docs.pdf', options: { collectionName: 'project_v1' } });

        askWithRetrieval: Answers a question using the RAG knowledge base.

            Import: import { askWithRetrieval } from '@daitanjs/intelligence';

            Signature: askWithRetrieval(query: string, options?: object): Promise<{ text: string, retrievedDocs: Document[] }>

            Returns: A Promise resolving to the synthesized answer text and the retrievedDocs used as context.

            Example: const { text } = await askWithRetrieval("What is the project's deadline?", { collectionName: 'project_v1' });

        runDeepResearchAgent: The most powerful research agent.

            Import: import { runDeepResearchAgent } from '@daitanjs/intelligence';

            Signature: runDeepResearchAgent(query: string, options?: { onProgress?: Function }): Promise<ResearchReport>

            Returns: A Promise resolving to an object with the finalAnswer, sources, and full execution plan.

            Example: const report = await runDeepResearchAgent("Analyze market trends for renewable energy.");

@daitanjs/embeddings

    Purpose: Generates vector embeddings for text and performs vector math.

    Installation: npm i @daitanjs/embeddings

    API Reference:

        generateEmbedding: Creates a vector embedding from a string or array of strings.

            Import: import { generateEmbedding } from '@daitanjs/embeddings';

            Signature: generateEmbedding({ input: string | string[], config?: object }): Promise<{ embedding: number[] | number[][] }>

            Returns: A Promise resolving to an object containing the embedding vector(s).

            Example: const { embedding } = await generateEmbedding({ input: "DaitanJS is great." });

        Vector Math: dotProduct(vecA, vecB), magnitude(vec), cosineSimilarity(vecA, vecB).

@daitanjs/senses

    Purpose: AI vision (image analysis), image generation, and media capture.

    Installation: npm i @daitanjs/senses

    API Reference:

        generateImage: Creates an image from a text prompt using DALL-E.

            Import: import { generateImage } from '@daitanjs/senses';

            Signature: generateImage(params: { prompt: string, outputPath?: string, size?: string, response_format?: 'url'|'b64_json' }): Promise<object>

            Returns: A Promise resolving to an object containing image URLs or base64 data.

            Example: const result = await generateImage({ prompt: "A photorealistic cat in a spacesuit", response_format: 'url' });

        analyzeImage: Analyzes an image with a text prompt.

            Import: import { analyzeImage } from '@daitanjs/senses';

            Signature: analyzeImage(params: { imageSource: string, prompt: string }): Promise<{ analysis: string }>

            Returns: A Promise resolving to an object containing the text analysis.

            Example: const { analysis } = await analyzeImage({ imageSource: './car.jpg', prompt: "What color is this car?" });

@daitanjs/speech

    Purpose: Text-to-Speech (TTS) and Speech-to-Text (STT) services.

    Installation: npm i @daitanjs/speech

    API Reference:

        tts: Synthesizes speech from text and saves to an MP3 file. Supports Google & ElevenLabs.

            Import: import { tts } from '@daitanjs/speech';

            Signature: tts(params: { content: { text: string }, voiceConfig?: object, output: { filePath: string } }): Promise<string>

            Returns: A Promise resolving to the path of the saved MP3 file.

            Example: await tts({ content: { text: "Hello world" }, output: { filePath: './output/hello.mp3' } });

        transcribeAudio: Transcribes an audio file to text using OpenAI Whisper.

            Import: import { transcribeAudio } from '@daitanjs/speech';

            Signature: transcribeAudio(params: { source: { filePath: string }, config?: object }): Promise<string | object>

            Returns: A Promise resolving to the transcribed text or a JSON object depending on config.

            Example: const { text } = await transcribeAudio({ source: { filePath: './audio.mp3' } });

@daitanjs/web

    Purpose: Robust web scraping and Google Custom Search.

    Installation: npm i @daitanjs/web

    API Reference:

        downloadAndExtract: The primary scraping function. Intelligently chooses an engine and can return clean "reader-mode" text.

            Import: import { downloadAndExtract } from '@daitanjs/web';

            Signature: downloadAndExtract(url: string, options?: { outputFormat?: 'cleanText'|'structured' }): Promise<any>

            Returns: A Promise resolving to the extracted text (string) or structured data (object).

            Example: const articleText = await downloadAndExtract('https://example.com/news', { outputFormat: 'cleanText' });

        googleSearch: Performs a search using Google Custom Search Engine.

            Import: import { googleSearch } from '@daitanjs/web';

            Signature: googleSearch(params: { query: string, num?: number }): Promise<SearchResultItem[]>

            Returns: A Promise resolving to an array of search results.

            Example: const results = await googleSearch({ query: "DaitanJS documentation", num: 5 });

@daitanjs/media

    Purpose: Utilities for interacting with YouTube.

    Installation: npm i @daitanjs/media

    API Reference:

        convertURLtoMP3: Downloads a YouTube video's audio as an MP3 file (Node.js only, requires yt-dlp CLI tool).

            Import: import { convertURLtoMP3 } from '@daitanjs/media';

            Signature: convertURLtoMP3(params: { url: string, outputDir: string, baseName: string }): Promise<string>

            Returns: A Promise resolving to the path of the saved MP3 file.

            Example: const filePath = await convertURLtoMP3({ url: yt_url, outputDir: './audio', baseName: 'my-song' });

        transcribeYoutubeVideo: Downloads and transcribes a video in one step.

            Import: import { transcribeYoutubeVideo } from '@daitanjs/media';

            Signature: transcribeYoutubeVideo({ url: string, config?: SttConfig }): Promise<string|object>

            Example: const transcript = await transcribeYoutubeVideo({ url: yt_url });

@daitanjs/init

    Purpose: The main entry point for initializing a DaitanJS backend application.

    Installation: npm i @daitanjs/init

    API Reference:

        initializeDaitanApp: Loads environment, sets up logging, config, and database connections.

            Import: import { initializeDaitanApp } from '@daitanjs/init';

            Signature: initializeDaitanApp(options?: { appName?: string, features?: string[] }): Promise<DaitanApp>

            Returns: A Promise resolving to an app object containing the logger and config manager.

            Example: const app = await initializeDaitanApp({ appName: "MyWebApp", features: ['database', 'queues'] });

@daitanjs/queues

    Purpose: Background job processing using BullMQ and Redis.

    Installation: npm i @daitanjs/queues

    API Reference:

        addJob: Adds a job to a queue.

            Import: import { addJob } from '@daitanjs/queues';

            Signature: addJob(queueName: string, jobName: string, data: object): Promise<Job>

            Example: await addJob('mail-queue', 'send-email-via-nodemailer', { to: 'user@example.com' });

        startWorkers: Starts the worker processes to execute jobs. Run this in a separate script.

            Import: import { startWorkers } from '@daitanjs/queues';

            Example: startWorkers();

        checkWorkerHealth: Checks if a worker for a queue is active.

            Import: import { checkWorkerHealth } from '@daitanjs/queues';

            Example: const isHealthy = await checkWorkerHealth('mail-queue');

@daitanjs/html

    Purpose: Utility functions for generating HTML component strings, especially useful for emails.

    Installation: npm i @daitanjs/html

    API Reference:

        Functions: createHeading, createParagraph, createTable, createButton, createEmailWrapper.

        Import: import { createHeading, createTable } from '@daitanjs/html';

        Signature Example: createHeading({ text: string, level?: number, customStyles?: object }): string

        Returns: All functions return an HTML string.

        Example: const html = createHeading({ text: "Report" }) + createTable({ headers: ['ID'], rows: [['1']] });

@daitanjs/office

    Purpose: Create and manage Excel, PowerPoint, and Word documents.

    Installation: npm i @daitanjs/office

    API Reference (Node.js):

        downloadTableAsExcel: Generates an Excel file from an array of objects.

            Import: import { downloadTableAsExcel } from '@daitanjs/office';

            Signature: downloadTableAsExcel(params: { data: object[], columns: (string | ColumnDefinition)[] }): Promise<{ buffer: ArrayBuffer }>

            Returns: A Promise resolving to an object containing the file buffer.

            Example: const { buffer } = await downloadTableAsExcel({ data, columns: ['id', 'name'] });

        createPresentation, addSlide, savePresentation: For creating PowerPoint files.

        createWordDocument, addWordParagraph, saveWordDocument: For creating Word files.

@daitanjs/pdf

    Purpose: PDF generation and manipulation.

    Installation: npm i @daitanjs/pdf

    API Reference (Node.js):

        htmlToPDF: Converts an HTML string to a PDF buffer.

            Import: import { htmlToPDF } from '@daitanjs/pdf';

            Signature: htmlToPDF({ htmlContent: string }): Promise<Buffer>

            Returns: A Promise resolving to the PDF Buffer.

            Example: const pdfBuffer = await htmlToPDF({ htmlContent: '<h1>Hello</h1>' });

        generatePdfReport: High-level function to create a table-based report and save it.

            Import: import { generatePdfReport } from '@daitanjs/pdf';

            Signature: generatePdfReport(params: { data: object[], title: string, outputPath: string }): Promise<{ success: boolean, path: string }>

            Example: await generatePdfReport({ data: myData, title: "Sales Report", outputPath: "./sales.pdf" });

        Manipulation: mergePDFs, splitPDF.

@daitanjs/communication

    Purpose: Sending emails and SMS messages, with background queueing.

    Installation: npm i @daitanjs/communication

    API Reference:

        sendMail: Queues an email for sending via a configured SMTP provider.

            Import: import { sendMail } from '@daitanjs/communication';

            Signature: sendMail({ message: { to, subject, html }, config?: object }): Promise<Job>

            Returns: A BullMQ Job object.

            Example: await sendMail({ message: { to: 'user@example.com', subject: 'Welcome', html: '<h1>Hi!</h1>' } });

        sendTemplatedEmail: Sends a pre-defined, styled email (e.g., welcome).

            Import: import { sendTemplatedEmail } from '@daitanjs/communication';

            Signature: sendTemplatedEmail({ to, subject, templateName: 'welcome' | 'passwordReset', templateData: object }): Promise<Job>

            Example: await sendTemplatedEmail({ to, subject: 'Welcome!', templateName: 'welcome', templateData: { name: 'Jane', activationLink: '...' } });

        sendSMS: Sends an SMS message via Twilio.

            Import: import { sendSMS } from '@daitanjs/communication';

            Signature: sendSMS({ recipient: string, messageBody: string }): Promise<string>

            Returns: The Twilio Message SID.

            Example: await sendSMS({ recipient: '+15551234567', messageBody: 'Your code is 12345.' });

@daitanjs/images

    Purpose: A unified interface for uploading images to cloud storage providers like Firebase, Cloudinary, AWS S3, and Backblaze B2.

    Installation: npm i @daitanjs/images

    API Reference:

        uploadImage: Provider-agnostic function to upload an image.

            Import: import { uploadImage } from '@daitanjs/images';

            Signature: uploadImage({ fileSource: string | Buffer | File, options?: object }): Promise<string>

            Parameters:

                fileSource: A URL, local file path (Node.js), Buffer, or browser File object.

                options: { provider: 'firebase' | 'cloudinary', providerOptions: object }

            Returns: The public URL of the uploaded image.

            Example: const url = await uploadImage({ fileSource: './avatar.png', options: { provider: 'firebase', providerOptions: { firebasePathPrefix: 'avatars/' } } });

@daitanjs/payments

    Purpose: For processing payments with Stripe.

    Installation: npm i @daitanjs/payments

    API Reference:

        createPaymentIntent: Creates a Stripe Payment Intent, the first step in a payment flow.

            Import: import { createPaymentIntent } from '@daitanjs/payments';

            Signature: createPaymentIntent(params: { amount: number, currency: string }): Promise<Stripe.PaymentIntent>

            Parameters (params object): amount (integer in smallest currency unit, e.g., cents), currency (3-letter ISO code).

            Returns: The full Stripe PaymentIntent object. The client_secret is needed for the frontend.

            Example: const intent = await createPaymentIntent({ amount: 2000, currency: 'usd' });

@daitanjs/finance

    Purpose: Retrieval of financial data like exchange rates and stock prices.

    Installation: npm i @daitanjs/finance

    API Reference:

        getPrice: Gets a stock price or currency exchange rate for a specific date.

            Import: import { getPrice } from '@daitanjs/finance';

            Signature: getPrice({ identifier: string, dateDMY: string, baseCurrency: string }): Promise<number>

            Returns: A Promise resolving to the price as a number.

            Example: const price = await getPrice({ identifier: 'AAPL', dateDMY: '27/10/2023', baseCurrency: 'EUR' });

@daitanjs/geo

    Purpose: Geolocation utilities (geocoding, distance calculation).

    Installation: npm i @daitanjs/geo

    API Reference:

        forwardGeocode: Converts an address to coordinates.

            Import: import { forwardGeocode } from '@daitanjs/geo';

            Signature: forwardGeocode({ locationQuery: string }): Promise<object[]>

            Example: const results = await forwardGeocode({ locationQuery: 'Eiffel Tower, Paris' });

        reverseGeocode: Converts coordinates to an address.

            Import: import { reverseGeocode } from '@daitanjs/geo';

            Signature: reverseGeocode({ coordinates: [number, number] }): Promise<object[]>

            Example: const results = await reverseGeocode({ coordinates: [2.29, 48.85] });

@daitanjs/knowledge

    Purpose: Provides static datasets (countries, languages, etc.).

    Installation: npm i @daitanjs/knowledge

    API Reference: This package exports data arrays/objects directly.

        Exports: countryData, languageData, educationLevels, translationsData.

        Import: import { countryData, languageData } from '@daitanjs/knowledge';

        Example: const usa = countryData.find(c => c.isoAlpha2 === 'US');

@daitanjs/manipulation

    Purpose: Utility functions for strings, JSON, and dates.

    Installation: npm i @daitanjs/manipulation

    API Reference:

        Strings: addEscapes, truncate, toTitleCase.

        JSON: cleanJSONString, safeParseJSON.

        Dates: convertUSDateToUKDate.

@daitanjs/math (Node.js Only)

    Purpose: A DataFrame API for data manipulation, powered by Danfo.js.

    Installation: npm i @daitanjs/math

    API Reference:

        DataFrame Class: The main class for 2D data structures.

            Import: import { DataFrame, readCSV } from '@daitanjs/math';

            Example: const df = new DataFrame([{ a: 1, b: 2 }, { a: 3, b: 4 }]); df.log();

@daitanjs/training (Node.js Only)

    Purpose: A high-level class for training TensorFlow.js models.

    Installation: npm i @daitanjs/training

    API Reference:

        ModelTrainer Class: Orchestrates model training.

            Import: import { ModelTrainer } from '@daitanjs/training';

            Example: const model = tf.sequential(...); const trainer = new ModelTrainer(model); await trainer.train({ trainData, trainLabels });

@daitanjs/cli

    Purpose: The command-line interface for managing and interacting with the DaitanJS ecosystem. This is a tool to be used in your terminal, not a library to import into an application.

    Installation: npm install -g @daitanjs/cli

    API (Commands):

        daitan init <appName> [instruction]: Scaffolds a new project. Optionally generates a starter app using an AI based on the instruction.

        daitan check: Checks the health of required services (Ollama, ChromaDB, API keys).

        daitan ai chat: Starts an interactive chat with an LLM.

        daitan ai agent <type> <query>: Runs an AI agent (plan or react).

        daitan rag add <filePath>: Adds a document to the RAG knowledge base.

        daitan rag query <question>: Asks a question to the RAG knowledge base.

        daitan comm send-email: Sends a test email.

        daitan queue dashboard: Starts a web dashboard for background job queues.

        daitan worker start: Starts the background job workers.
