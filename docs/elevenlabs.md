# ElevenLabs Conversational AI Documentation

> Docs: [elevenlabs.io/docs](https://elevenlabs.io/docs)
> ElevenAgents overview: [elevenlabs.io/docs/eleven-agents/overview](https://elevenlabs.io/docs/eleven-agents/overview)
> API Reference: [elevenlabs.io/docs/api-reference/introduction](https://elevenlabs.io/docs/api-reference/introduction)
> GitHub: [github.com/elevenlabs/elevenlabs-js](https://github.com/elevenlabs/elevenlabs-js)

## Installation

### Node.js SDK (Server-Side)

```bash
npm install @elevenlabs/elevenlabs-js
# or
yarn add @elevenlabs/elevenlabs-js
```

Requires [MPV](https://mpv.io/) and [ffmpeg](https://ffmpeg.org/) for audio playback.

### Browser SDK (Client-Side Conversations)

```bash
npm install @elevenlabs/client
```

### React SDK

```bash
npm install @elevenlabs/react
```

## Authentication

All API calls require an API key. Set via environment variable or pass directly:

```typescript
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const elevenlabs = new ElevenLabsClient({
  apiKey: "YOUR_API_KEY", // Defaults to process.env.ELEVENLABS_API_KEY
});
```

**IMPORTANT**: Never expose your ElevenLabs API key on the client side. For browser-based conversations, use signed URLs (see below).

## ElevenAgents Platform Overview

ElevenAgents is a platform for building voice-enabled agents. It coordinates four components:

1. **Speech Recognition (ASR)**: Fine-tuned model for accurate speech-to-text
2. **Language Model**: Your choice of LLM or custom model
3. **Text-to-Speech (TTS)**: Low-latency synthesis, 5,000+ voices, 70+ languages
4. **Turn-Taking Model**: Proprietary system managing conversation timing and flow

### Platform Capabilities

- **Workflows**: Multi-step conversation builder with visual interface
- **System Prompts**: Configurable agent instructions
- **Knowledge Base**: Document upload with RAG capabilities
- **Tools Integration**: Server tools (webhooks), client tools, system tools
- **Voice Selection**: 5,000+ voices across 31 languages
- **Personalization**: Dynamic variables and conversation-specific overrides

## Text-to-Speech API

### Basic Conversion

```typescript
const audio = await elevenlabs.textToSpeech.convert("Xb7hH8MSUJpSbSDYk0k2", {
  text: "Hello! Welcome to AgentFund.",
  modelId: "eleven_multilingual_v2",
});

await play(audio);
```

### Streaming Audio

```typescript
import { ElevenLabsClient, stream } from "@elevenlabs/elevenlabs-js";

const audioStream = await elevenlabs.textToSpeech.stream("JBFqnCBsd6RMkjVDRZzb", {
  text: "This is a... streaming voice",
  modelId: "eleven_multilingual_v2",
});

stream(audioStream);
```

### Available Models

| Model | ID | Languages | Notes |
|-------|-----|-----------|-------|
| Eleven Multilingual v2 | `eleven_multilingual_v2` | 29 | Recommended default |
| Eleven Flash v2.5 | `eleven_flash_v2_5` | 32 | Ultra-low latency, 50% lower cost |
| Eleven Turbo v2.5 | `eleven_turbo_v2_5` | 32 | Quality/latency balance |

## Conversational AI -- WebSocket API

### WebSocket Connection

```
wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_id}
```

For public agents, use the `agent_id` directly in the URL without additional authentication.

### Connection Flow

1. Establish WebSocket connection
2. Send `conversation_initiation_client_data` message with optional overrides
3. Receive `conversation_initiation_metadata` with `conversation_id` and audio format info
4. Begin audio streaming

### Audio Format

- Input: 16kHz, 16-bit PCM, base64 encoded
- Sent as `user_audio_chunk` messages
- Server returns audio chunks after ASR -> LLM -> TTS pipeline

### Client SDK Usage (`@elevenlabs/client`)

```typescript
import { Conversation } from "@elevenlabs/client";

// For public agents (no auth needed)
const conversation = await Conversation.startSession({
  agentId: "<your-agent-id>",
  onConnect: () => {
    console.log("WebSocket connection established");
  },
  onDisconnect: () => {
    console.log("WebSocket connection ended");
  },
  onMessage: (message) => {
    console.log("New message:", message);
  },
  onError: (error) => {
    console.error("Error:", error);
  },
});
```

### Using Signed URLs (Private/Authorized Agents)

For private agents requiring authorization, request a signed URL server-side:

```typescript
// Server-side: Get signed URL
const response = await fetch(
  `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${AGENT_ID}`,
  {
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
    },
  }
);
const { signed_url } = await response.json();

// Client-side: Start session with signed URL
const conversation = await Conversation.startSession({
  signedUrl: signed_url,
  connectionType: "websocket",
  onConnect: () => console.log("Connected"),
  onDisconnect: () => console.log("Disconnected"),
  onMessage: (msg) => console.log(msg),
  onError: (err) => console.error(err),
});
```

### Client Tools

Client tools enable agents to invoke client-side functionality (e.g., opening a modal, making API calls on behalf of the user).

```typescript
const conversation = await Conversation.startSession({
  agentId: "<your-agent-id>",
  clientTools: {
    // Tool name must match what's configured in ElevenLabs UI
    openModal: async (params) => {
      // params come from the agent's tool call
      document.getElementById("modal").style.display = "block";
      return "Modal opened successfully"; // Return value sent back to agent
    },
    fetchUserData: async (params) => {
      const data = await fetch(`/api/user/${params.userId}`);
      return await data.json();
    },
  },
  onConnect: () => console.log("Connected"),
  onDisconnect: () => console.log("Disconnected"),
});
```

## Tools System

Tools allow agents to interact with external systems during conversations.

### Tool Types

| Type | Description | Execution |
|------|-------------|-----------|
| **Server Tools (Webhooks)** | Connect to external APIs via webhooks | Server-side |
| **Client Tools** | Interact with user's browser/device | Client-side |
| **System Tools** | Built-in, ready to use immediately | Platform |

### Server Tools (Webhooks)

Configure via the ElevenLabs UI or API. The agent dynamically generates query, body, and path parameters based on conversation context and your parameter descriptions.

Server tools make HTTP requests to your webhook endpoints. Configure:
- URL endpoint
- HTTP method
- Request headers (including auth)
- Body/query parameter schemas with descriptions
- Response handling

### Post-Call Webhooks

Trigger automated workflows after a call ends. Three distinct webhook types with different data structures containing:
- Full transcripts
- Analysis results
- Metadata

## Voice Management

```typescript
// List available voices
const voices = await elevenlabs.voices.search();
```

## Response Metadata

Track costs and requests via HTTP headers:

```typescript
const { data, rawResponse } = await client.textToSpeech
  .convert('voice_id', {
    text: 'Hello, world!',
    modelId: 'eleven_multilingual_v2',
  })
  .withRawResponse();

const charCost = rawResponse.headers.get('x-character-count');
const requestId = rawResponse.headers.get('request-id');
```

## Retry Configuration

Automatic retries with exponential backoff on: 408, 409, 429, 5XX errors.

```typescript
const response = await elevenlabs.voices.search({}, {
  maxRetries: 2,       // Default: 2
  timeoutInSeconds: 30 // Default: 60
});
```

## Deployment Options

- React components and UI library
- Web widget embedding
- Native iOS (Swift SDK) and Android (Kotlin SDK)
- React Native for cross-platform
- SIP trunk integration for telephony
- Twilio native integration
- WebSocket API for custom implementations
- Batch outbound call capability

## Runtime Compatibility

- Node.js 15+
- Vercel
- Cloudflare Workers
- Deno v1.25+
- Bun 1.0+

## Monitoring & Optimization

- A/B testing and experiments
- Automated agent behavior testing
- Conversation quality analysis
- Analytics and performance tracking
- Real-time monitoring via WebSocket for live call observation
- LLM cost optimization tools
