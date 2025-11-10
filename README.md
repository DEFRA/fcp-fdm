![Build](https://github.com/defra/fcp-fdm/actions/workflows/publish.yml/badge.svg)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_fcp-fdm&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_fcp-fdm)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_fcp-fdm&metric=bugs)](https://sonarcloud.io/summary/new_code?id=DEFRA_fcp-fdm)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_fcp-fdm&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=DEFRA_fcp-fdm)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_fcp-fdm&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=DEFRA_fcp-fdm)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_fcp-fdm&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_fcp-fdm)

# Farming Data Model (FDM)

The Farming Data Model (FDM) service is a common component to support data exchange between Farming and Countryside Programme (FCP) services.

FDM subscribes to events across the FCP ecosystem via an AWS SQS queue. These events are persisted and precompiled into a data model which can be queried via REST API endpoints.

## Contents

- [Architecture Overview](#architecture-overview)
- [Event Processing Pipeline](#event-processing-pipeline)
  - [Processing Flow](#processing-flow)
  - [Code Layer Processing](#code-layer-processing)
- [Event Types And Scenarios](#event-types-and-scenarios)
  - [Message Events](#message-events)
- [Retry Logic And Dead Letter Queue](#retry-logic-and-dead-letter-queue)
  - [Sqs Configuration](#sqs-configuration)
  - [Localstack Setup](#localstack-setup)
  - [Mongodb Event Storage](#mongodb-event-storage)
- [Adding New Event Types](#adding-new-event-types)
  - [1. Update Event Type Mapping](#1-update-event-type-mapping)
  - [2. Create Event Schema](#2-create-event-schema)
  - [3. Create Save Handler](#3-create-save-handler)
  - [4. Naming Convention](#4-naming-convention)
  - [5. Add Test Coverage](#5-add-test-coverage)
  - [Sending Test Events](#sending-test-events)
  - [Sending Test Events In Cdp Environments](#sending-test-events-in-cdp-environments)
- [Api Endpoints](#api-endpoints)
  - [Authentication](#authentication)
    - [Setup Requirements](#setup-requirements)
    - [Authentication Flow](#authentication-flow)
- [Test Structure](#test-structure)
  - [Test Categories](#test-categories)
  - [Running Tests](#running-tests)
- [Environment Variables](#environment-variables)
  - [Core Service](#core-service)
  - [Aws](#aws)
  - [Mongodb](#mongodb)
  - [Logging](#logging)
  - [Security And Performance](#security-and-performance)
  - [Authentication](#authentication-1)
- [Using Fdm In Your Docker Compose](#using-fdm-in-your-docker-compose)
  - [Dependencies](#dependencies)
  - [Minimum Setup](#minimum-setup)
  - [Localstack Initialization Script](#localstack-initialization-script)
  - [Important Notes](#important-notes)
  - [Accessing The Service](#accessing-the-service)
- [Requirements](#requirements)
  - [Docker](#docker)
  - [Local Development](#local-development)
    - [Setup](#setup)
    - [Development](#development)
    - [Testing](#testing)
- [Licence](#licence)
  - [About The Licence](#about-the-licence)


## Architecture Overview

The FDM service follows an event-driven architecture pattern with the following key components:

```mermaid
graph TB
    subgraph "External Systems"
        SFD[SFD Comms Service]
        FUTURE[Future Event Sources]
    end
    
    subgraph "AWS Infrastructure"
        SNS[SNS Topic]
        SQS[SQS Queue: fcp_fdm_events]
        DLQ[Dead Letter Queue: fcp_fdm_events-deadletter]
    end
    
    subgraph "FDM Service"
        POLLER[Event Poller]
        CONSUMER[SQS Consumer]
        PROCESSOR[Event Processor]
        VALIDATOR[Schema Validator]
        SAVER[Event Saver]
        API[REST API]
    end
    
    subgraph "Data Storage"
        MONGO[(MongoDB)]
        EVENTS[events collection]
        MESSAGES[messages collection]
    end
    
    SFD -->|Publish Events| SNS
    FUTURE -->|Publish Events| SNS
    SNS -->|Route to Queue| SQS
    SQS -->|Failed Messages| DLQ
    
    POLLER -->|Poll Messages| SQS
    SQS -->|Return Batch| CONSUMER
    CONSUMER -->|Process Each| PROCESSOR
    PROCESSOR -->|Parse & Validate| VALIDATOR
    VALIDATOR -->|Save Valid Events| SAVER
    SAVER -->|Store Events| EVENTS
    SAVER -->|Aggregate Messages| MESSAGES
    
    API -->|Query Data| MONGO
    
    style SQS fill:#e1f5fe
    style DLQ fill:#ffecb3
    style MONGO fill:#e8f5e8
```


## Event Processing Pipeline

The FDM service implements a robust event processing pipeline that handles CloudEvents from various sources:

> **📋 Event API Specification**  
> Complete AsyncAPI specification available at: [`docs/asyncapi.yml`](./docs/asyncapi.yml)  
> Defines all supported inbound events, schemas, and examples.

### Processing Flow

```mermaid
sequenceDiagram
    participant SQS as SQS Queue
    participant Poller as Event Poller
    participant Consumer as SQS Consumer
    participant Parser as Event Parser
    participant Typer as Event Typer
    participant Validator as Schema Validator
    participant Saver as Event Saver
    participant Mongo as MongoDB
    participant DLQ as Dead Letter Queue
    
    loop Every polling interval
        Poller->>SQS: Poll for messages (max 10)
        SQS->>Consumer: Return message batch
        
        loop For each message
            Consumer->>Parser: Parse SQS message body
            Parser->>Typer: Extract event type
            Typer->>Validator: Validate against schema
            
            alt Validation Success
                Validator->>Saver: Save valid event
                Saver->>Mongo: Store in events collection
                Saver->>Mongo: Update messages aggregation
                Consumer->>SQS: Delete processed message
            else Validation Failure
                Consumer->>Consumer: Log error & skip delete
                Note over SQS,DLQ: Message returns to queue<br/>After 3 failures → DLQ
            end
        end
    end
```

### Code Layer Processing

The event processing follows this logical flow through the codebase:

1. **Polling Layer** (`src/events/polling.js`)
   - Recursive setTimeout pattern for continuous polling
   - Configurable polling interval via `config.aws.sqs.pollingInterval`
   - Error handling with logging and retry mechanism

2. **Consumer Layer** (`src/events/consumer.js`)
   - SQS client configuration with LocalStack support
   - Batch message processing (up to 10 messages per poll)
   - Individual message processing with error isolation
   - Automatic message deletion on successful processing

3. **Processing Layer** (`src/events/process.js`)
   - Orchestrates the complete event processing pipeline
   - Calls parse → type → validate → save in sequence
   - Any failure abandons processing for that event

4. **Parser Layer** (`src/events/parse.js`)
   - Extracts CloudEvent from SQS message wrapper
   - Handles nested JSON parsing (SQS Body → SNS Message → CloudEvent)
   - Throws errors for malformed JSON structures

5. **Type Layer** (`src/events/types.js`)
   - Maps CloudEvent type to internal event category
   - Currently supports: `uk.gov.fcp.sfd.notification.*` → `message`
   - Extensible for new event type prefixes

6. **Validation Layer** (`src/events/validate.js`)
   - Dynamic schema loading based on event type
   - Uses Joi validation with CloudEvent compliance
   - Allows unknown properties for forward compatibility

7. **Save Layer** (`src/events/save.js`)
   - Dynamic import pattern: `./save/${eventType}.js`
   - Type-specific save logic for different event categories
   - Currently implements `message` event saving

## Event Types and Scenarios

### Message Events

The service currently processes message events from the SFD Comms service:

> **📋 Detailed Event Schemas**  
> Complete event schemas, examples, and validation rules are available in the AsyncAPI specification: [`docs/asyncapi.yml`](./docs/asyncapi.yml)

| Event Type | Description | Schema |
|------------|-------------|---------|
| `uk.gov.fcp.sfd.notification.received` | Initial message request | Requires `correlationId`, `recipient`, full personalisation data |
| `uk.gov.fcp.sfd.notification.failure.validation` | Validation failed | Requires `correlationId`, `recipient`, error details |
| `uk.gov.fcp.sfd.notification.sending` | Message being sent | Requires `correlationId`, `recipient`, status details |
| `uk.gov.fcp.sfd.notification.delivered` | Message delivered | Requires `correlationId`, `recipient`, status details |
| `uk.gov.fcp.sfd.notification.failure.provider` | Provider failure | Requires `correlationId`, `recipient`, status details |
| `uk.gov.fcp.sfd.notification.failure.internal` | Internal failure | Requires `correlationId`, `recipient`, error details |
| `uk.gov.fcp.sfd.notification.retry` | Retry request | Requires `correlationId`, `recipient`, full personalisation data |
| `uk.gov.fcp.sfd.notification.retry.expired` | Retry expired | Requires `correlationId`, `recipient` |


## Retry Logic and Dead Letter Queue

### SQS Configuration

The service implements robust retry logic through AWS SQS configuration:

- **Visibility Timeout**: 60 seconds
- **Max Receive Count**: 3 attempts
- **Dead Letter Queue**: `fcp_fdm_events-deadletter`
- **Redrive Policy**: Automatic after 3 failed processing attempts

### LocalStack Setup

LocalStack configuration mirrors production settings:

```bash
# Creates main queue with DLQ redrive policy
create_queue "fcp_fdm_events"
# Automatically creates: fcp_fdm_events-deadletter

# Configuration:
# - VisibilityTimeout: 60 seconds
# - RedrivePolicy: maxReceiveCount=3, deadLetterTargetArn=DLQ_ARN
```

### MongoDB Event Storage

Events are stored in two collections:

1. **events collection**: Individual event records
   - `_id`: Composite key `${source}:${id}`
   - Prevents duplicate event processing
   - Stores complete CloudEvent payload

2. **messages collection**: Aggregated message flows
   - `_id`: `correlationId` from event data
   - Groups all events for a single message flow
   - Tracks message metadata (recipient, subject, body)
   - Contains array of event references

## Adding New Event Types

To add support for new inbound event types, follow these steps:

### 1. Update Event Type Mapping

Add the new event type prefix to `src/events/types.js`:

```javascript
// Add new event type constant
const NEW_EVENT_TYPE = 'newevent'

// Add prefix mapping
export function getEventType (type) {
  if (type.startsWith(MESSAGE_EVENT_PREFIX)) {
    return MESSAGE_EVENT
  } else if (type.startsWith(NEW_EVENT_PREFIX)) {
    return NEW_EVENT_TYPE
  } else {
    throw new Error(`Unknown event type: ${type}`)
  }
}

// Define the prefix pattern
const NEW_EVENT_PREFIX = 'uk.gov.fcp.your.event.prefix'
```

### 2. Create Event Schema

Create a new schema file at `src/events/schemas/newevent.js`:

```javascript
import Joi from 'joi'
import { cloudEvent } from './cloud-event.js'

export default cloudEvent.keys({
  data: Joi.object({
    // Define your event-specific data requirements
    correlationId: Joi.string().required(),
    yourField: Joi.string().required()
    // Add other required/optional fields
  }).required()
})
```

### 3. Create Save Handler

Create a save handler at `src/events/save/newevent.js`:

```javascript
import { getMongoDb } from '../../common/helpers/mongodb.js'
import { createLogger } from '../../common/helpers/logging/logger.js'

const logger = createLogger()

export async function save (event) {
  const { db, collections } = getMongoDb()
  
  // Implement your save logic
  // Store in events collection
  // Update any aggregation collections
  
  logger.info(`Saved ${event.type} event. ID: ${event.id}`)
}
```

### 4. Naming Convention

The dynamic import system requires strict naming conventions:

- **Event Type**: Must be a valid JavaScript identifier (no hyphens, spaces)
- **Schema File**: `src/events/schemas/${eventType}.js`
- **Save Handler**: `src/events/save/${eventType}.js`
- **Export Name**: `save` function in save handler, `default` export for schema

### 5. Add Test Coverage

Create comprehensive tests following the existing patterns:

- **Unit Tests**: `test/unit/events/schemas/newevent.test.js`
- **Integration Tests**: `test/integration/local/events/save/newevent.test.js`
- **Mock Data**: `test/mocks/newevents.js`
- **Scenarios**: `test/events/newevent/scenarios.js`

### Sending Test Events

To support local development, Node.js scripts are provided for sending test events:

```bash
# List all available event scenarios
node ./scripts/send-events.js

# Send a specific scenario
node ./scripts/send-events.js streams.successful
node ./scripts/send-events.js single.messageRequest

# Available scenario types:
# - single.*: Individual event types
# - streams.*: Complete event flow scenarios
```

#### Sending Test Events in CDP Environments

Use the CDP terminal for your target environment. The AWS CLI is already installed and configured.

1. Create a test message file (SNS-wrapped CloudEvent format):
   ```bash
   cat > test-message.json << 'EOF'
   {
     "Message": "{\"specversion\":\"1.0\",\"type\":\"uk.gov.fcp.sfd.notification.message.request\",\"source\":\"sfd-comms-service\",\"id\":\"550e8400-e29b-41d4-a716-446655440000\",\"time\":\"2025-10-19T10:30:00Z\",\"datacontenttype\":\"application/json\",\"data\":{\"correlationId\":\"test-correlation-001\",\"personalisation\":{\"firstName\":\"Test\",\"lastName\":\"User\"},\"recipient\":\"test@example.com\",\"reference\":\"TEST-REF-001\",\"templateId\":\"test-template\"}}"
   }
   EOF
   ```

2. Send the message to the SQS queue:
   ```bash
   aws sqs send-message \
     --queue-url "https://sqs.eu-west-2.amazonaws.com/<account-id>/fcp_fdm_events" \
     --message-body file://test-message.json \
     --region eu-west-2
   ```

Replace `<account-id>` with CDP environment account ID.

## API Endpoints

Complete OpenAPI specification available at: [`docs/openapi.yml`](./docs/openapi.yml)  

Interactive API documentation can be found at [http://localhost:3000/documentation](http://localhost:3000/documentation) when running the application in development mode.

### Authentication

To authenticate with FDM for a specific environment, the following pre-requisite setup steps are required:

#### Setup Requirements

1. **Create a client App Registration** in the same tenant as the FDM in the target tenant

2. **Configure security groups manifest** - ensure that security groups manifest value `"groupMembershipClaims": "SecurityGroup"` is set

3. **Configure optional groups claim** - ensure that optional groups claim is added to the token configuration to include security groups in the groups property

4. **Create a client Security Group** in the target tenant

5. **Add the client App Registration** to the client Security Group

6. **Notify the FDM team** to add the Security Group ID to the FDM service

#### Authentication Flow

Once setup is complete, perform the following steps to successfully authenticate with the API:

1. **Authenticate with Entra** using your App Registration to retrieve an authentication token

2. **Make an API request** to FDM passing the `Bearer <token>` header

3. **FDM validates** the token and confirms if your service is authorised to access the data

```mermaid
sequenceDiagram
    participant Client
    participant Entra
    participant FDM 
    participant JWKS as JWKS Endpoint
    
    Note over Client,JWKS: Pre-requisite: App Registration & Security Group Setup
    
    Client->>Entra: 1. Authenticate with App Registration
    Entra->>Client: 2. Return JWT Token (with security groups)
    
    Client->>FDM: 3. API Request with Bearer token
    
    rect rgb(240, 248, 255)
        Note over FDM,JWKS: Token Validation Process
        FDM->>JWKS: 4. Fetch public keys for signature verification
        JWKS->>FDM: 5. Return signing keys
        FDM->>FDM: 6. Verify token signature & claims
        FDM->>FDM: 7. Check security groups against allowed list
    end
    
    alt Valid Token & Authorized Groups
        FDM->>Client: 8a. API Response (200 OK)
    else Invalid Token or Unauthorized
        FDM->>Client: 8b. Unauthorized (401)
    end
```

## Test Structure

The test suite is organized into distinct categories.

### Test Categories

1. **Unit Tests**: Fast, isolated tests with comprehensive mocking
   - Test individual functions and modules in isolation
   - Mock external dependencies (MongoDB, SQS, etc.)
   - High code coverage for business logic

2. **Integration Tests**: Test service integration points
   - Real MongoDB connections for database tests
   - Test actual save operations and data persistence
   - Verify schema compliance and data integrity

3. **Scenario Tests**: End-to-end workflow validation
   - Test complete event processing flows
   - Verify message aggregation and correlation
   - Validate business scenarios from start to finish

### Running Tests

```bash
# Run all tests with coverage
npm run docker:test

# Run tests in watch mode for development
npm run docker:test:watch
```

## Environment Variables

The FDM service can be configured using the following environment variables:

> Note: Default valid values are already applied for local development and testing through Docker Compose.

### Core Service

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Runtime environment (`development`, `test`, `production`) | - | No |
| `HOST` | IP address to bind the service | `0.0.0.0` | No |
| `PORT` | Port number to bind the service | `3000` | No |
| `SERVICE_VERSION` | Service version (injected in CDP environments) | `null` | No |
| `ENVIRONMENT` | CDP environment name | `local` | No |

### AWS

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AWS_REGION` | AWS region for services | `eu-west-2` | No |
| `AWS_ENDPOINT_URL` | AWS endpoint URL (for LocalStack) | `null` | No |
| `AWS_ACCESS_KEY_ID` | AWS access key ID | `null` | No |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | `null` | No |
| `AWS_SQS_QUEUE_URL` | SQS queue URL for event consumption | `null` | Yes |

### MongoDB

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MONGO_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/` | No |
| `MONGO_DATABASE` | MongoDB database name | `fcp-fdm` | No |
| `MONGO_RETRY_WRITES` | Enable MongoDB write retries | `null` | No |
| `MONGO_READ_PREFERENCE` | MongoDB read preference | `null` | No |
| `DATA_GLOBAL_TTL` | Global TTL for data in seconds | `null` | No |
| `DATA_ENABLED` | Enable/disable data persistence | `true`| No |

### Logging

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LOG_ENABLED` | Enable/disable logging | `true` (false in test) | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `LOG_FORMAT` | Log output format (`ecs`, `pino-pretty`) | `ecs` (prod), `pino-pretty` (dev) | No |

### Security and Performance

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `HTTP_PROXY` | HTTP proxy URL | `null` | No |
| `ENABLE_SECURE_CONTEXT` | Enable secure context | `true` (prod), `false` (dev) | No |
| `ENABLE_METRICS` | Enable metrics reporting | `true` (prod), `false` (dev) | No |
| `TRACING_HEADER` | CDP tracing header name | `x-cdp-request-id` | No |

### Authentication

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AUTH_ENABLED` | Enable authentication | `true` | No |
| `AUTH_TENANT_ID` | Microsoft Entra ID tenant ID | `null` | If Auth Enabled |
| `AUTH_ALLOWED_GROUP_IDS` | Comma-separated allowed security group IDs | `null` | If Auth Enabled |

## Using FDM in Your Docker Compose

To integrate the FCP-FDM service into your own project's Docker Compose setup, you need to include the service along with its required dependencies: MongoDB and LocalStack.

### Dependencies

The FCP-FDM service requires:

1. **MongoDB with replica set** - Required for MongoDB sessions to work properly
2. **LocalStack** - Provides SQS and SNS services for local development
3. **LocalStack initialization script** - Sets up the required SQS queues and SNS topics

### Minimum Setup

Add this to your `docker-compose.yml`:

```yaml
services:
  # Your existing services...
  
  fcp-fdm:
    image: defradigital/fcp-fdm:latest  # Or specific version tag
    depends_on:
      mongodb:
        condition: service_healthy
      localstack:
        condition: service_healthy
    environment:
      MONGO_URI: mongodb://mongodb:27017
      AWS_REGION: eu-west-2
      AWS_ACCESS_KEY_ID: test
      AWS_SECRET_ACCESS_KEY: test
      AWS_SQS_QUEUE_URL: http://localstack:4566/000000000000/fcp_fdm_events
      AWS_ENDPOINT_URL: http://localstack:4566
    ports:
      - '3000:3000'
    networks:
      - fcp-network

  mongodb:
    image: mongo:6.0.13
    command: --replSet rs0 --bind_ip_all --port 27017
    healthcheck:
      test: test $$(mongosh --port 27017 --quiet --eval "try {rs.initiate({_id:'rs0',members:[{_id:0,host:\"mongodb:27017\"}]})} catch(e) {rs.status().ok}") -eq 1
      interval: 10s
      start_period: 10s
    ports:
      - '27017:27017'
    volumes:
      - mongodb-data:/data
    networks:
      - fcp-network

  localstack:
    image: localstack/localstack
    environment:
      LS_LOG: warn
      SERVICES: sqs,sns
      AWS_ACCESS_KEY_ID: test
      AWS_SECRET_ACCESS_KEY: test
    healthcheck:
      test: ['CMD', 'curl', 'localhost:4566']
      interval: 5s
      start_period: 5s
      retries: 3
    ports:
      - '4566:4566'
    volumes:
      - ./path/to/fcp-fdm/localstack/localstack.sh:/etc/localstack/init/ready.d/localstack.sh
      - localstack-data:/var/lib/localstack
    networks:
      - fcp-network

networks:
  fcp-network:
    driver: bridge

volumes:
  mongodb-data:
  localstack-data:
```

### LocalStack Initialization Script

Copy or reference the LocalStack setup script from the FCP-FDM repository at [`localstack/localstack.sh`](localstack/localstack.sh). This script creates the required SQS queues, dead letter queues, SNS topics, and subscriptions needed for the service to function properly.

### Important Notes

1. **Startup Order**: The `depends_on` conditions ensure MongoDB and LocalStack are healthy before FCP-FDM starts
2. **MongoDB Replica Set**: The `--replSet rs0` command flag is essential for MongoDB sessions to work
5. **LocalStack Script**: Use the provided [`localstack/localstack.sh`](localstack/localstack.sh) script from the FCP-FDM repository - it sets up all required SQS queues and SNS topics
4. **Network**: All services must be on the same Docker network to communicate
5. **Health Checks**: MongoDB and LocalStack include health checks to ensure proper startup sequencing

### Accessing the Service

Once running, the FCP-FDM service will be available at:
- **API**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health`

The service will automatically start consuming events from the SQS queue and storing them in MongoDB.

## Requirements

### Docker

This application is intended to be run in a Docker container to ensure consistency across environments.

Docker can be installed from [Docker's official website](https://docs.docker.com/get-docker/).

> The test suite includes integration tests which are dependent on a Postgres container so cannot be run without Docker.

## Local development

### Setup

Install application dependencies:

```bash
npm install
```

### Development

To run the application in `development` mode run:

```bash
npm run docker:dev
```

### Testing

To test the application run:

```bash
npm run docker:test
```

Tests can also be run in watch mode to support Test Driven Development (TDD):

```bash
npm run docker:test:watch
```

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
