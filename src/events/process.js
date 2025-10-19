import { parseEvent } from './parse.js'
import { getEventType } from './types.js'
import { validateEvent } from './validate.js'
import { saveEvent } from './save.js'

export async function processEvent (rawEvent) {
  const event = parseEvent(rawEvent)
  const eventType = getEventType(event.type)
  await validateEvent(event, eventType)
  await saveEvent(event, eventType)
}
