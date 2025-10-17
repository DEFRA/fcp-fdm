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

export async function consumeEventMessages () {
  const { Messages } = await sqsClient.send(
    new ReceiveMessageCommand(receiveParams)
  )
  if (Messages) {
    for (const message of Messages) {
      try {
        await processEvent(message)
        await sqsClient.send(
          new DeleteMessageCommand({
            QueueUrl: sqs.queueUrl,
            ReceiptHandle: message.ReceiptHandle
          })
        )
      } catch (err) {
        if (err.category === 'validation') {
          logger.warn('Dead lettering invalid event')
          // dead letter
        } else {
          // requeue for processing
          logger.warn('Requeuing event')
        }
      }
    }
  }
}
