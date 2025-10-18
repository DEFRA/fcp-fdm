# FCP SFD Communications Service - Lifecycle Analysis

## Overview

The FCP SFD Communications service processes communication requests through a robust messaging pipeline using AWS SQS for input and SNS for event publishing. This document provides a comprehensive analysis of the communication request lifecycle, possible paths, and event flows.

## Architecture Overview

```mermaid
graph TB
    subgraph "External Systems"
        ES[External Source Systems]
    end
    
    subgraph "AWS Services"
        SQS[SQS Queue: fcp_sfd_comms_request]
        DLQ[Dead Letter Queue]
        SNS[SNS Topic: fcp_sfd_comm_events]
        NOTIFY[GOV.UK Notify Service]
    end
    
    subgraph "SFD Comms Service"
        CONSUMER[SQS Consumer]
        PROCESSOR[Message Processor]
        VALIDATOR[Schema Validator]
        DB[(MongoDB)]
        SCHEDULER[Job Scheduler]
        NOTIFYCLIENT[Notify Client]
    end
    
    subgraph "Downstream Systems"
        SUBSCRIBERS[Event Subscribers]
    end
    
    ES -->|Send Comms Request| SQS
    SQS -->|Poll Messages| CONSUMER
    CONSUMER -->|Process| PROCESSOR
    PROCESSOR -->|Validate| VALIDATOR
    PROCESSOR -->|Store| DB
    PROCESSOR -->|Send Email| NOTIFYCLIENT
    NOTIFYCLIENT -->|API Call| NOTIFY
    PROCESSOR -->|Publish Events| SNS
    SNS -->|Events| SUBSCRIBERS
    SCHEDULER -->|Status Check| NOTIFY
    SCHEDULER -->|Retry Logic| SQS
    SCHEDULER -->|Update Events| SNS
    SQS -->|Failed Messages| DLQ
```

## Message Flow Diagrams

### 1. New Communication Request Flow

```mermaid
sequenceDiagram
    participant ES as External System
    participant SQS as SQS Queue
    participant Consumer as SQS Consumer
    participant Processor as Message Processor
    participant Validator as Schema Validator
    participant DB as MongoDB
    participant Notify as GOV.UK Notify
    participant SNS as SNS Topic
    
    ES->>SQS: Send comms request message
    Consumer->>SQS: Poll for messages
    SQS->>Consumer: Return message batch
    Consumer->>Processor: Process message
    Processor->>Validator: Validate schema
    
    alt Invalid Schema
        Validator-->>Processor: Validation error
        Processor->>SNS: Publish validation failure event
        Processor->>Consumer: Complete message
    else Valid Schema
        Validator-->>Processor: Valid message
        Processor->>DB: Check idempotency
        
        alt Already processed
            DB-->>Processor: Duplicate found
            Processor->>Consumer: Complete message (log warning)
        else New request
            DB-->>Processor: No duplicate
            Processor->>DB: Store notification request
            Processor->>SNS: Publish received event
            Processor->>Notify: Send email via API
            
            alt Notify Success
                Notify-->>Processor: Success response
                Processor->>DB: Update status to 'sending'
                Processor->>SNS: Publish sending event
            else Notify Error
                Notify-->>Processor: Error response
                Processor->>DB: Update status (internal/technical failure)
                Processor->>SNS: Publish failure event
                
                alt Technical Failure (5xx)
                    Processor->>SQS: Schedule retry message
                end
            end
        end
    end
    
    Consumer->>SQS: Acknowledge message
```

### 2. Status Monitoring and Retry Flow

```mermaid
sequenceDiagram
    participant Scheduler as Job Scheduler
    participant DB as MongoDB
    participant Notify as GOV.UK Notify
    participant SNS as SNS Topic
    participant SQS as SQS Queue
    
    loop Every configured interval
        Scheduler->>DB: Get pending notifications
        DB-->>Scheduler: Return pending list
        
        loop For each pending notification
            Scheduler->>Notify: Check notification status
            Notify-->>Scheduler: Return current status
            
            alt Status unchanged
                Scheduler->>Scheduler: Continue to next
            else Status changed
                Scheduler->>DB: Update notification status
                
                alt Finished status (delivered/failed)
                    Scheduler->>SNS: Publish status update event
                else Retryable status (temp/tech failure)
                    Scheduler->>SNS: Publish status update event
                    
                    alt Within retry window
                        Scheduler->>SQS: Send retry message with delay
                    else Retry window expired
                        Scheduler->>SNS: Publish retry expired event
                    end
                end
            end
        end
    end
```

### 3. Retry Message Processing Flow

```mermaid
sequenceDiagram
    participant SQS as SQS Queue
    participant Consumer as SQS Consumer
    participant Processor as Message Processor
    participant DB as MongoDB
    participant Notify as GOV.UK Notify
    participant SNS as SNS Topic
    
    SQS->>Consumer: Deliver retry message (after delay)
    Consumer->>Processor: Process retry message
    Processor->>DB: Store new notification request
    Processor->>SNS: Publish retry event
    Processor->>Notify: Attempt email send again
    
    alt Notify Success
        Notify-->>Processor: Success response
        Processor->>DB: Update status to 'sending'
        Processor->>SNS: Publish sending event
    else Notify Error Again
        Notify-->>Processor: Error response
        Processor->>DB: Update status
        Processor->>SNS: Publish failure event
        
        alt Still within retry window & technical failure
            Processor->>SQS: Schedule another retry
        end
    end
```

## Event Types and Paths

### Input Events (SQS)

#### 1. New Communication Request
```json
{
  "id": "79389915-7275-457a-b8ca-8bf206b2e67b",
  "source": "ffc-ahwr-application",
  "specversion": "1.0",
  "type": "uk.gov.fcp.sfd.notification.request",
  "datacontenttype": "application/json",
  "time": "2023-10-17T14:48:00.000Z",
  "data": {
    "crn": 1234567890,
    "sbi": 123456789,
    "sourceSystem": "ffc-ahwr",
    "notifyTemplateId": "f33517ff-2a88-4f6e-b855-c550268ce08a",
    "commsType": "email",
    "recipient": "farmer@example.com",
    "personalisation": {
      "caseNumber": "ACC123456789",
      "expectedPaymentDate": "21.11.2025",
      "adminName": "Jessica Lrrr"
    },
    "reference": "ffc-ahwr-reference-123",
    "oneClickUnsubscribeUrl": "https://unsubscribe.example.com",
    "emailReplyToId": "8e222534-7f05-4972-86e3-17c5d9f894e2"
  }
}
```

#### 2. Retry Communication Request
```json
{
  "id": "a4ea0d13-ea7f-4f5b-9c4c-ce34ec2cbabf",
  "source": "ffc-ahwr-application",
  "specversion": "1.0",
  "type": "uk.gov.fcp.sfd.notification.retry",
  "datacontenttype": "application/json",
  "time": "2023-10-17T15:03:00.000Z",
  "data": {
    "correlationId": "79389915-7275-457a-b8ca-8bf206b2e67b",
    "crn": 1234567890,
    "sbi": 123456789,
    "sourceSystem": "ffc-ahwr",
    "notifyTemplateId": "f33517ff-2a88-4f6e-b855-c550268ce08a",
    "commsType": "email",
    "recipient": "farmer@example.com",
    "personalisation": {
      "caseNumber": "ACC123456789",
      "expectedPaymentDate": "21.11.2025",
      "adminName": "Jessica Lrrr"
    },
    "reference": "ffc-ahwr-reference-123",
    "oneClickUnsubscribeUrl": "https://unsubscribe.example.com",
    "emailReplyToId": "8e222534-7f05-4972-86e3-17c5d9f894e2"
  }
}
```

### Output Events (SNS)

#### 1. Request Received Event
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "source": "fcp-sfd-comms",
  "specversion": "1.0",
  "type": "uk.gov.fcp.sfd.notification.received",
  "datacontenttype": "application/json",
  "time": "2023-10-17T14:48:01.000Z",
  "data": {
    "correlationId": "79389915-7275-457a-b8ca-8bf206b2e67b",
    "crn": 1234567890,
    "sbi": 123456789,
    "sourceSystem": "ffc-ahwr",
    "notifyTemplateId": "f33517ff-2a88-4f6e-b855-c550268ce08a",
    "commsType": "email",
    "recipient": "farmer@example.com",
    "personalisation": {
      "caseNumber": "ACC123456789",
      "expectedPaymentDate": "21.11.2025",
      "adminName": "Jessica Lrrr"
    },
    "reference": "ffc-ahwr-reference-123",
    "oneClickUnsubscribeUrl": "https://unsubscribe.example.com",
    "emailReplyToId": "8e222534-7f05-4972-86e3-17c5d9f894e2"
  }
}
```

#### 2. Validation Failure Event
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "source": "fcp-sfd-comms",
  "specversion": "1.0",
  "type": "uk.gov.fcp.sfd.notification.failure.validation",
  "datacontenttype": "application/json",
  "time": "2023-10-17T14:48:01.000Z",
  "data": {
    "correlationId": "79389915-7275-457a-b8ca-8bf206b2e67b",
    "recipient": "invalid-email",
    "statusDetails": {
      "status": "validation-failure",
      "errors": [
        {
          "error": "ValidationError",
          "message": "\"data.recipient\" must be a valid email"
        }
      ]
    }
  }
}
```

#### 3. Sending Status Event
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "source": "fcp-sfd-comms",
  "specversion": "1.0",
  "type": "uk.gov.fcp.sfd.notification.sending",
  "datacontenttype": "application/json",
  "time": "2023-10-17T14:48:02.000Z",
  "data": {
    "correlationId": "79389915-7275-457a-b8ca-8bf206b2e67b",
    "recipient": "farmer@example.com",
    "statusDetails": {
      "status": "sending"
    }
  }
}
```

#### 4. Delivered Status Event
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440004",
  "source": "fcp-sfd-comms",
  "specversion": "1.0",
  "type": "uk.gov.fcp.sfd.notification.delivered",
  "datacontenttype": "application/json",
  "time": "2023-10-17T14:50:00.000Z",
  "data": {
    "correlationId": "79389915-7275-457a-b8ca-8bf206b2e67b",
    "recipient": "farmer@example.com",
    "statusDetails": {
      "status": "delivered"
    }
  }
}
```

#### 5. Provider Failure Event
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440005",
  "source": "fcp-sfd-comms",
  "specversion": "1.0",
  "type": "uk.gov.fcp.sfd.notification.failure.provider",
  "datacontenttype": "application/json",
  "time": "2023-10-17T14:48:05.000Z",
  "data": {
    "correlationId": "79389915-7275-457a-b8ca-8bf206b2e67b",
    "recipient": "farmer@example.com",
    "statusDetails": {
      "status": "permanent-failure"
    }
  }
}
```

#### 6. Internal Failure Event
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "source": "fcp-sfd-comms",
  "specversion": "1.0",
  "type": "uk.gov.fcp.sfd.notification.failure.internal",
  "datacontenttype": "application/json",
  "time": "2023-10-17T14:48:02.000Z",
  "data": {
    "correlationId": "79389915-7275-457a-b8ca-8bf206b2e67b",
    "recipient": "farmer@example.com",
    "statusDetails": {
      "status": "internal-failure",
      "errorCode": 400,
      "errors": [
        {
          "error": "BadRequestError",
          "message": "Missing personalisation key: 'caseNumber'"
        }
      ]
    }
  }
}
```

#### 7. Retry Event
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440007",
  "source": "fcp-sfd-comms",
  "specversion": "1.0",
  "type": "uk.gov.fcp.sfd.notification.retry",
  "datacontenttype": "application/json",
  "time": "2023-10-17T15:03:00.000Z",
  "data": {
    "correlationId": "79389915-7275-457a-b8ca-8bf206b2e67b",
    "crn": 1234567890,
    "sbi": 123456789,
    "sourceSystem": "ffc-ahwr",
    "notifyTemplateId": "f33517ff-2a88-4f6e-b855-c550268ce08a",
    "commsType": "email",
    "recipient": "farmer@example.com",
    "personalisation": {
      "caseNumber": "ACC123456789",
      "expectedPaymentDate": "21.11.2025",
      "adminName": "Jessica Lrrr"
    },
    "reference": "ffc-ahwr-reference-123",
    "oneClickUnsubscribeUrl": "https://unsubscribe.example.com",
    "emailReplyToId": "8e222534-7f05-4972-86e3-17c5d9f894e2"
  }
}
```

#### 8. Retry Expired Event
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440008",
  "source": "fcp-sfd-comms",
  "specversion": "1.0",
  "type": "uk.gov.fcp.sfd.notification.retry.expired",
  "datacontenttype": "application/json",
  "time": "2023-10-24T14:48:00.000Z",
  "data": {
    "correlationId": "79389915-7275-457a-b8ca-8bf206b2e67b",
    "recipient": "farmer@example.com"
  }
}
```

## Processing Paths and Decision Tree

```mermaid
flowchart TD
    A[SQS Message Received] --> B[Parse SQS Message]
    B --> C[Schema Validation]
    
    C -->|Invalid| D[Publish Validation Failure Event]
    D --> E[Complete Message]
    
    C -->|Valid| F[Check Idempotency]
    F -->|Duplicate| G[Log Warning & Complete]
    F -->|New| H[Store in DB]
    
    H --> I[Publish Received Event]
    I --> J[Send to GOV.UK Notify]
    
    J -->|Success 2xx| K[Update Status: SENDING]
    K --> L[Publish Sending Event]
    L --> M[Complete Message]
    
    J -->|Client Error 4xx| N[Update Status: INTERNAL_FAILURE]
    N --> O[Publish Internal Failure Event]
    O --> P[Complete Message]
    
    J -->|Server Error 5xx| Q[Update Status: TECHNICAL_FAILURE]
    Q --> R[Publish Provider Failure Event]
    R --> S[Schedule Retry Message]
    S --> T[Complete Message]
    
    U[Job Scheduler] --> V[Check Pending Notifications]
    V --> W[Query Notify Status]
    W --> X{Status Changed?}
    
    X -->|No| Y[Continue to Next]
    X -->|Yes| Z[Update DB Status]
    
    Z --> AA{Final Status?}
    AA -->|Delivered/Failed| BB[Publish Status Event]
    AA -->|Retryable| CC{Within Retry Window?}
    
    CC -->|Yes| DD[Publish Status Event]
    DD --> EE[Schedule Retry]
    CC -->|No| FF[Publish Retry Expired Event]
    
    BB --> GG[Continue to Next]
    EE --> GG
    FF --> GG
```

## Status Mappings

### Notify Statuses to Event Types
| Notify Status | Event Type | Description |
|--------------|------------|-------------|
| `created` | `uk.gov.fcp.sfd.notification.sending` | Notification created in Notify |
| `sending` | `uk.gov.fcp.sfd.notification.sending` | Notification being sent |
| `delivered` | `uk.gov.fcp.sfd.notification.delivered` | Successfully delivered |
| `permanent-failure` | `uk.gov.fcp.sfd.notification.failure.provider` | Permanent delivery failure |
| `temporary-failure` | `uk.gov.fcp.sfd.notification.failure.provider` | Temporary failure (retryable) |
| `technical-failure` | `uk.gov.fcp.sfd.notification.failure.provider` | Technical failure (retryable) |
| `internal-failure` | `uk.gov.fcp.sfd.notification.failure.internal` | Service internal failure |
| `validation-failure` | `uk.gov.fcp.sfd.notification.failure.validation` | Invalid request data |

### Retry Logic
- **Retryable Statuses**: `temporary-failure`, `technical-failure`
- **Retry Window**: 168 hours (7 days) from original request
- **Retry Delay**: 15 minutes between attempts
- **Finished Statuses**: `delivered`, `permanent-failure`, `temporary-failure`, `technical-failure`, `internal-failure`

## Key Components

### 1. SQS Consumer (`src/messaging/inbound/comms-request/consumer.js`)
- Polls SQS queue for new messages
- Handles batch processing
- Manages error handling and logging

### 2. Message Handler (`src/messaging/inbound/comms-request/handler.js`)
- Parses SQS messages
- Routes to appropriate processor
- Ensures message completion

### 3. V1 Processor (`src/messaging/inbound/comms-request/processors/v1/v1.js`)
- Validates message schema
- Manages idempotency checks
- Orchestrates Notify integration
- Handles success/error paths

### 4. Notify Integration (`src/messaging/inbound/comms-request/notify-service/`)
- Sends emails via GOV.UK Notify
- Handles API responses and errors
- Manages retry logic for technical failures

### 5. Status Monitoring (`src/jobs/check-notify-status/`)
- Periodic job to check notification statuses
- Updates database with current status
- Triggers retry or expiry logic

### 6. Event Publishers (`src/messaging/outbound/`)
- Publishes events to SNS topic
- Handles different event types
- Manages error scenarios

## Error Handling

### Validation Errors
- Invalid schema triggers validation failure event
- Message is completed (not retried)
- Error details included in event

### Notify API Errors
- **4xx errors**: Treated as internal failures (not retried)
- **5xx errors**: Treated as technical failures (retried)
- Network errors: Service throws exception

### Retry Strategy
- Technical failures trigger automatic retry
- 15-minute delay between retry attempts
- 7-day retry window from original request
- Retry expired event published when window closes

## Monitoring and Observability

### Logs
- Message processing success/failure
- Notify API responses
- Retry scheduling and expiry
- Error details with correlation IDs

### Events
- All state changes published to SNS
- Correlation IDs for tracking
- Status details with error information
- Timestamps for audit trail

### Database
- Idempotency tracking
- Status history
- Correlation mapping for retries
- Audit trail with timestamps

This architecture ensures reliable message delivery with comprehensive error handling, retry mechanisms, and full observability of the communication lifecycle.