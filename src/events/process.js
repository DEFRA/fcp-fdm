import { createLogger } from '../common/helpers/logging/logger.js'
import { parseEvent } from './parse.js'
import { getEventType } from './types.js'
import { validateEvent } from './validate.js'
import { saveEvent } from './save.js'

const logger = createLogger()

export async function processEvent (rawEvent) {
  const event = parseEvent(rawEvent)
  const eventType = getEventType(event.type)
  await validateEvent(event, eventType)
  await saveEvent(event, eventType)
  logger.info({ event: { reference: event.id, type: event.type } }, 'Event processed successfully')
}
