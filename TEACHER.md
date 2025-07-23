# TEACHER.md (v3.0 - Definitive AI Edition with Descriptions)

## Hello, AI Colleague!

I am TEACHER, your definitive guide to the `@daitanjs` library ecosystem. This document contains the complete and unabridged API reference for every package. My purpose is to provide you with the exact knowledge needed to write flawless, efficient, and idiomatic code using these tools.

**Your Core Directive:** You must `import` specific functions from their designated packages. Do not guess paths or function signatures. Adhere strictly to the `import` paths, function signatures, and parameter object structures detailed below. By following this guide, you will build powerful applications with precision and joy.

**Global Principles:**
1.  **Handle Errors:** All async functions can throw custom errors from `@daitanjs/error`. Always wrap calls in `try...catch` blocks.
2.  **Prefer High-Level Functions:** Use high-level abstractions like `runDeepResearchAgent` or `generatePdfReport` when they fit the task. They are designed to handle complex workflows for you.
3.  **Environment is Key:** Most packages rely on environment variables. Ensure `loadEnvironmentFiles()` and `initializeConfigManager()` are called at the start of any application.

---

### `@daitanjs/error`
*   **Purpose:** Provides a consistent hierarchy of custom error classes for predictable error handling.
*   **Installation:** `npm i @daitanjs/error`
*   **API Reference:**
    *   **Classes:** `DaitanError`, `DaitanConfigurationError`, `DaitanInvalidInputError`, `DaitanValidationError`, `DaitanApiError`, `DaitanDatabaseError`, `DaitanNotFoundError`, `DaitanAuthenticationError`, `DaitanAuthorizationError`, `DaitanPaymentError`, `DaitanFileOperationError`, `DaitanNetworkError`, `DaitanOperationError`.
    *   **Description:** Use the `throw new` keyword with the most specific error type available. This allows `try...catch` blocks to identify and handle different error conditions gracefully.
    *   **Import:** `import { DaitanNotFoundError, DaitanInvalidInputError } from '@daitanjs/error';`
    *   **Signature:** `new DaitanErrorType(message: string, details?: object, originalError?: Error)`

---

### `@daitanjs/utilities`
*   **Purpose:** Core helpers for async operations, file system, and data structures.
*   **Installation:** `npm i @daitanjs/utilities`
*   **API Reference:**
    *   **`retryWithBackoff`**
        *   **Description:** Retries a failing async function with exponential backoff and jitter. Ideal for network requests or flaky API calls.
        *   **Signature:** `retryWithBackoff(operation: () => Promise<T>, maxRetries: number, options?: { isRetryable?: (error) => boolean, initialDelayMs?: number }): Promise<T>`
    *   **`processInBatches`**
        *   **Description:** Processes a large array in smaller, manageable chunks to avoid memory or API rate limit issues.
        *   **Signature:** `processInBatches(items: T[], batchSize: number, processBatchAsync: (batch: T[]) => Promise<any>): Promise<any[]>`
    *   **`writeFile` (Node.js Only)**
        *   **Description:** Asynchronously writes data to a file, creating parent directories if they do not exist.
        *   **Signature:** `writeFile(filePath: string, data: string | Buffer): Promise<void>`
    *   **`readFile` (Node.js Only)**
        *   **Description:** Asynchronously reads the entire contents of a file as a UTF-8 string.
        *   **Signature:** `readFile(filePath: string): Promise<string>`

---

### `@daitanjs/security`
*   **Purpose:** Lightweight JWT, OTP, and token management.
*   **Installation:** `npm i @daitanjs/security`
*   **API Reference:**
    *   **`generateJWT`**
        *   **Description:** Creates a JSON Web Token with a payload, signed by a secret. Automatically includes `jti` (JWT ID) and `exp` (expiration) claims.
        *   **Signature:** `generateJWT({ payload: object, secretOrPrivateKey: string, options?: object }): string`
    *   **`verifyJWT`**
        *   **Description:** Verifies a JWT signature and expiration. Throws a `jsonwebtoken` error if invalid, returns the payload if valid.
        *   **Signature:** `verifyJWT({ token: string, secretOrPublicKey: string }): object`

---

### `@daitanjs/development`
*   **Purpose:** Logging and environment variable management.
*   **Installation:** `npm i @daitanjs/development`
*   **API Reference:**
    *   **`getLogger`**
        *   **Description:** Gets a pre-configured Winston logger instance for structured logging.
        *   **Signature:** `getLogger(category: string): Logger`
    *   **`loadEnvironmentFiles`**
        *   **Description:** Loads `.env` files into `process.env`. This should be one of the first calls in your application.
        *   **Signature:** `loadEnvironmentFiles(options?: { envPath?: string })`
    *   **`getRequiredEnvVariable`**
        *   **Description:** Gets an environment variable, throwing a `DaitanConfigurationError` if it is not set.
        *   **Signature:** `getRequiredEnvVariable(key: string, type?: string): any`

---

### `@daitanjs/config`
*   **Purpose:** Provides a centralized, singleton manager for all configuration variables.
*   **Installation:** `npm i @daitanjs/config`
*   **API Reference:**
    *   **`initializeConfigManager`**
        *   **Description:** Initializes the configuration system. Must be called once at application startup, after `loadEnvironmentFiles`.
        *   **Signature:** `initializeConfigManager()`
    *   **`getConfigManager`**
        *   **Description:** Retrieves the singleton config instance to read variables.
        *   **Signature:** `getConfigManager(): ConfigManager`
        *   **Method:** The returned object has a `.get(key: string, defaultValue?: any): any` method.

---

### `@daitanjs/apiqueries`
*   **Purpose:** Standardized and simplified HTTP requests using Axios.
*   **Installation:** `npm i @daitanjs/apiqueries`
*   **API Reference:**
    *   **`query`**
        *   **Description:** The primary function for making any HTTP request. It wraps Axios with standardized error handling and logging.
        *   **Signature:** `query(config: QueryConfig): Promise<any>`
        *   **Parameters (`config` object):** `{ url: string, method?: 'GET'|'POST'|'PUT'|'DELETE'|'PATCH', data?: object, params?: object, headers?: object }`
        *   **Returns:** `Promise<any>` resolving to the response body (typically parsed JSON).
    *   **Convenience Methods:** `get(url, config?)`, `post(url, data, config?)`, `put(url, data, config?)`, `del(url, config?)`, `patch(url, data, config?)`.

---

### `@daitanjs/validation`
*   **Purpose:** A comprehensive set of data format validation functions.
*   **Installation:** `npm i @daitanjs/validation`
*   **API Reference:**
    *   `isEmail(email: string): boolean`
    *   `isPassword(password: string, options?: { minLength?: number, requireUppercase?: boolean, etc. }): boolean`
    *   `isURL(urlString: string): boolean`
    *   `isValidJSON(jsonString: string): { isValid: boolean, parsedJson?: any, error?: string }`
    *   Other functions: `isPhone`, `isIP`, `isCreditCard`, `isDate` (YYYY-MM-DD), `isName`. All return `boolean`.

---

### `@daitanjs/data`
*   **Purpose:** The foundational data layer for caching, file stores, and MongoDB/Mongoose.
*   **Installation:** `npm i @daitanjs/data`
*   **API Reference:**
    *   **`CacheManager` Class:**
        *   **Description:** A class for robust in-memory caching with TTL and key generation.
        *   **Import:** `import { CacheManager } from '@daitanjs/data';`
    *   **`CSVSQL` Class:**
        *   **Description:** A class to query a directory of CSV files using SQL-like syntax.
        *   **Import:** `import { CSVSQL } from '@daitanjs/data';`
    *   **`connectToMongoose`**
        *   **Description:** Establishes and manages the singleton Mongoose connection to your MongoDB database.
        *   **Signature:** `connectToMongoose(uri?: string): Promise<Connection>`
    *   **Mongoose Models:** Exports pre-defined Mongoose models: `User`, `Company`, `BlogPost`, `Provider`, `Question`, `Request`, `Review`, `Skill`, `Task`, `Transaction`.

---

### `@daitanjs/users`
*   **Purpose:** A service layer for abstracting user CRUD operations.
*   **Installation:** `npm i @daitanjs/users`
*   **API Reference:**
    *   `createUser(userData: object): Promise<{ document: object, status: string, isNew: boolean }>`
    *   `getUserById(userId: string): Promise<object | null>`
    *   `updateUser(userId: string, updateData: object): Promise<object>`
    *   `deleteUser(userId: string): Promise<{ deletedCount: number }>`

---

### `@daitanjs/authentication`
*   **Purpose:** Provides server-side authentication flows, primarily using Firebase.
*   **Installation:** `npm i @daitanjs/authentication`
*   **API Reference:**
    *   **`signUp(req: Request): Promise<Response>`**: Handles email/password sign-up via Firebase Admin. Expects `Request` with JSON body `{ email, password }`.
    *   **`login(req: Request): Promise<Response>`**: Verifies any Firebase ID Token. Expects `Request` with JSON body `{ idToken }`.
    *   **`googleLogin({ idToken: string }): Promise<{ success: boolean, user: object }>`**: Verifies a Google ID Token.
    *   **`googleCallBack(req: Request): Promise<Response>`**: Handles server-side OAuth 2.0 callback from Google.

---

### `@daitanjs/middleware` (Next.js)
*   **Purpose:** Reusable Next.js middleware functions.
*   **Installation:** `npm i @daitanjs/middleware`
*   **API Reference:**
    *   **`withAuth`**
        *   **Description:** Wraps a Next.js API route handler to require JWT authentication. It checks for a token in the `Authorization: Bearer` header or an `auth-token` cookie. If valid, it attaches the decoded payload to `req.user` and calls the handler.
        *   **Signature:** `withAuth(handler: Function): Function`
        *   **Example (`app/api/me/route.js`):**
            ```javascript
            import { withAuth } from '@daitanjs/middleware';
            async function getMyProfile(req) {
              const userId = req.user.id; // user object is now available
              return Response.json({ success: true, userId });
            }
            export const GET = withAuth(getMyProfile);
            ```

---

### `@daitanjs/routes` (Next.js)
*   **Purpose:** Pre-built, plug-and-play Next.js App Router API route handlers.
*   **Installation:** `npm i @daitanjs/routes`
*   **Usage:** Export handlers directly from your `route.js` files.
*   **API Reference:** `handleLogin`, `handleSignUp`, `handleGetUserById`, `handleCreatePaymentIntent`, `handleLlmChat`, `handleTTS`, `handleForwardGeocode`.
*   **Example (`app/api/auth/login/route.js`):**
    ```javascript
    import { handleLogin } from '@daitanjs/routes';
    export const POST = handleLogin;
    ```

---

### `@daitanjs/intelligence`
*   **Purpose:** The core AI package for LLM orchestration, agents, RAG, and tools.
*   **Installation:** `npm i @daitanjs/intelligence`
*   **API Reference:**
    *   **`generateIntelligence`**
        *   **Description:** The central, low-level function for all LLM interactions. It handles provider selection, prompt building, response parsing, and error handling.
        *   **Import:** `import { generateIntelligence } from '@daitanjs/intelligence';`
        *   **Signature:** `generateIntelligence(params: object): Promise<{ response: any, usage: object, rawResponse: string }>`
        *   **Parameters (`params` object):**
            *   `prompt`: `{ user: string, system?: { persona?: string, task?: string, outputFormat?: string }, shots?: { role: 'user'|'assistant', content: string }[] }`
            *   `config`: `{ response?: { format: 'json'|'text' }, llm?: { target: string, temperature?: number } }`
        *   **Returns:** A `Promise` resolving to the LLM's `response`, token `usage` data, and `rawResponse` string.
    *   **`loadAndEmbedFile`**
        *   **Description:** Ingests a local document (PDF, DOCX, TXT, etc.) into the RAG knowledge base.
        *   **Import:** `import { loadAndEmbedFile } from '@daitanjs/intelligence';`
        *   **Signature:** `loadAndEmbedFile(params: { filePath: string, options?: object }): Promise<object>`
    *   **`askWithRetrieval`**
        *   **Description:** Answers a question using the RAG knowledge base.
        *   **Import:** `import { askWithRetrieval } from '@daitanjs/intelligence';`
        *   **Signature:** `askWithRetrieval(query: string, options?: object): Promise<{ text: string, retrievedDocs: Document[] }>`
    *   **`runDeepResearchAgent`**
        *   **Description:** The most powerful research agent. It deconstructs a query, executes a multi-step research plan (using internal knowledge and web searches), and synthesizes a comprehensive, cited report.
        *   **Import:** `import { runDeepResearchAgent } from '@daitanjs/intelligence';`
        *   **Signature:** `runDeepResearchAgent(query: string, options?: { onProgress?: (update: object) => void }): Promise<{ finalAnswer: string, sources: string[], plan: object[] }>`

---

### `@daitanjs/embeddings`
*   **Purpose:** Generates vector embeddings for text and performs vector math.
*   **Installation:** `npm i @daitanjs/embeddings`
*   **API Reference:**
    *   `generateEmbedding({ input: string | string[] }): Promise<{ embedding: number[] | number[][] }>`
    *   `cosineSimilarity(vectorA: number[], vectorB: number[]): number`

---

### `@daitanjs/senses`
*   **Purpose:** AI vision (image analysis), image generation, and media capture.
*   **Installation:** `npm i @daitanjs/senses`
*   **API Reference:**
    *   **`generateImage`**: Creates an image from a text prompt using DALL-E.
        *   **Signature:** `generateImage(params: { prompt: string, response_format?: 'url'|'b64_json', size?: string }): Promise<{ urls?: string[], base64Data?: string[] }>`
    *   **`analyzeImage`**: Analyzes an image with a text prompt using a vision model.
        *   **Signature:** `analyzeImage(params: { imageSource: string, prompt: string }): Promise<{ analysis: string }>`

---

### `@daitanjs/speech`
*   **Purpose:** Text-to-Speech (TTS) and Speech-to-Text (STT) services.
*   **Installation:** `npm i @daitanjs/speech`
*   **API Reference:**
    *   **`tts`**: Synthesizes speech from text and saves to an MP3 file.
        *   **Signature:** `tts(params: { content: { text: string }, output: { filePath: string }, voiceConfig?: object }): Promise<string>`
    *   **`transcribeAudio`**: Transcribes an audio file to text using OpenAI Whisper.
        *   **Signature:** `transcribeAudio(params: { source: { filePath: string }, config?: object }): Promise<string | object>`

---

Of course. My apologies for the interruption. Here is the complete and unabridged continuation of the `TEACHER.md` file, starting from the `@daitanjs/web` section as requested.

---

### `@daitanjs/web`
*   **Purpose:** Robust web scraping and Google Custom Search.
*   **Installation:** `npm i @daitanjs/web`
*   **API Reference:**
    *   **`downloadAndExtract`**
        *   **Description:** The primary scraping function. It intelligently chooses a scraping engine (static or browser-based) to get the best content and can return clean "reader-mode" text.
        *   **Import:** `import { downloadAndExtract } from '@daitanjs/web';`
        *   **Signature:** `downloadAndExtract(url: string, options?: { outputFormat?: 'cleanText'|'structured' }): Promise<any>`
        *   **Returns:** A `Promise` resolving to the extracted text (string) or structured data (object), depending on `outputFormat`.
        *   **Code Example:** `const articleText = await downloadAndExtract('https://example.com/news', { outputFormat: 'cleanText' });`
    *   **`googleSearch`**
        *   **Description:** Performs a search using the Google Custom Search Engine API. Requires `GOOGLE_API_KEY_SEARCH` and `GOOGLE_CSE_ID` in `.env`.
        *   **Import:** `import { googleSearch } from '@daitanjs/web';`
        *   **Signature:** `googleSearch(params: { query: string, num?: number }): Promise<SearchResultItem[]>`
        *   **Returns:** A `Promise` resolving to an array of search results, each with `title`, `link`, and `snippet`.
        *   **Code Example:** `const results = await googleSearch({ query: "DaitanJS documentation", num: 5 });`

---

### `@daitanjs/media`
*   **Purpose:** Utilities for interacting with YouTube (Data API and `yt-dlp`).
*   **Installation:** `npm i @daitanjs/media`
*   **API Reference (Node.js):**
    *   **`convertURLtoMP3`**
        *   **Description:** Downloads a YouTube video's audio and converts it to an MP3 file.
        *   **AI Usage Note:** This function requires the `yt-dlp` command-line tool to be installed and available in the server's `PATH`.
        *   **Import:** `import { convertURLtoMP3 } from '@daitanjs/media';`
        *   **Signature:** `convertURLtoMP3(params: { url: string, outputDir: string, baseName: string }): Promise<string>`
        *   **Returns:** A `Promise` resolving to the local file path of the saved MP3 file.
        *   **Code Example:** `const filePath = await convertURLtoMP3({ url: 'https://youtube.com/watch?v=...', outputDir: './audio', baseName: 'my-song' });`
    *   **`transcribeYoutubeVideo`**
        *   **Description:** A high-level function that downloads a YouTube video's audio and transcribes it to text in one step, using `@daitanjs/speech`.
        *   **Import:** `import { transcribeYoutubeVideo } from '@daitanjs/media';`
        *   **Signature:** `transcribeYoutubeVideo({ url: string, config?: SttConfig }): Promise<string|object>`
        *   **Returns:** The transcribed text or JSON object.
        *   **Code Example:** `const transcript = await transcribeYoutubeVideo({ url: 'https://youtube.com/watch?v=...' });`

---

### `@daitanjs/init`
*   **Purpose:** The main entry point for initializing a DaitanJS backend application.
*   **Installation:** `npm i @daitanjs/init`
*   **API Reference:**
    *   **`initializeDaitanApp`**
        *   **Description:** Loads environment variables, sets up logging, initializes the config manager, and connects to services like the database. This should be the first function called in your main application script.
        *   **Import:** `import { initializeDaitanApp } from '@daitanjs/init';`
        *   **Signature:** `initializeDaitanApp(options?: { appName?: string, features?: ('database' | 'queues')[] }): Promise<DaitanApp>`
        *   **Returns:** A `Promise` resolving to an `app` object containing the initialized `logger`, `config` manager, and optionally `db` connection.
        *   **Code Example:**
            ```javascript
            import { initializeDaitanApp } from '@daitanjs/init';
            const app = await initializeDaitanApp({ appName: "MyWebApp", features: ['database', 'queues'] });
            app.logger.info('Application is ready!');
            ```

---

### `@daitanjs/queues`
*   **Purpose:** Background job processing using BullMQ and Redis.
*   **Installation:** `npm i @daitanjs/queues`
*   **API Reference:**
    *   **`addJob`**
        *   **Description:** Adds a job to a specific queue for a worker to process asynchronously.
        *   **Import:** `import { addJob } from '@daitanjs/queues';`
        *   **Signature:** `addJob(queueName: string, jobName: string, data: object, options?: object): Promise<Job>`
        *   **Returns:** A `Promise` resolving to the BullMQ Job object.
        *   **Example:** `await addJob('mail-queue', 'send-email-via-nodemailer', { to: 'user@example.com', subject: 'Welcome' });`
    *   **`startWorkers`**
        *   **Description:** Starts the worker processes to listen for and execute jobs. This should be run in a separate, long-running process (e.g., `node worker.js`).
        *   **Import:** `import { startWorkers } from '@daitanjs/queues';`
        *   **Signature:** `startWorkers()`
        *   **Example:** `startWorkers();`
    *   **`checkWorkerHealth`**
        *   **Description:** Checks if a worker for a specific queue is running and sending heartbeats.
        *   **Import:** `import { checkWorkerHealth } from '@daitanjs/queues';`
        *   **Signature:** `checkWorkerHealth(queueName: string): Promise<boolean>`
        *   **Example:** `const isHealthy = await checkWorkerHealth('mail-queue');`

---

### `@daitanjs/html`
*   **Purpose:** Utility functions for generating HTML component strings, especially useful for emails.
*   **Installation:** `npm i @daitanjs/html`
*   **API Reference:**
    *   **Functions:** `createHeading`, `createParagraph`, `createTable`, `createButton`, `createEmailWrapper`, `createEmailHeader`, `createEmailFooter`.
    *   **Import:** `import { createHeading, createTable } from '@daitanjs/html';`
    *   **Returns:** All functions return an HTML `string`.
    *   **Signature Example:** `createHeading({ text: string, level?: number, customStyles?: object }): string`
    *   **Code Example:** `const html = createHeading({ text: "Report" }) + createTable({ headers: ['ID', 'Name'], rows: [['1', 'Alice']] });`

---

### `@daitanjs/office`
*   **Purpose:** Create and manage Excel, PowerPoint, and Word documents.
*   **Installation:** `npm i @daitanjs/office`
*   **API Reference (Node.js):**
    *   **`downloadTableAsExcel`**: Generates an Excel file from an array of objects.
        *   **Import:** `import { downloadTableAsExcel } from '@daitanjs/office';`
        *   **Signature:** `downloadTableAsExcel(params: { data: object[], columns: (string | ColumnDefinition)[] }): Promise<{ buffer: ArrayBuffer }>`
        *   **Returns:** A `Promise` resolving to an object containing the file `buffer`.
    *   **PowerPoint:** `createPresentation()`, `addSlide(pres, options)`, `savePresentation(pres, filename?)`
    *   **Word:** `createWordDocument()`, `addWordParagraph(doc, content)`, `saveWordDocument(doc, filename?)`

---

### `@daitanjs/pdf`
*   **Purpose:** PDF generation and manipulation.
*   **Installation:** `npm i @daitanjs/pdf`
*   **API Reference (Node.js):**
    *   **`htmlToPDF`**: Converts an HTML string to a PDF buffer using Puppeteer.
        *   **Import:** `import { htmlToPDF } from '@daitanjs/pdf';`
        *   **Signature:** `htmlToPDF({ htmlContent: string, pdfOptions?: object }): Promise<Buffer>`
        *   **Returns:** A `Promise` resolving to the PDF `Buffer`.
    *   **`generatePdfReport`**: High-level function to create a complete report from data and save it to a file.
        *   **Import:** `import { generatePdfReport } from '@daitanjs/pdf';`
        *   **Signature:** `generatePdfReport(params: { data: object[], columns: (string|object)[], title: string, outputPath: string }): Promise<{ success: boolean, path: string }>`

---

### `@daitanjs/payments`
*   **Purpose:** For processing payments with Stripe.
*   **Installation:** `npm i @daitanjs/payments`
*   **API Reference:**
    *   **`createPaymentIntent`**
        *   **Description:** Creates a Stripe Payment Intent, the first step in a payment flow.
        *   **Import:** `import { createPaymentIntent } from '@daitanjs/payments';`
        *   **Signature:** `createPaymentIntent(params: { amount: number, currency: string, ... }): Promise<Stripe.PaymentIntent>`
        *   **Parameters:** `amount` must be an integer in the smallest currency unit (e.g., cents for USD).
        *   **Returns:** The full Stripe PaymentIntent object. The `client_secret` property is needed for the frontend.

---

### `@daitanjs/finance`
*   **Purpose:** Retrieval of financial data like exchange rates and stock prices.
*   **Installation:** `npm i @daitanjs/finance`
*   **API Reference:**
    *   **`getPrice`**
        *   **Description:** Gets a stock price (if identifier is a symbol like 'AAPL') or a currency exchange rate (if identifier is an ISO code like 'EUR') for a specific date.
        *   **Import:** `import { getPrice } from '@daitanjs/finance';`
        *   **Signature:** `getPrice({ identifier: string, dateDMY: string, baseCurrency: string }): Promise<number>`

---

### `@daitanjs/geo`
*   **Purpose:** Geolocation utilities.
*   **Installation:** `npm i @daitanjs/geo`
*   **API Reference:**
    *   **`forwardGeocode`**
        *   **Description:** Converts an address or place name into geographic coordinates.
        *   **Signature:** `forwardGeocode({ locationQuery: string, limit?: number }): Promise<object[]>`
    *   **`reverseGeocode`**
        *   **Description:** Converts geographic coordinates into a human-readable address.
        *   **Signature:** `reverseGeocode({ coordinates: [longitude: number, latitude: number] }): Promise<object[]>`

---

### `@daitanjs/knowledge`
*   **Purpose:** Provides static datasets (countries, languages, etc.).
*   **Installation:** `npm i @daitanjs/knowledge`
*   **API Reference:** This package exports data arrays/objects directly.
    *   **Exports:** `countryData`, `languageData`, `educationLevels`, `translationsData`.
    *   **Example:** `import { countryData } from '@daitanjs/knowledge'; const usa = countryData.find(c => c.isoAlpha2 === 'US');`

---

### `@daitanjs/manipulation`
*   **Purpose:** Utility functions for strings, JSON, and dates.
*   **Installation:** `npm i @daitanjs/manipulation`
*   **API Reference:**
    *   `addEscapes(str: string): string`: Escapes special characters in a string.
    *   `truncate(str: string, maxLength?: number): string`: Truncates a string.
    *   `toTitleCase(str: string): string`: Converts a string to title case.
    *   `cleanJSONString(jsonString: string): string`: Heuristically cleans a JSON-like string.
    *   `safeParseJSON(jsonString: string): object`: Parses a JSON string, throwing a Daitan error on failure.
    *   `convertUSDateToUKDate(usDate: string): string`: Converts 'MM/DD/YYYY' to 'DD/MM/YYYY'.

---

### `@daitanjs/math` (Node.js Only)
*   **Purpose:** A DataFrame API for data manipulation, powered by Danfo.js.
*   **Installation:** `npm i @daitanjs/math`
*   **API Reference:**
    *   **`DataFrame` Class**: The main class for 2D data structures.
        *   **Import:** `import { DataFrame, readCSV } from '@daitanjs/math';`
        *   **Constructor:** `new DataFrame(data: object[] | any[][])`
    *   **I/O:** `readCSV(filePath: string)`, `readJSON(filePath: string)`

---

### `@daitanjs/training` (Node.js Only)
*   **Purpose:** A high-level class for training TensorFlow.js models.
*   **Installation:** `npm i @daitanjs/training`
*   **API Reference:**
    *   **`ModelTrainer` Class**: Orchestrates model training.
        *   **Import:** `import { ModelTrainer } from '@daitanjs/training';`
        *   **Constructor:** `new ModelTrainer(model: tf.Sequential)`
        *   **Methods:** `train({ trainData, trainLabels, fitConfig? })`

---

### `@daitanjs/cli`
*   **Purpose:** The command-line interface for managing and interacting with the DaitanJS ecosystem.
*   **Installation:** `npm install -g @daitanjs/cli`
*   **Usage Note:** This is a tool to be used in your terminal, not a library to import into an application.
*   **API (Commands):**
    *   `daitan init <appName> [instruction]`: Scaffolds a new project.
    *   `daitan check`: Checks health of required services.
    *   `daitan ai agent <type> <query>`: Runs an AI agent.
    *   `daitan rag add <filePath>`: Adds a document to the knowledge base.
    *   `daitan rag query <question>`: Asks a question to the knowledge base.
    *   `daitan worker start`: Starts background job workers.