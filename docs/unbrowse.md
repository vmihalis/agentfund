# Unbrowse Documentation

> Source: [github.com/unbrowse-ai/unbrowse](https://github.com/unbrowse-ai/unbrowse)
> Website: [unbrowse.ai](https://www.unbrowse.ai)
> Skill docs: [unbrowse.ai/skill.md](https://www.unbrowse.ai/skill.md)

## Overview

Unbrowse is a CLI tool that transforms websites into reusable API interfaces for AI agents. It captures network traffic, reverse-engineers underlying API endpoints, and publishes learned skills to a shared marketplace. "One agent learns a site once. Every later agent gets the fast path."

**Performance**: 100x faster per page (5-30s for headless browsers vs 50-200ms for API calls), 40x fewer tokens (~200 vs ~8,000 for HTML scraping).

## Installation

### Fastest Setup

```bash
npx unbrowse setup
```

This command:
- Downloads the CLI on demand
- Installs browser assets for live capture
- Prompts for email-shaped agent identity registration
- Registers the Open Code `/unbrowse` command (when detected)
- Starts the local server automatically

### For Daily Use

```bash
npm install -g unbrowse
unbrowse setup
```

### For Agent Hosts with Skills Support

```bash
npx skills add unbrowse-ai/unbrowse
```

**Compatibility**: Works with Claude Code, Open Code, Cursor, Codex, Windsurf, and any agent platform supporting local CLI or skill calls.

## Setup Details

The `unbrowse setup` command:
- Validates local npm/npx prerequisites
- Installs headless browser assets required for traffic capture
- Registers Open Code `/unbrowse` command (when Open Code is detected)
- Launches the local Unbrowse server (skip with `--no-start` flag)

## Common CLI Commands

```bash
unbrowse health                                                      # Health check
unbrowse resolve --intent "get trending searches" --url "https://google.com" --pretty
unbrowse login --url "https://calendar.google.com"                   # Interactive login
unbrowse skills                                                       # List skills
unbrowse search --intent "get stock prices"                          # Search marketplace
```

## API Reference

### Core Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/v1/intent/resolve` | Search marketplace, capture if needed, execute |
| POST | `/v1/skills/:id/execute` | Run a specific skill |
| POST | `/v1/auth/login` | Interactive browser login |
| POST | `/v1/auth/steal` | Import cookies from browser/Electron storage |
| POST | `/v1/search` | Semantic search across all domains |
| POST | `/v1/search/domain` | Semantic search scoped to specific domain |
| POST | `/v1/feedback` | Submit feedback (affects reliability scores) |
| POST | `/v1/skills/:id/verify` | Health check for skill endpoints |
| POST | `/v1/skills/:id/issues` | Report broken skill |
| GET | `/v1/skills` | List all marketplace skills |
| GET | `/v1/stats/summary` | Platform statistics |
| GET | `/health` | Health check |

### POST /v1/intent/resolve (Primary Endpoint)

The main orchestration endpoint that handles the complete discover-learn-execute pipeline in one call.

**Base URL**: `http://localhost:6969` (default)

**Request Body**:

```json
{
  "intent": "get my dashboard data",
  "params": { "url": "https://example.com/dashboard" },
  "context": { "url": "https://example.com" }
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `intent` | string | Yes | Natural language description of desired action |
| `url` | string | Yes | Target website URL |
| `dry_run` | boolean | No | Preview mutations without execution |
| `confirm_unsafe` | boolean | No | Explicit consent for non-GET operations (POST/PUT/DELETE) |
| `pretty` | boolean | No | Format output for readability |

**CLI Usage**:

```bash
unbrowse resolve --intent "search stays" --url "https://www.airbnb.com/s/Tokyo--Japan/homes"
unbrowse resolve --intent "get trending searches" --url "https://google.com" --pretty
```

**Resolution Pipeline Priority**:

1. **Route cache (5-min TTL)** -- instant hit if same intent was recently resolved
2. **Marketplace search** -- semantic vector search ranked by composite score:
   - 40% embedding similarity
   - 30% reliability
   - 15% freshness
   - 15% verification status
3. **Live capture** -- headless browser records network traffic, reverse-engineers endpoints, publishes new skill
4. **DOM fallback** -- extracts structured data from rendered HTML for static/SSR sites

**Mutation Safety**: GET operations execute automatically. POST/PUT/DELETE require explicit confirmation:

```bash
# Preview without executing
--dry_run true

# Confirm to proceed with mutation
--confirm_unsafe true
```

## Authentication

### Auto Cookie Resolve (Default)
Unbrowse reads cookies directly from Chrome or Firefox SQLite databases. Requires being logged into the target site in your browser. Fresh cookies are resolved on every call.

### Yolo Mode
Opens Chrome with your real user profile. Best for sites with complex authentication (OAuth popups, 2FA).

### Interactive Login
```bash
unbrowse login --url "https://calendar.google.com"
```
Launches a headed browser for manual login when auto-resolve has no cached credentials.

### Auth Header Handling
- CSRF tokens, API keys, and authorization headers are captured during browsing
- Stored in encrypted vault (`~/.unbrowse/vault/`)
- Server-side fetches replay these automatically
- Cross-domain auth handled transparently
- Stale credentials (401/403) are auto-deleted

## Configuration

### Runtime Directories

```
~/.unbrowse/config.json              # API key, agent ID, registration
~/.unbrowse/vault/credentials.enc    # Encrypted credential store
~/.unbrowse/vault/.key               # Encryption key (mode 0o600)
~/.unbrowse/skill-cache/             # Local skill manifest cache
~/.unbrowse/profiles/<domain>/       # Per-domain Chrome profiles
~/.unbrowse/logs/unbrowse-YYYY-MM-DD.log  # Daily logs
```

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `6969` | Server port |
| `HOST` | `127.0.0.1` | Server bind address |
| `UNBROWSE_URL` | `http://localhost:6969` | Base URL for API calls |
| `UNBROWSE_API_KEY` | auto-generated | API key override |
| `UNBROWSE_AGENT_EMAIL` | -- | Email-style agent name for registration |
| `UNBROWSE_TOS_ACCEPTED` | -- | Accept ToS non-interactively |
| `UNBROWSE_NON_INTERACTIVE` | -- | Skip readline prompts |

### Headless / Non-Interactive Setup

For CI or non-interactive environments, set `UNBROWSE_AGENT_EMAIL` to skip identity prompts.

## Skill Lifecycle

**States**:
- **active** -- Published, queryable, executable
- **deprecated** -- Low reliability (auto-triggered after 3+ consecutive failures)
- **disabled** -- Endpoint down (failed verification)

Background verification runs every 6 hours, executing safe GET endpoints to detect failures and schema drift.

## Architecture

```
src/
├── index.ts              # Fastify server entrypoint (port 6969)
├── api/routes.ts         # HTTP route definitions
├── orchestrator/         # Intent resolution pipeline
├── execution/            # Skill/endpoint execution + retry logic
├── capture/              # Headless browser traffic recording
├── reverse-engineer/     # HAR parsing -> endpoint extraction
├── extraction/           # DOM structured data extraction
├── marketplace/          # Backend API client (beta-api.unbrowse.ai)
├── client/               # Agent registration & config management
├── auth/                 # Interactive login + cookie extraction
├── vault/                # Encrypted credential storage (AES-256-CBC)
├── transform/            # Field projection + schema drift detection
├── verification/         # Periodic endpoint health checks
├── ratelimit/            # Request throttling
├── types/                # TypeScript type definitions
├── domain.ts             # Domain utilities
└── logger.ts             # Logging
```

## Performance

- First-time capture/indexing: 20-80 seconds (slow path)
- Subsequent executions via marketplace/cache: <1 second
- Marketplace cache: 5-minute TTL for route results

## Security

- Capture and execution stay local by default
- Credentials stay on your machine
- Learned API contracts are published to the shared marketplace only after capture
- Credentials encrypted using AES-256-CBC
- Encryption keys stored with restricted permissions (mode 0o600)

## License

AGPL-3.0
