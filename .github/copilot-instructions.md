# FCP FDM Workspace Instructions

## Architecture

The Farming Data Model (FDM) service is an event-driven Node.js application that:
1. Polls an AWS SQS queue for CloudEvents, processes and validates them, and upserts aggregated data into MongoDB.
2. Exposes a REST API (Hapi) to query the aggregated data.

**Key layers (all in `src/`):**

| Directory | Purpose |
|---|---|
| `events/` | Polling, consuming, parsing, validating, saving events |
| `events/save/` | One file per event category (`message.js`, `payment.js`, etc.) — each handles upsert logic |
| `events/save/pipeline.js` | Shared MongoDB update-pipeline builder for conditional/timestamped upserts |
| `events/schemas/` | Joi schemas for each event category |
| `events/types.js` | Maps CloudEvent `type` prefixes to internal categories |
| `projections/` | MongoDB read projections / repository pattern per entity |
| `routes/` | Hapi route handlers (thin, delegate to projections) |
| `plugins/` | Hapi plugins: `auth.js`, `router.js`, `swagger.js`, `mongo-timeout.js` |
| `config/config.js` | Convict-based config — all env vars defined here with validation |
| `common/helpers/` | Shared utilities: logging, MongoDB connection, pagination, metrics, etc. |

## Build and Test

```bash
# Run tests (coverage)
npm docker:test                # TZ=UTC vitest run --coverage

# Watch mode
npm run docker:test:watch      # TZ=UTC vitest

# Lint
npm run lint
npm run lint:fix

# Local dev (requires Docker)
npm run docker:dev      # Spins up MongoDB, Floci, event-publisher-stub

# Send test events locally
node ./scripts/send-events.js                          # List scenarios
node ./scripts/send-events.js single.messageRequest    # Send one event
node ./scripts/send-events.js streams.messageSuccessful
```

## Code Style

- **ES Modules only** — `import`/`export` everywhere; `"type": "module"` in `package.json`.
- **Linter**: ESLint + neostandard (modern nested Node.js preset). No semicolons, single quotes.
- **Async/await** throughout — never callbacks or raw `.then()` chains.
- **Structured logging** with Pino. Log with context objects: `logger.info({ key: value }, 'message')`.

## Conventions

### Adding a new event type

1. Add the prefix mapping in `src/events/types.js`.
2. Create a Joi schema at `src/events/schemas/<type>.js`.
3. Create a save handler at `src/events/save/<type>.js`. Use `buildSavePipeline` from `pipeline.js` for conditional upserts.
4. Register the handler in `src/events/save.js`.
5. Add a projection at `src/projections/<type>.js` and a route at `src/routes/<type>.js`.
6. Add test coverage mirroring the `test/unit/events/save/` and `test/scenarios/events/` patterns.

### MongoDB update pipeline pattern

Save handlers use MongoDB aggregation **update pipelines** (array of `$set`/`$unset` stages) rather than `$set`/`$push` operators. This enables conditional logic inside a single atomic update. See `src/events/save/pipeline.js` and `src/events/save/payment.js` for examples.

### Configuration

All environment variables must be declared in `src/config/config.js` using Convict. Access via `config.get('path.to.key')`. Never read `process.env` directly outside of the config file.

## Testing

- **Framework**: Vitest with globals enabled (`describe`, `test`, `expect` — no imports needed).
- **Unit tests**: Mirror `src/` structure under `test/unit/`. Mock dependencies with `vi.mock()` (hoisted). Reset mocks with `vi.resetAllMocks()` in `beforeEach`.
- **Integration/narrow tests**: `test/integration/narrow/routes/` — use Hapi's `server.inject()` for HTTP testing.
- **Scenario tests**: `test/scenarios/events/` — simulate full event processing flows.
- **Local integration**: `test/integration/local/` — requires running infrastructure (Docker).
- Always set `TZ=UTC` when running tests (handled by the npm scripts).
