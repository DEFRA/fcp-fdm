import { createLogger } from '../common/helpers/logging/logger.js'
import { isEventValid } from './validate.js'

const logger = createLogger()

export async function processEventMessage (message) {
  const event = JSON.parse(JSON.parse(message.Body).Message)

  if (isEventValid(event)) {
    logger.info('Valid event')
    logger.info(event)
  } else {
    logger.error('Invalid event')
    logger.error(event)
  }
}
