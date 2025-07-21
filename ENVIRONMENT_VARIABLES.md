// ENVIRONMENT_VARIABLES.md
# DaitanJS Monorepo Environment Variables

This document provides a comprehensive list of all environment variables used across the DaitanJS monorepo. It is crucial for setting up a development or production environment. For local development, these variables can be set in `.env` files (e.g., `.env.local`).

---

## 🔑 Core API Keys & Credentials

These are essential for connecting to third-party services. Most are **required** for the corresponding package to function correctly.

| Variable | Package(s) | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `OPENAI_API_KEY` | `intelligence`, `senses`, `speech`, `embeddings` | **Yes** | API key for OpenAI services (GPT models, DALL-E, Whisper, Embeddings). | `sk-...` |
| `ANTHROPIC_API_KEY` | `intelligence` | Optional | API key for Anthropic's Claude models. | `sk-ant-...` |
| `GROQ_API_KEY` | `intelligence` | Optional | API key for Groq's high-speed inference services. | `gsk_...` |
| `YOUTUBE_API_KEY` | `media` | **Yes** | API key for the YouTube Data API v3. Used for searching and fetching video/channel data. | `AIzaSy...` |
| `STRIPE_SECRET_KEY` | `payments` | **Yes** | Secret key for the Stripe API. Must be a secret key (`sk_...`). | `sk_test_...` |
| `MAPBOX_TOKEN` | `geo` | **Yes** | API token for Mapbox services, used for geocoding. | `pk.eyJ...` |
| `TWILIO_ACCOUNTSID` | `communication` | **Yes** | Account SID for the Twilio API, used for SMS/WhatsApp. | `AC...` |
| `TWILIO_AUTHTOKEN` | `communication` | **Yes** | Auth Token for the Twilio API. | `...` |
| `GOOGLE_API_KEY` / `GOOGLE_API_KEY_SEARCH` | `web` | **Yes** | API key for Google Custom Search Engine (CSE) API. `GOOGLE_API_KEY_SEARCH` is preferred. | `AIzaSy...` |
| `GOOGLE_CSE_ID` | `web` | **Yes** | Your Google Custom Search Engine ID (CX ID). | `...` |
| `AWS_REGION` | `images` | **Yes** | AWS region for the S3 bucket (e.g., `us-east-1`). | `us-west-2` |
| `AWS_ACCESS_KEY_ID` | `images` | **Yes** | AWS Access Key ID for S3 access. | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | `images` | **Yes** | AWS Secret Access Key for S3 access. | `...` |
| `B2_KEY_ID` | `images` | **Yes** | Key ID for Backblaze B2 Application Key. | `...` |
| `B2_APPLICATION_KEY` | `images` | **Yes** | Application Key for Backblaze B2. | `...` |
| `GOOGLE_APPLICATION_CREDENTIALS` | `speech` | **Yes** | Path to your Google Cloud service account JSON key file, or the JSON content itself. Used for Google Cloud TTS. | `/path/to/your/keyfile.json` |

---

## 🤖 LLM & AI Service Configuration

These variables control the behavior of the `@daitanjs/intelligence` package and other AI-powered modules.

| Variable | Package(s) | Required? | Description | Default / Example |
| :--- | :--- | :--- | :--- | :--- |
| `LLM_PROVIDER` | `intelligence` | Optional | Default LLM provider to use. | `openai` |
| `LLM_MODEL` | `intelligence` | Optional | Default global model name. Usually better to rely on expert profiles. | `gpt-4o-mini` |
| `DEFAULT_EXPERT_PROFILE` | `intelligence` | Optional | Name of the default expert profile to use from `expertModels.js`. | `FAST_TASKER` |
| `LLM_PROVIDER_EXPERT_*` | `intelligence` | Optional | Overrides the provider for a specific expert profile. e.g., `LLM_PROVIDER_EXPERT_MASTER_CODER=groq` | `openai` |
| `LLM_MODEL_EXPERT_*` | `intelligence` | Optional | Overrides the model for a specific expert profile. e.g., `LLM_MODEL_EXPERT_MASTER_CODER=llama3-70b-8192` | `gpt-4-turbo` |
| `OPENAI_VISION_MODEL` | `senses` | Optional | Default model for image analysis tasks. | `gpt-4o-mini` |
| `OLLAMA_BASE_URL` | `intelligence` | Optional | Base URL for a local Ollama server instance. | `http://localhost:11434` |
| `LANGCHAIN_TRACING_V2` | `intelligence` | Optional | Set to `"true"` to enable LangSmith tracing. | `false` |
| `LANGCHAIN_API_KEY` | `intelligence` | Optional | API key for LangSmith tracing service. | `ls__...` |
| `LANGCHAIN_PROJECT` | `intelligence` | Optional | Project name to log traces under in LangSmith. | `DaitanJS-Intelligence-Project` |

---

## 📦 Package-Specific Configuration

Variables that configure specific DaitanJS packages.

| Variable | Package(s) | Required? | Description | Default / Example |
| :--- | :--- | :--- | :--- | :--- |
| `YT_DLP_PATH` | `media` | Optional | Full path to the `yt-dlp` executable if it's not in the system's PATH. | `/usr/local/bin/yt-dlp` |
| `S3_BUCKET_NAME` | `images` | **Yes** | The name of the AWS S3 bucket for image uploads. | `my-daitan-app-images` |
| `B2_BUCKET_ID` | `images` | **Yes** | The ID of the Backblaze B2 bucket for image uploads. | `...` |
| `CLOUDINARY_CLOUD_NAME` | `images` | **Yes** | Your Cloudinary account's cloud name. | `my-cloud` |
| `CLOUDINARY_UPLOAD_PRESET` | `images` | Optional | The name of an unsigned upload preset in Cloudinary. | `unsigned_preset_1` |
| `FIREBASE_*` | `authentication`, `images` | **Yes** | Set of `FIREBASE_*` variables for Firebase SDK config (`apiKey`, `authDomain`, `projectId`, `storageBucket`, etc.). | See Firebase console |
| `TWILIO_SENDER` | `communication` | **Yes** | Your Twilio phone number or Messaging Service SID for sending SMS. | `+15551234567` |
| `TWILIO_WHATSAPP_SENDER` | `communication` | Optional | Sender ID for WhatsApp. Defaults to `TWILIO_SENDER`. | `+14155238886` |
| `MAIL_SERVER_HOST` | `communication` | **Yes** | Hostname of your SMTP server. | `smtp.example.com` |
| `MAIL_SERVER_PORT` | `communication` | **Yes** | Port number for your SMTP server. | `587` |
| `MAIL_SMTP_USER` | `communication` | **Yes** | Username for SMTP authentication. | `user@example.com` |
| `MAIL_SMTP_PASS` | `communication` | **Yes** | Password for SMTP authentication. | `...` |
| `MAIL_FROM_ADDRESS` | `communication` | Optional | Default "From" email address for outgoing mail. | `noreply@example.com` |
| `MAIL_RECIPIENT_OVERRIDE` | `communication` | Optional | In development, all emails will be sent to this address instead of the intended recipient. | `dev@example.com` |
| `CHAR_STORAGE_FILE_PATH` | `data` | Optional | Path to the file for the `char` storage utility. | `/data/char_store.txt` |
| `JSON_STORE_DEFAULT_PATH` | `data` | Optional | Path to the file for the `jsonstore` utility. | `/data/json_store.ldjson` |
| `CSV_SQL_DIRECTORY` | `data` | Optional | Directory for storing `CSVSQL` tables. | `/data/csv_tables/` |

---

## ⚙️ Development & Debugging

These variables control logging levels and other development-time behaviors.

| Variable | Package(s) | Required? | Description | Default / Example |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | `development`, `communication` | Optional | Set to `development` or `production`. Affects default log levels and other behaviors. | `development` |
| `LOG_LEVEL` | `development` | Optional | Global log level for all DaitanJS loggers. | `info` |
| `LOG_LEVEL_CONSOLE` | `development` | Optional | Overrides global log level specifically for the console transport. | `debug` |
| `LOG_LEVEL_FILE` | `development` | Optional | Overrides global log level specifically for file transports. | `info` |
| `LOG_PATH` | `development` | Optional | Directory to store log files. | `./daitan_logs` |
| `DEBUG_INTELLIGENCE` | `intelligence` | Optional | Master flag to enable verbose logging across the `@daitanjs/intelligence` package. | `true` |
| `DEBUG_AGENT` | `intelligence` | Optional | Enable verbose logging for agent operations. | `true` |
| `DEBUG_LANGGRAPH` | `intelligence` | Optional | Enable verbose logging for LangGraph operations. | `true` |
| `RAG_VERBOSE` | `intelligence` | Optional | Master flag for verbose RAG logging. | `true` |