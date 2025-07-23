README.md file for the new @daitanjs/cli package.

This README is designed to be clear, user-friendly, and thorough. It covers installation, basic usage, global options, and provides detailed examples for every single command and subcommand we have created. It serves as the primary documentation for developers looking to use the DaitanJS command-line tool.

      
# @daitanjs/cli

A comprehensive command-line interface for interacting with and managing the DaitanJS ecosystem.

The DaitanJS CLI is a powerful tool designed to streamline development, testing, and management of applications built with the DaitanJS framework. It provides direct command-line access to the functionalities of various DaitanJS packages, from AI and RAG to data management and communication.

## Features

- **Project Scaffolding**: Quickly initialize new DaitanJS projects with a standard structure and `.env` file.
- **AI Interaction**: Chat directly with LLMs or run complex, multi-step AI agents.
- **RAG Management**: Build, query, and manage your Retrieval-Augmented Generation knowledge bases.
- **Environment & Config**: Check service health and view your entire resolved DaitanJS configuration.
- **Service Utilities**: Send test emails/SMS, generate images, perform geocoding, transcribe audio, and more, directly from your terminal.
- **Interactive & User-Friendly**: Uses spinners for feedback on long-running tasks and interactive prompts for critical operations.

## Installation

To use the DaitanJS CLI, you can install it globally via npm (once it's published to a registry):

```bash
npm install -g @daitanjs/cli

    
Use code with caution. Markdown
IGNORE_WHEN_COPYING_END

For development within the DaitanJS monorepo, you can run the CLI directly after building the packages:

      
# From the monorepo root
npm install
npm run build # Or build the specific cli package

# Then run commands from the monorepo root like this:
node packages/cli/dist/index.cjs --help

    


You can also create a symlink for easier access during development:

      
# From within the packages/cli directory
npm link

    

Basic Usage

The main command is daitan. You can see a list of all available commands by running:

      
daitan --help

    

Global Options

These options can be used with any command:

    -v, --version: Display the current version of the CLI.

    --verbose: Enable detailed, debug-level logging for the command's execution. This is extremely useful for troubleshooting.

    -e, --env <path>: Specify a path to a custom .env file to load for the command.

Command Reference

Here is a detailed list of all available commands and their usage.
init

Scaffolds a new DaitanJS project.

Usage: daitan init [projectName]

    projectName (optional): The name of the directory to create for the project. Defaults to daitanjs-project.

Options:

    --force: Overwrites an existing .env file in the target directory without prompting.

Example:

      
# Create a new project in a directory named "my-ai-app"
daitan init my-ai-app

    


This will create a directory structure, a package.json, a starter src/index.js, and a comprehensive .env template for you to fill in.
check

Runs diagnostics on your environment to ensure DaitanJS services and dependencies are configured correctly.

Usage: daitan check

Example:

      
daitan check

    


Output will show the status of OpenAI keys, ChromaDB/Ollama connections, Firebase Admin credentials, etc.
config

Displays the currently active configuration, resolved from all .env files and internal defaults. Sensitive values are automatically masked.

Usage: daitan config

Example:

      
daitan config

    


This is the best way to verify which settings (e.g., LLM_PROVIDER, CHROMA_HOST) are being used by the CLI and other DaitanJS packages.
ai

Interact with Large Language Models and AI agents.
ai chat

Start an interactive, multi-turn chat session with an LLM.

Usage: daitan ai chat [options]

Options:

    -p, --provider <name>: Specify the LLM provider or expert profile (e.g., openai, FAST_TASKER).

    -m, --model <name>: Specify a specific model name (e.g., gpt-4o).

Example:

      
daitan ai chat --provider "MASTER_CODER"

    

ai agent

Run a pre-defined agentic workflow.

Usage: daitan ai agent <type> <query>

    type: The agent workflow type. Supported: plan (Plan-and-Execute), react (ReAct with Reflection).

    query: The high-level task or question for the agent to solve.

Example:

      
# Ask the ReAct agent to find and calculate something
daitan ai agent react "What is the square root of the number of moons of Jupiter?"

    

rag

Manage and query your RAG knowledge base.
rag add

Load and embed a document into a collection.

Usage: daitan rag add <filePath> [options]

    filePath: Path to the file (.pdf, .docx, .txt, etc.) or directory to ingest.

Options:

    -c, --collection <name>: The target collection name. Defaults to daitan_rag_default_store.

    --chunk-size <number>: Size of document chunks (default: 1000).

    --chunk-overlap <number>: Overlap between chunks (default: 200).

Example:

      
daitan rag add ./my-research-paper.pdf --collection "science_papers"

    

rag query

Ask a question against a collection.

Usage: daitan rag query "<question>" [options]

Options:

    -c, --collection <name>: The collection to query.

    --top-k <number>: Number of context documents to retrieve (default: 5).

    --hyde: Use Hypothetical Document Embeddings to improve the query.

Example:

      
daitan rag query "What were the main conclusions of the study?" --collection "science_papers"

    

rag stats

Display statistics for a collection.

Usage: daitan rag stats [options]

Options:

    -c, --collection <name>: The collection to inspect.

    --limit <number>: Number of sample documents to show (default: 3).

Example:

      
daitan rag stats --collection "science_papers"

    

rag reset

Deletes all data from a collection. This is a destructive operation.

Usage: daitan rag reset [options]

Options:

    -c, --collection <name>: The collection to reset.

    --force: Bypass the interactive confirmation prompt.

Example:

      
daitan rag reset --collection "test_collection" --force

    

security

Generate tokens and perform other security-related tasks.
security generate-token

Generate a JSON Web Token (JWT).

Usage: daitan security generate-token [options]

Options:

    -p, --payload <json>: (Required) The JSON payload as a string.

    -s, --secret <key>: The secret key. Defaults to the JWT_SECRET environment variable.

    -e, --expires-in <duration>: Token expiration (e.g., 1h, 7d). Default: 1h.

Example:

      
daitan security generate-token -p '{"userId": "12345", "role": "admin"}' -e "7d"



queue

Interact with and monitor the background job queues powered by BullMQ.
queue dashboard

Launches a local web server to host the Bull-Board UI, providing a comprehensive dashboard to inspect and manage all known job queues (e.g., mail-queue).

Usage: daitan queue dashboard [options]

Options:

    -p, --port <port>: The port to run the dashboard on. Defaults to 4000.

Example:

      
# Start the dashboard on the default port 4000
daitan queue dashboard

# Start the dashboard on a custom port
daitan queue dashboard --port 9999


After running the command, open http://localhost:<port>/ui in your browser to view the dashboard. This is an invaluable tool for debugging background tasks, inspecting failed jobs, and observing queue health.



    Other Utility Commands

    daitan speech tts "<text>": Synthesize text to an MP3 file.

        --output <path>: Specify output file path.

        --provider <name>: Use google or elevenlabs.

    daitan speech stt <audioFilePath>: Transcribe an audio file to text.

        --output <path>: Save transcription to a file.

        --format <format>: Output format (text, json, srt, etc.).

    daitan image upload <filePath>: Upload an image to cloud storage.

        --provider <name>: Use firebase or cloudinary.

        --prefix <path>: Cloud storage folder/prefix.

    daitan senses generate-image "<prompt>": Generate an image using DALL-E.

        --output <path>: Path to save the .png file.

    daitan senses analyze-image <imagePath> "<prompt>": Analyze an image with a text prompt.

    daitan geo forward "<address>": Get coordinates for an address.

    daitan geo reverse <lon> <lat>: Get an address from coordinates.

    daitan data query <type> "<query>": Query a file store (csv or json).

    daitan comm send-email / send-sms: Send test communications to verify credentials.

This CLI provides a comprehensive suite of tools to accelerate your development with the DaitanJS ecosystem. For more details on any command, run daitan <command> --help.