import { ReceiveMessageCommand, DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { config } from '../config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

const receiveParams = {
  QueueUrl: config.get('sqs.queue'),
  MaxNumberOfMessages: 10,
  MessageAttributeNames: ['All'],
  AttributeNames: ['SentTimestamp'],
  WaitTimeSeconds: 10,
}

const messageClient = new SQSClient({
  region: process.env.AWS_REGION || 'eu-west-2',
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
  }
})

export async function consumeEventMessages () {
  const { Messages } = await messageClient.send(
    new ReceiveMessageCommand(receiveParams)
  )
  if (Messages) {
    for (const message of Messages) {
      logger.info('Message received')
      logger.info(message)
      await messageClient.send(
        new DeleteMessageCommand({
          QueueUrl: config.get('sqs.queue'),
          ReceiptHandle: message.ReceiptHandle
        })
      )
    }
  }
}
