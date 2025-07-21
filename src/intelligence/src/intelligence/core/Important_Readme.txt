# README: Core Orchestration Architecture

## ATTENTION: Important Note for Future Developers

This directory contains the core logic for making LLM calls. Its central file, `llmOrchestrator.js`, has been intentionally rewritten to be simple and direct after a significant and difficult-to-diagnose bug.

### History of the Bug

Previous versions of the library suffered from a persistent `TypeError: (void 0) is not a function` crash. This error was extremely difficult to trace but was ultimately caused by a combination of two factors:

1.  **A Malformed Error from a Third-Party Library:** The LangSmith tracing library, when encountering a server-side ingestion error (HTTP 422), would throw a broken error object back into the main application thread. This object was not a standard `Error` instance and lacked a `.message` property.
2.  **Fragile Internal Error Handling:** The DaitanJS library's own `catch` blocks and custom `DaitanApiError` wrapper were not robust enough to handle this malformed error. Any attempt to inspect the error (e.g., `error.message`) would cause the application to crash.

### Architectural Principles to Prevent Regression

To ensure stability, the `llmOrchestrator.js` file and its dependencies must adhere to the following principles. Do not deviate from them without understanding the risks.

1.  **No Complex Abstractions Around the Core LLM Call:** The orchestrator should directly instantiate and invoke the LangChain LLM client (`ChatOpenAI`, etc.). Avoid adding intermediate helper functions or classes (`llmExecutor`, etc.) that obscure the direct call. The logic proven to work is: **`[Parse Config] -> [Instantiate Client] -> [Invoke] -> [Handle Result]`**.

2.  **Isolate Dependencies:** Modules should import directly from source files (e.g., `import { ... } from './llmPricing.js'`) rather than from a central `index.js` barrel file within the same directory. This prevents circular dependencies, which were a suspected contributor to the original problem.

3.  **Assume All Caught Errors are Unstable:** Any `catch (error)` block surrounding a third-party library call (especially `llm.invoke`) must assume the `error` object is malformed.
    -   **DO NOT** access properties like `error.message` directly.
    -   **DO** wrap the error in a custom error class (like `DaitanApiError`) but pass it a generic, hard-coded string as the message. The original, unstable error can be passed as the `cause` for later debugging, but its properties should not be inspected during the wrapping process.

4.  **Add Features Incrementally:** When adding new functionality, do so in small, verifiable steps.
    -   **Step 1:** Add the feature.
    -   **Step 2:** Build the library.
    -   **Step 3:** Run a core test script to confirm stability.
    -   This methodical process is what ultimately allowed us to find and fix this bug.

By adhering to these principles, we can maintain a stable, robust, and reliable core for the `@daitanjs/intelligence` library.