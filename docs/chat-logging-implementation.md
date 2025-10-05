# Chat Logging Implementation

## Overview

This document describes the implementation of the chat logging system in the application. The system logs chat questions and answers to a file for record-keeping and analysis purposes.

## Implementation Details

### Logger Service

The chat logging functionality is implemented in `server/services/logger.js`. This service:

1. Creates a log directory if it doesn't exist
2. Creates a log file if it doesn't exist
3. Formats log entries with timestamp, question, and answer
4. Writes log entries to the file

### Log Format

Each log entry follows this format:

```
[timestamp] | Question: [question] | Answer: [answer]
```

Example:

```
2025-03-04T17:22:40.579Z | Question: test question | Answer: Okay, I'm ready. What's the test question? I'll do my best to answer it accurately and thoroughly.
```

### API Integration

Chat logging hooks live inside the hardened gateway (`server/main.js`). Requests to `/api/gemini/generateContent` and `/api/v2/chat` are processed server-side; once the Gemini/OpenAI/Anthropic providers respond, the gateway extracts the prompt and answer and persists them via the logger service.

### Environment Variables

The API key for the Gemini API is stored in the `.env` file and loaded using the `dotenv` package. This ensures that sensitive information is not hardcoded in the application.

## Usage

The chat logging happens automatically whenever a request is made to the `/api/gemini/generateContent` endpoint. The logs are stored in `server/logs/chat.log`.

## Maintenance

To maintain the logging system:

1. Monitor the log file size and implement log rotation if needed
2. Ensure the log directory has sufficient disk space
3. Consider implementing log analysis tools to extract insights from the logs

## Future Improvements

Potential improvements to the logging system:

1. Add IP address logging to track usage patterns
2. Implement log rotation to prevent the log file from growing too large
3. Add more metadata to log entries (e.g., user agent, session ID)
4. Create a log viewer interface for easier analysis
