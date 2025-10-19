import { ReceiveMessageCommand, DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { config } from '../config.js'
import { processEvent } from './processing/process-event.js'
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

  if (Messages) {
    for (const event of Messages) {
      try {
        await processEvent(event)
        await sqsClient.send(new DeleteMessageCommand({
          QueueUrl: sqs.queueUrl,
          ReceiptHandle: event.ReceiptHandle
        }))
      } catch (err) {
        logger.error(err, 'Unable to process event')
      }
    }
  }
}
