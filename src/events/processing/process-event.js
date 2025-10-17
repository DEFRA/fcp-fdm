import { getEventType } from './get-event-type.js'
import { saveEvent } from './save-event/save.js'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { validateEvent, validateEventData } from './validate-event.js'

const logger = createLogger()

export async function processEvent (message) {
  const event = JSON.parse(JSON.parse(message.Body).Message)

  logger.debug('Event received')
  logger.debug(event)
  validateEvent(event)
  const eventType = getEventType(event.type)
  await validateEventData(event.data, eventType)
  await saveEvent(event, eventType)
}
