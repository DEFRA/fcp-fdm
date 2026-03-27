#!/usr/bin/env sh

echo "Waiting for Floci to be ready..."
until aws sqs list-queues > /dev/null 2>&1; do
  sleep 1
done
echo "Floci is ready"

echo "Configuring SQS and SNS"
echo "========================"

AWS_REGION=${AWS_REGION:-eu-west-2}
ACCOUNT_ID=000000000000

create_queue() {
  local QUEUE_NAME=$1
  local DLQ_NAME="${QUEUE_NAME}-deadletter"

  aws sqs create-queue --queue-name "${DLQ_NAME}" --region "${AWS_REGION}" \
    --attributes VisibilityTimeout=60

  local DLQ_ARN="arn:aws:sqs:${AWS_REGION}:${ACCOUNT_ID}:${DLQ_NAME}"

  aws sqs create-queue --queue-name "${QUEUE_NAME}" --region "${AWS_REGION}" \
    --attributes '{
      "VisibilityTimeout": "60",
      "RedrivePolicy": "{\"deadLetterTargetArn\":\"'"${DLQ_ARN}"'\",\"maxReceiveCount\":\"3\"}"
    }'
}

create_topic() {
  local TOPIC_NAME=$1
  aws sns create-topic --name "${TOPIC_NAME}" --region "${AWS_REGION}"
}

subscribe_queue_to_topic() {
  local TOPIC=$1
  local QUEUE=$2
  local QUEUE_ARN="arn:aws:sqs:${AWS_REGION}:${ACCOUNT_ID}:${QUEUE}"

  aws sns subscribe \
    --topic-arn "arn:aws:sns:${AWS_REGION}:${ACCOUNT_ID}:${TOPIC}" \
    --protocol sqs \
    --notification-endpoint "${QUEUE_ARN}" \
    --region "${AWS_REGION}"
}

create_queue "fcp_fdm_events"
create_topic "fcp_event_publisher"
subscribe_queue_to_topic "fcp_event_publisher" "fcp_fdm_events"

echo "Done! SQS and SNS configured."
