import { consumeEventMessages } from './consumer.js'
import { config } from '../config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const { sqs } = config.get('aws')
const logger = createLogger()

setInterval(pollForEventMessages, sqs.pollingInterval)

export async function pollForEventMessages () {
  try {
    await consumeEventMessages()
  } catch (err) {
    logger.error(err, 'Error polling for event messages')
  }
}
