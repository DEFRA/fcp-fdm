#!/bin/bash

# Send test event to SQS queue via LocalStack
# Usage: ./scripts/send-test-event.sh [message] [count]

QUEUE_URL="http://localhost:4566/000000000000/fcp_fdm_events"
AWS_REGION="eu-west-2"

# Default message if none provided
DEFAULT_MESSAGE='{"event": "test_event", "userId": 123, "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "data": {"action": "test", "source": "script"}}'

# Get message from argument or use default
MESSAGE=${1:-$DEFAULT_MESSAGE}

# Get count from argument or default to 1
COUNT=${2:-1}

echo "Sending $COUNT message(s) to queue: $QUEUE_URL"
echo "Message: $MESSAGE"
echo "----------------------------------------"

for i in $(seq 1 $COUNT); do
    # Add sequence number to message if sending multiple
    if [ $COUNT -gt 1 ]; then
        CURRENT_MESSAGE=$(echo "$MESSAGE" | sed "s/}$/, \"sequence\": $i}/")
    else
        CURRENT_MESSAGE="$MESSAGE"
    fi
    
    RESULT=$(docker-compose exec -T localstack awslocal sqs send-message \
        --queue-url "$QUEUE_URL" \
        --message-body "$CURRENT_MESSAGE" \
        --region "$AWS_REGION" \
        --message-attributes '{"eventType":{"StringValue":"test_event","DataType":"String"}}' \
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
