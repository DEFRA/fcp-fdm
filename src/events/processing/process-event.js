import { getEventType } from './get-event-type.js'
import { validateEventData } from './validate-event-data.js'
import { saveEvent } from './save-event/save.js'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { isEventValid } from './validate.js'

const logger = createLogger()

export async function processEvent (message) {
  const event = JSON.parse(JSON.parse(message.Body).Message)

  if (isEventValid(event)) {
    logger.debug('Valid event')
    logger.debug(event)

    const eventType = getEventType(event.type)
    await validateEventData(event.data, eventType)
    await saveEvent(event, eventType)
  } else {
    logger.error('Invalid event')
    logger.debug(event)
  }
}
