import { ReceiveMessageCommand, DeleteMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs'
import { config } from '../config/config.js'
import { processEvent } from './process.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const { sqs, region, endpoint, accessKeyId, secretAccessKey } = config.get('aws')

const logger = createLogger()

const sqsClient = new SQSClient({
  region,
  ...(endpoint && {
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  })
})

const receiveParams = {
  QueueUrl: sqs.queueUrl,
  MaxNumberOfMessages: 10,
  MessageAttributeNames: ['All'],
  AttributeNames: ['SentTimestamp'],
  WaitTimeSeconds: 10,
}

export async function consumeEvents () {
  const { Messages } = await sqsClient.send(new ReceiveMessageCommand(receiveParams))

  if (Array.isArray(Messages) && Messages.length > 0) {
    const processedReceiptHandles = []

    for (const event of Messages) {
      try {
        await processEvent(event)
        processedReceiptHandles.push({ Id: event.MessageId, ReceiptHandle: event.ReceiptHandle })
      } catch (err) {
        logger.error(err, 'Unable to process event')
      }
      try {
        await sqsClient.send(new DeleteMessageBatchCommand({
          QueueUrl: sqs.queueUrl,
          Entries: processedReceiptHandles
        }))
      } catch (err) {
        logger.error(err, 'Unable to delete processed messages')
      }
    }
    return true
  }
  return false
}
