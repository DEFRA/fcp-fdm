import { saveMessageEvent } from './save/message.js'
import { eventTypes } from './types.js'

const { MESSAGE_EVENT } = eventTypes

export async function saveEvent (event, eventType) {
  if (eventType === MESSAGE_EVENT) {
    await saveMessageEvent(event)
  } else {
    throw new Error(`Unknown event type: ${eventType}`)
  }
}
