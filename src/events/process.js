import { getEventType } from './types.js'
import { saveEvent } from './save.js'
import { validateEvent } from './validate.js'

export async function processEvent (message) {
  const event = JSON.parse(JSON.parse(message.Body).Message)
  const eventType = getEventType(event.type)
  await validateEvent(event, eventType)
  await saveEvent(event, eventType)
}
