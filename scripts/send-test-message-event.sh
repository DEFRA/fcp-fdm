#!/bin/bash

# Send CloudEvents-compliant test event to SQS queue via LocalStack
# Usage: ./scripts/send-sfd.notification.request.sh [message] [count]
# 
# The message should be in CloudEvents format wrapped in SNS format:
# Example: '{"Message": "{\"specversion\": \"1.0\", \"type\": \"uk.gov.defra.fcp.test\", \"source\": \"test\", \"id\": \"$(uuidgen)\", \"time\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"data\": {}}"}'

QUEUE_URL="http://localhost:4566/000000000000/fcp_fdm_events"
AWS_REGION="eu-west-2"

# Function to generate UUID (fallback if uuidgen not available)
generate_uuid() {
    if command -v uuidgen >/dev/null 2>&1; then
        uuidgen
    else
        # Fallback UUID generation using /proc/sys/kernel/random/uuid or random numbers
        if [ -f /proc/sys/kernel/random/uuid ]; then
            cat /proc/sys/kernel/random/uuid
        else
            # Simple fallback using random numbers and timestamp
            echo "$(date +%s)-$(($RANDOM * $RANDOM))-$(($RANDOM * $RANDOM))-$(($RANDOM * $RANDOM))-$(date +%N)"
        fi
    fi
}

# Default CloudEvents message wrapped in SNS format if none provided
# Generate a UUID for the event ID
EVENT_ID=$(generate_uuid)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# CloudEvents-compliant message wrapped in SNS format
DEFAULT_MESSAGE='{"Message": "{\"specversion\": \"1.0\", \"type\": \"uk.gov.defra.fcp.sfd.notification.request\", \"source\": \"uk.gov.defra.fcp.test-script\", \"id\": \"'$EVENT_ID'\", \"time\": \"'$TIMESTAMP'\", \"subject\": \"sfd.notification.request\", \"datacontenttype\": \"application/json\", \"data\": {\"action\": \"test\", \"source\": \"script\", \"userId\": 123}}"}'

# Get message from argument or use default
MESSAGE=${1:-$DEFAULT_MESSAGE}

# Get count from argument or default to 1
COUNT=${2:-1}

echo "Sending $COUNT message(s) to queue: $QUEUE_URL"
echo "Message: $MESSAGE"
echo "----------------------------------------"

for i in $(seq 1 $COUNT); do
    # Generate unique message for each iteration
    if [ $COUNT -gt 1 ]; then
        # Generate new UUID and timestamp for each message
        UNIQUE_EVENT_ID=$(generate_uuid)
        UNIQUE_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        CORRELATION_ID=$(generate_uuid)
        # If custom message provided, use it; otherwise create a unique default message
        if [ $# -ge 1 ]; then
            CURRENT_MESSAGE="$MESSAGE"
        else
            CURRENT_MESSAGE='{"Message": "{\"specversion\": \"1.0\", \"type\": \"uk.gov.defra.fcp.sfd.notification.request\", \"source\": \"uk.gov.defra.fcp.test-script\", \"id\": \"'$UNIQUE_EVENT_ID'\", \"time\": \"'$UNIQUE_TIMESTAMP'\", \"subject\": \"sfd.notification.request-'$i'\", \"datacontenttype\": \"application/json\", \"data\": {\"correlationId\": \"'$CORRELATION_ID'\", \"recipient\": \"farmer@test.com\"}}"}'
        fi
    else
        CURRENT_MESSAGE="$MESSAGE"
    fi
    
    RESULT=$(docker-compose exec -T localstack awslocal sqs send-message \
        --queue-url "$QUEUE_URL" \
        --message-body "$CURRENT_MESSAGE" \
        --region "$AWS_REGION" \
        --message-attributes '{"eventType":{"StringValue":"uk.gov.defra.fcp.sfd.notification.request","DataType":"String"}}' \
        2>/dev/null)
    
    if [ $? -eq 0 ]; then
        MESSAGE_ID=$(echo "$RESULT" | grep -o '"MessageId":"[^"]*"' | cut -d'"' -f4)
        echo "✓ Message $i sent successfully - ID: $MESSAGE_ID"
    else
        echo "✗ Failed to send message $i"
    fi
    
    # Small delay between messages if sending multiple
    if [ $COUNT -gt 1 ] && [ $i -lt $COUNT ]; then
        sleep 0.1
    fi
done

echo "----------------------------------------"
echo "Test messages sent"
