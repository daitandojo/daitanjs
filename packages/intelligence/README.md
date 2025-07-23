# @daitanjs/intelligence

A modular JavaScript/TypeScript library for LLM orchestration, prompt management, Retrieval Augmented Generation (RAG), agent creation, and AI workflow automation. Designed for versatility, robustness, and ease of use in building AI-powered applications.

## Features

- **Core LLM Interaction (`generateIntelligence`):**
  - Multi-provider support (OpenAI, Groq, Anthropic, Ollama, OpenRouter, and extensible).
  - "Expert Model" profiles (e.g., "MASTER_CODER", "CREATIVE_WRITER") for abstracting specific model choices.
  - Streaming responses.
  - Automatic retries with exponential backoff.
  - Token usage tracking and cost estimation.
  - JSON and text response formatting.
  - Memory management for conversational context.
  - LangSmith tracing integration.
- **Retrieval Augmented Generation (RAG):**
  - Flexible data loading from various file types (.pdf, .docx, .md, .txt, .html, .json, .csv).
  - Text splitting and chunking strategies.
  - Embedding generation (currently OpenAI, extensible).
  - Vector store integration using an adapter pattern (ChromaDB and In-Memory supported out-of-the-box).
  - Advanced retrieval strategies (HyDE conceptualized).
  - Answer synthesis with source grounding.
- **Agent Framework:**
  - `BaseAgent` class for creating custom agents.
  - Pre-built chat simulation agents (`ChoreographerAgent`, `CoachAgent`, `OpeningPhraseAgent`).
  - LangGraph-powered `ParticipantAgent` for complex conversational turns.
  - Integration with LangChain's AgentExecutor for tool-using agents (`runDaitanAgent`).
- **Tooling:**
  - `BaseTool` class and `ITool` interface for tool definition.
  - Utility (`createDaitanTool`) for easily creating LangChain-compatible tools from functions.
  - Default tools: Calculator, Wikipedia Search, Web Search, (secured) Command Line Interface.
- **Workflow Orchestration (LangGraph):**
  - `DaitanLangGraph` manager for building and compiling stateful graphs.
  - Support for persistent graph state via checkpointers (SQLite, and extensible for Redis, Postgres).
  - Graph runner utilities.
- **Prompt Management (`promptManager`):**
  - Registry for named prompt templates (LangChain `PromptTemplate` and `ChatPromptTemplate`).
  - Formatting and versioning capabilities (versioning conceptualized).
- **Configuration (`configManager`):**
  - Centralized configuration loading from environment variables.
- **Services (`LLMService`, `DaitanOrchestrator`):**
  - `LLMService`: Simplifies calls to `generateIntelligence` for components.
  - `DaitanOrchestrator`: High-level facade for common library operations (RAG queries, agent execution).
- **Utilities:**
  - Multilingual translation.
  - Metadata extraction.

## Getting Started

### Installation

````bash
npm install @daitanjs/intelligence
# or
yarn add @daitanjs/intelligence



IGNORE_WHEN_COPYING_START
Use code with caution. Markdown
IGNORE_WHEN_COPYING_END

Ensure you have peer dependencies like lodash and uuid installed in your project.
Also, install necessary LLM provider SDKs if you plan to use them (e.g., @langchain/openai, @langchain/anthropic, groq-sdk). For Ollama, ensure your Ollama server is running.
Environment Variables

Configure your LLM API keys and other settings via environment variables (e.g., in a .env file):


# Example for OpenAI
OPENAI_API_KEY="your_openai_api_key"
LLM_PROVIDER="openai"
LLM_MODEL="gpt-4o-mini" # Default model

# Example for Anthropic
ANTHROPIC_API_KEY="your_anthropic_api_key"

# Example for Groq
GROQ_API_KEY="your_groq_api_key"

# For LangSmith Tracing (Optional)
LANGCHAIN_TRACING_V2="true"
LANGCHAIN_API_KEY="your_langsmith_api_key"
LANGCHAIN_PROJECT="Your-DaitanJS-Project-Name" # Optional, defaults to DaitanJS-Project
# LANGCHAIN_ENDPOINT="https://api.smith.langchain.com" # Optional

# For RAG with ChromaDB
CHROMA_HOST="localhost" # Default
CHROMA_PORT="8000"    # Default

# For WebSearchTool using Google Custom Search API
# Ensure @daitanjs/web is configured with these if using that module's googleSearch
GOOGLE_CSE_ID="your_google_custom_search_engine_id"
GOOGLE_API_KEY="your_google_api_key_for_search"

# Logging Level for DaitanJS Development Logger
# Options: 'debug', 'info', 'warn', 'error'
LOG_LEVEL="info"
# Specific debug flags
# DEBUG_INTELLIGENCE=true
# DEBUG_AGENT=true
# DEBUG_LANGGRAPH=true
# RAG_MEMORY_VERBOSE=true
# RAG_EMBED_VERBOSE=true
# RAG_RETRIEVAL_VERBOSE=true



IGNORE_WHEN_COPYING_START
Use code with caution. Env
IGNORE_WHEN_COPYING_END
Basic Usage: Direct LLM Call


import { generateIntelligence } from '@daitanjs/intelligence';

async function askSomething() {
  try {
    const { response, usage } = await generateIntelligence({
      userPrompt: "What is the capital of France?",
      // llmProviderOrExpert: "FAST_TASKER", // Or use an expert model
      // temperature: 0.5,
      responseFormat: "text",
      summary: "Capital of France query"
    });
    console.log("Answer:", response);
    if (usage) {
      console.log("Tokens used:", usage.totalTokens, "Estimated cost:", usage.estimatedCostUSD);
    }
  } catch (error) {
    console.error("Error asking question:", error);
  }
}

askSomething();



IGNORE_WHEN_COPYING_START
Use code with caution. JavaScript
IGNORE_WHEN_COPYING_END
Basic Usage: RAG Query


import { DaitanOrchestrator, LLMService } from '@daitanjs/intelligence';
import { OpenAIEmbeddings } from '@langchain/openai'; // If using OpenAI for embeddings

// Assume your ChromaDB is running and you've embedded documents.
// See RAG documentation for embedding.

async function queryDocs() {
  // For the orchestrator, you can pass a pre-configured LLMService
  const llmService = new LLMService({ verbose: true }); // Configure as needed
  const orchestrator = new DaitanOrchestrator({ llmService });

  try {
    const result = await orchestrator.ragQuery({
      query: "What are the main features of @daitanjs/intelligence?",
      collectionName: "my_project_docs", // Specify your RAG collection
      // RAG options (topK, filter, useHyDE etc.) can be passed here
      // ragOptions: { topK: 3, useHyDE: false }
      // LLM config for RAG synthesis can also be specified
      // synthesisLlmConfig: { llmProviderOrExpert: 'MASTER_COMMUNICATOR' }
    });
    console.log("RAG Answer:", result.text);
    console.log("Retrieved Sources:", result.retrievedDocs.map(d => d.metadata.source_filename));
  } catch (error) {
    console.error("Error querying documents:", error);
  }
}
// queryDocs(); // Call this after embedding some data



IGNORE_WHEN_COPYING_START
Use code with caution. JavaScript
IGNORE_WHEN_COPYING_END
Core Modules

    src/intelligence: Main entry point for AI functionalities.

        core/: Low-level LLM interaction, provider configurations, embedding generation.

        rag/: Retrieval Augmented Generation pipeline components.

        agents/: Base classes and implementations for autonomous agents.

        tools/: Standard and custom tools for agents.

        workflows/: LangGraph setup and management for complex multi-step processes.

        prompts/: Prompt management utilities.

        metadata/: Text metadata extraction.

    src/services: Higher-level services like LLMService.

    src/orchestration: Facade classes like DaitanOrchestrator for simplifying common tasks.

    src/config: Centralized configuration management.

    src/chat: (Legacy) Chat simulation classes and older procedural agents. Consider refactoring or integrating with the new agent framework.

    src/language: Translation utilities.

    src/utils: Common utility functions.

Development

(Information about contributing, testing, building - to be added)


npm run test



IGNORE_WHEN_COPYING_START
Use code with caution.
IGNORE_WHEN_COPYING_END
Further Documentation

    Conceptual Overview (To be created)

    Tutorials (To be created)

    API Documentation: Generated from JSDoc comments.

This library is under active development.


**File Path:** `README.md` (root of the library)
**Task Number:** 14 (Partial - Root README)

---

**2. README for `src/intelligence/`**

**File Content for `src/intelligence/README.md`:**

```markdown
# src/intelligence Module

This directory is the heart of the `@daitanjs/intelligence` library, containing all core AI functionalities.

## Submodules

*   **`core/`**:
    *   `llmOrchestrator.js`: The primary function `generateIntelligence` for interacting with LLMs, handling multiple providers, streaming, retries, token counting, and LangSmith tracing.
    *   `providerConfigs.js`: Definitions and resolution logic for LLM provider settings (API keys, base URLs, LangChain classes).
    *   `expertModels.js`: Defines "expert model" profiles mapping abstract roles to specific providers and models.
    *   `embeddingGenerator.js`: Functionality for generating text embeddings.
    *   `tokenUtils.js`: Utilities for counting tokens (e.g., using `tiktoken`).
    *   `llmPricing.js`: Data and functions for estimating LLM call costs.
    *   `ollamaUtils.js`: Utilities specific to Ollama.
    *   `chain.js`: (Legacy) Older module for creating simple LangChain chains with memory. Consider for deprecation or refactor.

*   **`rag/`**:
    *   Components for building Retrieval Augmented Generation (RAG) pipelines.
    *   `embed.js`: Loading files, splitting text, generating metadata, and embedding chunks into vector stores.
    *   `retrieval.js`: Querying vector stores, optionally using HyDE, re-ranking (conceptual), and synthesizing answers with LLMs.
    *   `memory.js`: Manages vector store instances (ChromaDB, In-Memory via Adapters) and session memory.
    *   `chromaVectorStoreAdapter.js`, `memoryVectorStoreAdapter.js`: Adapters for specific vector store implementations.
    *   `vectorStoreAdapterInterface.js`: Defines the contract for vector store adapters.
    *   `chromaClient.js`: (Legacy/Direct Admin) Direct interaction utilities for ChromaDB, potentially for admin tasks.
    *   `printStats.js`: Utility to print statistics about vector store collections.
    *   `memoryLoaderHelper.js`: Helper functions for loading various document types for RAG.

*   **`agents/`**:
    *   `baseAgent.js`: Abstract `BaseAgent` class providing a common structure for agents.
    *   `chat/`: Contains chat-specific agents.
        *   `choreographerAgent.js`, `coachAgent.js`, `openingPhraseAgent.js`: Class-based agents extending `BaseAgent` for chat simulation.
    *   `agentExecutor.js`: (`runDaitanAgent`) Wrapper for LangChain's `AgentExecutor` to run agents with tools.
    *   `prompts/`: Default prompt templates for general-purpose agents.

*   **`tools/`**:
    *   `toolInterface.js`: Defines the conceptual `ITool` contract.
    *   `baseTool.js`: An optional `BaseTool` class for more structured tool creation.
    *   `index.js`: Exports available tools and `createDaitanTool` factory.
    *   `calculatorTool.js`, `wikipediaSearchTool.js`, `webSearchTool.js`, `cliTool.js`: Implementations of standard tools.

*   **`workflows/`**:
    *   `langGraphManager.js`: (`DaitanLangGraph`) Class for building and managing LangGraph stateful graphs.
    *   `graphRunner.js`: Utilities for running compiled LangGraphs, including streaming and interruptions.
    *   `participantAgentGraph.js`: Example LangGraph implementation for the chat participant's complex response generation.

*   **`prompts/`**:
    *   `promptManager.js`: A registry for managing, versioning (conceptual), and formatting LangChain prompt templates.

*   **`metadata/`**:
    *   `index.js`: Functions (`autoTagDocument`, `safeGenerateMetadata`) for extracting metadata (tags, type, summary) from text using LLMs.
    *   `parse.js`: Utilities for parsing and validating metadata JSON.

## Key Exports from `src/intelligence/index.js`

This module re-exports the most important functionalities from its submodules, providing a convenient top-level API for the library.



IGNORE_WHEN_COPYING_START
Use code with caution.
IGNORE_WHEN_COPYING_END

File Path: src/intelligence/README.md
Task Number: 14 (Partial - src/intelligence README)

3. README for src/agents/

File Content for src/agents/README.md:


# src/agents Module

This module contains the framework and implementations for autonomous agents within the `@daitanjs/intelligence` library.

## Core Concepts

*   **`baseAgent.js`**: Defines the `BaseAgent` abstract class. All custom agents should ideally extend this class. It provides:
    *   A common constructor requiring a `name`, `description`, and an `LLMService` instance.
    *   An abstract `run(context)` method that subclasses must implement to define their core logic.
    *   Helper methods for logging and creating standardized success/error responses.
    *   A mechanism to hold and access `tools`.
*   **`AgentContext`**: A flexible object passed to an agent's `run` method, containing necessary information like the `LLMService`, a `payload` specific to the agent's task, and available `tools`.
*   **`AgentResponse`**: A standardized structure for what an agent's `run` method returns, including the `output`, `summary`, and any errors or `llmUsage`.

## Agent Types

*   **Simple Class-Based Agents (extending `BaseAgent`):**
    *   Located in subdirectories like `chat/`.
    *   These agents typically perform a specific, often single-LLM-call task based on their configuration and the provided context.
    *   They leverage the `LLMService` for LLM interactions.
    *   Examples: `ChoreographerAgent`, `CoachAgent`, `OpeningPhraseAgent`.

*   **LangGraph-Powered Agents:**
    *   For more complex, multi-step, or stateful agent behaviors.
    *   The agent's logic is defined as a stateful graph using `DaitanLangGraph` (from `src/intelligence/workflows`).
    *   Example: The `ParticipantAgent`'s response generation (in `src/intelligence/workflows/participantAgentGraph.js`, invoked by `src/chat/agents/participant.js`). While `participant.js` itself might not be a `BaseAgent`, its core intelligent behavior is a graph.

*   **LangChain AgentExecutor-Powered Agents (`runDaitanAgent`):**
    *   Found in `src/intelligence/agents/agentExecutor.js`.
    *   Uses LangChain's `AgentExecutor` (specifically `createOpenAIToolsAgent`) to create agents that can reason and use tools to accomplish goals.
    *   These are more general-purpose and rely on the LLM's ability to choose and use tools based on their descriptions.

## Agent Framework Goals

*   **Modularity:** Encapsulate distinct agent behaviors.
*   **Reusability:** `BaseAgent` and `LLMService` promote code reuse.
*   **Testability:** Clear separation of concerns makes agents easier to test.
*   **Clarity:** Standardized structure for defining and running agents.
*   **Flexibility:** Supports simple agents, complex graph-based agents, and tool-using LangChain agents.

## Creating a New Agent (Extending `BaseAgent`)

1.  Create a new file (e.g., `src/agents/custom/myNewAgent.js`).
2.  Import `BaseAgent` and `LLMService`.
3.  Define your agent class: `export class MyNewAgent extends BaseAgent { ... }`.
4.  Implement the `constructor`, calling `super(name, description, llmServiceInstance)`.
5.  Implement the `async run(context)` method:
    *   Access `context.llmService` to make LLM calls.
    *   Access `context.payload` for task-specific data.
    *   Access `this.tools` (or `context.tools`) if the agent needs tools.
    *   Return an `AgentResponse` using `this.createSuccessResponse(...)` or `this.createErrorResponse(...)`.



IGNORE_WHEN_COPYING_START
Use code with caution. Markdown
IGNORE_WHEN_COPYING_END

File Path: src/agents/README.md
Task Number: 14 (Partial - src/agents README)

4. README for src/tools/

File Content for src/tools/README.md:


# src/tools Module

This module provides tools that can be used by AI agents (e.g., those run by `AgentExecutor` or custom LangGraph agents) to interact with the external world or perform specific computations.

## Core Concepts

*   **`toolInterface.js` (`ITool`):** Defines a conceptual interface (JSDoc) for tools, outlining essential properties like `name`, `description`, and a `run` method. This serves as a contract for how tools should be structured.
*   **`baseTool.js` (`BaseTool`):** An optional abstract base class that tools can extend. It provides a basic structure, logging, and can help in aligning with LangChain's `Tool` or `StructuredTool` concepts, especially if using input schemas (e.g., Zod).
*   **`index.js`:**
    *   `createDaitanTool(name, description, func)`: A factory function to quickly create LangChain-compatible `DynamicTool` instances from simple asynchronous functions. This is the recommended way for most functional tools.
    *   `getDefaultTools([toolNames])`: Returns an array of pre-configured default tool instances.
    *   Exports individual default tool instances.

## Default Tools Provided

*   **`calculatorTool.js`**: Performs mathematical calculations.
*   **`wikipediaSearchTool.js`**: Searches Wikipedia for information.
*   **`webSearchTool.js`**: Performs a web search (currently configured for Google Custom Search via `@daitanjs/web`'s `googleSearch` function, which needs API key setup).
*   **`cliTool.js`**: Executes **strictly whitelisted and validated** shell commands.
    *   **SECURITY WARNING:** This tool is powerful. Its usage is restricted to a very small set of commands and argument patterns defined in `cliTool.js`. Extreme caution must be exercised if modifying or extending its capabilities. Misuse can lead to severe security vulnerabilities.

## Creating a New Tool

### Option 1: Using `createDaitanTool` (Recommended for simple, functional tools)

1.  Define an `async` function that takes an input (usually a string or an object if the agent passes structured input) and returns a string (or a `ToolResponse` object if you want more structure, though `createDaitanTool` will stringify it).
2.  In `src/tools/index.js` (or a new tool file that `index.js` imports from):
    ```javascript
    // In your_new_tool.js
    // import { createDaitanTool } from './index.js'; // Or from its actual path if in a separate file
    //
    // async function myToolFunction(input) {
    //   // ... your tool logic ...
    //   return `Result: processed ${input}`;
    // }
    //
    // export const myCustomTool = createDaitanTool(
    //   "my_custom_tool_name",
    //   "Description of what my custom tool does and what input it expects.",
    //   myToolFunction
    // );

    // Then, add `myCustomTool` to `allTools` in `src/tools/index.js` and export it.
    ```

### Option 2: Extending `BaseTool` (For more complex tools or stricter schema validation)

1.  Create a new file (e.g., `src/tools/myComplexTool.js`).
2.  Import `BaseTool` (and Zod if using input schemas).
3.  Define your tool class: `export class MyComplexTool extends BaseTool { ... }`.
4.  Implement the `constructor`, calling `super(name, description, zodSchema)`.
5.  Implement the `async _run(input)` method with your tool's logic.
6.  Instantiate your tool: `export const myComplexToolInstance = new MyComplexTool();`.
7.  Add `myComplexToolInstance` to `allTools` in `src/tools/index.js` and export it.

## Tool Security

*   Always validate and sanitize inputs to tools, especially those that interact with external systems or execute code (like `cliTool`).
*   Favor tools that are read-only where possible.
*   For tools executing shell commands or code, implement robust sandboxing mechanisms if extending beyond the current `cliTool`'s strict whitelist.
*   Be mindful of rate limits and costs associated with tools calling external APIs.



IGNORE_WHEN_COPYING_START
Use code with caution. Markdown
IGNORE_WHEN_COPYING_END

File Path: src/tools/README.md
Task Number: 14 (Partial - src/tools README)

5. Conceptual Overview Document (Outline)

This would live in a new docs/conceptual/ directory.

File: docs/conceptual/ARCHITECTURE.md (Outline)


# @daitanjs/intelligence - Conceptual Architecture

This document provides a high-level overview of the architecture of the `@daitanjs/intelligence` library.

## Core Philosophy

*   **Modularity:** Components are designed to be as independent as possible, allowing users to pick and choose functionalities.
*   **Extensibility:** Provide base classes and interfaces to make it easy to add new providers, agents, tools, and RAG components.
*   **Abstraction:** Offer higher-level abstractions (`DaitanOrchestrator`, `LLMService`) to simplify common tasks for consuming applications.
*   **Developer Experience:** Focus on clear APIs, good JSDoc documentation, and comprehensive logging for easier debugging and integration.
*   **Robustness:** Incorporate error handling, retries, and configuration management for production readiness.

## Key Architectural Layers & Components

1.  **Configuration Layer (`src/config`)**
    *   `configManager.js`: Central point for loading and accessing configuration (environment variables, defaults).
    *   Used by most other components to get API keys, base URLs, feature flags, etc.

2.  **Core Intelligence Layer (`src/intelligence/core`)**
    *   `llmOrchestrator.js` (`generateIntelligence`): The engine for all LLM calls.
        *   Handles provider resolution (via `providerConfigs.js`, `expertModels.js`).
        *   Manages prompt assembly, LLM instantiation, API call execution (with retries, streaming).
        *   Integrates token counting (`tokenUtils.js`) and cost estimation (`llmPricing.js`).
        *   Supports LangSmith tracing.
    *   `embeddingGenerator.js`: For creating text embeddings.
    *   `providerConfigs.js`, `expertModels.js`: Define how to connect to and use different LLM providers and abstract model choices.

3.  **Service Layer (`src/services`)**
    *   `llmService.js`: A wrapper around `generateIntelligence` providing a more convenient API for other components (like agents) with pre-settable defaults.

4.  **Application/Feature Layers (`src/intelligence/*`)**

    *   **RAG (`src/intelligence/rag`)**:
        *   Data Ingestion: `embed.js`, `memoryLoaderHelper.js`.
        *   Vector Store Interaction: `vectorStoreAdapterInterface.js` and its implementations (`chromaVectorStoreAdapter.js`, `memoryVectorStoreAdapter.js`). Managed by `memory.js` (`getVectorStore`).
        *   Retrieval & Synthesis: `retrieval.js` (`askWithRetrieval`).

    *   **Agents (`src/intelligence/agents`, `src/agents`)**:
        *   `BaseAgent` (`src/agents/baseAgent.js`): Foundation for custom agents.
        *   Simple Agents (e.g., `src/agents/chat/*Agent.js`): Extend `BaseAgent`, use `LLMService`.
        *   LangChain Agents: `agentExecutor.js` (`runDaitanAgent`) using LangChain's framework.
        *   LangGraph Agents: Defined in `src/intelligence/workflows` (e.g., `participantAgentGraph.js`).

    *   **Tools (`src/intelligence/tools`, `src/tools`)**:
        *   `ITool` (`src/tools/toolInterface.js`), `BaseTool` (`src/tools/baseTool.js`): Structure for tools.
        *   `createDaitanTool`: Factory for LangChain `DynamicTool`.
        *   Implementations of specific tools.

    *   **Workflows (`src/intelligence/workflows`)**:
        *   `DaitanLangGraph`: Manager for LangGraph graphs.
        *   `graphRunner`: Utilities to execute compiled graphs.

    *   **Prompt Management (`src/intelligence/prompts`)**:
        *   `promptManager.js`: Registry for LangChain prompt templates.

    *   **Metadata (`src/intelligence/metadata`)**: LLM-powered metadata extraction.

    *   **Language (`src/language`)**: Translation utilities.

5.  **Orchestration Layer (`src/orchestration`)**
    *   `daitanOrchestrator.js`: High-level facade providing simplified methods for common library use cases (e.g., `ragQuery`, `runAgentByName`).

## Data Flow (Example: RAG Query via Orchestrator)

1.  Consuming App calls `orchestrator.ragQuery(query, options)`.
2.  `DaitanOrchestrator` uses its `LLMService` (if needed for HyDE) and RAG components.
3.  `askWithRetrieval` (in `src/intelligence/rag/retrieval.js`) is invoked.
    *   (Optional) HyDE uses `LLMService` (which calls `generateIntelligence`) to create a hypothetical document.
    *   `getVectorStore` (in `src/intelligence/rag/memory.js`) provides a vector store adapter.
    *   Adapter performs similarity search.
    *   Retrieved snippets are passed to `LLMService` (via `generateIntelligence`) for answer synthesis.
4.  Result is returned through the layers to the consuming app.

## Diagram (Conceptual - Mermaid Syntax Example)

```mermaid
graph TD
    A[Consuming App] --> B(DaitanOrchestrator);

    subgraph "Service & Core Layers"
        B --> C{LLMService};
        C --> D[generateIntelligence];
        D --> E[Provider/Expert Configs];
        D --> F[LLM Clients - LangChain];
        D --> G[Token/Cost Utils];
    end

    subgraph "Feature: RAG"
        B --> H(askWithRetrieval);
        H --> I[Vector Store Adapters];
        I --> J[ChromaDB / In-Memory];
        H --> C; # For HyDE & Synthesis
    end

    subgraph "Feature: Agents"
        B --> K(AgentRunner/BaseAgent);
        K --> C; # Agents use LLMService
        K --> L[Tools];
        L --> M[External APIs/OS];
        K --> N[LangGraph Workflows];
        N --> C; # Graph nodes use LLMService
    end

    click A "#" "Consuming Application"
    click B "src/orchestration/daitanOrchestrator.js"
    click C "src/services/llmService.js"
    click D "src/intelligence/core/llmOrchestrator.js"



IGNORE_WHEN_COPYING_START
Use code with caution. Markdown
IGNORE_WHEN_COPYING_END
Extending the Library

    New LLM Provider: Add to PROVIDER_CLASSES in src/intelligence/core/providerConfigs.js and ensure ConfigManager handles its API key/URL.

    New Expert Model: Add to EXPERT_MODELS in src/intelligence/core/expertModels.js.

    New Agent: Extend BaseAgent or build a LangGraph workflow.

    New Tool: Use createDaitanTool or extend BaseTool.

    New RAG Component: Implement IVectorStoreAdapter for a new vector DB, or add new data loaders.


**File Path:** `docs/conceptual/ARCHITECTURE.md`
**Task Number:** 14 (Partial - Conceptual Architecture Doc)

---

**6. Tutorials (Outline)**

This would be a `README.md` in a new `docs/tutorials/` directory, linking to individual tutorial files.

**File: `docs/tutorials/README.md` (Outline)**

```markdown
# @daitanjs/intelligence - Tutorials

This section provides step-by-step tutorials for common use cases of the library.

## Available Tutorials

1.  **[Getting Started: Basic LLM Calls](./01-basic-llm-calls.md)**
    *   Setting up environment variables.
    *   Making your first call with `generateIntelligence`.
    *   Using different providers and expert models.
    *   Handling JSON vs. text responses.
    *   Understanding token usage and cost output.
    *   Basic error handling.

2.  **[Building a Simple RAG Pipeline](./02-simple-rag-pipeline.md)**
    *   Setting up ChromaDB (or using in-memory).
    *   Embedding a single document (`loadAndEmbedFile`).
    *   Querying with `askWithRetrieval` via `DaitanOrchestrator`.
    *   Inspecting retrieved sources.

3.  **[Advanced RAG: Multiple Files and Options](./03-advanced-rag.md)**
    *   Embedding a directory of files.
    *   Using different file loaders (.pdf, .docx, .md).
    *   Customizing RAG retrieval (topK, filters).
    *   Exploring HyDE (Hypothetical Document Embeddings).

4.  **[Creating and Using a Simple Agent](./04-simple-agent.md)**
    *   Extending `BaseAgent`.
    *   Using `LLMService` within an agent.
    *   Running the agent via `DaitanOrchestrator`.

5.  **[Creating a Tool-Using Agent](./05-tool-using-agent.md)**
    *   Defining a custom tool with `createDaitanTool`.
    *   Setting up an agent with `runDaitanAgent` (LangChain AgentExecutor).
    *   Observing agent thought process and tool usage (requires verbose logging or LangSmith).

6.  **[Building a Basic LangGraph Workflow](./06-basic-langgraph.md)**
    *   Defining a state schema with `DaitanLangGraph`.
    *   Adding nodes and edges.
    *   Compiling and running the graph with `createGraphRunner`.
    *   Using the in-memory checkpointer for simple state persistence.

7.  **[Working with Prompts (`promptManager`)](./07-prompt-manager.md)**
    *   Registering chat and string prompts.
    *   Formatting prompts with dynamic values.
    *   Listing available prompts.

8.  **[Streaming LLM Responses](./08-streaming-responses.md)**
    *   Using `generateIntelligence` with `callbacks` for streaming.
    *   Using `LLMService.streamText`.
    *   Integrating streamed responses into a simple UI concept.

9.  **[Configuration and Expert Models](./09-configuration.md)**
    *   Understanding `configManager`.
    *   Overriding default LLM providers and models.
    *   Defining and using "Expert Model" profiles.

10. **[Tracing with LangSmith](./10-langsmith-tracing.md)**
    *   Setting up LangSmith environment variables.
    *   Viewing traces for `generateIntelligence`, RAG, and agent runs.



IGNORE_WHEN_COPYING_START
Use code with caution.
IGNORE_WHEN_COPYING_END

File Path: docs/tutorials/README.md
Task Number: 14 (Partial - Tutorials Outline)

This covers the main documentation structure. Actually writing all the detailed tutorials and ensuring JSDoc coverage is comprehensive across all modules would be a larger, ongoing effort alongside development. The JSDoc comments we've been adding to the code modules are the primary source for API documentation, which can then be generated using tools like TypeDoc (if you switch to TS) or jsdoc-to-markdown and then to HTML.
````
