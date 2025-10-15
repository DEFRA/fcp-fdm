import { consumeEventMessages } from './consumer.js'
import { config } from '../config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

setInterval(pollForEventMessages, config.get('sqs.pollingInterval'))

export async function pollForEventMessages () {
  try {
    await consumeEventMessages()
  } catch (err) {
    logger.error(err)
  }
}
