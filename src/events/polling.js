import { consumeEvents } from './consumer.js'
import { config } from '../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const { sqs } = config.get('aws')
const logger = createLogger()

export async function pollForEvents () {
  try {
    await consumeEvents()
  } catch (err) {
    logger.error(err, 'Error polling for event messages')
  } finally {
    setTimeout(pollForEvents, sqs.pollingInterval)
  }
}
