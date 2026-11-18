import { SQSClient } from '@aws-sdk/client-sqs'
import { config } from '../config/config.js'

const { region, endpoint, accessKeyId, secretAccessKey } = config.get('aws')

export const sqsClient = new SQSClient({
  region,
  ...(endpoint && {
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  })
})
